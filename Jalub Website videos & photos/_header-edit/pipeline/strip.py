"""Frame-accurate filmstrip of a source range, labelled with source frame numbers and cadence symbols.

usage: strip.py <id> <t0> <t1> [step=1] [--uniq] [--big]
  --uniq : show only frames that are 'new' (drops duplicate frames, see clipsel.unique_frames)
"""
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

from common import SOURCES, out, run, src
from scores import load, sym

TM = "zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p,"
meta = json.load(open(out("scan", "meta.json")))
font = ImageFont.truetype(r"C:\Windows\Fonts\arialbd.ttf", 12)


def extract(vid, frames, tw, th, tag):
    """Decode exactly the given source frame numbers (sorted) to thumbnails. Returns list of paths."""
    fps = meta[vid]["fps"]
    d = os.path.dirname(out("strips", f"{vid}_{tag}", "x"))
    for old in os.listdir(d):
        os.remove(os.path.join(d, old))
    a = frames[0]
    ss = max(0.0, (a - 0.5) / fps)
    tm = TM if meta[vid]["transfer"] == "arib-std-b67" else ""
    paths = []
    for c in range(0, len(frames), 60):
        chunk = frames[c:c + 60]
        sel = "+".join(f"eq(n\\,{f - a})" for f in chunk)
        run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", f"{ss:.5f}", "-i", src(vid),
             "-vf", f"select='{sel}',{tm}scale={tw}:{th}", "-fps_mode", "vfr", "-frames:v", str(len(chunk)),
             "-q:v", "3", f"c{c // 60:02d}_%03d.jpg"], cwd=d)
    for f in sorted(os.listdir(d)):
        paths.append(os.path.join(d, f))
    return paths


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    vid, t0, t1 = args[0], float(args[1]), float(args[2])
    step = int(args[3]) if len(args) > 3 else 1
    fps = meta[vid]["fps"]
    a, b = int(round(t0 * fps)), int(round(t1 * fps))
    if "--uniq" in sys.argv:
        from clipsel import unique_frames
        frames = unique_frames(vid, a, b)[::step]
    else:
        frames = list(range(a, b, step))
    portrait = meta[vid]["h"] > meta[vid]["w"]
    big = "--big" in sys.argv
    if portrait:
        tw, th, cols = (162, 288, 12) if big else (108, 192, 17)
    else:
        tw, th, cols = (320, 180, 6) if big else (192, 108, 10)
    tag = f"{a}_{b}_{step}" + ("u" if "--uniq" in sys.argv else "")
    paths = extract(vid, frames, tw, th, tag)
    _, s = load(vid)
    rows = (len(paths) + cols - 1) // cols
    im = Image.new("RGB", (cols * (tw + 2) + 2, rows * (th + 16) + 20), (16, 16, 16))
    d = ImageDraw.Draw(im)
    d.text((4, 3), f"{vid} {SOURCES[vid]}  src frames {a}-{b} step {step}{' unique-only' if '--uniq' in sys.argv else ''}  ({t0}-{t1}s @ {fps:.2f})  label = frame# / time / cadence",
           fill=(255, 220, 0), font=font)
    for k, (p, f) in enumerate(zip(paths, frames)):
        x = 2 + (k % cols) * (tw + 2); y = 20 + (k // cols) * (th + 16)
        im.paste(Image.open(p).convert("RGB"), (x, y))
        c = sym(s[f]) if f < len(s) else "?"
        d.text((x + 2, y + th + 1), f"{f} {f / fps:.2f} {c}", fill=(235, 235, 235), font=font)
    o = out("strips", f"{vid}_{tag}.jpg")
    im.save(o, quality=86)
    print(o, im.size, len(paths), "frames")


if __name__ == "__main__":
    main()
