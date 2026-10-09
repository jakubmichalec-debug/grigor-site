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
 * On by default: the reel is meant to be heard. But nothing here can *start*
 * audio — a browser only allows that after a user gesture, and scrolling is not
 * one. So there are two facts, not one: whether the visitor wants sound (`on`,
 * persisted) and whether it is actually playing. When a browser refuses, the
 * component that owns the element records that here as `blocked`, plays silent,
 * and the toggle reads "Off" — the truth — until the first click or key press
 * lets it through. `blocked` is never persisted: it describes this page load.
 */

const KEY = "grigor:sound";

let on = true;
let blocked = false;
let restored = false;
const listeners = new Set<() => void>();

function restore() {
  if (restored || typeof window === "undefined") return;
  restored = true;
  try {
    /* Only an explicit "off" is a choice; absence is the default. */
    on = window.sessionStorage.getItem(KEY) !== "off";
  } catch {
    /* Storage can throw in private modes. The default is the right answer. */
  }
}

export function getSound(): boolean {
  restore();
  return on;
}

/** Whether the visitor wants sound, whether or not the browser has allowed it yet. */
export function setSound(next: boolean): void {
  restore();
  const changed = next !== on || (next && blocked);
  on = next;
  if (next) blocked = false;
  if (!changed) return;
  try {
    window.sessionStorage.setItem(KEY, next ? "on" : "off");
  } catch {
    /* See restore(). The in-memory value still carries the session. */
  }
  listeners.forEach((notify) => notify());
}

/** The browser refused to start the sound; the visitor still wants it. */
export function setBlocked(next: boolean): void {
  restore();
  if (next === blocked) return;
  blocked = next;
  listeners.forEach((notify) => notify());
}

const getAudible = () => getSound() && !blocked;
const getBlocked = () => getSound() && blocked;

function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
}

/**
 * Whether sound is actually playing, re-rendering when that changes.
 *
 * The server snapshot is `false`, so the markup always hydrates as "off" and
 * only then picks up "on" — the label can be a beat late, but the HTML never
 * disagrees with what the server sent.
 */
export function useSound(): boolean {
  return useSyncExternalStore(subscribe, getAudible, () => false);
}

/** Wanted but refused: waiting for the first gesture that lets it start. */
export function useSoundBlocked(): boolean {
  return useSyncExternalStore(subscribe, getBlocked, () => false);
}
