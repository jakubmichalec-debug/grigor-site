"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { SCROLL } from "./tokens";
import { registerScrollEngine } from "./scrollLock";

gsap.registerPlugin(ScrollTrigger);

/**
 * §1.3 scroll engine + §7.1 "one requestAnimationFrame loop for the whole page".
 *
 * Lenis, GSAP and (later) the three.js canvas each want their own rAF. They
 * don't get one. GSAP's ticker is the single loop: Lenis is driven from it,
 * ScrollTrigger updates off Lenis's scroll event, and the R3F canvas will
 * advance from this same tick.
 *
 * Mounted once in the root layout, above the route boundary, so it survives
 * page transitions.
 */
export function SmoothScroll() {
  useEffect(() => {
    // §7.2 — no scroll hijack at all under reduced motion. Native scrolling.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({
      lerp: SCROLL.lerp,
      wheelMultiplier: 1,
      // Touch smoothing off — native momentum on mobile (§1.3).
      syncTouch: false,
    });

    lenis.on("scroll", ScrollTrigger.update);

    /*
     * Overlays need to stop the page, and Lenis keeps scrolling regardless of
     * `overflow: hidden`. Hand the instance to lib/motion/scrollLock so they
     * can reach it without this component knowing they exist.
     */
    const unregister = registerScrollEngine(lenis);

    if (process.env.NODE_ENV === "development") {
      Object.assign(window, { __ST: ScrollTrigger, __gsap: gsap, __lenis: lenis });
    }

    // gsap.ticker hands us seconds; Lenis wants milliseconds.
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);

    // Without this, a stalled frame makes GSAP fake a tiny delta and the
    // scrub visibly stutters after a tab regains focus.
    gsap.ticker.lagSmoothing(0);

    /*
     * next/font swaps from fallback metrics to the real face after first
     * paint, which shifts layout. Any pin measured before that is wrong by
     * however much the text reflowed, so re-measure once fonts settle.
     * (§7.3: "Refresh mid-scroll: pins re-measure, no dead space.")
     *
     * `refresh(true)` — the "safe" variant — is what makes that mid-scroll
     * requirement not also mean "mid-scroll glitch": a bare refresh() forces
     * _refreshAll(force=true) immediately, which reverts and re-invalidates
     * any pinned, scrub-linked timeline (Intro's zoom) on the spot, so if
     * this promise resolves while the Intro pin is already scrubbing, the
     * wall's scale snaps to whatever the fresh measurement now says — with
     * no scroll movement to justify it. Passing `true` routes through
     * _onResize instead, which defers to the trigger's own soft-refresh path
     * (GSAP's _lastScrollTime-gated scrollEnd listener, see
     * gsap/ScrollTrigger.js's _refreshAll) whenever a scroll is in progress,
     * so the re-measure still happens — just after the gesture ends instead
     * of snapping underneath it.
     */
    let live = true;
    document.fonts?.ready.then(() => {
      if (live) ScrollTrigger.refresh(true);
    });

    return () => {
      live = false;
      unregister();
      gsap.ticker.remove(tick);
      gsap.ticker.lagSmoothing(500, 33);
      lenis.destroy();
    };
  }, []);

  return null;
}
