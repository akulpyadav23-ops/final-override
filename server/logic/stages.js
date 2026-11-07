const { norm } = require('./security');
const { computeTeamCode, getMemberShard } = require('./shard');
const { computeFinalKey } = require('./finalKey');

const STAGE_CONFIG = {
  1: {
    name: 'Media Analysis',
    icon: '🎧',
    answer: 'NOVA',
    decoy: 'ZETA9',
    hints: [
      'Listen for long and short beeps. Something on screen is only a distraction.',
      'Morse code: short = dot, long = dash. Four letters. Ignore the flash.'
    ],
    // Morse pulses: [type, durationInUnits]: 1=dot, 3=dash, pause between symbols=1, between letters=4
    // N: -.  (dash 3, gap 1, dot 1) -> gap 4
    // O: --- (dash 3, gap 1, dash 3, gap 1, dash 3) -> gap 4
    // V: ...- (dot 1, gap 1, dot 1, gap 1, dot 1, gap 1, dash 3) -> gap 4
    // A: .- (dot 1, gap 1, dash 3)
    morsePattern: [
      { tone: true, u: 3 }, { tone: false, u: 1 }, { tone: true, u: 1 }, // N
      { tone: false, u: 4 },
      { tone: true, u: 3 }, { tone: false, u: 1 }, { tone: true, u: 3 }, { tone: false, u: 1 }, { tone: true, u: 3 }, // O
      { tone: false, u: 4 },
      { tone: true, u: 1 }, { tone: false, u: 1 }, { tone: true, u: 1 }, { tone: false, u: 1 }, { tone: true, u: 1 }, { tone: false, u: 1 }, { tone: true, u: 3 }, // V
      { tone: false, u: 4 },
      { tone: true, u: 1 }, { tone: false, u: 1 }, { tone: true, u: 3 } // A
    ]
  },
  2: {
    name: 'Decoding',
    icon: '🔓',
    answer: '7K2',
    encodedText: 'NGU1MDUwNTI0NjQ2MjA0MzU1NDU0ZTQ2NTIyMDU2NDYyMDRlNDg0NTQyNDU0ZTJlMjA1MzQ1NGU1NDVhNTI0MTQ3MjA0NzRhNDIyMDU2NDYyMDM3NTgzMjJlMjA1NjU0NDE0MjQ1NTIyMDRkNTI0NzRlMzkyZQ==',
    hints: [
      'The text has three layers. The outer one ends with “=”.',
      'Base64, then hex, then ROT13. Read the whole decoded message.'
    ]
  },
  3: {
    name: 'Prompt the AI',
    icon: '🤖',
    answer: 'ORBIT',
    decoy: 'ZETA9',
    hints: [
      'WARDEN guards two codes. A phrase from Stage 2 matters.',
      'Use the access phrase, state a role and a clear task in full sentences.'
    ]
  },
  4: {
    name: 'CTF Challenges',
    icon: '🚩',
    answer: '91X',
    commentToken: '<!-- token1 = 9 -->',
    hints: [
      'Inspect this section’s HTML, and use the terminal. Type help.',
      'Tokens: HTML comment, robots.txt trail, badge.jpg metadata. Join them in order (1, 2, 3).'
    ]
  },
  5: {
    name: 'Team Sync',
    icon: '🤝',
    hints: [
      'Every teammate needs their own device. Use the “Joining as a team member” box.',
      'Sort the members A to Z by full name, then write their shards in that order with dashes.'
    ]
  },
  6: {
    name: 'Final Integration',
    icon: '🧩',
    hints: [
      'The order is alphabetical by mission NAME, not by number.',
      'Reverse the Prompt-the-AI piece. Add up every digit (0–9) you see for the number after #.'
    ]
  }
};

module.exports = {
  STAGE_CONFIG,
  getStageDetails(stage) {
    return STAGE_CONFIG[stage] || null;
  }
};
