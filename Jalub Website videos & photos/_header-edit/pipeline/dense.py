"""Dense frame sheet of a rendered cut: every `step`-th frame, with clip boundaries marked.
usage: dense.py <tag> <H> [step=2] [f0] [f1] [cols=16]"""
import json, os, sys
from PIL import Image, ImageDraw, ImageFont
from common import out, run
tag, H = sys.argv[1], sys.argv[2]
step = int(sys.argv[3]) if len(sys.argv) > 3 else 2
plan = json.load(open(out("build", f"{tag}_{H}.json")))
total = plan[-1]["f0"] + plan[-1]["n"]
f0 = int(sys.argv[4]) if len(sys.argv) > 4 else 0
f1 = int(sys.argv[5]) if len(sys.argv) > 5 else total
cols = int(sys.argv[6]) if len(sys.argv) > 6 else 16
video = out("build", f"{tag}_{H}.mp4")
font = ImageFont.truetype(r"C:\Windows\Fonts\arialbd.ttf", 11)
tw = (1936 - 2) // cols - 2
th = tw * 9 // 16
frames = list(range(f0, f1, step))
d = os.path.dirname(out("view", "dense", "x"))
for f in os.listdir(d): os.remove(os.path.join(d, f))
for c in range(0, len(frames), 80):
    sel = "+".join("eq(n\\,%d)" % f for f in frames[c:c + 80])
    run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", video, "-vf", f"select='{sel}',scale={tw}:{th}", "-fps_mode", "vfr", "-q:v", "4", os.path.join(d, f"c{c // 80:02d}_%03d.jpg")])
files = sorted(os.listdir(d))
starts = {p["f0"]: p for p in plan}
def clip_of(f):
    for p in plan:
        if p["f0"] <= f < p["f0"] + p["n"]:
            return p
rows = (len(files) + cols - 1) // cols
im = Image.new("RGB", (cols * (tw + 2) + 2, rows * (th + 14) + 2), (16, 16, 16))
dr = ImageDraw.Draw(im)
prev = None
for k, (fn, f) in enumerate(zip(files, frames)):
    x = 2 + (k % cols) * (tw + 2); y = 2 + (k // cols) * (th + 14)
    im.paste(Image.open(os.path.join(d, fn)).convert("RGB"), (x, y))
    p = clip_of(f)
    new = prev is None or p["i"] != prev
    if new:
        dr.rectangle([x, y, x + 3, y + th], fill=(255, 40, 40))
    dr.text((x + 2, y + th + 1), (f"{f} {p['id']}" if new else f"{f}"), fill=(255, 220, 0) if new else (200, 200, 200), font=font)
    prev = p["i"]
o = out("view", f"dense_{tag}_{f0}_{f1}_{step}.jpg")
im.save(o, quality=86); print(o, im.size, len(files))
