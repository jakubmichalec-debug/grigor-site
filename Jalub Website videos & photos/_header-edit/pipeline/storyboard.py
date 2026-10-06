"""Storyboard of a rendered cut: first / middle / last frame of every clip, labelled.
usage: storyboard.py <tag> <H> [rows_per_sheet]"""
import json, os, sys
from PIL import Image, ImageDraw, ImageFont
from common import out, run
tag, H = sys.argv[1], sys.argv[2]
rows_per = int(sys.argv[3]) if len(sys.argv) > 3 else 8
plan = json.load(open(out("build", f"{tag}_{H}.json")))
video = out("build", f"{tag}_{H}.mp4")
font = ImageFont.truetype(r"C:\Windows\Fonts\arialbd.ttf", 12)
tw, th = 212, 119
want = []
for p in plan:
    n = p["n"]
    want += [p["f0"], p["f0"] + n // 2, p["f0"] + n - 1]
uniq = sorted(set(want))
d = os.path.dirname(out("view", "sb", "x"))
for f in os.listdir(d): os.remove(os.path.join(d, f))
for c in range(0, len(uniq), 80):
    sel = "+".join(f"eq(n\,{f})" for f in uniq[c:c + 80])
    run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", video, "-vf", f"select='{sel}',scale={tw}:{th}", "-fps_mode", "vfr", "-q:v", "3", os.path.join(d, f"c{c // 80}_%03d.jpg")])
files = sorted(os.listdir(d))
fmap = {f: os.path.join(d, files[k]) for k, f in enumerate(uniq)}
per_row = 3
cell_w = 3 * (tw + 2) + 6
nrows = (len(plan) + per_row - 1) // per_row
for s in range(0, nrows, rows_per):
    rows = min(rows_per, nrows - s)
    im = Image.new("RGB", (per_row * cell_w, rows * (th + 30) + 4), (16, 16, 16))
    dr = ImageDraw.Draw(im)
    for k in range(s * per_row, min(len(plan), (s + rows) * per_row)):
        p = plan[k]
        x0 = (k % per_row) * cell_w + 3; y0 = 4 + ((k // per_row) - s) * (th + 30)
        n = p["n"]
        for j, f in enumerate([p["f0"], p["f0"] + n // 2, p["f0"] + n - 1]):
            im.paste(Image.open(fmap[f]).convert("RGB"), (x0 + j * (tw + 2), y0))
        bar = int(p["beat"] // 4) + 1
        dr.text((x0, y0 + th + 1), f"{p['i']:02d} {p['id']}  bar{bar} beat {p['beat']:g} +{p['beats']:g}  fr {p['f0']}-{p['f0'] + n - 1}", fill=(255, 220, 0), font=font)
        dr.text((x0, y0 + th + 14), p.get("desc", "")[:100], fill=(200, 200, 200), font=font)
    o = out("view", f"sb_{tag}_{s // rows_per + 1}.jpg")
    im.save(o, quality=88); print(o, im.size)
