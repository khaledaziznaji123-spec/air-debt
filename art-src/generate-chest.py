"""
The chest, from the supplied reference.

    py art-src/generate-chest.py

Three frames: closed, open and empty, open and paying out. The renderer uses
the third for the moment the lid comes up and settles to the second, because
the payout is the one instant in a run that is purely good and it should not be
a state you stand next to afterwards.

Design, read off the reference art: a warm orange-wood body in vertical staves,
banded and rimmed in pale stone, with a stone lock plate and a dark keyhole. The
lid is a shallow arc rather than a box lid — that curve is most of why the
reference reads as a chest at a glance and not as a crate.

Two things this deliberately does NOT copy. The reference is drawn with a heavy
black keyline; every other sprite in this game outlines in its own region's
darkest tone, and a black-keyed chest would sit on top of the scene rather than
in it. And the reference's payout is a warm yellow starburst, which here is
drawn by the renderer in particles instead, so it can throw light on the rock
around it.
"""
from pathlib import Path
from PIL import Image

W, H = 48, 40
FRAMES = 3
OUT = Path(__file__).resolve().parent.parent / "public" / "art"
OUT.mkdir(parents=True, exist_ok=True)


def rgb(h):
    return ((h >> 16) & 255, (h >> 8) & 255, h & 255, 255)


P = {
    # wood — the warm orange of the reference
    "wood_hi": rgb(0xE08A4A), "wood": rgb(0xC26A31), "wood_sh": rgb(0x92471F),
    "wood_dk": rgb(0x5E2C12),
    # stone banding and the lock plate
    "band_hi": rgb(0xE8DCC6), "band": rgb(0xCBBB9E), "band_sh": rgb(0x9E8C72),
    "band_dk": rgb(0x6B5B45),
    # the inside of an open chest, and the keyhole
    "void": rgb(0x2A1608), "void_hi": rgb(0x452714),
    "gold": rgb(0xFFD479), "gold_hi": rgb(0xFFF3C4),
}

OUTLINE_OF = {
    P["wood_hi"]: P["wood_dk"], P["wood"]: P["wood_dk"], P["wood_sh"]: P["wood_dk"],
    P["band_hi"]: P["band_dk"], P["band"]: P["band_dk"], P["band_sh"]: P["band_dk"],
    P["void"]: P["void"], P["void_hi"]: P["void"],
    P["gold"]: P["wood_dk"], P["gold_hi"]: P["wood_dk"],
}


class Canvas:
    def __init__(self, w=W, h=H):
        self.w, self.h = w, h
        self.px = [[None] * w for _ in range(h)]

    def set(self, x, y, col):
        x, y = int(round(x)), int(round(y))
        if 0 <= x < self.w and 0 <= y < self.h:
            self.px[y][x] = col

    def get(self, x, y):
        x, y = int(x), int(y)
        return self.px[y][x] if 0 <= x < self.w and 0 <= y < self.h else None

    def rect(self, x0, y0, x1, y1, col):
        for y in range(int(round(y0)), int(round(y1)) + 1):
            for x in range(int(round(x0)), int(round(x1)) + 1):
                self.set(x, y, col)

    def outline(self):
        """Edge in each region's own darkest tone, matching every other sprite."""
        add = {}
        for y in range(self.h):
            for x in range(self.w):
                if self.px[y][x] is not None:
                    continue
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    n = self.get(x + dx, y + dy)
                    if n is not None:
                        add[(x, y)] = OUTLINE_OF.get(n, P["wood_dk"])
                        break
        for (x, y), c in add.items():
            self.set(x, y, c)

    def image(self):
        img = Image.new("RGBA", (self.w, self.h), (0, 0, 0, 0))
        for y in range(self.h):
            for x in range(self.w):
                if self.px[y][x]:
                    img.putpixel((x, y), self.px[y][x])
        return img


# Body geometry. The chest sits on the floor at the bottom of the canvas.
LEFT, RIGHT = 7, 40
BASE = H - 2
BODY_TOP = 20


def draw_body(c):
    """The tub: staves, two bands, and a rim along the top edge."""
    c.rect(LEFT, BODY_TOP, RIGHT, BASE, P["wood"])

    # Vertical staves, lit from the upper left like everything else.
    for x in range(LEFT, RIGHT + 1, 6):
        c.rect(x, BODY_TOP + 1, x, BASE - 1, P["wood_hi"])
        c.rect(x + 1, BODY_TOP + 1, x + 1, BASE - 1, P["wood_sh"])

    # Stone banding down each side and along the foot.
    for bx in (LEFT + 1, RIGHT - 4):
        c.rect(bx, BODY_TOP, bx + 3, BASE, P["band"])
        c.rect(bx, BODY_TOP, bx, BASE, P["band_hi"])
        c.rect(bx + 3, BODY_TOP, bx + 3, BASE, P["band_sh"])
    c.rect(LEFT, BASE - 3, RIGHT, BASE, P["band"])
    c.rect(LEFT, BASE - 3, RIGHT, BASE - 3, P["band_hi"])
    c.rect(LEFT, BASE, RIGHT, BASE, P["band_sh"])


