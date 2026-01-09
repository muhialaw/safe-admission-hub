import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function createIconsFromLogo() {
  try {
    const publicDir = path.join(__dirname, 'public');
    
    // Check if we have the logo file
    const logoPath = path.join(publicDir, 'royal-brook-logo.jpg');
    if (!fs.existsSync(logoPath)) {
      console.error('Logo not found at', logoPath);
      process.exit(1);
    }

    // Create 192x192 icon with white background
    await sharp(logoPath)
      .resize(192, 192, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .png()
      .toFile(path.join(publicDir, 'icon-192x192.png'));
    console.log('✓ Created icon-192x192.png from logo');

    // Create 512x512 icon with white background
    await sharp(logoPath)
      .resize(512, 512, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .png()
      .toFile(path.join(publicDir, 'icon-512x512.png'));
    console.log('✓ Created icon-512x512.png from logo');

    // Create 192x192 maskable (with dark background for safe zone)
    await sharp(logoPath)
      .resize(170, 170, { fit: 'contain', background: { r: 31, g: 41, b: 55, alpha: 1 } })
      .extend({
        top: 11,
        bottom: 11,
        left: 11,
        right: 11,
        background: { r: 31, g: 41, b: 55, alpha: 1 }
      })
      .png()
      .toFile(path.join(publicDir, 'icon-192x192-maskable.png'));
    console.log('✓ Created icon-192x192-maskable.png from logo');

    // Create 512x512 maskable (with dark background for safe zone)
    await sharp(logoPath)
      .resize(450, 450, { fit: 'contain', background: { r: 31, g: 41, b: 55, alpha: 1 } })
      .extend({
        top: 31,
        bottom: 31,
        left: 31,
        right: 31,
        background: { r: 31, g: 41, b: 55, alpha: 1 }
      })
      .png()
      .toFile(path.join(publicDir, 'icon-512x512-maskable.png'));
    console.log('✓ Created icon-512x512-maskable.png from logo');

    console.log('\n✅ All PWA icons created from Royal Brook logo successfully!');
  } catch (err) {
    console.error('Error creating icons:', err);
    process.exit(1);
  }
}

createIconsFromLogo();
