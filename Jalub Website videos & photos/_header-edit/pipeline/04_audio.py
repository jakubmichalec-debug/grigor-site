"""Characterise each source's soundtrack: level, band balance, tempo candidates, beat grid quality."""
import json
import sys

import numpy as np

from common import SOURCES, out, run
from dsp import beat_track, onset_envelope, read_wav, refine_bpm, tempo_candidates

HOP, NFFT = 256, 2048
res = {}
only = sys.argv[1:]
for vid in SOURCES:
    if only and vid not in only:
        continue
    x, sr = read_wav(out("audio", f"{vid}.wav"))
    dur = len(x) / sr
    rms = float(np.sqrt((x ** 2).mean()))
    peak = float(np.abs(x).max())
    env, S = onset_envelope(x, sr, NFFT, HOP)
    freqs = np.fft.rfftfreq(NFFT, 1 / sr)
    P = S ** 2
    tot = P.sum() + 1e-12
    bands = {"sub<60": (0, 60), "bass60-250": (60, 250), "mid250-2k": (250, 2000), "hi2k-8k": (2000, 8000), "air>8k": (8000, 99999)}
    bal = {k: float(P[(freqs >= a) & (freqs < b)].sum() / tot) for k, (a, b) in bands.items()}
    cands, ac = tempo_candidates(env, sr, HOP)
    top = []
    for bpm, score, raw in cands:
        if all(abs(bpm - t[0]) > 3 for t in top):
            top.append((round(bpm, 1), round(float(score), 3), round(float(raw), 3)))
        if len(top) == 4:
            break
    bpm_ref, comb, phase = refine_bpm(env, sr, HOP, top[0][0])
    beats = beat_track(env, sr, HOP, bpm_ref)
    ibi = np.diff(beats)
    # loudness per second (dBFS RMS)
    sec = [20 * np.log10(np.sqrt((x[int(i * sr):int((i + 1) * sr)] ** 2).mean()) + 1e-9) for i in range(int(dur))]
    res[vid] = {"dur": dur, "rms_db": 20 * np.log10(rms + 1e-9), "peak": peak, "balance": bal, "tempo_top": top,
                "bpm": bpm_ref, "comb": comb, "phase": phase, "beats": [round(float(b), 4) for b in beats],
                "ibi_sd_ms": float(ibi.std() * 1000) if len(ibi) else None, "loud_per_s": [round(float(s), 1) for s in sec]}
    print(f"{vid} {SOURCES[vid]:22s} {dur:5.1f}s rms={res[vid]['rms_db']:6.1f}dB peak={peak:.2f} "
          f"bass={bal['sub<60'] + bal['bass60-250']:.2f} mid={bal['mid250-2k']:.2f} hi={bal['hi2k-8k'] + bal['air>8k']:.2f}  "
          f"tempo={top}  refined={bpm_ref:.2f} comb={comb:.2f} nbeats={len(beats)} ibi_sd={res[vid]['ibi_sd_ms']:.0f}ms")
    print("      loud/s:", " ".join(f"{s:.0f}" for s in sec))
    # spectrogram picture (log freq), for eyeballing structure
    run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", out("audio", f"{vid}.wav"),
         "-lavfi", "showspectrumpic=s=1800x360:legend=0:scale=log:fscale=log:color=magma:start=30:stop=11000",
         out("audio", f"{vid}_spec.png")])

json.dump(res, open(out("audio", "analysis.json"), "w"), indent=1)
