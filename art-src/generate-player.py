"""
Generate the player character: idle, walk cycle, sword attack. 32x64 per frame.

Palette and proportions are tuned against a reference walk cycle — warm browns,
a teal scarf, cream sleeves, grey trousers. The pixels here are generated, not
copied, so nothing that ships carries a provenance question.

The design merges that reference with the game's own premise: the scarf is
pulled up as a rebreather and the goggles carry the oxygen glow, because the
player is breathing borrowed air and the silhouette should say so.

Re-run to regenerate every frame. Poses are parameters, so fixing proportions is
a number change rather than a redraw.
"""
import math
from pathlib import Path
from PIL import Image

W, H = 32, 64
OUT = Path(__file__).resolve().parent / "generated"
OUT.mkdir(parents=True, exist_ok=True)

# Sampled from the reference, then tightened for cohesion.
C = {
    "line":      (0x22, 0x14, 0x11, 255),
    "hair":      (0x6b, 0x3e, 0x28, 255),
    "hair_l":    (0x7c, 0x45, 0x2b, 255),
    "skin":      (0xe4, 0xa3, 0x6a, 255),
    "skin_d":    (0xbb, 0x7c, 0x52, 255),
    "scarf":     (0x33, 0x45, 0x42, 255),
    "scarf_l":   (0x44, 0x5c, 0x58, 255),
    "visor":     (0x4e, 0xcd, 0xc4, 255),
    "sleeve":    (0xe1, 0xc4, 0x95, 255),
    "vest":      (0x4e, 0x2c, 0x20, 255),
    "vest_l":    (0x5c, 0x35, 0x24, 255),
    "leather":   (0x67, 0x39, 0x25, 255),
    "trouser":   (0x32, 0x34, 0x33, 255),
    "trouser_l": (0x44, 0x42, 0x3e, 255),
    "metal":     (0xa8, 0xb2, 0xc0, 255),
    "metal_l":   (0xe4, 0xeb, 0xf4, 255),
}


class Canvas:
    def __init__(self, w=W, h=H):
        self.w, self.h = w, h
        self.px = [[None] * w for _ in range(h)]

    def set(self, x, y, col):
        x, y = int(round(x)), int(round(y))
        if 0 <= x < self.w and 0 <= y < self.h:
            self.px[y][x] = col

    def rect(self, x0, y0, x1, y1, col):
        for y in range(int(round(y0)), int(round(y1)) + 1):
            for x in range(int(round(x0)), int(round(x1)) + 1):
                self.set(x, y, col)

    def line(self, x0, y0, x1, y1, col, thick=1):
        steps = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
        for i in range(steps):
            t = i / max(steps - 1, 1)
            x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
            r = thick // 2
            for dy in range(-r, r + 1):
                for dx in range(-r, r + 1):
                    self.set(x + dx, y + dy, col)

    def outline(self, col=C["line"]):
        filled = [[self.px[y][x] is not None for x in range(self.w)] for y in range(self.h)]
        edge = []
        for y in range(self.h):
            for x in range(self.w):
                if filled[y][x]:
                    continue
                if any(
                    0 <= x + dx < self.w and 0 <= y + dy < self.h and filled[y + dy][x + dx]
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))
                ):
                    edge.append((x, y))
        for x, y in edge:
            self.set(x, y, col)

    def image(self):
        img = Image.new("RGBA", (self.w, self.h), (0, 0, 0, 0))
        for y in range(self.h):
            for x in range(self.w):
                if self.px[y][x]:
                    img.putpixel((x, y), self.px[y][x])
        return img


# Chunkier than realistic proportions — a bigger head reads better small.
GROUND, HIP_Y, SHOULDER_Y, HEAD_CY = 61, 39, 24, 14


def draw_leg(c, hip_x, foot_x, foot_y, back=False):
    col = C["trouser"] if back else C["trouser_l"]
    knee_x, knee_y = (hip_x + foot_x) / 2, (HIP_Y + foot_y) / 2
    c.line(hip_x, HIP_Y, knee_x, knee_y, col, thick=4)
    c.line(knee_x, knee_y, foot_x, foot_y - 3, col, thick=3)
    c.rect(foot_x - 2, foot_y - 3, foot_x + 2, foot_y, C["leather"])
    c.rect(foot_x - 2, foot_y - 4, foot_x + 2, foot_y - 4, C["vest_l"])


