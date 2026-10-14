"use client";

import { useSyncExternalStore } from "react";

/** Portrait-phone widths, where the home sections swap to shorter layouts. */
export const PHONE_QUERY = "(max-width: 600px)";

const subscribe = (cb: () => void) => {
  const mq = window.matchMedia(PHONE_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

/* False on the server, so markup agrees with desktop until the client says otherwise. */
export function usePhone(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(PHONE_QUERY).matches,
    () => false,
  );
}
