const crypto = require('crypto');
const config = require('../config');

function norm(s) {
  if (s === null || s === undefined) return '';
  return String(s).trim().replace(/\s+/g, '').toUpperCase();
}

function sha256(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function hashAnswer(answer) {
  return sha256(`${config.EVENT_SALT}|${norm(answer)}`);
}

function generateToken() {
  return crypto.randomBytes(24).toString('hex');
}

function generateVerificationCode(teamName, startedAtMs, finishedAtMs) {
  const payload = `${teamName}${startedAtMs}${finishedAtMs}`;
  return sha256(payload).slice(0, 8).toUpperCase();
}

module.exports = {
  norm,
  sha256,
  hashAnswer,
  generateToken,
  generateVerificationCode
};
