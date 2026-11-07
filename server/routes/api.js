const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db');
const config = require('../config');
const { norm, hashAnswer, generateToken, generateVerificationCode } = require('../logic/security');
const { STAGE_CONFIG } = require('../logic/stages');
const { getMemberShard, computeTeamCode } = require('../logic/shard');
const { computeFinalKey } = require('../logic/finalKey');

// In-memory rate limiting map: teamId -> lastSubmitTimestamp
const lastSubmissions = new Map();

// Middleware to get current team from leader token
function requireTeam(req, res, next) {
  const token = req.cookies.fo_leader_token;
  if (!token) {
    return res.status(401).json({ error: 'No active mission session found.' });
  }
  const team = db.prepare('SELECT * FROM teams WHERE sessionToken = ?').get(token);
  if (!team) {
    return res.status(401).json({ error: 'Team session invalid or expired.' });
  }
  req.team = team;
  next();
}

// POST /api/teams - Register team
router.post('/teams', (req, res) => {
  const { teamName, coordinator, member1, member2, member3, member4 } = req.body;

  const rawTeamName = (teamName || '').trim();
  const rawCoord = (coordinator || '').trim();

  if (!rawTeamName || !rawCoord) {
    return res.status(400).json({ error: 'Please enter the team name and the event coordinator name.' });
  }

  if (rawTeamName.length > 24) {
    return res.status(400).json({ error: 'Team name cannot exceed 24 characters.' });
  }

  const rawMembers = [member1, member2, member3, member4]
    .map(m => (m || '').trim())
    .filter(Boolean);

  if (rawMembers.length < 3) {
    return res.status(400).json({ error: 'A team needs at least 3 players. Enter 3 or 4 full names.' });
  }

  // Check unique member names (case-insensitive)
  const normMembers = rawMembers.map(m => norm(m));
  const uniqueNorms = new Set(normMembers);
  if (uniqueNorms.size !== rawMembers.length) {
    return res.status(400).json({ error: 'Each member must have a different name.' });
  }

  // Check duplicate team name (case-insensitive)
  const existing = db.prepare('SELECT id FROM teams WHERE name = ? COLLATE NOCASE').get(rawTeamName);
  if (existing) {
    return res.status(400).json({ error: 'Team name is already taken. Please choose another name.' });
  }

  const teamId = crypto.randomUUID();
  const sessionToken = generateToken();
  const now = Date.now();

  const insertTeam = db.prepare(`
    INSERT INTO teams (id, name, coordinator, startedAt, finishedAt, stage, penaltyMin, pausedMs, sessionToken)
    VALUES (?, ?, ?, ?, NULL, 1, 0, 0, ?)
  `);

  const insertMember = db.prepare(`
    INSERT INTO members (id, teamId, fullName, isLeader, deviceToken)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertProgress = db.prepare(`
    INSERT INTO progress (teamId, stage, fragment, wrongAttempts, hintsUsed, solvedAt)
    VALUES (?, ?, NULL, 0, 0, NULL)
  `);

  const tx = db.transaction(() => {
    insertTeam.run(teamId, rawTeamName, rawCoord, now, sessionToken);

    // Leader is member1
    insertMember.run(crypto.randomUUID(), teamId, rawMembers[0], 1, null);
    for (let i = 1; i < rawMembers.length; i++) {
      insertMember.run(crypto.randomUUID(), teamId, rawMembers[i], 0, null);
    }

    for (let s = 1; s <= 6; s++) {
      insertProgress.run(teamId, s);
    }
  });

  tx();

  res.cookie('fo_leader_token', sessionToken, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 3600 * 1000
  });

  return res.json({
    success: true,
    team: {
      id: teamId,
      name: rawTeamName,
      coordinator: rawCoord,
      startedAt: now,
      stage: 1
    }
  });
});

// GET /api/state - Current game state
router.get('/state', requireTeam, (req, res) => {
  const team = req.team;
  const currentStage = team.stage;

  // Global pause status
  const clockPausedRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('clockPaused');
  const isClockPaused = clockPausedRow && clockPausedRow.value === 'true';

  // Get solved fragments from progress
  const progressRows = db.prepare('SELECT stage, fragment, wrongAttempts, hintsUsed, solvedAt FROM progress WHERE teamId = ? ORDER BY stage ASC').all(team.id);

  const notebook = {};
  progressRows.forEach(row => {
    if (row.fragment) {
      notebook[row.stage] = row.fragment;
    }
  });

  const currentProg = progressRows.find(p => p.stage === currentStage) || { wrongAttempts: 0, hintsUsed: 0 };

  const stageConfig = STAGE_CONFIG[currentStage] || {};
  const revealedHints = (stageConfig.hints || []).slice(0, currentProg.hintsUsed);

  // Members
  const members = db.prepare('SELECT id, fullName, isLeader, deviceToken FROM members WHERE teamId = ?').all(team.id);
  const totalMembers = members.length;
  // Distinct joined devices count:
  // Leader counts as 1 device, plus each other member who has a non-null deviceToken
  const joinedMembers = members.filter(m => m.isLeader === 1 || m.deviceToken !== null);
  const joinedCount = joinedMembers.length;

  const leaderMember = members.find(m => m.isLeader === 1);
  const leaderShard = leaderMember ? getMemberShard(team.name, leaderMember.fullName) : null;

  // Build stage-specific payload (ISOLATION ENFORCED: future stage details are never returned)
  let stageContent = null;
  if (team.finishedAt) {
    // Finished
  } else if (currentStage === 1) {
    stageContent = {
      morsePattern: stageConfig.morsePattern
    };
  } else if (currentStage === 2) {
    stageContent = {
      encodedText: stageConfig.encodedText
    };
  } else if (currentStage === 3) {
    stageContent = {
      aiActive: true
    };
  } else if (currentStage === 4) {
    stageContent = {
      commentToken: stageConfig.commentToken
    };
  } else if (currentStage === 5) {
    stageContent = {
      joinedCount,
      totalMembers,
      leaderShard,
      members: members.map(m => m.fullName)
    };
  } else if (currentStage === 6) {
    stageContent = {
      notebook
    };
  }

  let verificationCode = null;
  if (team.finishedAt) {
    verificationCode = generateVerificationCode(team.name, team.startedAt, team.finishedAt);
  }

  // Check if admin allows new teams
  const allowNewTeamsRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('allowNewTeams');
  const allowNewTeams = allowNewTeamsRow && allowNewTeamsRow.value === 'true';

  return res.json({
    team: {
      id: team.id,
      name: team.name,
      coordinator: team.coordinator,
      startedAt: team.startedAt,
      finishedAt: team.finishedAt,
      stage: team.stage,
      penaltyMin: team.penaltyMin,
      pausedMs: team.pausedMs,
      isPaused: isClockPaused
    },
    members: members.map(m => ({ fullName: m.fullName, isLeader: !!m.isLeader })),
    currentProg: {
      wrongAttempts: currentProg.wrongAttempts,
      hintsUsed: currentProg.hintsUsed
    },
    revealedHints,
    notebook,
    stageContent,
    serverTime: Date.now(),
    verificationCode,
    allowNewTeams
  });
});

// POST /api/submit - Submit answer
router.post('/submit', requireTeam, (req, res) => {
  const team = req.team;

  if (team.finishedAt) {
    return res.status(400).json({ error: 'Mission already completed.' });
  }

  // Rate limit: 1 submission per second per team
  const now = Date.now();
  const lastTime = lastSubmissions.get(team.id) || 0;
  if (now - lastTime < 1000) {
    return res.status(429).json({ error: 'Please wait a second before submitting again.' });
  }
  lastSubmissions.set(team.id, now);

  const stage = team.stage;
  const rawAnswer = req.body.answer;
  const normalizedInput = norm(rawAnswer);

  if (!normalizedInput) {
    return res.status(400).json({ error: 'Answer cannot be empty.' });
  }

  const members = db.prepare('SELECT fullName, isLeader, deviceToken FROM members WHERE teamId = ?').all(team.id);

  let isCorrect = false;
  let fragmentFound = null;

  if (stage === 1) {
    isCorrect = normalizedInput === 'NOVA';
    fragmentFound = 'NOVA';
  } else if (stage === 2) {
    isCorrect = normalizedInput === '7K2';
    fragmentFound = '7K2';
  } else if (stage === 3) {
    isCorrect = normalizedInput === 'ORBIT';
    fragmentFound = 'ORBIT';
  } else if (stage === 4) {
    isCorrect = normalizedInput === '91X';
    fragmentFound = '91X';
  } else if (stage === 5) {
    // Check device requirement: at least 3 distinct member sessions must have joined
    const joinedDistinct = members.filter(m => m.isLeader === 1 || m.deviceToken !== null);
    if (joinedDistinct.length < 3) {
      return res.status(400).json({
        error: 'Waiting for your teammates to join on their own laptops. 🤝'
      });
    }

    const memberNames = members.map(m => m.fullName);
    const expectedTeamCode = computeTeamCode(team.name, memberNames);
    isCorrect = normalizedInput === norm(expectedTeamCode);
    fragmentFound = expectedTeamCode;
  } else if (stage === 6) {
    // Stage 6 final key
    const progressList = db.prepare('SELECT stage, fragment FROM progress WHERE teamId = ?').all(team.id);
    const fMap = {};
    progressList.forEach(p => { fMap[p.stage] = p.fragment; });

    // Fallbacks if somehow missing
    const f1 = fMap[1] || 'NOVA';
    const f2 = fMap[2] || '7K2';
    const f3 = fMap[3] || 'ORBIT';
    const f4 = fMap[4] || '91X';
    const memberNames = members.map(m => m.fullName);
    const f5 = fMap[5] || computeTeamCode(team.name, memberNames);

    const expectedKey = computeFinalKey(f1, f2, f3, f4, f5);
    isCorrect = normalizedInput === norm(expectedKey);
    fragmentFound = expectedKey;
  }

  // Record submission log
  db.prepare('INSERT INTO submissions (teamId, stage, valueHash, ok, at) VALUES (?, ?, ?, ?, ?)').run(
    team.id,
    stage,
    hashAnswer(normalizedInput),
    isCorrect ? 1 : 0,
    now
  );

  const prog = db.prepare('SELECT wrongAttempts, hintsUsed FROM progress WHERE teamId = ? AND stage = ?').get(team.id, stage);

  if (isCorrect) {
    // Update progress
    db.prepare('UPDATE progress SET fragment = ?, solvedAt = ? WHERE teamId = ? AND stage = ?').run(
      fragmentFound,
      now,
      team.id,
      stage
    );

    let finishedAt = null;
    let nextStage = stage + 1;

    if (stage === 6) {
      finishedAt = now;
      nextStage = 6;
      db.prepare('UPDATE teams SET finishedAt = ? WHERE id = ?').run(finishedAt, team.id);
    } else {
      db.prepare('UPDATE teams SET stage = ? WHERE id = ?').run(nextStage, team.id);
    }

    let verificationCode = null;
    if (finishedAt) {
      verificationCode = generateVerificationCode(team.name, team.startedAt, finishedAt);
    }

    return res.json({
      success: true,
      stage,
      nextStage,
      fragment: fragmentFound,
      finished: !!finishedAt,
      verificationCode
    });
  } else {
    // Incorrect answer
    const newWrong = (prog ? prog.wrongAttempts : 0) + 1;
    let extraPenalty = 0;
    if (newWrong > 5) {
      extraPenalty = 1; // +1 min penalty
    }

    const newTeamPenalty = team.penaltyMin + extraPenalty;

    db.prepare('UPDATE progress SET wrongAttempts = ? WHERE teamId = ? AND stage = ?').run(
      newWrong,
      team.id,
      stage
    );

    if (extraPenalty > 0) {
      db.prepare('UPDATE teams SET penaltyMin = ? WHERE id = ?').run(newTeamPenalty, team.id);
    }

    return res.json({
      success: false,
      wrongAttempts: newWrong,
      penaltyApplied: newWrong > 5,
      totalPenaltyMin: newTeamPenalty
    });
  }
});

// POST /api/hint - Request a hint for current stage
router.post('/hint', requireTeam, (req, res) => {
  const team = req.team;

  if (team.finishedAt) {
    return res.status(400).json({ error: 'Mission already completed.' });
  }

  const stage = team.stage;
  const stageConfig = STAGE_CONFIG[stage];
  if (!stageConfig || !stageConfig.hints) {
    return res.status(400).json({ error: 'No hints available for this mission.' });
  }

  const prog = db.prepare('SELECT hintsUsed FROM progress WHERE teamId = ? AND stage = ?').get(team.id, stage);
  const currentHintsUsed = prog ? prog.hintsUsed : 0;

  if (currentHintsUsed >= 2) {
    return res.status(400).json({ error: 'Maximum hints (2) already unlocked for this mission.' });
  }

  const cost = currentHintsUsed === 0 ? 3 : 5; // First hint +3 min, second +5 min
  const newHintsUsed = currentHintsUsed + 1;
  const newPenalty = team.penaltyMin + cost;

  db.prepare('UPDATE progress SET hintsUsed = ? WHERE teamId = ? AND stage = ?').run(newHintsUsed, team.id, stage);
  db.prepare('UPDATE teams SET penaltyMin = ? WHERE id = ?').run(newPenalty, team.id);

  const unlockedHint = stageConfig.hints[newHintsUsed - 1];

  return res.json({
    success: true,
    hintsUsed: newHintsUsed,
    hint: unlockedHint,
    penaltyMin: newPenalty
  });
});

// POST /api/join - Joining as a team member
router.post('/join', (req, res) => {
  const { teamName, fullName } = req.body;

  const rawTeam = (teamName || '').trim();
  const rawName = (fullName || '').trim();

  if (!rawTeam || !rawName) {
    return res.status(400).json({ error: 'Please enter team name and your full name.' });
  }

  // Refuse if request carries the leader's session cookie
  const leaderToken = req.cookies.fo_leader_token;
  if (leaderToken) {
    const leaderTeam = db.prepare('SELECT id FROM teams WHERE sessionToken = ?').get(leaderToken);
    if (leaderTeam) {
      return res.status(403).json({
        error: 'This device is running the team. Please use your own laptop to get your shard. 🙂'
      });
    }
  }

  // Find team (case/space-insensitive)
  const allTeams = db.prepare('SELECT id, name FROM teams').all();
  const targetTeam = allTeams.find(t => norm(t.name) === norm(rawTeam));
  if (!targetTeam) {
    return res.status(404).json({ error: 'Team not found. Please check the team name.' });
  }

  // Find member in team (case/space-insensitive)
  const teamMembers = db.prepare('SELECT id, fullName, isLeader, deviceToken FROM members WHERE teamId = ?').all(targetTeam.id);
  const targetMember = teamMembers.find(m => norm(m.fullName) === norm(rawName));

  if (!targetMember) {
    return res.status(404).json({ error: 'Member name not found in this team. Check exact spelling.' });
  }

  // Device binding check
  let memberToken = req.cookies.fo_member_token;

  if (targetMember.deviceToken) {
    // If already bound, check if current cookie matches
    if (memberToken !== targetMember.deviceToken) {
      return res.status(403).json({
        error: 'This member name is already bound to another device. Contact the admin if you need a reset.'
      });
    }
  } else {
    // If another member has already claimed this browser's device token, prevent re-use
    if (memberToken) {
      const alreadyClaimed = teamMembers.find(m => m.deviceToken === memberToken && m.id !== targetMember.id);
      if (alreadyClaimed) {
        return res.status(403).json({
          error: 'This device is already bound to another team member.'
        });
      }
    } else {
      memberToken = generateToken();
    }

    db.prepare('UPDATE members SET deviceToken = ? WHERE id = ?').run(memberToken, targetMember.id);
  }

  // Set member cookie
  res.cookie('fo_member_token', memberToken, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 3600 * 1000
  });

  const memberShard = getMemberShard(targetTeam.name, targetMember.fullName);

  return res.json({
    success: true,
    team: targetTeam.name,
    name: targetMember.fullName,
    shard: memberShard
  });
});

// POST /api/new-team - Clear leader session to register a new team (if allowed by admin)
router.post('/new-team', (req, res) => {
  const allowNewTeamsRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('allowNewTeams');
  if (!allowNewTeamsRow || allowNewTeamsRow.value !== 'true') {
    return res.status(403).json({ error: 'Admin has not enabled new team registration yet.' });
  }

  res.clearCookie('fo_leader_token');
  res.clearCookie('fo_member_token');
  return res.json({ success: true });
});

module.exports = router;
