/**
 * Pure geometry for a spiral staircase — no DOM, no timing.
 *
 * A step's position is a function of its angle (theta) and the orbit radius
 * only, so the same call serves a scroll-driven rotation or a fixed resting
 * arrangement that never changes.
 *
 * theta = 0 is dead centre, facing the viewer, biggest and brightest.
 * theta = π is dead centre, facing away, smallest and dimmest.
 *
 * What rides the orbit is a whole STEP — a picture and, on some steps, the
 * note beside it — placed and scaled as one object. That is the reason for
 * every number in here being gentler than a carousel of single cards would
 * want: a step is nearly half the viewport wide before perspective touches it.
 */

/**
 * How pronounced the perspective is. 0 = flat carousel, →1 = extreme fisheye.
 *
 * 0.36 gives 1.56x at the front and 0.74x at the back.
 *
 * It used to be 0.20, and not by choice: while a note was carried beside its
 * picture, the pair hung off the orbit on a long lever arm, the front of the
 * orbit multiplied the whole arm, and every notch of perspective came straight
 * out of the swing. Now that a note is a step of its own, each one rides the
 * path on its own centre and there is no arm to keep on screen — the widest
 * single step is the only constraint left, which costs a third of what the
 * pair did. The depth spent on that arm is simply given back.
 */
export const HELIX_DEPTH = 0.36;

/** Opacity of the furthest picture. The nearest is always fully opaque. */
export const HELIX_BACK_OPACITY = 0.35;

/**
 * Opacity floor for the copy, which is higher than a picture's on purpose.
 *
 * The notes are content, not texture. They ride the same orbit as their
 * picture and take the same scale — they are the same object in space, so
 * anything else would pull the pair apart — but a picture at the back is
 * allowed to recede into the dark in a way that words are not.
 */
export const HELIX_COPY_BACK_OPACITY = 0.72;

/**
 * Peak tangential turn of a step, in degrees. Steps on a real cylinder face
 * outward, which at the sides means edge-on and invisible; this damps that to
 * a hint of a turn — enough to sell "rotating around a centre", not enough to
 * hide the picture.
 */
export const HELIX_TILT = 16;

export interface HelixPlacement {
  /** Horizontal offset from centre, px. */
  x: number;
  /** Perspective scale. 1 at the sides, largest at the front, smallest at the back. */
  scale: number;
  /** Depth-faded opacity, using the picture's floor. */
  opacity: number;
  /** Paint order — always matches depth order, front on top. */
  zIndex: number;
  /** cos(theta): 1 = front, -1 = back, 0 = side-on. */
  depth: number;
}

/**
 * Depth fade. Separated out because a step's picture and its copy fade on
 * different floors from the same depth — see HELIX_COPY_BACK_OPACITY.
 */
export function fade(
  depth: number,
  backOpacity: number = HELIX_BACK_OPACITY,
): number {
  return backOpacity + (1 - backOpacity) * ((depth + 1) / 2);
}

/**
 * Perspective projection of a point on a circle of the given radius, viewed
 * with depth strength HELIX_DEPTH. This is a standard "orbit camera" model:
 * the further a point sits from the viewer, the more its horizontal offset
 * (and size) is compressed by the perspective divide `1 / (1 - depth·cosθ)`.
 */
export function placeOnHelix(
  theta: number,
  radius: number,
  depth: number = HELIX_DEPTH,
  backOpacity: number = HELIX_BACK_OPACITY,
): HelixPlacement {
  const d = Math.cos(theta);
  const scale = 1 / (1 - depth * d);
  const x = radius * Math.sin(theta) * scale;
  const zIndex = Math.round(((d + 1) / 2) * 1000);

  return { x, scale, opacity: fade(d, backOpacity), zIndex, depth: d };
}

/**
 * A step's angle at a given scroll position.
 *
 * `base` is its fixed place on the staircase (phase + index × step) and never
 * changes; `t` is scroll progress through the section, 0 → 1, which adds
 * `spinTurns` full revolutions on top. Every step takes the same additive
 * offset, so the staircase turns as one rigid body and its shape is preserved.
 */
