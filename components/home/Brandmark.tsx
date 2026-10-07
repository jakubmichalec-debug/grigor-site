"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { SCROLL } from "@/lib/motion/tokens";
import { useReducedMotion } from "@/lib/motion/useReducedMotion";
import { INTRO_CHROME_AT, INTRO_PIN_ID } from "./Intro";
import s from "./Brandmark.module.css";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/**
 * The page's headline. It lives outside both sections it travels between, as a
 * fixed layer, because it has to outlast the hero: the hero is pinned and then
 * scrolls away, and anything inside it goes with it.
 *
 * What it imitates is `position: sticky` scoped to the section below — which no real
 * sticky element can do here, since it has to be on screen before that section
 * exists in the viewport at all. So it is fixed, and its `top` is computed from
 * the section's own position every frame:
 *
 *   1. hidden, until the hero zoom has landed and the chrome is up;
 *   2. parked in the hero's lower left;
 *   3. picked up by the hero/section boundary as that edge rises past it, and
 *      carried up glued EDGE_GAP beneath it;
 *   4. carrying on off the top of the screen with that edge, staying put in
 *      the document rather than riding along with the viewport;
 *   5. optionally pausing at the top on the way out, if STICK_VH says so.
 *
 * Step 3 is the whole point and is why there are no timing percentages here
 * any more. The headline does not travel on a schedule of its own that has to
 * be tuned to look synchronised with the section — it is pinned to the section
 * boundary and moves because that edge moves. It cannot drift out of step,
 * because there is nothing for it to be out of step with.
 *
 * Steps 4 and 5 are what `position: sticky` inside the section would do, and
 * the point of step 5 is that the headline belongs to the section rather than
 * to the screen. A sticky element that is never released just looks fixed —
 * which is what this did while its release was pinned to the section's bottom
 * edge, an edge the last section on a page can never bring above the fold.
 */
/* ── Tunables ───────────────────────────────────────────────────────────────
 *
 * The three numbers worth playing with. Everything else on this page derives
 * from them, so changing one here changes it everywhere it matters.
 */

/**
 * Where the headline sits relative to the hero/section boundary, in px below
 * it. 0 glues its top to that edge; positive values inset it into the section.
 *
 * This is also its locked position once the edge reaches the top of the
 * screen, so it doubles as the distance from the screen top while stuck.
 */
const EDGE_GAP = 0;

/** Where it waits in the hero: distance from the bottom of the screen, in % of
 * viewport height. */
const HERO_BOTTOM_VH = 34;



/**
 * Optional lingering: how long the headline stays pinned to the top of the
 * screen after the boundary has passed it, as a % of viewport height.
 *
 * 0 is the default and means it never lingers — the moment the boundary
 * reaches the top of the screen the headline carries on with it and off the
 * page. It is left behind at its place in the document rather than riding
 * along with the viewport.
 *
 * Any positive value makes it hold at the top for that much scrolling before
 * the section takes it away, which is the conventional sticky-header feel: 50
 * holds for half a screen. Capped by the scroll actually left in the page, so
 * the exit is always a complete movement rather than one that runs out of
 * document halfway.
 */
const STICK_VH = 0;

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

