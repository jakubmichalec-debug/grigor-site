"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import Image from "next/image";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { useGSAP } from "@gsap/react";
import { EASE, SCROLL } from "@/lib/motion/tokens";
import { useReducedMotion } from "@/lib/motion/useReducedMotion";
import { asset } from "@/lib/media/asset";
import { prefersStills, useOnScreen } from "@/lib/media/useOnScreen";
import { CLIPS, CLIP_COUNT, stepClip, type Clip } from "@/lib/camera/clips";
import {
  FRAME,
  HIT,
  PHASE,
  SCREEN,
  SCROLL_PLAN,
  TIMELINE_VH,
  asPercent,
  panelRadius,
} from "@/lib/camera/geometry";
import { CameraOutline } from "./CameraOutline";
import { ClipViewer, type Origin } from "./ClipViewer";
import s from "./Camera.module.css";

gsap.registerPlugin(ScrollTrigger, DrawSVGPlugin, useGSAP);

/*
 * All four phase numbers live in lib/camera/geometry.ts, next to the rendered
 * size they depend on, because they are not independent of it: the stage is
 * sticky and centred, so how late the drawing may start is a function of how
 * tall the camera is. camera.check.mts asserts the relationship holds.
 */
const SECTION_VH = SCROLL_PLAN.sectionVh;

/**
 * The footage for the clip the screen is on.
 *
 * One element, keyed by clip, so stepping remounts it: only the clip being
 * looked at is ever downloaded, and a clip never inherits the playhead of the
 * one before it. Nothing is fetched until `play` first goes true — the section
 * is 570vh tall and most visitors to the page top never reach it.
 *
 * It sits over the still and stays transparent until frames are actually
 * arriving, so a slow connection shows the still for longer rather than a
 * black rectangle where the picture was.
 */
