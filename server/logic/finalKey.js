const { norm } = require('./security');

function reverseString(str) {
  return str.split('').reverse().join('');
}

function computeFinalKey(f1, f2, f3, f4, f5) {
  // f1 = NOVA, f2 = 7K2, f3 = ORBIT, f4 = 91X, f5 = team code with dashes
  // Alphabetical order: CTF Challenges (f4), Decoding (f2), Media Analysis (f1), Prompt the AI (reverse f3), Team Sync (f5 without dashes)
  const f5NoDashes = String(f5).replace(/-/g, '');
  const body = [
    f4,
    f2,
    f1,
    reverseString(f3),
    f5NoDashes
  ].join('-');

  let digitSum = 0;
  for (let i = 0; i < body.length; i++) {
    const char = body[i];
    if (char >= '0' && char <= '9') {
      digitSum += parseInt(char, 10);
    }
  }

  const key = `FO{${body}}#${digitSum}`;
  return norm(key);
}

module.exports = {
  computeFinalKey,
  reverseString
};
