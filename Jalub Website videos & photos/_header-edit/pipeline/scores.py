"""Per-frame scene-score access + a compact 'cadence string' printer.

usage: scores.py <id> <t0> <t1>   -> one symbol per source frame:
   '_' duplicate-like (score < 0.0004)   '.' tiny (<0.002)   1-9 rising log scale   '#' cut (>=0.3)
"""
import re
import sys
from functools import lru_cache

import numpy as np

from common import out


@lru_cache(None)
def load(vid):
    txt = open(out("scan", vid, "scores.txt")).read()
    t = np.array([float(x) for x in re.findall(r"pts_time:([0-9.]+)", txt)])
    s = np.array([float(x) for x in re.findall(r"scene_score=([0-9.]+)", txt)])
    n = min(len(t), len(s))
    return t[:n], s[:n]


def sym(v):
    if v >= 0.3:
        return "#"
    if v < 0.0004:
        return "_"
    if v < 0.002:
        return "."
    return str(int(min(9, max(1, 1 + (np.log10(v) + 2.7) * 3.5))))


if __name__ == "__main__":
    import json
    vid, t0, t1 = sys.argv[1], float(sys.argv[2]), float(sys.argv[3])
    meta = json.load(open(out("scan", "meta.json")))
    fps = meta[vid]["fps"]
    t, s = load(vid)
    a, b = int(round(t0 * fps)), int(round(t1 * fps))
    print(f"{vid} frames {a}-{b} ({t0}-{t1}s @ {fps:.2f})")
    for i in range(a, min(b, len(s)), 50):
        seg = s[i:min(b, i + 50)]
        print(f"  f{i:5d} t={i / fps:6.2f}  " + "".join(sym(v) for v in seg))
