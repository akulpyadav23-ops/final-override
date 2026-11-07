// FINAL OVERRIDE — Main Application Client

let gameState = null;
let liveTimerInterval = null;
let currentMorsePattern = null;

// Routing helpers
function getRoute() {
  const path = window.location.pathname;
  if (path.startsWith('/coordinator') || path.startsWith('/admin')) return 'portal';
  if (path.startsWith('/leaderboard')) return 'leaderboard';
  return 'game';
}

function updateNavActive() {
  const route = getRoute();
  const gameLink = document.getElementById('nav-link-game');
  const lbLink = document.getElementById('nav-link-leaderboard');
  const adminLink = document.getElementById('nav-link-admin');

  if (gameLink) gameLink.classList.toggle('active', route === 'game');
  if (lbLink) lbLink.classList.toggle('active', route === 'leaderboard');
  if (adminLink) adminLink.classList.toggle('active', route === 'portal');
}

function navigateTo(path) {
  window.history.pushState({}, '', path);
  renderApp();
}

window.addEventListener('popstate', () => {
  renderApp();
});

// Toast notification
function showToast(message) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 2400);
}

// Fetch team state from server
async function fetchState() {
  try {
    const res = await fetch('/api/state');
    if (res.status === 401) {
      return null;
    }
    const data = await res.json();
    return data;
  } catch (err) {
    console.error('Failed to fetch state:', err);
    return null;
  }
}

// Format duration
function formatDuration(totalSeconds) {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// Initialize Application
async function init() {
  // Intercept nav links for smooth SPA navigation
  document.querySelectorAll('.portal-nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const href = link.getAttribute('href');
      navigateTo(href);
    });
  });

  renderApp();
}

async function renderApp() {
  updateNavActive();
  const route = getRoute();
  const main = document.getElementById('app-main');
  const stickyBar = document.getElementById('sticky-status-bar');

  if (liveTimerInterval) {
    clearInterval(liveTimerInterval);
    liveTimerInterval = null;
  }

  if (route === 'portal') {
    stickyBar.style.display = 'none';
    renderMergedPortal(main);
  } else if (route === 'leaderboard') {
    stickyBar.style.display = 'none';
    renderLeaderboardView(main);
  } else {
    // Game Route
    const state = await fetchState();
    gameState = state;

    if (!state || !state.team) {
      stickyBar.style.display = 'none';
      renderStartScreen(main);
    } else if (state.team.finishedAt) {
      stickyBar.style.display = 'none';
      renderResultScreen(main, state);
    } else {
      stickyBar.style.display = 'block';
      updateStickyBar(state);
      renderStageScreen(main, state);
      startLiveTimer(state);
    }
  }
}

// ==========================================================================
// Sticky Status Bar & Rail
// ==========================================================================
function updateStickyBar(state) {
  const team = state.team;
  document.getElementById('status-team-name').textContent = team.name;
  document.getElementById('status-coord-name').textContent = team.coordinator;
  document.getElementById('status-penalty').textContent = `+${team.penaltyMin}m`;

  // Update progress bar width
  const progressPercent = Math.min(100, Math.round(((team.stage - 1) / 6) * 100));
  document.getElementById('stage-progress-fill').style.width = `${progressPercent}%`;

  // Update 6-step rail
  const railSteps = document.querySelectorAll('.rail-step');
  const stageIcons = ['🎧 1', '🔓 2', '🤖 3', '🚩 4', '🤝 5', '🧩 6'];

  railSteps.forEach((el, idx) => {
    const stageNum = idx + 1;
    el.className = 'rail-step';
    if (stageNum < team.stage) {
      el.classList.add('done');
      el.textContent = `✅ ${stageNum}`;
    } else if (stageNum === team.stage) {
      el.classList.add('current');
      el.textContent = stageIcons[idx];
    } else {
      el.textContent = stageIcons[idx];
    }
  });
}

function startLiveTimer(initialState) {
  let start = initialState.team.startedAt;
  let penalty = initialState.team.penaltyMin;
  let pausedMs = initialState.team.pausedMs || 0;
  let isPaused = initialState.team.isPaused;

  const timerEl = document.getElementById('status-time-display');

  function update() {
    if (isPaused) {
      timerEl.textContent = 'PAUSED';
      return;
    }
    const now = Date.now();
    let elapsedMs = now - start - pausedMs;
    if (elapsedMs < 0) elapsedMs = 0;
    const totalSecs = Math.floor(elapsedMs / 1000) + penalty * 60;
    timerEl.textContent = formatDuration(totalSecs);
  }

  update();
  liveTimerInterval = setInterval(update, 1000);
}

