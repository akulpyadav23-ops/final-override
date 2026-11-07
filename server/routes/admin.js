const express = require('express');
const router = express.Router();
const db = require('../db');
const config = require('../config');
const { generateVerificationCode } = require('../logic/security');

// Admin PIN middleware
function requireAdmin(req, res, next) {
  const pin = req.headers['x-admin-pin'] || req.query.pin || req.body.pin;
  if (!pin || pin !== config.ADMIN_PIN) {
    return res.status(401).json({ error: 'Unauthorized: Invalid Admin PIN.' });
  }
  next();
}

// POST /api/admin/verify - Verify admin pin
router.post('/verify', (req, res) => {
  const pin = req.body.pin;
  if (pin === config.ADMIN_PIN) {
    return res.json({ success: true });
  }
  return res.status(401).json({ error: 'Invalid Admin PIN.' });
});

// GET /api/admin/teams - List all teams
router.get('/teams', requireAdmin, (req, res) => {
  const teams = db.prepare('SELECT * FROM teams ORDER BY startedAt DESC').all();

  const clockPausedRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('clockPaused');
  const isClockPaused = clockPausedRow && clockPausedRow.value === 'true';

  const fullTeams = teams.map(t => {
    const members = db.prepare('SELECT id, fullName, isLeader, deviceToken FROM members WHERE teamId = ?').all(t.id);
    const progress = db.prepare('SELECT stage, fragment, wrongAttempts, hintsUsed, solvedAt FROM progress WHERE teamId = ?').all(t.id);

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

    let verificationCode = null;
    if (t.finishedAt) {
      verificationCode = generateVerificationCode(t.name, t.startedAt, t.finishedAt);
    }

    return {
      ...t,
      members,
      progress,
      totalHints,
      totalWrong,
      totalSeconds,
      formattedTime,
      verificationCode,
      isFinished: !!t.finishedAt
    };
  });

  const allowNewTeamsRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('allowNewTeams');

  return res.json({
    teams: fullTeams,
    isClockPaused,
    allowNewTeams: allowNewTeamsRow && allowNewTeamsRow.value === 'true',
    serverTime: Date.now()
  });
});

// POST /api/admin/skip - Skip stage for team (dry run testing)
router.post('/skip', requireAdmin, (req, res) => {
  const { teamId } = req.body;
  const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(teamId);
  if (!team) return res.status(404).json({ error: 'Team not found.' });

  const now = Date.now();
  const nextStage = team.stage + 1;

  if (team.stage >= 6) {
    db.prepare('UPDATE teams SET finishedAt = ? WHERE id = ?').run(now, team.id);
  } else {
    db.prepare('UPDATE teams SET stage = ? WHERE id = ?').run(nextStage, team.id);
  }

  return res.json({ success: true, newStage: nextStage });
});

// POST /api/admin/reset-team - Reset or remove team
router.post('/reset-team', requireAdmin, (req, res) => {
  const { teamId } = req.body;
  db.prepare('DELETE FROM teams WHERE id = ?').run(teamId);
  return res.json({ success: true });
});

// POST /api/admin/reset-member-device - Reset member device binding
router.post('/reset-member-device', requireAdmin, (req, res) => {
  const { memberId } = req.body;
  db.prepare('UPDATE members SET deviceToken = NULL WHERE id = ?').run(memberId);
  return res.json({ success: true });
});

// POST /api/admin/clock - Pause or resume clock
router.post('/clock', requireAdmin, (req, res) => {
  const { action } = req.body; // 'pause', 'resume', 'toggle', 'start', 'reset'
  const now = Date.now();

  const clockPausedRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('clockPaused');
  const isPaused = clockPausedRow && clockPausedRow.value === 'true';

  const pauseStartedRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('pauseStartedAt');
  const pauseStartedAt = parseInt(pauseStartedRow ? pauseStartedRow.value : '0', 10) || 0;

  const eventStartedRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('eventStartedAt');
  let eventStartedAt = parseInt(eventStartedRow ? eventStartedRow.value : '0', 10) || 0;

  let shouldPause = false;
  let shouldResume = false;

  if (action === 'start') {
    if (eventStartedAt === 0) {
      eventStartedAt = now;
      db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(String(now), 'eventStartedAt');
    }
    if (isPaused) shouldResume = true;
  } else if (action === 'pause' || action === 'stop') {
    shouldPause = !isPaused;
  } else if (action === 'resume') {
    shouldResume = isPaused;
  } else if (action === 'toggle') {
    if (isPaused) shouldResume = true;
    else shouldPause = true;
  } else if (action === 'reset') {
    db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(String(now), 'eventStartedAt');
    db.prepare('UPDATE settings SET value = ? WHERE key = ?').run('0', 'totalPausedMs');
    db.prepare('UPDATE settings SET value = ? WHERE key = ?').run('false', 'clockPaused');
    db.prepare('UPDATE settings SET value = ? WHERE key = ?').run('0', 'pauseStartedAt');
    return res.json({ success: true, isPaused: false, eventStartedAt: now });
  }

  if (shouldPause) {
    db.prepare('UPDATE settings SET value = ? WHERE key = ?').run('true', 'clockPaused');
    db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(String(now), 'pauseStartedAt');
    return res.json({ success: true, isPaused: true, eventStartedAt });
  } else if (shouldResume) {
    const duration = pauseStartedAt > 0 ? (now - pauseStartedAt) : 0;

    // Add paused duration to all active teams
    db.prepare('UPDATE teams SET pausedMs = pausedMs + ? WHERE finishedAt IS NULL').run(duration);

    // Update global totalPausedMs
    const totalPausedRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('totalPausedMs');
    const prevTotal = parseInt(totalPausedRow ? totalPausedRow.value : '0', 10) || 0;
    db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(String(prevTotal + duration), 'totalPausedMs');

    db.prepare('UPDATE settings SET value = ? WHERE key = ?').run('false', 'clockPaused');
    db.prepare('UPDATE settings SET value = ? WHERE key = ?').run('0', 'pauseStartedAt');
    return res.json({ success: true, isPaused: false, eventStartedAt });
  }

  return res.json({ success: true, isPaused, eventStartedAt });
});

