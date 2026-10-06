/**
 * Geometry checks for the camera section.
 *
 * The morph and the clip stepping need a browser to watch, but the numbers that
 * decide where the screen sits and whether a finger can land on a button do
 * not. Run with:  npm run check:camera
 *
 * The interesting assertions are the hit-target ones. The brief was that the
 * targets be invisible and much larger than the controls they stand for, so a
 * viewer who misses still hits — which is exactly the change that quietly makes
 * a decorative button steal a click. These tests are what stop that.
 */

import assert from "node:assert/strict";
import {
  DECORATIVE,
  FRAME,
  GLASS,
  HIT,
  MAX_RIG_VH,
  MORPH_START_VH,
  PHASE,
  SCROLL_PLAN,
  TIMELINE_VH,
  MIN_CAMERA_W,
  MIN_TOUCH_PX,
  SCREEN,
  SHELL,
  contains,
  discBounds,
  overlaps,
  scaledTo,
  type Rect,
} from "../lib/camera/geometry.ts";

let passed = 0;
const test = (name: string, fn: () => void) => {
  fn();
  passed++;
  console.log(`  ok  ${name}`);
};

const frameRect: Rect = { x: FRAME.x, y: FRAME.y, w: FRAME.w, h: FRAME.h };

console.log("\ncamera geometry\n");

test("the shell sits inside the frame", () => {
  assert.ok(contains(frameRect, SHELL), "shell escapes the frame");
});

test("the frame leaves room for the strap lugs on both sides", () => {
  // Lugs reach x=233 and x=1287 in the photograph. Cropping to the shell would
  // slice them; the frame must clear both.
  assert.ok(FRAME.x <= 233, `frame starts at ${FRAME.x}, left lug at 233`);
  assert.ok(
    FRAME.x + FRAME.w >= 1287,
    `frame ends at ${FRAME.x + FRAME.w}, right lug at 1287`,
  );
});

test("the screen sits inside the shell", () => {
  assert.ok(contains(SHELL, SCREEN), "screen escapes the shell");
});

test("the screen is 3:2, so clips must be cropped not letterboxed", () => {
  const ratio = SCREEN.w / SCREEN.h;
  assert.ok(
    Math.abs(ratio - 1.5) < 0.05,
    `screen is ${ratio.toFixed(3)}:1, expected ~1.5`,
  );
  assert.ok(
    Math.abs(ratio - 16 / 9) > 0.2,
    "screen is 16:9 after all — revisit the cover-crop decision",
  );
});

test("clips fill the panel, not the off-centre glass", () => {
  /*
   * Why SCREEN is the panel and not GLASS. The active LCD is not centred in its
   * own panel, so rendering to it looks like a positioning bug even though it
   * is anatomically right. If someone ever "corrects" SCREEN back to the glass,
   * this fails and says why.
   */
  assert.ok(contains(SCREEN, GLASS), "the glass should sit inside the panel");
  const left = GLASS.x - SCREEN.x;
  const right = SCREEN.x + SCREEN.w - (GLASS.x + GLASS.w);
  assert.ok(
    left > right * 2,
    `glass borders are ${left} left / ${right} right — if these evened out, ` +
      "the glass would be a defensible render target again",
  );
  assert.deepEqual(
    { x: SCREEN.x, y: SCREEN.y },
    { x: 334, y: 397 },
    "SCREEN is no longer the panel",
  );
});

test("the open target covers the whole clip", () => {
  /*
   * It yielded a sliver to the previous-clip target while stepping lived on the
   * wheel. That target is gone, so anything less than the whole panel now is an
   * oversight rather than a trade.
   */
  assert.deepEqual(HIT.open, SCREEN, "open no longer matches the clip exactly");
});

test("every hit target sits inside the shell", () => {
  for (const [name, r] of Object.entries(HIT)) {
    assert.ok(contains(SHELL, r), `${name} escapes the shell`);
  }
});

test("no two hit targets overlap each other", () => {
  const entries = Object.entries(HIT);
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const [an, a] = entries[i];
      const [bn, b] = entries[j];
      assert.ok(!overlaps(a, b), `${an} overlaps ${bn}`);
    }
  }
});

test("no hit target swallows a decorative control", () => {
  for (const [cn, disc] of Object.entries(DECORATIVE)) {
    const box = discBounds(disc);
    for (const [hn, hit] of Object.entries(HIT)) {
      assert.ok(!overlaps(hit, box), `${hn} target covers the ${cn} button`);
    }
  }
});

