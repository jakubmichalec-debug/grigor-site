"use client";

/**
 * Page scroll lock, for full-screen overlays (§6.1).
 *
 * Lenis owns scrolling, so `overflow: hidden` alone does not stop it — it keeps
 * running its own transform and the page slides behind the overlay. The engine
 * instance therefore has to be reachable from outside SmoothScroll, which is
 * what this module is for: SmoothScroll registers on mount, overlays borrow it.
 *
 * Deliberately a module singleton rather than context. There is exactly one
 * scroll engine for the whole app, mounted above the route boundary, and a
 * provider would only add a tree that every consumer has to sit inside.
 */

type ScrollEngine = { stop(): void; start(): void };

let engine: ScrollEngine | null = null;

/** Called by SmoothScroll. Returns the matching de-registration. */
export function registerScrollEngine(instance: ScrollEngine): () => void {
  engine = instance;
  return () => {
    if (engine === instance) engine = null;
  };
}

/*
 * Counted, not boolean. Two overlays open at once — a fullscreen clip over an
 * already-open menu — must not have the first one to close release the page.
 */
let depth = 0;
let restoreOverflow = "";

export function lockScroll(): void {
  depth++;
  if (depth > 1) return;

  engine?.stop();

  /*
   * Under reduced motion SmoothScroll bails out early and never constructs
   * Lenis, so there is no engine to stop and the page is on native scroll.
   * Belt and braces: this also covers a stray wheel event reaching the document
   * while the engine is stopped.
   */
  restoreOverflow = document.documentElement.style.overflow;
  document.documentElement.style.overflow = "hidden";
}

export function unlockScroll(): void {
  depth = Math.max(0, depth - 1);
  if (depth > 0) return;

  document.documentElement.style.overflow = restoreOverflow;
  engine?.start();
}
