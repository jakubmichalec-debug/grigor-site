"""Frame selection for a clip: which source frames become the output frames.

The sources are finished edits with mixed internal cadence (25p in a 50p
timeline, 30p in 59.94, slow-mo made by repeating frames...). Conforming them
blindly would stutter, so a clip is defined as "the next N *new* frames from
this in-point, taking every `step`-th".

Repeat test (local, so long takes with changing motion work): a re-encoded
repeat differs from its predecessor only by encoder noise, i.e. far less than
the real frames around it. Frame n is a repeat when its difference score is
below 15% of the local high-water mark (85th percentile over +-7 frames) and
below an absolute noise ceiling.
"""
import numpy as np

from scores import load

NOISE_CEIL = 0.004
REL = 0.15
WIN = 7


def repeat_mask(vid, a, b):
    """Boolean array over [a, b): True where the frame repeats the previous one."""
    _, s = load(vid)
    b = min(b, len(s))
    m = np.zeros(b - a, dtype=bool)
    for n in range(a + 1, b):
        lo, hi = max(a, n - WIN), min(b, n + WIN + 1)
        w = s[lo:hi]
        w = w[w < 0.3]
        if len(w) < 4:
            continue
        high = np.percentile(w, 85)
        m[n - a] = s[n] < min(NOISE_CEIL, REL * high)
    return m


def unique_frames(vid, a, b, mode="auto"):
    """Source frame numbers in [a, b) that are new images."""
    _, s = load(vid)
    b = min(b, len(s))
    if mode == "none":
        return list(range(a, b))
    m = repeat_mask(vid, a, b)
    return [a] + [n for n in range(a + 1, b) if not m[n - a]]


def select(vid, a, count, step=1, mode="auto", limit=None):
    """`count` output frames starting at source frame `a` (never past `limit`)."""
    _, s = load(vid)
    end = len(s) if limit is None else min(limit, len(s))
    u = unique_frames(vid, a, end, mode)[::step]
    return u[:count]


def marks(vid, a, b, chosen=None):
    """Cadence string for [a,b) with the kept frames upper-cased as '^' markers on a second line."""
    from scores import sym
    _, s = load(vid)
    u = set(chosen if chosen is not None else unique_frames(vid, a, b))
    top = "".join(sym(s[n]) for n in range(a, min(b, len(s))))
    bot = "".join("^" if n in u else " " for n in range(a, min(b, len(s))))
    return top, bot


if __name__ == "__main__":
    import sys
    vid, a, b = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
    u = unique_frames(vid, a, b)
    print(f"{vid} [{a},{b}) src {b - a} -> {len(u)} new frames ({len(u) / 13.043:.2f} beats @30p)")
    top, bot = marks(vid, a, b)
    for k in range(0, len(top), 100):
        print("  " + top[k:k + 100]); print("  " + bot[k:k + 100])
