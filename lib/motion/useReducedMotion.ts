"use client";

import { useEffect, useState } from "react";

/**
 * §7.2 — `prefers-reduced-motion: reduce` must be honoured globally.
 *
 * Starts false so server and client render the same markup; the real value
 * arrives on mount. Components gate their GSAP setup on this, and render
 * their finished state in CSS so nothing is missing when motion is off.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return reduced;
}
