import sharp from 'sharp';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, '../public');
const logoPath = resolve(publicDir, 'logo.jpg');

if (!existsSync(logoPath)) {
  console.error('logo.jpg not found in /public');
  process.exit(1);
}

const sizes = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'apple-touch-icon.png', size: 180 },
  { file: 'icon-144.png', size: 144 },
];

for (const { file, size } of sizes) {
  const outPath = resolve(publicDir, file);
  await sharp(logoPath)
    .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png()
    .toFile(outPath);
  console.log(`✅ Generated ${file} (${size}x${size})`);
}

console.log('\n🎉 All icons generated successfully!');
