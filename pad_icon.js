const sharp = require('sharp');
const fs = require('fs');

async function processIcon() {
  try {
    const targetWidth = 640;
    const targetHeight = 640;
    
    // Use a rounded rectangle mask (radius 128px, which is 20% of the 640px size)
    // This removes the white corners while preserving BOTH circular and rounded rectangle shapes perfectly.
    const roundedRectMask = Buffer.from(
      `<svg width="${targetWidth}" height="${targetHeight}">
         <rect width="${targetWidth}" height="${targetHeight}" rx="128" ry="128" fill="black" />
       </svg>`
    );

    console.log("Applying rounded rectangle crop and padding to favicon.png...");

    // 1. Resize original favicon to 640x640 (safe zone)
    // 2. Crop the corners using the rounded rectangle mask (removing the white background outside the frame)
    const croppedBuffer = await sharp('./assets/images/favicon.png')
      .resize(targetWidth, targetHeight, { fit: 'fill' })
      .composite([{
        input: roundedRectMask,
        blend: 'dest-in'
      }])
      .png()
      .toBuffer();

    // 3. Generate adaptive-icon.png (with transparent padding so Android can mask it to any shape)
    await sharp(croppedBuffer)
      .extend({
        top: 192,
        bottom: 192,
        left: 192,
        right: 192,
        background: { r: 0, g: 0, b: 0, alpha: 0 } // Transparent padding
      })
      .png()
      .toFile('./assets/images/adaptive-icon.png');

    // 4. Generate fallback icon.png (with solid #1D3F75 background so it shows as a solid rounded rectangle on home screens)
    // Composite the cropped 640x640 logo onto the center of a solid 1024x1024 background directly.
    await sharp({
      create: {
        width: 1024,
        height: 1024,
        channels: 4,
        background: { r: 29, g: 63, b: 117, alpha: 1 } // #1D3F75
      }
    })
      .composite([{
        input: croppedBuffer,
        top: 192,
        left: 192
      }])
      .png()
      .toFile('./assets/images/icon-temp.png');

    fs.renameSync('./assets/images/icon-temp.png', './assets/images/icon.png');

    console.log('✅ Successfully cropped white corners to a rounded rectangle shape!');
    console.log('✅ adaptive-icon.png generated with transparent padding.');
    console.log('✅ icon.png generated with solid #1D3F75 background.');
  } catch (err) {
    console.error("Error processing icons:", err);
  }
}

processIcon();
