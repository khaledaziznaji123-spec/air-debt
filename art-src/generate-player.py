"""
The player character — original design, generated pixel by pixel.

    py art-src/generate-player.py

Design: a scavenger sealed into a rebreather rig. Full-face mask with twin
filter canisters and lit lenses, hooded coat with a torn hem, air tank and hose,
strapped gloves and boots, short sword. Nothing about the silhouette is generic
fantasy — it says "breathing borrowed air" before it says anything else, which
is the game's whole premise.

Technique notes, because they are what separates this from coloured boxes:

* Every surface carries three tones — base, shadow, highlight — lit from the
  upper left. Flat fills are what make procedural art look procedural.
* The outline is derived from each region's own colour rather than a uniform
  black. Selective outlining reads as drawn; a black keyline reads as clip art.
* Limbs taper. A constant-width line is instantly legible as a machine's work.
* Details are placed at odd offsets and never mirrored, because symmetry is the
  other giveaway.

Output: idle (4), walk (8), attack A (6), attack B (6), block (2), hurt (1).
"""
import math
from pathlib import Path
from PIL import Image

W, H = 48, 96
OUT = Path(__file__).resolve().parent.parent / "public" / "art"
OUT.mkdir(parents=True, exist_ok=True)


def rgb(h):
    return ((h >> 16) & 255, (h >> 8) & 255, h & 255, 255)


# Palette: five families, three-plus tones each.
P = {
    # coat — desaturated slate with a green cast
    "coat_lit": rgb(0x5E7079),
    "coat_hi": rgb(0x4A5A63), "coat": rgb(0x36444C), "coat_sh": rgb(0x252F36), "coat_dk": rgb(0x182026),
    # leather — straps, belt, boots, gloves
    "lea_hi": rgb(0x8A5A34), "lea": rgb(0x66401F), "lea_sh": rgb(0x452A14), "lea_dk": rgb(0x2C1A0D),
    # metal — tank, buckles, blade
    "met_hi": rgb(0xD8E2EC), "met": rgb(0x9BA7B4), "met_sh": rgb(0x6A7581), "met_dk": rgb(0x424B55),
    # rubber — mask body, hose
    "rub_hi": rgb(0x3B3F47), "rub": rgb(0x2A2E34), "rub_sh": rgb(0x1B1E23),
    # lens — the oxygen glow, the brightest thing on the sprite
    "lens_hi": rgb(0xCFFFF8), "lens": rgb(0x5FD9CF), "lens_sh": rgb(0x2E8C87),
    # trousers — darker and warmer than the coat, so legs never merge into it
    "trs_hi": rgb(0x3A3A3E), "trs": rgb(0x2A2A2E), "trs_sh": rgb(0x1C1C20), "trs_dk": rgb(0x121215),
    # accent — brass
    "brass": rgb(0xC89A3E), "brass_sh": rgb(0x8A6722),
}

# ---------------------------------------------------------------- skins
#
# A skin is a full alternate sprite family, not a tint over this one.
#
# The first attempt at cosmetics was six multiply-tints, on the grounds that
# recolouring sixteen animations five ways is four hundred frames to regenerate.
# It was cheap and it looked exactly that cheap — the same man, slightly the
# wrong colour, which is not a thing anybody would pay for.
#
# So the generator takes a palette AND a silhouette. The silhouette is what
# earns the money: at 48 pixels the outline is the only part anyone reads, so
# every style has to change it rather than just recolour inside it.
#
#   scav      the default. Rebreather, hood, short sword.
#   knight    pauldrons, crested helm, greatsword.
#   void      tall ragged hood, trailing hem, a needle of a blade. Thin where
#             the knight is wide, which is the whole point of having both.
#   bulk      enormous. Horned helm sunk between slab pauldrons, a cleaver
#             rather than a sword, boots you could stand a table on.
STYLE = {"kind": "scav"}


def heavy():
    return STYLE["kind"] in ("knight", "bulk")

SKINS = {
    "player": {"prefix": "player", "kind": "scav", "palette": {}},
    "knight-crimson": {
        "prefix": "knight-crimson",
        "kind": "knight",
        "palette": {
            "coat_lit": rgb(0xC0475A), "coat_hi": rgb(0x94303F),
            "coat": rgb(0x6B1F2B), "coat_sh": rgb(0x46131C),
            "coat_dk": rgb(0x220910),
            "met_hi": rgb(0xE8D9C0), "met": rgb(0xA8967C),
            "met_sh": rgb(0x6E6250), "met_dk": rgb(0x3A342A),
            "trs_hi": rgb(0x3E3236), "trs": rgb(0x2B2226),
            "trs_sh": rgb(0x1B1518), "trs_dk": rgb(0x0F0B0D),
            "lens_hi": rgb(0xFFD9A8), "lens": rgb(0xE8873C),
            "lens_sh": rgb(0x8C4712),
        },
    },
    "void-shroud": {
        "prefix": "void-shroud",
        "kind": "void",
        "palette": {
            "coat_lit": rgb(0x5A4A82), "coat_hi": rgb(0x3E3260),
            "coat": rgb(0x2A2145), "coat_sh": rgb(0x1A1430),
            "coat_dk": rgb(0x0C0819),
            "met_hi": rgb(0xC9B6F0), "met": rgb(0x8A76B8),
            "met_sh": rgb(0x584A7A), "met_dk": rgb(0x2E2646),
            "trs_hi": rgb(0x2C2440), "trs": rgb(0x1E1830),
            "trs_sh": rgb(0x140F20), "trs_dk": rgb(0x0A0714),
            "lens_hi": rgb(0xF0D8FF), "lens": rgb(0xB56AF0),
            "lens_sh": rgb(0x602C90),
            "lea_hi": rgb(0x4A3A6A), "lea": rgb(0x322650),
            "lea_sh": rgb(0x1F1734), "lea_dk": rgb(0x110C1E),
            "brass": rgb(0x8A6ACC), "brass_sh": rgb(0x503A80),
        },
    },
    "deep-leviathan": {
        "prefix": "deep-leviathan",
        "kind": "bulk",
        "palette": {
            "coat_lit": rgb(0x3E6FA8), "coat_hi": rgb(0x2B5280),
            "coat": rgb(0x1B3557), "coat_sh": rgb(0x102037),
            "coat_dk": rgb(0x070D18),
            "met_hi": rgb(0x9FC4E8), "met": rgb(0x5E7FA8),
            "met_sh": rgb(0x3A5271), "met_dk": rgb(0x1D2C3E),
            # Lifted off black. The old values sat two shades above the
            # background, so the legs disappeared into the floor and the
            # silhouette ended at the belt.
            "trs_hi": rgb(0x424A5C), "trs": rgb(0x2C3342),
            "trs_sh": rgb(0x1B202B), "trs_dk": rgb(0x0D1016),
            "lens_hi": rgb(0xD8F4FF), "lens": rgb(0x4FC7F0),
            "lens_sh": rgb(0x1E6A8C),
            "lea_hi": rgb(0x2E3A4A), "lea": rgb(0x1C2531),
            "lea_sh": rgb(0x11161E), "lea_dk": rgb(0x080B0F),
            "brass": rgb(0x6FA8D8), "brass_sh": rgb(0x35607F),
        },
    },
    "knight-pale": {
        "prefix": "knight-pale",
        "kind": "knight",
        "palette": {
            "coat_lit": rgb(0xF2ECDC), "coat_hi": rgb(0xD6CDB8),
            "coat": rgb(0xB0A692), "coat_sh": rgb(0x7C7364),
            "coat_dk": rgb(0x494237),
            "met_hi": rgb(0xF4F8FF), "met": rgb(0xC2CBD6),
            "met_sh": rgb(0x8992A0), "met_dk": rgb(0x4E5560),
            "trs_hi": rgb(0x5A5B60), "trs": rgb(0x424348),
            "trs_sh": rgb(0x2C2D31), "trs_dk": rgb(0x191A1D),
            "lens_hi": rgb(0xEAFBFF), "lens": rgb(0x8FD4E8),
            "lens_sh": rgb(0x3F7C90),
        },
    },
    # The Revenant, and the skin you take off it.
    #
    # It is the ORDINARY player, drawn dead: the same scavenger silhouette, the
    # same tank, the same blade — because the whole idea is that the thing at
    # the bottom is somebody who came down here with exactly your kit. Nothing
    # about the shape says boss. What says boss is that you already know every
    # animation it has, and it is using them on you.
    #
    # Drained rather than recoloured. The coat has gone grey-green and damp, the
    # brass has gone to verdigris, and the lamp in the mask burns cold — the one
    # bright thing on it, and the only way to read which way it is facing in a
    # dark room.
    "revenant": {
        "prefix": "revenant",
        "kind": "scav",
        "palette": {
            "coat_lit": rgb(0x6E7A6E), "coat_hi": rgb(0x515C52),
            "coat": rgb(0x39423B), "coat_sh": rgb(0x252B26),
            "coat_dk": rgb(0x141814),
            "met_hi": rgb(0x8A9A8E), "met": rgb(0x5F6C63),
            "met_sh": rgb(0x3C463F), "met_dk": rgb(0x212722),
            "trs_hi": rgb(0x3A3E3C), "trs": rgb(0x2A2D2B),
            "trs_sh": rgb(0x1B1D1C), "trs_dk": rgb(0x0E0F0E),
            "lea_hi": rgb(0x4E4438), "lea": rgb(0x372F26),
            "lea_sh": rgb(0x231D17), "lea_dk": rgb(0x120F0B),
            "brass_hi": rgb(0x7FD9C0), "brass": rgb(0x4E9B88),
            "brass_sh": rgb(0x2C5A4E),
            "lens_hi": rgb(0xDFFFF6), "lens": rgb(0x6FE8C8),
            "lens_sh": rgb(0x2E7A66),
        },
    },
}

