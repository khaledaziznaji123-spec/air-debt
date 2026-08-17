"""
Environment 2's two monsters — original designs, generated pixel by pixel.

    py art-src/generate-fire.py

Both are drawn against the fire rather than against each other, but the pair
still has to be readable apart at a glance, because they are answered in
opposite ways. So they are opposites of shape as well as of behaviour:

  phoenix       wide, thin, airborne, all horizontal — a shape that reads as
                "far away and above you", which is exactly where it stays
  flamethrower  narrow, top-heavy, planted, all vertical — a shape that reads as
                "coming here", which is the only thing it does

The palette is shared with the lava so the two of them look like they belong to
the place: the same four-value orange runs through the bird's feathers, the
maniac's pilot light and the pools underfoot.

Output:
  phoenix-hover (4), phoenix-charge (2), phoenix-throw (2), phoenix-stagger (1)
  flamer-idle (2), flamer-walk (6), flamer-wind (2), flamer-burn (4),
  flamer-stagger (1)
"""
from pathlib import Path
from pixel import Canvas, rgb, save_strip, save_preview

OUT = Path(__file__).resolve().parent.parent / "public" / "art"
OUT.mkdir(parents=True, exist_ok=True)

# The one palette. Ember tones are shared with the terrain's lava on purpose —
# a monster lit differently from the ground it stands on reads as pasted on.
P = {
    "ash_hi": rgb(0x6E5A52), "ash": rgb(0x4A3B36), "ash_sh": rgb(0x2E2422), "ash_dk": rgb(0x171110),
    "coal_hi": rgb(0x53433F), "coal": rgb(0x332926), "coal_sh": rgb(0x1E1817), "coal_dk": rgb(0x0E0B0A),
    "ember_hi": rgb(0xFFE9A0), "ember": rgb(0xFF9A3C), "ember_sh": rgb(0xC7501A), "ember_dk": rgb(0x7A2410),
    "flame_hi": rgb(0xFFF3C4), "flame": rgb(0xFFC252), "flame_sh": rgb(0xE0741F),
    "iron_hi": rgb(0xB9C0C8), "iron": rgb(0x7C848D), "iron_sh": rgb(0x4E555D), "iron_dk": rgb(0x2A2F35),
    "brass_hi": rgb(0xE0BE72), "brass": rgb(0xA98436), "brass_sh": rgb(0x6E5320),
    "rag_hi": rgb(0x6B4A32), "rag": rgb(0x4A3122), "rag_sh": rgb(0x2F1E14),
    "glass": rgb(0x8FD5CE), "glass_sh": rgb(0x3E7A75),
}

SHADE = {
    P["ash"]: (P["ash_hi"], P["ash_sh"]),
    P["coal"]: (P["coal_hi"], P["coal_sh"]),
    P["ember"]: (P["ember_hi"], P["ember_sh"]),
    P["iron"]: (P["iron_hi"], P["iron_sh"]),
    P["brass"]: (P["brass_hi"], P["brass_sh"]),
    P["rag"]: (P["rag_hi"], P["rag_sh"]),
}
OUTLINE = {
    P["ash_hi"]: P["ash_dk"], P["ash"]: P["ash_dk"], P["ash_sh"]: P["ash_dk"],
    P["coal_hi"]: P["coal_dk"], P["coal"]: P["coal_dk"], P["coal_sh"]: P["coal_dk"],
    # Embers outline in a darker ember rather than in black: a glowing thing
    # ringed in black reads as a sticker, not as a light source.
    P["ember_hi"]: P["ember_sh"], P["ember"]: P["ember_dk"], P["ember_sh"]: P["ember_dk"],
    P["flame_hi"]: P["ember"], P["flame"]: P["ember_sh"], P["flame_sh"]: P["ember_dk"],
    P["iron_hi"]: P["iron_dk"], P["iron"]: P["iron_dk"], P["iron_sh"]: P["iron_dk"],
    P["brass_hi"]: P["brass_sh"], P["brass"]: P["brass_sh"],
    P["rag_hi"]: P["rag_sh"], P["rag"]: P["rag_sh"],
    P["glass"]: P["glass_sh"],
}


