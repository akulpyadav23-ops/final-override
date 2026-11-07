const express = require('express');
const router = express.Router();
const db = require('../db');
const { handleWardenChat } = require('../logic/warden');

router.post('/', async (req, res) => {
  const leaderToken = req.cookies.fo_leader_token;
  if (!leaderToken) {
    return res.status(401).json({ error: 'Unauthorized: Team session required.' });
  }

  const team = db.prepare('SELECT * FROM teams WHERE sessionToken = ?').get(leaderToken);
  if (!team) {
    return res.status(401).json({ error: 'Team not found.' });
  }

  if (team.stage !== 3) {
    return res.status(403).json({ error: 'WARDEN AI is only active in Stage 3.' });
  }

  const message = (req.body.message || '').trim();
  if (!message) {
    return res.status(400).json({ error: 'Message cannot be empty.' });
  }

  if (message.length > 600) {
    return res.status(400).json({ error: 'Message exceeds 600 characters limit.' });
  }

  // Rate limiting: max 40 messages per hour per team
  const oneHourAgo = Date.now() - 3600 * 1000;
  const countRow = db.prepare('SELECT COUNT(*) as count FROM chat WHERE teamId = ? AND role = ? AND at > ?')
    .get(team.id, 'user', oneHourAgo);

  if (countRow.count >= 40) {
    return res.status(429).json({ error: 'Message limit reached (max 40 messages per hour).' });
  }

  const now = Date.now();
  // Log user message
  db.prepare('INSERT INTO chat (teamId, role, text, at) VALUES (?, ?, ?, ?)').run(
    team.id,
    'user',
    message,
    now
  );

  try {
    const reply = await handleWardenChat(message);

    // Log WARDEN reply
    db.prepare('INSERT INTO chat (teamId, role, text, at) VALUES (?, ?, ?, ?)').run(
      team.id,
      'warden',
      reply,
      Date.now()
    );

    return res.json({ reply });
  } catch (err) {
    console.error('Error handling WARDEN chat:', err);
    return res.status(500).json({ error: 'Internal AI communication failure.' });
  }
});

// GET /api/warden/history
router.get('/history', (req, res) => {
  const leaderToken = req.cookies.fo_leader_token;
  if (!leaderToken) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  const team = db.prepare('SELECT * FROM teams WHERE sessionToken = ?').get(leaderToken);
  if (!team || team.stage !== 3) {
    return res.status(403).json({ error: 'Forbidden.' });
  }

  const history = db.prepare('SELECT role, text, at FROM chat WHERE teamId = ? ORDER BY at ASC').all(team.id);
  return res.json({ history });
});

module.exports = router;
