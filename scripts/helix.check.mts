/**
 * Geometry checks for the spiral staircase showcase.
 *
 * The motion itself needs a rendering browser to observe, but the maths that
 * decides where every step lands does not. Run with:  npm run check:helix
 *
 * The file is in two halves. The first tests the geometry in the abstract; the
 * second reads the real numbers back out of components/home/Showcase.tsx and
 * asserts the arrangement they actually produce, because the bugs this section
 * has had were never in the maths — they were in the arrangement fed to it.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  HELIX_BACK_OPACITY,
  HELIX_COPY_BACK_OPACITY,
  HELIX_DEPTH,
  HELIX_TILT,
  fade,
  helixLayout,
  helixTheta,
  maxCardEdge,
  maxExtentFactor,
  placeOnHelix,
  radiusForViewport,
  scaleAtMaxExtent,
} from "../lib/motion/helix.ts";

const near = (a: number, b: number, tol = 1e-6) =>
  assert.ok(Math.abs(a - b) <= tol, `expected ${a} to be within ${tol} of ${b}`);

let passed = 0;
const test = (name: string, fn: () => void) => {
  fn();
  passed++;
  console.log(`  ok  ${name}`);
};

const R = 400;

console.log("\norbit geometry\n");

test("front of the orbit is centred, largest, fully opaque, on top", () => {
  const p = placeOnHelix(0, R);
  near(p.x, 0);
  near(p.depth, 1);
  near(p.scale, 1 / (1 - HELIX_DEPTH));
  near(p.opacity, 1);
  assert.equal(p.zIndex, 1000);
});

test("back of the orbit is centred, smallest, dimmest, behind", () => {
  const p = placeOnHelix(Math.PI, R);
  near(p.x, 0, 1e-9);
  near(p.depth, -1);
  near(p.scale, 1 / (1 + HELIX_DEPTH));
  near(p.opacity, HELIX_BACK_OPACITY);
  assert.equal(p.zIndex, 0);
});

test("the sides sit at exactly ±radius with no perspective distortion", () => {
  const right = placeOnHelix(Math.PI / 2, R);
  const left = placeOnHelix((3 * Math.PI) / 2, R);
  near(right.x, R, 1e-9);
  near(left.x, -R, 1e-9);
  near(right.scale, 1);
  near(right.opacity, HELIX_BACK_OPACITY + (1 - HELIX_BACK_OPACITY) / 2);
});

test("scale rises monotonically as a step comes toward the viewer", () => {
  let prev = -Infinity;
  for (let i = 0; i <= 200; i++) {
    const p = placeOnHelix(Math.PI * (1 - i / 200), R);
    assert.ok(p.scale > prev, `scale went backwards at step ${i}`);
    prev = p.scale;
  }
});

test("z-index ordering always matches depth ordering", () => {
  const samples = Array.from({ length: 360 }, (_, deg) =>
    placeOnHelix((deg * Math.PI) / 180, R),
  );
  const byDepth = [...samples].sort((a, b) => a.depth - b.depth);
  for (let i = 1; i < byDepth.length; i++) {
    assert.ok(
      byDepth[i].zIndex >= byDepth[i - 1].zIndex,
      "a nearer step was given a lower z-index than a further one",
    );
  }
});

test("widest reach is at cos θ = depth, not at θ = 90°", () => {
  let max = -Infinity;
  let atTheta = 0;
  for (let i = 0; i < 100000; i++) {
    const theta = (i / 100000) * Math.PI * 2;
    const x = Math.abs(placeOnHelix(theta, R).x);
    if (x > max) {
      max = x;
      atTheta = theta;
    }
  }
  near(max / R, maxExtentFactor(), 1e-4);
  near(Math.cos(atTheta), HELIX_DEPTH, 1e-3);
  assert.ok(max > R, "max extent should exceed the radius");
});

test("copy fades on a higher floor than its picture, from the same depth", () => {
  /*
   * A step's copy and its picture are one object in space: same angle, same
   * scale. The only thing that separates them is how far each is allowed to
   * fade, and the copy has to stay readable at the back of the turn.
   */
  assert.ok(
    HELIX_COPY_BACK_OPACITY > HELIX_BACK_OPACITY,
    "the copy floor is not above the picture floor",
  );
  for (let deg = 0; deg < 360; deg++) {
    const d = Math.cos((deg * Math.PI) / 180);
    assert.ok(fade(d, HELIX_COPY_BACK_OPACITY) >= fade(d), "copy fades faster");
    assert.ok(
      fade(d, HELIX_COPY_BACK_OPACITY) >= HELIX_COPY_BACK_OPACITY - 1e-9,
      `copy fell to ${fade(d, HELIX_COPY_BACK_OPACITY).toFixed(3)}`,
    );
  }
  near(fade(1), 1);
  near(fade(-1), HELIX_BACK_OPACITY);
});

