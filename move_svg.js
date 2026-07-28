const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, 'assets', 'vecteezy_deep-forest-scene-with-trees-cartoon-background-vector_9577135.webp');
const destDir = path.join(__dirname, 'assets', 'backgrounds');
const dest = path.join(destDir, 'main-bg.svg');

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

if (fs.existsSync(src)) {
  fs.renameSync(src, dest);
  console.log('Moved successfully!');
} else {
  console.log('Source file not found!');
}
