"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { EASE, SCROLL } from "@/lib/motion/tokens";
import { useReducedMotion } from "@/lib/motion/useReducedMotion";
import { asset } from "@/lib/media/asset";
import {
  getSound,
  setBlocked,
  setSound,
  useSound,
  useSoundBlocked,
} from "@/lib/media/sound";
import { prefersStills, useOnScreen } from "@/lib/media/useOnScreen";
import s from "./Intro.module.css";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const COLS = 7;
const ROWS = 5;
const TOTAL = COLS * ROWS; // 35
/** Dead centre of an odd × odd grid. 7 × 5 → index 17, row 3, column 4. */
const HERO = Math.floor(TOTAL / 2);

/** Scroll distance spent travelling from wall to fullscreen, in viewport heights. */
const ZOOM_VH = 200;
/**
 * Scroll distance the hero stays pinned and completely still *after* the zoom
 * tops out. Two jobs: it gives the viewer a beat to actually watch the opening
 * shot before the page moves on, and it buys the video time to load — on a slow
 * connection the hold is what stops you scrolling past a hero that hasn't
 * started yet.
 */
const HOLD_VH = 120;

const PIN_LENGTH = `+=${ZOOM_VH + HOLD_VH}%`;

/**
 * Handles for the page headline (components/home/Brandmark.tsx), which lives
 * outside this section but has to appear in step with its chrome.
 *
 * It reads the pin's resolved scroll range by id rather than declaring its own
 * trigger on this element. A second trigger here would be measured against the
 * *pinned* stage, whose top stays at the top of the viewport for the whole pin
 * — so "top top" resolves to the moment the pin ENDS, and the headline would
 * only start fading in once the hero was already leaving.
 */
export const INTRO_PIN_ID = "intro-pin";
/** The zoom occupies timeline 0→1; the dwell extends it past that. */
const HOLD_TIME = HOLD_VH / ZOOM_VH;
const TIMELINE_END = 1 + HOLD_TIME;
/** Scroll progress at which the hero is effectively full-bleed and "plays". */
const PLAY_AT = 0.95 / TIMELINE_END;
/** Scroll progress at which the chrome lands. Same reason as INTRO_PIN_VH. */
export const INTRO_CHROME_AT = 0.93 / TIMELINE_END;

/*
 * Three of these are in-page anchors rather than routes: the sections they name
 * already exist on this page, and sending someone to a stub route to read about
 * services they can see by scrolling would be worse than not linking at all.
 * Projects is the exception — the work genuinely lives on its own page.
 */
const NAV = [
  { href: "/gallery", label: "Projects" },
  { href: "#showcase", label: "Services" },
  { href: "#reviews", label: "About" },
  { href: "#contact", label: "Contact" },
];

/**
 * Deterministic per-tile lightness — the ground a tile sits on until its still
 * has loaded. A pure function of the index rather than Math.random(), so
 * server and client markup agree and hydration stays quiet.
 */
const lightness = (i: number) => 10 + ((i * 37) % 13);

/** Two digits, as printed on the tile and as its still is named on disk. */
const tileNo = (i: number) => String(i + 1).padStart(2, "0");

/**
 * The reel, §4.1: two sizes, each as WebM/VP9 with an H.264 fallback. The
 * browser takes the first entry it can play whose media query matches, so the
 * small ones come first and are fenced to the breakpoint the stylesheet uses.
 *
 * The codecs are spelled out on the WebM entries deliberately. A browser that
 * can open the container but not what is inside it would otherwise pick the
 * file, fail, and never try the MP4 below it.
 */
const REEL: { src: string; type: string; media?: string }[] = [
  {
    src: asset("/hero/reel-720.webm"),
    type: 'video/webm; codecs="vp9, opus"',
    media: "(max-width: 900px)",
  },
  {
    src: asset("/hero/reel-720.mp4"),
    type: "video/mp4",
    media: "(max-width: 900px)",
  },
  {
    src: asset("/hero/reel-1080.webm"),
    type: 'video/webm; codecs="vp9, opus"',
  },
  { src: asset("/hero/reel-1080.mp4"), type: "video/mp4" },
];