console.log("\nmaxCardEdge — closed form vs brute force\n");

test("analytic worst case matches an exhaustive scan", () => {
  for (const [radius, width] of [
    [400, 330],
    [66, 180],
    [900, 420],
    [0, 200],
    [120, 140],
  ]) {
    let scanned = 0;
    for (let i = 0; i < 200000; i++) {
      const theta = (i / 200000) * Math.PI * 2;
      const p = placeOnHelix(theta, radius);
      scanned = Math.max(scanned, Math.abs(p.x) + (width / 2) * p.scale);
    }
    near(maxCardEdge(radius, width), scanned, 0.01);
  }
});

test("regression: summing the separate maxima UNDER-estimates the worst case", () => {
  /*
   * This is the bug that clipped steps at 375px.
   *
   * The first attempt bounded the outer edge as
   *   radius · maxExtentFactor + halfStep · scaleAtMaxExtent
   * i.e. the centre's furthest reach plus the half-width at that same angle.
   * But the true maximum of the combined expression sits at a *third* angle,
   * nearer the front, where the perspective scale is larger — so the naive
   * figure comes out too small, the derived radius too big, and steps push
   * past the screen edge.
   *
   * Asserting the direction, so nobody "simplifies" it back later.
   */
  const width = 330;
  const naive = R * maxExtentFactor() + (width / 2) * scaleAtMaxExtent();
  const truth = maxCardEdge(R, width);

  assert.ok(
    truth > naive,
    `expected the naive bound (${naive.toFixed(1)}) to fall short of the ` +
      `true worst case (${truth.toFixed(1)})`,
  );
});

console.log("\nradius derivation — steps reach the edges, never past them\n");

/*
 * The step sizes from Showcase.module.css.
 *
 * Every step rides the orbit on its own centre, whichever kind it is, so the
 * only thing containment has to fit is the widest single step. There is no
 * lever arm any more — a note is a step of its own rather than something
 * carried beside a picture — which is why the perspective could be handed back
 * the depth that arm used to cost.
 */
const clamp = (lo: number, mid: number, hi: number) =>
  Math.min(Math.max(lo, mid), hi);

const PIC_W = (vw: number) =>
  vw <= 900 ? clamp(105, vw * 0.308, 210) : clamp(105, vw * 0.182, 301);

const COPY_W = (vw: number) =>
  vw <= 900 ? clamp(150, vw * 0.4, 280) : clamp(150, vw * 0.22, 360);

/** The widest step — what the orbit is sized on. */
const STEP_W = (vw: number) => Math.max(PIC_W(vw), COPY_W(vw));

for (const vw of [375, 414, 768, 900, 1280, 1440, 1920, 2560]) {
  test(`viewport ${vw}px: the widest step lands on its target`, () => {
    const width = STEP_W(vw);
    const { radius, bleed } = helixLayout(vw, width);

    let worst = 0;
    for (let i = 0; i < 20000; i++) {
      const theta = (i / 20000) * Math.PI * 2;
      const p = placeOnHelix(theta, radius);
      worst = Math.max(worst, Math.abs(p.x) + (width / 2) * p.scale);
    }

    const target = (vw / 2) * bleed;
    assert.ok(
      Math.abs(worst - target) <= 0.5,
      `edge landed at ${worst.toFixed(1)}px, wanted ${target.toFixed(1)}px`,
    );
    // The orbit has to be worth animating.
    assert.ok(radius > 40, `radius ${radius.toFixed(1)}px is too tight to read`);
  });
}