test("every hit target clears the touch minimum at the smallest camera", () => {
  for (const [name, r] of Object.entries(HIT)) {
    const w = scaledTo(r.w, MIN_CAMERA_W);
    const h = scaledTo(r.h, MIN_CAMERA_W);
    assert.ok(
      w >= MIN_TOUCH_PX,
      `${name} is ${w.toFixed(1)}px wide at ${MIN_CAMERA_W}px, need ${MIN_TOUCH_PX}`,
    );
    assert.ok(
      h >= MIN_TOUCH_PX,
      `${name} is ${h.toFixed(1)}px tall at ${MIN_CAMERA_W}px, need ${MIN_TOUCH_PX}`,
    );
  }
});

test("the whole camera is on screen before a stroke is drawn", () => {
  /*
   * The regression this exists to prevent: drawing that plays out below the
   * fold. The stage is sticky and centred, so with the section's top sitting
   * `drawEnterPct` down the viewport, the camera's centre is half a viewport
   * lower again. Its bottom edge must still be above the fold, or the viewer
   * arrives to a drawing that already happened.
   */
  const top = SCROLL_PLAN.drawEnterPct / 100;
  const cameraBottom = top + 0.5 + MAX_RIG_VH / 2;
  assert.ok(
    cameraBottom <= 1,
    `camera bottom sits at ${cameraBottom.toFixed(3)} viewports when drawing starts; must be <= 1`,
  );
});

test("the drawing finishes before the morph begins", () => {
  assert.equal(
    MORPH_START_VH,
    SCROLL_PLAN.drawVh - SCROLL_PLAN.drawEnterPct,
    "morph start has drifted from the end of the draw",
  );
  assert.ok(MORPH_START_VH > 0, "the draw would still be running at morph start");
});

test("the phases run in order and cover the timeline", () => {
  const order = [
    ["draw", PHASE.draw],
    ["morph", PHASE.morph],
    ["hold", PHASE.hold],
    ["unmorph", PHASE.unmorph],
    ["undraw", PHASE.undraw],
    ["end", PHASE.end],
  ] as const;
  for (let i = 1; i < order.length; i++) {
    assert.ok(
      order[i][1] > order[i - 1][1],
      `${order[i][0]} does not come after ${order[i - 1][0]}`,
    );
  }
  assert.equal(PHASE.end, TIMELINE_VH, "the timeline does not end at its end");
});

test("the section is long enough for every phase plus the tail", () => {
  /*
   * The camera is sticky for (sectionVh - 100) viewports — the section's height
   * less the one viewport the stage itself occupies. Everything from the first
   * stroke to the last must fit inside that, or the section releases mid-exit
   * and the camera is dragged off screen still half-drawn.
   */
  const sticky = SCROLL_PLAN.sectionVh - 100;
  const needed = TIMELINE_VH - SCROLL_PLAN.drawEnterPct + SCROLL_PLAN.tailVh;
  assert.ok(
    sticky >= needed,
    `section gives ${sticky}vh of stick but the phases need ${needed}vh`,
  );
});

test("the exit reads as the entry reversed", () => {
  /*
   * Bounded both ways rather than capped at the entry's length. The exit is
   * deliberately the slower of the two — it reads quicker than it measures,
   * because you are already scrolling when it starts — but let it drift far
   * enough either side and it stops being the entry reversed and becomes a
   * different animation that happens to run backwards.
   */
  const morphRatio = SCROLL_PLAN.unmorphVh / SCROLL_PLAN.morphVh;
  const drawRatio = SCROLL_PLAN.undrawVh / SCROLL_PLAN.drawVh;
  for (const [name, ratio] of [
    ["morph", morphRatio],
    ["draw", drawRatio],
  ] as const) {
    assert.ok(
      ratio >= 0.6 && ratio <= 1.6,
      `the exit ${name} is ${ratio.toFixed(2)}x its entry; outside 0.6-1.6 it ` +
        "no longer mirrors the way in",
    );
  }
});

test("the hold is long enough to use the camera in", () => {
  assert.ok(
    SCROLL_PLAN.holdVh >= 60,
    `only ${SCROLL_PLAN.holdVh}vh of hold; the camera is clickable for a blink`,
  );
});

test("the asset script crops to the same frame this module declares", async () => {
  const src = await import("node:fs").then((fs) =>
    fs.readFileSync(new URL("./camera.assets.mts", import.meta.url), "utf8"),
  );
  const m = src.match(
    /FRAME\s*=\s*\{\s*x:\s*(-?\d+),\s*y:\s*(-?\d+),\s*w:\s*(\d+),\s*h:\s*(\d+)/,
  );
  assert.ok(m, "could not find FRAME in scripts/camera.assets.mts");
  const [x, y, w, h] = m.slice(1, 5).map(Number);
  assert.deepEqual(
    { x, y, w, h },
    { x: FRAME.x, y: FRAME.y, w: FRAME.w, h: FRAME.h },
    "the asset crop and the layout frame have drifted apart",
  );
});

console.log(`\n  ${passed} checks passed\n`);
