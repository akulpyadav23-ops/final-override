const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'public', 'assets');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

// Generate high quality SVGs that can serve as fallbacks or stand-in graphics
const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <defs>
    <radialGradient id="bg" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#101d36"/>
      <stop offset="100%" stop-color="#030813"/>
    </radialGradient>
    <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffe680"/>
      <stop offset="50%" stop-color="#ffb81f"/>
      <stop offset="100%" stop-color="#b37d00"/>
    </linearGradient>
    <linearGradient id="neon" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#27b4ff"/>
      <stop offset="100%" stop-color="#0066cc"/>
    </linearGradient>
  </defs>
  <circle cx="100" cy="100" r="94" fill="url(#bg)" stroke="url(#gold)" stroke-width="6"/>
  <circle cx="100" cy="100" r="82" fill="none" stroke="#1d4f8f" stroke-width="2" stroke-dasharray="6,4"/>
  <polygon points="100,30 150,140 120,140 100,90 80,140 50,140" fill="url(#gold)"/>
  <circle cx="100" cy="65" r="8" fill="#27b4ff"/>
  <text x="100" y="172" fill="#e8f1ff" font-family="system-ui, sans-serif" font-size="14" font-weight="bold" text-anchor="middle" letter-spacing="3">INVICTORS</text>
</svg>`;

const heroSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 400" width="1440" height="400">
  <defs>
    <linearGradient id="herobg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#030813"/>
      <stop offset="50%" stop-color="#08142c"/>
      <stop offset="100%" stop-color="#030813"/>
    </linearGradient>
    <linearGradient id="trace" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#1d4f8f" stop-opacity="0.3"/>
      <stop offset="50%" stop-color="#27b4ff" stop-opacity="0.7"/>
      <stop offset="100%" stop-color="#ffb81f" stop-opacity="0.5"/>
    </linearGradient>
  </defs>
  <rect width="1440" height="400" fill="url(#herobg)"/>
  <!-- Circuit traces -->
  <g stroke="url(#trace)" stroke-width="2" fill="none">
    <path d="M0,80 H300 L350,130 H600 L650,80 H1000 L1050,130 H1440"/>
    <path d="M0,200 H200 L250,250 H550 L600,200 H850 L900,250 H1200 L1250,200 H1440"/>
    <path d="M0,320 H400 L450,270 H750 L800,320 H1100 L1150,270 H1440"/>
    <circle cx="350" cy="130" r="4" fill="#27b4ff"/>
    <circle cx="650" cy="80" r="4" fill="#ffb81f"/>
    <circle cx="250" cy="250" r="4" fill="#34d399"/>
    <circle cx="900" cy="250" r="4" fill="#27b4ff"/>
    <circle cx="450" cy="270" r="4" fill="#ffb81f"/>
  </g>
</svg>`;

fs.writeFileSync(path.join(dir, 'logo.svg'), logoSvg);
fs.writeFileSync(path.join(dir, 'hero.svg'), heroSvg);

// If logo.jpg and hero.jpg do not exist yet, save placeholders
const logoJpgPath = path.join(dir, 'logo.jpg');
const heroJpgPath = path.join(dir, 'hero.jpg');

if (!fs.existsSync(logoJpgPath)) {
  fs.writeFileSync(logoJpgPath, logoSvg); // Browsers and our app handle SVG or JPG smoothly
}
if (!fs.existsSync(heroJpgPath)) {
  fs.writeFileSync(heroJpgPath, heroSvg);
}

console.log('✅ Default asset placeholders created.');