test("a step at the front of the orbit still fits the screen", () => {
  /*
   * Perspective multiplies the step, so a step wide enough at rest can still
   * be too wide at the front — and when it is, there is no radius that rescues
   * it: radiusForViewport returns 0 and the staircase collapses onto the axis.
   * This is the guard that kept the depth honest while a note was carried
   * beside its picture, and it is still what bounds how far the depth can go.
   */
  for (const vw of [375, 768, 1024, 1280, 1920, 2560]) {
    const front = STEP_W(vw) / (1 - HELIX_DEPTH);
    const bleed = vw < 900 ? 1.35 : 1;
    assert.ok(
      front <= vw * bleed,
      `at ${vw}px the front step reaches ${Math.round(front)}px, past the ` +
        `${Math.round(vw * bleed)}px it is allowed`,
    );
  }
});

test("a note and a picture at the same angle land in exactly the same place", () => {
  /*
   * The requirement that the copy follow the same path as the images, asserted
   * as the identity it actually is: the geometry takes no argument for which
   * kind of step it is placing, so two steps at one angle are one point. If a
   * per-kind depth or plane is ever reintroduced, the two paths separate and
   * this is what says so.
   */
  for (let deg = 0; deg < 360; deg += 7) {
    const theta = (deg * Math.PI) / 180;
    const a = placeOnHelix(theta, R);
    const b = placeOnHelix(theta, R);
    near(a.x, b.x, 1e-12);
    near(a.scale, b.scale, 1e-12);
    assert.equal(a.zIndex, b.zIndex);
  }
  /*
   * The one thing that IS allowed to differ between them: how far each fades.
   * Words may not recede into the dark the way an image is allowed to.
   */
  assert.ok(HELIX_COPY_BACK_OPACITY > HELIX_BACK_OPACITY);
});

test("narrow viewports are allowed to bleed, wide ones are not", () => {
  assert.equal(helixLayout(375, STEP_W(375)).bleed, 1.35);
  assert.equal(helixLayout(1280, STEP_W(1280)).bleed, 1);
});

test("radius never goes negative when a step is wider than the screen", () => {
  assert.equal(radiusForViewport(320, 900), 0);
});

test("closed forms match their definitions", () => {
  near(maxExtentFactor(0.45), 1 / Math.sqrt(1 - 0.45 ** 2));
  near(scaleAtMaxExtent(0.45), 1 / (1 - 0.45 ** 2));
  near(maxExtentFactor(0), 1);
  near(scaleAtMaxExtent(0), 1);
});

console.log("\nthe staircase itself — read out of the component\n");

/*
 * Everything below reads the real dials and the real STEPS array out of
 * Showcase.tsx. No fixture: a hand-copied one drifts, and this file spent two
 * windings testing a ladder the component had already stopped having.
 */
const showcase = readFileSync(
  new URL("../components/home/Showcase.tsx", import.meta.url),
  "utf8",
);

const stepsStart = showcase.indexOf("const STEPS: Step[] = [");
const stepsBlock = showcase.slice(
  stepsStart,
  showcase.indexOf("\n];", stepsStart),
);
/* The kinds, in order, exactly as the component declares them. */
const KINDS = [...stepsBlock.matchAll(/kind:\s*"(picture|note)"/g)].map(
  (m) => m[1],
);

const num = (name: string) => {
  const m = showcase.match(new RegExp(`const ${name} = (-?[\\d.]+);`));
  assert.ok(m, `could not read ${name} out of Showcase.tsx`);
  return Number(m[1]);
};

const COUNT = KINDS.length;
const TURNS = num("TURNS");
const WIND = num("WIND");
const PHASE_DEG = num("PHASE_DEG");
const SPIN_TURNS = num("SPIN_TURNS");
const STEP_ANGLE = (WIND * Math.PI * 2 * TURNS) / (COUNT - 1);
const PHASE = (PHASE_DEG * Math.PI) / 180;