/**
 * The reel's first frame, handed to the stylesheet as a custom property. It
 * cannot be written there: a url() in CSS is an address fixed when the file is
 * written, and this one depends on where the site is mounted.
 */
const POSTER = { "--poster": `url("${asset("/hero/poster.jpg")}")` } as CSSProperties;

/**
 * §2.2 — "ramp gain over 400ms rather than cutting, so a mid-scroll toggle
 * does not pop." Off the §1.2 duration scale on purpose: the spec names this
 * number itself.
 */
const GAIN_RAMP = 0.4;

/**
 * Fades the reel's own volume up or down and mutes it once it reaches silence.
 * Shared by the toggle and by the first gesture that lets blocked sound start.
 * The tween in flight is kept in `ramp` so a second call replaces it.
 */
function fadeSound(
  el: HTMLVideoElement,
  next: boolean,
  ramp: { current: gsap.core.Tween | null },
) {
  ramp.current?.kill();
  const gain = { value: next ? 0 : el.volume };
  if (next) {
    el.volume = 0;
    el.muted = false;
  }
  ramp.current = gsap.to(gain, {
    value: next ? 1 : 0,
    duration: GAIN_RAMP,
    ease: EASE.none,
    onUpdate: () => {
      el.volume = Math.min(1, Math.max(0, gain.value));
    },
    onComplete: () => {
      if (next) return;
      el.muted = true;
      el.volume = 1;
    },
  });
}

