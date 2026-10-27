const fs = require('node:fs');
const path = require('node:path');
// Preserve the supplied 512px aperture artwork, including its blade seams.
// Only sizing, padding and monochrome/gold tint vary between platform assets.
const sharp = require(process.env.LENSFLOW_SHARP_PATH || 'sharp');
const root = path.resolve(__dirname, '../assets/brand');
const authRoot = path.resolve(__dirname, '../assets/auth');
fs.mkdirSync(root, { recursive: true });
const master = fs.readFileSync(path.join(root, 'aperture-source.png'));
const gold = '#D9CCA4', paper = '#F8F7F4';
(async () => {
  const info = await sharp(master).metadata();
  // Keep the previous SVG entry point in sync without redrawing the PNG.
  // This is a raster wrapper, not a vector reconstruction.
  fs.writeFileSync(path.join(root, 'mark.svg'), `<svg xmlns="http://www.w3.org/2000/svg" width="${info.width}" height="${info.height}" viewBox="0 0 ${info.width} ${info.height}"><image width="${info.width}" height="${info.height}" href="data:image/png;base64,${master.toString('base64')}"/></svg>\n`);
  const assets = [
    [root, 'aperture', 512, {}],
    [root, 'icon', 1024, { background: paper, markSize: 640 }],
    // The complete mark fits within the adaptive icon's central safe area.
    [root, 'adaptive-icon', 1024, { markSize: 600 }],
    [root, 'monochrome-icon', 1024, { color: '#FFFFFF', markSize: 600 }],
    [root, 'notification-icon', 96, { color: '#FFFFFF', markSize: 72 }],
    [root, 'notification-large-icon', 256, { background: paper, markSize: 192 }],
    [root, 'favicon', 64, { markSize: 56 }],
    [root, 'splash', 256, { color: gold }],
    [authRoot, 'aperture', 512, {}],
    [authRoot, 'aperture-gold', 512, { color: gold }],
  ];
  for (const [folder, name, size, options] of assets) {
    const { color, background = '#00000000', markSize = size } = options;
    const destination = path.join(folder, `${name}.png`);
    if (!color && !options.background && size === info.width && size === info.height && markSize === size) {
      fs.writeFileSync(destination, master);
      continue;
    }
    const mark = await sharp(master).resize(markSize, markSize).png().toBuffer();
    const canvas = sharp({ create: { width: size, height: size, channels: 4, background } })
      .composite([{ input: mark, left: (size - markSize) / 2, top: (size - markSize) / 2 }]);
    if (color) {
      // Apply tint after scaling/compositing to keep notification RGB pure white.
      const tinted = await canvas.raw().toBuffer();
      const rgb = [1, 3, 5].map(offset => Number.parseInt(color.slice(offset, offset + 2), 16));
      for (let i = 0; i < tinted.length; i += 4) {
        const visible = tinted[i + 3] !== 0;
        tinted[i] = visible ? rgb[0] : 0;
        tinted[i + 1] = visible ? rgb[1] : 0;
        tinted[i + 2] = visible ? rgb[2] : 0;
      }
      await sharp(tinted, { raw: { width: size, height: size, channels: 4 } }).png().toFile(destination);
    } else {
      await canvas.png().toFile(destination);
    }
  }
  console.log('Supplied LensFlow aperture applied to app, adaptive, themed, notification, favicon and splash assets.');
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