# ===========================================================================
# The phoenix.
#
# Hurtbox 40 x 88, drawn into 72 x 96 — the extra width is all wing, and it is
# empty pixels either side when the wings are folded. A wingspan that had to fit
# the hurtbox would be a chicken.
# ===========================================================================
PW, PH_ = 72, 96
PCX, PBOT = 36, 92


def pcanvas():
    return Canvas(PW, PH_, SHADE, OUTLINE, P["ash_dk"])


def phoenix_body(c, beat):
    """`beat` is -1 (wings down) to 1 (wings up)."""
    body_y = 52 - int(beat * 3)

    # Wings first, so the body overlaps them and reads as in front.
    for side in (-1, 1):
        tip_y = body_y - int(beat * 20) - 6
        tip_x = PCX + side * 34
        # Three feather bands, longest at the leading edge.
        for n, (spread, col) in enumerate(
            ((0, P["ember_sh"]), (6, P["ember"]), (11, P["ember_hi"]))
        ):
            c.taper(
                PCX + side * 6,
                body_y + 2 + n,
                tip_x - side * n * 3,
                tip_y + spread,
                9 - n * 2,
                3,
                col,
            )
        # A few coal-dark primaries hanging off the trailing edge, so the wing
        # has a bottom rather than fading out.
        for n in range(3):
            x = PCX + side * (18 + n * 6)
            c.taper(x, body_y + 6, x + side * 5, body_y + 14 + n * 2, 4, 2, P["coal"])

    # Body: a long horizontal wedge. Everything about this shape is sideways.
    c.taper(PCX - 12, body_y + 2, PCX + 13, body_y - 1, 15, 11, P["ash"])
    c.taper(PCX + 10, body_y - 1, PCX + 20, body_y - 6, 10, 6, P["ash_hi"])

    # Tail: three trailing streamers of fire behind the body.
    for n, col in enumerate((P["ember_sh"], P["ember"], P["ember_hi"])):
        c.taper(PCX - 10, body_y + 1 + n * 2, PCX - 30, body_y + 6 + n * 5 - int(beat * 4), 7 - n, 2, col)

    # Head and beak, forward and low — a bird that is looking at you.
    c.disc(PCX + 21, body_y - 8, 6, P["ash_hi"])
    c.taper(PCX + 25, body_y - 7, PCX + 33, body_y - 4, 5, 2, P["brass"])
    c.set(PCX + 23, body_y - 10, P["flame_hi"])
    c.set(PCX + 24, body_y - 10, P["ember_hi"])

    # A crest, because the silhouette needs something on top to not read as a
    # dart at a distance.
    for n in range(3):
        c.taper(PCX + 18 - n * 3, body_y - 12, PCX + 14 - n * 4, body_y - 20 - n * 2, 4, 2, P["ember"])

    # Talons, tucked.
    for side in (-1, 1):
        c.taper(PCX + side * 4, body_y + 9, PCX + side * 6, body_y + 15, 4, 2, P["brass_sh"])


def phoenix_hover(beat):
    c = pcanvas()
    phoenix_body(c, beat)
    c.mottle(P["ash"], P["ember_sh"], 0.10, seed=7)
    return c


def phoenix_charge(n):
    """Winding up. The fire gathers in front of the beak and it pulls back."""
    c = pcanvas()
    phoenix_body(c, -0.4 - n * 0.2)
    ball = 3 + n * 2
    c.disc(PCX + 36, 44, ball, P["ember"])
    c.disc(PCX + 36, 44, max(ball - 2, 1), P["flame_hi"])
    return c


def phoenix_throw(n):
    """The loose. Wings down hard, the ball leaving frame."""
    c = pcanvas()
    phoenix_body(c, -1)
    if n == 0:
        c.disc(PCX + 40, 44, 6, P["ember_hi"])
        c.disc(PCX + 40, 44, 3, P["flame_hi"])
    else:
        for k in range(4):
            c.set(PCX + 34 + k * 2, 44 - k, P["ember"])
    return c


