const https = require('https');
const fs = require('fs');
const path = require('path');

const url = 'https://raw.githubusercontent.com/KenneyNL/Platformer-Art-Complete-Pack-0/master/Base%20pack/Player/p1_spritesheet.png';
const dest = path.join(__dirname, '..', 'assets', 'characters', 'player-spritesheet.png');

console.log('Downloading perfectly spaced character sprite sheet...');

const file = fs.createWriteStream(dest);
https.get(url, (response) => {
  if (response.statusCode !== 200) {
    console.error(`Failed to download: HTTP ${response.statusCode}`);
    return;
  }
  
  response.pipe(file);
  file.on('finish', () => {
    file.close();
    console.log('✅ Download complete!');
    console.log(`Saved to: ${dest}`);
    console.log('\nReload Expo Go and your character will animate flawlessly!');
  });
}).on('error', (err) => {
  fs.unlink(dest, () => {});
  console.error('Error downloading the file:', err.message);
});
