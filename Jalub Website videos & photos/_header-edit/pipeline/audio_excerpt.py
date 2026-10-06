"""Cut the song excerpt: 12 bars starting 4 bars before the drop, with loop-safe edge fades."""
import math, sys, wave
import numpy as np
from common import out
from dsp import read_wav

BPM, DROP_T, FPS = 138.0, 13.838, 30
BEAT = 60.0 / BPM
PRE_BEATS, N_BEATS = 16, 48
x, sr = read_wav(out("audio", "v01_full.wav"))
t0 = DROP_T - PRE_BEATS * BEAT
frames = int(math.floor(N_BEATS * BEAT * FPS + 1e-6))
n = int(round(frames / FPS * sr))
s0 = int(round(t0 * sr))
y = x[s0:s0 + n].copy()
fi, fo = int(0.012 * sr), int(0.110 * sr)
y[:fi] *= (np.sin(np.linspace(0, np.pi / 2, fi)) ** 2)[:, None]
y[-fo:] *= (np.cos(np.linspace(0, np.pi / 2, fo)) ** 2)[:, None]
gain_db = float(sys.argv[1]) if len(sys.argv) > 1 else 0.0
y *= 10 ** (gain_db / 20)
print(f"excerpt: song {t0:.4f}s .. {t0 + n / sr:.4f}s  = {n} samples = {n / sr:.4f}s ({frames} video frames)  gain {gain_db:+.1f} dB  peak {np.abs(y).max():.3f}")
with wave.open(out("audio", "excerpt.wav"), "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(sr)
    w.writeframes((np.clip(y, -1, 1) * 32767).astype(np.int16).tobytes())
