const fs = require('node:fs');
const path = require('node:path');
// Invoked once with the workspace's bundled sharp runtime; the generated PNGs
// are committed app assets and need no image service at build time.
const sharp = require(process.env.LENSFLOW_SHARP_PATH || 'sharp');
const root = path.resolve(__dirname, '../assets/brand');
fs.mkdirSync(root, { recursive: true });
function svg(size, background, scale = 1) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 256 256">
  <rect width="256" height="256" rx="64" fill="${background}"/>
  <g transform="translate(128 128) scale(${scale}) translate(-128 -128)" fill="none" stroke="#fff" stroke-width="12" stroke-linecap="round" stroke-linejoin="round">
    <path d="M91 82l12-18h50l12 18h24a16 16 0 0 1 16 16v79a16 16 0 0 1-16 16H67a16 16 0 0 1-16-16V98a16 16 0 0 1 16-16z"/>
    <circle cx="128" cy="137" r="33"/>
  </g><circle cx="205" cy="51" r="17" fill="#AF4C2D"/></svg>`;
}
(async () => {
  fs.writeFileSync(path.join(root, 'mark.svg'), svg(256, '#203C35'));
  for (const [name, size, scale] of [['icon',1024,1],['adaptive-icon',1024,.65],['splash',256,1],['favicon',64,1]]) {
    await sharp(Buffer.from(svg(size, '#203C35', scale))).png().toFile(path.join(root, `${name}.png`));
  }
  console.log('Brand assets generated.');
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
