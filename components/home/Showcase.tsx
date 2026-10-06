"use client";

import { useRef, type CSSProperties } from "react";
import Image from "next/image";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { DUR, EASE, SCROLL } from "@/lib/motion/tokens";
import { useReducedMotion } from "@/lib/motion/useReducedMotion";
import { asset } from "@/lib/media/asset";
import {
  HELIX_COPY_BACK_OPACITY,
  HELIX_TILT,
  fade,
  helixLayout,
  helixTheta,
  maxScale,
  placeOnHelix,
} from "@/lib/motion/helix";
import s from "./Showcase.module.css";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/**
 * ── the staircase ─────────────────────────────────────────────────────────
 *
 * One entry per step, in the order they descend the page. A step is EITHER a
 * picture or a note — the copy is not attached to a picture any more, it is a
 * step in its own right, taking its own place on the spiral.
 *
 * That is what puts the copy on the same path as the pictures rather than on a
 * path of its own: everything below treats the two kinds identically, placing
 * each on its own centre, so a note traces exactly the curve a picture traces
 * and simply arrives at it a step later. Nothing in the geometry knows which
 * kind it is holding.
 *
 * This array is the whole editorial surface. Reorder it and the staircase
 * reorders; swap a picture for a note and the spiral absorbs it; add or remove
 * a step and the winding, the reserved height and the checks all follow.
 *
 * As it stands: ten steps alternating, a picture first, so the copy takes
 * every second step starting from the second — five of each.
 *
 * The notes are the services. This section is where the header's "Services"
 * link lands, so each one names a kind of work that can be booked, in the same
 * three families the gallery filters by: sport (races, events, athletes),
 * brands, and custom.
 */
type Step =
  | { kind: "picture"; title: string; src: string; alt: string }
  | { kind: "note"; eyebrow: string; body: string };

const STEPS: Step[] = [
  {
    kind: "picture",
    title: "Nocturne",
    src: "/showcase/nocturne.jpg",
    alt: "A runner with a headlamp on a dark road, seen from behind.",
  },
  {
    kind: "note",
    eyebrow: "Races",
    body: "Race films, start line to finish arch. Ultras, trail runs and road cycling, cut into a few minutes that hold the whole day.",
  },
  {
    kind: "picture",
    title: "Arena",
    src: "/showcase/arena.jpg",
    alt: "An athlete raising both fists under the lights of a race hall.",
  },
  {
    kind: "note",
    eyebrow: "Events",
    body: "HYROX halls and snow parks, not only open roads. A recap that shows how it felt to be there, not just who won.",
  },
  {
    kind: "picture",
    title: "Peloton",
    src: "/showcase/peloton.jpg",
    alt: "Two road cyclists in team kit at speed, close up.",
  },
  {
    kind: "note",
    eyebrow: "Athletes",
    body: "For athletes, teams and clubs: training days, race prep and the story behind a result.",
  },
  {
    kind: "picture",
    title: "Switchback",
    src: "/showcase/switchback.jpg",
    alt: "A trail runner climbing a forest path, seen from behind.",
  },
  {
    kind: "note",
    eyebrow: "Brands",
    body: "For the brands around the sport: film and photo of the kit where it belongs, on athletes, out on the course.",
  },
  {
    kind: "picture",
    title: "Low Winter Sun",
    src: "/showcase/low-winter-sun.jpg",
    alt: "A skier with crossed skis in mid-air, the sun behind them.",
  },
  {
    kind: "note",
    eyebrow: "Custom",
    body: "Not every brief is a race. One-off pieces built around a single idea, in whatever shape it needs.",
  },
];

const COUNT = STEPS.length;

/* ── the dials ───────────────────────────────────────────────────────────
 *
 * Five numbers decide the whole arrangement. Everything else in this file is
 * machinery that reads them.
 */

/**
 * Revolutions the staircase winds through, top step to bottom.
 *
 * 0.75 over ten steps puts them 30° apart: the first faces you square on, the
 * next few tread progressively left, the middle of the run passes behind the
 * axis, and the last few come back up the right-hand side. That is what makes
 * it a spiral staircase rather than a diagonal — a stair that only ever
 * stepped left would walk off the side of the screen by the fourth step.
 *
 * Raise it for a tighter, busier coil; lower it for a gentler arc. A whole 1.0
 * is deliberately not the default: it would land the last step on exactly the
 * same angle as the first, which reads as a repeat rather than an ending.
 */
