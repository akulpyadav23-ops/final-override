const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const os = require('os');
const config = require('./config');

// Initialize database schema
require('./db');

const app = express();

app.use(express.json({ limit: '500kb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve static assets from public/
app.use(express.static(path.join(__dirname, '..', 'public')));

// Mount API routes
app.use('/api', require('./routes/api'));
app.use('/api/warden', require('./routes/warden'));
app.use('/api/terminal', require('./routes/terminal'));
app.use('/api/coordinator', require('./routes/coordinator'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/leaderboard', require('./routes/leaderboard'));

// Public config endpoint for coordinator suggestions, etc.
app.get('/api/config', (req, res) => {
  res.json({
    coordinators: config.COORDINATORS,
    timeCapMinutes: config.TIME_CAP_MINUTES
  });
});

// SPA fallback for all frontend routes: /, /coordinator, /admin, /leaderboard
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Helper to find LAN IPv4 address
function getLanIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

let server = null;
const PORT = config.PORT;

if (!process.env.VERCEL) {
  server = app.listen(PORT, '0.0.0.0', () => {
    const lanIp = getLanIp();
    console.log('====================================================');
    console.log('  ⚡ FINAL OVERRIDE — INVICTORS CLUB MISSION SYSTEM ⚡');
    console.log('====================================================');
    console.log(`  Local:        http://localhost:${PORT}`);
    console.log(`  LAN URL:      http://${lanIp}:${PORT}`);
    console.log(`  Coordinator:  http://${lanIp}:${PORT}/coordinator`);
    console.log(`  Admin Panel:  http://${lanIp}:${PORT}/admin`);
    console.log(`  Leaderboard:  http://${lanIp}:${PORT}/leaderboard`);
    console.log('====================================================');
  });
}

module.exports = process.env.VERCEL ? app : { app, server };
