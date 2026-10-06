"""Tile frames of a rendered video: viewclip.py <video> [start_frame] [count] [cols] [thumb_w]"""
import os, sys
from PIL import Image, ImageDraw, ImageFont
from common import out, run
font = ImageFont.truetype(r"C:\Windows\Fonts\arialbd.ttf", 12)
path = sys.argv[1]
start = int(sys.argv[2]) if len(sys.argv) > 2 else 0
count = int(sys.argv[3]) if len(sys.argv) > 3 else 60
cols = int(sys.argv[4]) if len(sys.argv) > 4 else 10
tw = int(sys.argv[5]) if len(sys.argv) > 5 else 192
step = int(sys.argv[6]) if len(sys.argv) > 6 else 1
th = tw * 9 // 16
d = os.path.dirname(out("view", "tmp", "x"))
for f in os.listdir(d): os.remove(os.path.join(d, f))
sel = "+".join(f"eq(n\,{start + k * step})" for k in range(count))
run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", path, "-vf", f"select='{sel}',scale={tw}:{th}", "-fps_mode", "vfr", "-q:v", "3", os.path.join(d, "f_%03d.jpg")])
files = sorted(os.listdir(d))
rows = (len(files) + cols - 1) // cols
im = Image.new("RGB", (cols * (tw + 2) + 2, rows * (th + 15) + 2), (16, 16, 16))
dr = ImageDraw.Draw(im)
for k, f in enumerate(files):
    x = 2 + (k % cols) * (tw + 2); y = 2 + (k // cols) * (th + 15)
    im.paste(Image.open(os.path.join(d, f)).convert("RGB"), (x, y))
    n = start + k * step
    dr.text((x + 2, y + th + 1), f"{n}  {n/30:.2f}s  b{n/13.0435:.2f}", fill=(235, 235, 235), font=font)
o = out("view", os.path.splitext(os.path.basename(path))[0] + f"_{start}_{count}_{step}.jpg")
im.save(o, quality=88); print(o, im.size, len(files))