def draw_arm(c, sh_x, hand_x, hand_y, back=False):
    sleeve = C["vest"] if back else C["sleeve"]
    elbow_x, elbow_y = (sh_x + hand_x) / 2, (SHOULDER_Y + hand_y) / 2
    c.line(sh_x, SHOULDER_Y, elbow_x, elbow_y, sleeve, thick=3)
    c.line(elbow_x, elbow_y, hand_x, hand_y, sleeve, thick=2)
    c.line(hand_x, hand_y - 1, hand_x, hand_y + 1, C["skin_d"] if back else C["skin"], thick=2)


def draw_sword(c, hx, hy, angle_deg, length=14):
    a = math.radians(angle_deg)
    tx, ty = hx + math.cos(a) * length, hy + math.sin(a) * length
    gx, gy = hx + math.cos(a) * 2, hy + math.sin(a) * 2
    c.line(gx - math.sin(a) * 2, gy + math.cos(a) * 2,
           gx + math.sin(a) * 2, gy - math.cos(a) * 2, C["leather"])
    c.line(gx, gy, tx, ty, C["metal"], thick=2)
    c.line(gx, gy, tx, ty, C["metal_l"])


def draw_body(c, bob=0, lean=0):
    y, lx = bob, lean

    # air tank — the premise, worn on the back
    c.rect(8 + lx, SHOULDER_Y - 1 + y, 10 + lx, SHOULDER_Y + 10 + y, C["trouser_l"])
    c.rect(8 + lx, SHOULDER_Y - 1 + y, 8 + lx, SHOULDER_Y + 10 + y, C["trouser"])

    # torso
    c.rect(11 + lx, SHOULDER_Y - 1 + y, 21 + lx, HIP_Y + y, C["vest"])
    c.rect(19 + lx, SHOULDER_Y - 1 + y, 21 + lx, HIP_Y + y, C["vest_l"])
    c.line(12 + lx, HIP_Y - 3 + y, 20 + lx, SHOULDER_Y + 1 + y, C["leather"], thick=1)
    c.rect(11 + lx, HIP_Y - 3 + y, 21 + lx, HIP_Y - 1 + y, C["leather"])
    # satchel at the hip
    c.rect(9 + lx, HIP_Y - 2 + y, 13 + lx, HIP_Y + 3 + y, C["hair"])
    c.rect(9 + lx, HIP_Y - 2 + y, 13 + lx, HIP_Y - 2 + y, C["hair_l"])

    # scarf
    c.rect(11 + lx, SHOULDER_Y - 3 + y, 21 + lx, SHOULDER_Y + y, C["scarf"])
    c.rect(12 + lx, SHOULDER_Y - 4 + y, 20 + lx, SHOULDER_Y - 4 + y, C["scarf_l"])
    c.rect(21 + lx, SHOULDER_Y - 2 + y, 22 + lx, SHOULDER_Y + 3 + y, C["scarf"])

    # head
    hx, hy = 16 + lx, HEAD_CY + y
    c.rect(hx - 4, hy - 3, hx + 4, hy + 6, C["skin"])
    c.rect(hx + 3, hy - 3, hx + 4, hy + 6, C["skin_d"])
    c.rect(hx - 4, hy + 4, hx + 4, hy + 6, C["scarf"])
    # goggles: brightest thing on the sprite, so facing is never ambiguous
    c.rect(hx - 4, hy, hx + 4, hy + 2, C["line"])
    c.rect(hx - 3, hy, hx - 1, hy + 1, C["visor"])
    c.rect(hx + 1, hy, hx + 3, hy + 1, C["visor"])
    # Hair, tapered rather than a block. A flat-topped rectangle reads as a
    # helmet; narrowing each row up gives a head silhouette instead.
    c.rect(hx - 5, hy - 2, hx + 5, hy - 1, C["hair"])   # sides, past the ears
    c.rect(hx - 5, hy - 4, hx + 5, hy - 3, C["hair"])
    c.rect(hx - 4, hy - 6, hx + 4, hy - 5, C["hair"])
    c.rect(hx - 3, hy - 7, hx + 3, hy - 7, C["hair"])
    c.rect(hx - 4, hy - 6, hx + 1, hy - 6, C["hair_l"])  # top light
    c.rect(hx - 3, hy - 4, hx - 1, hy - 4, C["hair_l"])
    # spikes, offset so they do not line up into a fringe
    for dx, dy in ((-4, -8), (-1, -9), (2, -8), (4, -9)):
        c.rect(hx + dx, hy + dy, hx + dx, hy + dy + 1, C["hair"])
    c.rect(hx - 5, hy - 1, hx - 4, hy + 1, C["hair"])   # sideburn frames the face