def phoenix_stagger():
    c = pcanvas()
    phoenix_body(c, -0.9)
    # Guttering: the fire goes out of it for a moment, which is the tell that
    # it is open.
    c.mottle(P["ember"], P["coal"], 0.55, seed=3)
    c.mottle(P["ember_hi"], P["ash_sh"], 0.5, seed=4)
    return c


# ===========================================================================
# The flamethrower.
#
# Hurtbox 38 x 86 into 56 x 96. Top-heavy on purpose: a tank on the back, a
# stooped spine, and a nozzle held out front. It should look like it is falling
# towards you even when it is standing still.
# ===========================================================================
FW, FH = 56, 96
FCX, FBOT, FHIP, FSHO = 26, 92, 58, 36


def fcanvas():
    return Canvas(FW, FH, SHADE, OUTLINE, P["coal_dk"])


def flamer_legs(c, stride, lift):
    for side, sh in ((-1, P["rag_sh"]), (1, P["rag"])):
        foot = FCX + side * stride
        knee = (FCX + foot) / 2
        g = FBOT - (lift if side == 1 else 0)
        c.taper(FCX + side * 4, FHIP, knee, (FHIP + g) / 2, 10, 8, sh)
        c.taper(knee, (FHIP + g) / 2, foot, g - 3, 8, 6, sh)
        c.rect(int(foot) - 5, int(g) - 3, int(foot) + 5, int(g), P["iron_sh"])


def flamer_body(c, lean=0):
    # The tank. Its whole reason for existing is that the silhouette has a lump
    # on the back — you should know what this thing is from behind.
    c.rect(FCX - 16 + lean, FSHO - 12, FCX - 4 + lean, FSHO + 18, P["iron"])
    c.rect(FCX - 16 + lean, FSHO - 12, FCX - 12 + lean, FSHO + 18, P["iron_hi"])
    c.disc(FCX - 10 + lean, FSHO - 12, 6, P["iron_sh"])
    c.rect(FCX - 14 + lean, FSHO + 2, FCX - 6 + lean, FSHO + 5, P["brass"])

    # Torso: hunched forward over the nozzle.
    c.taper(FCX - 2 + lean, FSHO - 4, FCX + 3 + lean, FHIP, 20, 16, P["rag"])
    c.taper(FCX + 2 + lean, FSHO - 6, FCX + 8 + lean, FSHO + 8, 14, 10, P["rag_hi"])

    # Hood and mask. No face — a lens and a filter, like the player's, because
    # everything down here is wearing one and this one has stopped caring.
    c.disc(FCX + 5 + lean, FSHO - 14, 9, P["rag_sh"])
    c.disc(FCX + 8 + lean, FSHO - 13, 5, P["iron_sh"])
    c.set(FCX + 10 + lean, FSHO - 14, P["glass"])
    c.set(FCX + 11 + lean, FSHO - 14, P["glass"])
    c.taper(FCX + 9 + lean, FSHO - 9, FCX + 13 + lean, FSHO - 6, 5, 3, P["brass_sh"])

    # The hose, tank to hands, sagging.
    c.taper(FCX - 6 + lean, FSHO + 4, FCX + 6 + lean, FSHO + 16, 4, 4, P["coal"])
    c.taper(FCX + 6 + lean, FSHO + 16, FCX + 16 + lean, FSHO + 8, 4, 4, P["coal"])


