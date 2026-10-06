"""Stills for every image slot on the site, cut from the user's photos and videos.

  python site_assets.py [group ...] [--sheet]     groups: wall showcase clips reviews gallery

Each entry names a source (a photo file, or (video id, frame number)), the slot's
aspect ratio, and where in the source to look. Output goes to <project>/public/.
"""
import json
import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps

from common import PUBLIC, SRC_DIR, out, run, src
from scores import load

META = json.load(open(out("scan", "meta.json")))
TM = ("zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,"
      "zscale=t=bt709:m=bt709:r=tv,format=yuv420p")


def grab(vid, f):
    """Full-resolution frame f of a source video, cached as PNG."""
    p = out("grabs", f"{vid}_{f:05d}.png")
    if not os.path.exists(p):
        t, _ = load(vid)
        seek = max(0.0, float(t[f]) - 0.5 / META[vid]["fps"])
        vf = (TM + "," if META[vid]["transfer"] == "arib-std-b67" else "") + "format=rgb24"
        run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", f"{seek:.5f}", "-i", src(vid),
             "-vf", vf, "-frames:v", "1", "-update", "1", p])
    return Image.open(p).convert("RGB")


def photo(name):
    p = os.path.join(SRC_DIR, name)
    try:
        im = Image.open(p)
        im = ImageOps.exif_transpose(im).convert("RGB")
        return im
    except Exception:
        tmp = out("grabs", os.path.splitext(name)[0] + ".png")
        if not os.path.exists(tmp):
            run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", p, "-frames:v", "1", "-update", "1", tmp])
        return Image.open(tmp).convert("RGB")


def _longest_run(flags):
    best, cur, start = (0, 0), 0, 0
    for i, f in enumerate(list(flags) + [False]):
        if f:
            if cur == 0:
                start = i
            cur += 1
        else:
            if cur > best[1] - best[0]:
                best = (start, start + cur)
            cur = 0
    return best


def inner_box(im, thresh=236, inset=12):
    """The picture inside a white mat (framed export): longest run of mostly-non-white rows and columns."""
    g = np.asarray(im.convert("L"))
    mask = g < thresh
    y0, y1 = _longest_run(mask.mean(axis=1) > 0.5)
    if y1 - y0 < 0.2 * im.height:
        return (0, 0, im.width, im.height)
    x0, x1 = _longest_run(mask[y0:y1].mean(axis=0) > 0.5)
    if (x1 - x0) > 0.985 * im.width and (y1 - y0) > 0.985 * im.height:
        return (0, 0, im.width, im.height)
    return (int(x0 + inset), int(y0 + inset), int(x1 - inset), int(y1 - inset))


def cut(im, aspect, fx=0.5, fy=0.5, zoom=1.0, box=None):
    """Largest window of `aspect` inside `box`, shrunk by `zoom`, placed by focal point (0..1 of the slack)."""
    bx0, by0, bx1, by1 = box or (0, 0, im.width, im.height)
    bw, bh = bx1 - bx0, by1 - by0
    if bw / bh > aspect:
        h = bh; w = h * aspect
    else:
        w = bw; h = w / aspect
    w, h = w / zoom, h / zoom
    x = bx0 + (bw - w) * fx
    y = by0 + (bh - h) * fy
    return im.crop((int(round(x)), int(round(y)), int(round(x + w)), int(round(y + h))))


def make(e):
    s = e["src"]
    im = photo(s) if isinstance(s, str) else grab(*s)
    box = e.get("box")
    if box:                                   # fractions of the image: (x0, y0, x1, y1)
        box = (int(box[0] * im.width), int(box[1] * im.height), int(box[2] * im.width), int(box[3] * im.height))
    elif e.get("inner"):
        box = inner_box(im)
    c = cut(im, e["aspect"], e.get("fx", 0.5), e.get("fy", 0.5), e.get("zoom", 1.0), box)
    W = e["w"]
    Hh = int(round(W / e["aspect"]))
    c = c.resize((W, Hh), Image.LANCZOS)
    if e.get("gray"):
        c = c.convert("L")
    p = os.path.join(PUBLIC, e["out"].replace("/", os.sep))
    os.makedirs(os.path.dirname(p), exist_ok=True)
    kw = dict(quality=e.get("q", 86), optimize=True, progressive=True)
    if not e.get("gray"):
        kw["subsampling"] = 0
    c.save(p, **kw)
    return p, c


