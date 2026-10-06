"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { DUR, EASE } from "@/lib/motion/tokens";
import { useReducedMotion } from "@/lib/motion/useReducedMotion";
import { lockScroll, unlockScroll } from "@/lib/motion/scrollLock";
import { CLIPS, CLIP_COUNT, stepClip } from "@/lib/camera/clips";
import s from "./ClipViewer.module.css";

/** Viewport rect the clip grows out of — the camera's screen, as clicked. */
export type Origin = { top: number; left: number; width: number; height: number };

/**
 * The box the clip occupies when shut. Normally the camera's screen; the
 * fallback only matters if the viewer is opened from somewhere with nothing to
 * grow out of, in which case a small centred box is the least surprising thing.
 */
function closedBox(origin: Origin | null) {
  if (origin) return origin;
  return {
    top: window.innerHeight * 0.5 - 80,
    left: window.innerWidth * 0.5 - 140,
    width: 280,
    height: 160,
  };
}

/**
 * Full-screen clip viewer (§6.1 overlay timing).
 *
 * The clip does not fade in; it *grows out of the camera's screen*. At the first
 * frame the frame element sits exactly over the screen, showing the same image
 * at the same crop, so the two are indistinguishable — then it expands to the
 * viewport while the page darkens behind it. Continuity is the whole trick, and
 * it costs nothing: both ends use `object-fit: cover`, so the browser re-crops
 * every frame and the picture opens up rather than stretching.
 *
 * Portalled to <body> on purpose. The camera sits inside a sticky stage, and the
 * moment any ancestor grows a transform, `position: fixed` starts resolving
 * against that ancestor instead of the viewport — the overlay would end up
 * pinned inside the camera. A portal makes that class of bug impossible rather
 * than relying on nobody adding a transform later.
 */
