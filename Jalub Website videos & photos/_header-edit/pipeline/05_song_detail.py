"""Closer look at candidate songs: band energy on a fine time grid + strongest kick onsets.

Prints a text 'piano roll' (one row per 1/8 s) so drops, breaks and gaps are visible,
then a list of low-band onset peaks with their spacing.
"""
import sys

import numpy as np

from common import SOURCES, out
from dsp import read_wav, stft_mag

HOP, NFFT = 256, 2048
for vid in sys.argv[1:]:
    x, sr = read_wav(out("audio", f"{vid}.wav"))
    S = stft_mag(x, NFFT, HOP) ** 2
    f = np.fft.rfftfreq(NFFT, 1 / sr)
    fps = sr / HOP
    low = S[(f >= 30) & (f < 150)].sum(0)
    mid = S[(f >= 300) & (f < 2000)].sum(0)
    hi = S[(f >= 4000)].sum(0)
    db = lambda v: 10 * np.log10(v + 1e-9)
    step = int(round(fps / 8))
    print(f"\n=== {vid} {SOURCES[vid]}  ({len(x) / sr:.2f}s)  rows = 1/8 s, cols = low / mid / high energy (dB bars)")
    ref = max(db(low).max(), db(mid).max(), db(hi).max())
    bar = lambda v: "#" * int(max(0, (v - (ref - 48)) / 48 * 22))
    lines = []
    for i in range(0, len(low) - step + 1, step):
        t = i / fps
        l, m, h = db(low[i:i + step].mean()), db(mid[i:i + step].mean()), db(hi[i:i + step].mean())
        lines.append(f"{t:6.3f} |{bar(l):<22}|{bar(m):<22}|{bar(h):<22}|")
    # print compactly: two columns of time to keep output short
    half = (len(lines) + 1) // 2
    for a in range(half):
        b = lines[a + half] if a + half < len(lines) else ""
        print(lines[a] + "   " + b)
    # low-band onset peaks (kicks)
    lo_db = db(low)
    flux = np.maximum(0, lo_db[2:] - lo_db[:-2])
    flux = np.concatenate([[0, 0], flux])
    thr = np.percentile(flux, 92)
    peaks = [i for i in range(2, len(flux) - 2) if flux[i] >= thr and flux[i] == flux[max(0, i - 6):i + 7].max()]
    tt = np.array(peaks) / fps
    print("kick-ish onsets (s):", " ".join(f"{t:.2f}" for t in tt))
    if len(tt) > 2:
        d = np.diff(tt)
        print("spacing histogram (s -> count):", {round(float(k), 2): int(v) for k, v in zip(*np.unique(np.round(d / 0.02) * 0.02, return_counts=True)) if v >= 2})