A169, A45, A32 = 16 / 9, 4 / 5, 3 / 2

# ── the wall: 35 tiles, n = 1..35 reading order, 18 is the hero ───────────────
WALL_PICKS = {
    1: ("v09", 220), 2: ("v01", 355), 3: ("v08", 575), 4: ("v05", 455), 5: ("v10", 660), 6: ("v04", 715), 7: ("v02", 260),
    8: dict(src=("v06", 982), fy=0.52), 9: ("v04", 1180), 10: ("v09", 295), 11: ("v07", 330), 12: ("v10", 150), 13: ("v03", 30), 14: dict(src=("v08", 390), zoom=1.5, fx=0.74, fy=0.35),
    15: ("v05", 600), 16: ("v09", 158), 17: ("v01", 190), 19: ("v08", 455), 20: ("v02", 125), 21: ("v04", 745),
    22: ("v10", 400), 23: dict(src=("v11", 560), fy=0.40), 24: ("v09", 125), 25: ("v04", 790), 26: dict(src=("v06", 1150), fy=0.22), 27: ("v05", 300), 28: ("v09", 520),
    29: ("v01", 240), 30: "16.jpeg", 31: ("v10", 830), 32: ("v07", 420), 33: "1.jpeg", 34: ("v08", 212), 35: ("v01", 650),
}


def wall():
    items = []
    for n, pick in sorted(WALL_PICKS.items()):
        e = dict(pick) if isinstance(pick, dict) else dict(src=pick)
        e.update(out=f"wall/{n:02d}.jpg", aspect=A169, w=640, gray=True, q=80)
        items.append(e)
    return items


SHOWCASE = [
    dict(out="showcase/nocturne.jpg", src="IMG_9848.JPG", inner=True, aspect=A45, w=960),
    dict(out="showcase/arena.jpg", src=("v06", 1150), aspect=A45, w=960, fy=0.18),
    dict(out="showcase/peloton.jpg", src="image00001-3.jpeg", aspect=A45, w=960, fy=0.35),
    dict(out="showcase/switchback.jpg", src="IMG_9623.JPG", inner=True, aspect=A45, w=960),
    dict(out="showcase/low-winter-sun.jpg", src=("v08", 450), aspect=A45, w=960, fx=0.3),
]

CLIP_STILLS = [
    dict(out="clips/vitosha-100.jpg", src=("v01", 355)),
    dict(out="clips/art-of-endurance.jpg", src=("v05", 600)),
    dict(out="clips/hyrox.jpg", src=("v10", 150)),
    dict(out="clips/chill-and-thrill.jpg", src=("v08", 455)),
    dict(out="clips/race-recap.jpg", src=("v09", 220)),
    dict(out="clips/sunset-run.jpg", src=("v07", 330)),
    dict(out="clips/embrace-the-struggle.jpg", src=("v04", 745)),
    dict(out="clips/race-prep.jpg", src=("v02", 125)),
    dict(out="clips/hyrox-vertical.jpg", src=("v06", 1150), fy=0.22),
]
for e in CLIP_STILLS:
    e.update(aspect=A32, w=1200)

# One per card in components/home/Reviews.tsx, each chosen to show what its line
# says. Named for the stage rather than numbered, so a card whose picture changes
# gets a new address and nothing serves the old one from a cache.
REVIEWS = [
    dict(out="reviews/brief.jpg", src="8A1C75C9-A2F7-42D9-AA3B-831F284EB02B.jpg", box=(0, 0, 1, 0.5), fy=0.5),
    dict(out="reviews/race-day.jpg", src=("v01", 145)),
    dict(out="reviews/coverage.jpg", src=("v04", 1180)),
    dict(out="reviews/edit.jpg", src=("v08", 212)),
    dict(out="reviews/delivery.jpg", src=("v10", 660)),
]
for e in REVIEWS:
    e.update(aspect=A169, w=1280)

