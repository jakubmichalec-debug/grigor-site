"""Small numpy-only audio toolkit: WAV io, STFT, onset envelope, tempo, beat tracking."""
import wave

import numpy as np


def read_wav(path):
    with wave.open(path, "rb") as w:
        sr, ch, n = w.getframerate(), w.getnchannels(), w.getnframes()
        x = np.frombuffer(w.readframes(n), dtype=np.int16).astype(np.float32) / 32768.0
    if ch > 1:
        x = x.reshape(-1, ch)
    return x, sr


def stft_mag(x, n_fft=2048, hop=512):
    win = np.hanning(n_fft).astype(np.float32)
    pad = n_fft // 2
    xp = np.pad(x, (pad, pad), mode="reflect")
    n_frames = 1 + (len(xp) - n_fft) // hop
    idx = np.arange(n_fft)[None, :] + hop * np.arange(n_frames)[:, None]
    return np.abs(np.fft.rfft(xp[idx] * win, axis=1)).T  # (bins, frames)


def mel_filterbank(sr, n_fft, n_mels=40, fmin=30.0, fmax=None):
    fmax = fmax or sr / 2
    mel = lambda f: 2595 * np.log10(1 + f / 700.0)
    imel = lambda m: 700 * (10 ** (m / 2595.0) - 1)
    pts = imel(np.linspace(mel(fmin), mel(fmax), n_mels + 2))
    freqs = np.fft.rfftfreq(n_fft, 1 / sr)
    fb = np.zeros((n_mels, len(freqs)), dtype=np.float32)
    for i in range(n_mels):
        lo, ce, hi = pts[i], pts[i + 1], pts[i + 2]
        up = (freqs - lo) / max(ce - lo, 1e-9)
        dn = (hi - freqs) / max(hi - ce, 1e-9)
        fb[i] = np.maximum(0, np.minimum(up, dn))
    return fb


def onset_envelope(x, sr, n_fft=2048, hop=512):
    """Spectral-flux onset strength (log-mel, half-wave rectified), like librosa's default."""
    S = stft_mag(x, n_fft, hop)
    M = mel_filterbank(sr, n_fft) @ (S ** 2)
    L = 10 * np.log10(np.maximum(M, 1e-10))
    L = np.maximum(L, L.max() - 80)
    d = np.maximum(0, L[:, 1:] - L[:, :-1])
    env = d.mean(axis=0)
    env = np.concatenate([[0], env])
    return env, S


def tempo_candidates(env, sr, hop, bpm_lo=60, bpm_hi=200, prior_bpm=120, prior_sd=1.0):
    """Autocorrelation tempo with a log-normal prior. Returns [(bpm, score)] best first."""
    e = env - env.mean()
    n = len(e)
    ac = np.correlate(e, e, mode="full")[n - 1:]
    ac /= ac[0] + 1e-12
    fps = sr / hop
    out = []
    for lag in range(int(fps * 60 / bpm_hi), min(n - 1, int(fps * 60 / bpm_lo)) + 1):
        bpm = 60 * fps / lag
        prior = np.exp(-0.5 * (np.log2(bpm / prior_bpm) / prior_sd) ** 2)
        # reinforce with the 2x and 3x lags (true beat periods repeat)
        s = ac[lag] + 0.5 * (ac[2 * lag] if 2 * lag < n else 0) + 0.25 * (ac[3 * lag] if 3 * lag < n else 0)
        out.append((bpm, s * prior, ac[lag]))
    out.sort(key=lambda t: -t[1])
    return out, ac


def refine_bpm(env, sr, hop, bpm, span=3.0, step=0.01):
    """Fine tempo search: score a comb of evenly spaced pulses against the envelope."""
    fps = sr / hop
    t = np.arange(len(env)) / fps
    best = (bpm, -1, 0.0)
    e = env / (env.max() + 1e-12)
    for b in np.arange(bpm - span, bpm + span + step, step):
        period = 60.0 / b
        for ph in np.linspace(0, period, 24, endpoint=False):
            beats = np.arange(ph, t[-1], period)
            idx = np.clip(np.round(beats * fps).astype(int), 0, len(e) - 1)
            # tolerate +-1 frame
            sc = np.maximum.reduce([e[idx], e[np.clip(idx - 1, 0, len(e) - 1)], e[np.clip(idx + 1, 0, len(e) - 1)]]).mean()
            if sc > best[1]:
                best = (float(b), float(sc), float(ph))
    return best


def beat_track(env, sr, hop, bpm, tightness=100.0):
    """Ellis (2007) dynamic-programming beat tracker. Returns beat times in seconds."""
    fps = sr / hop
    period = 60.0 * fps / bpm
    e = env / (env.std() + 1e-12)
    # smooth with a gaussian ~ beat/32
    w = np.exp(-0.5 * (np.arange(-period, period + 1) * 32.0 / period) ** 2)
    local = np.convolve(e, w, "same")
    n = len(local)
    back = np.zeros(n, dtype=int)
    cum = np.zeros(n)
    window = np.arange(-2 * period, -np.round(period / 2) + 1, dtype=int)
    txcost = -tightness * (np.log(-window / period) ** 2)
    first = True
    for i in range(n):
        tl = i + window
        zpad = max(0, min(-tl[0], len(window)))
        cand = txcost.copy()
        cand[zpad:] = cand[zpad:] + cum[tl[zpad:]]
        cand[:zpad] = -1e18
        b = int(np.argmax(cand))
        cum[i] = local[i] + cand[b] if cand[b] > -1e17 else local[i]
        if first and local[i] < 0.01 * local.max():
            back[i] = -1
        else:
            back[i] = tl[b] if cand[b] > -1e17 else -1
            first = False
    # tail: best cumulative score near the end
    tail = np.argmax(cum[int(n - period):]) + int(n - period)
    beats = [tail]
    while back[beats[-1]] >= 0:
        beats.append(back[beats[-1]])
    beats = np.array(beats[::-1])
    return beats / fps
