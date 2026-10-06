/**
 * Builds the camera section's photograph from the reference image.
 *
 * Run with:  npm run build:camera
 *
 * Nothing here runs at request time — this writes a file into public/ and is
 * committed so the derivation is reproducible rather than a one-off nobody can
 * repeat. Re-run it if the reference photo is replaced.
 *
 *   public/camera/a6700.png   the reference, background keyed out, cropped
 *                             to FRAME so it registers 1:1 with the outline
 *
 * It used to write seven placeholder slides as well. The screen now shows the
 * real clips, which are listed in lib/camera/clips.ts and live in public/clips.
 */

import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = path.join(root, "assets/Images/sony a6700.webp");
const OUT = path.join(root, "public/camera");

/**
 * The shared coordinate box, duplicated from lib/camera/geometry.ts.
 *
 * Not imported: this script runs under bare node with type stripping, and
 * pulling in a module from the app tree drags its own imports along with it.
 * The camera geometry check asserts the two stay in agreement.
 */
const FRAME = { x: 225, y: 238, w: 1075, h: 596 };

/** Strap-lug holes. Enclosed by metal, so a border flood never reaches them. */
const LUG_HOLES = [
  { x: 252, y: 305 },
  { x: 1268, y: 346 },
];

/*
 * Anything at or above this luminance, reachable from the frame edge, is
 * background. A flat threshold cannot be used instead: the printed labels
 * (MENU, AF-ON, ISO) and the lug metal are near-white too, and a flat cut
 * would punch holes straight through them. Reachability is what separates
 * "white backdrop" from "white thing on the camera".
 */
const BG_LUMA = 246;
/** Luminance at which a pixel is fully opaque. Between the two, alpha ramps. */
const EDGE_LUMA = 232;

/**
 * Gaussian sigma applied to the alpha channel only. Enough to take the stamped
 * edge off the silhouette without visibly eroding the body — the camera stays
 * sharp, its outline does not.
 */
const EDGE_FEATHER = 2.2;

/** The page colour keyed pixels are repainted to. Matches --ink in globals.css. */
const INK = [10, 10, 9] as const;

async function keyBackground() {
  const { data, info } = await sharp(SOURCE)
    .flatten({ background: "#ffffff" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width: W, height: H, channels: C } = info;
  const luma = (i: number) =>
    0.299 * data[i * C] + 0.587 * data[i * C + 1] + 0.114 * data[i * C + 2];

  // Flood the background inward from every frame edge, plus the two lug holes.
  const isBg = new Uint8Array(W * H);
  const stack: number[] = [];
  for (let x = 0; x < W; x++) stack.push(x, (H - 1) * W + x);
  for (let y = 0; y < H; y++) stack.push(y * W, y * W + W - 1);
  for (const { x, y } of LUG_HOLES) stack.push(y * W + x);

  while (stack.length) {
    const i = stack.pop()!;
    if (isBg[i] || luma(i) < BG_LUMA) continue;
    isBg[i] = 1;
    const x = i % W;
    const y = (i - x) / W;
    if (x > 0) stack.push(i - 1);
    if (x < W - 1) stack.push(i + 1);
    if (y > 0) stack.push(i - W);
    if (y < H - 1) stack.push(i + W);
  }

  /*
   * Ramp the alpha across the last few luminance steps rather than cutting it
   * to zero. On its own this is still barely a pixel wide — the real softening
   * is the alpha blur below.
   *
   * The colour under a keyed pixel is repainted to the page's ink first. It is
   * white in the source, and white is exactly the wrong thing to leave beneath
   * a soft edge: feathering would smear a bright halo all the way around the
   * camera. Nobody sees these pixels at full transparency, but every one of
   * them shows through once the edge is feathered.
   */
  const span = BG_LUMA - EDGE_LUMA;
  for (let i = 0; i < W * H; i++) {
    if (!isBg[i]) continue;
    const a = Math.round(((BG_LUMA - luma(i)) / span) * 255);
    data[i * C + 3] = Math.max(0, Math.min(255, a));
    data[i * C] = INK[0];
    data[i * C + 1] = INK[1];
    data[i * C + 2] = INK[2];
  }

  const cropped = sharp(Buffer.from(data), {
    raw: { width: W, height: H, channels: C },
  }).extract({ left: FRAME.x, top: FRAME.y, width: FRAME.w, height: FRAME.h });

  /*
   * Soften the silhouette. A cut-out with a hard matte reads as pasted onto the
   * page — the corners in particular look stamped out. Blurring the alpha alone
   * (not the colour) keeps the camera itself sharp while giving its edge a few
   * pixels of falloff, which is what makes it sit on the background instead of
   * on top of it.
   */
  const rgb = await cropped.clone().removeAlpha().raw().toBuffer();
  const alpha = await cropped
    .clone()
    .extractChannel(3)
    .blur(EDGE_FEATHER)
    .raw()
    .toBuffer();

  await sharp(rgb, { raw: { width: FRAME.w, height: FRAME.h, channels: 3 } })
    .joinChannel(alpha, {
      raw: { width: FRAME.w, height: FRAME.h, channels: 1 },
    })
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUT, "a6700.png"));

  const kept = isBg.reduce((n, v) => n + v, 0);
  console.log(
    `  ok  a6700.png  ${FRAME.w}x${FRAME.h}  (${((100 * kept) / (W * H)).toFixed(1)}% keyed out)`,
  );
}

console.log("\ncamera assets\n");
await mkdir(OUT, { recursive: true });
await keyBackground();
console.log("\n  written to public/camera\n");