R = {"4/3": 4 / 3, "3/4": 3 / 4, "16/9": 16 / 9, "1/1": 1.0}
GALLERY = [
    dict(n=1, r="4/3", src="IMG_1728.JPG"),
    dict(n=2, r="3/4", src="FAB04833-9C9A-42A4-8B6F-B75CB4FC3EC6.jpg", inner=True),
    dict(n=3, r="16/9", src="1.jpg"),
    dict(n=4, r="1/1", src="IMG_9276.HEIC", fy=0.42),
    dict(n=5, r="16/9", src="16.jpeg"),
    dict(n=6, r="4/3", src="2.jpg"),
    dict(n=7, r="1/1", src="IMG_9847.JPG", inner=True),
    dict(n=8, r="4/3", src="1.jpeg", fx=0.35),
    dict(n=9, r="3/4", src="BBF9EB38-4878-45AA-99FA-DE029C92DCEF.jpeg"),
    dict(n=10, r="3/4", src="image00001-2.jpeg"),
    dict(n=11, r="16/9", src="IMG_9696.TIF"),
    dict(n=12, r="1/1", src="IMG_7635.JPG", inner=True, fy=0.4),
    dict(n=13, r="4/3", src="image00004-9.jpeg", fy=0.25),
    dict(n=14, r="1/1", src="image00001-3.jpeg", fy=0.3),
    dict(n=15, r="4/3", src="8A1C75C9-A2F7-42D9-AA3B-831F284EB02B.jpg", box=(0, 0, 1, 0.5), fy=0.35),
]
for e in GALLERY:
    a = R[e["r"]]
    e.update(out=f"gallery/{e['n']:02d}.jpg", aspect=a, w=1600 if a >= 1 else 1200)

GROUPS = {"wall": wall(), "showcase": SHOWCASE, "clips": CLIP_STILLS, "reviews": REVIEWS, "gallery": GALLERY}


def sheet(name, made, cols, tw):
    font = ImageFont.truetype(r"C:\Windows\Fonts\arialbd.ttf", 12)
    cells = []
    for e, (p, im) in made:
        th = int(round(tw / e["aspect"]))
        cells.append((e, im.convert("RGB").resize((tw, th), Image.LANCZOS), os.path.getsize(p)))
    rows = [cells[i:i + cols] for i in range(0, len(cells), cols)]
    H = sum(max(c[1].height for c in r) + 18 for r in rows) + 4
    sh = Image.new("RGB", (cols * (tw + 4) + 4, H), (16, 16, 16))
    d = ImageDraw.Draw(sh)
    y = 4
    for r in rows:
        rh = max(c[1].height for c in r)
        for k, (e, im, size) in enumerate(r):
            x = 4 + k * (tw + 4)
            sh.paste(im, (x, y))
            s = e["src"]
            label = f"{os.path.basename(e['out'])}  {s if isinstance(s, str) else s[0] + ' f' + str(s[1])}  {size // 1024}k"
            d.text((x + 2, y + rh + 2), label[:int(tw / 6.2)], fill=(255, 220, 0), font=font)
        y += rh + 18
    o = out("view", f"assets_{name}.jpg")
    sh.save(o, quality=88)
    print("sheet", o, sh.size)


if __name__ == "__main__":
    want = [a for a in sys.argv[1:] if not a.startswith("--")] or list(GROUPS)
    for g in want:
        made = []
        total = 0
        for e in GROUPS[g]:
            p, im = make(e)
            total += os.path.getsize(p)
            made.append((e, (p, im)))
        print(f"{g}: {len(made)} files, {total / 1024:.0f} KB")
        if "--sheet" in sys.argv:
            cols, tw = {"wall": (7, 270), "showcase": (5, 380), "clips": (5, 380), "reviews": (5, 380), "gallery": (5, 380)}[g]
            sheet(g, made, cols, tw)
