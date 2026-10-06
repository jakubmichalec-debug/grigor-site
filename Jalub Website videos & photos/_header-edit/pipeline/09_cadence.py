"""Per-shot frame cadence: how many of a shot's frames are genuinely new?

A 25p clip dropped in a 50p timeline, or 50% slow-mo, shows up as every other
frame being a (near) duplicate. That matters for retiming: conforming such a
shot frame-for-frame would stutter. Reads scan/<id>/scores.txt.
"""
import json
import re

import numpy as np

from common import SOURCES, out

shots = json.load(open(out("scan", "shots.json")))
res = {}
for vid in SOURCES:
    txt = open(out("scan", vid, "scores.txt")).read()
    t = np.array([float(x) for x in re.findall(r"pts_time:([0-9.]+)", txt)])
    s = np.array([float(x) for x in re.findall(r"scene_score=([0-9.]+)", txt)])
    n = min(len(t), len(s)); t, s = t[:n], s[:n]
    fps = shots[vid]["fps"]
    rows = []
    for sh in shots[vid]["shots"]:
        m = (t > sh["start"] + 1.5 / fps) & (t < sh["end"] - 0.5 / fps)
        v = s[m]
        if len(v) < 6:
            continue
        med = np.median(v)
        # a frame is a "repeat" if its score is far below the shot's typical motion
        thr = max(0.0004, 0.12 * np.percentile(v, 75))
        rep = v < thr
        frac = rep.mean()
        # alternation: lag-1 autocorrelation of the repeat mask (strongly negative => every-other-frame pattern)
        r = rep.astype(float) - rep.mean()
        alt = float((r[1:] * r[:-1]).sum() / ((r ** 2).sum() + 1e-9))
        # effective unique-frame rate
        eff = fps * (1 - frac)
        rows.append({"i": sh["i"], "start": sh["start"], "end": sh["end"], "dur": sh["dur"], "n": int(len(v)),
                     "median": float(med), "repeat_frac": float(frac), "alt": alt, "eff_fps": float(eff)})
    res[vid] = rows
    print(f"\n{vid} {SOURCES[vid]} @ {fps:.2f} fps  (shots >= 6 frames)")
    line = []
    for r in rows:
        tag = "full" if r["repeat_frac"] < 0.12 else ("HALF" if 0.38 < r["repeat_frac"] < 0.62 and r["alt"] < -0.5 else f"rep{r['repeat_frac']:.2f}")
        if r["median"] < 0.0006:
            tag += "~still"
        line.append(f"#{r['i']:02d} {r['start']:5.2f}-{r['end']:5.2f} {tag:>11s} eff={r['eff_fps']:4.0f}")
    for k in range(0, len(line), 4):
        print("   " + "  |  ".join(line[k:k + 4]))
json.dump(res, open(out("scan", "cadence.json"), "w"), indent=1)
