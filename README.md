# FINAL OVERRIDE — Invictors Club Web Challenge

> **"INVICTORS CLUB PRESENTS · Decode. Innovate. Overcome."**  
> Timed, team-based escape-room style tech challenge for the Dept. of Computer Science & Engineering, Vidyavardhaka College of Engineering (VVCE), Mysuru.

---

## 1. Quick Start & Run Steps

The application runs entirely offline on the organizer's laptop over local campus Wi-Fi.

### Prerequisites
- **Node.js 20+** installed on the organizer laptop.

### Installation & Launch
```bash
# 1. Install dependencies
npm install

# 2. Reset / initialize database (optional for pristine start)
npm run seed

# 3. Start server
npm start
```

Upon startup, the console displays the exact URLs for both local access and participants on the LAN:
```
====================================================
  ⚡ FINAL OVERRIDE — INVICTORS CLUB MISSION SYSTEM ⚡
====================================================
  Local:        http://localhost:3000
  LAN URL:      http://<YOUR-LAN-IP>:3000
  Coordinator:  http://<YOUR-LAN-IP>:3000/coordinator
  Admin Panel:  http://<YOUR-LAN-IP>:3000/admin
  Leaderboard:  http://<YOUR-LAN-IP>:3000/leaderboard
====================================================
```

---

## 2. LAN Usage Instructions

1. Connect the organizer's laptop to the event Wi-Fi router / campus hotspot.
2. Note the printed **LAN URL** (e.g. `http://192.168.1.50:3000`).
3. Participants on their own laptops open `http://<YOUR-LAN-IP>:3000` in their browsers.
4. Projector screen opens `http://<YOUR-LAN-IP>:3000/leaderboard` for live spectator ranking (no secrets or answers shown).
5. Coordinators open `http://<YOUR-LAN-IP>:3000/coordinator` on their phones or laptops to track only their assigned teams.

---

## 3. Configuration & Secrets

All configuration is managed in `.env` (copy from `.env.example`):

| Variable | Default Value | Description |
|---|---|---|
| `PORT` | `3000` | Port on which the HTTP server listens (`0.0.0.0`) |
| `ADMIN_PIN` | `INVICTORS` | Secret PIN to access the Organiser Admin Panel |
| `COORDINATORS` | `Arun,Divya,Kiran,Pooja,Rakshith` | Comma-separated coordinator names suggested during registration |
| `TIME_CAP_MINUTES` | `90` | Recommended mission duration cap |
| `EVENT_SALT` | `invictors_final_override_salt_2026` | Per-event cryptographic salt for hashing answers |
| `ALLOW_NEW_TEAMS` | `false` | When `true`, participants can register new teams from the result screen |
| `OPENAI_API_KEY` | *(empty)* | Optional. If provided, WARDEN uses LLM; automatically falls back to deterministic rule engine if empty or offline |
| `ANTHROPIC_API_KEY` | *(empty)* | Optional alternative LLM provider |

### How to Change Secrets & Stage Fragments
- **Stage 1 (NOVA)**: In `server/logic/stages.js`, update `STAGE_CONFIG[1].morsePattern` and answer checks.
- **Stage 2 (7K2 & AURORA)**: In `server/logic/stages.js`, update `STAGE_CONFIG[2].encodedText` (ROT13 → Hex → Base64).
- **Stage 3 (ORBIT, ZETA9, AURORA)**: In `.env`, optionally set `WARDEN_REAL`, `WARDEN_DECOY`, and `WARDEN_ACCESS`.
- **Stage 4 (91X)**: In `server/routes/terminal.js` and `server/logic/stages.js`.
- **Stage 5 & Stage 6**: Dynamically computed cryptographic shards (`SHA256("FO|" + team + "|" + member)`) and final composite key formula.

### How to Add Coordinators
Simply add names to `COORDINATORS` in `.env`:
```env
COORDINATORS=Arun,Divya,Kiran,Pooja,Rakshith,Suresh,Ananya
```
Coordinators will immediately appear as auto-complete suggestions on the registration form.

---

## 4. Default Choices & Design Decisions

