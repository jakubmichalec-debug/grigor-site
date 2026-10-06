"""Precise tempo/phase for one song region.

usage: 06_tempo_fit.py <id> <t0> <t1> <bpm_lo> <bpm_hi>
Scores a beat comb against the onset envelope (fine BPM x phase grid), and
cross-checks with long-lag autocorrelation (1, 2 and 4 bars).
"""
import sys

import numpy as np

from common import out
from dsp import onset_envelope, read_wav, stft_mag

vid, t0, t1, lo, hi = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]), float(sys.argv[4]), float(sys.argv[5])
HOP, NFFT = 128, 2048
x, sr = read_wav(out("audio", f"{vid}.wav"))
env, S = onset_envelope(x, sr, NFFT, HOP)
fps = sr / HOP
f = np.fft.rfftfreq(NFFT, 1 / sr)
P = S ** 2
lowdb = 10 * np.log10(P[(f >= 30) & (f < 160)].sum(0) + 1e-9)
low_flux = np.concatenate([[0], np.maximum(0, np.diff(lowdb))])
hidb = 10 * np.log10(P[(f >= 3000)].sum(0) + 1e-9)
hi_flux = np.concatenate([[0], np.maximum(0, np.diff(hidb))])

a, b = int(t0 * fps), int(t1 * fps)
t = np.arange(len(env)) / fps


def interp(sig, times):
    return np.interp(times, t, sig)


def comb_fit(sig, label, sub=1):
    seg = sig[a:b]
    sig_n = (sig - seg.mean()) / (seg.std() + 1e-9)
    # light smoothing (+-12 ms) so a near miss still scores
    k = np.hanning(int(0.024 * fps) | 1); k /= k.sum()
    sm = np.convolve(sig_n, k, "same")
    best = []
    for bpm in np.arange(lo, hi + 1e-9, 0.01):
        per = 60.0 / bpm / sub
        for ph in np.arange(0, per, 0.004):
            times = np.arange(t0 + ph, t1, per)
            best.append((float(interp(sm, times).mean()), float(bpm), float(t0 + ph)))
    best.sort(reverse=True)
    print(f"[{label}] top fits (score, bpm, first pulse at):")
    seen = []
    for sc, bpm, ph in best:
        if all(abs(bpm - s) > 0.15 for s in seen):
            seen.append(bpm)
            print(f"   {sc:6.3f}  {bpm:7.2f} BPM  phase t={ph:.3f}s  (beat {60 / bpm:.4f}s, bar {240 / bpm:.4f}s)")
        if len(seen) == 5:
            break
    return best[0]


print(f"{vid}: region {t0}-{t1}s, searching {lo}-{hi} BPM")
comb_fit(env, "full-band onset, beats")
comb_fit(low_flux, "low-band (kick/808) onset, beats")
comb_fit(hi_flux, "high-band (hats/snare) onset, beats")
comb_fit(env, "full-band onset, 8th notes", sub=2)

# long-lag autocorrelation on the onset envelope in the region
seg = env[a:b] - env[a:b].mean()
ac = np.correlate(seg, seg, "full")[len(seg) - 1:]
ac /= ac[0]
for bars in (1, 2, 4):
    rows = []
    for bpm in np.arange(lo, hi + 1e-9, 0.02):
        lag = bars * 240.0 / bpm * fps
        i = int(np.floor(lag)); fr = lag - i
        if i + 1 < len(ac):
            rows.append((float(ac[i] * (1 - fr) + ac[i + 1] * fr), float(bpm)))
    rows.sort(reverse=True)
    print(f"autocorr @ {bars} bar(s): best bpm " + ", ".join(f"{bpm:.2f} ({sc:.3f})" for sc, bpm in rows[:3]))
