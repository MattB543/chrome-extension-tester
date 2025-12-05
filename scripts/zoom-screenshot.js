/**
 * Simple script to crop and zoom a portion of a screenshot
 * Usage: node scripts/zoom-screenshot.js <input.png> <x> <y> <width> <height> <output.png>
 */

const sharp = require('sharp');
const path = require('path');

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 6) {
    console.log('Usage: node zoom-screenshot.js <input.png> <x> <y> <width> <height> <output.png>');
    console.log('Example: node zoom-screenshot.js screenshot.png 300 200 400 300 zoomed.png');
    process.exit(1);
  }

  const [inputPath, x, y, width, height, outputPath] = args;

  try {
    await sharp(inputPath)
      .extract({
        left: parseInt(x),
        top: parseInt(y),
        width: parseInt(width),
        height: parseInt(height)
      })
      .resize(parseInt(width) * 2, parseInt(height) * 2, { kernel: 'nearest' }) // 2x zoom
      .toFile(outputPath);

    console.log(`Zoomed image saved to: ${outputPath}`);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

main();