Where parameters were unspecified, the following sensible defaults were selected:
1. **Frontend Architecture**: Pure modular vanilla JavaScript + modern CSS design system with CSS custom properties. Zero external CDNs, fonts, or libraries, ensuring 100% offline LAN reliability.
2. **Database Engine**: `better-sqlite3@9.6.0` running with WAL mode (`journal_mode = WAL`) and foreign key constraints enabled for instant atomic transactions.
3. **HTTP Cookie Security**: `fo_leader_token` and `fo_member_token` are issued with `httpOnly: true` and `sameSite: 'lax'` to prevent cross-device session spoofing.
4. **Live Polling Rate**: Coordinator dashboard and projector leaderboard poll every `3000 ms` (3 seconds) to ensure real-time visual feedback without saturating Wi-Fi bandwidth.
5. **Rate Limiting**: Answer submissions are strictly rate-limited to 1 request per second per team. WARDEN chat is rate-limited to 40 messages per hour per team with a 600-character ceiling.
6. **Tie-Breaking Rule**: Completed teams are ranked by total time (elapsed + penalties). Tied total times are resolved by fewer hints used, then fewer wrong attempts.
7. **Asset Fallback**: Built-in SVG fallbacks for `logo.jpg` and `hero.jpg` ensure pristine visual presentation even before organizer assets are dropped into `/public/assets/`.

---

## 5. Event Day Dry-Run Checklist

- [ ] **Laptop Power**: Keep organizer laptop plugged into AC power; set power mode to "Never sleep when plugged in".
- [ ] **Network Check**: Ensure all laptops are connected to the same Wi-Fi SSID with AP client isolation disabled.
- [ ] **Environment File**: Verify `ADMIN_PIN` in `.env` is set to organizer's chosen PIN.
- [ ] **Database State**: Run `npm run seed` before teams arrive to wipe test teams.
- [ ] **Start Application**: Run `npm start` and copy the printed LAN IP address.
- [ ] **Projector Setup**: Open `http://localhost:3000/leaderboard` on the projector browser window (press F11 for full screen).
- [ ] **Coordinator Briefing**: Provide coordinators their login URL `http://<LAN-IP>:3000/coordinator` and ensure they enter their exact registered name.
- [ ] **Stage 5 Multi-Device Rule**: Remind participants that Mission 5 requires at least 3 players to open the start page on their own laptops and use the "Joining as a team member" form to obtain their individual shards.

---

## 6. Automated Test Suite Results

The codebase contains full automated test coverage verifying criteria 1 to 11. Run via:
```bash
npm test
```

### Verified Acceptance Criteria:
- **Test 1**: Registration validation rejects <3 members, duplicate member names, and duplicate team names (case-insensitive).
- **Test 2**: Server-side stage locking rejects future answers; stage content is isolated.
- **Test 3**: Case/space-insensitive normalization (`nova`, `7k2`, `orbit`, `91x`). Decoy `ZETA9` rejected.
- **Test 4**: WARDEN rule engine responds with decoy `ZETA9` to unauthenticated queries, and releases real fragment `ORBIT` when provided `AURORA` with valid role and task.
- **Test 5**: Terminal commands (`help`, `ls`, `cat robots.txt`, `cat vault-7f3a/note.txt`, `exif badge.jpg`) output exactly as specified; DOM comment token delivered.
- **Test 6**: Hint penalties (+3m, +5m, max 2 hints) and wrong attempts (1–5 free, 6th and later +1m each).
- **Test 7**: Exact Team Sync test vector: Team Alpha (Chitra S, Asha Rao, Bharat K) yields shards `EFD`, `82D`, `326` and team code `EFD-82D-326`. Blocked until 3 distinct devices join.
- **Test 8**: Exact Final Key test vector: `FO{91X-7K2-NOVA-TIBRO-EFD82D326}#40` unlocks the vault.
- **Test 9**: Leader device blocked from fetching member shards; member device tokens cannot be hijacked.
- **Test 10**: Coordinator data isolation: Coordinator A sees only their assigned teams; Admin panel sees all teams.
- **Test 11**: Mid-game reload restores team state, fragments, and synchronizes with server clock.
- **End-to-End Simulation**: Passed all 6 stages with 2 simulated devices and generated verification code.

---

## 7. Branding & Credits

- **Organized By**: Invictors Club · Dept. of Computer Science & Engineering, Vidyavardhaka College of Engineering (VVCE), Mysuru.
- **Instagram**: [@theinvictors.vvce](https://instagram.com/theinvictors.vvce)
- **Email**: invictorsofficial@gmail.com
- **Website**: [https://invictors-vvce.vercel.app/](https://invictors-vvce.vercel.app/)
