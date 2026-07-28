const sharp = require('sharp');

sharp('./assets/images/favicon.png')
  .raw()
  .toBuffer({ resolveWithObject: true })
  .then(({ data, info }) => {
    console.log(`Dimensions: ${info.width}x${info.height}`);
    // Check top-left pixel (row 0, col 0)
    const r = data[0];
    const g = data[1];
    const b = data[2];
    const a = info.channels === 4 ? data[3] : 255;
    console.log(`Top-Left pixel color: rgba(${r}, ${g}, ${b}, ${a})`);
  })
  .catch(err => console.error(err));
