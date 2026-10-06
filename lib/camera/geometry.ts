/**
 * Traced geometry of the camera, in the reference photograph's own pixel space.
 *
 * Everything in the section derives from this file: the outline SVG's viewBox,
 * the cropped photo, the screen overlay and the interactive hit targets. That
 * is the whole point — the outline was traced from the photo at 1:1, so as long
 * as all four read their numbers from here they register exactly and the
 * outline-to-photo morph needs no alignment fudging.
 *
 * Numbers came from measuring assets/Images/sony a6700.webp (1534 x 1083):
 * silhouette scans for the shell, luminance-gradient profiles for the seams and
 * control edges. scripts/camera.check.mts asserts the relationships still hold.
 */

/** A box in frame coordinates. */
export type Rect = { x: number; y: number; w: number; h: number };
/** A circular control in frame coordinates. */
export type Disc = { cx: number; cy: number; r: number };

/**
 * The shared box. Wider than the shell (269…1247) on purpose: the strap lugs
 * stick out past both sides in the photograph, and cropping to the shell would
 * slice them off mid-lug. The outline simply draws nothing out here.
 *
 * scripts/camera.assets.mts crops the photo to exactly this, and CameraOutline
 * overrides the standalone SVG's tighter viewBox with it.
 */
export const FRAME = { x: 225, y: 238, w: 1075, h: 596 } as const;

export const VIEW_BOX = `${FRAME.x} ${FRAME.y} ${FRAME.w} ${FRAME.h}`;

/** The shell itself, for containment assertions. */
export const SHELL: Rect = { x: 269, y: 262, w: 978, h: 559 };

/**
 * Where clips render: the whole screen panel, edge to edge.
 *
 * NOT the glass below — that was the original choice and it looked broken. The
 * active LCD is not centred in its own panel (the tilt hinge takes room on the
 * left), so a clip drawn at GLASS sits inside borders of 78 left / 29 right and
 * 39 top / 31 bottom, and reads as shoved down and to the right even though it
 * is exactly where the real display is. Filling the panel puts the asymmetry
 * where nobody can see it.
 *
 * 618 x 414 is 1.49:1 — still 3:2, so the cover-crop reasoning is unchanged.
 */
export const SCREEN: Rect = { x: 334, y: 397, w: 618, h: 414 };

/**
 * The active LCD area inside SCREEN. Not used for layout — kept because it is
 * measured, and because the geometry check uses it to assert the reason we
 * render to the panel instead.
 */
export const GLASS: Rect = { x: 412, y: 436, w: 511, h: 344 };

/** Corner radius of the screen panel, in frame units. Matches the outline. */
export const PANEL_RADIUS = 11;

/** The control wheel. Traced, but no longer a control — see HIT below. */
export const WHEEL: Disc = { cx: 1076, cy: 633, r: 73 };

/**
 * Controls that stay decorative. Listed so the geometry check can prove the
 * enlarged hit targets never swallow one — a click landing on "previous"
 * because the target grew over the playback button would be indefensible.
 */
export const DECORATIVE: Record<string, Disc> = {
  /* The wheel is scenery now that stepping has moved off the camera. */
  wheel: WHEEL,
  afOn: { cx: 1016, cy: 413, r: 35 },
  fn: { cx: 1017, cy: 512, r: 26 },
  playback: { cx: 1048, cy: 763, r: 27 },
  trash: { cx: 1142, cy: 763, r: 26 },
};

/**
 * Narrowest the camera is ever rendered — 92vw on a 360px phone. Hit target
 * sizing is validated against this.
 */
export const MIN_CAMERA_W = 330;

/** The touch target minimum the targets are sized to clear. */
export const MIN_TOUCH_PX = 44;

/**
 * The one live region on the camera itself: the screen.
 *
 * Stepping used to live here too, as a pair of oversized targets over the
 * wheel's halves. Those are gone — the controls are now orange buttons beneath
 * the camera, where a button can be a button instead of an invisible rectangle
 * over a photograph of one. Their departure hands the clip back its last 21
 * units: `open` used to stop short of x=931 to leave the previous target room,
 * and can now cover the panel whole.
 */
export const HIT: Record<"open", Rect> = {
  open: { ...SCREEN },
};

/**
 * Largest fraction of the viewport height the camera is ever drawn at. Mirrors
 * the third term in `.rig`'s width in Camera.module.css, which caps the camera
 * against the viewport's *height* as well as its width — without that cap, a
 * short wide window renders a camera taller than the screen and no scroll
 * timing can make the whole of it visible at once.
 */
export const MAX_RIG_VH = 0.78;

