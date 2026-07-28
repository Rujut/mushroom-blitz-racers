const fs = require('fs');
const path = require('path');

const FRAME_W = 72;
const FRAME_H = 72;
const COLS = 10;
const ROWS = 5;

// We will draw a simple "Ninja" character using SVG rects and circles
let svgContent = `<svg width="${FRAME_W * COLS}" height="${FRAME_H * ROWS}" xmlns="http://www.w3.org/2000/svg">`;

function drawNinja(cx, cy, animState, frameIndex) {
  let yOffset = 0;
  let legSpread = 0;
  let armSwing = 0;

  if (animState === 'idle') {
    yOffset = Math.sin(frameIndex * Math.PI / 2) * 2;
  } else if (animState === 'run') {
    yOffset = Math.abs(Math.sin(frameIndex * Math.PI / 4)) * 4 - 2;
    legSpread = Math.sin(frameIndex * Math.PI / 4) * 12;
    armSwing = Math.sin(frameIndex * Math.PI / 4) * 15;
  } else if (animState === 'jump') {
    yOffset = -10 + frameIndex * 2;
    legSpread = 8;
    armSwing = -15;
  } else if (animState === 'fall') {
    yOffset = -4 + frameIndex * 2;
    legSpread = 4;
    armSwing = 15;
  } else if (animState === 'land') {
    yOffset = 8 - frameIndex * 4;
    legSpread = 10;
  }

  const gStart = `<g transform="translate(${cx}, ${cy + yOffset})">`;
  const gEnd = `</g>`;

  // Ninja components
  // Headband tail
  const headband = `<path d="M -12 -12 Q -20 -15 -25 ${-10 + armSwing/2}" stroke="#d32f2f" stroke-width="3" fill="none" />`;
  
  // Body (Dark grey)
  const body = `<rect x="-12" y="-5" width="24" height="25" rx="6" fill="#2c3e50"/>`;
  
  // Head
  const head = `<circle cx="0" cy="-15" r="14" fill="#2c3e50"/>`;
  
  // Face mask opening (skin color)
  const face = `<rect x="-10" y="-20" width="20" height="8" rx="4" fill="#f1c40f"/>`;
  
  // Eyes
  const eyes = `<circle cx="-4" cy="-16" r="2" fill="#111"/><circle cx="6" cy="-16" r="2" fill="#111"/>`;

  // Arms
  const armL = `<line x1="-12" y1="0" x2="${-16 - armSwing}" y2="15" stroke="#34495e" stroke-width="6" stroke-linecap="round"/>`;
  const armR = `<line x1="12" y1="0" x2="${16 + armSwing}" y2="15" stroke="#34495e" stroke-width="6" stroke-linecap="round"/>`;

  // Legs
  const legL = `<line x1="-6" y1="20" x2="${-6 - legSpread}" y2="35" stroke="#2c3e50" stroke-width="7" stroke-linecap="round"/>`;
  const legR = `<line x1="6" y1="20" x2="${6 + legSpread}" y2="35" stroke="#2c3e50" stroke-width="7" stroke-linecap="round"/>`;

  return gStart + headband + armL + armR + legL + legR + body + head + face + eyes + gEnd;
}

const states = [
  { name: 'idle', count: 4 },
  { name: 'run', count: 8 },
  { name: 'jump', count: 4 },
  { name: 'fall', count: 4 },
  { name: 'land', count: 3 }
];

for (let r = 0; r < ROWS; r++) {
  const stateInfo = states[r];
  for (let c = 0; c < stateInfo.count; c++) {
    const cx = c * FRAME_W + FRAME_W / 2;
    const cy = r * FRAME_H + FRAME_H / 2;
    svgContent += drawNinja(cx, cy, stateInfo.name, c);
  }
}

svgContent += `</svg>`;

const destPath = path.join(__dirname, '..', 'assets', 'characters', 'player-spritesheet-perfect.svg');
fs.writeFileSync(destPath, svgContent);
console.log('Successfully generated mathematically perfect SVG sprite sheet at:', destPath);