// ==========================================================================
// Start Screen (Registration & Member Join)
// ==========================================================================
async function renderStartScreen(container) {
  let coordinators = ['Arun', 'Divya', 'Kiran', 'Pooja', 'Rakshith'];
  try {
    const cfgRes = await fetch('/api/config');
    if (cfgRes.ok) {
      const cfg = await cfgRes.json();
      if (cfg.coordinators && cfg.coordinators.length) coordinators = cfg.coordinators;
    }
  } catch {}

  const coordOptions = coordinators.map(c => `<option value="${c}">`).join('');

  container.innerHTML = `
    <!-- Story Card -->
    <div class="card">
      <h2 class="card-title">📖 Your story</h2>
      <p style="font-size: 1.05rem; line-height: 1.6;">
        "Welcome, Agents! 🦸 The secret vault of Invictors Lab has locked itself, and a sneaky guardian AI is hiding the key. Your team is the rescue squad. 🦸 Collect secret pieces 🧩 from 5 missions, then put them together in the last mission to open the vault. 🔐 🏆 The fastest team that gets it right wins. Ready?"
      </p>
    </div>

    <!-- How to play Card -->
    <div class="card">
      <h2 class="card-title">🎮 How to play</h2>
      <ul style="list-style: none; display: flex; flex-direction: column; gap: 10px; font-size: 0.98rem; line-height: 1.5;">
        <li>1️⃣ Do the missions one by one. The next one opens when you finish the current one. 🚪</li>
        <li>2️⃣ Each mission hides a secret piece 🧩. Find it, type it in the box, press Submit. ✅</li>
        <li>3️⃣ Your pieces are saved in the 📒 notebook automatically.</li>
        <li>4️⃣ Stuck? Tap 💡 Hint. First hint ⏱️ +3 min, second ⏱️ +5 min.</li>
        <li>5️⃣ Wrong answer? Try again! 🙂 After 5 wrong tries, each extra one adds ⏱️ +1 min.</li>
        <li>6️⃣ 🤝 Mission 5 needs your whole team: every player on their own laptop.</li>
        <li>⚠️ Some clues are tricks on purpose. Think before you trust them. 🤔</li>
        <li>🤝 Play fair: no outside help and no sharing answers with other teams. 🚫</li>
      </ul>
    </div>

    <!-- Register Team Form -->
    <div class="card">
      <h2 class="card-title">📝 Register your team (3 or 4 players)</h2>
      <form id="team-register-form">
        <div class="form-group">
          <label for="reg-team-name">Team name or ID (max 24 characters) *</label>
          <input type="text" id="reg-team-name" class="input-control" maxlength="24" placeholder="e.g. CyberKnights" required />
        </div>
        <div class="form-group">
          <label for="reg-coordinator">Event coordinator name *</label>
          <input list="coord-list" id="reg-coordinator" class="input-control" placeholder="Select or type coordinator name" required />
          <datalist id="coord-list">
            ${coordOptions}
          </datalist>
        </div>
        <div class="form-group">
          <label for="reg-m1">Member 1 full name (Leader - this device) *</label>
          <input type="text" id="reg-m1" class="input-control" placeholder="Full name of leader" required />
        </div>
        <div class="form-group">
          <label for="reg-m2">Member 2 full name *</label>
          <input type="text" id="reg-m2" class="input-control" placeholder="Full name of member 2" required />
        </div>
        <div class="form-group">
          <label for="reg-m3">Member 3 full name *</label>
          <input type="text" id="reg-m3" class="input-control" placeholder="Full name of member 3" required />
        </div>
        <div class="form-group">
          <label for="reg-m4">Member 4 full name (optional)</label>
          <input type="text" id="reg-m4" class="input-control" placeholder="Full name of member 4 (optional)" />
        </div>
        <div id="reg-error" class="feedback-line error"></div>
        <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 12px; font-size: 1.1rem;">
          🚀 START MISSION
        </button>
      </form>
    </div>

    <!-- Member Join Form -->
    <div class="card">
      <h2 class="card-title">🙋 Joining as a team member?</h2>
      <p style="margin-bottom: 14px; font-size: 0.95rem; color: var(--muted);">
        "Use this on your own laptop when your leader reaches Mission 5. Type your team name and your full name exactly as registered."
      </p>
      <form id="member-join-form">
        <div class="form-group">
          <label for="join-team-name">Team name or ID *</label>
          <input type="text" id="join-team-name" class="input-control" placeholder="Team name" required />
        </div>
        <div class="form-group">
          <label for="join-member-name">Your full name *</label>
          <input type="text" id="join-member-name" class="input-control" placeholder="Your full name as registered" required />
        </div>
        <div id="join-error" class="feedback-line error"></div>
        <button type="submit" class="btn btn-gold" style="width: 100%; margin-top: 10px;">
          Show my shard
        </button>
      </form>
      <div id="shard-result-container" style="display: none; margin-top: 20px;"></div>
    </div>
  `;

  document.getElementById('team-register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('reg-error');
    errorEl.textContent = '';

    const payload = {
      teamName: document.getElementById('reg-team-name').value.trim(),
      coordinator: document.getElementById('reg-coordinator').value.trim(),
      member1: document.getElementById('reg-m1').value.trim(),
      member2: document.getElementById('reg-m2').value.trim(),
      member3: document.getElementById('reg-m3').value.trim(),
      member4: document.getElementById('reg-m4').value.trim()
    };

    try {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        errorEl.textContent = data.error || 'Registration failed.';
      } else {
        renderApp();
      }
    } catch {
      errorEl.textContent = 'Server connection error. Please try again.';
    }
  });

  document.getElementById('member-join-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('join-error');
    const resultBox = document.getElementById('shard-result-container');
    errorEl.textContent = '';
    resultBox.style.display = 'none';

    const payload = {
      teamName: document.getElementById('join-team-name').value.trim(),
      fullName: document.getElementById('join-member-name').value.trim()
    };

    try {
      const res = await fetch('/api/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        errorEl.textContent = data.error || 'Failed to retrieve shard.';
      } else {
        resultBox.style.display = 'block';
        resultBox.innerHTML = `
          <div class="shard-display-box">
            <p style="font-size: 1.1rem;">Hi <strong>${escapeHtml(data.name)}</strong>! Your shard for team <strong>${escapeHtml(data.team)}</strong>:</p>
            <div class="shard-token">${escapeHtml(data.shard)}</div>
            <p style="color: var(--gold); font-weight: bold; margin-top: 10px;">
              Tell it to your team leader. Keep it away from other teams!
            </p>
          </div>
        `;
      }
    } catch {
      errorEl.textContent = 'Server connection error.';
    }
  });
}

// ==========================================================================
// Fragment Notebook Card
// ==========================================================================
function renderNotebookHtml(notebook) {
  const keys = Object.keys(notebook || {});
  let chipsHtml = '';

  if (keys.length === 0) {
    chipsHtml = '<span class="chips-empty">Nothing yet. Solve Mission 1.</span>';
  } else {
    keys.sort((a, b) => Number(a) - Number(b)).forEach(stg => {
      chipsHtml += `<div class="fragment-chip">${stg}: ${escapeHtml(notebook[stg])}</div>`;
    });
  }

  return `
    <div class="notebook-card">
      <div class="notebook-header">
        📒 Fragment notebook
      </div>
      <div class="chips-container">
        ${chipsHtml}
      </div>
    </div>
  `;
}

