"""Parse per-frame scene scores -> cut list + shot list per source.

A cut is a frame whose scene score is a local peak and stands clearly above
its neighbourhood. Writes scan/shots.json and prints a summary.
"""
import json
import re
import sys

import numpy as np

from common import SOURCES, out

meta = json.load(open(out("scan", "meta.json")))
HI = float(sys.argv[1]) if len(sys.argv) > 1 else 0.30   # absolute "surely a cut"
LO = float(sys.argv[2]) if len(sys.argv) > 2 else 0.10   # floor for relative peaks

result = {}
for vid in SOURCES:
    txt = open(out("scan", vid, "scores.txt")).read()
    times = [float(x) for x in re.findall(r"pts_time:([0-9.]+)", txt)]
    scores = [float(x) for x in re.findall(r"scene_score=([0-9.]+)", txt)]
    n = min(len(times), len(scores))
    t = np.array(times[:n]); s = np.array(scores[:n])
    fps = meta[vid]["fps"]
    cuts = []
    for i in range(1, n):
        lo, hi = max(0, i - 3), min(n, i + 4)
        nb = np.concatenate([s[lo:i], s[i + 1:hi]])
        if s[i] < max(nb, default=0):
            continue  # not the local peak
        base = np.median(s[max(0, i - 12):min(n, i + 13)])
        if s[i] >= HI or (s[i] >= LO and s[i] > 6 * (base + 0.004)):
            cuts.append((float(t[i]), float(s[i])))
    # shots = spans between cuts
    edges = [0.0] + [c[0] for c in cuts] + [meta[vid]["duration"]]
    shots = []
    for k in range(len(edges) - 1):
        a, b = edges[k], edges[k + 1]
        if b - a < 1.5 / fps:
            continue
        # mean in-shot motion (scene score away from the cut frames)
        m = (t > a + 1.5 / fps) & (t < b - 0.5 / fps)
        shots.append({
            "i": len(shots), "start": round(a, 4), "end": round(b, 4), "dur": round(b - a, 4),
            "motion": round(float(s[m].mean()), 4) if m.any() else 0.0,
            "cut_score": round(cuts[k - 1][1], 3) if k > 0 else None,
        })
    result[vid] = {"fps": fps, "duration": meta[vid]["duration"], "cuts": cuts, "shots": shots,
                   "score_stats": [float(np.percentile(s, p)) for p in (50, 90, 99)]}
    durs = [x["dur"] for x in shots]
    print(f"{vid} {SOURCES[vid]:22s} {meta[vid]['duration']:6.2f}s  shots={len(shots):3d}  "
          f"median={np.median(durs):.2f}s min={min(durs):.2f}s max={max(durs):.2f}s  "
          f"score p50/p90/p99={result[vid]['score_stats'][0]:.3f}/{result[vid]['score_stats'][1]:.3f}/{result[vid]['score_stats'][2]:.3f}")

json.dump(result, open(out("scan", "shots.json"), "w"), indent=1)