export function ClipViewer({
  index,
  origin,
  onStep,
  onClose,
  returnFocus,
}: {
  index: number;
  /** Where to grow from. Null falls back to a plain centred fade. */
  origin: Origin | null;
  onStep: (next: number) => void;
  onClose: () => void;
  /** Where focus goes on close. See the effect below for why this is explicit. */
  returnFocus?: RefObject<HTMLElement | null>;
}) {
  const root = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const footage = useRef<HTMLVideoElement>(null);
  const reduced = useReducedMotion();

  /** Exit has to finish before unmount, so closing is a state, not an event. */
  const [closing, setClosing] = useState(false);
  const requestClose = useCallback(() => setClosing(true), []);

  const clip = CLIPS[index];

  /*
   * Which clip has frames on screen, by id rather than as a flag: stepping to
   * another clip then reads as "not live" on the very render that swaps the
   * element, with nothing to reset.
   */
  const [liveId, setLiveId] = useState<string | null>(null);
  /*
   * And whether the box has finished opening. The still is cropped to fill the
   * box and the footage is letterboxed inside it, so swapping one for the other
   * while the box is still growing would visibly re-frame the picture mid-zoom.
   */
  const [opened, setOpened] = useState(false);
  const live = liveId === clip.id && opened && !closing;

  /*
   * Play, with sound. Opening the viewer and stepping it are both clicks or
   * key presses, so the browser will allow audio here where it would refuse it
   * anywhere else on the page — but only if play() is asked for promptly, which
   * is why this does not wait for the zoom to finish. The picture stays hidden
   * until the box has opened (see `live`); the sound simply leads it in.
   *
   * If audio is refused all the same, mute and go again: a silent clip is a
   * better outcome than a frozen still under a caption that says it plays.
   */
  useEffect(() => {
    const el = footage.current;
    if (!el) return;
    el.muted = false;
    el.play().catch((refusal: DOMException) => {
      /*
       * Only a refusal to play with sound. A play() promise also rejects when
       * a pause() overtakes it — stepping quickly does that, and so does the
       * cleanup below — and muting in answer to that would silence a clip the
       * browser was perfectly willing to play aloud.
       */
      if (refusal.name !== "NotAllowedError") return;
      el.muted = true;
      el.play().catch(() => {});
    });
    return () => el.pause();
  }, [clip.id]);

  /* On the way out the still takes over again, and it does not make noise. */
  useEffect(() => {
    if (closing) footage.current?.pause();
  }, [closing]);

  const togglePlayback = useCallback(() => {
    const el = footage.current;
    if (!el) return;
    if (el.paused) el.play().catch(() => {});
    else el.pause();
  }, []);

  /* The page must not scroll underneath. Lenis ignores overflow:hidden. */
  useEffect(() => {
    lockScroll();
    return unlockScroll;
  }, []);

  /*
   * Focus goes to the close button on open and back to the opener on exit —
   * without the restore, dismissing the overlay drops keyboard users at the top
   * of the document.
   *
   * The caller names the element to return to rather than this reading
   * document.activeElement, because what is focused when the overlay mounts
   * depends on how it was opened: a mouse click does not reliably focus a button
   * across browsers, and then "the opener" resolves to <body>.
   */
  useEffect(() => {
    // Resolved at mount, not at cleanup: the opener already exists by now, and
    // reading a ref during teardown is a race worth not having.
    const opener =
      returnFocus?.current ?? (document.activeElement as HTMLElement | null);
    closeBtn.current?.focus();
    return () => opener?.focus?.();
  }, [returnFocus]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        requestClose();
        return;
      }
      if (e.key === "ArrowLeft") onStep(stepClip(index, -1));
      if (e.key === "ArrowRight") onStep(stepClip(index, 1));
      /*
       * Space pauses, as it does in every player — unless a button has focus,
       * where Space already means "press this" and must keep meaning that.
       */
      if (e.key === " " && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        togglePlayback();
      }

      /*
       * Focus trap. Only two focusables in here, so a wrap is enough — no need
       * to enumerate the tree.
       */
      if (e.key === "Tab") {
        const focusable = root.current?.querySelectorAll<HTMLElement>(
          "button, [href], [tabindex]:not([tabindex='-1'])",
        );
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, onStep, requestClose, togglePlayback]);

  useGSAP(
    () => {
      const frameEl = frame.current;
      const backdropEl = backdrop.current;
      const rootEl = root.current;
      if (!frameEl || !backdropEl || !rootEl) return;

      /*
       * The clip's start and end boxes, in viewport pixels. Animating the box
       * itself rather than a transform is deliberate: a transform would scale
       * the picture non-uniformly (the camera screen is 3:2, the viewport
       * usually is not) and visibly squash it on the way. Resizing the box lets
       * `object-fit: cover` re-crop each frame, so the clip *opens* instead.
       * It is one fixed element, so there is no page layout to thrash.
       */
      const shut = closedBox(origin);
      const full = {
        top: 0,
        left: 0,
        width: window.innerWidth,
        height: window.innerHeight,
      };
      const chrome = Array.from(rootEl.querySelectorAll(`.${s.chrome}`));

      /*
       * §7.2 — no choreography. Note this cannot simply bail out: the clip's box
       * and the backdrop both start closed in the markup, so returning early
       * would leave a clip the size of the camera's screen and no backdrop at
       * all. "No animation" still has to arrive at the finished state.
       */
      if (reduced) {
        if (closing) {
          onClose();
          return;
        }
        gsap.set(frameEl, { ...full, borderRadius: 0 });
        gsap.set([backdropEl, ...chrome], { autoAlpha: 1 });
        setOpened(true);
        return;
      }

      if (closing) {
        gsap
          .timeline({ onComplete: onClose })
          .to(frameEl, {
            ...shut,
            borderRadius: 10,
            duration: DUR.overlay * 0.7,
            ease: EASE.inout,
          })
          .to(
            [backdropEl, ...chrome],
            { autoAlpha: 0, duration: DUR.overlay * 0.5, ease: EASE.inout },
            0,
          );
        return;
      }

      /*
       * `to`, not `fromTo`. A tween's starting values are only written on the
       * first ticker tick, which leaves one frame where the box has no size at
       * all — a visible flash at the exact moment the eye is on it. The closed
       * box is inline in the markup instead, so the very first paint is already
       * sitting on the camera's screen and GSAP only ever moves it outward.
       */
      gsap
        .timeline()
        .to(
          frameEl,
          {
            ...full,
            borderRadius: 0,
            duration: DUR.overlay,
            ease: EASE.inout,
            onComplete: () => setOpened(true),
          },
          0,
        )
        /*
         * The backdrop trails the clip slightly. Darkening the page first would
         * black out the camera a beat before the clip has left it, and the
         * illusion that the picture is lifting off the screen dies right there.
         */
        .to(
          backdropEl,
          { autoAlpha: 1, duration: DUR.overlay * 0.8, ease: EASE.inout },
          0.12,
        )
        .to(
          chrome,
          { autoAlpha: 1, duration: DUR.reveal, ease: EASE.expo },
          DUR.overlay * 0.65,
        );
    },
    { dependencies: [closing, reduced], scope: root },
  );

  return createPortal(
    <div
      ref={root}
      className={s.overlay}
      role="dialog"
      aria-modal="true"
      aria-label={`${clip.title}, ${index + 1} of ${CLIP_COUNT}`}
    >
      {/* Separate from the frame so it can fade on its own schedule. */}
      <div
        ref={backdrop}
        className={s.backdrop}
        onClick={requestClose}
        aria-hidden="true"
      />

      {/*
        The closed box is inline so the first paint already lands on the camera's
        screen — see the timeline above for why this is not GSAP's job.
      */}
      <div ref={frame} className={s.frame} style={{ ...closedBox(origin), borderRadius: 10 }}>
        <Image
          src={clip.still}
          alt={clip.title}
          fill
          sizes="100vw"
          className={s.media}
          data-covered={live ? "true" : undefined}
        />

        {/*
          Keyed, so a step swaps the element rather than re-pointing it: the
          outgoing clip stops dead instead of bleeding a frame into the next.
        */}
        {clip.video && (
          <video
            key={clip.id}
            ref={footage}
            className={s.footage}
            data-live={live ? "true" : undefined}
            src={clip.video}
            loop
            playsInline
            preload="auto"
            onPlaying={() => setLiveId(clip.id)}
            onClick={togglePlayback}
          />
        )}
      </div>

      <div className={`${s.meta} ${s.chrome}`}>
        <span className={s.title}>{clip.title}</span>
        <span className={s.count}>
          {String(index + 1).padStart(2, "0")} /{" "}
          {String(CLIP_COUNT).padStart(2, "0")}
        </span>
      </div>

      <button
        ref={closeBtn}
        type="button"
        className={`${s.close} ${s.chrome}`}
        onClick={requestClose}
      >
        <span className={s.closeLabel}>Close</span>
        <svg viewBox="0 0 24 24" aria-hidden="true" className={s.closeIcon}>
          <path
            d="M6 6l12 12M18 6L6 18"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>,
    document.body,
  );
}
