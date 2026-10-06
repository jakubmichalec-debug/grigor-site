"use client";

import { useRef, type CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { DUR, EASE, SCROLL } from "@/lib/motion/tokens";
import { useReducedMotion } from "@/lib/motion/useReducedMotion";
import { asset } from "@/lib/media/asset";
import s from "./Reviews.module.css";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/**
 * The headline, already split the way it moves. The first line arrives from
 * above and sits left, the second from below and sits right — so the two halves
 * pass each other on the way in and settle offset, rather than landing as one
 * centred block.
 */
/*
 * The stills scattered around the headline. Positions are percentages of the
 * headline block so they hold their arrangement at every viewport, and `depth`
 * is the multiplier for both the scroll drift and the pointer lean — a small,
 * distant frame moves less than a large near one, which is the whole reason the
 * group reads as having space in it rather than being a flat collage.
 *
 * Deliberately clear of the middle column: the headline has to stay readable.
 */
const SCATTER = [
  { src: "/clips/chill-and-thrill.jpg", x: 2, y: 6, w: 15, rot: -6, depth: 1.25 },
  { src: "/clips/race-recap.jpg", x: 84, y: 2, w: 12, rot: 5, depth: 0.7 },
  { src: "/clips/art-of-endurance.jpg", x: 9, y: 60, w: 11, rot: 7, depth: 0.55 },
  { src: "/clips/hyrox.jpg", x: 80, y: 52, w: 16, rot: -4, depth: 1.4 },
  { src: "/clips/vitosha-100.jpg", x: 24, y: 88, w: 9, rot: -9, depth: 0.9 },
  { src: "/clips/embrace-the-struggle.jpg", x: 68, y: 92, w: 10, rot: 6, depth: 1.1 },
] as const;

const HEADLINE = [
  { text: "There's more where", from: "top" },
  { text: "that came from", from: "bottom" },
] as const;

/*
 * The cards: how he works, in his own words, one line per stage of a job and in
 * the order a job runs.
 *
 * They used to be client quotes, and invented ones — fine as filler, not
 * something a real site can publish. The markup kept its shape, so genuine
 * quotes can come back the same way: `stage` and `about` sit exactly where a
 * client's name and role sat.
 */
type Line = {
  quote: string;
  /** The stage of the job the line belongs to. */
  stage: string;
  /** The question that stage answers. */
  about: string;
  /** The work shown beside it. Points at the gallery until the individual
   *  clips have somewhere of their own to live. */
  href: string;
  /** A frame that shows what the line says. Optional: without one the slot
   *  renders empty. */
  still?: string;
};

const LINES: Line[] = [
  {
    quote:
      "You brief the person who shoots the film and cuts it. Nothing gets lost in between.",
    href: "/gallery",
    still: "/reviews/brief.jpg",
    stage: "The brief",
    about: "How it starts",
  },
  {
    quote:
      "I shoot from inside the race. When the runners are on the mountain at night, so is the camera.",
    href: "/gallery",
    still: "/reviews/race-day.jpg",
    stage: "Race day",
    about: "How it's shot",
  },
  {
    quote:
      "The whole day goes in: the start in the dark, the long middle, the faces at the finish.",
    href: "/gallery",
    still: "/reviews/coverage.jpg",
    stage: "Coverage",
    about: "What gets filmed",
  },
  {
    quote:
      "Every film is cut to its music. Fast where the race is fast, quiet where it starts to hurt.",
    href: "/gallery",
    still: "/reviews/edit.jpg",
    stage: "The edit",
    about: "How it's cut",
  },
  {
    quote:
      "One day of shooting gives you the film and the vertical cuts for your feed.",
    href: "/gallery",
    still: "/reviews/delivery.jpg",
    stage: "Delivery",
    about: "What you get",
  },
];

export function Reviews() {
  const section = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();

  useGSAP(
    () => {
      const sectionEl = section.current;
      if (!sectionEl || reduced) return;

      let scatterCleanup: (() => void) | undefined;

      const lines = Array.from(
        sectionEl.querySelectorAll<HTMLElement>("[data-line-inner]"),
      );
      if (!lines.length) return;

      /*
       * A custom property, not yPercent. GSAP resolves yPercent to pixels the
       * moment it is set, and this runs in a layout effect — before next/font
       * has swapped from its fallback metrics, so the line measures one height
       * and settles at another. A percentage inside a CSS transform is resolved
       * by the browser at paint instead, so it survives the reflow.
       *
       * 115%, not 100%: descenders hang below the line box, and at exactly 100%
       * the tail of a "g" stays visible below the mask.
       */
      gsap.set(lines, {
        "--slide": (i: number) => (i === 0 ? "-115%" : "115%"),
      });

      /*
       * ── the scatter ──────────────────────────────────────────────────────
       *
       * Two writes, six frames. `--drift` and `--lean-*` are set once on the
       * container and each frame multiplies them by its own `--depth` in CSS,
       * so the pointer handler stays O(1) no matter how many frames there are
       * and nothing has to be recalculated per element in JavaScript.
       */
      const scatter = sectionEl.querySelector<HTMLElement>("[data-scatter]");
      if (scatter) {
        gsap.fromTo(
          scatter,
          { "--drift": 70 },
          {
            "--drift": -70,
            ease: EASE.none,
            scrollTrigger: {
              trigger: sectionEl.querySelector("[data-headline]"),
              start: "top bottom",
              end: "bottom top",
              scrub: SCROLL.scrub,
              invalidateOnRefresh: true,
            },
          },
        );

        /* No lean on touch: there is no pointer to lean toward. */
        if (window.matchMedia("(hover: hover)").matches) {
          const leanX = gsap.quickTo(scatter, "--lean-x", {
            duration: 0.9,
            ease: EASE.quart,
          });
          const leanY = gsap.quickTo(scatter, "--lean-y", {
            duration: 0.9,
            ease: EASE.quart,
          });
          const onMove = (e: PointerEvent) => {
            const r = scatter.getBoundingClientRect();
            /*
             * Unitless, with the px applied in CSS. quickTo interpolates
             * numbers; handing it "34px" makes it a string tween that snaps
             * rather than eases.
             */
            leanX(((e.clientX - (r.left + r.width / 2)) / r.width) * 34);
            leanY(((e.clientY - (r.top + r.height / 2)) / r.height) * 22);
          };
          window.addEventListener("pointermove", onMove);
          scatterCleanup = () => window.removeEventListener("pointermove", onMove);
        }
      }

      gsap.to(lines, {
        "--slide": "0%",
        duration: DUR.preload,
        ease: EASE.expo,
        stagger: { each: 0.16 },
        scrollTrigger: {
          trigger: sectionEl.querySelector("[data-headline]"),
          /*
           * Late on purpose. At the usual reveal point the headline is barely
           * over the fold and the whole move is spent before it is properly in
           * view; by 58% it is well inside the viewport when it starts.
           */
          start: "top 58%",
          once: true,
        },
      });

      return () => scatterCleanup?.();
    },
    { scope: section, dependencies: [reduced], revertOnUpdate: true },
  );

  return (
    <section
      ref={section}
      className={s.section}
      id="reviews"
      data-reviews=""
      data-reduced={reduced ? "true" : undefined}
      aria-labelledby="reviews-heading"
    >
      <div className={s.body}>
        {/*
          Behind the type and hidden from assistive tech: these are texture that
          performs the headline, not content anybody needs read out.
        */}
        <div className={s.scatter} data-scatter="" aria-hidden="true">
          {SCATTER.map((frame) => (
            <span
              key={frame.src}
              className={s.scatterFrame}
              style={
                {
                  "--x": `${frame.x}%`,
                  "--y": `${frame.y}%`,
                  "--w": `${frame.w}%`,
                  "--rot": `${frame.rot}deg`,
                  "--depth": frame.depth,
                } as CSSProperties
              }
            >
              <Image
                src={asset(frame.src)}
                alt=""
                fill
                sizes="18vw"
                className={s.scatterImg}
              />
            </span>
          ))}
        </div>

        {/*
          One mask per line, not per word. The whole line travels together, which
          is what makes the two halves read as passing each other.
        */}
        <h2 className={s.headline} id="reviews-heading" data-headline="">
          {HEADLINE.map((line) => (
            <span className={s.line} data-from={line.from} key={line.text}>
              <span className={s.lineInner} data-line-inner="">
                {line.text}
              </span>
            </span>
          ))}
        </h2>

        {/*
          Rolling-label hover from the motion spec (§6.1): two stacked copies in
          a clipped box, both travelling up 100% so the label is replaced by an
          identical one. The second copy is decorative, hence aria-hidden — the
          link must not read its own name twice.
        */}
        <span className={s.magnet} data-magnet="">
          <Link href="/gallery" className={s.cta}>
            <span className={s.ctaRoll}>
              <span className={s.ctaLabel}>View full gallery</span>
              <span className={s.ctaLabel} aria-hidden="true">
                View full gallery
              </span>
            </span>
            <span className={s.ctaArrow} aria-hidden="true">
              &#8594;
            </span>
          </Link>
        </span>
      </div>

      {/*
        The stack. Each card sticks a little lower than the one before it, so a
        card arriving from below covers its predecessor and leaves a band of it
        showing. No JavaScript: sticky positioning already does exactly this, and
        a scrubbed timeline would only be a less reliable way of saying the same
        thing. --stack-step is what decides how much of the card underneath
        survives; the gap between them in flow is the scroll each one takes.
      */}
      <ol className={s.stack} aria-label="How Grigor works">
        {LINES.map((line, i) => (
          <li
            className={s.card}
            key={line.stage}
            style={{ "--i": i } as CSSProperties}
          >
            <div className={s.cardText}>
              <p className={s.quote}>{line.quote}</p>

              {/*
                Sits under the quote rather than in the footer: it is about the
                work shown alongside it, not about the stage named down there.
              */}
              <Link href={line.href} className={s.watch}>
                <span className={s.watchIcon} aria-hidden="true">
                  &#9654;
                </span>
                <span className={s.watchLabel}>Watch the film</span>
              </Link>

              <footer className={s.attribution}>
                <span className={s.index}>
                  {String(i + 1).padStart(2, "0")} /{" "}
                  {String(LINES.length).padStart(2, "0")}
                </span>
                <span className={s.who}>
                  <span className={s.name}>{line.stage}</span>
                  <span className={s.role}>{line.about}</span>
                </span>
              </footer>
            </div>

            {/*
              The still. The slot holds its 16:9 whether or not there is a
              frame in it, so a line added without one leaves the card's
              proportions exactly as they are.

              `sizes` follows the stylesheet: the full card on an upright
              phone, where the card is one column, and the narrower of two
              columns everywhere else.
            */}
            <div className={s.media}>
              {line.still ? (
                <Image
                  src={asset(line.still)}
                  alt=""
                  fill
                  sizes="(max-width: 600px) 82vw, (max-width: 900px) 36vw, 460px"
                  className={s.mediaImage}
                />
              ) : (
                <span className={s.mediaEmpty} aria-hidden="true">
                  Clip
                </span>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