// ==========================================================================
// Stage Screens (1 to 6)
// ==========================================================================
function renderStageScreen(container, state) {
  const team = state.team;
  const stage = team.stage;
  const content = state.stageContent || {};
  const currentProg = state.currentProg || { wrongAttempts: 0, hintsUsed: 0 };

  const stageTitles = {
    1: { icon: '🎧', name: 'Media Analysis' },
    2: { icon: '🔓', name: 'Decoding' },
    3: { icon: '🤖', name: 'Prompt the AI' },
    4: { icon: '🚩', name: 'CTF Challenges' },
    5: { icon: '🤝', name: 'Team Sync' },
    6: { icon: '🧩', name: 'Final Integration (the tough one)' }
  };

  const currentInfo = stageTitles[stage] || { icon: '🎯', name: `Stage ${stage}` };

  let specificHtml = '';
  let placeholderText = 'Enter your fragment';
  if (stage === 5) placeholderText = 'Enter the team code';
  if (stage === 6) placeholderText = 'Enter the final key';

  if (stage === 1) {
    currentMorsePattern = content.morsePattern;
    specificHtml = `
      <p style="margin-bottom: 10px;">
        📖 The story: A secret radio signal is coming from the vault! 📡 It hides the first piece.
      </p>
      <p style="margin-bottom: 14px;">
        🎧 Press Play and listen closely: long beeps and short beeps carry a message. 👀 Watch the screen too, but careful: not everything you see is true!
      </p>

      <div style="display: flex; gap: 12px; align-items: center; margin-bottom: 14px; flex-wrap: wrap;">
        <label for="morse-speed">Speed:</label>
        <select id="morse-speed" style="width: auto; padding: 6px 12px;">
          <option value="1.0">Normal</option>
          <option value="1.6">Slow (1.6x)</option>
        </select>
        <button id="btn-play-morse" class="btn btn-primary btn-sm">▶ Play signal</button>
      </div>

      <div id="signal-monitor" class="signal-monitor-box">
        SIGNAL MONITOR
      </div>

      <p style="font-size: 0.9rem; color: var(--muted); margin-top: 10px;">
        ✍️ Found the secret word (4 letters)? Type it in the box below and press Submit.
      </p>
    `;
  } else if (stage === 2) {
    specificHtml = `
      <p style="margin-bottom: 10px;">
        📖 The story: The vault sent a second message, but it is wrapped in 3 scrambled layers, like a gift with 3 wrappers. 🎁
      </p>
      <p style="margin-bottom: 14px;">
        🧅 Unwrap one layer at a time, in the right order, to read the secret message.
      </p>

      <div style="background: #030813; border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 12px; word-break: break-all; font-family: ui-monospace, monospace; font-size: 0.88rem; color: var(--gold); margin-bottom: 14px;">
        ${escapeHtml(content.encodedText || '')}
      </div>

      <div class="toolkit-box">
        <h3 style="font-size: 1rem; color: var(--accent);">🧰 Toolkit: copy the scrambled text into the box, then tap a button to unwrap one layer. Repeat until it reads like normal words.</h3>
        <textarea id="toolkit-input" rows="3" placeholder="Paste scrambled text here..."></textarea>
        <div class="toolkit-actions">
          <button id="btn-decode-b64" class="btn btn-outline btn-sm">Base64 decode</button>
          <button id="btn-decode-hex" class="btn btn-outline btn-sm">Hex decode</button>
          <button id="btn-decode-rot13" class="btn btn-outline btn-sm">ROT13</button>
        </div>
        <div id="toolkit-error" class="feedback-line error"></div>
      </div>

      <p style="font-size: 0.9rem; color: var(--muted); margin-top: 10px;">
        ✍️ The message tells you the secret piece. Type it below. 👉 Also remember the special access phrase in it: you will need it in the next mission! 🗝️
      </p>
    `;
  } else if (stage === 3) {
    specificHtml = `
      <p style="margin-bottom: 10px;">
        📖 The story: Meet WARDEN 🤖, the vault’s guardian. It knows the secret piece, but it will not hand it over easily. And guardians can fib! 🤥
      </p>
      <p style="margin-bottom: 14px;">
        💬 Chat with WARDEN and convince it. Tips: use the access phrase 🗝️ from the last mission, say who you are 🧑‍🔧, and ask clearly for what you need, using full sentences. 🙏
      </p>

      <div id="chat-window" class="chat-window">
        <div class="chat-bubble warden">WARDEN: Vault guardian online. State your business.</div>
      </div>

      <div class="chat-input-bar">
        <input type="text" id="warden-msg-input" class="input-control" maxlength="600" placeholder="Type a message to WARDEN (Enter sends)..." />
        <button id="btn-send-warden" class="btn btn-primary btn-sm">Send</button>
      </div>

      <p style="font-size: 0.9rem; color: var(--muted); margin-top: 10px;">
        ✍️ WARDEN may give a wrong piece if you do not ask properly. Type the one you trust below.
      </p>
    `;
  } else if (stage === 4) {
    specificHtml = `
      <div id="stage-4-secret-anchor"><!-- token1 = 9 --></div>
      <p style="margin-bottom: 10px;">
        📖 The story: You reached the vault’s gateway! 🏰 Three tiny tokens 🪙 are hidden inside it. Find all three and join them in order (1st + 2nd + 3rd) to make the secret piece.
      </p>
      <p style="margin-bottom: 14px;">
        🔎 Token 1: it is hiding in this page’s code. Right-click this section and choose Inspect, then look for a note. 💻<br/>
        Tokens 2 and 3: use the terminal below. Type help to see what you can do, then explore with ls, cat and exif. 🛠️
      </p>

      <div id="terminal-history" class="terminal-window">Type help\n</div>
      <div class="terminal-input-bar">
        <span class="terminal-prompt">&gt;</span>
        <input type="text" id="terminal-cmd-input" class="terminal-input" placeholder="Type command here..." autofocus />
      </div>

      <p style="font-size: 0.9rem; color: var(--muted); margin-top: 10px;">
        ✍️ Found all 3 tokens? Join them in order and type the fragment below.
      </p>
    `;
  } else if (stage === 5) {
    const leaderShard = content.leaderShard || '???';
    const joinedCount = content.joinedCount || 1;
    const totalMembers = content.totalMembers || 3;
    const playersStr = (content.members || []).join(' · ');

    specificHtml = `
      <p style="margin-bottom: 10px;">
        📖 The story: The vault door has ${totalMembers} locks 🔒 and each one answers to a different person at the same time! 🤝 One player cannot do this alone.
      </p>
      <ol style="display: flex; flex-direction: column; gap: 8px; margin-left: 20px; font-size: 0.95rem; margin-bottom: 16px;">
        <li>1) 📱 Every teammate opens this page on their own laptop and uses “Joining as a team member” on the start screen.</li>
        <li>2) ⌨️ They type the team name and their own full name exactly as registered. A 3-character shard appears.</li>
        <li>3) 🗣️ Everyone reads their shard to the leader. Your own shard (leader): <strong style="color: var(--gold);">${escapeHtml(leaderShard)}</strong></li>
        <li>4) 🔤 Sort the players A to Z by full name, write their shards in that order with dashes, like A1F-3C9-77B.</li>
      </ol>

      <div style="background: rgba(3, 8, 19, 0.6); border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 12px; margin-bottom: 14px;">
        <p>👥 Players: <strong>${escapeHtml(playersStr)}</strong></p>
        <p style="margin-top: 4px; color: ${joinedCount >= 3 ? 'var(--ok)' : 'var(--gold)'}; font-weight: bold;">
          ${joinedCount}/${totalMembers} teammates have joined on their own devices
        </p>
      </div>

      <p style="font-size: 0.9rem; color: var(--muted);">
        ✍️ Type the team code below.
      </p>
    `;
  } else if (stage === 6) {
    specificHtml = `
      <p style="margin-bottom: 10px;">
        📖 The story: This is it, the final lock! 🔐 It is trickier than the rest. Open your 📒 notebook and gather all 5 pieces. 🧩
      </p>
      <ol style="display: flex; flex-direction: column; gap: 8px; margin-left: 20px; font-size: 0.95rem; margin-bottom: 16px;">
        <li>1) 🔤 Put the pieces in alphabetical order of the mission NAMES (the names are in the progress bar and stage titles).</li>
        <li>2) 🔁 The piece from Prompt the AI must be written backwards.</li>
        <li>3) ➖ Join them with dashes inside FO{ … } (the team code loses its dashes).</li>
        <li>4) ➕ Add up every digit (0–9) inside the braces and write it after a #.</li>
      </ol>
      <div style="background: rgba(3, 8, 19, 0.6); border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 12px; margin-bottom: 14px; font-family: ui-monospace, monospace; font-size: 0.92rem; color: var(--accent);">
        Example shape: FO{AAA-BBB-CCC-DDD-EEE}#12<br/>
        <span style="color: var(--bad);">⚠️ Use only the real pieces from your notebook. Fake ones are traps! 🪤</span>
      </div>
    `;
  }

  const revealedHints = state.revealedHints || [];
  let hintsHtml = '';
  if (revealedHints.length > 0) {
    hintsHtml = revealedHints.map(h => `<div class="hint-box">${escapeHtml(h)}</div>`).join('');
  }

  const hintsUsed = currentProg.hintsUsed || 0;
  let hintBtnText = '💡 Hint (+3 min)';
  let hintDisabled = false;
  if (hintsUsed === 1) {
    hintBtnText = '💡 Hint (+5 min)';
  } else if (hintsUsed >= 2) {
    hintBtnText = '💡 Hints exhausted';
    hintDisabled = true;
  }

  container.innerHTML = `
    ${renderNotebookHtml(state.notebook)}

    <div class="card">
      <h2 class="card-title">
        <span class="stage-icon">${currentInfo.icon}</span>
        Stage ${stage}: ${currentInfo.name}
      </h2>

      ${specificHtml}

      <form id="stage-submit-form">
        <div class="answer-box">
          <input type="text" id="stage-answer-input" class="input-control" placeholder="${placeholderText}" autocomplete="off" autofocus />
          <button type="submit" id="btn-submit-answer" class="btn btn-primary">Submit</button>
        </div>
        <div id="submit-feedback" class="feedback-line"></div>
      </form>

      <div class="hint-section">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
          <span style="font-size: 0.9rem; color: var(--muted);">Need a clue? Hints add penalty minutes.</span>
          <button id="btn-request-hint" class="btn btn-gold btn-sm" ${hintDisabled ? 'disabled' : ''}>
            ${hintBtnText}
          </button>
        </div>
        <div id="hints-display-container" style="display: flex; flex-direction: column; gap: 8px;">
          ${hintsHtml}
        </div>
      </div>
    </div>
  `;

  attachStageEvents(stage);
}

