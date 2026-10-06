"""Web encodes of the header reel, per the motion spec §4.1:
1920x1080 H.264 <= 4 Mbps, 1280x720 <= 1.8 Mbps, a WebM/VP9 alternate of each, and a poster.
usage: encode_web.py <edl tag>   (reads build/<tag>_1080.txt, the list of all-intra clip renders)"""
import os, subprocess, sys
from common import PUBLIC, out, run

tag = sys.argv[1]
lst = out("build", f"{tag}_1080.txt")
audio = out("audio", "excerpt.wav")
dst = os.path.join(PUBLIC, "hero")
os.makedirs(dst, exist_ok=True)
FR = "626"
COLOR = ["-pix_fmt", "yuv420p", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv"]
base = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-i", audio]
log = out("build", "pass")


def h264(name, scale, vb, maxrate, ab):
    vf = ["-vf", f"scale={scale}:flags=lanczos"] if scale else []
    common = vf + ["-c:v", "libx264", "-preset", "slower", "-profile:v", "high", "-b:v", vb, "-maxrate", maxrate,
                   "-bufsize", str(int(maxrate[:-1]) * 2) + "k", "-g", "60", "-keyint_min", "30", "-r", "30", "-frames:v", FR] + COLOR
    run(base + common + ["-pass", "1", "-passlogfile", log, "-an", "-f", "null", os.devnull])
    run(base + common + ["-pass", "2", "-passlogfile", log, "-c:a", "aac", "-b:a", ab, "-ar", "48000", "-shortest",
                         "-movflags", "+faststart", os.path.join(dst, name)])


def vp9(name, scale, vb, ab):
    vf = ["-vf", f"scale={scale}:flags=lanczos"] if scale else []
    common = vf + ["-c:v", "libvpx-vp9", "-b:v", vb, "-minrate", str(int(int(vb[:-1]) * 0.5)) + "k", "-maxrate", str(int(int(vb[:-1]) * 1.45)) + "k",
                   "-g", "60", "-row-mt", "1", "-tile-columns", "2", "-deadline", "good", "-cpu-used", "2", "-auto-alt-ref", "1", "-lag-in-frames", "25",
                   "-r", "30", "-frames:v", FR] + COLOR
    run(base + common + ["-pass", "1", "-passlogfile", log + "v", "-an", "-f", "null", os.devnull])
    run(base + common + ["-pass", "2", "-passlogfile", log + "v", "-c:a", "libopus", "-b:a", ab, "-shortest", os.path.join(dst, name)])


h264("reel-1080.mp4", None, "3800k", "5700k", "128k")
h264("reel-720.mp4", "1280:720", "1650k", "2500k", "96k")
vp9("reel-1080.webm", None, "2600k", "96k")
vp9("reel-720.webm", "1280:720", "1200k", "80k")
run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-frames:v", "1", "-update", "1", "-q:v", "3", os.path.join(dst, "poster.jpg")])
for f in sorted(os.listdir(dst)):
    print(f"{os.path.getsize(os.path.join(dst, f)) / 1e6:7.2f} MB  {f}")