// POST /api/admin/settings - Update settings like allowNewTeams
router.post('/settings', requireAdmin, (req, res) => {
  const { allowNewTeams } = req.body;
  if (typeof allowNewTeams === 'boolean') {
    db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(allowNewTeams ? 'true' : 'false', 'allowNewTeams');
  }
  return res.json({ success: true });
});

// POST /api/admin/coordinator - Rename/assign coordinator
router.post('/coordinator', requireAdmin, (req, res) => {
  const { teamId, coordinator } = req.body;
  if (!teamId || !coordinator) return res.status(400).json({ error: 'Missing teamId or coordinator' });
  db.prepare('UPDATE teams SET coordinator = ? WHERE id = ?').run(coordinator.trim(), teamId);
  return res.json({ success: true });
});

// GET /api/admin/warden-logs - View WARDEN chat logs
router.get('/warden-logs', requireAdmin, (req, res) => {
  const logs = db.prepare(`
    SELECT c.id, c.teamId, t.name as teamName, c.role, c.text, c.at
    FROM chat c
    JOIN teams t ON c.teamId = t.id
    ORDER BY c.at DESC
  `).all();
  return res.json({ logs });
});

// GET /api/admin/export - CSV export
router.get('/export', requireAdmin, (req, res) => {
  const teams = db.prepare('SELECT * FROM teams ORDER BY startedAt ASC').all();

  const rows = [
    ['Team Name', 'Coordinator', 'Members', 'Stage', 'Status', 'Started At', 'Finished At', 'Total Time (mm:ss)', 'Penalty (min)', 'Hints Used', 'Wrong Attempts', 'Verification Code']
  ];

  teams.forEach(t => {
    const members = db.prepare('SELECT fullName FROM members WHERE teamId = ?').all(t.id).map(m => m.fullName).join('; ');
    const progress = db.prepare('SELECT stage, wrongAttempts, hintsUsed FROM progress WHERE teamId = ?').all(t.id);
    const totalWrong = progress.reduce((acc, p) => acc + (p.wrongAttempts || 0), 0);
    const totalHints = progress.reduce((acc, p) => acc + (p.hintsUsed || 0), 0);

    const now = Date.now();
    let effectiveElapsedMs = t.finishedAt ? (t.finishedAt - t.startedAt - (t.pausedMs || 0)) : (now - t.startedAt - (t.pausedMs || 0));
    if (effectiveElapsedMs < 0) effectiveElapsedMs = 0;
    const totalSecs = Math.floor(effectiveElapsedMs / 1000) + (t.penaltyMin || 0) * 60;
    const timeStr = `${Math.floor(totalSecs / 60)}m ${totalSecs % 60}s`;

    let vCode = '';
    if (t.finishedAt) {
      vCode = generateVerificationCode(t.name, t.startedAt, t.finishedAt);
    }

    rows.push([
      `"${t.name.replace(/"/g, '""')}"`,
      `"${t.coordinator.replace(/"/g, '""')}"`,
      `"${members.replace(/"/g, '""')}"`,
      t.finishedAt ? '6/6 (Done)' : `${t.stage}/6`,
      t.finishedAt ? 'Completed' : 'In Progress',
      new Date(t.startedAt).toISOString(),
      t.finishedAt ? new Date(t.finishedAt).toISOString() : 'N/A',
      `"${timeStr}"`,
      t.penaltyMin,
      totalHints,
      totalWrong,
      `"${vCode}"`
    ]);
  });

  const csv = rows.map(r => r.join(',')).join('\r\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="final_override_results.csv"');
  return res.send(csv);
});

module.exports = router;
