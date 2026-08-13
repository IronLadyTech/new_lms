/**
 * Shrinks the images a learner downloads on their first visit.
 *
 * Nothing here changes what is displayed — only how much is sent to display
 * it. The logo was 2,125 pixels wide and shown at 48; the programme covers were
 * full-size photographs shown in a card a few hundred pixels across.
 *
 * Targets are twice the largest size each image is actually displayed at, which
 * is what a high-density screen needs and no more.
 *
 *   npm run images
 */
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const TARGETS = [
  {
    file: 'public/logo.png',
    // Shown at 3rem (48px) at its largest; 128 covers that on a retina screen.
    width: 128,
    encode: (img) => img.png({ compressionLevel: 9, palette: true }),
  },
  {
    file: 'public/programs/mbw.png',
    width: 800,
    encode: (img) => img.jpeg({ quality: 78, mozjpeg: true }),
  },
  {
    file: 'public/programs/lep.png',
    width: 800,
    encode: (img) => img.jpeg({ quality: 78, mozjpeg: true }),
  },
  {
    file: 'public/programs/100bm.png',
    width: 800,
    encode: (img) => img.jpeg({ quality: 78, mozjpeg: true }),
  },
];

const kb = (bytes) => Math.round(bytes / 1024);
let before = 0;
let after = 0;

for (const target of TARGETS) {
  if (!fs.existsSync(target.file)) {
    console.warn(`skipped (missing): ${target.file}`);
    continue;
  }

  const original = fs.readFileSync(target.file);
  const meta = await sharp(original).metadata();

  // Never upscale: an image already smaller than the target is left alone.
  if (meta.width <= target.width) {
    console.log(`${path.basename(target.file)}: already ${meta.width}px wide — left as is`);
    before += original.length;
    after += original.length;
    continue;
  }

  const output = await target
    .encode(sharp(original).resize({ width: target.width, withoutEnlargement: true }))
    .toBuffer();

  // Only replace if it is actually smaller; recompression can go the wrong way.
  if (output.length >= original.length) {
    console.log(`${path.basename(target.file)}: recompressed larger — kept the original`);
    before += original.length;
    after += original.length;
    continue;
  }

  fs.writeFileSync(target.file, output);
  before += original.length;
  after += output.length;
  console.log(
    `${path.basename(target.file)}: ${meta.width}px ${kb(original.length)}KB → ` +
      `${target.width}px ${kb(output.length)}KB`
  );
}

console.log(`\nTotal: ${kb(before)}KB → ${kb(after)}KB (${kb(before - after)}KB less to download)`);