/**
 * When each phase happens, in viewport heights of scroll.
 *
 * These live here rather than in the component because they are not free
 * choices: the stage is sticky and centred, so while the section is still
 * arriving the camera sits half a viewport *below* the section's top. Start the
 * drawing too early and it happens off-screen — which is exactly what "top 85%"
 * did, finishing the moment the camera landed centre-screen, so it could only
 * ever be arrived at already drawn. `drawEnterPct` is the latest of the four and
 * the one that matters; camera.check.mts asserts it leaves the whole camera on
 * screen before a single stroke is drawn.
 */
export const SCROLL_PLAN = {
  /** Section top's viewport position when drawing begins. Smaller = later. */
  drawEnterPct: 6,
  /** Scroll the drawing takes. Most of it lands after the section sticks. */
  drawVh: 60,
  /** Scroll the outline-to-photograph morph takes. */
  morphVh: 70,
  /**
   * Anchored and interactive. Nothing animates here.
   *
   * By far the longest phase, and deliberately so — it is the only stretch you
   * can actually use the camera in, and everything either side of it is just
   * arriving and leaving.
   */
  holdVh: 160,
  /**
   * The morph run backwards: photograph out, outline back.
   *
   * Longer than the entry morph, on purpose. The exit reads faster than it
   * measures — you are already moving when it starts, and the camera is leaving
   * something you were just using — so matching the entry's length made it feel
   * snatched away.
   */
  unmorphVh: 90,
  /** The drawing run backwards: strokes retract to nothing. */
  undrawVh: 78,
  /** Empty scroll after the camera has gone, before the section ends. */
  tailVh: 12,
  sectionVh: 570,
} as const;

/**
 * How far past the section sticking the drawing finishes: its length, less the
 * distance the section still had to travel when it started. Derived rather than
 * typed in, so the morph can never be tuned into starting before the drawing
 * has finished.
 */
export const MORPH_START_VH = SCROLL_PLAN.drawVh - SCROLL_PLAN.drawEnterPct;

/**
 * Phase boundaries as times on the single scrubbed timeline, in viewport
 * heights — the timeline is authored in vh so its time axis and the scroll
 * distance are the same numbers, and a phase can be read straight off the plan.
 *
 * One timeline, not five, and that is the important part. Entry and exit both
 * write opacity on the same photograph, outline and screen; as separate
 * ScrollTriggers they would each hold their own idea of those values at the
 * edges of their ranges and fight over them on any refresh or scroll jump. A
 * single timeline can only have one opinion.
 */
const P = SCROLL_PLAN;
export const PHASE = {
  draw: 0,
  morph: P.drawVh,
  hold: P.drawVh + P.morphVh,
  unmorph: P.drawVh + P.morphVh + P.holdVh,
  undraw: P.drawVh + P.morphVh + P.holdVh + P.unmorphVh,
  end: P.drawVh + P.morphVh + P.holdVh + P.unmorphVh + P.undrawVh,
} as const;

/** Total scroll the timeline is scrubbed across. */
export const TIMELINE_VH = PHASE.end;

/** Percentage box for CSS, relative to FRAME. */
export function asPercent(r: Rect) {
  return {
    left: `${((r.x - FRAME.x) / FRAME.w) * 100}%`,
    top: `${((r.y - FRAME.y) / FRAME.h) * 100}%`,
    width: `${(r.w / FRAME.w) * 100}%`,
    height: `${(r.h / FRAME.h) * 100}%`,
  };
}

/** Percentage box of `inner` relative to `outer`, both in frame coordinates. */
export function asPercentWithin(inner: Rect, outer: Rect) {
  return {
    left: `${((inner.x - outer.x) / outer.w) * 100}%`,
    top: `${((inner.y - outer.y) / outer.h) * 100}%`,
    width: `${(inner.w / outer.w) * 100}%`,
    height: `${(inner.h / outer.h) * 100}%`,
  };
}

/**
 * Elliptical radius keeping the panel's corners a true circle once the rect is
 * expressed in percentages — a single percentage would resolve against each
 * axis separately and go oval on a non-square box.
 */
export function panelRadius(r: Rect = SCREEN): string {
  return `${(PANEL_RADIUS / r.w) * 100}% / ${(PANEL_RADIUS / r.h) * 100}%`;
}

/** Rendered size of a frame-space length when the camera is `cameraW` wide. */
export function scaledTo(length: number, cameraW: number): number {
  return (length * cameraW) / FRAME.w;
}

/** Bounding box of a disc, for overlap tests. */
export function discBounds(d: Disc): Rect {
  return { x: d.cx - d.r, y: d.cy - d.r, w: d.r * 2, h: d.r * 2 };
}

export function overlaps(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
  );
}

export function contains(outer: Rect, inner: Rect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.w <= outer.x + outer.w &&
    inner.y + inner.h <= outer.y + outer.h
  );
}