export function Intro() {
  const stage = useRef<HTMLElement>(null);
  const parallax = useRef<HTMLDivElement>(null);
  const wall = useRef<HTMLDivElement>(null);
  const tiles = useRef<HTMLDivElement>(null);
  const hero = useRef<HTMLDivElement>(null);
  const reel = useRef<HTMLVideoElement>(null);
  /** The gain ramp in flight, so a second click replaces it instead of racing it. */
  const ramp = useRef<gsap.core.Tween | null>(null);
  const progress = useRef(0);

  /** The hero has arrived: the zoom is done, or was never going to run. */
  const [playing, setPlaying] = useState(false);
  /** The visitor's own pause, on top of everything the page decides. */
  const [held, setHeld] = useState(false);
  const reduced = useReducedMotion();
  const sound = useSound();
  const blocked = useSoundBlocked();
  /* §4.1 — "Pause when the hero leaves the viewport and when the tab is hidden." */
  const onScreen = useOnScreen(stage);
  const rolling = playing && onScreen && !held;

  /*
   * Start fetching the reel — after mount rather than from the markup, because
   * this is the one place Save-Data can be honoured: a `preload="auto"` in the
   * HTML is already downloading before any script has had a say. The wall and
   * its 200vh of zoom are what buy the time.
   */
  useEffect(() => {
    const el = reel.current;
    if (!el || prefersStills()) return;
    el.preload = "auto";
    el.load();
  }, []);

  /*
   * Play and pause. One effect, one boolean: every reason the reel should not
   * be running — still zooming, scrolled past, tab in the background, paused
   * by hand — is already folded into `rolling`.
   */
  useEffect(() => {
    const el = reel.current;
    if (!el) return;
    if (!rolling || prefersStills()) {
      el.pause();
      return;
    }
    /*
     * Set as a property every time. React does not serialise `muted` into the
     * server-rendered tag, and an element that is not muted is one a browser
     * will refuse to autoplay.
     */
    el.muted = !getSound();
    el.play().catch((refusal: DOMException) => {
      /*
       * Only a refusal to autoplay with sound is ours to answer. The other
       * way a play() promise rejects is being overtaken by a pause() — a quick
       * scroll back across the threshold does it — and answering that one
       * would restart a reel that had just been told to stop.
       */
      if (refusal.name !== "NotAllowedError" || el.muted) return;
      /*
       * Sound is wanted — it is the default — but this document has not had a
       * click or key press yet, and scrolling does not count. Audio cannot
       * start without one, so play silent, say so (the toggle reads "Off"
       * rather than claim a sound nobody can hear), and let the effect below
       * start it on the first gesture.
       */
      el.muted = true;
      setBlocked(true);
      el.play().catch(() => {});
    });
  }, [rolling]);

  /*
   * The first gesture after a refusal starts the sound. Listened for on the
   * window, so it can be a click anywhere or a key press — whichever the
   * visitor does first. The toggle is left to its own click handler, which
   * would otherwise be undone by this one running a moment earlier.
   */
  useEffect(() => {
    if (!blocked) return;
    const release = (event: Event) => {
      if (event instanceof KeyboardEvent && /^(Shift|Control|Alt|Meta)$/.test(event.key)) {
        return;
      }
      const target = event.target;
      if (target instanceof Element && target.closest("[data-sound-toggle]")) return;
      const el = reel.current;
      setSound(true);
      if (el) fadeSound(el, true, ramp);
    };
    const events = ["pointerdown", "keydown", "touchend"] as const;
    events.forEach((name) => window.addEventListener(name, release, true));
    return () => {
      events.forEach((name) => window.removeEventListener(name, release, true));
    };
  }, [blocked]);

  /*
   * Back at the wall, the reel goes back to its first frame. The tile at rest
   * is "the one in colour" because of what that frame is; left paused wherever
   * the reel happened to be, it could just as easily be a black-and-white one.
   */
  useEffect(() => {
    const el = reel.current;
    if (!el || playing) return;
    el.pause();
    if (el.currentTime > 0) el.currentTime = 0;
  }, [playing]);

  /*
   * §2.2 — unmute inside the click handler itself, in the same task. A deferred
   * call loses the user-gesture grant and Safari will reject it.
   */
  const toggleSound = () => {
    const el = reel.current;
    const next = !sound;
    setSound(next);
    if (el) fadeSound(el, next, ramp);
  };

  useGSAP(
    () => {
      const stageEl = stage.current;
      const wallEl = wall.current;
      const tilesEl = tiles.current;
      const heroEl = hero.current;
      const plxEl = parallax.current;
      if (!stageEl || !wallEl || !tilesEl || !heroEl || !plxEl) return;

      if (reduced) {
        setPlaying(true);
        return;
      }

      /*
       * The scale that makes the centre tile cover the viewport. On a 16:9
       * screen with 16:9 tiles this comes out to exactly the column count — 7.
       * offsetWidth/Height are layout sizes, so they're unaffected by whatever
       * transform the wall currently carries; re-measured on every refresh.
       */
      let target = 1;
      const measure = () => {
        target =
          Math.max(
            window.innerWidth / heroEl.offsetWidth,
            window.innerHeight / heroEl.offsetHeight,
          ) * 1.02; // hair of overshoot so no seam shows at the edges
      };
      measure();

      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          id: INTRO_PIN_ID,
          trigger: stageEl,
          start: "top top",
          end: PIN_LENGTH,
          pin: true,
          scrub: SCROLL.scrub,
          invalidateOnRefresh: true,
          onRefresh: measure,
          onUpdate: (self) => {
            progress.current = self.progress;
            const on = self.progress > PLAY_AT;
            setPlaying((prev) => (prev === on ? prev : on));
          },
        },
      });

      /*
       * Exponential, not linear. A linear 1 → 7 scale tween feels sluggish at
       * the start and violent at the end, because perceived zoom rate is the
       * ratio of change rather than the difference. scale = target^p holds the
       * perceived speed constant the whole way in.
       */
      /*
       * A real tween of the wall's own scale, with the curve as its ease —
       * not a number tweened on the side and copied across in onUpdate. When
       * ScrollTrigger refreshes it puts the timeline back where it was with
       * callbacks suppressed, so a copied value is simply never written:
       * arriving at "/#header" from the gallery left the chrome up and the
       * hero still the size of a tile. The ease reads `target` when called,
       * so it stays exact after a re-measure.
       */
      const exponential = (p: number) =>
        Math.abs(target - 1) < 1e-6
          ? p
          : (Math.pow(target, p) - 1) / (target - 1);
      tl.fromTo(
        wallEl,
        { scale: 1 },
        { scale: () => target, duration: 1, ease: exponential },
        0,
      );

      /*
       * Without this the edge tiles become enormous smears across the screen.
       *
       * One tween on the layer that holds them, not one per tile. Opacity is
       * only free when the thing fading is its own compositor layer; written
       * to thirty-four tiles painted into the wall, every frame of the fade
       * was a repaint of the wall, in the middle of the one move on the page
       * that can least afford one.
       */
      tl.to(tilesEl, { opacity: 0, duration: 0.45 }, 0.15);

      tl.to("[data-cue]", { opacity: 0, duration: 0.12 }, 0);
      tl.fromTo(
        "[data-chrome]",
        { opacity: 0 },
        { opacity: 1, duration: 0.06 },
        0.93,
      );

      /*
       * The dwell. Nothing animates here — the pin simply keeps holding, so
       * you carry on scrolling and the hero stays put. Empty tween rather than
       * a longer `end`, so every position above stays expressed in zoom time
       * and changing HOLD_VH can't shift when the chrome or headline land.
       */
      tl.to({}, { duration: HOLD_TIME }, 1);

      /* Pointer tilt — alive at rest, damped out as the zoom takes over. */
      const pos = { x: 0, y: 0 };
      const aim = { x: 0, y: 0 };
      const AMP = 8;

      const onMove = (e: PointerEvent) => {
        aim.x = (e.clientX / window.innerWidth - 0.5) * 2;
        aim.y = (e.clientY / window.innerHeight - 0.5) * 2;
      };
      window.addEventListener("pointermove", onMove, { passive: true });

      const tick = () => {
        const damp = 1 - Math.min(1, progress.current / 0.3);
        pos.x += (aim.x - pos.x) * 0.06;
        pos.y += (aim.y - pos.y) * 0.06;
        gsap.set(plxEl, { x: -pos.x * AMP * damp, y: -pos.y * AMP * damp });
      };
      gsap.ticker.add(tick);

      /*
       * ScrollTrigger computes `end` during a refresh, and it batches one at
       * startup. A trigger created after that batch never gets refreshed, so
       * `end` stays undefined and the pin reserves zero scroll distance.
       *
       * That is exactly what happens here: useGSAP runs in useLayoutEffect, so
       * under StrictMode the first context is reverted and the surviving
       * trigger is created too late to catch the startup refresh. Refreshing
       * on setup makes this correct whenever the component mounts — including
       * client-side route changes, which have no startup refresh at all.
       */
      ScrollTrigger.refresh();

      /*
       * Arriving at "/#header" — from the wordmark, or back from the gallery —
       * means someone wanted the header, not the opening zoom again. Land at the
       * end of the pin, where the hero has finished arriving and the chrome is
       * up, rather than replaying an animation they have already sat through.
       *
       * Set directly rather than smooth-scrolled: this is a destination, not a
       * journey, and watching the page race through the zoom to get there is the
       * thing being avoided.
       */
      if (window.location.hash === "#header") {
        const pin = ScrollTrigger.getById(INTRO_PIN_ID);
        if (pin) {
          window.scrollTo({ top: pin.end, behavior: "instant" as ScrollBehavior });
          ScrollTrigger.update();
        }
      }

      return () => {
        window.removeEventListener("pointermove", onMove);
        gsap.ticker.remove(tick);
      };
    },
    { scope: stage, dependencies: [reduced], revertOnUpdate: true },
  );

  return (
    <section
      ref={stage}
      data-intro-stage=""
      className={s.stage}
      data-reduced={reduced ? "true" : undefined}
    >
      <div ref={parallax} className={s.parallax}>
        <div ref={wall} className={s.wall}>
          {/*
            Decorative: the wall carries no information the chrome doesn't.

            One element around every tile but the hero, because the fade is a
            property of the group and has to land on a single layer — see the
            timeline above. The hero's place in the grid is kept by an empty
            slot, so the other thirty-four fall exactly where they always did.
          */}
          <div ref={tiles} className={s.tiles} aria-hidden="true">
            {Array.from({ length: TOTAL }, (_, i) =>
              i === HERO ? (
                <div key={i} className={s.slot} />
              ) : (
                <div
                  key={i}
                  className={s.tile}
                  style={{ "--l": `${lightness(i)}%` } as CSSProperties}
                >
                  {/*
                    Eager, all of them: the wall is the first screen, so there
                    is no "below the fold" for lazy loading to wait on.
                  */}
                  <Image
                    src={asset(`/wall/${tileNo(i)}.jpg`)}
                    alt=""
                    fill
                    sizes="(max-width: 900px) 28vw, 15vw"
                    loading="eager"
                    className={s.tileImg}
                  />
                </div>
              ),
            )}
          </div>

          {/*
            The one in colour. Laid over the empty slot rather than sitting in
            the grid, so it is no part of the layer that fades.

            No `poster`: the tile's own background is the reel's first frame
            (see .hero), and the element paints over it the moment it has a
            frame of its own. That matters for the zoom — a poster is an image
            painted at the size the tile is at rest and goes soft blown up
            sevenfold, where a decoded frame is drawn at whatever size it lands.
          */}
          <div ref={hero} className={s.hero} style={POSTER}>
            <video
              ref={reel}
              className={s.reel}
              muted
              loop
              playsInline
              preload="none"
              aria-label="Showreel"
            >
              {REEL.map((source) => (
                <source key={source.src} {...source} />
              ))}
            </video>
          </div>
        </div>
      </div>

      {/*
       * Hidden by `.enters-with-motion` until the zoom is nearly complete, then
       * scrubbed in. Reduced motion and JS-off both un-hide it declaratively
       * (globals.css and the layout's <noscript>), so neither ends up looking
       * at a hero with no header on it.
       */}
      <div className={`${s.chrome} enters-with-motion`} data-chrome="">
        <div className={s.bar}>
          <Link href="/#header" className={s.wordmark}>
            Grigor
          </Link>
          <nav className={s.nav}>
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className={s.navLink}>
                {n.label}
              </Link>
            ))}
          </nav>
          {/*
            §2.2 — the label crossfades, so both states live in the markup and
            trade opacity. They are hidden from assistive tech, which gets one
            stable name and a pressed state instead of a label that renames
            the control every time it is used.
          */}
          <button
            type="button"
            className={s.sound}
            aria-label="Sound"
            aria-pressed={sound}
            data-sound-toggle=""
            onClick={toggleSound}
          >
            <span
              className={s.soundLabel}
              data-shown={sound ? undefined : "true"}
              aria-hidden="true"
            >
              [ Sound: Off ]
            </span>
            <span
              className={s.soundLabel}
              data-shown={sound ? "true" : undefined}
              aria-hidden="true"
            >
              [ Sound: On ]
            </span>
          </button>
        </div>

        {/*
          The headline used to live here. It now belongs to Brandmark, which
          renders it on a fixed layer so it can outlive this section's pin and
          carry on down into the showcase.
        */}
        <div className={s.foot}>
          <div className={s.meta}>
            {/*
              The status light is also the pause control. A reel that starts by
              itself and loops needs one, and the place people look to see
              whether it is running is the place to put it.
            */}
            <button
              type="button"
              className={s.badge}
              data-playing={playing && !held ? "true" : "false"}
              disabled={!playing}
              aria-label={
                !playing
                  ? "Standby"
                  : held
                    ? "Paused — play the reel"
                    : "Playing — pause the reel"
              }
              onClick={() => setHeld((was) => !was)}
            >
              <i className={s.dot} />
              {!playing ? "Standby" : held ? "Paused" : "Playing"}
            </button>
            <p>Directed, shot and cut in-house. Selected work, 2024—2026.</p>
          </div>
        </div>
      </div>

      <div className={s.cue} data-cue="">
        <span>Scroll</span>
        <i className={s.cueRule} />
      </div>
    </section>
  );
}