/** Every step's resting angle, exactly as the component computes it. */
const restingAngles = Array.from(
  { length: COUNT },
  (_, i) => PHASE + i * STEP_ANGLE,
);

test("ten steps alternating, a picture first, copy on every second one", () => {
  assert.ok(COUNT > 0, "could not read STEPS out of Showcase.tsx");
  assert.equal(COUNT, 10, `there are ${COUNT} steps, not ten`);
  KINDS.forEach((kind, i) => {
    const want = i % 2 === 0 ? "picture" : "note";
    assert.equal(
      kind,
      want,
      `step ${i + 1} is a ${kind}, breaking the alternation — the copy takes ` +
        "every second step starting from the second",
    );
  });
  assert.equal(KINDS.filter((k) => k === "picture").length, 5);
  assert.equal(KINDS.filter((k) => k === "note").length, 5);
});

test("the first step faces the viewer square on, at the front", () => {
  /*
   * The arrangement the section is read from: the first step dead centre, its
   * copy just left of the centre line and its picture just right of it. sin is
   * zero here so there is no tangential turn on it either, which is what lets
   * the rotation start from rest rather than partway through a swing.
   */
  const p = placeOnHelix(restingAngles[0], R);
  near(p.x, 0, 1e-9);
  near(p.depth, 1);
  near(p.scale, 1 / (1 - HELIX_DEPTH));
  near(p.opacity, 1);
  near(Math.sin(restingAngles[0]) * HELIX_TILT, 0, 1e-9);
});

test("the staircase treads to the side it is wound, step after step", () => {
  /*
   * Requirement four and five: each step further round than the last, in one
   * direction, so it reads as a stair rather than a scatter. Asserted on the
   * ANGLE, not on x — a spiral's x turns back once it passes the side of the
   * orbit, and that turning back is the spiral working, not the stair
   * breaking. What must never happen is a step doubling back on the winding.
   */
  for (let i = 1; i < COUNT; i++) {
    /* Positive means "further along the way it is wound", for either sign. */
    const advance = (restingAngles[i] - restingAngles[i - 1]) * WIND;
    assert.ok(advance > 0, `step ${i + 1} treads back against the winding`);
    near(restingAngles[i] - restingAngles[i - 1], STEP_ANGLE, 1e-9);
  }
});

test("the first steps tread left before the spiral carries them round", () => {
  /*
   * The visible part of requirement five. The staircase is a spiral, so it
   * cannot step left for ever — it would walk off the screen — but the run it
   * opens on has to read that way, or the arrangement does not announce
   * itself. Three steps of unambiguous travel is the floor.
   */
  const x = restingAngles.map((theta) => placeOnHelix(theta, R).x);
  const travelled = x.findIndex((_, i) => i > 0 && x[i] >= x[i - 1]);
  const leftRun = travelled === -1 ? COUNT : travelled;
  assert.ok(
    leftRun >= 3,
    `only ${leftRun} steps tread left before turning back — TURNS is too high`,
  );
  assert.ok(x[1] < x[0], "the second step is not left of the first");
});

test("the whole staircase covers the winding it advertises", () => {
  /*
   * Dividing the winding by COUNT - 1 rather than COUNT is what makes the last
   * step land exactly TURNS revolutions along. By COUNT it stops one step
   * short, which is a quiet way to end up with a different spiral than the one
   * the constant claims.
   */
  const swept = Math.abs(restingAngles[COUNT - 1] - restingAngles[0]);
  near(swept, Math.PI * 2 * TURNS, 1e-9);
});

test("no two steps share an angle", () => {
  /*
   * A winding that divides evenly makes steps repeat: two of them at the exact
   * same offset and scale, one directly behind the other, which reads as a
   * rendering fault rather than a spiral.
   */
  const seen = new Set<number>();
  for (const theta of restingAngles) {
    const deg = Math.round((((theta * 180) / Math.PI) % 360) + 360) % 360;
    assert.ok(!seen.has(deg), `steps collide at ${deg}°`);
    seen.add(deg);
  }
});