def frame(legs, arms, sword=None, bob=0, lean=0):
    c = Canvas()
    draw_leg(c, 15 + lean, legs["back_x"], legs["back_y"], back=True)
    draw_arm(c, 13 + lean, arms["back_x"], arms["back_y"] + bob, back=True)
    draw_body(c, bob=bob, lean=lean)
    draw_leg(c, 17 + lean, legs["front_x"], legs["front_y"])
    draw_arm(c, 20 + lean, arms["front_x"], arms["front_y"] + bob)
    if sword is not None:
        draw_sword(c, arms["front_x"], arms["front_y"] + bob, sword)
    c.outline()
    return c.image()


def idle():
    return [frame(
        legs={"front_x": 18, "front_y": GROUND, "back_x": 14, "back_y": GROUND},
        arms={"front_x": 22, "front_y": 36, "back_x": 11, "back_y": 36},
        sword=80,
    )]


def walk(frames=6):
    out = []
    for i in range(frames):
        p = (i / frames) * math.tau
        swing = math.sin(p) * 7
        lift = max(0.0, math.sin(p)) * 5
        lift_b = max(0.0, math.sin(p + math.pi)) * 5
        bob = -1 if math.sin(p * 2) > 0.4 else 0
        out.append(frame(
            legs={
                "front_x": 16 + swing, "front_y": GROUND - lift,
                "back_x": 16 - swing, "back_y": GROUND - lift_b,
            },
            arms={
                # counter-swing: what makes a walk read as a walk
                "front_x": 21 - swing * 0.7, "front_y": 35,
                "back_x": 11 + swing * 0.7, "back_y": 35,
            },
            sword=80, bob=bob, lean=1,
        ))
    return out


def attack():
    poses = [
        (-125, 12, 27, -1),  # startup: blade back over the shoulder
        (-40, 22, 29, 1),    # active: coming down
        (5, 25, 33, 2),      # active: full extension
        (50, 22, 36, 0),     # recovery
    ]
    return [
        frame(
            legs={"front_x": 19 + ln, "front_y": GROUND, "back_x": 13 + ln, "back_y": GROUND},
            arms={"front_x": hx, "front_y": hy, "back_x": 11 + ln, "back_y": 36},
            sword=ang, lean=ln,
        )
        for ang, hx, hy, ln in poses
    ]


def save_strip(frames, name):
    sheet = Image.new("RGBA", (W * len(frames), H), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        sheet.paste(f, (i * W, 0))
    sheet.save(OUT / name)
    print(f"{name}: {len(frames)} frame(s) -> {sheet.width}x{sheet.height}")


save_strip(idle(), "player-idle.png")
save_strip(walk(), "player-run.png")
save_strip(attack(), "player-attack.png")

preview = idle() + walk() + attack()
scale = 5
sheet = Image.new("RGBA", (W * len(preview) * scale, H * scale), (0x1b, 0x1d, 0x20, 255))
for i, f in enumerate(preview):
    sheet.alpha_composite(f.resize((W * scale, H * scale), Image.NEAREST), (i * W * scale, 0))
sheet.save(Path(__file__).resolve().parent / "_preview.png")
print("preview -> art-src/_preview.png")
