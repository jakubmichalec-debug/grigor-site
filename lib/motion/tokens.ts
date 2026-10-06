/**
 * Motion primitives from the spec, §1.1 and §1.2.
 * Everything downstream references these by name — no raw numbers in components.
 */

/**
 * §1.1 easing set. The spec's cubic-beziers map exactly onto GSAP's named
 * eases, so we use the names rather than re-deriving the curves:
 *   --e-expo   cubic-bezier(.16, 1, .3, 1)   === expo.out
 *   --e-quart  cubic-bezier(.25, 1, .5, 1)   === quart.out
 *   --e-inout  cubic-bezier(.76, 0, .24, 1)  === quart.inOut
 */
export const EASE = {
  /** Entrances, curtain reveals, text rises. The default. */
  expo: "expo.out",
  /** Hovers, small UI state changes, button fills. */
  quart: "quart.out",
  /** Full-screen overlays in and out: menu, modal, page transition. */
  inout: "quart.inOut",
  /** Marquees and every scroll-linked property. Never ease a scrubbed value. */
  none: "none",
} as const;

/** §1.2 duration scale, in seconds. Six steps only — anything else needs a reason. */
export const DUR = {
  /** Hover, focus, toggle */
  hover: 0.2,
  /** Nav item stagger, small reveals */
  stagger: 0.32,
  /** Text block reveal, card enter */
  reveal: 0.48,
  /** Overlay open/close, modal */
  overlay: 0.7,
  /** Curtain lift, hero headline */
  curtain: 1.0,
  /** Preloader exit, first paint of hero video */
  preload: 1.4,
} as const;

/** §1.3 scroll engine defaults. */
export const SCROLL = {
  /** Lenis smoothing. */
  lerp: 0.09,
  /** Half-second catch-up so scrubs read as weighted, not mechanical. */
  scrub: 0.5,
  /** Default reveal trigger point. */
  revealStart: "top 82%",
} as const;