test("scroll turns the staircase as one rigid body", () => {
  /*
   * The spiral only survives if every step takes the SAME angular offset.
   * Anything per-index here (a spin scaled by depth, say) shears it apart, and
   * a step's copy would leave its picture behind.
   */
  for (const t of [0, 0.17, 0.5, 0.93, 1]) {
    for (let i = 1; i < COUNT; i++) {
      const a = helixTheta(restingAngles[i - 1], t, SPIN_TURNS);
      const b = helixTheta(restingAngles[i], t, SPIN_TURNS);
      near(b - a, STEP_ANGLE, 1e-9);
    }
  }
});

test("a whole revolution ends on the arrangement it started from", () => {
  /*
   * What makes the spin safe to have at all. The resting arrangement belongs
   * to a single angle, and only a whole number of turns brings every step back
   * to it, so the section opens and closes on the same weave. A fractional
   * spin leaves it closing on some other angle entirely.
   */
  assert.ok(
    Number.isInteger(SPIN_TURNS),
    `the spin is ${SPIN_TURNS} turns — it has to be a whole number of them`,
  );
  for (const theta of restingAngles) {
    const start = placeOnHelix(helixTheta(theta, 0, SPIN_TURNS), R);
    const end = placeOnHelix(helixTheta(theta, 1, SPIN_TURNS), R);
    near(end.x, start.x, 1e-6);
    near(end.scale, start.scale, 1e-9);
    assert.equal(end.zIndex, start.zIndex);
  }
});

test("the near face travels left to right", () => {
  /*
   * Which way the rotation reads, taken off the front of the orbit where the
   * eye actually follows it. A step at the front moves toward +x as the scroll
   * advances; the far side is going the other way at the same time, but it is
   * small and dim and nobody reads the direction off it.
   */
  const front = 0;
  const nudged = placeOnHelix(helixTheta(front, 0.02, SPIN_TURNS), R).x;
  assert.ok(
    nudged > 0,
    `the front of the staircase moves to ${nudged.toFixed(1)} — right to left`,
  );
});

test("steps stay inside the viewport at every point of the turn", () => {
  /*
   * The radius checks above only prove the *worst* angle fits. Scroll drags
   * every step through every angle, so this walks the whole turn and asserts
   * the bound holds throughout.
   */
  for (const vw of [375, 768, 1280, 1920]) {
    const width = STEP_W(vw);
    const { radius, bleed } = helixLayout(vw, width);
    const target = (vw / 2) * bleed;

    for (let n = 0; n <= 400; n++) {
      const t = n / 400;
      for (let i = 0; i < COUNT; i++) {
        const p = placeOnHelix(
          helixTheta(restingAngles[i], t, SPIN_TURNS),
          radius,
        );
        const edge = Math.abs(p.x) + (width / 2) * p.scale;
        assert.ok(
          edge <= target + 0.5,
          `vw ${vw}, t ${t.toFixed(2)}, step ${i + 1}: edge ` +
            `${edge.toFixed(1)}px past target ${target.toFixed(1)}px`,
        );
      }
    }
  }
});

test("the copy never recedes out of legibility, at any point of the turn", () => {
  for (let n = 0; n <= 200; n++) {
    const t = n / 200;
    for (const theta of restingAngles) {
      const p = placeOnHelix(helixTheta(theta, t, SPIN_TURNS), R);
      const copy = fade(p.depth, HELIX_COPY_BACK_OPACITY);
      assert.ok(
        copy >= HELIX_COPY_BACK_OPACITY - 1e-9,
        `copy faded to ${copy.toFixed(2)}`,
      );
      assert.ok(p.scale > 0.7, `a step shrank to ${p.scale.toFixed(2)}`);
    }
  }
});

test("the tangential turn stays readable — never edge-on", () => {
  assert.ok(
    HELIX_TILT > 0 && HELIX_TILT < 45,
    "the turn is meant to be a hint of a cylinder, not a card flip",
  );
});

console.log(`\n${passed} checks passed\n`);
