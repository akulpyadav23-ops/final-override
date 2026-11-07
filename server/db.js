const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const isVercel = process.env.VERCEL || process.env.NOW_REGION;
const dbPath = isVercel
  ? path.join('/tmp', 'final_override.db')
  : path.join(__dirname, '..', 'data', 'final_override.db');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

// Enable WAL mode for high performance concurrency
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE COLLATE NOCASE,
      coordinator TEXT COLLATE NOCASE,
      startedAt INTEGER NOT NULL,
      finishedAt INTEGER,
      stage INTEGER DEFAULT 1,
      penaltyMin INTEGER DEFAULT 0,
      pausedMs INTEGER DEFAULT 0,
      sessionToken TEXT UNIQUE
    );

    CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY,
      teamId TEXT NOT NULL,
      fullName TEXT NOT NULL,
      isLeader INTEGER NOT NULL DEFAULT 0,
      deviceToken TEXT,
      FOREIGN KEY (teamId) REFERENCES teams(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS progress (
      teamId TEXT NOT NULL,
      stage INTEGER NOT NULL,
      fragment TEXT,
      wrongAttempts INTEGER DEFAULT 0,
      hintsUsed INTEGER DEFAULT 0,
      solvedAt INTEGER,
      PRIMARY KEY (teamId, stage),
      FOREIGN KEY (teamId) REFERENCES teams(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      teamId TEXT NOT NULL,
      stage INTEGER NOT NULL,
      valueHash TEXT,
      ok INTEGER NOT NULL,
      at INTEGER NOT NULL,
      FOREIGN KEY (teamId) REFERENCES teams(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS chat (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      teamId TEXT NOT NULL,
      role TEXT NOT NULL,
      text TEXT NOT NULL,
      at INTEGER NOT NULL,
      FOREIGN KEY (teamId) REFERENCES teams(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // Ensure default settings exist
  const setStmt = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  setStmt.run('clockPaused', 'false');
  setStmt.run('pauseStartedAt', '0');
  setStmt.run('allowNewTeams', 'false');
  setStmt.run('eventStartedAt', '0');
  setStmt.run('totalPausedMs', '0');
}

initSchema();

module.exports = db;