def flamer_nozzle(c, lean=0, flame=0):
    """Arms out, both hands on it. `flame` 0 = pilot light only."""
    x0, y0 = FCX + 4 + lean, FSHO + 4
    x1, y1 = FCX + 18 + lean, FSHO + 2
    c.taper(x0, y0, x1, y1, 9, 6, P["rag_hi"])
    c.rect(int(x1) - 2, int(y1) - 4, int(x1) + 8, int(y1) + 3, P["iron"])
    c.rect(int(x1) + 6, int(y1) - 3, int(x1) + 11, int(y1) + 2, P["brass_hi"])
    if flame == 0:
        # The pilot light. Always lit, which is the tell that it is loaded.
        c.set(int(x1) + 12, int(y1) - 1, P["flame"])
        c.set(int(x1) + 12, int(y1) - 2, P["flame_hi"])
    else:
        # Only the flare at the muzzle. The jet itself is a hundred and fifty
        # world units long — six times the width of this canvas — so the
        # renderer draws it, and the sprite only has to agree about where it
        # starts.
        for k in range(flame * 4):
            spread = k // 3
            c.rect(
                int(x1) + 11 + k,
                int(y1) - 2 - spread,
                int(x1) + 12 + k,
                int(y1) + 1 + spread,
                P["flame_hi"] if k < 3 else (P["flame"] if k < 8 else P["ember"]),
            )


def flamer_idle(n):
    c = fcanvas()
    flamer_legs(c, 6, 0)
    flamer_body(c, lean=n)
    flamer_nozzle(c, lean=n)
    c.mottle(P["rag"], P["ash_sh"], 0.12, seed=11)
    return c


def flamer_walk(n):
    stride = (6, 11, 13, 6, 11, 13)[n]
    lift = (0, 2, 0, 0, 2, 0)[n]
    c = fcanvas()
    flamer_legs(c, stride, lift)
    flamer_body(c, lean=1 if n % 3 == 1 else 0)
    flamer_nozzle(c, lean=1 if n % 3 == 1 else 0)
    return c


def flamer_wind(n):
    """The short wind-up. It plants and the pilot light flares."""
    c = fcanvas()
    flamer_legs(c, 9, 0)
    flamer_body(c, lean=-1 - n)
    flamer_nozzle(c, lean=-1 - n)
    c.disc(FCX + 32, FSHO + 1, 2 + n, P["flame"])
    return c


def flamer_burn(n):
    c = fcanvas()
    # Braced against the recoil: back leg out, weight down.
    flamer_legs(c, 13, 0)
    flamer_body(c, lean=1)
    flamer_nozzle(c, lean=1, flame=1 + (n % 2))
    return c


def flamer_stagger():
    c = fcanvas()
    flamer_legs(c, 4, 0)
    flamer_body(c, lean=-3)
    flamer_nozzle(c, lean=-3)
    c.mottle(P["rag"], P["coal_sh"], 0.4, seed=5)
    return c


def main():
    sets = [
        ("phoenix-hover", [phoenix_hover(b) for b in (-1, 0, 1, 0)], PW, PH_),
        ("phoenix-charge", [phoenix_charge(n) for n in range(2)], PW, PH_),
        ("phoenix-throw", [phoenix_throw(n) for n in range(2)], PW, PH_),
        ("phoenix-stagger", [phoenix_stagger()], PW, PH_),
        ("flamer-idle", [flamer_idle(n) for n in range(2)], FW, FH),
        ("flamer-walk", [flamer_walk(n) for n in range(6)], FW, FH),
        ("flamer-wind", [flamer_wind(n) for n in range(2)], FW, FH),
        ("flamer-burn", [flamer_burn(n) for n in range(4)], FW, FH),
        ("flamer-stagger", [flamer_stagger()], FW, FH),
    ]
    # `shade` and `outline` are the two passes that turn flat fills into pixel
    # art; `image` is what the strip writer wants. The canvases are kept until
    # both passes have run, because outlining reads the shaded pixels.
    done = []
    for name, frames, w, h in sets:
        images = []
        for f in frames:
            f.shade()
            f.outline()
            images.append(f.image())
        save_strip(images, OUT / f"{name}.png", w, h)
        done.append((name, images, w, h))

    here = Path(__file__).resolve().parent
    save_preview(
        [f for name, imgs, w, _ in done if w == PW for f in imgs],
        here / "_preview-phoenix.png",
        PW,
        PH_,
    )
    save_preview(
        [f for name, imgs, w, _ in done if w == FW for f in imgs],
        here / "_preview-flamer.png",
        FW,
        FH,
    )


if __name__ == "__main__":
    main()
