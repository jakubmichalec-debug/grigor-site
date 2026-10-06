/**
 * What the camera is showing.
 *
 * One entry per finished edit, in the order they step through. A manifest and
 * not nine hardcoded tags, so adding, dropping or reordering a clip is an edit
 * to this array and nothing else — the screen, the count under it and the
 * full-screen viewer all read from here.
 *
 * The files are derived, not hand-exported: see
 * `Jalub Website videos & photos/_header-edit/pipeline/` (site_assets.py for
 * the stills, encode_clips.py for the footage).
 */

import { asset } from "@/lib/media/asset";

export type Clip = {
  id: string;
  /** Shown under the camera and read out to assistive tech. */
  title: string;
  /**
   * Still frame, 3:2 like the screen. Always present: it is what the screen
   * holds until footage is playing, and what the viewer grows out of.
   */
  still: string;
  /** The edit itself, with its sound. Plays in the full-screen viewer. */
  video?: string;
  /**
   * The same edit as a small silent file, already cropped to the screen's 3:2.
   * This is what loops on the camera. Separate from `video` because the screen
   * is a few hundred pixels wide and autoplays: sending it the full-size file
   * would spend megabytes on something shown at thumbnail size, muted.
   */
  loop?: string;
  /** Intrinsic size of `still`, required by next/image. */
  width: number;
  height: number;
};

const STILL = { width: 1200, height: 800 };

const clip = (id: string, title: string): Clip => ({
  id,
  title,
  still: asset(`/clips/${id}.jpg`),
  video: asset(`/clips/${id}.mp4`),
  loop: asset(`/clips/${id}-loop.mp4`),
  ...STILL,
});

export const CLIPS: Clip[] = [
  clip("vitosha-100", "Vitosha 100"),
  clip("art-of-endurance", "The Art of Endurance"),
  clip("hyrox", "HYROX"),
  clip("chill-and-thrill", "Chill & Thrill"),
  clip("race-recap", "Race Recap"),
  clip("sunset-run", "Sunset Run"),
  clip("embrace-the-struggle", "Embrace the Struggle"),
  clip("race-prep", "Race Prep"),
  /*
   * Shot and cut vertical. The loop is a 3:2 window onto it; the viewer shows
   * it whole.
   */
  clip("hyrox-vertical", "HYROX, Vertical"),
];

export const CLIP_COUNT = CLIPS.length;

/** Steps the index by `delta`, wrapping in both directions. */
export function stepClip(index: number, delta: number): number {
  return (index + delta + CLIP_COUNT) % CLIP_COUNT;
}
