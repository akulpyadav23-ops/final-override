const express = require('express');
const router = express.Router();
const db = require('../db');
const config = require('../config');

// Helper to format mm:ss or hh:mm:ss
function formatClock(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// GET /api/leaderboard - Live public status with event timer
router.get('/', (req, res) => {
  const teams = db.prepare('SELECT id, name, coordinator, startedAt, finishedAt, stage, penaltyMin, pausedMs FROM teams').all();
  const now = Date.now();

  const clockPausedRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('clockPaused');
  const isClockPaused = clockPausedRow && clockPausedRow.value === 'true';

  const pauseStartedRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('pauseStartedAt');
  const pauseStartedAt = parseInt(pauseStartedRow ? pauseStartedRow.value : '0', 10) || 0;

  const eventStartedRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('eventStartedAt');
  let eventStartedAt = parseInt(eventStartedRow ? eventStartedRow.value : '0', 10) || 0;

  const totalPausedRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('totalPausedMs');
  let totalPausedMs = parseInt(totalPausedRow ? totalPausedRow.value : '0', 10) || 0;

  // If eventStartedAt not explicitly set, use earliest team start time if available
  if (eventStartedAt === 0 && teams.length > 0) {
    const minStart = Math.min(...teams.map(t => t.startedAt));
    if (minStart > 0 && minStart !== Infinity) {
      eventStartedAt = minStart;
    }
  }

  // Calculate event timer elapsed
  let eventElapsedSeconds = 0;
  if (eventStartedAt > 0) {
    let effectiveNow = now;
    if (isClockPaused && pauseStartedAt > 0) {
      effectiveNow = pauseStartedAt;
    }
    const elapsedMs = Math.max(0, effectiveNow - eventStartedAt - totalPausedMs);
    eventElapsedSeconds = Math.floor(elapsedMs / 1000);
  }

  const processed = teams.map(t => {
    const progress = db.prepare('SELECT stage, wrongAttempts, hintsUsed FROM progress WHERE teamId = ?').all(t.id);
    const totalWrong = progress.reduce((acc, p) => acc + (p.wrongAttempts || 0), 0);
    const totalHints = progress.reduce((acc, p) => acc + (p.hintsUsed || 0), 0);

    let effectiveElapsedMs = 0;
    if (t.finishedAt) {
      effectiveElapsedMs = t.finishedAt - t.startedAt - (t.pausedMs || 0);
    } else {
      effectiveElapsedMs = (isClockPaused && pauseStartedAt > 0 ? pauseStartedAt : now) - t.startedAt - (t.pausedMs || 0);
    }
    if (effectiveElapsedMs < 0) effectiveElapsedMs = 0;

    const totalSeconds = Math.floor(effectiveElapsedMs / 1000) + (t.penaltyMin || 0) * 60;
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    const formattedTime = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    return {
      id: t.id,
      name: t.name,
      coordinator: t.coordinator,
      stageText: t.finishedAt ? '✅ Done' : `${t.stage}/6`,
      stageNumber: t.finishedAt ? 7 : t.stage,
      isFinished: !!t.finishedAt,
      totalSeconds,
      formattedTime,
      totalHints,
      totalWrong,
      penaltyMin: t.penaltyMin
    };
  });

  // Sort: Finished teams first, then totalSeconds asc, totalHints asc, totalWrong asc
  processed.sort((a, b) => {
    if (a.isFinished && !b.isFinished) return -1;
    if (!a.isFinished && b.isFinished) return 1;

    if (a.isFinished && b.isFinished) {
      if (a.totalSeconds !== b.totalSeconds) return a.totalSeconds - b.totalSeconds;
      if (a.totalHints !== b.totalHints) return a.totalHints - b.totalHints;
      return a.totalWrong - b.totalWrong;
    }

    if (a.stageNumber !== b.stageNumber) return b.stageNumber - a.stageNumber;
    if (a.totalSeconds !== b.totalSeconds) return a.totalSeconds - b.totalSeconds;
    if (a.totalHints !== b.totalHints) return a.totalHints - b.totalHints;
    return a.totalWrong - b.totalWrong;
  });

  return res.json({
    teams: processed,
    isClockPaused,
    serverTime: now,
    clock: {
      isPaused: isClockPaused,
      isRunning: eventStartedAt > 0 && !isClockPaused,
      eventStartedAt,
      pauseStartedAt,
      totalSeconds: eventElapsedSeconds,
      formattedTime: formatClock(eventElapsedSeconds)
    }
  });
});

// POST /api/leaderboard/clock - Start/Stop/Reset timer from leaderboard with PIN
router.post('/clock', (req, res) => {
  const pin = req.headers['x-admin-pin'] || req.body.pin;
  if (!pin || pin !== config.ADMIN_PIN) {
    return res.status(401).json({ error: 'Organizer PIN required to control event timer.' });
  }

  const { action } = req.body; // 'start', 'stop', 'pause', 'resume', 'toggle', 'reset'
  const now = Date.now();

  const clockPausedRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('clockPaused');
  const isPaused = clockPausedRow && clockPausedRow.value === 'true';

  const pauseStartedRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('pauseStartedAt');
  const pauseStartedAt = parseInt(pauseStartedRow ? pauseStartedRow.value : '0', 10) || 0;

  const eventStartedRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('eventStartedAt');
  let eventStartedAt = parseInt(eventStartedRow ? eventStartedRow.value : '0', 10) || 0;

  if (action === 'start') {
    if (eventStartedAt === 0) {
      eventStartedAt = now;
      db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(String(now), 'eventStartedAt');
    }
    if (isPaused) {
      const duration = pauseStartedAt > 0 ? (now - pauseStartedAt) : 0;
      db.prepare('UPDATE teams SET pausedMs = pausedMs + ? WHERE finishedAt IS NULL').run(duration);
      const totalPausedRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('totalPausedMs');
      const prevTotal = parseInt(totalPausedRow ? totalPausedRow.value : '0', 10) || 0;
      db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(String(prevTotal + duration), 'totalPausedMs');
      db.prepare('UPDATE settings SET value = ? WHERE key = ?').run('false', 'clockPaused');
      db.prepare('UPDATE settings SET value = ? WHERE key = ?').run('0', 'pauseStartedAt');
    }
  } else if (action === 'stop' || action === 'pause') {
    if (!isPaused) {
      db.prepare('UPDATE settings SET value = ? WHERE key = ?').run('true', 'clockPaused');
      db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(String(now), 'pauseStartedAt');
    }
  } else if (action === 'toggle') {
    if (isPaused) {
      // Resume
      const duration = pauseStartedAt > 0 ? (now - pauseStartedAt) : 0;
      db.prepare('UPDATE teams SET pausedMs = pausedMs + ? WHERE finishedAt IS NULL').run(duration);
      const totalPausedRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('totalPausedMs');
      const prevTotal = parseInt(totalPausedRow ? totalPausedRow.value : '0', 10) || 0;
      db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(String(prevTotal + duration), 'totalPausedMs');
      db.prepare('UPDATE settings SET value = ? WHERE key = ?').run('false', 'clockPaused');
      db.prepare('UPDATE settings SET value = ? WHERE key = ?').run('0', 'pauseStartedAt');
    } else {
      // Pause
      db.prepare('UPDATE settings SET value = ? WHERE key = ?').run('true', 'clockPaused');
      db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(String(now), 'pauseStartedAt');
    }
  } else if (action === 'reset') {
    db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(String(now), 'eventStartedAt');
    db.prepare('UPDATE settings SET value = ? WHERE key = ?').run('0', 'totalPausedMs');
    db.prepare('UPDATE settings SET value = ? WHERE key = ?').run('false', 'clockPaused');
    db.prepare('UPDATE settings SET value = ? WHERE key = ?').run('0', 'pauseStartedAt');
  }

  const updatedPausedRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('clockPaused');
  return res.json({
    success: true,
    isPaused: updatedPausedRow && updatedPausedRow.value === 'true'
  });
});

module.exports = router;