const TURNS = 0.75;

/**
 * Which way it winds. -1 treads left as it descends, +1 treads right.
 *
 * It is the sign of theta and nothing else, so flipping it mirrors the section
 * exactly: depth, scale and opacity are functions of cos(theta), which is even
 * and does not change, while x and the tangential turn are odd and flip
 * together, so every step still faces the way it travels.
 */
const WIND = -1;

/**
 * Divided by COUNT - 1, so the first step sits at the phase and the last sits
 * exactly TURNS revolutions along. Dividing by COUNT instead would leave the
 * staircase a step short of the winding it advertises.
 */
const STEP_ANGLE = (WIND * Math.PI * 2 * TURNS) / (COUNT - 1);

/**
 * Where the winding starts, in degrees.
 *
 * Zero: the first step sits dead centre, square on, at the front of the orbit
 * — its copy just left of the centre line and its picture just right of it,
 * which is the arrangement the whole section is read from. sin is zero here,
 * so there is no tangential turn on it either, and the rotation below starts
 * from rest rather than partway through a swing.
 */
const PHASE_DEG = 0;
const PHASE = (PHASE_DEG * Math.PI) / 180;

/**
 * Revolutions the whole staircase turns through as the section crosses the
 * viewport, about the centre line drawn behind it.
 *
 * Positive carries the near steps — the big, bright ones the eye follows —
 * from left to right. The far side is travelling the other way at the same
 * time, but it is small and dim and nobody reads the rotation off it.
 *
 * A whole one, because only an integer number of turns brings every step back
 * to the weave it started from: the section opens and closes on the resting
 * arrangement, and the turn in between is the thing you came to see. Set it to
 * 0 and the staircase simply stands still.
 */
const SPIN_TURNS = 1;

/**
 * Vertical gap between steps, px — still smaller than a picture is tall, so
 * the staircase overlaps itself and nearer steps sit *on* their neighbours
 * rather than merely above them, but no longer by much.
 *
 * This is the dial for how far apart the steps run down the page; --gap in the
 * stylesheet is the dial for how far a picture sits from its own copy.
 */
const SPACING = 200;

/**
 * Where a step starts its entrance, as a fraction down the viewport. Later
 * than the site default (top 82%) on purpose: the brief is that steps arrive
 * well inside the viewport rather than sliding in the instant they clear the
 * fold. The ScrollTrigger string and the catch-up pass below both derive from
 * this one number so they cannot drift apart.
 */
const REVEAL_FRACTION = 0.68;
const REVEAL_START = `top ${REVEAL_FRACTION * 100}%`;

/**
 * Where the rotation begins, as a position of the section's top in the
 * viewport. NOT "top bottom": starting the moment the section clears the fold
 * spends a third of the turn before there is anything on screen to watch.
 */
const SPIN_START_PCT = 45;

/**
 * The ground each frame sits on until its picture has loaded. Deterministic —
 * pure functions of index, so server and client markup agree.
 */
const lightness = (i: number) => 12 + ((i * 29) % 11);
const hue = (i: number) => 24 + ((i * 53) % 26);