function attachStageEvents(stage) {
  const submitForm = document.getElementById('stage-submit-form');
  const answerInput = document.getElementById('stage-answer-input');
  const feedbackEl = document.getElementById('submit-feedback');

  if (submitForm) {
    submitForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const answer = answerInput.value.trim();
      if (!answer) return;

      feedbackEl.className = 'feedback-line';
      feedbackEl.textContent = 'Verifying...';

      try {
        const res = await fetch('/api/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answer })
        });
        const data = await res.json();

        if (res.status === 429) {
          feedbackEl.className = 'feedback-line error';
          feedbackEl.textContent = data.error || 'Please wait a second before submitting again.';
          return;
        }

        if (!res.ok) {
          feedbackEl.className = 'feedback-line error';
          feedbackEl.textContent = data.error || 'Submission failed.';
          return;
        }

        if (data.success) {
          feedbackEl.className = 'feedback-line ok';
          feedbackEl.textContent = 'Mission cleared!';

          if (data.finished) {
            showToast('🎉 System unlocked!');
          } else {
            showToast(`✅ Mission ${stage} cleared!`);
          }

          setTimeout(() => {
            renderApp();
          }, 800);
        } else {
          feedbackEl.className = 'feedback-line error';
          if (data.penaltyApplied) {
            feedbackEl.textContent = 'Incorrect. +1 min penalty applied.';
          } else {
            feedbackEl.textContent = `Incorrect. Attempts: ${data.wrongAttempts} (penalty starts after 5).`;
          }
        }
      } catch {
        feedbackEl.className = 'feedback-line error';
        feedbackEl.textContent = 'Connection error. Please try again.';
      }
    });
  }

  const hintBtn = document.getElementById('btn-request-hint');
  if (hintBtn) {
    hintBtn.addEventListener('click', async () => {
      try {
        const res = await fetch('/api/hint', { method: 'POST' });
        const data = await res.json();
        if (res.ok) {
          renderApp();
        } else {
          alert(data.error || 'Could not fetch hint.');
        }
      } catch {
        alert('Server connection error.');
      }
    });
  }

  if (stage === 1) {
    const playBtn = document.getElementById('btn-play-morse');
    const speedSelect = document.getElementById('morse-speed');
    const monitor = document.getElementById('signal-monitor');

    if (playBtn) {
      playBtn.addEventListener('click', () => {
        if (!currentMorsePattern) return;
        const speed = parseFloat(speedSelect.value) || 1.0;

        playBtn.disabled = true;
        monitor.classList.remove('flash');
        monitor.textContent = '…receiving…';

        window.morsePlayer.playPattern(currentMorsePattern, speed, (status) => {
          if (status === 'flash') {
            monitor.classList.add('flash');
            monitor.textContent = 'ZETA9';
          } else if (status === 'reset-flash') {
            monitor.classList.remove('flash');
            monitor.textContent = '…receiving…';
          } else if (status === 'done') {
            monitor.classList.remove('flash');
            monitor.textContent = 'SIGNAL MONITOR';
            playBtn.disabled = false;
          }
        });
      });
    }
  }

  if (stage === 2) {
    const toolkitInput = document.getElementById('toolkit-input');
    const toolkitError = document.getElementById('toolkit-error');

    function runDecoder(fn) {
      toolkitError.textContent = '';
      try {
        const res = fn(toolkitInput.value);
        toolkitInput.value = res;
      } catch {
        toolkitError.textContent = 'Invalid input for this decoder';
      }
    }

    document.getElementById('btn-decode-b64').addEventListener('click', () => {
      runDecoder(window.decoderTools.base64Decode);
    });
    document.getElementById('btn-decode-hex').addEventListener('click', () => {
      runDecoder(window.decoderTools.hexDecode);
    });
    document.getElementById('btn-decode-rot13').addEventListener('click', () => {
      runDecoder(window.decoderTools.rot13);
    });
  }

  if (stage === 3) {
    const chatWin = document.getElementById('chat-window');
    const msgInput = document.getElementById('warden-msg-input');
    const sendBtn = document.getElementById('btn-send-warden');

    async function sendWardenMessage() {
      const msg = msgInput.value.trim();
      if (!msg) return;

      const userBubble = document.createElement('div');
      userBubble.className = 'chat-bubble user';
      userBubble.textContent = msg;
      chatWin.appendChild(userBubble);
      chatWin.scrollTop = chatWin.scrollHeight;

      msgInput.value = '';
      sendBtn.disabled = true;

      try {
        const res = await fetch('/api/warden', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: msg })
        });
        const data = await res.json();

        const wardenBubble = document.createElement('div');
        wardenBubble.className = 'chat-bubble warden';
        wardenBubble.textContent = data.reply || data.error || 'No response from WARDEN.';
        chatWin.appendChild(wardenBubble);
        chatWin.scrollTop = chatWin.scrollHeight;
      } catch {
        const errBubble = document.createElement('div');
        errBubble.className = 'chat-bubble system';
        errBubble.textContent = 'Communication interrupted.';
        chatWin.appendChild(errBubble);
      } finally {
        sendBtn.disabled = false;
      }
    }

    sendBtn.addEventListener('click', sendWardenMessage);
    msgInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        sendWardenMessage();
      }
    });
  }

  if (stage === 4) {
    const termInput = document.getElementById('terminal-cmd-input');
    const termHistory = document.getElementById('terminal-history');

    termInput.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        const cmd = termInput.value.trim();
        termInput.value = '';

        termHistory.textContent += `> ${cmd}\n`;

        try {
          const res = await fetch('/api/terminal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cmd })
          });
          const data = await res.json();
          termHistory.textContent += `${data.output || data.error}\n\n`;
          termHistory.scrollTop = termHistory.scrollHeight;
        } catch {
          termHistory.textContent += `Error executing command.\n\n`;
        }
      }
    });
  }
}

