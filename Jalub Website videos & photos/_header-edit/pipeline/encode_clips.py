"""The user's finished edits, encoded for the camera section: a full version for the
full-screen viewer and a small muted 3:2 cut for the camera's own screen."""
import json, os, sys
from common import PUBLIC, out, run, src

META = json.load(open(out("scan", "meta.json")))
dst = os.path.join(PUBLIC, "clips")
os.makedirs(dst, exist_ok=True)
CLIPS = [("vitosha-100", "v01"), ("art-of-endurance", "v05"), ("hyrox", "v10"), ("chill-and-thrill", "v08"), ("race-recap", "v09"),
         ("sunset-run", "v07"), ("embrace-the-struggle", "v04"), ("race-prep", "v02"), ("hyrox-vertical", "v06")]
COLOR = ["-pix_fmt", "yuv420p", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv"]
LOOPS_ONLY = "--loops" in sys.argv
only = [a for a in sys.argv[1:] if not a.startswith("--")]
for cid, vid in CLIPS:
    if only and cid not in only:
        continue
    m = META[vid]
    portrait = m["h"] > m["w"]
    fps = m["fps"]
    full = os.path.join(dst, f"{cid}.mp4")
    size = "1080:1920" if portrait else "1920:1080"
    if not LOOPS_ONLY:
      run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", src(vid), "-vf", f"scale={size}:flags=lanczos",
         "-c:v", "libx264", "-preset", "slow", "-profile:v", "high", "-crf", "23", "-maxrate", "6000k", "-bufsize", "12000k",
         "-g", str(int(round(fps * 2))), "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-movflags", "+faststart"] + COLOR + [full])
    loop = os.path.join(dst, f"{cid}-loop.mp4")
    crop = "crop=iw:iw/1.5:0:(ih-oh)*0.30" if portrait else "crop=ih*1.5:ih"
    half = "fps=fps=source_fps/2," if fps > 40 else ""
    run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", src(vid), "-vf", f"{half}{crop},scale=720:480:flags=lanczos",
         "-an", "-c:v", "libx264", "-preset", "slow", "-profile:v", "main", "-crf", "30", "-maxrate", "850k", "-bufsize", "1700k",
         "-g", "60", "-movflags", "+faststart"] + COLOR + [loop])
    print(f"{cid:22s} full {os.path.getsize(full) / 1e6:6.2f} MB   loop {os.path.getsize(loop) / 1e6:5.2f} MB", flush=True)
