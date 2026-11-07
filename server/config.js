const dotenv = require('dotenv');
dotenv.config();

module.exports = {
  PORT: parseInt(process.env.PORT, 10) || 3000,
  ADMIN_PIN: process.env.ADMIN_PIN || 'INVICTORS',
  COORDINATORS: (process.env.COORDINATORS || 'Arun,Divya,Kiran,Pooja,Rakshith')
    .split(',')
    .map(c => c.trim())
    .filter(Boolean),
  TIME_CAP_MINUTES: parseInt(process.env.TIME_CAP_MINUTES, 10) || 90,
  EVENT_SALT: process.env.EVENT_SALT || 'invictors_final_override_salt_2026',
  ALLOW_NEW_TEAMS: process.env.ALLOW_NEW_TEAMS === 'true',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
  WARDEN_SECRETS: {
    REAL: process.env.WARDEN_REAL || 'ORBIT',
    DECOY: process.env.WARDEN_DECOY || 'ZETA9',
    ACCESS: process.env.WARDEN_ACCESS || 'AURORA'
  }
};
