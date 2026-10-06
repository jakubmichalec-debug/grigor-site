"""Sample-accurate beat grid for the chosen song (v01), from time-domain transients at 48 kHz.

1. Clipping / headroom stats for every source's audio (to justify the pick).
2. Broadband + low-band transient times (2 ms resolution).
3. Tempo/phase by maximising circular concentration of transient times modulo the 8th-note period.
4. Per-beat table: nearest transient to every grid beat, so the fit can be eyeballed.
"""
import json
import sys

import numpy as np

from common import SOURCES, out
from dsp import read_wav

print("== headroom / clipping (48k stereo) ==")
for vid in SOURCES:
    x, sr = read_wav(out("audio", f"{vid}_full.wav"))
    m = np.abs(x).max(axis=1)
    near = m >= 0.985
    # longest run of consecutive near-full-scale samples
    run = best = 0
    for v in near:
        run = run + 1 if v else 0
        best = max(best, run)
    rms = np.sqrt((x ** 2).mean())
    print(f"{vid} {SOURCES[vid]:22s} peak={m.max():.3f} rms={20 * np.log10(rms + 1e-9):6.1f}dB crest={20 * np.log10(m.max() / (rms + 1e-9)):5.1f}dB "
          f"near-fullscale={near.mean() * 100:6.3f}%  longest flat run={best} samples")

VID = "v01"
x, sr = read_wav(out("audio", f"{VID}_full.wav"))
mono = x.mean(axis=1)
dur = len(mono) / sr


def env_db(sig, win_ms):
    n = max(1, int(sr * win_ms / 1000))
    k = np.ones(n) / n
    return 10 * np.log10(np.convolve(sig ** 2, k, "same") + 1e-10)


def lowpass(sig, fc):
    # windowed-sinc FIR
    n = int(sr / fc * 4) | 1
    t = np.arange(n) - n // 2
    h = np.sinc(2 * fc / sr * t) * np.hanning(n)
    h /= h.sum()
    return np.convolve(sig, h, "same")


def transients(sig, win_ms=4, hop_ms=2, look_ms=20, min_gap_ms=90, pct=90):
    e = env_db(sig, win_ms)
    hop = int(sr * hop_ms / 1000)
    e = e[::hop]
    look = max(1, int(look_ms / hop_ms))
    rise = np.zeros_like(e)
    rise[look:] = e[look:] - e[:-look]          # dB rise over look_ms
    rise = np.maximum(rise, 0)
    thr = np.percentile(rise, pct)
    gap = int(min_gap_ms / hop_ms)
    idx = [i for i in range(look, len(rise) - 1) if rise[i] >= thr and rise[i] == rise[max(0, i - gap):i + gap + 1].max()]
    # refine: onset = where the rise started (walk back to 25% of the rise)
    out_t = []
    for i in idx:
        j = i
        target = e[i] - 0.75 * rise[i]
        while j > 0 and e[j] > target:
            j -= 1
        out_t.append(((j + 1) * hop / sr, float(rise[i])))
    return out_t


full_tr = transients(mono)
low = lowpass(mono, 140.0)
low_tr = transients(low, win_ms=10, hop_ms=2, look_ms=30, min_gap_ms=150, pct=92)
print(f"\n== {VID}: {len(full_tr)} broadband transients, {len(low_tr)} low-band transients ==")


def fit(trs, t0, t1, label, div=2):
    ts = np.array([t for t, s in trs if t0 <= t <= t1])
    ws = np.array([s for t, s in trs if t0 <= t <= t1])
    best = (0, None, None)
    for bpm in np.arange(136.0, 140.0001, 0.005):
        per = 60.0 / bpm / div
        ph = 2 * np.pi * (ts % per) / per
        z = (ws * np.exp(1j * ph)).sum() / ws.sum()
        if abs(z) > best[0]:
            best = (abs(z), bpm, (np.angle(z) % (2 * np.pi)) / (2 * np.pi) * per)
    print(f"[{label}] {len(ts)} transients in {t0}-{t1}s: bpm={best[1]:.3f} concentration={best[0]:.3f} phase(8th)={best[2] * 1000:.1f}ms")
    return best


fit(full_tr, 13.5, 28.3, "broadband, drop")
fit(full_tr, 0.0, 13.5, "broadband, intro")
fit(full_tr, 0.0, 28.3, "broadband, whole")
fit(low_tr, 13.5, 28.3, "low band, drop", div=1)

# Whole-file fit with the tempo pinned near 138, then per-beat residuals
BPM = float(sys.argv[1]) if len(sys.argv) > 1 else 138.0
per = 60.0 / BPM
ts = np.array([t for t, s in full_tr]); ws = np.array([s for t, s in full_tr])
ph = 2 * np.pi * (ts % (per / 2)) / (per / 2)
z = (ws * np.exp(1j * ph)).sum() / ws.sum()
ph8 = (np.angle(z) % (2 * np.pi)) / (2 * np.pi) * (per / 2)
print(f"\nBPM pinned {BPM}: 8th-note phase {ph8 * 1000:.1f} ms, concentration {abs(z):.3f}")
# which of the two 8th phases is the beat? -> the one the low-band transients prefer
lts = np.array([t for t, s in low_tr if t > 13.5]); lws = np.array([s for t, s in low_tr if t > 13.5])
cands = [ph8, ph8 + per / 2]
sc = []
for c in cands:
    d = ((lts - c + per / 2) % per) - per / 2
    sc.append(float((lws * (np.abs(d) < 0.03)).sum()))
print("low-band support for the two candidate beat phases:", [f"{c * 1000:.0f}ms -> {s:.0f}" for c, s in zip(cands, sc)])
beat_ph = cands[int(np.argmax(sc))] % per
print(f"beat phase = {beat_ph * 1000:.1f} ms  -> beats at {beat_ph:.4f} + k*{per:.5f}")

grid = np.arange(beat_ph, dur, per)
print("\nbeat  time     nearest broadband transient (delta ms, strength) | nearest low transient (delta ms)")
ft = np.array([t for t, s in full_tr]); fs = np.array([s for t, s in full_tr])
lt = np.array([t for t, s in low_tr])
rows = []
for k, g in enumerate(grid):
    i = int(np.argmin(np.abs(ft - g))); j = int(np.argmin(np.abs(lt - g)))
    d1 = (ft[i] - g) * 1000; d2 = (lt[j] - g) * 1000
    rows.append((k, g, d1, fs[i], d2))
for k, g, d1, s, d2 in rows:
    a = f"{d1:+6.0f}ms s={s:4.1f}" if abs(d1) < 60 else "   --        "
    b = f"{d2:+6.0f}ms" if abs(d2) < 60 else "   --  "
    print(f"{k:3d}  {g:7.3f}   {a}   |  {b}")
res = np.array([r[2] for r in rows if abs(r[2]) < 40])
print(f"\nresiduals of matched beats: n={len(res)} mean={res.mean():+.1f}ms sd={res.std():.1f}ms")
# drift check: regress residual on beat index
kk = np.array([r[0] for r in rows if abs(r[2]) < 40])
slope, icpt = np.polyfit(kk, res, 1)
print(f"drift: {slope:+.3f} ms/beat  (=> true period {per * 1000 + slope:.3f} ms, bpm {60000 / (per * 1000 + slope):.3f}), intercept {icpt:+.1f} ms")
json.dump({"bpm": BPM, "beat_phase": float(beat_ph), "period": per, "dur": dur,
           "full_tr": full_tr, "low_tr": low_tr}, open(out("audio", "grid_v01.json"), "w"))
