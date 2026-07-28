const fs = require('fs');
fs.copyFileSync('/home/n-rujut-pavan-kumar/.gemini/antigravity/brain/2d93ba7c-5e9a-4d1b-b7d1-040e00364536/mario_md_splash_1779942559931.png', './assets/images/splash-icon.png');
fs.copyFileSync('./assets/images/favicon.png', './assets/images/icon.png');
fs.copyFileSync('./assets/images/favicon.png', './assets/images/adaptive-icon.png');
console.log('Image assets updated successfully.');