export function Showcase() {
  const section = useRef<HTMLElement>(null);
  const stair = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useGSAP(
    () => {
      const sectionEl = section.current;
      const stairEl = stair.current;
      if (!sectionEl || !stairEl || reduced) return;

      const steps = Array.from(
        stairEl.querySelectorAll<HTMLElement>("[data-step]"),
      );
      if (!steps.length) return;

      /*
       * Radius is derived from the measured step width rather than a tuned
       * constant, so the widest step lands on the screen edge at any viewport.
       * The measured width is the WHOLE step — copy, gap and picture — because
       * that is what swings; sizing on the picture alone hangs the copy off
       * the side of the screen at the extremes of the orbit.
       *
       * clientWidth, not innerWidth: it is the CSS viewport the stylesheet's
       * vw units resolve against. innerWidth includes the scrollbar and, under
       * device emulation, can report the window rather than the page.
       */
      let radius = 0;
      const measure = () => {
        const vw = document.documentElement.clientWidth;

        /*
         * Every step hangs on the orbit by its own centre, so a front-facing
         * step — picture or note — sits exactly on the section's centre line.
         * The orbit therefore has to fit the WIDEST step, whichever kind that
         * is, and the two kinds are not the same width.
         *
         * Reach is read off each step's own margin rather than assumed from
         * its width, so a step that is deliberately hung off-centre in CSS
         * cannot silently overflow: an arm of length L either side of the
         * anchor is exactly a centred box of width 2L as far as containment is
         * concerned, the geometry being symmetric in angle.
         */
        const reach = Math.max(
          ...steps.map((el) => {
            const offset = parseFloat(getComputedStyle(el).marginLeft) || 0;
            return Math.max(-offset, el.offsetWidth + offset);
          }),
        );
        radius = helixLayout(vw, reach * 2).radius;

        /*
         * Reserve the height the staircase actually occupies, not just the
         * height its layout boxes span. The last step sits at (COUNT-1)x
         * spacing and is a whole step tall on top of that, and at the front of
         * the orbit it scales about its own centre — so its visual bottom
         * falls a further h*(scale-1)/2 below its box.
         *
         * offsetHeight, not getBoundingClientRect: layout height, before the
         * placement transform this very function is about to apply.
         */
        const stepH = Math.max(...steps.map((el) => el.offsetHeight));
        const reserved =
          (COUNT - 1) * SPACING + (stepH * (1 + maxScale())) / 2;
        stairEl.style.setProperty("--stair-h", `${Math.ceil(reserved)}px`);
      };

      /*
       * The orbit. `spin.t` is the only thing scroll drives; every step's
       * angle is a pure function of it, so one scrubbed value moves the whole
       * staircase. Written as custom properties rather than GSAP's own
       * x/scale so the reveal below (which animates --in and --ty) composes
       * with the placement instead of overwriting it.
       */
      const spin = { t: 0 };

      const place = () => {
        steps.forEach((el, i) => {
          const theta = helixTheta(PHASE + i * STEP_ANGLE, spin.t, SPIN_TURNS);
          const p = placeOnHelix(theta, radius);

          el.style.setProperty("--x", `${p.x.toFixed(2)}px`);
          el.style.setProperty("--s", p.scale.toFixed(4));
          el.style.setProperty("--o", p.opacity.toFixed(3));
          /*
           * The copy fades on a higher floor than its picture: same object in
           * space, same scale, but words may not recede into the dark the way
           * an image is allowed to. See HELIX_COPY_BACK_OPACITY.
           */
          el.style.setProperty(
            "--o-copy",
            fade(p.depth, HELIX_COPY_BACK_OPACITY).toFixed(3),
          );
          /* Tangential turn, damped — a hint of a cylinder, not a flipped card. */
          el.style.setProperty(
            "--ry",
            `${(Math.sin(theta) * HELIX_TILT).toFixed(2)}deg`,
          );
          el.style.zIndex = String(p.zIndex);
        });
      };

      measure();
      place();

      /*
       * useGSAP runs in useLayoutEffect, which in dev can beat the CSS module
       * to the DOM. A step with no width yet measures as the full section,
       * which makes radiusForViewport return 0 and lays the staircase flat on
       * the axis. Watching the step re-measures the moment the real width
       * lands, and covers the font swap and container resizes for free.
       */
      const ro = new ResizeObserver(() => {
        measure();
        place();
      });
      ro.observe(steps[0]);

      /* A viewport change can move the radius without changing the step width
       * (below the clamp's floor), so the window still needs watching too. */
      const onResize = () => {
        measure();
        place();
      };
      window.addEventListener("resize", onResize);

      /*
       * The turn runs from SPIN_START_PCT down to the section leaving the top
       * of the screen. No pin: the page keeps scrolling normally and the
       * staircase turns underneath it.
       */
      const spinTween = gsap.to(spin, {
        t: 1,
        ease: EASE.none,
        onUpdate: place,
        scrollTrigger: {
          trigger: sectionEl,
          start: `top ${SPIN_START_PCT}%`,
          end: "bottom top",
          scrub: SCROLL.scrub,
          invalidateOnRefresh: true,
          onRefresh: () => {
            measure();
            place();
          },
        },
      });

      /*
       * The reveal. Nothing is hidden in markup or CSS — only here, and only
       * once motion is confirmed on, so reduced motion and JS-off both fall
       * through to the plain always-visible layout with no extra branching.
       */
      gsap.set(steps, { "--in": 0, "--ty": "56px" });

      const batch = ScrollTrigger.batch(steps, {
        start: REVEAL_START,
        once: true,
        onEnter: (entering) =>
          gsap.to(entering, {
            "--in": 1,
            "--ty": "0px",
            duration: DUR.reveal,
            ease: EASE.expo,
            stagger: 0.09,
            overwrite: true,
          }),
      });

      /*
       * ── the staircase recedes as the camera arrives ──────────────────────
       *
       * Keyed to the camera, not to this section — the handover is the
       * camera's arrival, and measuring it from the thing that is actually
       * moving means the two cannot drift apart. Guarded because the staircase
       * has to survive on a page that has no camera after it.
       */
      const cameraEl = document.querySelector<HTMLElement>("[data-camera]");
      if (cameraEl) {
        gsap.fromTo(
          sectionEl,
          { "--recede": 1, "--recede-dim": 0, "--recede-radius": "0px" },
          {
            "--recede": 0.88,
            "--recede-dim": 0.55,
            "--recede-radius": "22px",
            ease: EASE.none,
            scrollTrigger: {
              trigger: cameraEl,
              /* From the camera's top entering the fold to it owning the screen. */
              start: "top bottom",
              end: "top top",
              scrub: SCROLL.scrub,
              invalidateOnRefresh: true,
            },
          },
        );
      }

      ScrollTrigger.refresh();

      /*
       * A page restored mid-section — reload, back button, deep link — can
       * land with steps already above the reveal line. batch only ever sees
       * elements *crossing* that line, so those would sit at --in: 0 forever.
       * Put them straight into their finished state rather than animating them
       * in behind the viewer. On a normal load this matches nothing.
       */
      const line = window.innerHeight * REVEAL_FRACTION;
      const settled = steps.filter(
        (el) => el.getBoundingClientRect().top < line,
      );
      if (settled.length) gsap.set(settled, { "--in": 1, "--ty": "0px" });

      return () => {
        ro.disconnect();
        window.removeEventListener("resize", onResize);
        batch.forEach((t) => t.kill());
        spinTween.scrollTrigger?.kill();
        spinTween.kill();
      };
    },
    { scope: section, dependencies: [reduced], revertOnUpdate: true },
  );

  return (
    <section
      ref={section}
      className={s.section}
      id="showcase"
      data-showcase=""
      data-brandmark-boundary=""
      data-reduced={reduced ? "true" : undefined}
      aria-label="Selected frames"
    >
      <div
        ref={stair}
        className={s.stair}
        style={
          {
            "--spacing": `${SPACING}px`,
            "--count": COUNT,
          } as CSSProperties
        }
      >
        {/*
          One element per step, each carrying its own placement and each hung
          on its own centre. A note and a picture differ only in what is inside
          them and how wide they are — the transform they receive is written by
          the same line of code, which is what puts them on one path.
        */}
        {STEPS.map((step, i) =>
          step.kind === "picture" ? (
            <figure
              key={step.title}
              data-step=""
              data-kind="picture"
              className={`${s.step} ${s.picture}`}
              style={{ "--i": i } as CSSProperties}
            >
              <div
                className={s.frame}
                data-n={String(i + 1).padStart(2, "0")}
                style={
                  {
                    "--l": `${lightness(i)}%`,
                    "--h": hue(i),
                  } as CSSProperties
                }
              >
                {/*
                  Sized for the front of the orbit, not the layout box: a step
                  facing the viewer is scaled up past its own width, and a
                  picture fetched for the smaller figure goes soft exactly
                  where it is looked at hardest.
                */}
                <Image
                  src={asset(step.src)}
                  alt={step.alt}
                  fill
                  sizes="(max-width: 900px) 46vw, 28vw"
                  className={s.frameImg}
                />
              </div>
              <figcaption className={s.caption}>{step.title}</figcaption>
            </figure>
          ) : (
            <div
              key={step.eyebrow}
              data-step=""
              data-kind="note"
              className={`${s.step} ${s.note}`}
              style={{ "--i": i } as CSSProperties}
            >
              <span className={s.noteEyebrow}>{step.eyebrow}</span>
              <p className={s.noteBody}>{step.body}</p>
            </div>
          ),
        )}
      </div>
    </section>
  );
}