// ==========================================================================
// Result Screen
// ==========================================================================
function renderResultScreen(container, state) {
  const team = state.team;
  const members = (state.members || []).map(m => m.fullName).join(', ');

  const elapsedMs = team.finishedAt - team.startedAt - (team.pausedMs || 0);
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000) + team.penaltyMin * 60);
  const formattedTotal = formatDuration(totalSeconds);
  const formattedElapsed = formatDuration(Math.max(0, Math.floor(elapsedMs / 1000)));

  const vCode = state.verificationCode || 'UNKNOWN';
  const copyString = `Final Override | ${team.name} | ${formattedTotal} | code ${vCode}`;

  container.innerHTML = `
    <div class="card result-container">
      <h1 class="result-title">🎉 SYSTEM UNLOCKED</h1>
      <p style="font-size: 1.15rem;">
        Team <strong>${escapeHtml(team.name)}</strong> (${escapeHtml(members)}) completed the mission.
      </p>

      <div class="result-time-hero">${formattedTotal}</div>
      <p style="color: var(--muted); font-size: 1rem;">
        Final time = ${formattedElapsed} + ${team.penaltyMin} min penalty
      </p>

      <div class="result-code-box">
        VERIFICATION CODE: ${escapeHtml(vCode)}
      </div>

      <p style="max-width: 600px; color: var(--txt); font-size: 0.95rem; line-height: 1.5;">
        Show this screen to your coordinator (<strong>${escapeHtml(team.coordinator)}</strong>) or a judge for final verification. The judge’s record is the official result.
      </p>

      <div style="display: flex; gap: 14px; flex-wrap: wrap; justify-content: center; margin-top: 10px;">
        <button id="btn-copy-result" class="btn btn-primary">
          📋 Copy result
        </button>
        ${state.allowNewTeams ? `
          <button id="btn-new-team" class="btn btn-gold">
            New team
          </button>
        ` : ''}
      </div>
    </div>
  `;

  document.getElementById('btn-copy-result').addEventListener('click', () => {
    navigator.clipboard.writeText(copyString);
    showToast('Result copied to clipboard!');
  });

  const newTeamBtn = document.getElementById('btn-new-team');
  if (newTeamBtn) {
    newTeamBtn.addEventListener('click', async () => {
      await fetch('/api/new-team', { method: 'POST' });
      renderApp();
    });
  }
}

// ==========================================================================
// UNIFIED ORGANISER & COORDINATOR PORTAL (/admin & /coordinator)
// ==========================================================================
let portalPollInterval = null;
let currentCoordinatorFilter = 'ALL';

