/**
 * Re-encodes the still images in public/ so the static (GitHub Pages) build,
 * which cannot resize, ships fewer bytes.  Run: npm run optimize:images
 *
 * Paths and aspect ratios never change.  Files are only rewritten when the
 * result is smaller, so running it twice is harmless.  Widths are capped at
 * a little over 2x the largest size each folder is displayed at.
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "public");
const jpeg = (quality) => ({ quality, mozjpeg: true, progressive: true });
const folders = {
  showcase: { maxWidth: 720, ...jpeg(80) },
  reviews: { maxWidth: 960, ...jpeg(80) },
  wall: { maxWidth: 640, ...jpeg(78) },
  clips: { maxWidth: 1200, ...jpeg(78) },
  gallery: { maxWidth: 1600, ...jpeg(80) },
  hero: { maxWidth: 1920, ...jpeg(80) },
};

let before = 0, after = 0;
for (const [dir, o] of Object.entries(folders)) {
  for (const f of (await readdir(path.join(root, dir))).filter((n) => n.endsWith(".jpg"))) {
    const p = path.join(root, dir, f);
    const src = await readFile(p);
    const out = await sharp(src).rotate().resize({ width: o.maxWidth, withoutEnlargement: true })
      .jpeg({ quality: o.quality, mozjpeg: true, progressive: true }).toBuffer();
    before += src.length;
    if (out.length < src.length) { await writeFile(p, out); after += out.length; } else after += src.length;
  }
}
// The camera is a keyed cut-out with soft edges: a 256-colour palette PNG keeps the alpha.
const cam = path.join(root, "camera/a6700.png");
const csrc = await readFile(cam);
const cout = await sharp(csrc).png({ palette: true, quality: 90, effort: 10, colours: 256, dither: 0.5 }).toBuffer();
before += csrc.length;
if (cout.length < csrc.length) { await writeFile(cam, cout); after += cout.length; } else after += csrc.length;
console.log(`images: ${before} -> ${after} bytes`);
