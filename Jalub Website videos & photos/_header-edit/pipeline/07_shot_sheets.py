"""Per-shot sheets: for every shot >= MIN_DUR show start / middle / end frames, bigger than the timeline sheets.

Single takes (v03, v11) are sampled every 0.5 s instead.
"""
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

from common import SOURCES, out, run, src

MIN_DUR = 0.20
meta = json.load(open(out("scan", "meta.json")))
shots = json.load(open(out("scan", "shots.json")))
font = ImageFont.truetype(r"C:\Windows\Fonts\arialbd.ttf", 14)
TM = "zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p,"

LAYOUT_ONLY = "--layout-only" in sys.argv
only = [a for a in sys.argv[1:] if not a.startswith("--")]
for vid in SOURCES:
    if only and vid not in only:
        continue
    fps = meta[vid]["fps"]
    portrait = meta[vid]["h"] > meta[vid]["w"]
    tw, th = (180, 320) if portrait else (320, 180)
    items = []  # (label, [frame numbers])
    sl = shots[vid]["shots"]
    if len(sl) == 1:
        dur = meta[vid]["duration"]
        t = 0.0
        while t < dur - 0.05:
            items.append((f"t={t:.1f}", [int(round(t * fps))]))
            t += 0.5
    else:
        for s in sl:
            if s["dur"] < MIN_DUR:
                continue
            a = int(round(s["start"] * fps)) + 2
            b = int(round(s["end"] * fps)) - 3
            if b <= a:
                b = a
            m = (a + b) // 2
            items.append((f"#{s['i']:02d} {s['start']:.2f}-{s['end']:.2f} ({s['dur']:.2f}s)", [a, m, b]))
    frames = sorted({f for _, fl in items for f in fl})
    d = os.path.dirname(out("shotframes", vid, "x"))
    if not LAYOUT_ONLY:
        for old in os.listdir(d):
            os.remove(os.path.join(d, old))
    tm = TM if meta[vid]["transfer"] == "arib-std-b67" else ""
    # ffmpeg's expression parser gives up past ~100 terms, so select in chunks
    for c in ([] if LAYOUT_ONLY else range(0, len(frames), 70)):
        sel = "+".join(f"eq(n\\,{f})" for f in frames[c:c + 70])
        run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", src(vid),
             "-vf", f"select='{sel}',{tm}scale={tw * 2}:{th * 2}", "-fps_mode", "vfr", "-q:v", "3",
             f"s_{c // 70}_%04d.jpg"], cwd=d)
    got = sorted(os.listdir(d))
    fmap = {f: os.path.join(d, got[k]) for k, f in enumerate(frames) if k < len(got)}
    # layout
    per_item = max(len(fl) for _, fl in items)
    cell_w = per_item * (tw + 2) + 10
    cols = max(1, 1960 // cell_w)
    rows_per_sheet = 4 if portrait else 6
    per_sheet = cols * rows_per_sheet
    for si in range(0, len(items), per_sheet):
        chunk = items[si:si + per_sheet]
        nrows = (len(chunk) + cols - 1) // cols
        im = Image.new("RGB", (cols * cell_w, nrows * (th + 22) + 22), (16, 16, 16))
        dr = ImageDraw.Draw(im)
        dr.text((4, 3), f"{vid} {SOURCES[vid]}  shots (start / mid / end)   fps={fps:.2f}", fill=(255, 220, 0), font=font)
        for k, (label, fl) in enumerate(chunk):
            x0 = (k % cols) * cell_w + 4
            y0 = 22 + (k // cols) * (th + 22)
            for j, f in enumerate(fl):
                if f in fmap:
                    im.paste(Image.open(fmap[f]).convert("RGB").resize((tw, th), Image.LANCZOS), (x0 + j * (tw + 2), y0))
            dr.text((x0, y0 + th + 2), label, fill=(235, 235, 235), font=font)
        p = out("shotsheets", f"{vid}_{si // per_sheet + 1}.jpg")
        im.save(p, quality=88)
        print(os.path.basename(p), im.size, len(chunk), "items")