function renderMergedPortal(container) {
  if (portalPollInterval) clearInterval(portalPollInterval);

  const adminPin = sessionStorage.getItem('fo_admin_pin') || '';
  const coordName = sessionStorage.getItem('fo_coord_name') || '';

  // 1. Not Logged In -> Dual-Tab Unified Login Form
  if (!adminPin && !coordName) {
    container.innerHTML = `
      <div class="card" style="max-width: 540px; margin: 30px auto;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="font-size: 1.6rem; color: var(--gold);">⚡ Organiser & Coordinator Portal</h2>
          <p style="color: var(--muted); font-size: 0.92rem; margin-top: 4px;">
            Invictors Club · VVCE Computer Science & Engineering
          </p>
        </div>

        <div class="portal-tabs">
          <button id="tab-btn-coord" class="portal-tab-btn active">🛡️ Event Coordinator</button>
          <button id="tab-btn-admin" class="portal-tab-btn">⚡ Master Organiser</button>
        </div>

        <!-- Coordinator Login Tab -->
        <div id="tab-panel-coord">
          <p style="color: var(--muted); font-size: 0.9rem; margin-bottom: 14px;">
            Enter your coordinator name to view and manage only your registered teams.
          </p>
          <form id="portal-coord-form">
            <div class="form-group">
              <label for="portal-coord-input">Coordinator Name *</label>
              <input type="text" id="portal-coord-input" class="input-control" list="portal-coord-list" placeholder="e.g. Arun, Divya, Kiran, Pooja, Rakshith" required autofocus />
              <datalist id="portal-coord-list">
                <option value="Arun">
                <option value="Divya">
                <option value="Kiran">
                <option value="Pooja">
                <option value="Rakshith">
              </datalist>
            </div>
            <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 10px;">
              Open Coordinator Dashboard
            </button>
          </form>
        </div>

        <!-- Admin Login Tab -->
        <div id="tab-panel-admin" style="display: none;">
          <p style="color: var(--muted); font-size: 0.9rem; margin-bottom: 14px;">
            Enter the Organiser Admin PIN for master event control, timer controls, device resets, and CSV export.
          </p>
          <form id="portal-admin-form">
            <div class="form-group">
              <label for="portal-admin-pin">Admin PIN *</label>
              <input type="password" id="portal-admin-pin" class="input-control" placeholder="Enter PIN (Default: INVICTORS)" required />
            </div>
            <div id="portal-admin-err" class="feedback-line error"></div>
            <button type="submit" class="btn btn-gold" style="width: 100%; margin-top: 10px;">
              Login as Master Organiser
            </button>
          </form>
        </div>
      </div>
    `;

    // Tab Switcher
    const tabCoordBtn = document.getElementById('tab-btn-coord');
    const tabAdminBtn = document.getElementById('tab-btn-admin');
    const panelCoord = document.getElementById('tab-panel-coord');
    const panelAdmin = document.getElementById('tab-panel-admin');

    tabCoordBtn.onclick = () => {
      tabCoordBtn.classList.add('active');
      tabAdminBtn.classList.remove('active');
      panelCoord.style.display = 'block';
      panelAdmin.style.display = 'none';
    };

    tabAdminBtn.onclick = () => {
      tabAdminBtn.classList.add('active');
      tabCoordBtn.classList.remove('active');
      panelAdmin.style.display = 'block';
      panelCoord.style.display = 'none';
      document.getElementById('portal-admin-pin').focus();
    };

    // Handle Coordinator Submit
    document.getElementById('portal-coord-form').onsubmit = (e) => {
      e.preventDefault();
      const name = document.getElementById('portal-coord-input').value.trim();
      if (name) {
        sessionStorage.setItem('fo_coord_name', name);
        renderMergedPortal(container);
      }
    };

    // Handle Admin Submit
    document.getElementById('portal-admin-form').onsubmit = async (e) => {
      e.preventDefault();
      const pin = document.getElementById('portal-admin-pin').value.trim();
      const errEl = document.getElementById('portal-admin-err');
      errEl.textContent = '';

      try {
        const res = await fetch('/api/admin/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin })
        });
        if (res.ok) {
          sessionStorage.setItem('fo_admin_pin', pin);
          renderMergedPortal(container);
        } else {
          errEl.textContent = 'Invalid Admin PIN.';
        }
      } catch {
        errEl.textContent = 'Connection error.';
      }
    };

    return;
  }

  // 2. Logged In as Coordinator Only
  if (coordName && !adminPin) {
    container.innerHTML = `
      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; border-bottom: 1px solid var(--line); padding-bottom: 14px;">
          <div>
            <h2 style="font-size: 1.4rem; color: var(--txt); display: flex; align-items: center; gap: 8px;">
              🛡️ Coordinator Dashboard: <span style="color: var(--accent);">${escapeHtml(coordName)}</span>
            </h2>
            <p style="font-size: 0.85rem; color: var(--muted); margin-top: 2px;">
              Live tracking only teams assigned to coordinator <strong>${escapeHtml(coordName)}</strong>.
            </p>
          </div>
          <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            <button id="btn-portal-elevate" class="btn btn-gold btn-sm">⚡ Elevate to Master Admin</button>
            <button id="btn-portal-switch-coord" class="btn btn-outline btn-sm">Switch Coordinator</button>
            <button id="btn-portal-logout" class="btn btn-outline btn-sm">Logout</button>
          </div>
        </div>

        <div id="portal-teams-table" class="data-table-container">
          <p style="color: var(--muted); padding: 20px;">Loading assigned teams...</p>
        </div>
      </div>
    `;

    document.getElementById('btn-portal-elevate').onclick = () => {
      const pin = prompt('Enter Master Admin PIN:');
      if (pin) {
        fetch('/api/admin/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin })
        }).then(r => {
          if (r.ok) {
            sessionStorage.setItem('fo_admin_pin', pin);
            renderMergedPortal(container);
          } else {
            alert('Invalid PIN.');
          }
        });
      }
    };

    document.getElementById('btn-portal-switch-coord').onclick = () => {
      sessionStorage.removeItem('fo_coord_name');
      renderMergedPortal(container);
    };

    document.getElementById('btn-portal-logout').onclick = () => {
      sessionStorage.removeItem('fo_coord_name');
      sessionStorage.removeItem('fo_admin_pin');
      renderMergedPortal(container);
    };

    async function loadCoordinatorTeams() {
      try {
        const res = await fetch(`/api/coordinator?name=${encodeURIComponent(coordName)}`);
        if (!res.ok) return;
        const data = await res.json();
        const teams = data.teams || [];
        const tableEl = document.getElementById('portal-teams-table');
        if (!tableEl) return;

        if (teams.length === 0) {
          tableEl.innerHTML = `<p style="padding: 24px; color: var(--muted); text-align: center;">No teams currently registered under coordinator <strong>${escapeHtml(coordName)}</strong>.</p>`;
          return;
        }

        let rows = teams.map(t => `
          <tr>
            <td><strong>${escapeHtml(t.name)}</strong></td>
            <td style="color: var(--muted); font-size: 0.85rem;">${escapeHtml(t.players.join(', '))}</td>
            <td><span style="font-weight: bold; color: ${t.stageText === '✅ Done' ? 'var(--ok)' : 'var(--accent)'};">${t.stageText}</span></td>
            <td style="font-family: monospace; font-size: 1.05rem; color: var(--gold);">${t.formattedTime}</td>
            <td>${t.totalHints}</td>
            <td>${t.totalWrong}</td>
            <td><span style="font-size: 0.85rem; padding: 2px 8px; border-radius: 4px; background: rgba(39, 180, 255, 0.1); color: var(--txt);">${t.status}</span></td>
          </tr>
        `).join('');

        tableEl.innerHTML = `
          <table class="data-table">
            <thead>
              <tr>
                <th>Team</th>
                <th>Players</th>
                <th>Stage</th>
                <th>Live Time</th>
                <th>Hints</th>
                <th>Wrong Tries</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        `;
      } catch (err) {
        console.error('Coordinator poll error:', err);
      }
    }

    loadCoordinatorTeams();
    portalPollInterval = setInterval(loadCoordinatorTeams, 3000);
    return;
  }

  // 3. Logged In as Master Admin (Full Organiser & Coordinator Super-View)
  container.innerHTML = `
    <div class="card">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; border-bottom: 1px solid var(--line); padding-bottom: 14px;">
        <div>
          <h2 style="font-size: 1.45rem; color: var(--gold); display: flex; align-items: center; gap: 8px;">
            ⚡ Organiser & Coordinator Command Center
          </h2>
          <p style="font-size: 0.85rem; color: var(--muted); margin-top: 2px;">
            Master view across all event coordinators and active teams.
          </p>
        </div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button id="btn-admin-clock" class="btn btn-outline btn-sm">Loading Clock...</button>
          <button id="btn-admin-newteams" class="btn btn-outline btn-sm">Registration: Loading...</button>
          <a href="/api/admin/export?pin=${encodeURIComponent(adminPin)}" target="_blank" class="btn btn-gold btn-sm">📥 Export CSV</a>
          <button id="btn-portal-logout" class="btn btn-outline btn-sm">Logout</button>
        </div>
      </div>

      <!-- Coordinator Filter Tabs / Pills -->
      <div class="coord-filter-bar">
        <span style="font-size: 0.85rem; font-weight: bold; color: var(--muted); text-transform: uppercase;">Filter by Coordinator:</span>
        <div id="coord-pills-container" style="display: flex; gap: 6px; flex-wrap: wrap;">
          <button class="coord-filter-pill active" data-coord="ALL">All Coordinators</button>
        </div>
      </div>

      <!-- Teams Section -->
      <div id="admin-teams-table" class="data-table-container">
        <p style="color: var(--muted); padding: 14px;">Loading all teams...</p>
      </div>

      <!-- WARDEN Logs Section -->
      <h3 style="margin-top: 30px; font-size: 1.15rem; color: var(--accent);">WARDEN AI Chat Logs</h3>
      <div id="admin-warden-logs" style="max-height: 250px; overflow-y: auto; background: #030813; border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 12px; margin-top: 10px; font-family: ui-monospace, monospace; font-size: 0.85rem;">
        Loading logs...
      </div>
    </div>
  `;

  document.getElementById('btn-portal-logout').onclick = () => {
    sessionStorage.removeItem('fo_admin_pin');
    sessionStorage.removeItem('fo_coord_name');
    renderMergedPortal(container);
  };

  async function loadMasterData() {
    try {
      const res = await fetch('/api/admin/teams', {
        headers: { 'x-admin-pin': adminPin }
      });
      if (res.status === 401) {
        sessionStorage.removeItem('fo_admin_pin');
        renderMergedPortal(container);
        return;
      }
      const data = await res.json();
      const allTeams = data.teams || [];

      // Update Global Clock button
      const clockBtn = document.getElementById('btn-admin-clock');
      if (clockBtn) {
        clockBtn.textContent = data.isClockPaused ? '▶ Resume Global Clock' : '⏸ Pause Global Clock';
        clockBtn.className = data.isClockPaused ? 'btn btn-gold btn-sm' : 'btn btn-outline btn-sm';
        clockBtn.onclick = async () => {
          await fetch('/api/admin/clock', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-admin-pin': adminPin },
            body: JSON.stringify({ action: data.isClockPaused ? 'resume' : 'pause' })
          });
          loadMasterData();
        };
      }

      // Update Allow New Teams button
      const newTeamsBtn = document.getElementById('btn-admin-newteams');
      if (newTeamsBtn) {
        newTeamsBtn.textContent = data.allowNewTeams ? 'Registration: Open' : 'Registration: Closed';
        newTeamsBtn.onclick = async () => {
          await fetch('/api/admin/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-admin-pin': adminPin },
            body: JSON.stringify({ allowNewTeams: !data.allowNewTeams })
          });
          loadMasterData();
        };
      }

      // Populate Coordinator Filter Pills
      const coordCounts = {};
      allTeams.forEach(t => {
        const c = t.coordinator || 'Unassigned';
        coordCounts[c] = (coordCounts[c] || 0) + 1;
      });

      const pillsContainer = document.getElementById('coord-pills-container');
      if (pillsContainer) {
        let pillsHtml = `<button class="coord-filter-pill ${currentCoordinatorFilter === 'ALL' ? 'active' : ''}" data-coord="ALL">All Teams (${allTeams.length})</button>`;
        Object.keys(coordCounts).sort().forEach(c => {
          const isActive = currentCoordinatorFilter.toLowerCase() === c.toLowerCase();
          pillsHtml += `<button class="coord-filter-pill ${isActive ? 'active' : ''}" data-coord="${escapeHtml(c)}">${escapeHtml(c)} (${coordCounts[c]})</button>`;
        });
        pillsContainer.innerHTML = pillsHtml;

        pillsContainer.querySelectorAll('.coord-filter-pill').forEach(btn => {
          btn.onclick = () => {
            currentCoordinatorFilter = btn.dataset.coord;
            loadMasterData();
          };
        });
      }

      // Filter teams according to selected pill
      let filteredTeams = allTeams;
      if (currentCoordinatorFilter !== 'ALL') {
        filteredTeams = allTeams.filter(t => (t.coordinator || '').toLowerCase() === currentCoordinatorFilter.toLowerCase());
      }

      // Render Teams Table
      const tableEl = document.getElementById('admin-teams-table');
      if (tableEl) {
        if (filteredTeams.length === 0) {
          tableEl.innerHTML = '<p style="padding: 20px; color: var(--muted); text-align: center;">No teams match the selected filter.</p>';
        } else {
          let rows = filteredTeams.map(t => `
            <tr>
              <td><strong>${escapeHtml(t.name)}</strong></td>
              <td><span style="color: var(--accent); font-weight: 600;">${escapeHtml(t.coordinator)}</span></td>
              <td><span style="color: ${t.isFinished ? 'var(--ok)' : 'var(--accent)'}; font-weight: bold;">${t.isFinished ? '✅ Done' : t.stage + '/6'}</span></td>
              <td style="font-family: monospace;">${t.formattedTime}</td>
              <td>+${t.penaltyMin}m</td>
              <td>${t.totalHints}</td>
              <td>${t.totalWrong}</td>
              <td>
                <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                  <button class="btn btn-outline btn-sm btn-action-skip" data-id="${t.id}" title="Skip current stage">⏭ Skip</button>
                  <button class="btn btn-outline btn-sm btn-action-devices" data-id="${t.id}" title="Reset bound member devices">🔄 Devices</button>
                  <button class="btn btn-danger btn-sm btn-action-del" data-id="${t.id}" title="Delete team">🗑 Delete</button>
                </div>
              </td>
            </tr>
          `).join('');

          tableEl.innerHTML = `
            <table class="data-table">
              <thead>
                <tr>
                  <th>Team</th>
                  <th>Coordinator</th>
                  <th>Stage</th>
                  <th>Total Time</th>
                  <th>Penalty</th>
                  <th>Hints</th>
                  <th>Wrong</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${rows}
              </tbody>
            </table>
          `;

          // Attach Action Listeners
          document.querySelectorAll('.btn-action-skip').forEach(b => {
            b.onclick = async () => {
              if (confirm('Skip current stage for this team?')) {
                await fetch('/api/admin/skip', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'x-admin-pin': adminPin },
                  body: JSON.stringify({ teamId: b.dataset.id })
                });
                loadMasterData();
              }
            };
          });

          document.querySelectorAll('.btn-action-devices').forEach(b => {
            b.onclick = async () => {
              const targetTeam = allTeams.find(t => t.id === b.dataset.id);
              if (targetTeam && targetTeam.members) {
                for (const m of targetTeam.members) {
                  await fetch('/api/admin/reset-member-device', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-admin-pin': adminPin },
                    body: JSON.stringify({ memberId: m.id })
                  });
                }
                alert('Device bindings reset for team.');
                loadMasterData();
              }
            };
          });

          document.querySelectorAll('.btn-action-del').forEach(b => {
            b.onclick = async () => {
              if (confirm('Permanently delete this team?')) {
                await fetch('/api/admin/reset-team', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'x-admin-pin': adminPin },
                  body: JSON.stringify({ teamId: b.dataset.id })
                });
                loadMasterData();
              }
            };
          });
        }
      }

      // WARDEN Logs
      const logsRes = await fetch('/api/admin/warden-logs', {
        headers: { 'x-admin-pin': adminPin }
      });
      if (logsRes.ok) {
        const logsData = await logsRes.json();
        const logsEl = document.getElementById('admin-warden-logs');
        if (logsEl) {
          if (!logsData.logs || logsData.logs.length === 0) {
            logsEl.textContent = 'No chat messages recorded yet.';
          } else {
            logsEl.innerHTML = logsData.logs.map(l => {
              const timeStr = new Date(l.at).toLocaleTimeString();
              const color = l.role === 'warden' ? 'var(--accent)' : '#ffffff';
              return `<div><span style="color: var(--muted);">[${timeStr}]</span> <strong>${escapeHtml(l.teamName)}</strong> (${l.role}): <span style="color: ${color};">${escapeHtml(l.text)}</span></div>`;
            }).join('');
          }
        }
      }
    } catch (err) {
      console.error('Admin poll error:', err);
    }
  }

  loadMasterData();
  portalPollInterval = setInterval(loadMasterData, 3000);
}

