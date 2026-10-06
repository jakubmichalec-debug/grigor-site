# Header reel

| File | What it is |
| --- | --- |
| `header-reel-v3-1080p.mp4` | The cut that is on the site. 20.87 s, 12 bars at 138 BPM, full-quality master. |
| `header-reel-draft-v2-*.mp4` | The earlier draft. Superseded, safe to delete. |
| `pipeline/` | The scripts that made the reel and every still and clip on the site. |

The music is the track from `2nd edit.mp4`, starting four bars before its drop.

The site does not play the master. `pipeline/encode_web.py` turns it into the
four web files and the poster in `public/hero/`.

## Changing the cut

The whole edit is `pipeline/edl_v3.py`: one line per shot, giving the source
video, the frame it starts on and how many beats it lasts. `pipeline/common.py`
says which file each `v01` … `v11` is.

## Rebuilding

Needs Python 3 with numpy and Pillow, and ffmpeg on the PATH. From `pipeline/`:

```bash
python render.py edl_v3 --h 1080   # the cut       -> build/edl_v3_1080.mp4
python encode_web.py edl_v3        # web versions  -> public/hero/
python site_assets.py              # every still   -> public/wall, showcase, clips, reviews, gallery
python encode_clips.py             # the nine edits for the camera -> public/clips/
```

`site_assets.py` takes group names (`wall showcase clips reviews gallery`) to
redo only some of them; which photo or video frame fills which slot is listed
in that file.

`scan/` and `audio/` hold the analysis the scripts read (frame scores and the
song excerpt). If the source videos change, run `01_scan.py` first.
