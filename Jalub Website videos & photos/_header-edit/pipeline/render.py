"""EDL-driven renderer.

  python render.py <edl module> [--h 540] [--only id,id] [--no-audio] [--tag name]

The EDL module exposes CLIPS: a list of dicts, played back to back. Durations are
in beats; cut points are quantised to whole frames with floor(), so a new shot
is always on screen at (or up to one frame before) its beat, never after it.

Each clip is rendered to its own all-intra intermediate (cached by content hash),
then everything is concatenated and muxed with the song excerpt.
"""
import hashlib
import importlib
import json
import math
import os
import sys

from clipsel import select
from common import out, run, src
from scores import load

FPS = 30
BPM = 138.0
BEAT_F = 60.0 / BPM * FPS            # 13.0435 frames per beat
META = json.load(open(out("scan", "meta.json")))
TM = ("zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,"
      "zscale=t=bt709:m=bt709:r=tv,format=yuv420p")
X264_I = ["-c:v", "libx264", "-preset", "ultrafast", "-crf", "6", "-g", "1", "-pix_fmt", "yuv420p",
          "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv", "-an"]


def F(b):
    return int(math.floor(b * BEAT_F + 1e-6))


def arg(name, default=None):
    if name in sys.argv:
        return sys.argv[sys.argv.index(name) + 1]
    return default


H = int(arg("--h", 540))
W = H * 16 // 9
GAP = max(2, round(H * 12 / 1080))    # gutter between triptych panels


def frames_for(c, n):
    """Source frame numbers for a single-source layer that must yield n output frames."""
    want = c.get("take", n)             # 'take' < n => stretch (interp) or hold
    fr = select(c["src"], c["a"], want, c.get("step", 1), c.get("mode", "auto"), c.get("limit"))
    return fr


def layer_chain(c, n, w, h, label_in, label_out):
    """Filter chain turning one decoded source into n frames of w x h. Returns (chain, frames, seek)."""
    vid = c["src"]
    t, _ = load(vid)
    fr = frames_for(c, n)
    if not fr:
        raise RuntimeError(f"{c.get('id')}: no frames selected")
    a = fr[0]
    fps_src = META[vid]["fps"]
    seek = max(0.0, float(t[a]) - 0.5 / fps_src)
    sel = "+".join(f"eq(n\\,{f - a})" for f in fr)
    m = len(fr)
    parts = [f"select='{sel}'"]
    if META[vid]["transfer"] == "arib-std-b67":
        parts.append(TM)
    sw, sh = META[vid]["w"], META[vid]["h"]
    # crop the source to the target aspect first (cx, cy = where the crop window sits, 0..1)
    tgt = w / h
    if abs(sw / sh - tgt) > 0.01:
        if sw / sh > tgt:               # source wider -> crop width
            cw = f"ih*{tgt:.6f}"; chh = "ih"
        else:                           # source taller -> crop height
            cw = "iw"; chh = f"iw/{tgt:.6f}"
        cx, cy = c.get("cx", 0.5), c.get("cy", 0.5)
        parts.append(f"crop={cw}:{chh}:(iw-ow)*{cx}:(ih-oh)*{cy}")
    z = c.get("punch")                  # static punch-in factor, e.g. 1.15, with optional px/py focus
    if z:
        px, py = c.get("px", 0.5), c.get("py", 0.5)
        parts.append(f"crop=iw/{z}:ih/{z}:(iw-ow)*{px}:(ih-oh)*{py}")
    parts.append(f"scale={w}:{h}:flags=lanczos")
    parts.append("setsar=1")
    if c.get("interp") and m < n and m >= 4:
        fu = FPS * (m - 1) / max(1, n - 1)
        parts.append(f"setpts=N/({fu:.6f}*TB)")
        parts.append(f"minterpolate=fps={FPS}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1:scd=none")
        parts.append(f"setpts=N/({FPS}*TB)")
    else:
        parts.append(f"setpts=N/({FPS}*TB)")
    push = c.get("push")                # slow zoom over the clip: 0.06 = +6%
    if push:
        parts.append(f"scale=w='2*trunc({w}*(1+{push}*n/{max(1, n - 1)})/2)':h=-2:eval=frame:flags=bicubic,crop={w}:{h}")
    for fx in c.get("fx", []):
        if fx == "invert":
            parts.append("negate")
        elif fx == "bw":
            parts.append("hue=s=0")
        elif fx == "flash":
            parts.append("fade=t=in:st=0:d=0.10:color=white")
        elif fx == "flashlong":
            parts.append("fade=t=in:st=0:d=0.20:color=white")
        elif fx == "dipout":
            parts.append(f"fade=t=out:st={(n - 4) / FPS:.4f}:d={4 / FPS:.4f}:color=black")
        elif fx == "dipin":
            parts.append(f"fade=t=in:st=0:d={4 / FPS:.4f}:color=black")
        else:
            raise RuntimeError(f"unknown fx {fx}")
    delay = c.get("delay_f", 0)         # frames of black before the layer appears (triptych stagger)
    if delay:
        parts.append(f"tpad=start={delay}:start_mode=add:color=black")
    parts.append(f"tpad=stop_mode=clone:stop={n + 8}")
    parts.append(f"trim=end_frame={n},setpts=N/({FPS}*TB)")
    return f"[{label_in}]" + ",".join(parts) + f"[{label_out}]", fr, seek


