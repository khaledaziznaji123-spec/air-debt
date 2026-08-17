"""
Pets: the three things that follow you around.

    py art-src/generate-pets.py

Output, for each of moth / pup / rat:
    public/art/pet-<name>-idle.png   2 frames
    public/art/pet-<name>-walk.png   4 frames
    public/art/pet-<name>-jump.png   1 frame
All 32 x 32.

They are purely decorative — the simulation does not know they exist — so the
whole job here is silhouette. A pet is seen at a third of the player's size,
usually behind them, usually moving, against dark rock. If you cannot tell which
one it is from its outline at a glance, the money spent on it bought nothing.

So the three are deliberately different SHAPES rather than three variations on
"small animal":

    moth  wide, no legs, wings above the body   — floats, bobs, never lands hard
    pup   low and long, four legs, big head     — runs, and the run is the read
    rat   compact, one big tail, tank on back   — the only one wearing anything

The rat also carries the fiction: everything down here is breathing borrowed
air, and it is the only pet that has thought about that.
"""
import math
from pathlib import Path
from pixel import Canvas, rgb, save_strip, save_preview

W, H = 32, 32
GROUND = 29
OUT = Path(__file__).resolve().parent.parent / "public" / "art"
OUT.mkdir(parents=True, exist_ok=True)

PALETTES = {
    "moth": {
        "body_hi": rgb(0xE8E2D0), "body": rgb(0xC4BCA6), "body_sh": rgb(0x8E876F),
        "body_dk": rgb(0x55503F),
        "trim": rgb(0x9FD6CF), "trim_hi": rgb(0xDDFFF8),
        "eye": rgb(0x2E2A24),
    },
    "pup": {
        "body_hi": rgb(0x6B5344), "body": rgb(0x47342A), "body_sh": rgb(0x2C1F18),
        "body_dk": rgb(0x18100C),
        "trim": rgb(0xE8873C), "trim_hi": rgb(0xFFC07A),
        "eye": rgb(0xFFD79A),
    },
    "rat": {
        "body_hi": rgb(0x7C8290), "body": rgb(0x565C68), "body_sh": rgb(0x383D46),
        "body_dk": rgb(0x1F2229),
        "trim": rgb(0xB08430), "trim_hi": rgb(0xE8BC5E),
        "eye": rgb(0xE8556D),
    },
}


def canvas(P):
    shade = {P["body"]: (P["body_hi"], P["body_sh"])}
    outline = {
        P["body_hi"]: P["body_dk"], P["body"]: P["body_dk"],
        P["body_sh"]: P["body_dk"], P["trim"]: P["body_dk"],
        P["trim_hi"]: P["body_dk"], P["eye"]: P["body_dk"],
    }
    return Canvas(W, H, shade, outline, P["body_dk"])


# --------------------------------------------------------------------- moth
def moth(P, wing, bob):
    """Wings above the body, so the silhouette is a T rather than a blob."""
    c = canvas(P)
    y = 16 + bob
    # Wings, angled by `wing`. Drawn first so the body sits in front of them.
    for side in (-1, 1):
        tip_y = y - 9 - wing * 3
        c.taper(16 + side * 2, y - 1, 16 + side * 12, tip_y, 9, 4, P["body_sh"])
        c.taper(16 + side * 2, y - 1, 16 + side * 10, tip_y + 2, 6, 3, P["body"])
        c.set(16 + side * 8, tip_y + 3, P["trim"])
    c.taper(16, y - 5, 16, y + 6, 8, 5, P["body"])
    c.rect(13, y - 1, 18, y, P["trim"])
    c.disc(16, y - 6, 4, P["body_hi"])
    c.set(14, y - 7, P["eye"])
    c.set(18, y - 7, P["eye"])
    # Antennae, because a moth without them reads as a leaf.
    c.taper(14, y - 9, 11, y - 14, 2, 1, P["body_sh"])
    c.taper(18, y - 9, 21, y - 14, 2, 1, P["body_sh"])
    c.shade()
    c.outline()
    return c.image()