export function helixTheta(base: number, t: number, spinTurns: number): number {
  return base + t * spinTurns * Math.PI * 2;
}

/**
 * Largest perspective scale a step ever takes — at the front of the orbit,
 * where cosθ = 1.
 *
 * The section has to reserve vertical space for this. Steps scale about their
 * own centre, so the last step's visual bottom sits `h·(scale-1)/2` below its
 * layout box; reserving only the layout positions clips the final steps off
 * the bottom of the section, which has `overflow: clip`.
 */
export function maxScale(depth: number = HELIX_DEPTH): number {
  return 1 / (1 - depth);
}

/**
 * The furthest a step's *centre* reaches from the axis, as a multiple of the
 * radius. Not simply 1 (the geometric radius) — perspective pushes the peak
 * past it. Closed form: max of sinθ/(1-d·cosθ) occurs at cosθ = d.
 */
export function maxExtentFactor(depth: number = HELIX_DEPTH): number {
  return 1 / Math.sqrt(1 - depth * depth);
}

/** The perspective scale at the angle where the centre reaches maxExtentFactor. */
export function scaleAtMaxExtent(depth: number = HELIX_DEPTH): number {
  return 1 / (1 - depth * depth);
}

/**
 * The furthest a step's *outer edge* reaches — centre offset plus half the
 * step's width, scaled by the same perspective factor. The peak of this
 * combined expression sits at a DIFFERENT angle than maxExtentFactor's peak
 * (nearer the front, where perspective scale is larger), so the two can't be
 * summed separately — see the regression test in scripts/helix.check.mts.
 *
 * `width` is the whole step: picture, gap and copy together. Sizing on the
 * picture alone would let the copy hang off the side of the screen.
 *
 * g(θ) = (R·sinθ + h) / (1 - d·cosθ), maximised via g'(θ) = 0, which reduces
 * to R·cosθ - d·h·sinθ = R·d — a standard A·cosθ + B·sinθ = C equation,
 * solved in closed form (no search).
 */
export function maxCardEdge(
  radius: number,
  width: number,
  depth: number = HELIX_DEPTH,
): number {
  const h = width / 2;
  const A = radius;
  const B = -depth * h;
  const C = radius * depth;
  const mag = Math.hypot(A, B);

  if (mag === 0) return h / (1 - depth);

  const phi = Math.atan2(B, A);
  const ratio = Math.min(1, Math.max(-1, C / mag));
  const off = Math.acos(ratio);

  let best = -Infinity;
  for (const theta of [phi + off, phi - off]) {
    const g = (radius * Math.sin(theta) + h) / (1 - depth * Math.cos(theta));
    if (g > best) best = g;
  }
  return best;
}

/**
 * Bisects for the radius at which a step's outer edge lands exactly on
 * `(viewportWidth / 2) * bleed`. maxCardEdge grows monotonically with radius,
 * so bisection always converges. If the step alone (radius 0) already
 * overflows the target — it is simply wider than the viewport allows — there
 * is no radius that fixes it, so this returns 0 rather than going negative.
 */
export function radiusForViewport(
  viewportWidth: number,
  width: number,
  bleed: number = 1,
  depth: number = HELIX_DEPTH,
): number {
  const target = (viewportWidth / 2) * bleed;
  if (maxCardEdge(0, width, depth) >= target) return 0;

  let lo = 0;
  let hi = Math.max(viewportWidth, 1);
  while (maxCardEdge(hi, width, depth) < target) hi *= 2;

  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (maxCardEdge(mid, width, depth) < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * Policy wrapper: on narrow viewports a step is nearly screen-width, so an
 * edge-respecting orbit would barely move. Those viewports are allowed to
 * bleed 35% past the edges instead, so the rotation stays legible.
 */
export function helixLayout(
  viewportWidth: number,
  width: number,
): { radius: number; bleed: number } {
  const bleed = viewportWidth < 900 ? 1.35 : 1;
  return { radius: radiusForViewport(viewportWidth, width, bleed), bleed };
}
