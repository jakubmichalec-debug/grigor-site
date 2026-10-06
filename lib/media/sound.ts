"use client";

import { useSyncExternalStore } from "react";

/**
 * §2.2 audio state contract.
 *
 * One answer to "does the visitor want sound", shared by everything that can
 * make any. It has to outlive the components that read it — the header toggle
 * unmounts when you leave the homepage and must come back in the same state —
 * and it is mirrored to sessionStorage so a reload inside the session keeps it.
 *
 * A module singleton with a subscription rather than a context provider, for
 * the reason lib/motion/scrollLock.ts gives: there is exactly one of these for
 * the whole app, and a provider would only add a tree every consumer has to sit
 * inside.
 *
 * Off by default, always. Nothing here can *start* audio: a browser only allows
 * that from inside a user gesture, so the component that owns the element
 * unmutes it in its own click handler and merely records the choice here.
 */

const KEY = "grigor:sound";

let on = false;
let restored = false;
const listeners = new Set<() => void>();

function restore() {
  if (restored || typeof window === "undefined") return;
  restored = true;
  try {
    on = window.sessionStorage.getItem(KEY) === "on";
  } catch {
    /* Storage can throw in private modes. Off is the right answer anyway. */
  }
}

export function getSound(): boolean {
  restore();
  return on;
}

export function setSound(next: boolean): void {
  restore();
  if (next === on) return;
  on = next;
  try {
    window.sessionStorage.setItem(KEY, next ? "on" : "off");
  } catch {
    /* See restore(). The in-memory value still carries the session. */
  }
  listeners.forEach((notify) => notify());
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
}

/**
 * The current choice, re-rendering when it changes.
 *
 * The server snapshot is `false`, so the markup always hydrates as "off" and
 * only then picks up a restored "on" — the label can be a beat late after a
 * reload, but the HTML never disagrees with what the server sent.
 */
export function useSound(): boolean {
  return useSyncExternalStore(subscribe, getSound, () => false);
}
