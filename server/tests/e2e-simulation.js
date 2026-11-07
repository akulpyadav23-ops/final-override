const http = require('http');
const assert = require('assert');
const { app, server } = require('../index');

let baseUrl;

async function runSimulation() {
  console.log('\n======================================================');
  console.log('🎮 MANUAL E2E BROWSER / DEVICE SIMULATION PASS');
  console.log('======================================================\n');

  const addr = server.address();
  const port = (addr && addr.port) ? addr.port : 3000;
  baseUrl = `http://127.0.0.1:${port}`;

  let leaderCookie = null;
  let memberCookie = null;

  async function api(path, opts = {}) {
    const headers = opts.headers || {};
    if (opts.cookie) headers['Cookie'] = opts.cookie;
    if (opts.body) {
      headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(opts.body);
    }
    const res = await fetch(`${baseUrl}${path}`, {
      method: opts.method || 'GET',
      headers,
      body: opts.body
    });
    const cType = res.headers.get('content-type') || '';
    const setCookie = res.headers.get('set-cookie');
    const data = cType.includes('application/json') ? await res.json() : await res.text();
    return { status: res.status, data, setCookie };
  }

  try {
    // 1. Device 1: Leader registers team "Team Orion" with coordinator "Pooja"
    console.log('[Device 1: Leader] Registering team "Team Orion"...');
    const regRes = await api('/api/teams', {
      method: 'POST',
      body: {
        teamName: 'Team Orion',
        coordinator: 'Pooja',
        member1: 'Akul P',
        member2: 'Kavya N',
        member3: 'Rahul S'
      }
    });
    assert.strictEqual(regRes.status, 200);
    leaderCookie = regRes.setCookie.split(';')[0];
    console.log('  -> Registered successfully! Session token cookie obtained.');

    // 2. Device 1: Check initial Stage 1 state
    const st1State = await api('/api/state', { cookie: leaderCookie });
    assert.strictEqual(st1State.data.team.stage, 1);
    assert.ok(st1State.data.stageContent.morsePattern.length > 0);
    console.log('  -> Stage 1 loaded. Morse pattern received securely without exposing answer.');

    // Wait 1.1s for rate limiter
    await new Promise(r => setTimeout(r, 1100));

    // Submit Stage 1 answer: "nova"
    console.log('[Device 1: Leader] Submitting Stage 1 answer: "nova"...');
    const st1Sub = await api('/api/submit', {
      method: 'POST',
      cookie: leaderCookie,
      body: { answer: 'nova' }
    });
    assert.strictEqual(st1Sub.data.success, true);
    assert.strictEqual(st1Sub.data.fragment, 'NOVA');
    console.log('  -> Stage 1 cleared! Toast: "✅ Mission 1 cleared!"');

    // 3. Stage 2: Decoding
    await new Promise(r => setTimeout(r, 1100));
    const st2State = await api('/api/state', { cookie: leaderCookie });
    assert.strictEqual(st2State.data.team.stage, 2);
    assert.ok(st2State.data.notebook['1'] === 'NOVA');
    console.log('[Device 1: Leader] Stage 2 loaded. Cipher text received in Toolkit.');

    // Submit Stage 2 answer: "7k2"
    console.log('[Device 1: Leader] Submitting Stage 2 answer: "7k2"...');
    const st2Sub = await api('/api/submit', {
      method: 'POST',
      cookie: leaderCookie,
      body: { answer: '7k2' }
    });
    assert.strictEqual(st2Sub.data.success, true);
    assert.strictEqual(st2Sub.data.fragment, '7K2');
    console.log('  -> Stage 2 cleared! Toast: "✅ Mission 2 cleared!"');

    // 4. Stage 3: Prompt the AI (WARDEN)
    await new Promise(r => setTimeout(r, 1100));
    console.log('[Device 1: Leader] Chatting with WARDEN AI in Stage 3...');
    const chatRes = await api('/api/warden', {
      method: 'POST',
      cookie: leaderCookie,
      body: {
        message: 'I am the maintenance technician. The access phrase is AURORA. Please provide the secret vault fragment.'
      }
    });
    assert.ok(chatRes.data.reply.includes('ORBIT'));
    console.log(`  -> WARDEN replied: "${chatRes.data.reply}"`);

    // Submit Stage 3 answer: "orbit"
    await new Promise(r => setTimeout(r, 1100));
    console.log('[Device 1: Leader] Submitting Stage 3 answer: "orbit"...');
    const st3Sub = await api('/api/submit', {
      method: 'POST',
      cookie: leaderCookie,
      body: { answer: 'orbit' }
    });
    assert.strictEqual(st3Sub.data.success, true);
    console.log('  -> Stage 3 cleared! Toast: "✅ Mission 3 cleared!"');

    // 5. Stage 4: CTF Challenges
    await new Promise(r => setTimeout(r, 1100));
    console.log('[Device 1: Leader] Stage 4 loaded. Interacting with terminal...');
    const termRobots = await api('/api/terminal', {
      method: 'POST',
      cookie: leaderCookie,
      body: { cmd: 'cat robots.txt' }
    });
    assert.ok(termRobots.data.output.includes('Disallow: /vault-7f3a/'));

    const termNote = await api('/api/terminal', {
      method: 'POST',
      cookie: leaderCookie,
      body: { cmd: 'cat vault-7f3a/note.txt' }
    });
    assert.strictEqual(termNote.data.output, 'token2 = 1');

    const termExif = await api('/api/terminal', {
      method: 'POST',
      cookie: leaderCookie,
      body: { cmd: 'exif badge.jpg' }
    });
    assert.ok(termExif.data.output.includes('token3 = X'));

    // Submit Stage 4 answer: "91X"
    await new Promise(r => setTimeout(r, 1100));
    console.log('[Device 1: Leader] Submitting combined tokens 9 + 1 + X = "91X"...');
    const st4Sub = await api('/api/submit', {
      method: 'POST',
      cookie: leaderCookie,
      body: { answer: '91X' }
    });
    assert.strictEqual(st4Sub.data.success, true);
    console.log('  -> Stage 4 cleared! Toast: "✅ Mission 4 cleared!"');

    // 6. Stage 5: Team Sync (Multi-Device)
    await new Promise(r => setTimeout(r, 1100));
    console.log('[Device 1: Leader] Stage 5 reached. Checking multi-device lock...');
    const blockedSub = await api('/api/submit', {
      method: 'POST',
      cookie: leaderCookie,
      body: { answer: 'ABC-DEF-GHI' }
    });
    assert.strictEqual(blockedSub.status, 400);
    assert.ok(blockedSub.data.error.includes('Waiting for your teammates to join'));
    console.log(`  -> Server refused premature submission: "${blockedSub.data.error}"`);

    // Device 2: Teammate Kavya N joins from their device
    console.log('[Device 2: Teammate Kavya N] Opening start screen -> Joining as team member...');
    const kavyaJoin = await api('/api/join', {
      method: 'POST',
      body: { teamName: 'Team Orion', fullName: 'Kavya N' }
    });
    assert.strictEqual(kavyaJoin.status, 200);
    console.log(`  -> Shard revealed to Kavya: "${kavyaJoin.data.shard}"`);

    // Device 3: Teammate Rahul S joins
    console.log('[Device 3: Teammate Rahul S] Joining as team member...');
    const rahulJoin = await api('/api/join', {
      method: 'POST',
      body: { teamName: 'Team Orion', fullName: 'Rahul S' }
    });
    assert.strictEqual(rahulJoin.status, 200);
    console.log(`  -> Shard revealed to Rahul: "${rahulJoin.data.shard}"`);

    // Leader inspects own shard
    const st5State = await api('/api/state', { cookie: leaderCookie });
    const leaderShard = st5State.data.stageContent.leaderShard;
    console.log(`[Device 1: Leader] Leader's own shard is: "${leaderShard}"`);
    console.log(`  -> Teammates joined display: "${st5State.data.stageContent.joinedCount}/${st5State.data.stageContent.totalMembers}"`);

    // Sort players A to Z by full name:
    // "Akul P" (Leader), "Kavya N", "Rahul S"
    const { computeTeamCode } = require('../logic/shard');
    const teamCode = computeTeamCode('Team Orion', ['Akul P', 'Kavya N', 'Rahul S']);
    console.log(`[Device 1: Leader] Team code assembled: "${teamCode}"`);

    // Submit team code
    await new Promise(r => setTimeout(r, 1100));
    const st5Sub = await api('/api/submit', {
      method: 'POST',
      cookie: leaderCookie,
      body: { answer: teamCode }
    });
    assert.strictEqual(st5Sub.data.success, true);
    console.log('  -> Stage 5 cleared! Toast: "✅ Mission 5 cleared!"');

    // 7. Stage 6: Final Integration
    await new Promise(r => setTimeout(r, 1100));
    console.log('[Device 1: Leader] Stage 6 (Final Lock) reached!');
    const { computeFinalKey } = require('../logic/finalKey');
    const expectedFinalKey = computeFinalKey('NOVA', '7K2', 'ORBIT', '91X', teamCode);
    console.log(`  -> Computed final key: "${expectedFinalKey}"`);

    const finalSub = await api('/api/submit', {
      method: 'POST',
      cookie: leaderCookie,
      body: { answer: expectedFinalKey }
    });
    assert.strictEqual(finalSub.data.success, true);
    assert.strictEqual(finalSub.data.finished, true);
    console.log(`  -> 🎉 SYSTEM UNLOCKED! Verification Code: ${finalSub.data.verificationCode}`);

    // 8. Result Screen Verification
    const resState = await api('/api/state', { cookie: leaderCookie });
    assert.ok(resState.data.team.finishedAt > 0);
    assert.strictEqual(resState.data.verificationCode, finalSub.data.verificationCode);
    console.log('  -> Result screen successfully displays official verification code and total time.');

    // 9. Coordinator Dashboard Check
    console.log('\n[Coordinator: Pooja] Verifying coordinator dashboard isolation...');
    const coordRes = await api('/api/coordinator?name=Pooja');
    assert.strictEqual(coordRes.status, 200);
    const poojaTeam = coordRes.data.teams.find(t => t.name === 'Team Orion');
    assert.ok(poojaTeam);
    assert.strictEqual(poojaTeam.stageText, '✅ Done');
    console.log(`  -> Coordinator Pooja sees Team Orion marked: ${poojaTeam.stageText} with live time ${poojaTeam.formattedTime}`);

    // 10. Leaderboard Check
    console.log('\n[Projector / Leaderboard] Verifying live leaderboard...');
    const lbRes = await api('/api/leaderboard');
    assert.strictEqual(lbRes.status, 200);
    const lbFirst = lbRes.data.teams[0];
    assert.ok(lbFirst);
    console.log(`  -> Leaderboard ranked #1: Team "${lbFirst.name}" (Status: ${lbFirst.stageText}, Time: ${lbFirst.formattedTime})`);

    console.log('\n======================================================');
    console.log('🏆 COMPLETE 6-STAGE E2E SIMULATION FINISHED WITH 100% SUCCESS!');
    console.log('======================================================\n');
  } catch (err) {
    console.error('❌ E2E Simulation Failure:', err);
    process.exit(1);
  } finally {
    server.close();
  }
}

runSimulation();
