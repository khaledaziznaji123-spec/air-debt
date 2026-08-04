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

SHADE = {  # base -> (highlight, shadow) for automatic lighting
    P["coat"]: (P["coat_hi"], P["coat_sh"]),
    P["lea"]: (P["lea_hi"], P["lea_sh"]),
    P["met"]: (P["met_hi"], P["met_sh"]),
    P["rub"]: (P["rub_hi"], P["rub_sh"]),
    P["lens"]: (P["lens_hi"], P["lens_sh"]),
    P["trs"]: (P["trs_hi"], P["trs_sh"]),
}

# Outline colour per family, so edges stay in-family rather than going black.
OUTLINE_OF = {
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
    c.taper(hip_x, hip_y, knee_x, knee_y, 7, 6, col)
    c.taper(knee_x, knee_y, foot_x, foot_y - 5, 6, 4, col)
    draw_boot(c, foot_x, foot_y)


def draw_arm(c, sh_x, hand_x, hand_y, back=False):
    col = P["coat_sh"] if back else P["coat"]
    ex = (sh_x + hand_x) / 2 + (1 if not back else -1)
    ey = (SHOULDER + hand_y) / 2
    c.taper(sh_x, SHOULDER + 2, ex, ey, 7, 5, col)
    c.taper(ex, ey, hand_x, hand_y, 5, 4, col)
    c.disc(hand_x, hand_y, 2.4, P["lea"])          # glove
    c.set(hand_x - 1, hand_y - 1, P["lea_hi"])


def draw_sword(c, hx, hy, ang, length=20):
    a = math.radians(ang)
    dx, dy = math.cos(a), math.sin(a)
    gx, gy = hx + dx * 3, hy + dy * 3
    tx, ty = hx + dx * length, hy + dy * length
    c.taper(hx - dx * 3, hy - dy * 3, gx, gy, 3, 3, P["lea_sh"])       # grip
    c.taper(gx - dy * 4, gy + dx * 4, gx + dy * 4, gy - dx * 4, 3, 3, P["brass"])  # guard
    c.taper(gx, gy, tx, ty, 5, 2, P["met"])
    c.taper(gx + dy, gy - dx, tx, ty, 2, 1, P["met_hi"])               # fuller glint


def draw_torso(c, lean=0, bob=0, squat=0):
    x, y = CX + lean, bob

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

    # hose, tank to mask
    for t in range(9):
        f = t / 8
        hx = x - 11 + f * 8
        hy = SHOULDER + y - 1 - f * 9 + math.sin(f * 3.1) * 2
        c.disc(hx, hy, 1.6, P["rub"])


def draw_head(c, lean=0, bob=0, lens_hot=False):
    x, y = CX + lean * 2, HEAD + bob

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


def frame(front_foot, back_foot, front_hand, back_hand, sword_ang,
          lean=0, bob=0, lens_hot=False, sword=True, squat=0, airborne=False):
    """squat lowers the whole upper body and bends the knees outward, which is
    what makes a crouch read as a crouch rather than a shorter person."""
    c = Canvas()
    ground = GROUND - (6 if airborne else 0)
    hip_y = HIP + squat
    draw_leg(c, CX - 3, back_foot, ground, back=True, hip_y=hip_y, knee_out=-squat // 2)
    draw_arm(c, CX - 7, back_hand[0], back_hand[1] + bob + squat, back=True)
    draw_torso(c, lean, bob + squat, squat)
    draw_head(c, lean, bob + squat, lens_hot)
    draw_leg(c, CX + 3, front_foot, ground, hip_y=hip_y, knee_out=squat // 2)
    draw_arm(c, CX + 7, front_hand[0], front_hand[1] + bob + squat)
    if sword:
        draw_sword(c, front_hand[0], front_hand[1] + bob + squat, sword_ang)
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
        ))
    return out


def attack_a(n=6):
    """Horizontal slash: the blade is drawn back across the body, then swept
    flat through the target. Reads completely differently from the rising
    sweep, which is the point of having two."""
    poses = [
        (-170, CX - 8, 52, -3), (-160, CX - 5, 50, -2), (-40, CX + 8, 49, 2),
        (0, CX + 16, 50, 4), (15, CX + 15, 52, 2), (35, CX + 12, 56, 0),
    ]
    return [
        frame(CX + 7 + ln, CX - 8 + ln, (hx, hy), (CX - 10 + ln, 58), ang,
              lean=ln, lens_hot=(i in (2, 3)))
        for i, (ang, hx, hy, ln) in enumerate(poses)
    ]


def attack_b(n=6):
    """Low rising sweep: drop the blade, then drive it up and out."""
    poses = [
        (120, CX + 4, 68, -1), (140, CX + 1, 72, -2), (60, CX + 11, 66, 2),
        (0, CX + 16, 56, 3), (-35, CX + 15, 47, 2), (60, CX + 12, 60, 0),
    ]
    return [
        frame(CX + 8 + ln, CX - 7 + ln, (hx, hy), (CX - 9 + ln, 60), ang,
              lean=ln, lens_hot=(i in (3, 4)))
        for i, (ang, hx, hy, ln) in enumerate(poses)
    ]


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


def slide(n=3):
    """Committed forward dive — the trailing leg extends, the blade drags."""
    poses = [(14, 16, 100), (20, 20, 112), (16, 18, 104)]
    return [
        frame(CX + fwd, CX - 12, (CX + 4, 74), (CX - 14, 68), ang,
              squat=sq, lean=5)
        for fwd, sq, ang in poses
    ]


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


def hurt():
    return [frame(CX + 3, CX - 9, (CX + 8, 64), (CX - 12, 56), 100, lean=-3, bob=1)]


def save(frames, name):
    sheet = Image.new("RGBA", (W * len(frames), H), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        sheet.paste(f, (i * W, 0))
    sheet.save(OUT / name)
    print(f"{name}: {len(frames)} frames -> {sheet.width}x{sheet.height}")


save(idle(), "player-idle.png")
save(walk(), "player-run.png")
save(attack_a(), "player-attack-a.png")
save(attack_b(), "player-attack-b.png")
save(block(), "player-block.png")
save(hurt(), "player-hurt.png")
save(crouch_idle(), "player-crouch.png")
save(crouch_walk(), "player-crouch-walk.png")
save(slide(), "player-slide.png")
save(smash(), "player-smash.png")

preview = idle() + walk() + attack_a() + attack_b() + block() + hurt() + crouch_idle() + crouch_walk() + slide() + smash()
s = 4
canvas = Image.new("RGBA", (W * len(preview) * s, H * s), (0x0B, 0x0E, 0x14, 255))
for i, f in enumerate(preview):
    canvas.alpha_composite(f.resize((W * s, H * s), Image.NEAREST), (i * W * s, 0))
canvas.save(Path(__file__).resolve().parent / "_preview-player.png")
print("preview -> art-src/_preview-player.png")
