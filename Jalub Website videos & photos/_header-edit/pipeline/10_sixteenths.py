"""Rhythm map of the chosen song on a 16th-note grid.

For every bar of the excerpt, print 16 slots with the energy *rise* in three bands
(low = kick/808, mid = snare/clap/vocal, high = hats), so accents, fills and gaps are visible.
Grid: beat k at DROP_T + (k - 31) * 60/138.
"""
import numpy as np

from common import out
from dsp import read_wav

BPM = 138.0
BEAT = 60.0 / BPM
DROP_T = 13.838          # song time of the drop (beat 31 in file numbering)
START_BEAT = 15          # excerpt starts here (4 bars before the drop)
N_BEATS = 48

x, sr = read_wav(out("audio", "v01_full.wav"))
mono = x.mean(axis=1)


def band(sig, lo, hi):
    X = np.fft.rfft(sig)
    f = np.fft.rfftfreq(len(sig), 1 / sr)
    X[(f < lo) | (f >= hi)] = 0
    return np.fft.irfft(X, len(sig))


bands = {"low": band(mono, 30, 150), "mid": band(mono, 400, 3000), "high": band(mono, 6000, 20000)}
six = BEAT / 4


def level(sig, t0, t1):
    a, b = max(0, int(t0 * sr)), min(len(sig), int(t1 * sr))
    if b <= a:
        return -90.0
    return 10 * np.log10((sig[a:b] ** 2).mean() + 1e-10)


def glyph(rise, lvl, ref):
    # rise: dB jump at slot start vs the 60 ms before it; lvl: slot level relative to band max
    if lvl < ref - 30:
        return " "
    if rise > 9:
        return "X"
    if rise > 5:
        return "x"
    if lvl > ref - 8:
        return "="
    if lvl > ref - 16:
        return "-"
    return "."


print(f"excerpt: song {DROP_T + (START_BEAT - 31) * BEAT:.4f}s -> {DROP_T + (START_BEAT + N_BEATS - 31) * BEAT:.4f}s  ({N_BEATS} beats, {N_BEATS * BEAT:.4f}s)")
print("slot glyphs: X strong onset, x onset, = sustained loud, - medium, . quiet, ' ' silent     (each char = one 16th; | = beat)")
refs = {k: max(level(v, t, t + 0.05) for t in np.arange(13.9, 27.5, 0.05)) for k, v in bands.items()}
tot_ref = max(level(mono, t, t + 0.05) for t in np.arange(13.9, 27.5, 0.05))
for bar in range(N_BEATS // 4):
    b0 = bar * 4
    t_bar = DROP_T + (START_BEAT + b0 - 31) * BEAT
    lines = {}
    for name, sig in bands.items():
        s = ""
        for i in range(16):
            t = t_bar + i * six
            lvl = level(sig, t, t + six)
            pre = level(sig, t - 0.060, t - 0.005)
            post = level(sig, t - 0.005, t + 0.045)
            s += glyph(post - pre, lvl, refs[name])
            if i % 4 == 3:
                s += "|"
        lines[name] = s
    lv = level(mono, t_bar, t_bar + 4 * BEAT) - tot_ref
    part = "BUILD" if bar < 4 else "DROP "
    print(f"\nbar {bar + 1:2d} {part} beats {b0:2d}-{b0 + 3:2d}  song {t_bar:6.3f}s  excerpt {b0 * BEAT:6.3f}s  level {lv:+5.1f} dB")
    for name in ("low", "mid", "high"):
        print(f"   {name:4s} |{lines[name]}")
