"""Shared paths + source table for the header-reel work."""
import json
import os
import subprocess

WORK = os.path.dirname(os.path.abspath(__file__))
# Found from where this file sits, so the project can live anywhere: the source
# media is two folders up, and the site's public/ is beside the media folder.
SRC_DIR = os.path.dirname(os.path.dirname(WORK))
PUBLIC = os.path.join(os.path.dirname(SRC_DIR), "public")

# id -> filename. Order is alphabetical-ish, ids are just short handles.
SOURCES = {
    "v01": "2nd edit.mp4",
    "v02": "3rd edit.mp4",
    "v03": "HYROX01925388.mp4",
    "v04": "Sequence 01 (1).mp4",
    "v05": "Sequence 01.mp4",
    "v06": "Sequence 01_1.mp4",
    "v07": "Sequence 02.mp4",
    "v08": "finale.mp4",
    "v09": "recapedit.mp4",
    "v10": "video.mp4",
    "v11": "IMG_6362.MOV",
}


def src(vid):
    return os.path.join(SRC_DIR, SOURCES[vid])


def out(*parts):
    p = os.path.join(WORK, *parts)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    return p


def run(args, **kw):
    """Run a command, return CompletedProcess. Raises with stderr tail on failure."""
    r = subprocess.run(args, capture_output=True, text=True, encoding="utf-8", errors="replace", **kw)
    if r.returncode != 0:
        raise RuntimeError(f"cmd failed ({r.returncode}): {args[:6]}...\n{r.stderr[-2000:]}")
    return r


def probe(vid):
    r = run([
        "ffprobe", "-v", "error", "-select_streams", "v:0",
        "-show_entries", "stream=width,height,r_frame_rate,avg_frame_rate,nb_frames,color_transfer:stream_side_data=rotation:format=duration",
        "-of", "json", src(vid),
    ])
    j = json.loads(r.stdout)
    st = j["streams"][0]
    num, den = st["r_frame_rate"].split("/")
    rot = 0
    for sd in st.get("side_data_list", []):
        if "rotation" in sd:
            rot = int(sd["rotation"])
    w, h = st["width"], st["height"]
    if abs(rot) in (90, 270):
        w, h = h, w
    return {
        "w": w, "h": h, "fps": float(num) / float(den),
        "duration": float(j["format"]["duration"]),
        "rotation": rot, "transfer": st.get("color_transfer"),
    }
