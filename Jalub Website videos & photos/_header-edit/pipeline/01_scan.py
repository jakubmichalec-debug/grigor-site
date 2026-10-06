"""Pass 1 over every source: per-frame scene scores + low-res preview frames + analysis audio.

Outputs (under WORK):
  scan/<id>/scores.txt       ffmpeg metadata=print dump (scene score per frame)
  scan/<id>/f_%05d.jpg       preview frames at PREVIEW_FPS, 480px on the long edge
  audio/<id>.wav             mono 22050 Hz PCM for analysis
  audio/<id>_full.wav        stereo 48k PCM for the final mix
  scan/meta.json             probe info per source
"""
import json
import os
import sys

from common import SOURCES, out, probe, run, src

PREVIEW_FPS = 5

meta = {}
only = sys.argv[1:]
for vid in SOURCES:
    if only and vid not in only:
        continue
    info = probe(vid)
    meta[vid] = info
    d = os.path.dirname(out("scan", vid, "x"))
    portrait = info["h"] > info["w"]
    scale = "scale=-2:480" if portrait else "scale=480:-2"
    # HLG iPhone footage: tone-map for the previews so the sheet isn't washed out.
    tm = ""
    if info["transfer"] == "arib-std-b67":
        tm = "zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p,"
    vf_scores = f"{tm}{scale},select='gte(scene,0)',metadata=print:file=scores.txt"
    vf_frames = f"{tm}fps={PREVIEW_FPS},{scale}"
    print(f"[{vid}] {SOURCES[vid]}  {info['w']}x{info['h']} {info['fps']:.3f}fps {info['duration']:.2f}s", flush=True)
    run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", src(vid),
        "-filter_complex", f"[0:v]split=2[a][b];[a]{vf_scores}[s];[b]{vf_frames}[f]",
        "-map", "[s]", "-an", "-f", "null", "-",
        "-map", "[f]", "-an", "-q:v", "4", "f_%05d.jpg",
    ], cwd=d)
    run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", src(vid),
        "-vn", "-ac", "1", "-ar", "22050", "-c:a", "pcm_s16le", out("audio", f"{vid}.wav"),
        "-vn", "-ac", "2", "-ar", "48000", "-c:a", "pcm_s16le", out("audio", f"{vid}_full.wav"),
    ])

mp = out("scan", "meta.json")
if os.path.exists(mp) and only:
    old = json.load(open(mp))
    old.update(meta)
    meta = old
json.dump(meta, open(mp, "w"), indent=1)
print("done")
