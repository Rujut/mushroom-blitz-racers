const fs = require('fs');
const execSync = require('child_process').execSync;

try {
  // Ensure sharp is installed
  console.log("Installing sharp image processor temporarily...");
  execSync('npm install --no-save sharp', { stdio: 'inherit' });
  
  const sharp = require('sharp');
  
  console.log("Converting favicon.png to true PNG format...");
  
  sharp('./assets/images/favicon.png')
    .toFormat('png')
    .toFile('./assets/images/icon.png')
    .then(() => {
      return sharp('./assets/images/favicon.png')
        .toFormat('png')
        .toFile('./assets/images/adaptive-icon.png');
    })
    .then(() => {
      // Also ensure splash-icon is a true PNG
      return sharp('./assets/images/splash-icon.png')
        .toFormat('png')
        .toFile('./assets/images/splash-icon-fixed.png')
        .then(() => {
          fs.renameSync('./assets/images/splash-icon-fixed.png', './assets/images/splash-icon.png');
        });
    })
    .then(() => {
      console.log('✅ Icons successfully converted to true PNG format!');
      console.log('✅ You can now run your build without errors!');
    })
    .catch(err => {
      console.error('Error during conversion:', err);
    });

} catch (e) {
  console.error("Failed to run script:", e.message);
}