def render_clip(c, n, path):
    kind = c.get("type", "full")
    if kind == "black":
        run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", f"color=black:s={W}x{H}:r={FPS}",
             "-frames:v", str(n)] + X264_I + [path])
        return {"frames": []}
    if kind == "full":
        chain, fr, seek = layer_chain(c, n, W, H, "0:v", "v")
        run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", f"{seek:.5f}", "-i", src(c["src"]),
             "-filter_complex", chain, "-map", "[v]", "-frames:v", str(n), "-r", str(FPS)] + X264_I + [path])
        return {"frames": fr}
    if kind == "tri":
        pw = (W - 2 * GAP) // 3
        pw -= pw % 2
        inputs, chains, used = [], [], []
        for i, p in enumerate(c["panels"]):
            pc = dict(p)
            pc["delay_f"] = F(p.get("delay", 0))
            chain, fr, seek = layer_chain(pc, n - pc["delay_f"], pw, H, f"{i}:v", f"p{i}")
            inputs += ["-ss", f"{seek:.5f}", "-i", src(p["src"])]
            chains.append(chain)
            used.append(fr)
        x1 = (W - pw) // 2
        x2 = W - pw
        chains.append(f"[p0][p1][p2]xstack=inputs=3:layout=0_0|{x1}_0|{x2}_0:fill=black,format=yuv420p[v]")
        run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y"] + inputs +
            ["-filter_complex", ";".join(chains), "-map", "[v]", "-frames:v", str(n), "-r", str(FPS)] + X264_I + [path])
        return {"frames": used}
    raise RuntimeError(f"unknown clip type {kind}")


def main():
    mod = importlib.import_module(sys.argv[1].replace(".py", ""))
    clips = mod.CLIPS
    tag = arg("--tag", sys.argv[1].replace(".py", ""))
    only = set(arg("--only", "").split(",")) - {""}
    cdir = os.path.dirname(out("clips", f"{H}", "x"))
    b = 0.0
    plan = []
    for i, c in enumerate(clips):
        f0, f1 = F(b), F(b + c["beats"])
        n = f1 - f0
        key = hashlib.md5(json.dumps([c, n, W, H], sort_keys=True).encode()).hexdigest()[:10]
        cid = c.get("id", f"c{i:02d}")
        path = os.path.join(cdir, f"{cid}_{key}.mp4")
        plan.append({"i": i, "id": cid, "beat": b, "beats": c["beats"], "f0": f0, "n": n, "path": path, "clip": c})
        b += c["beats"]
    total = F(b)
    print(f"{len(plan)} clips, {b:g} beats, {total} frames = {total / FPS:.4f}s  @ {W}x{H}")
    report = []
    for p in plan:
        c = p["clip"]
        if only and p["id"] not in only:
            pass
        if not os.path.exists(p["path"]):
            info = render_clip(c, p["n"], p["path"])
            json.dump(info, open(p["path"] + ".json", "w"))
            state = "rendered"
        else:
            info = json.load(open(p["path"] + ".json"))
            state = "cached"
        fr = info["frames"]
        if fr and isinstance(fr[0], list):
            desc = " | ".join(f"{pp['src']} f{u[0]}-{u[-1]} ({len(u)})" for pp, u in zip(c["panels"], fr))
        elif fr:
            want = p["n"]
            short = "" if len(fr) >= want or c.get("interp") else f"  !! only {len(fr)}/{want} frames (holding last)"
            desc = f"{c['src']} f{fr[0]}-{fr[-1]} ({len(fr)} src){' interp' if c.get('interp') else ''}{short}"
        else:
            desc = "black"
        p["desc"] = desc
        p["src_frames"] = fr
        print(f"  {p['i']:2d} {p['id']:<16s} beat {p['beat']:5.2f} +{p['beats']:<4g} frames {p['f0']:3d}-{p['f0'] + p['n'] - 1:3d} ({p['n']:2d})  {desc}  [{state}]")
    lst = out("build", f"{tag}_{H}.txt")
    with open(lst, "w") as fh:
        for p in plan:
            fh.write(f"file '{p['path'].replace(os.sep, '/')}'\n")
    json.dump([{k: v for k, v in p.items() if k != "clip"} | {"clip": p["clip"]} for p in plan], open(out("build", f"{tag}_{H}.json"), "w"), indent=1)
    final = out("build", f"{tag}_{H}.mp4")
    audio = out("audio", "excerpt.wav")
    cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst]
    use_audio = os.path.exists(audio) and "--no-audio" not in sys.argv
    if use_audio:
        cmd += ["-i", audio]
    cmd += ["-c:v", "libx264", "-preset", "veryfast" if H <= 720 else "slow", "-crf", "17" if H <= 720 else "15", "-pix_fmt", "yuv420p",
            "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
            "-r", str(FPS), "-frames:v", str(total)]
    if use_audio:
        cmd += ["-c:a", "aac", "-b:a", "192k", "-shortest"]
    cmd += ["-movflags", "+faststart", final]
    run(cmd)
    print("->", final)


if __name__ == "__main__":
    main()