export function Brandmark() {
  const root = useRef<HTMLHeadingElement>(null);
  const reduced = useReducedMotion();

  useGSAP(
    () => {
      const el = root.current;
      if (!el || reduced) return;

      /*
       * Whatever section comes next — that is the edge this headline gets
       * pushed off by. It is the helix today and was hardcoded as such, but a
       * section has already been inserted here once and taken out again, so the
       * boundary is marked with an attribute rather than assumed from whoever
       * happens to be the neighbour. The fallback keeps it working if the
       * attribute is ever dropped.
       */
      const boundary =
        document.querySelector<HTMLElement>("[data-brandmark-boundary]") ??
        document.querySelector<HTMLElement>("[data-showcase]");
      if (!boundary) return;

      /*
       * Everything the position depends on, measured rather than assumed:
       *
       *   heroTop — the headline's own height decides where its top must sit
       *             for its bottom to land HERO_BOTTOM_VH above the fold;
       *   secTop/secH — cached so the per-frame maths below never touches
       *             layout. getBoundingClientRect() here would force a reflow
       *             on every scroll event.
       */
      let vh = 0;
      let markH = 0;
      let heroTop = 0;
      let secTop = 0;
      let secH = 0;
      let stick = 0;

      const measure = () => {
        vh = window.innerHeight;
        markH = el.offsetHeight;
        heroTop = vh - markH - (vh * HERO_BOTTOM_VH) / 100;

        secTop = boundary.offsetTop;
        secH = boundary.offsetHeight;

        /*
         * How far the page can still scroll once the section's top has reached
         * the screen top. The boundary is the last section, so this is finite
         * and — on a tall viewport, where the headline is also at its largest
         * — smaller than STICK_VH plus the headline's own height. Holding for
         * the full STICK_VH there means the release starts on the last pixel
         * of the document and the headline is left half cut off at the bottom
         * of the page. Spending only what is available keeps it a complete
         * movement at every viewport — the headline's last pixel clears the
         * top of the screen on the document's last pixel of scroll, which is
         * why its own height and resting offset both come off the runway.
         */
        const maxScroll = document.documentElement.scrollHeight - vh;
        const runway = Math.max(0, maxScroll - secTop - markH - EDGE_GAP);
        stick = Math.min((vh * STICK_VH) / 100, runway);
      };

      /*
       * One expression for every state.
       *
       * `travelled` carries the headline from the hero to its slot under the
       * header, arriving exactly as the section's top meets the screen top.
       *
       * `release` is the bottom of a virtual sticky container: a box hung off
       * the section's top, tall enough to hold the headline for STICK_VH of
       * scroll, and never taller than the section itself. Taking the smaller
       * of the two reproduces what a browser does with `position: sticky` —
       * the container's bottom edge does nothing at all until it reaches the
       * headline, then pushes it back up and out at scroll speed.
       */
      const apply = (scroll: number) => {
        /* The boundary: that section's top edge, in viewport coordinates. */
        const edge = secTop - scroll;

        /*
         * Glued EDGE_GAP under that edge. The Math.max is the sticky clamp —
         * it stops the headline at the top of the screen instead of letting it
         * carry on past. With STICK_VH at 0 the release below cancels it out
         * on the same frame, so the headline is simply left behind at its spot
         * in the document; raise STICK_VH and this is what holds it up there.
         */
        const onEdge = EDGE_GAP + Math.max(0, edge);

        /*
         * Until the edge has risen far enough to reach it, the headline is
         * still parked in the hero. Taking the smaller of the two IS the
         * handoff — no threshold to pick, no percentage to tune: the edge
         * simply catches up and takes over.
         */
        const held = Math.min(heroTop, onEdge);

        /*
         * The release: the bottom of a virtual sticky container hung off the
         * boundary, tall enough to hold the headline for `stick` of scroll and
         * never taller than the section. Does nothing until it reaches the
         * headline, then pushes it up and out at scroll speed.
         */
        const boxBottom = Math.min(edge + EDGE_GAP + stick + markH, edge + secH);
        const release = boxBottom - markH;

        el.style.setProperty("--t", `${Math.min(held, release).toFixed(2)}px`);
      };

      measure();
      apply(window.scrollY);
      el.style.setProperty("--in", "0");

      /*
       * Appear with the hero chrome.
       *
       * The range is borrowed from the hero's own pin rather than declared
       * against the stage. Declaring it here would measure a *pinned* element:
       * its top sits at the top of the viewport for the entire pin, so
       * "top top" resolves to where the pin ends and the whole fade would
       * happen a section too late. Function-based start/end are re-read on
       * every refresh, so a retuned pin drags this along with it.
       *
       * Driven from onUpdate rather than a tween, so scrubbing back up fades
       * the headline out again for free.
       */
      const pin = ScrollTrigger.getById(INTRO_PIN_ID);
      if (!pin) {
        /* No hero to sync to — better a visible headline than a hidden one. */
        el.style.setProperty("--in", "1");
      }

      const appear =
        pin &&
        ScrollTrigger.create({
          start: () => pin.start,
          end: () => pin.end,
          scrub: SCROLL.scrub,
          onUpdate: (self) => {
            const p = clamp01((self.progress - INTRO_CHROME_AT) / 0.05);
            el.style.setProperty("--in", p.toFixed(3));
          },
        });

      /*
       * Position, unscrubbed on purpose. Every other scroll-linked value on
       * the page is smoothed by SCROLL.scrub, but a glued element has to track
       * its anchor exactly: half a second of lag would let the section's
       * bottom edge slide through the headline on the way out, and would make
       * the header and the headline drift apart while they settle. Lenis
       * already smooths the scroll value this reads.
       */
      const track = ScrollTrigger.create({
        trigger: boundary,
        /*
         * Opens as the boundary crosses the fold — comfortably before it can
         * reach the parked headline, which sits well above the bottom of the
         * screen. The position is only recomputed while this is active, so the
         * window has to open before anything it drives starts moving.
         */
        start: "top bottom",
        end: "bottom top",
        onUpdate: (self) => apply(self.scroll()),
        onRefresh: (self) => {
          measure();
          apply(self.scroll());
        },
      });

      ScrollTrigger.refresh();

      /*
       * Tuning readout, dev only. Scroll until the headline is exactly where
       * you want it, then run `__mark()` in the console: it prints the values
       * of the constants at the top of this file that would put it there and
       * lock it in at that moment. Same idea as the __ST / __lenis handles in
       * lib/motion/SmoothScroll.tsx.
       */
      if (process.env.NODE_ENV === "development") {
        Object.assign(window, {
          __mark: () => {
            const edge = boundary.getBoundingClientRect().top;
            const gap = Math.round(
              el.getBoundingClientRect().top - Math.max(0, edge),
            );
            console.log(`EDGE_GAP = ${gap}`);
            return { EDGE_GAP: gap, edgeOnScreen: Math.round(edge) };
          },
        });
      }

      return () => {
        appear?.kill();
        track.kill();
      };
    },
    { dependencies: [reduced], revertOnUpdate: true },
  );

  return (
    <h1
      ref={root}
      className={s.mark}
      data-brandmark=""
      data-reduced={reduced ? "true" : undefined}
    >
      <span className={s.l1}>Grigor</span>
      <span className={s.l2}>video</span>
    </h1>
  );
}
