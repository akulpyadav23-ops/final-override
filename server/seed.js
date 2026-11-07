const db = require('./db');
const { v4: uuidv4 } = require('crypto');

function resetDatabase() {
  db.exec(`
    DELETE FROM submissions;
    DELETE FROM chat;
    DELETE FROM progress;
    DELETE FROM members;
    DELETE FROM teams;
    DELETE FROM settings;
    INSERT INTO settings (key, value) VALUES ('clockPaused', 'false');
    INSERT INTO settings (key, value) VALUES ('pauseStartedAt', '0');
    INSERT INTO settings (key, value) VALUES ('allowNewTeams', 'false');
  `);
  console.log('✅ Final Override database successfully reset.');
}

if (require.main === module) {
  resetDatabase();
  process.exit(0);
}

module.exports = { resetDatabase };
