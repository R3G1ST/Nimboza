const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#667eea"/>
      <stop offset="100%" stop-color="#764ba2"/>
    </linearGradient>
  </defs>
  <rect width="256" height="256" rx="48" fill="url(#bg)"/>
  <circle cx="110" cy="100" r="40" fill="#FFD93D"/>
  <line x1="110" y1="45" x2="110" y2="55" stroke="#FFD93D" stroke-width="8" stroke-linecap="round"/>
  <line x1="110" y1="145" x2="110" y2="155" stroke="#FFD93D" stroke-width="8" stroke-linecap="round"/>
  <line x1="55" y1="100" x2="65" y2="100" stroke="#FFD93D" stroke-width="8" stroke-linecap="round"/>
  <line x1="155" y1="100" x2="165" y2="100" stroke="#FFD93D" stroke-width="8" stroke-linecap="round"/>
  <line x1="71" y1="61" x2="78" y2="68" stroke="#FFD93D" stroke-width="8" stroke-linecap="round"/>
  <line x1="142" y1="132" x2="149" y2="139" stroke="#FFD93D" stroke-width="8" stroke-linecap="round"/>
  <line x1="71" y1="139" x2="78" y2="132" stroke="#FFD93D" stroke-width="8" stroke-linecap="round"/>
  <line x1="142" y1="68" x2="149" y2="61" stroke="#FFD93D" stroke-width="8" stroke-linecap="round"/>
  <ellipse cx="160" cy="150" rx="55" ry="35" fill="rgba(255,255,255,0.95)"/>
  <ellipse cx="120" cy="155" rx="40" ry="28" fill="rgba(255,255,255,0.95)"/>
  <ellipse cx="180" cy="155" rx="35" ry="25" fill="rgba(255,255,255,0.95)"/>
</svg>`;

async function generateIcons() {
  const sizes = [16, 32, 48, 64, 128, 256];
  
  for (const size of sizes) {
    await sharp(Buffer.from(svg))
      .resize(size, size)
      .png()
      .toFile(path.join(__dirname, `icon-${size}.png`));
  }
  
  // Generate ICO file with multiple sizes
  const icoSizes = [16, 32, 48, 256];
  const images = [];
  for (const size of icoSizes) {
    const buf = await sharp(Buffer.from(svg))
      .resize(size, size)
      .png()
      .toBuffer();
    images.push({ size, data: buf });
  }
  
  // ICO file format
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // Type: ICO
  header.writeUInt16LE(images.length, 4); // Number of images
  
  let dataOffset = 6 + images.length * 16;
  const entries = [];
  const imageData = [];
  
  for (const img of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(img.size === 256 ? 0 : img.size, 0); // Width
    entry.writeUInt8(img.size === 256 ? 0 : img.size, 1); // Height
    entry.writeUInt8(0, 2); // Color palette
    entry.writeUInt8(0, 3); // Reserved
    entry.writeUInt16LE(1, 4); // Color planes
    entry.writeUInt16LE(32, 6); // Bits per pixel
    entry.writeUInt32LE(img.data.length, 8); // Image size
    entry.writeUInt32LE(dataOffset, 12); // Image offset
    entries.push(entry);
    imageData.push(img.data);
    dataOffset += img.data.length;
  }
  
  const ico = Buffer.concat([header, ...entries, ...imageData]);
  fs.writeFileSync(path.join(__dirname, 'icon.ico'), ico);
  
  // Also save as PNG for electron-builder
  await sharp(Buffer.from(svg))
    .resize(256, 256)
    .png()
    .toFile(path.join(__dirname, 'icon.png'));
  
  console.log('Icons generated (PNG + ICO)!');
}

generateIcons().catch(console.error);
