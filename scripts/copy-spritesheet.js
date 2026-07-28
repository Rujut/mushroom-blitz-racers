// This file exists to trigger the copy. Run: node scripts/copy-spritesheet.js
const fs = require('fs');
const path = require('path');
const src = '/home/n-rujut-pavan-kumar/.gemini/antigravity/brain/2d93ba7c-5e9a-4d1b-b7d1-040e00364536/player_spritesheet_1779861320709.png';
const destDir = path.resolve(__dirname, '..', 'assets', 'characters');
const dest = path.join(destDir, 'player-spritesheet.png');
if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
console.log('Done:', dest, fs.statSync(dest).size, 'bytes');