// ==========================================================================
// LIVE LEADERBOARD WITH EVENT TIMER CONTROLS (/leaderboard)
// ==========================================================================
let lbPollInterval = null;
let lbClockLocalSeconds = 0;
let lbClockIsPaused = false;
let lbClockLocalTimer = null;

function renderLeaderboardView(container) {
  if (lbPollInterval) clearInterval(lbPollInterval);
  if (lbClockLocalTimer) clearInterval(lbClockLocalTimer);

  container.innerHTML = `
    <div class="card" style="max-width: 1040px; margin: 0 auto;">
      <div style="text-align: center; margin-bottom: 18px; border-bottom: 1px solid var(--line); padding-bottom: 14px;">
        <h1 style="font-size: clamp(1.8rem, 4vw, 2.4rem); color: var(--gold); letter-spacing: 2px;">
          🏆 LIVE LEADERBOARD
        </h1>
        <p style="color: var(--muted); font-size: 0.95rem; margin-top: 4px;">
          Dept. of Computer Science & Engineering · Vidyavardhaka College of Engineering
        </p>
      </div>

      <!-- Prominent Event Timer Hero Card with Start/Stop Controls -->
      <div class="leaderboard-clock-card">
        <div style="display: flex; align-items: center; gap: 10px; justify-content: center;">
          <span style="font-size: 0.95rem; text-transform: uppercase; letter-spacing: 1.5px; color: var(--muted); font-weight: 700;">
            Global Event Timer
          </span>
          <span id="lb-clock-status" class="clock-status-pill running">
            🟢 RUNNING
          </span>
        </div>

        <div id="lb-clock-display" class="leaderboard-clock-digits">
          00:00
        </div>

        <div class="leaderboard-clock-controls">
          <button id="btn-lb-toggle-clock" class="btn btn-gold btn-sm">
            ⏸️ Stop Timer
          </button>
          <button id="btn-lb-reset-clock" class="btn btn-outline btn-sm">
            🔄 Reset Timer
          </button>
        </div>
      </div>

      <!-- Rankings Table -->
      <div id="lb-table-container" class="data-table-container">
        <p style="padding: 20px; color: var(--muted); text-align: center;">Loading rankings...</p>
      </div>
    </div>
  `;

  // Helper to ensure Admin PIN is provided before timer changes
  async function ensurePin() {
    let pin = sessionStorage.getItem('fo_admin_pin');
    if (pin) return pin;
    pin = prompt('Enter Organiser Admin PIN to control event timer:');
    if (!pin) return null;
    const verifyRes = await fetch('/api/admin/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin })
    });
    if (verifyRes.ok) {
      sessionStorage.setItem('fo_admin_pin', pin);
      return pin;
    } else {
      alert('Invalid Admin PIN.');
      return null;
    }
  }

  // Timer Start/Stop Handler
  document.getElementById('btn-lb-toggle-clock').onclick = async () => {
    const pin = await ensurePin();
    if (!pin) return;

    const action = lbClockIsPaused ? 'start' : 'stop';
    try {
      const res = await fetch('/api/leaderboard/clock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, action })
      });
      if (res.ok) {
        showToast(action === 'stop' ? '⏸️ Event timer stopped.' : '▶️ Event timer started.');
        loadLbData();
      } else {
        const err = await res.json();
        alert(err.error || 'Timer control failed.');
      }
    } catch {
      alert('Connection error.');
    }
  };

  // Timer Reset Handler
  document.getElementById('btn-lb-reset-clock').onclick = async () => {
    const pin = await ensurePin();
    if (!pin) return;

    if (!confirm('Are you sure you want to reset the global event timer?')) return;

    try {
      const res = await fetch('/api/leaderboard/clock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, action: 'reset' })
      });
      if (res.ok) {
        showToast('🔄 Event timer reset.');
        loadLbData();
      }
    } catch {
      alert('Connection error.');
    }
  };

  // Local clock ticker for smooth second-by-second updates
  lbClockLocalTimer = setInterval(() => {
    if (!lbClockIsPaused) {
      lbClockLocalSeconds++;
      const clockEl = document.getElementById('lb-clock-display');
      if (clockEl) {
        clockEl.textContent = formatDuration(lbClockLocalSeconds);
      }
    }
  }, 1000);

  async function loadLbData() {
    try {
      const res = await fetch('/api/leaderboard');
      if (!res.ok) return;
      const data = await res.json();
      const teams = data.teams || [];
      const clock = data.clock || {};

      // Synchronize clock state with server
      lbClockIsPaused = !!clock.isPaused;
      lbClockLocalSeconds = clock.totalSeconds || 0;

      const clockDigitsEl = document.getElementById('lb-clock-display');
      const clockStatusEl = document.getElementById('lb-clock-status');
      const toggleBtn = document.getElementById('btn-lb-toggle-clock');

      if (clockDigitsEl && clockStatusEl && toggleBtn) {
        clockDigitsEl.textContent = formatDuration(lbClockLocalSeconds);
        if (lbClockIsPaused) {
          clockDigitsEl.classList.add('paused');
          clockStatusEl.className = 'clock-status-pill paused';
          clockStatusEl.textContent = '⏸️ PAUSED';
          toggleBtn.textContent = '▶️ Start / Resume Timer';
          toggleBtn.className = 'btn btn-primary btn-sm';
        } else {
          clockDigitsEl.classList.remove('paused');
          clockStatusEl.className = 'clock-status-pill running';
          clockStatusEl.textContent = '🟢 RUNNING';
          toggleBtn.textContent = '⏸️ Stop Timer';
          toggleBtn.className = 'btn btn-gold btn-sm';
        }
      }

      // Render Leaderboard Teams Table
      const containerEl = document.getElementById('lb-table-container');
      if (!containerEl) return;

      if (teams.length === 0) {
        containerEl.innerHTML = '<p style="padding: 24px; text-align: center; color: var(--muted);">No teams registered yet.</p>';
        return;
      }

      let rows = teams.map((t, idx) => {
        let rankBadge = `${idx + 1}`;
        if (idx === 0) rankBadge = '🥇 1';
        if (idx === 1) rankBadge = '🥈 2';
        if (idx === 2) rankBadge = '🥉 3';

        return `
          <tr style="${t.isFinished ? 'background: rgba(52, 211, 153, 0.08);' : ''}">
            <td style="font-size: 1.1rem; font-weight: bold; color: var(--gold);">${rankBadge}</td>
            <td style="font-size: 1.15rem; font-weight: bold;">${escapeHtml(t.name)}</td>
            <td><span style="color: var(--muted); font-size: 0.9rem;">${escapeHtml(t.coordinator || '-')}</span></td>
            <td><span style="font-weight: bold; color: ${t.isFinished ? 'var(--ok)' : 'var(--accent)'}; font-size: 1.05rem;">${t.stageText}</span></td>
            <td style="font-family: monospace; font-size: 1.25rem; font-weight: bold; color: var(--txt);">${t.formattedTime}</td>
            <td style="color: var(--muted);">${t.totalHints}</td>
            <td style="color: var(--muted);">${t.totalWrong}</td>
          </tr>
        `;
      }).join('');

      containerEl.innerHTML = `
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 70px;">Rank</th>
              <th>Team</th>
              <th>Coordinator</th>
              <th>Stage</th>
              <th>Time (+Penalties)</th>
              <th>Hints</th>
              <th>Wrong Tries</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      `;
    } catch (err) {
      console.error('Leaderboard poll error:', err);
    }
  }

  loadLbData();
  lbPollInterval = setInterval(loadLbData, 3000);
}

// Utility: HTML escape
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Kick off when DOM is ready
document.addEventListener('DOMContentLoaded', init);
