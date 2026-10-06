/**
 * Where the site is mounted.
 *
 * Empty when it sits at the root of a domain, which is every case but one: on
 * GitHub Pages a project is served from /<repository>, and nothing in /public
 * is found unless its address starts with that. next/link adds the prefix by
 * itself; next/image, <video> and anything else that names a file do not.
 *
 * Set at build time by the deploy and read by next.config.ts as well, so the
 * two cannot disagree.
 */
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** The address of a file in /public, from wherever the site is mounted. */
export const asset = (path: string) => `${BASE_PATH}${path}`;
