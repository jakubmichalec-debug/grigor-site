"""Timeline contact sheets: every preview frame (5 fps), labelled with its time.

A red tick on a frame's left edge means a detected cut fell between it and
the previous frame, so shot boundaries are visible at a glance.
"""
import glob
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

from common import SOURCES, out

PREVIEW_FPS = 5
meta = json.load(open(out("scan", "meta.json")))
shots = json.load(open(out("scan", "shots.json")))
font = ImageFont.truetype(r"C:\Windows\Fonts\arialbd.ttf", 13)

only = sys.argv[1:]
for vid in SOURCES:
    if only and vid not in only:
        continue
    files = sorted(glob.glob(os.path.join(os.path.dirname(out("scan", vid, "x")), "f_*.jpg")))
    portrait = meta[vid]["h"] > meta[vid]["w"]
    tw, th = (108, 192) if portrait else (192, 108)
    cols = 17 if portrait else 10
    rows = 4 if portrait else 7
    per = cols * rows
    cuts = [c[0] for c in shots[vid]["cuts"]]
    pad, lab = 2, 16
    for sheet_i in range(0, len(files), per):
        chunk = files[sheet_i:sheet_i + per]
        nrows = (len(chunk) + cols - 1) // cols
        W = cols * (tw + pad) + pad
        H = nrows * (th + lab + pad) + pad + 20
        im = Image.new("RGB", (W, H), (18, 18, 18))
        d = ImageDraw.Draw(im)
        d.text((4, 2), f"{vid}  {SOURCES[vid]}   {meta[vid]['w']}x{meta[vid]['h']} @{meta[vid]['fps']:.2f}  "
                       f"{meta[vid]['duration']:.2f}s   sheet from t={sheet_i / PREVIEW_FPS:.1f}s", fill=(255, 220, 0), font=font)
        for k, f in enumerate(chunk):
            idx = sheet_i + k
            t = idx / PREVIEW_FPS
            x = pad + (k % cols) * (tw + pad)
            y = 20 + pad + (k // cols) * (th + lab + pad)
            fr = Image.open(f).convert("RGB").resize((tw, th), Image.LANCZOS)
            im.paste(fr, (x, y))
            prev_t = (idx - 1) / PREVIEW_FPS
            ncut = sum(1 for c in cuts if prev_t < c <= t)
            if ncut:
                d.rectangle([x, y, x + 3, y + th], fill=(255, 40, 40))
            d.text((x + 2, y + th + 1), f"{t:.1f}" + (f"  x{ncut}" if ncut > 1 else ""), fill=(230, 230, 230), font=font)
        p = out("sheets", f"{vid}_{sheet_i // per + 1}.jpg")
        im.save(p, quality=88)
        print(p, im.size)