def lid_arc(c, top, col_face, col_lit, col_shade):
    """A shallow arc, which is what makes it a chest rather than a crate.

    Drawn as three stepped rows rather than a curve: at this size a true curve is
    two pixels of anti-aliasing pretending to be geometry.
    """
    c.rect(LEFT + 3, top + 4, RIGHT - 3, top + 8, col_face)
    c.rect(LEFT + 1, top + 6, RIGHT - 1, top + 8, col_face)
    c.rect(LEFT + 6, top + 2, RIGHT - 6, top + 5, col_face)
    c.rect(LEFT + 10, top, RIGHT - 10, top + 3, col_face)
    # Lit along the top of the arc, shaded under its lip.
    c.rect(LEFT + 10, top, RIGHT - 10, top, col_lit)
    c.rect(LEFT + 6, top + 2, LEFT + 9, top + 2, col_lit)
    c.rect(RIGHT - 9, top + 2, RIGHT - 6, top + 2, col_lit)
    c.rect(LEFT + 1, top + 8, RIGHT - 1, top + 8, col_shade)


def draw_lid_closed(c):
    lid_arc(c, BODY_TOP - 10, P["wood"], P["wood_hi"], P["wood_sh"])
    # Stone rim and the two side bands carried up over the lid.
    c.rect(LEFT + 1, BODY_TOP - 3, RIGHT - 1, BODY_TOP - 1, P["band"])
    c.rect(LEFT + 1, BODY_TOP - 3, RIGHT - 1, BODY_TOP - 3, P["band_hi"])
    for bx in (LEFT + 1, RIGHT - 4):
        c.rect(bx, BODY_TOP - 8, bx + 3, BODY_TOP - 1, P["band"])
        c.rect(bx, BODY_TOP - 8, bx, BODY_TOP - 1, P["band_hi"])


def draw_lock(c, y):
    """The plate and keyhole. Centred, and the brightest thing on the sprite."""
    cx = (LEFT + RIGHT) // 2
    c.rect(cx - 4, y, cx + 4, y + 9, P["band"])
    c.rect(cx - 4, y, cx + 4, y, P["band_hi"])
    c.rect(cx - 4, y + 9, cx + 4, y + 9, P["band_sh"])
    c.rect(cx - 1, y + 3, cx + 1, y + 5, P["void"])
    c.rect(cx, y + 5, cx, y + 7, P["void"])


def closed():
    c = Canvas()
    draw_body(c)
    draw_lid_closed(c)
    draw_lock(c, BODY_TOP - 4)
    c.outline()
    return c.image()


def open_chest(paying):
    c = Canvas()
    draw_body(c)

    # The inside, visible now the lid is off it.
    c.rect(LEFT + 5, BODY_TOP, RIGHT - 5, BODY_TOP + 7, P["void"])
    c.rect(LEFT + 5, BODY_TOP, RIGHT - 5, BODY_TOP, P["void_hi"])

    if paying:
        # A heap of gems catching the light. Deliberately small: the burst that
        # sells the moment is drawn by the renderer, in particles, over the top.
        for x, w in ((LEFT + 9, 5), (LEFT + 17, 7), (LEFT + 27, 4)):
            c.rect(x, BODY_TOP + 1, x + w, BODY_TOP + 5, P["gold"])
            c.rect(x, BODY_TOP + 1, x + w, BODY_TOP + 1, P["gold_hi"])

    # The lid, hinged back and tilted away behind the tub. It has to TOUCH the
    # rim: floated clear of it, the two read as two objects rather than as one
    # chest that is open.
    lid_arc(c, 8, P["wood_sh"], P["wood"], P["wood_dk"])
    c.rect(LEFT + 1, 16, RIGHT - 1, 18, P["band_sh"])
    c.rect(LEFT + 1, 16, RIGHT - 1, 16, P["band"])
    # The hinge, closing the seam on both sides.
    for hx in (LEFT + 2, RIGHT - 5):
        c.rect(hx, 17, hx + 3, BODY_TOP, P["band_sh"])
    draw_lock(c, 10)
    c.outline()
    return c.image()


frames = [closed(), open_chest(False), open_chest(True)]
sheet = Image.new("RGBA", (W * FRAMES, H), (0, 0, 0, 0))
for i, f in enumerate(frames):
    sheet.paste(f, (i * W, 0))
sheet.save(OUT / "prop-chest.png")
print(f"prop-chest.png: {FRAMES} frames -> {sheet.width}x{sheet.height}")

s = 6
preview = Image.new("RGBA", (W * FRAMES * s, H * s), (0x1C, 0x14, 0x28, 255))
preview.alpha_composite(sheet.resize((W * FRAMES * s, H * s), Image.NEAREST))
preview.save(Path(__file__).resolve().parent / "_preview-chest.png")
print("preview -> art-src/_preview-chest.png")