function Footage({ clip, play }: { clip: Clip; play: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const [live, setLive] = useState(false);
  const src = clip.loop ?? clip.video;

  useEffect(() => {
    const el = video.current;
    if (!el) return;
    if (play && !prefersStills()) {
      /* A refused autoplay is not an error to handle: the still is underneath. */
      el.play().catch(() => {});
    } else {
      el.pause();
    }
  }, [play]);

  if (!src) return null;

  return (
    <video
      ref={video}
      className={s.footage}
      data-live={live ? "true" : undefined}
      src={src}
      muted
      loop
      playsInline
      preload="none"
      onPlaying={() => setLive(true)}
      aria-hidden="true"
      tabIndex={-1}
    />
  );
}

export function Camera() {
  const section = useRef<HTMLElement>(null);
  const rig = useRef<HTMLDivElement>(null);
  const display = useRef<HTMLDivElement>(null);
  /* Named so the viewer can hand focus back here, whatever opened it. */
  const openBtn = useRef<HTMLButtonElement>(null);
  const reduced = useReducedMotion();
  /* §7.1 — the loop only runs while the screen is actually in front of someone. */
  const displayVisible = useOnScreen(display);

  const [index, setIndex] = useState(0);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  /** Where the clip grows from, captured at click so the zoom starts on-screen. */
  const [origin, setOrigin] = useState<Origin | null>(null);
  const step = useCallback((delta: number) => {
    setIndex((i) => stepClip(i, delta));
  }, []);

  const openViewer = useCallback(() => {
    const screenEl = rig.current?.querySelector<HTMLElement>("[data-screen]");
    const r = screenEl?.getBoundingClientRect();
    setOrigin(
      r ? { top: r.top, left: r.left, width: r.width, height: r.height } : null,
    );
    setOpenIndex(index);
  }, [index]);

  useGSAP(
    () => {
      const sectionEl = section.current;
      const rigEl = rig.current;
      if (!sectionEl || !rigEl || reduced) return;

      const svg = rigEl.querySelector<SVGSVGElement>("[data-outline]");
      const photo = rigEl.querySelector<HTMLElement>("[data-photo]");
      const screen = rigEl.querySelector<HTMLElement>("[data-screen]");
      const controls = rigEl.querySelector<HTMLElement>("[data-controls]");
      const steps = sectionEl.querySelector<HTMLElement>("[data-steps]");
      const legend = sectionEl.querySelector<HTMLElement>("[data-legend]");
      if (!svg || !photo || !screen || !controls || !legend || !steps) return;

      /*
       * Nothing is hidden in markup or CSS — the finished, fully resolved camera
       * is what renders with no JS and under reduced motion. The starting state
       * of the entrance only exists once motion is confirmed on, which is the
       * same bargain components/home/Showcase.tsx makes.
       */
      gsap.set([photo, screen, legend], { opacity: 0 });
      /* Dark ground to begin with — see --flip in Camera.module.css. */
      gsap.set(sectionEl, { "--flip": 0 });
      /* Starts blank, not at full strength — see the fade in the timeline. */
      gsap.set(svg, { opacity: 0 });
      /* Not clickable until the camera has actually resolved — see the sets below. */
      gsap.set([controls, steps], { pointerEvents: "none" });

      const drawn = Array.from(
        svg.querySelectorAll<SVGGeometryElement>("[data-draw] > *"),
      );
      /*
       * Dash the strokes out of existence so they can be drawn back in. Rect and
       * circle answer getTotalLength as well as path does, so the shapes do not
       * have to be rewritten as paths just to animate. A zero length (an element
       * that cannot measure itself) falls through to simply being visible, which
       * is the right failure: a missing flourish, not a missing camera.
       */
      /*
       * DrawSVG owns the dash maths now. It was hand-rolled — measure each path
       * with getTotalLength, set a dasharray, animate the offset — and the hand
       * version had a trap in it: at a dashoffset exactly equal to the path
       * length the path sits on the boundary between dash and gap, and a round
       * line cap renders that boundary as a dot. The workaround was a gap four
       * units longer than the dash with the offset overshooting by two. The
       * plugin does not need the trick, and it also handles rect and circle
       * without their having to answer getTotalLength.
       *
       * The outline still fades from and to zero opacity at both ends of the
       * section, so even if a browser paints a speck at 0% there is nothing on
       * screen to paint it onto.
       */
      gsap.set(drawn, { drawSVG: "0%" });

      /*
       * The fine detail is faded, not drawn. Dashing a path made of 44 separate
       * knurl ticks animates every tick at once and reads as a flicker rather
       * than a hand moving. Each group keeps its authored opacity as the target,
       * so the drawing lands exactly as designed rather than flat at 1.
       */
      const fades = Array.from(svg.querySelectorAll<SVGElement>("[data-fade]"));
      const authored = fades.map((el) =>
        Number(el.getAttribute("opacity") ?? 1),
      );
      gsap.set(fades, { opacity: 0 });

      /*
       * ONE timeline for the whole section, authored in viewport heights so its
       * time axis and the scroll distance are the same numbers. Scrub maps the
       * two linearly, so a phase boundary in PHASE is literally where it lands
       * on screen.
       */
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionEl,
          /*
           * Deliberately late. The camera is centred in a sticky stage, so while
           * the section is still arriving it sits half a viewport below the
           * section's top — starting any earlier draws it off-screen and the
           * viewer meets a camera that has already finished drawing itself.
           */
          start: `top ${SCROLL_PLAN.drawEnterPct}%`,
          end: `+=${TIMELINE_VH}%`,
          scrub: SCROLL.scrub,
          invalidateOnRefresh: true,
        },
      });

      /* ── draw on ──────────────────────────────────────────────────────── */
      /*
       * Fade the whole drawing up as the first strokes appear. Belt and braces
       * with the dash gap above: whatever a browser decides to render for a
       * fully retracted stroke, at opacity 0 the section simply starts black.
       */
      tl.to(svg, { opacity: 1, ease: EASE.none, duration: 8 }, PHASE.draw);

      tl.to(
        drawn,
        {
          drawSVG: "100%",
          ease: EASE.none,
          duration: 40,
          stagger: { each: 0.7 },
        },
        PHASE.draw,
      ).to(
        fades,
        {
          opacity: (i: number) => authored[i],
          ease: EASE.none,
          duration: 12,
          stagger: { each: 0.9 },
        },
        PHASE.draw + 33,
      );

      /* ── resolve into the photograph ──────────────────────────────────── */
      /*
       * The order is the whole effect. The photograph comes up *underneath* a
       * still-visible outline, so for a moment the drawing is sitting exactly on
       * top of the real thing — which only works because both were built from
       * the same coordinate space. Only then do the strokes leave.
       */
      tl.to(photo, { opacity: 1, ease: EASE.none, duration: 39 }, PHASE.morph)
        .to(svg, { opacity: 0, ease: EASE.none, duration: 25 }, PHASE.morph + 31)
        .to(
          [screen, legend],
          { opacity: 1, ease: EASE.none, duration: 28 },
          PHASE.morph + 42,
        );

      /*
       * ── the page turns white ──────────────────────────────────────────────
       *
       * Late in the hold, while the camera is fully resolved and standing still.
       * Doing it here rather than in the gap between sections is the whole point:
       * you watch the ground change under something you can still see, and the
       * camera — a black object photographed on white — belongs on either.
       *
       * It finishes before the exit begins, so the outline comes back already in
       * ink and the strokes retract on white. By the section boundary the page
       * is paper, which is what the reviews section is standing on, so there is
       * no edge left to cross.
       */
      tl.to(
        sectionEl,
        { "--flip": 1, ease: EASE.none, duration: 55 },
        PHASE.hold + SCROLL_PLAN.holdVh * 0.55,
      );

      /* ── hold: anchored, still, and the only phase you can click in ───── */
      tl.set([controls, steps], { pointerEvents: "auto" }, PHASE.hold).set(
        [controls, steps],
        { pointerEvents: "none" },
        PHASE.unmorph,
      );

      /*
       * ── and back out again ───────────────────────────────────────────────
       *
       * The entry in reverse, not a new idea: the photograph sinks away beneath
       * the outline, which returns first so there is never a frame with nothing
       * in it, and then the strokes retract. Staggered `from: "end"` so the
       * drawing unwinds from its details back to the body — the mirror of the
       * order it arrived in.
       */
      tl.to(
        [screen, legend],
        { opacity: 0, ease: EASE.none, duration: 30 },
        PHASE.unmorph,
      )
        .to(svg, { opacity: 1, ease: EASE.none, duration: 38 }, PHASE.unmorph + 6)
        .to(photo, { opacity: 0, ease: EASE.none, duration: 70 }, PHASE.unmorph + 20);

      tl.to(
        fades,
        {
          opacity: 0,
          ease: EASE.none,
          duration: 14,
          stagger: { each: 0.9, from: "end" },
        },
        PHASE.undraw,
      ).to(
        drawn,
        {
          drawSVG: "0%",
          ease: EASE.none,
          /*
           * The stagger adds (count - 1) x each on top of the duration, so this
           * is not free to grow: at 32 the last stroke finished 5vh past
           * PHASE.end, stretching the timeline beyond the scroll it is scrubbed
           * across and quietly shifting every earlier phase off its mark.
           */
          duration: 54,
          stagger: { each: 0.55, from: "end" },
        },
        PHASE.undraw + 8,
      );

      /*
       * And the drawing goes out the way it came in: to nothing at all. Without
       * this the retracted strokes sit at full opacity, and any speck a browser
       * chooses to render at a dash boundary stays on screen after the camera
       * has gone.
       */
      tl.to(
        svg,
        { opacity: 0, ease: EASE.none, duration: 14 },
        PHASE.end - 14,
      );

      /*
       * The phase budget is authored by hand, and a tween that overruns its
       * phase does not fail loudly — it just compresses everything, because
       * scrub maps the scroll range onto whatever duration the timeline ended
       * up with. Say so while there is still someone to tell.
       */
      if (process.env.NODE_ENV === "development") {
        const over = tl.duration() - TIMELINE_VH;
        if (Math.abs(over) > 1) {
          console.warn(
            `[camera] timeline is ${tl.duration().toFixed(1)}vh but the plan ` +
              `budgets ${TIMELINE_VH}vh (${over > 0 ? "over" : "under"} by ` +
              `${Math.abs(over).toFixed(1)}). Phase boundaries will not land ` +
              "where PHASE says they do.",
          );
        }
      }

      ScrollTrigger.refresh();
    },
    { scope: section, dependencies: [reduced], revertOnUpdate: true },
  );

  const clip = CLIPS[index];

  return (
    <section
      ref={section}
      className={s.section}
      data-camera=""
      data-reduced={reduced ? "true" : undefined}
      aria-labelledby="camera-heading"
      style={{ "--section-vh": `${SECTION_VH}vh` } as CSSProperties}
    >
      <h2 className={s.srOnly} id="camera-heading">
        Selected clips, shown on the camera
      </h2>

      {/*
        Arrow keys live on the stage, not the camera: the step buttons sit below
        the rig now, and a handler on the rig would go deaf the moment focus
        moved to one of them.
      */}
      <div
        className={s.stage}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            step(-1);
          }
          if (e.key === "ArrowRight") {
            e.preventDefault();
            step(1);
          }
        }}
      >
        <div
          ref={rig}
          className={s.rig}
          style={{ "--frame-ratio": `${FRAME.w} / ${FRAME.h}` } as CSSProperties}
        >
          <Image
            data-photo=""
            className={s.photo}
            src={asset("/camera/a6700.png")}
            alt=""
            width={FRAME.w}
            height={FRAME.h}
            /*
             * Not `priority` — deprecated in Next 16. The morph is scroll-driven
             * and cannot wait for a lazy fetch, so the photograph loads eagerly:
             * arriving late would be a visible pop mid-transition.
             */
            loading="eager"
            sizes="(max-width: 900px) 92vw, min(1100px, 82vw)"
          />

          {/* The clips, sitting in the exact rectangle of the screen glass. */}
          <div
            ref={display}
            data-screen=""
            className={s.screen}
            style={{ ...asPercent(SCREEN), borderRadius: panelRadius() }}
          >
            {CLIPS.map((c, i) => (
              <Image
                key={c.id}
                src={c.still}
                alt=""
                fill
                sizes="(max-width: 900px) 46vw, 520px"
                className={s.slide}
                /*
                 * Position relative to the active one, so the outgoing slide
                 * leaves the way the incoming one arrives. Pure CSS off a data
                 * attribute — no per-step tween to fight React's re-render.
                 */
                data-pos={i === index ? "active" : i < index ? "before" : "after"}
              />
            ))}

            {/*
              Held still under reduced motion (§7.2): the frame is the content
              there, and the clip is one click away in the viewer. Also paused
              while the viewer is open — it is playing the same edit, with
              sound, directly on top of this.
            */}
            <Footage
              key={clip.id}
              clip={clip}
              play={displayVisible && !reduced && openIndex === null}
            />
          </div>

          <CameraOutline className={s.outline} />

          {/*
            The screen, and only the screen. Stepping moved off the camera to
            the orange buttons below — an invisible rectangle over a photograph
            of a button was always asking people to guess.
          */}
          <div className={s.controls} data-controls="">
            <button
              ref={openBtn}
              type="button"
              className={`${s.hit} ${s.open}`}
              style={asPercent(HIT.open)}
              onClick={openViewer}
            >
              <span className={s.srOnly}>
                Open {clip.title} full screen, {index + 1} of {CLIP_COUNT}
              </span>
            </button>
          </div>
        </div>

        {/*
          Wrapped so the legend fades with the camera. Left on screen while the
          outline retracts, it would be a caption for something no longer there.
        */}
        <div data-legend="" className={s.legend}>
          {/*
            The controls, and between them the thing they control. Grouping the
            count with the buttons means the number you are changing is where
            you are already looking when you change it.
          */}
          <div className={s.steps} data-steps="">
            <button
              type="button"
              className={s.step}
              data-dir="prev"
              onClick={() => step(-1)}
            >
              <span className={s.stepArrow} aria-hidden="true">
                &#9664;
              </span>
              <span className={s.stepLabel}>Prev</span>
            </button>

            <p className={s.caption} aria-live="polite">
              <span className={s.captionTitle}>{clip.title}</span>
              <span className={s.captionCount}>
                {String(index + 1).padStart(2, "0")} /{" "}
                {String(CLIP_COUNT).padStart(2, "0")}
              </span>
            </p>

            <button
              type="button"
              className={s.step}
              data-dir="next"
              onClick={() => step(1)}
            >
              <span className={s.stepLabel}>Next</span>
              <span className={s.stepArrow} aria-hidden="true">
                &#9654;
              </span>
            </button>
          </div>

        {/*
          The buttons below explain themselves; that clicking the screen opens
          the clip full screen is the part nobody discovers on their own, so the
          orange line is spent on that instead. aria-hidden because the screen
          already carries a proper button name.
        */}
        <p className={s.hint} aria-hidden="true">
          Click the screen to play
        </p>
        </div>
      </div>

      {openIndex !== null && (
        <ClipViewer
          index={openIndex}
          origin={origin}
          onStep={(next) => {
            setOpenIndex(next);
            setIndex(next);
          }}
          onClose={() => setOpenIndex(null)}
          returnFocus={openBtn}
        />
      )}
    </section>
  );
}
