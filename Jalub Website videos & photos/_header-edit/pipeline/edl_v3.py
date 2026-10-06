"""Header reel, cut v3.  12 bars @ 138 BPM = 48 beats = 626 frames @ 30 fps."""
V = lambda src, a, beats, **k: dict(src=src, a=a, beats=beats, **k)

CLIPS = [
    # ── BUILD ─────────────────────────────────────────────────────────────
    # bar 1 — sunset
    V("v07", 122, 4, id="b1_sunset", limit=201, take=32, interp=True),
    # bar 2 — the night
    V("v04", 384, 2, id="b2_cabin", limit=458),
    V("v01", 112, 1, id="b2_headlamp", limit=172),
    V("v01", 178, 1, id="b2_aid", limit=209),
    # bar 3 — dawn
    V("v04", 730, 2, id="b3_sunrise", limit=760),
    V("v04", 707, 1, id="b3_mist", limit=725, take=11, interp=True),
    V("v04", 594, 0.5, id="b3_hills", limit=618),
    V("v04", 770, 0.5, id="b3_road", limit=832),
    # bar 4 — the one behind the camera, then in through the door
    V("v03", 22, 1, id="b4_walk", limit=60),
    V("v03", 64, 1, id="b4_close", limit=110),
    V("v11", 540, 1, id="b4_selfie", step=2, cy=0.40),
    V("v10", 4, 1, id="b4_door", limit=37, punch=1.3, px=0.5, py=0.62, push=0.08),
    # ── DROP ──────────────────────────────────────────────────────────────
    # bar 5 — HYROX
    V("v10", 97, 2, id="b5_jets", limit=214),
    V("v10", 220, 1, id="b5_skierg", limit=264),
    V("v10", 650, 1, id="b5_lunge", limit=712),
    # bar 6 — road racing
    V("v09", 119, 1, id="b6_peloton", limit=134),
    V("v09", 290, 1, id="b6_whip", limit=316),
    V("v09", 510, 1, id="b6_drone", limit=535),
    V("v09", 436, 0.5, id="b6_climb", limit=457),
    V("v09", 244, 0.5, id="b6_wheels", limit=263),
    # bar 7 — snow park
    V("v08", 444, 2, id="b7_skier", limit=482),
    V("v08", 381, 1, id="b7_pink", limit=426, step=2, punch=1.5, px=0.74, py=0.35),
    V("v08", 560, 1, id="b7_flip", limit=620, step=2),
    # bar 8 — training (the track filters down, then drops out)
    V("v02", 107, 1, id="b8_row", limit=146),
    V("v02", 222, 2, id="b8_erg", limit=313),
    dict(type="black", beats=0.5, id="b8_black"),
    V("v02", 88, 0.5, id="b8_thermal", limit=101),
    # bar 9 — HYROX, vertical footage as triptychs
    dict(type="tri", beats=2, id="b9_triA", panels=[
        dict(src="v06", a=506, limit=536, take=16, interp=True),
        dict(src="v06", a=975, limit=1006, mode="none"),
        dict(src="v06", a=934, limit=965)]),
    dict(type="tri", beats=2, id="b9_triB", panels=[
        dict(src="v06", a=394, limit=426),
        dict(src="v06", a=1133, limit=1176),
        dict(src="v06", a=1055, limit=1121)]),
    # bar 10 — trail
    V("v05", 567, 2, id="b10_shoes", limit=636),
    V("v05", 440, 1, id="b10_tree", limit=476),
    V("v05", 290, 1, id="b10_trail", limit=369),
    # bar 11 — everything at once, on the eighths
    V("v10", 170, 0.5, id="b11_a", limit=214),
    V("v08", 210, 0.5, id="b11_b", limit=234),
    V("v09", 210, 0.5, id="b11_c", limit=238),
    V("v07", 318, 0.5, id="b11_d", limit=353),
    V("v02", 668, 0.5, id="b11_e", limit=741),
    V("v05", 394, 0.5, id="b11_f", limit=434),
    V("v01", 215, 0.5, id="b11_g", limit=273),
    V("v11", 60, 0.5, id="b11_h", step=2, cy=0.53),
    # bar 12 — the finish, and back to the sunset
    V("v04", 1156, 2, id="b12_finish", limit=1207),
    V("v04", 1213, 1, id="b12_arch", limit=1262),
    V("v07", 382, 1, id="b12_red", limit=455),
]
