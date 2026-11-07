const express = require('express');
const router = express.Router();
const db = require('../db');
const { norm } = require('../logic/security');

// GET /api/coordinator?name=...
router.get('/', (req, res) => {
  const coordName = (req.query.name || '').trim();
  if (!coordName) {
    return res.status(400).json({ error: 'Coordinator name is required.' });
  }

  const allTeams = db.prepare(`
    SELECT id, name, coordinator, startedAt, finishedAt, stage, penaltyMin, pausedMs
    FROM teams
  `).all();

  // Filter only teams whose coordinator matches the logged in coordinator
  const matchedTeams = allTeams.filter(t => norm(t.coordinator) === norm(coordName));

  const clockPausedRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('clockPaused');
  const isClockPaused = clockPausedRow && clockPausedRow.value === 'true';

  const results = matchedTeams.map(t => {
    const members = db.prepare('SELECT fullName, isLeader, deviceToken FROM members WHERE teamId = ?').all(t.id);
    const progress = db.prepare('SELECT stage, wrongAttempts, hintsUsed, solvedAt FROM progress WHERE teamId = ?').all(t.id);

    const totalWrong = progress.reduce((acc, p) => acc + (p.wrongAttempts || 0), 0);
    const totalHints = progress.reduce((acc, p) => acc + (p.hintsUsed || 0), 0);

    const now = Date.now();
    let effectiveElapsedMs = 0;
    if (t.finishedAt) {
      effectiveElapsedMs = t.finishedAt - t.startedAt - (t.pausedMs || 0);
    } else {
      effectiveElapsedMs = now - t.startedAt - (t.pausedMs || 0);
    }
    if (effectiveElapsedMs < 0) effectiveElapsedMs = 0;

    const totalSeconds = Math.floor(effectiveElapsedMs / 1000) + (t.penaltyMin || 0) * 60;
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    const formattedTime = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    let status = 'In Progress';
    if (t.finishedAt) {
      status = '✅ Done';
    } else if (isClockPaused) {
      status = '⏸️ Paused';
    }

    return {
      id: t.id,
      name: t.name,
      coordinator: t.coordinator,
      players: members.map(m => m.fullName),
      stageText: t.finishedAt ? '✅ Done' : `${t.stage}/6`,
      stageNumber: t.finishedAt ? 7 : t.stage,
      formattedTime,
      totalSeconds,
      penaltyMin: t.penaltyMin,
      totalHints,
      totalWrong,
      status
    };
  });

  return res.json({
    coordinator: coordName,
    serverTime: Date.now(),
    teams: results
  });
});

module.exports = router;
