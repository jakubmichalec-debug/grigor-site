"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * §7.1 — "Pause off-screen work." True while the element is in the viewport
 * AND the tab is the one being looked at; video playback gates on it.
 *
 * Both halves matter. IntersectionObserver keeps reporting an element as
 * intersecting while its tab sits in the background, so on its own it would
 * leave a clip decoding (and, with sound on, playing) for nobody.
 *
 * Starts false: nothing is assumed visible until the observer has said so,
 * which also keeps the server render and the first client render in agreement.
 */
export function useOnScreen(ref: RefObject<Element | null>): boolean {
  const [inView, setInView] = useState(false);
  const [tabVisible, setTabVisible] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);

  useEffect(() => {
    const sync = () => setTabVisible(document.visibilityState === "visible");
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  return inView && tabVisible;
}

/**
 * §4.1 — "On Save-Data or a 2G connection, drop to the poster still."
 *
 * Read once, on the client, at the moment footage would otherwise start
 * downloading. `navigator.connection` is not in the DOM typings and not in
 * every browser; where it is missing the answer is simply "no constraint".
 */
export function prefersStills(): boolean {
  const connection = (
    navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }
  ).connection;
  if (!connection) return false;
  return (
    connection.saveData === true ||
    connection.effectiveType === "slow-2g" ||
    connection.effectiveType === "2g"
  );
}