# ---------------------------------------------------------------------- pup
def pup(P, step, bob, airborne=False):
    """Low, long, and all head. The legs are the animation."""
    c = canvas(P)
    ground = GROUND - (5 if airborne else 0)
    y = ground - 9 + bob

    for i, phase in enumerate((0, 2, 1, 3)):
        swing = math.sin((step + phase) * math.pi / 2) * (5 if not airborne else 2)
        x = 10 + (i // 2) * 9
        foot = ground if not airborne else ground - 2 + (i % 2)
        c.taper(x, y + 3, x + swing, foot - 1, 4, 3,
                P["body_sh"] if i % 2 else P["body"])
        c.rect(x + swing - 2, foot - 1, x + swing + 1, foot, P["body_dk"])

    c.taper(9, y, 21, y - 1, 11, 9, P["body"])
    c.taper(10, y - 3, 20, y - 4, 5, 4, P["body_hi"])
    # Tail, up and curled.
    c.taper(9, y - 1, 4, y - 7 - bob, 4, 2, P["body_sh"])
    # Head: oversized, which is the whole charm.
    c.disc(23, y - 4, 6, P["body"])
    c.disc(24, y - 6, 4, P["body_hi"])
    c.taper(27, y - 2, 30, y - 1, 5, 4, P["body"])
    c.set(29, y - 1, P["body_dk"])
    c.disc(25, y - 4, 1.4, P["eye"])
    # Ears, one up one folded, because symmetry reads as a machine.
    c.taper(21, y - 9, 19, y - 14, 4, 2, P["body_sh"])
    c.taper(26, y - 9, 28, y - 12, 4, 2, P["trim"])
    c.shade()
    c.outline()
    return c.image()


# ---------------------------------------------------------------------- rat
def rat(P, step, bob, airborne=False):
    """Compact, one big tail, and a canister strapped to its back."""
    c = canvas(P)
    ground = GROUND - (5 if airborne else 0)
    y = ground - 7 + bob

    for i in range(4):
        swing = math.sin((step + i) * math.pi / 2) * (4 if not airborne else 1)
        x = 11 + (i // 2) * 8
        c.taper(x, y + 2, x + swing, ground - 1, 3, 2,
                P["body_sh"] if i % 2 else P["body"])

    # Tail: one long curve, the loudest thing in the outline.
    for k in range(10):
        f = k / 9
        c.disc(9 - f * 7, y - f * f * 9 + 2, 1.6 - f * 0.7, P["body_sh"])

    c.taper(10, y, 21, y, 10, 8, P["body"])
    # The canister, and its straps.
    c.rect(12, y - 8, 17, y - 2, P["body_sh"])
    c.rect(12, y - 8, 13, y - 2, P["trim"])
    c.rect(11, y - 6, 18, y - 5, P["trim"])
    c.taper(17, y - 7, 21, y - 5, 2, 2, P["trim_hi"])

    c.disc(23, y - 2, 5, P["body"])
    c.disc(24, y - 3, 3, P["body_hi"])
    c.taper(26, y, 31, y + 1, 4, 2, P["body"])
    c.disc(25, y - 3, 1.3, P["eye"])
    c.disc(21, y - 7, 2.6, P["body_sh"])   # ear
    c.disc(21, y - 7, 1.5, P["trim"])
    c.shade()
    c.outline()
    return c.image()


def build(name):
    P = PALETTES[name]
    if name == "moth":
        # No legs, so the walk IS the wingbeat and the jump is a hard upstroke.
        idle = [moth(P, 0, 0), moth(P, 1, -1)]
        walk = [moth(P, 0, 0), moth(P, 1, -2), moth(P, 2, -1), moth(P, 1, 1)]
        jump = [moth(P, 2, -4)]
    else:
        draw = pup if name == "pup" else rat
        idle = [draw(P, 0, 0), draw(P, 0, -1)]
        walk = [draw(P, s, -(s % 2)) for s in range(4)]
        jump = [draw(P, 1, -3, airborne=True)]
    return idle, walk, jump


for name in PALETTES:
    idle, walk, jump = build(name)
    save_strip(idle, OUT / f"pet-{name}-idle.png", W, H)
    save_strip(walk, OUT / f"pet-{name}-walk.png", W, H)
    save_strip(jump, OUT / f"pet-{name}-jump.png", W, H)

allf = []
for name in PALETTES:
    i, w, j = build(name)
    allf += i + w + j
save_preview(allf, Path(__file__).resolve().parent / "_preview-pets.png", W, H, scale=5)