SHADE = {  # base -> (highlight, shadow) for automatic lighting
    P["coat"]: (P["coat_hi"], P["coat_sh"]),
    # The sword arm sits a tone above the coat it crosses, so a limb in front of
    # the chest is a limb rather than a bulge in the chest.
    P["coat_hi"]: (P["coat_lit"], P["coat"]),
    P["lea"]: (P["lea_hi"], P["lea_sh"]),
    P["met"]: (P["met_hi"], P["met_sh"]),
    P["rub"]: (P["rub_hi"], P["rub_sh"]),
    P["lens"]: (P["lens_hi"], P["lens_sh"]),
    P["trs"]: (P["trs_hi"], P["trs_sh"]),
}

# Outline colour per family, so edges stay in-family rather than going black.
OUTLINE_OF = {
    P["coat_lit"]: P["coat_dk"],
    P["coat_hi"]: P["coat_dk"], P["coat"]: P["coat_dk"], P["coat_sh"]: P["coat_dk"],
    P["lea_hi"]: P["lea_dk"], P["lea"]: P["lea_dk"], P["lea_sh"]: P["lea_dk"],
    P["met_hi"]: P["met_dk"], P["met"]: P["met_dk"], P["met_sh"]: P["met_dk"],
    P["rub_hi"]: P["rub_sh"], P["rub"]: P["rub_sh"], P["rub_sh"]: P["rub_sh"],
    P["lens_hi"]: P["lens_sh"], P["lens"]: P["lens_sh"],
    P["trs_hi"]: P["trs_dk"], P["trs"]: P["trs_dk"], P["trs_sh"]: P["trs_dk"],
    P["brass"]: P["brass_sh"],
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

    def disc(self, cx, cy, r, col):
        for y in range(int(cy - r), int(cy + r) + 1):
            for x in range(int(cx - r), int(cx + r) + 1):
                if (x - cx) ** 2 + (y - cy) ** 2 <= r * r:
                    self.set(x, y, col)

    def taper(self, x0, y0, x1, y1, w0, w1, col):
        """A limb: thickness eases from w0 to w1 along its length."""
        steps = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 1
        for i in range(steps):
            t = i / max(steps - 1, 1)
            x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
            r = (w0 + (w1 - w0) * t) / 2
            for dy in range(int(-r - 1), int(r + 2)):
                for dx in range(int(-r - 1), int(r + 2)):
                    if dx * dx + dy * dy <= r * r:
                        self.set(x + dx, y + dy, col)

    def shade(self):
        """Light from the upper left: highlight lit edges, shadow the rest."""
        out = [row[:] for row in self.px]
        for y in range(self.h):
            for x in range(self.w):
                c = self.px[y][x]
                if c not in SHADE:
                    continue
                hi, sh = SHADE[c]
                if self.get(x - 1, y) is None or self.get(x, y - 1) is None:
                    out[y][x] = hi
                elif self.get(x + 1, y) is None or self.get(x, y + 1) is None:
                    out[y][x] = sh
        self.px = out

    def outline(self):
        """Edge in each region's own darkest tone rather than a flat black."""
        add = {}
        for y in range(self.h):
            for x in range(self.w):
                if self.px[y][x] is not None:
                    continue
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    n = self.get(x + dx, y + dy)
                    if n is not None:
                        add[(x, y)] = OUTLINE_OF.get(n, P["coat_dk"])
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


# Anatomy for a 96px canvas.
CX = 23
GROUND = 92
HIP = 56
SHOULDER = 33
HEAD = 17


def draw_boot(c, x, y):
    c.rect(x - 3, y - 5, x + 3, y - 1, P["lea"])
    c.rect(x - 4, y - 1, x + 4, y + 1, P["lea_sh"])
    c.rect(x - 3, y - 6, x + 2, y - 6, P["lea_hi"])
    c.rect(x - 3, y - 4, x + 2, y - 4, P["brass"])  # buckle strap


def draw_leg(c, hip_x, foot_x, foot_y, back=False, hip_y=None, knee_out=0):
    hip_y = HIP if hip_y is None else hip_y
    col = P["trs_sh"] if back else P["trs"]
    knee_x = (hip_x + foot_x) / 2 + (2 if not back else 1) + knee_out
    knee_y = (hip_y + foot_y) / 2

    if STYLE["kind"] == "bulk":
        # The leviathan gets legs to match the rest of it.
        #
        # It had the ordinary seven-pixel limb under a thirty-four-pixel chest,
        # in a trouser colour two shades off black — so at size the legs did not
        # read as trousers, or as armour, or as anything. They read as bare
        # shins under a barrel, which is exactly what it looked like.
        #
        # Same skeleton, same joints, same frame count: only the thickness and
        # the plating change, so every pose the other skins have still lines up.
        thigh = P["lea_hi"] if not back else P["lea"]
        c.taper(hip_x, hip_y, knee_x, knee_y, 11, 9, thigh)
        c.taper(knee_x, knee_y, foot_x, foot_y - 5, 9, 6, col)
        # A tasset over the hip and a greave down the shin, both in the metal
        # the rest of the suit is made of, so the leg belongs to the body.
        # A shade back from the chest plates. Matched exactly, the figure came
        # out one flat colour from gorget to boot and the legs stopped being
        # legs again — separation of tone is what tells the eye where the body
        # ends and the limbs start.
        plate = P["met_dk"] if back else P["met_sh"]
        c.taper(hip_x, hip_y - 1, (hip_x + knee_x) / 2, (hip_y + knee_y) / 2, 12, 9, plate)
        c.taper(knee_x, knee_y + 1, foot_x, foot_y - 6, 8, 6, plate)
        if not back:
            # One lit edge down the front of the greave. Without it the plate is
            # a flat shape and the leg loses its round.
            c.taper(knee_x - 2, knee_y + 2, foot_x - 2, foot_y - 7, 3, 2, P["met"])
        # A knee cop, which is the thing that makes a jointed leg look jointed.
        c.disc(knee_x, knee_y, 5, plate)
        c.disc(knee_x - 1, knee_y - 1, 2.4, P["met"] if not back else P["met_sh"])
        draw_boot(c, foot_x, foot_y)
        return

    c.taper(hip_x, hip_y, knee_x, knee_y, 7, 6, col)
    c.taper(knee_x, knee_y, foot_x, foot_y - 5, 6, 4, col)
    draw_boot(c, foot_x, foot_y)


# Upper arm and forearm, in pixels. Roughly equal, as a real arm is, so the
# elbow lands near the midpoint when the arm is straight and swings wide of it
# when the arm folds.
UPPER, FORE = 10.0, 9.5


def elbow_at(sx, sy, hx, hy, bend=1):
    """Where the elbow has to be, given a shoulder and a hand.

    The arm used to put its elbow at the midpoint of shoulder-to-hand, which
    means it was not an elbow at all — it was a straight line with a kink drawn
    on it, and the whole limb read as a rigid stick that happened to end where
    the sword started. During a swing that is exactly what you notice: the blade
    sweeps 200 degrees and the arm holding it barely changes shape.

    So the joint is solved properly. Two circles — one of radius UPPER around
    the shoulder, one of radius FORE around the hand — and the elbow is where
    they cross. `bend` picks which of the two crossings, i.e. which way the
    joint folds.
    """
    dx, dy = hx - sx, hy - sy
    d = math.hypot(dx, dy)
    if d < 0.001:
        return sx, sy + UPPER
    ux, uy = dx / d, dy / d
    # Beyond full reach there is no crossing; the arm is simply straight, and
    # clamping the distance puts the elbow on the line where it belongs. The
    # HAND is never moved to suit the arm — it is holding the sword.
    d = min(d, UPPER + FORE - 0.4)
    a = (UPPER * UPPER - FORE * FORE + d * d) / (2 * d)
    h = math.sqrt(max(UPPER * UPPER - a * a, 0.0))
    mx, my = sx + ux * a, sy + uy * a
    return mx - uy * h * bend, my + ux * h * bend


def draw_arm(c, sh_x, hand_x, hand_y, back=False, bend=1, sh_dy=0):
    col = P["coat_sh"] if back else P["coat_hi"]
    sh_y = SHOULDER + 2 + sh_dy
    ex, ey = elbow_at(sh_x, sh_y, hand_x, hand_y, bend)
    if not back:
        # A keyline all the way round the sword arm. `outline()` only draws
        # against empty space, so an arm crossing the chest was the same colour
        # as the coat behind it and simply disappeared — leaving a sword
        # apparently floating in front of the ribs with nothing holding it.
        c.taper(sh_x, sh_y, ex, ey, 8, 6.5, P["coat_dk"])
        c.taper(ex, ey, hand_x, hand_y, 6.5, 5.5, P["coat_dk"])
    c.taper(sh_x, sh_y, ex, ey, 7, 5, col)
    c.taper(ex, ey, hand_x, hand_y, 5, 4, col)
    c.disc(hand_x, hand_y, 2.4, P["lea"])          # glove
    c.set(hand_x - 1, hand_y - 1, P["lea_hi"])


def draw_sword(c, hx, hy, ang, length=20):
    # A greatsword on the heavy skins: a quarter longer, half again as wide, and
    # a guard that spans the fist. It is the single biggest change to the
    # outline, which is why it is worth the six pixels.
    kind = STYLE["kind"]
    big = heavy()
    if kind == "bulk":
        # A cleaver: shorter than the knight's greatsword and twice as wide, so
        # the two heavy styles do not share a silhouette either.
        length = length * 1.1
    elif kind == "knight":
        length = length * 1.25
    elif kind == "void":
        # A needle. Longer than the sword and barely there, which is what makes
        # the wraith read as fast rather than strong.
        length = length * 1.35
    a = math.radians(ang)
    dx, dy = math.cos(a), math.sin(a)
    gx, gy = hx + dx * 3, hy + dy * 3
    tx, ty = hx + dx * length, hy + dy * length
    guard = 7 if kind == "bulk" else 6 if big else 3 if kind == "void" else 4
    blade = 11 if kind == "bulk" else 8 if big else 3 if kind == "void" else 5
    c.taper(hx - dx * 4, hy - dy * 4, gx, gy, 4 if big else 3, 3, P["lea_sh"])
    c.taper(gx - dy * guard, gy + dx * guard, gx + dy * guard, gy - dx * guard,
            4 if big else 3, 3, P["brass"])
    c.taper(gx, gy, tx, ty, blade, 2, P["met"])
    c.taper(gx + dy, gy - dx, tx, ty, 3 if big else 2, 1, P["met_hi"])
    if big:
        # A dark fuller down the middle, so the wider blade does not read as a
        # plank. A flat slab of one tone is what makes a big sword look cheap.
        c.taper(gx + dx * 4, gy + dy * 4, tx - dx * 3, ty - dy * 3, 2, 1, P["met_sh"])


def draw_torso(c, lean=0, bob=0, squat=0, cx=None):
    x, y = (CX if cx is None else cx) + lean, bob

    # air tank, worn high on the back
    c.rect(x - 12, SHOULDER + y - 1, x - 8, HIP + y - 8, P["met_sh"])
    c.rect(x - 12, SHOULDER + y - 1, x - 11, HIP + y - 8, P["met"])
    c.rect(x - 12, SHOULDER + y + 4, x - 8, SHOULDER + y + 5, P["brass_sh"])
    c.rect(x - 12, SHOULDER + y + 12, x - 8, SHOULDER + y + 13, P["brass_sh"])

    # coat body, flaring to a torn hem
    c.taper(x, SHOULDER + y, x, HIP + y - 2, 16, 14, P["coat"])
    for i, dx in enumerate((-9, -6, -2, 2, 6, 9)):
        # Hem rides up when crouching, so the bent legs stay visible.
        depth = max(1, (3, 5, 2, 6, 3, 4)[i] - squat // 3)
        c.rect(x + dx - 1, HIP + y - 2, x + dx + 1, HIP + y - 2 + depth, P["coat_sh"])

    # chest strap and belt
    c.taper(x - 8, HIP + y - 9, x + 8, SHOULDER + y + 3, 4, 4, P["lea"])
    c.rect(x - 9, HIP + y - 8, x + 9, HIP + y - 4, P["lea_sh"])
    c.rect(x - 2, HIP + y - 8, x + 2, HIP + y - 4, P["brass"])
    c.rect(x - 1, HIP + y - 7, x + 1, HIP + y - 5, P["brass_sh"])

    # shoulder cape, asymmetric on purpose
    c.taper(x - 8, SHOULDER + y + 1, x + 6, SHOULDER + y - 1, 9, 6, P["coat_hi"])
    c.rect(x - 9, SHOULDER + y + 2, x + 1, SHOULDER + y + 5, P["coat_hi"])

    if STYLE["kind"] == "void":
        # A ragged hem trailing off the coat, and no hard edges anywhere. The
        # wraith is defined by what it does NOT have: no pauldrons, no plate,
        # no straight lines.
        for i, dx in enumerate((-11, -6, 0, 5, 10)):
            trail = (14, 20, 26, 18, 12)[i]
            c.taper(x + dx, HIP + y - 4, x + dx - 3 - i, HIP + y - 4 + trail,
                    5, 1, P["coat_sh"])
        c.taper(x - 7, SHOULDER + y + 2, x + 7, SHOULDER + y, 11, 8, P["coat_hi"])

    if heavy():
        # Pauldrons. Wide, layered, and one bigger than the other — a matched
        # pair reads as a machine's work, which is the note the whole art
        # pipeline is trying not to hit.
        bulk = STYLE["kind"] == "bulk"
        for side, span in ((1, 16 if bulk else 11), (-1, 14 if bulk else 9)):
            px = x + side * (13 if bulk else 10)
            c.disc(px, SHOULDER + y + 1, span * 0.62, P["met_sh"])
            c.disc(px, SHOULDER + y, span * 0.52, P["met"])
            c.disc(px - side, SHOULDER + y - 2, span * 0.3, P["met_hi"])
            c.rect(px - span // 2, SHOULDER + y + 4, px + span // 2,
                   SHOULDER + y + 6, P["met_sh"])
        # A gorget across the collar, tying the two together.
        c.rect(x - 9, SHOULDER + y - 3, x + 9, SHOULDER + y, P["met_sh"])
        c.rect(x - 9, SHOULDER + y - 3, x + 7, SHOULDER + y - 2, P["met"])
        if bulk:
            # Slab plates down the front, and a wider waist. The leviathan is
            # the widest thing the player can be, and the width has to be in the
            # BODY as well as the shoulders or it reads as a small man in big
            # armour rather than as a big man.
            # Narrower than it was, and tapered. At seventeen half-widths the
            # chest was thirty-four pixels across and the figure stopped being a
            # figure — the head vanished into it, the legs came out of the
            # bottom of a barrel, and it no longer read as the same character
            # wearing something. Twelve is still the widest silhouette in the
            # game and still reads as heavy.
            chest = (SHOULDER + HIP) // 2
            for i, ry in enumerate((chest - 8, chest, chest + 8)):
                half = 12 - i
                c.rect(x - half, ry + y, x + half, ry + y + 7, P["met_sh"])
                c.rect(x - half, ry + y, x + half - 4, ry + y + 2, P["met"])
            c.rect(x - 11, HIP + y - 12, x + 11, HIP + y - 2, P["lea"])
            c.rect(x - 5, HIP + y - 14, x + 5, HIP + y, P["met"])

    # hose, tank to mask
    for t in range(9):
        f = t / 8
        hx = x - 11 + f * 8
        hy = SHOULDER + y - 1 - f * 9 + math.sin(f * 3.1) * 2
        c.disc(hx, hy, 1.6, P["rub"])


def draw_head(c, lean=0, bob=0, lens_hot=False, cx=None):
    draw_head_at(c, (CX if cx is None else cx) + lean * 2, HEAD + bob, lens_hot)


def draw_head_at(c, x, y, lens_hot=False):
    """The masked head at an arbitrary point.

    Split out so a pose that is not standing upright can still have one — the
    slide needs the head on the front of a horizontal body, and the original
    only knew how to put it on top of a vertical one.
    """

    c.disc(x, y, 9, P["coat_sh"])       # hood
    c.disc(x + 1, y + 1, 8, P["rub"])   # mask shell
    c.rect(x - 9, y - 4, x - 5, y + 5, P["coat_sh"])
    c.rect(x - 10, y - 1, x - 9, y + 3, P["coat"])  # hood edge catching light

    # twin filter canisters, offset so the face is never symmetric
    c.disc(x + 6, y + 4, 3.4, P["met_sh"])
    c.disc(x + 6, y + 4, 2.2, P["met"])
    c.disc(x + 2, y + 7, 2.8, P["met_sh"])
    c.disc(x + 2, y + 7, 1.7, P["met"])

    # lenses
    lens = P["lens_hi"] if lens_hot else P["lens"]
    c.disc(x + 2, y - 2, 3.2, P["rub_sh"])
    c.disc(x + 2, y - 2, 2.3, lens)
    c.set(x + 1, y - 3, P["lens_hi"])
    c.disc(x - 4, y - 1, 2.6, P["rub_sh"])
    c.disc(x - 4, y - 1, 1.8, lens)

    c.rect(x - 6, y - 7, x + 5, y - 6, P["rub_hi"])  # brow strap
    c.rect(x - 7, y - 7, x - 6, y - 5, P["brass"])   # buckle

    if STYLE["kind"] == "void":
        # A tall hood with nothing inside it but two lit points. The mask is
        # still under there — the fiction is a man breathing borrowed air and a
        # skin does not get to undo the premise — it is simply not visible.
        c.disc(x - 1, y - 2, 12, P["coat_sh"])
        c.disc(x, y - 4, 10, P["coat"])
        c.rect(x - 13, y - 4, x - 4, y + 9, P["coat_sh"])
        for k in range(5):
            c.taper(x - 10 + k * 5, y + 6, x - 13 + k * 6, y + 15 + (k % 2) * 5,
                    4, 1, P["coat_sh"])
        c.disc(x + 1, y + 1, 6, P["coat_dk"])
        c.disc(x - 2, y + 1, 1.7, P["lens"])
        c.disc(x + 4, y, 1.7, P["lens"])
        c.set(x - 2, y, P["lens_hi"])

    if heavy():
        # A closed helm over the mask, with a crest. The mask stays underneath
        # rather than being replaced: the fiction is a man breathing borrowed
        # air, and a skin is not allowed to quietly undo the premise.
        c.disc(x, y - 1, 10, P["met_sh"])
        c.disc(x + 1, y - 2, 8.4, P["met"])
        c.rect(x - 10, y - 2, x + 10, y + 1, P["met_sh"])
        c.rect(x - 9, y - 2, x + 6, y - 1, P["met_hi"])
        # The visor slit, with the lens glow behind it.
        c.rect(x - 7, y + 1, x + 8, y + 4, P["coat_dk"])
        c.rect(x - 5, y + 2, x - 1, y + 3, P["lens"])
        c.rect(x + 2, y + 2, x + 6, y + 3, P["lens"])
        if STYLE["kind"] == "bulk":
            # Horns instead of a crest, sweeping out and forward. Sunk lower
            # into the shoulders too, so the head reads as small on a huge body
            # — which is the single strongest cue for "heavy" there is.
            for side in (-1, 1):
                for k in range(6):
                    f = k / 5
                    c.disc(x + side * (7 + k * 2.2), y - 5 - k * 1.6 + f * f * 5,
                           3.2 - f * 2, P["met"])
                c.disc(x + side * 17, y - 3, 1.6, P["met_hi"])
        else:
            # Crest, swept back and off-centre.
            for k in range(7):
                f = k / 6
                c.rect(x - 2 + k, y - 12 - int((1 - f) * 5), x - 1 + k,
                       y - 8 - int((1 - f) * 3), P["coat_hi"])
            c.rect(x - 3, y - 11, x - 1, y - 7, P["brass"])


def frame(front_foot, back_foot, front_hand, back_hand, sword_ang,
          lean=0, bob=0, lens_hot=False, sword=True, squat=0, airborne=False,
          front_lift=0, back_lift=0, bend=1, back_bend=1, sh_dy=0,
          sword_len=20, cx=None, width=None):
    """squat lowers the whole upper body and bends the knees outward, which is
    what makes a crouch read as a crouch rather than a shorter person.

    front_lift / back_lift raise one boot off the floor independently. Without
    them both feet stay pinned at ground level and any gait — however wide the
    legs swing — reads as skating rather than stepping.

    squat is measured from HIP, so it has to stay inside the canvas. Push it
    past the sprite and the legs get drawn from a hip below the image, which
    renders as two full-height bars rather than a body.
    """
    bx = CX if cx is None else cx
    c = Canvas(W if width is None else width, H)
    ground = GROUND - (6 if airborne else 0)
    hip_y = HIP + squat
    draw_leg(c, bx - 3, back_foot, ground - back_lift, back=True, hip_y=hip_y, knee_out=-squat // 2)
    draw_arm(c, bx - 7, back_hand[0], back_hand[1] + bob + squat, back=True,
             bend=back_bend)
    draw_torso(c, lean, bob + squat, squat, cx=bx)
    draw_head(c, lean, bob + squat, lens_hot, cx=bx)
    draw_leg(c, bx + 3, front_foot, ground - front_lift, hip_y=hip_y, knee_out=squat // 2)
    # The shoulder rides with the lean at half rate. Pinned, the arm detached
    # from a torso that was visibly turning; moving it the full amount made the
    # shoulder chase the hand and the arm never opened out.
    draw_arm(c, bx + 6 + lean // 2, front_hand[0], front_hand[1] + bob + squat,
             bend=bend, sh_dy=sh_dy)
    if sword:
        draw_sword(c, front_hand[0], front_hand[1] + bob + squat, sword_ang,
                   length=sword_len)
    c.shade()
    c.outline()
    return c.image()


def idle(n=4):
    out = []
    for i in range(n):
        b = (0, -1, 0, 0)[i]
        out.append(frame(CX + 6, CX - 6, (CX + 12, 60 + b), (CX - 11, 59), 72, bob=b))
    return out


def walk(n=12):
    """An unhurried walk: upright, short stride, one boot always on the floor.

    A foot only leaves the ground on its way FORWARD — on the way back it is
    driving against the floor. That asymmetry is the whole reason for the
    max(), and it is what stops the legs looking like a swinging pendulum.
    """
    out = []
    for i in range(n):
        p = (i / n) * math.tau
        sw = math.sin(p) * 11
        lift = max(0.0, math.sin(p)) * 6
        lift_b = max(0.0, math.sin(p + math.pi)) * 6
        out.append(frame(
            CX + sw, CX - sw,
            (CX + 11 - sw * 0.5, 60), (CX - 10 + sw * 0.5, 59),
            74, lean=1, bob=-1 if math.sin(p * 2) > 0.4 else 0,
            front_lift=lift, back_lift=lift_b,
        ))
    return out


def run(n=8):
    """A sprint, and deliberately not just a faster walk.

    What separates the two is the lean. The upper body is pitched out ahead of
    the hips so he reads as falling forward and catching himself, which is what
    running physically is — a walk keeps its weight stacked over the feet and a
    sprint never does. On top of that the stride is longer, the knees come up,
    and there is a flight phase: moments where neither boot is on the floor.
    A walk cannot have one, so it is the detail that sells the difference.
    """
    def lift(s):
        # Planted only through the bottom of the swing — under half the cycle.
        # Two legs half a cycle apart therefore leave gaps where both are up.
        return 0.0 if s < -0.3 else (s + 0.3) / 1.3 * 16

    out = []
    for i in range(n):
        p = (i / n) * math.tau
        near, far = math.sin(p), math.sin(p + math.pi)
        # Rides highest through the flight phases, lowest at each footstrike.
        bob = -1 - 3 * max(0.0, math.cos(2 * p))
        out.append(frame(
            CX + near * 15, CX + far * 15,
            # Arms drive in opposition to the legs, elbows carried high. The
            # back arm is painted in the coat's shadow tone, so it is kept on a
            # short swing — clear of the body and it reads as a floating glove
            # against a dark background rather than an arm.
            (CX + 12 - near * 11, 56), (CX - 6 - far * 6, 52),
            108,  # blade swept back and down, kept clear of the knees
            lean=7, bob=bob,
            front_lift=lift(near), back_lift=lift(far),
        ))
    return out


# Seventy-two columns for the swings, not forty-eight.
#
# At 48 the sword ran off the edge of its own frame: the horizontal cut put the
# hand at x=39 with a 20px blade pointing right, so nine pixels of it existed
# and the rest was cropped. Every swing was therefore posed to keep the blade
# inside the box, which is why the arm never opened out — the frame, not the
# anatomy, was setting how far he could reach.
#
# Eighty-eight, not seventy-two: at 72 the frame was wide enough for the blade
# but not for the ARM. Every strike pose had to keep the hand within about nine
# pixels of the shoulder to leave the sword room, so the limb was a stub buried
# inside the torso silhouette — the exact fault this was meant to fix, moved one
# step along. An arm is twenty pixels; the frame has to hold an arm AND a sword.
ATTACK_W = 88
ACX = 43  # the body sits one column left of centre, as it does at 48 wide


def swing(poses, hot):
    """Six frames of one swing.

    Each pose is (hand_x, hand_y, blade_angle, blade_length, lean, elbow_bend,
    shoulder_lift, back_hand_x, back_hand_y).

    The hand is what moves. That is the whole change: the old swings held the
    hand nearly still and rotated the blade around it, so the sword swept 200
    degrees while the arm carrying it shifted a few pixels and stayed the same
    shape — the blade looked motorised and the man looked bolted to the floor.
    Now the hand travels the arc, the elbow solves for wherever the hand went
    (see `elbow_at`), the shoulder leans into it and the trailing arm throws the
    other way as counterweight. The blade is still drawn from the hand, so it
    cannot come apart from the arm: they are the same motion.
    """
    out = []
    for i, (hx, hy, ang, ln, lean, bend, sh, bhx, bhy) in enumerate(poses):
        out.append(frame(
            ACX + 7 + lean, ACX - 8 + lean, (hx, hy), (bhx, bhy), ang,
            lean=lean, lens_hot=(i in hot), bend=bend, back_bend=-1,
            sh_dy=sh, sword_len=ln, cx=ACX, width=ATTACK_W,
        ))
    return out


def attack_a(n=6):
    """Horizontal slash: drawn back across the body, then swept flat through.

    The blade shortens through the middle of the cut and lengthens again at
    either end. That is foreshortening — a sword swung level with the floor
    points at the viewer halfway round, and drawing it full length all the way
    through is what makes a flat cut read as a windscreen wiper.
    """
    poses = [
        # hand      blade         lean bend sh  back hand
        (33, 43, 172, 19, -3, -1, 0, ACX + 4, 46),   # drawn back across the chest
        (30, 41, 152, 20, -5, -1, 0, ACX + 6, 44),   # coiled, weight on the back foot
        (42, 41, 88, 11, -1, 1, 0, ACX + 1, 47),     # breaking through, blade end-on
        (65, 42, 5, 18, 5, 1, 0, ACX - 9, 50),       # level, through the target
        (68, 45, -6, 17, 6, 1, 1, ACX - 12, 52),     # full extension
        (59, 51, 30, 20, 2, 1, 0, ACX - 10, 55),     # recovering to guard
    ]
    return swing(poses, hot=(2, 3))


def attack_b(n=6):
    """Overhead chop: up over the head, then down through the target.

    Was a rising sweep, which meant both swings travelled the same way round —
    A cut across and B cut up, and the pair read as one move at speed. Coming
    DOWN is the opposite of cutting across, so the two are now tellable apart
    from the arc alone.

    The arm folds tight at the top and drives out straight at the bottom, which
    is what a chop actually does: you cannot reach over your own head with a
    straight arm, and you cannot put weight through the cut with a bent one.
    """
    poses = [
        # hand      blade          lean bend sh  back hand
        (38, 32, -128, 20, -4, -1, 0, ACX + 3, 44),   # loading, blade up and back
        (44, 24, -98, 18, -5, -1, -3, ACX + 6, 42),   # fully raised, arm folded
        (56, 26, -38, 20, 0, 1, -2, ACX + 2, 46),     # coming over the top
        (66, 42, 22, 18, 5, 1, 0, ACX - 10, 50),      # through the target
        (61, 52, 68, 20, 4, 1, 0, ACX - 12, 54),      # driven down, arm straight
        (55, 52, 52, 19, 1, 1, 0, ACX - 9, 56),       # recovering to guard
    ]
    return swing(poses, hot=(3, 4))


def crouch_idle(n=2):
    """Low and coiled. The hurtbox shrinks with it, so this is a real defensive
    option rather than a pose."""
    return [
        frame(CX + 11, CX - 10, (CX + 13, 70 + (i == 1)), (CX - 12, 68), 88,
              squat=10, bob=(0, -1)[i])
        for i in range(n)
    ]


def crouch_walk(n=6):
    """Shuffling while crouched: short steps, no bob, weight kept low."""
    out = []
    for i in range(n):
        p = (i / n) * math.tau
        sw = math.sin(p) * 6
        out.append(frame(
            CX + sw, CX - sw,
            (CX + 12 - sw * 0.3, 70), (CX - 11 + sw * 0.3, 69), 88,
            squat=10, lean=1,
        ))
    return out


# The slide gets its own, WIDER frame.
#
# Every other pose is a standing body and fits 48. A lying one does not: the
# first two attempts were the same man compressed into the same box, which is
# exactly why he read as squashed rather than as prone. A body on its side is
# roughly two and a half heads long, and it needs the room.
SLIDE_W = 80
SLIDE_CX = 40


def slide(n=4):
    """A committed baseball slide, drawn from scratch on a wider canvas.

    `frame` cannot express this: it stacks a vertical torso with the head on
    top, and squatting it far enough to lie down pushes the hip below the canvas
    and draws the legs as two full-height bars (see the note there). So this
    composes the primitives directly — and on 80 columns rather than 48, which
    is the part the earlier versions were missing.

    The body runs nearly the whole width: trailing boot at the back, hip, a long
    torso, the head out front. The trailing arm is thrown back as counterweight,
    which is the read at a glance.
    """
    out = []
    # ground, hip x, lead-foot x, torso rise
    poses = [
        (GROUND - 2, SLIDE_CX - 14, SLIDE_CX + 30, 9),
        (GROUND - 1, SLIDE_CX - 17, SLIDE_CX + 34, 6),
        (GROUND - 1, SLIDE_CX - 16, SLIDE_CX + 33, 7),
        (GROUND - 2, SLIDE_CX - 13, SLIDE_CX + 29, 10),
    ]
    for ground, hip_x, foot_x, rise in poses:
        c = Canvas(SLIDE_W, H)
        hip_y = ground - 10
        sh_x, sh_y = hip_x + 30, hip_y - rise

        # Trailing leg, folded under the hip.
        c.taper(hip_x, hip_y, hip_x - 8, ground - 4, 7, 5, P["trs_sh"])
        draw_boot(c, hip_x - 11, ground)

        # Lead leg, reaching out along the floor.
        c.taper(hip_x, hip_y, foot_x - 7, ground - 6, 7, 5, P["trs"])
        draw_boot(c, foot_x, ground - 1)

        # Air tank, lying behind the shoulder rather than standing above it.
        c.taper(hip_x + 4, hip_y - 3, sh_x - 13, sh_y - 2, 8, 7, P["met_sh"])
        c.taper(hip_x + 4, hip_y - 4, sh_x - 14, sh_y - 3, 4, 3, P["met"])

        # Torso — the longest line in the pose, and thin, because it is seen
        # from the side.
        c.taper(hip_x, hip_y, sh_x, sh_y, 12, 10, P["coat"])
        c.taper(hip_x + 2, hip_y - 3, sh_x - 3, sh_y - 3, 5, 4, P["coat_hi"])
        c.taper(hip_x + 3, hip_y + 4, hip_x + 6, hip_y - 6, 4, 4, P["lea_sh"])

        # Trailing arm, thrown back.
        c.taper(sh_x - 6, sh_y + 1, hip_x - 6, hip_y - 10, 6, 4, P["coat_sh"])
        c.disc(hip_x - 7, hip_y - 11, 2.4, P["lea"])

        # Head out front, on the line of the body.
        draw_head_at(c, sh_x + 8, sh_y - 1, lens_hot=True)

        # Leading arm and the blade, held ahead of the slide.
        c.taper(sh_x + 3, sh_y + 5, foot_x - 10, hip_y - 3, 6, 4, P["coat"])
        c.disc(foot_x - 11, hip_y - 3, 2.4, P["lea"])
        draw_sword(c, foot_x - 11, hip_y - 3, -16, length=18)

        c.shade()
        c.outline()
        out.append(c.image())
    return out



def swim(n=6):
    """A front crawl, drawn horizontal on the wide canvas.

    The player has been swimming through environment 3 in the walking sprites,
    which reads as a man marching along the seabed — the one place in the game
    where the body is not upright was the one place still drawn upright.

    Composed directly, for the same reason the slide is: `frame` stacks a
    vertical torso and there is no amount of squatting that lies a body down.
    The skeleton is the slide's, turned nose-up and lifted off the floor.

    Six frames, one full stroke cycle. What has to read, in order:

    * ONE ARM OVERHEAD, reaching forward, the other pulled back past the hip.
      They swap over the cycle. That alternation is the whole animation — a
      swimmer with both arms in the same place is a corpse floating.
    * The body rolls with the pull. The shoulder line rises on the side that is
      reaching, which is what stops it looking like a plank being towed.
    * The legs flutter, small and out of phase with the arms. Big scissor kicks
      read as running, which is the exact mistake this replaces.
    * Head down and forward on the line of the body, not lifted — lifting it is
      how a doggy paddle looks, and this is meant to look capable.

    The sword stays in the trailing hand and trails along the body. Swimming
    with it held out front would put a blade through every stroke.
    """
    out = []
    # The body floats around the middle of the frame rather than standing on
    # its floor: the renderer anchors the sprite by the feet, and a swimmer
    # drawn down at GROUND would sit with its head at the waterline.
    AXIS = GROUND - 40
    for i in range(n):
        # One cycle of the stroke, as a phase from 0 to 1.
        f = i / n
        import math
        # The pull: +1 is the front arm reaching, -1 is the back arm reaching.
        pull = math.sin(f * 2 * math.pi)
        # The roll, a quarter-cycle behind the pull, which is what makes the
        # shoulder lead the hand rather than follow it.
        roll = math.sin(f * 2 * math.pi - 0.9)
        # And the flutter, at double rate — the legs beat twice a stroke.
        beat = math.sin(f * 4 * math.pi)

        c = Canvas(SLIDE_W, H)
        # Pulled forward off the left edge. At the old hip the boots ran out of
        # canvas and the back of the swimmer was a flat dark bar with the legs
        # clipped off inside it — the thing read as a torpedo with a tail.
        hip_x = SLIDE_CX - 11
        hip_y = AXIS + 7 - roll * 3
        sh_x = hip_x + 27
        sh_y = AXIS - 3 - roll * 2

        # The legs first, and long — the first pass had them as two stubs
        # behind a fat body and the whole thing read as a torpedo with a face.
        # A leg that is going to show a kick has to be long enough to have a
        # knee in it.
        for back, phase in ((True, beat), (False, -beat)):
            knee_x = hip_x - 10
            knee_y = hip_y + phase * 5
            foot_x = hip_x - 21
            foot_y = hip_y + phase * 13
            col = P["trs_sh"] if back else P["trs"]
            c.taper(hip_x, hip_y, knee_x, knee_y, 8, 6, col)
            c.taper(knee_x, knee_y, foot_x + 3, foot_y, 6, 4, col)
            # A lit edge along the top of each leg. The trousers are nearly
            # black and out here they hang in open water rather than against
            # the coat, so without this the legs are invisible and the boots
            # read as two crates floating behind the body.
            if not back:
                c.taper(hip_x - 2, hip_y - 3, knee_x, knee_y - 3, 3, 2, P["trs_hi"])
                c.taper(knee_x, knee_y - 2, foot_x + 3, foot_y - 2, 2, 2, P["trs_hi"])
            draw_boot(c, foot_x, foot_y + 4)

        # The tank, lying flat along the back and BELOW the spine rather than
        # standing off it. Above the line it was the widest thing in the pose
        # and the eye read it as the body.
        c.taper(hip_x + 6, hip_y + 1, sh_x - 12, sh_y + 1, 7, 6, P["met_sh"])
        c.taper(hip_x + 6, hip_y + 3, sh_x - 13, sh_y + 3, 3, 2, P["met"])

        # Torso — thinner than the slide's, because nothing here is bracing.
        c.taper(hip_x, hip_y, sh_x, sh_y, 11, 9, P["coat"])
        c.taper(hip_x + 3, hip_y - 3, sh_x - 3, sh_y - 3, 4, 3, P["coat_hi"])
        c.rect(hip_x + 1, hip_y - 4, hip_x + 7, hip_y, P["lea_sh"])

        # The pulling arm, under the body and sweeping back past the hip.
        pl_x = sh_x - 2 - pull * 13
        pl_y = hip_y + 8 + pull * 4
        c.taper(sh_x - 1, sh_y + 5, pl_x, pl_y, 6, 4, P["coat_sh"])
        c.disc(pl_x, pl_y, 2.6, P["lea_sh"])
        # The blade trails from that hand, laid back ALONG the body. Held out
        # at any angle it became the brightest shape in the frame and the eye
        # read it as a fin — a sword is not what this pose is about.
        draw_sword(c, pl_x, pl_y, 172, length=12)

        # Head down and forward, on the line of the body. Lens lit — it is dark
        # down there, and the lamp is the thing that says which end is front.
        draw_head_at(c, sh_x + 9, sh_y + 1, lens_hot=True)

        # The recovering arm, LAST and over everything, so it is the one limb
        # that cannot be lost in the silhouette. It swings from back past the
        # hip, up over the head, and enters the water out in front — that
        # travel is the animation, and if only one thing reads it is this.
        el_x = sh_x + 2 + pull * 7
        el_y = sh_y - 15
        hd_x = sh_x + 10 + pull * 15
        hd_y = sh_y - 11 - pull * 6
        c.taper(sh_x - 3, sh_y - 2, el_x, el_y, 7, 5, P["coat_lit"] if "coat_lit" in P else P["coat_hi"])
        c.taper(el_x, el_y, hd_x, hd_y, 5, 4, P["coat_hi"])
        c.disc(hd_x, hd_y, 2.8, P["lea"])
        c.disc(hd_x - 1, hd_y - 1, 1.4, P["lea_hi"])

        c.shade()
        c.outline()
        out.append(c.image())
    return out


def throwing(n=5):
    """An overhand throw. Five frames: wind, cock, release, follow, settle.

    Built for the Revenant, which has a fireball where the player has a stun —
    and drawn as a THROW rather than borrowed from the smash, because the smash
    is a two-handed downward commit and reads as "something is about to happen
    at my feet". A ranged tell has to say the opposite: the danger is going to
    leave, and it is going THAT way.
    """
    out = []
    # (lead hand, off hand, lean, how much fire is in the hand)
    poses = [
        ((CX - 14, 34), (CX + 10, 62), -3, 0.3),
        ((CX - 22, 22), (CX + 16, 58), -6, 0.7),
        ((CX + 4, 26), (CX + 6, 60), 2, 1.0),
        ((CX + 26, 40), (CX - 2, 64), 6, 0.4),
        ((CX + 18, 52), (CX - 8, 66), 3, 0.0),
    ]
    for i, (lead, off, lean, heat) in enumerate(poses):
        c = Canvas()
        ground = GROUND
        # Feet planted and turned, because a throw comes off the back foot.
        draw_leg(c, CX - 4, CX - 16, ground, back=True)
        draw_arm(c, CX - 7, off[0], off[1], back=True)
        draw_torso(c, lean, 0, cx=CX)
        draw_head(c, lean, 0, lens_hot=True, cx=CX)
        draw_leg(c, CX + 4, CX + 14, ground)
        draw_arm(c, CX + 6 + lean // 2, lead[0], lead[1], bend=-1)
        # The fire in the hand, growing through the wind-up and gone after the
        # release — which is the whole tell, and it is where the hand is.
        if heat > 0:
            r = 3 + heat * 5
            c.disc(lead[0], lead[1], r, P["lens"])
            c.disc(lead[0] - 1, lead[1] - 1, r * 0.55, P["lens_hi"])
        c.shade()
        c.outline()
        out.append(c.image())
    return out


def smash(n=4):
    """Jump then down: blade raised overhead, then driven straight into the
    floor. The last frame is the impact, so it lands on the active tick."""
    poses = [
        (-90, CX + 4, 30, -14, True),
        (-70, CX + 8, 26, -10, True),
        (40, CX + 10, 54, -2, True),
        (88, CX + 8, 74, 8, False),
    ]
    return [
        frame(CX + 5, CX - 6, (hx, hy), (CX - 10, 56), ang,
              squat=sq, airborne=air, lens_hot=(i >= 2))
        for i, (ang, hx, hy, sq, air) in enumerate(poses)
    ]


def block(n=2):
    return [
        frame(CX + 5, CX - 7, (CX + 9, 46), (CX - 9, 54), -60, lean=-1, lens_hot=(i == 0))
        for i in range(n)
    ]


def stun(n=5):
    """The guard-breaker: the blade is turned in the hand and the hilt driven
    forward, so the pose reads as a shove rather than a cut.

    It has to look like a different KIND of thing from the two slashes, not a
    third one of them — a player who cannot tell at a glance which of their
    attacks is on screen cannot learn what beats a guard.

    Frame 2 is the drive, and it sits where the hitbox goes live. The wind-up
    gets two frames because the startup is three times the sword's: a tell that
    long has to be visibly a wind-up for all of it, or it just reads as lag.
    """
    # The blade is stood almost upright on the drive so it clears the body
    # entirely. Angled back across the chest instead, it lands on the coat and
    # the frame reads as a sword being tucked away rather than a hilt going
    # somewhere — the crossguard leading the fist is the whole silhouette.
    poses = [
        # ang, hand x, hand y, lean, front foot, back foot
        (-150, CX - 4, 58, -3, CX + 4, CX - 9),   # coil: weight back, hilt cocked
        (-135, CX - 8, 62, -5, CX + 2, CX - 11),  # deeper, front foot unweighted
        (-100, CX + 19, 48, 3, CX + 13, CX - 13),  # the drive — arm out, hilt first
        (-96, CX + 17, 50, 2, CX + 12, CX - 12),  # held, weight still forward
        (-45, CX + 12, 56, 0, CX + 6, CX - 8),    # blade rolls back down to guard
    ]
    return [
        frame(ff + ln, bf + ln, (hx, hy), (CX - 10 + ln, 56), ang,
              lean=ln, lens_hot=(i in (2, 3)))
        for i, (ang, hx, hy, ln, ff, bf) in enumerate(poses)
    ]


# The goblin's own colours, so the transformation ends somewhere real rather
# than at a green tint of the player.
G = {
    "skin_hi": rgb(0x7E9152), "skin": rgb(0x5C6C3A), "skin_sh": rgb(0x3F4B26),
    "rag": rgb(0x4A3122), "eye": rgb(0xF0A83C),
}


def backstep(n=3):
    """A short hop back, on the back foot, blade kept up between.

    Upright, and that is the whole point: the slide is a committed dive that
    ends in a sprint, this is a half-metre of ground bought with a jump. If they
    read the same the player cannot tell which one they just spent.
    """
    poses = [
        # front foot, back foot, hand y, lean, lift
        (CX + 2, CX - 10, 52, -5, 0),
        (CX + 6, CX - 15, 48, -11, 7),
        (CX + 4, CX - 13, 50, -8, 2),
    ]
    return [
        frame(ff, bf, (CX + 6 + ln, hy), (CX - 12 + ln, hy + 4), -48,
              lean=ln, front_lift=lift, back_lift=lift * 0.4, lens_hot=(i == 1))
        for i, (ff, bf, hy, ln, lift) in enumerate(poses)
    ]


def wall(n=2):
    """Hanging off a wall by one hand, boots braced against it, sliding.

    Composed directly rather than through `frame`, because `frame` builds a body
    standing on the floor and this one is not on the floor at all — it is
    pressed side-on against a vertical face with its weight hanging off the top
    hand. The tells, in order of how fast they read:

    * The lead hand is ABOVE THE HEAD, on the face. That is what says "held" —
      it is the single thing the eye reads first.
    * The body hangs from it, upright and shoulder-first into the wall.
    * Knees folded and pushed out AWAY from the wall, boots braced back on it
      below the hip. Legs straight down would read as standing on nothing.
    * The sword is in the trailing hand, hanging away — you are not fighting.

    The first attempt sat him down: hip and boots at the same height with the
    legs out sideways, which reads as a man perched on a ledge. The fix is that
    the feet go BELOW the hip and the knees go out, not up.

    The face is on the RIGHT of the frame at x = WALL_X, and the renderer flips
    the sprite for a wall on the other side, exactly as it does for facing.
    """
    WALL_X = CX + 16
    out = []
    # Two frames, a slow scrape apart: the grip slips a little and catches.
    for i, (slip, boot) in enumerate(((0, 0), (2, 1))):
        c = Canvas()
        # The body hangs BACK from the face rather than flat against it, so that
        # every limb touching the wall is visibly reaching for it. Flat against
        # it, the arm and legs were inside the torso's own silhouette and the
        # pose had nothing to read.
        hip_x, hip_y = CX - 4, HIP + 6 + slip
        sh_x, sh_y = CX - 1, SHOULDER + 6 + slip

        def leg(knee_x, knee_y, foot_x, foot_y, col):
            # Keyed out from the coat, like the sword arm: folded legs crossing
            # the hem are the same value as the hem without it.
            c.taper(hip_x, hip_y, knee_x, knee_y, 9, 8, P["trs_dk"])
            c.taper(knee_x, knee_y, foot_x, foot_y, 8, 6, P["trs_dk"])
            c.taper(hip_x, hip_y, knee_x, knee_y, 7, 6, col)
            c.taper(knee_x, knee_y, foot_x, foot_y, 6, 4, col)

        # Far leg: deeper fold, boot lower on the face.
        leg(hip_x - 6, hip_y + 13, WALL_X - 8, hip_y + 21 - boot, P["trs_sh"])
        draw_boot(c, WALL_X - 5, hip_y + 24 - boot)
        # Near leg: tighter, boot higher, so the two are never a mirrored pair.
        leg(hip_x - 4, hip_y + 8, WALL_X - 9, hip_y + 12 + boot, P["trs"])
        draw_boot(c, WALL_X - 6, hip_y + 15 + boot)

        # Trailing arm and the blade, hanging away from the wall.
        c.taper(sh_x - 5, sh_y + 3, CX - 13, sh_y + 17, 6, 4, P["coat_sh"])
        c.disc(CX - 13, sh_y + 17, 2.4, P["lea"])
        draw_sword(c, CX - 13, sh_y + 17, 96, length=18)

        # Torso. The tank rides on the outside shoulder, away from the rock.
        c.rect(CX - 13, sh_y - 1, CX - 9, hip_y - 9, P["met_sh"])
        c.rect(CX - 13, sh_y - 1, CX - 12, hip_y - 9, P["met"])
        c.taper(hip_x, hip_y, sh_x, sh_y, 15, 13, P["coat"])
        c.taper(hip_x + 2, hip_y - 6, sh_x + 4, sh_y + 2, 5, 4, P["coat_hi"])
        c.rect(hip_x - 8, hip_y - 9, hip_x + 9, hip_y - 5, P["lea_sh"])
        c.rect(hip_x - 1, hip_y - 9, hip_x + 3, hip_y - 5, P["brass"])

        # Head low and back, clear of the raised arm. Tucked up against the
        # shoulder it swallowed the grip whole and the pose lost its one tell.
        draw_head_at(c, sh_x - 1, HEAD + 12 + slip, lens_hot=True)

        # The gripping hand, well above the head and ON the face. Drawn last so
        # it sits over everything — a hand behind the shoulder is not a grip.
        draw_arm(c, sh_x + 5, WALL_X - 2, HEAD - 3 + slip, bend=-1)

        # Scrape marks where the boots drag, so the slide reads as motion even
        # in a still frame.
        for k in range(3):
            c.set(WALL_X - 1, hip_y + 8 + k * 5 - boot * 2, P["met_sh"])

        c.shade()
        c.outline()
        out.append(c.image())
    return out


def lying(c, ground, hip_x, sh_x, rise, limp):
    """A body on the ground, composed from the primitives.

    `frame` cannot draw one: it stacks a vertical torso and puts the head on
    top, and squatting it far enough to lie down pushes the hip below the canvas
    — at which point the legs are drawn from a hip that is off the image and
    render as two full-height bars. That is documented at `frame` and it is
    exactly what the first draft of the death frames did.

    `limp` sprawls the limbs instead of bracing them, which is the whole
    difference between a slide and a corpse.
    """
    hip_y = ground - 9
    sh_y = hip_y - rise

    # Legs. Braced and reaching for a slide; folded and slack for a body.
    if limp:
        c.taper(hip_x, hip_y, hip_x - 13, ground - 3, 7, 5, P["trs_sh"])
        draw_boot(c, hip_x - 16, ground)
        c.taper(hip_x, hip_y, hip_x - 21, ground - 5, 7, 5, P["trs"])
        draw_boot(c, hip_x - 24, ground - 1)
    else:
        c.taper(hip_x, hip_y, hip_x + 6, ground - 4, 7, 5, P["trs_sh"])
        draw_boot(c, hip_x + 8, ground)

    # Tank, then torso, then belt.
    c.taper(hip_x + 3, hip_y - 3, sh_x - 10, sh_y - 2, 8, 7, P["met_sh"])
    c.taper(hip_x + 3, hip_y - 4, sh_x - 11, sh_y - 3, 4, 3, P["met"])
    c.taper(hip_x, hip_y, sh_x, sh_y, 12, 11, P["coat"])
    c.taper(hip_x + 1, hip_y - 3, sh_x - 2, sh_y - 3, 5, 4, P["coat_hi"])
    c.taper(hip_x + 3, hip_y + 4, hip_x + 6, hip_y - 6, 4, 4, P["lea_sh"])

    # Arms.
    c.taper(sh_x - 4, sh_y + 1, hip_x - 9, hip_y - 9, 6, 4, P["coat_sh"])
    c.disc(hip_x - 10, hip_y - 10, 2.4, P["lea"])
    return hip_y, sh_y


def death(n=6):
    """Killed. Staggers, drops to a knee, then goes down and stays there.

    It ends lying still rather than fading out: the body is the marker for where
    the run ended, and the shell holds on it before offering the revive. A death
    that cuts straight to a menu never happened to anybody.
    """
    out = []

    # Two upright frames: the stagger and the knee. Squat stays well inside the
    # canvas — past about 20 the legs come apart (see `frame`).
    out.append(frame(CX + 5 - 3, CX - 7 - 3, (CX + 7, 58), (CX - 13, 54), 80,
                     squat=4, lean=-3, lens_hot=True))
    out.append(frame(CX + 7 - 8, CX - 9 - 8, (CX + 4, 68), (CX - 15, 62), 120,
                     squat=18, lean=-8))

    # Then down, drawn directly.
    for ground, hip_x, sh_x, rise in (
        (GROUND - 6, CX + 4, CX - 14, 16),
        (GROUND - 3, CX + 6, CX - 18, 9),
        (GROUND - 1, CX + 8, CX - 21, 5),
        (GROUND - 1, CX + 8, CX - 22, 4),
    ):
        c = Canvas()
        hip_y, sh_y = lying(c, ground, hip_x, sh_x, rise, limp=True)
        # Head trailing behind the body, lenses out.
        draw_head_at(c, sh_x - 7, sh_y - 1, lens_hot=False)
        # The sword, dropped.
        draw_sword(c, hip_x + 16, ground - 3, 8, length=16)
        c.shade()
        c.outline()
        out.append(c.image())
    return out


def transform(n=7):
    """The air ran out.

    Not a death — a becoming, and the whole premise of the game says so. The
    mask comes off, the body hunches, and the palette walks from the player's
    slate coat to the goblin's diseased green over the last three frames. The
    lenses go out first, because they are the oxygen: once they are dark the
    thing standing there is already not him.
    """
    out = []
    # Squat stays under 20 throughout. Past that the legs are drawn from a hip
    # below the canvas and come apart into two bars — the same trap the death
    # frames fell into, documented at `frame`.
    poses = [
        (4, -2, 0.0, True),
        (12, -6, 0.0, True),
        (18, -10, 0.25, False),
        (20, -12, 0.55, False),
        (17, -8, 0.8, False),
        (10, -4, 1.0, False),
        (4, 2, 1.0, False),
    ]
    for i, (sq, ln, green, lit) in enumerate(poses):
        c = Canvas()
        ground = GROUND
        hip_y = HIP + sq
        draw_leg(c, CX - 3, CX - 8 + ln, ground, back=True, hip_y=hip_y, knee_out=-sq // 2)
        draw_arm(c, CX - 7, CX - 12 + ln, 58 + sq, back=True)
        draw_torso(c, ln, sq, sq)
        # The head: masked at first, bare and green by the end.
        if green < 0.5:
            draw_head_at(c, CX + ln * 2, HEAD + sq, lens_hot=lit)
        else:
            hx, hy = CX + ln * 2, HEAD + sq + 4
            c.disc(hx, hy, 9, G["skin_sh"])
            c.disc(hx + 1, hy, 8, G["skin"])
            c.set(hx + 4, hy - 2, G["eye"])
            c.set(hx - 3, hy - 1, G["eye"])
            # Ears, which are most of what makes the silhouette a goblin.
            c.taper(hx - 7, hy - 3, hx - 15, hy - 10, 5, 2, G["skin_sh"])
            c.taper(hx + 7, hy - 4, hx + 14, hy - 12, 5, 2, G["skin"])
        draw_leg(c, CX + 3, CX + 9 + ln, ground, hip_y=hip_y, knee_out=sq // 2)
        draw_arm(c, CX + 7, CX + 13 + ln, 60 + sq)
        c.shade()
        c.outline()

        # Walk the whole frame toward the goblin's palette.
        if green > 0:
            img = c.image()
            px = img.load()
            for yy in range(H):
                for xx in range(W):
                    r, g, b, a = px[xx, yy]
                    if not a:
                        continue
                    tone = (r + g + b) / 3 / 255
                    tr = int(G["skin_sh"][0] + (G["skin_hi"][0] - G["skin_sh"][0]) * tone)
                    tg = int(G["skin_sh"][1] + (G["skin_hi"][1] - G["skin_sh"][1]) * tone)
                    tb = int(G["skin_sh"][2] + (G["skin_hi"][2] - G["skin_sh"][2]) * tone)
                    px[xx, yy] = (
                        int(r + (tr - r) * green),
                        int(g + (tg - g) * green),
                        int(b + (tb - b) * green),
                        a,
                    )
            out.append(img)
        else:
            out.append(c.image())
    return out


def hurt():
    return [frame(CX + 3, CX - 9, (CX + 8, 64), (CX - 12, 56), 100, lean=-3, bob=1)]


def save(frames, name):
    # Frame width comes from the frames themselves: the slide is drawn wider
    # than everything else, because a lying body does not fit 48 columns.
    fw = frames[0].width
    sheet = Image.new("RGBA", (fw * len(frames), H), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        sheet.paste(f, (i * fw, 0))
    sheet.save(OUT / name)
    print(f"{name}: {len(frames)} frames -> {sheet.width}x{sheet.height}")


def build_all(prefix):
    save(idle(), f"{prefix}-idle.png")
    save(walk(), f"{prefix}-walk.png")
    save(run(), f"{prefix}-run.png")
    save(attack_a(), f"{prefix}-attack-a.png")
    save(attack_b(), f"{prefix}-attack-b.png")
    save(block(), f"{prefix}-block.png")
    save(hurt(), f"{prefix}-hurt.png")
    save(crouch_idle(), f"{prefix}-crouch.png")
    save(crouch_walk(), f"{prefix}-crouch-walk.png")
    save(slide(), f"{prefix}-slide.png")
    save(backstep(), f"{prefix}-backstep.png")
    save(wall(), f"{prefix}-wall.png")
    save(swim(), f"{prefix}-swim.png")
    save(throwing(), f"{prefix}-throw.png")
    save(smash(), f"{prefix}-smash.png")
    save(stun(), f"{prefix}-stun.png")
    # Death and the transformation belong to the person, not the armour, and
    # the transformation ends on a goblin either way — so both are drawn once,
    # in the default palette, and every skin shares them.
    # Death belongs to the person, not the armour, so the ordinary player's is
    # drawn once in the default palette and every skin shares it.
    #
    # The Revenant is the exception, and it has to be: it dies on screen, in its
    # own colours, in front of a player who has just spent a minute learning
    # what it looks like. Borrowing the scavenger's corpse would have it change
    # colour at the exact moment it mattered most.
    if prefix in ("player", "revenant"):
        save(death(), f"{prefix}-death.png")
    if prefix == "player":
        save(transform(), f"{prefix}-transform.png")


BASE_PALETTE = dict(P)
for _skin in SKINS.values():
    P.clear()
    P.update(BASE_PALETTE)
    P.update(_skin["palette"])
    STYLE["kind"] = _skin["kind"]
    build_all(_skin["prefix"])

P.clear()
P.update(BASE_PALETTE)
STYLE["kind"] = "scav"

preview = idle() + walk() + run() + attack_a() + attack_b() + block() + hurt() + crouch_idle() + crouch_walk() + slide() + backstep() + wall() + swim() + smash() + stun() + death() + transform()
s = 4
total = sum(f.width for f in preview)
canvas = Image.new("RGBA", (total * s, H * s), (0x0B, 0x0E, 0x14, 255))
at = 0
for f in preview:
    canvas.alpha_composite(f.resize((f.width * s, H * s), Image.NEAREST), (at * s, 0))
    at += f.width
canvas.save(Path(__file__).resolve().parent / "_preview-player.png")
print("preview -> art-src/_preview-player.png")
