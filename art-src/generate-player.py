"""
Generate the player character: idle, run cycle, sword attack.

32x64 per frame, drawn pixel by pixel. The design is driven by the fiction —
the player wears an oxygen mask and carries an air tank, because that is the
game's whole premise and the silhouette should say so before anything else does.
"""
import math
from pathlib import Path
from PIL import Image

W, H = 32, 64
OUT = Path(__file__).parent / "player"
OUT.mkdir(parents=True, exist_ok=True)

# Limited palette. Cohesion comes from reusing these and nothing else.
C = {
    "line":     (0x11, 0x15, 0x1c, 255),  # outline, near-black
    "coat":     (0x3c, 0x46, 0x57, 255),
    "coat_d":   (0x28, 0x2f, 0x3c, 255),
    "coat_l":   (0x53, 0x5f, 0x73, 255),
    "mask":     (0x2b, 0x32, 0x42, 255),
    "visor":    (0x4e, 0xcd, 0xc4, 255),  # oxygen teal — the game's accent
    "visor_l":  (0x9b, 0xee, 0xe7, 255),
    "skin":     (0xc9, 0x8d, 0x5e, 255),
    "leather":  (0x6b, 0x45, 0x26, 255),
    "leather_d":(0x46, 0x2c, 0x18, 255),
    "metal":    (0xa8, 0xb2, 0xc0, 255),
    "metal_l":  (0xe4, 0xeb, 0xf4, 255),
    "tank":     (0x77, 0x82, 0x92, 255),
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
        for y in range(int(y0), int(y1) + 1):
            for x in range(int(x0), int(x1) + 1):
                self.set(x, y, col)

    def line(self, x0, y0, x1, y1, col, thick=1):
        steps = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
        for i in range(steps):
            t = i / max(steps - 1, 1)
            x = x0 + (x1 - x0) * t
            y = y0 + (y1 - y0) * t
            if thick == 1:
                self.set(x, y, col)
            else:
                r = thick // 2
                for dy in range(-r, r + 1):
                    for dx in range(-r, r + 1):
                        self.set(x + dx, y + dy, col)

    def disc(self, cx, cy, r, col):
        for y in range(int(cy - r), int(cy + r) + 1):
            for x in range(int(cx - r), int(cx + r) + 1):
                if (x - cx) ** 2 + (y - cy) ** 2 <= r * r + 0.4:
                    self.set(x, y, col)

    def outline(self, col=C["line"]):
        """Trace a dark edge around everything drawn. Reads far better small."""
        filled = [[self.px[y][x] is not None for x in range(self.w)] for y in range(self.h)]
        edges = []
        for y in range(self.h):
            for x in range(self.w):
                if filled[y][x]:
                    continue
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < self.w and 0 <= ny < self.h and filled[ny][nx]:
                        edges.append((x, y))
                        break
        for x, y in edges:
            self.set(x, y, col)

    def image(self):
        img = Image.new("RGBA", (self.w, self.h), (0, 0, 0, 0))
        for y in range(self.h):
            for x in range(self.w):
                if self.px[y][x]:
                    img.putpixel((x, y), self.px[y][x])
        return img


# Anatomy, in pixels from the top of a 64px canvas.
GROUND = 62
HIP_Y = 40
SHOULDER_Y = 25
HEAD_CY = 15


def draw_leg(c, hip_x, foot_x, foot_y, back=False):
    coat = C["coat_d"] if back else C["coat"]
    knee_x = (hip_x + foot_x) / 2
    knee_y = (HIP_Y + foot_y) / 2 - 1
    c.line(hip_x, HIP_Y, knee_x, knee_y, coat, thick=3)
    c.line(knee_x, knee_y, foot_x, foot_y - 2, coat, thick=3)
    # boot
    c.rect(foot_x - 2, foot_y - 2, foot_x + 2, foot_y, C["leather_d"] if back else C["leather"])


def draw_arm(c, sh_x, hand_x, hand_y, back=False):
    # Back arm sits darker than the torso, front arm lighter, so neither is lost
    # against the coat. Contrast, not detail, is what separates limbs this small.
    coat = C["coat_d"] if back else C["leather"]
    elbow_x = (sh_x + hand_x) / 2
    elbow_y = (SHOULDER_Y + hand_y) / 2
    c.line(sh_x, SHOULDER_Y, elbow_x, elbow_y, coat, thick=3)
    c.line(elbow_x, elbow_y, hand_x, hand_y, coat, thick=2)
    c.disc(hand_x, hand_y, 1.2, C["skin"])


def draw_sword(c, hand_x, hand_y, angle_deg, length=15):
    """Blade from the hand, pointing at the given angle. 0 = right, -90 = up."""
    a = math.radians(angle_deg)
    tip_x = hand_x + math.cos(a) * length
    tip_y = hand_y + math.sin(a) * length
    # guard
    gx = hand_x + math.cos(a) * 2
    gy = hand_y + math.sin(a) * 2
    c.line(gx - math.sin(a) * 2, gy + math.cos(a) * 2,
           gx + math.sin(a) * 2, gy - math.cos(a) * 2, C["leather"], thick=1)
    c.line(gx, gy, tip_x, tip_y, C["metal"], thick=2)
    c.line(gx, gy, tip_x, tip_y, C["metal_l"], thick=1)


def draw_body(c, bob=0, lean=0):
    y = bob
    # air tank on the back — the fiction, made visible
    c.rect(9 + lean, SHOULDER_Y - 2 + y, 11 + lean, SHOULDER_Y + 9 + y, C["tank"])
    # torso
    c.rect(12 + lean, SHOULDER_Y - 2 + y, 20 + lean, HIP_Y + y, C["coat"])
    c.rect(12 + lean, SHOULDER_Y - 2 + y, 14 + lean, HIP_Y + y, C["coat_d"])
    c.rect(19 + lean, SHOULDER_Y - 2 + y, 20 + lean, HIP_Y + y, C["coat_l"])
    # belt
    c.rect(12 + lean, HIP_Y - 4 + y, 20 + lean, HIP_Y - 2 + y, C["leather"])
    # Head as a rounded block, not a circle. A disc this small outlines into
    # spikes; flat sides read as a hood and stay clean.
    hx, hy = 16 + lean, HEAD_CY + y
    c.rect(hx - 5, hy - 7, hx + 5, hy + 5, C["coat_d"])   # hood
    c.rect(hx - 6, hy - 5, hx - 6, hy + 3, C["coat_d"])   # hood sides
    c.rect(hx + 6, hy - 5, hx + 6, hy + 3, C["coat_d"])
    c.rect(hx - 4, hy - 6, hx + 4, hy - 6, C["coat"])     # top highlight
    c.rect(hx - 4, hy - 2, hx + 5, hy + 4, C["mask"])     # mask beneath
    # Visor: the brightest thing on the sprite, so the face reads first and
    # facing direction is unmistakable.
    c.rect(hx - 3, hy - 1, hx + 4, hy + 1, C["visor"])
    c.rect(hx - 3, hy - 1, hx + 4, hy - 1, C["visor_l"])
    # breathing hose, tank to mask
    c.line(11 + lean, SHOULDER_Y + 1 + y, 13 + lean, hy + 4, C["leather_d"], thick=1)


def frame(legs, arms, sword, bob=0, lean=0):
    c = Canvas()
    # back limbs first so the front reads on top
    draw_leg(c, 15 + lean, legs["back_x"], legs["back_y"], back=True)
    draw_arm(c, 14 + lean, arms["back_x"], arms["back_y"] + bob, back=True)
    draw_body(c, bob=bob, lean=lean)
    draw_leg(c, 17 + lean, legs["front_x"], legs["front_y"])
    draw_arm(c, 19 + lean, arms["front_x"], arms["front_y"] + bob)
    if sword is not None:
        draw_sword(c, arms["front_x"], arms["front_y"] + bob, sword)
    c.outline()
    return c.image()


def idle():
    return [frame(
        legs={"front_x": 18, "front_y": GROUND, "back_x": 14, "back_y": GROUND},
        arms={"front_x": 21, "front_y": 37, "back_x": 12, "back_y": 36},
        sword=75,  # blade hanging near-vertical at rest
    )]


def run(frames=6):
    out = []
    for i in range(frames):
        p = (i / frames) * math.tau
        swing = math.sin(p) * 8
        lift = max(0.0, math.sin(p)) * 6
        lift_b = max(0.0, math.sin(p + math.pi)) * 6
        # Bob and lean sell the run more than leg positions do.
        bob = -1 if math.sin(p * 2) > 0.5 else 0
        out.append(frame(
            legs={
                "front_x": 16 + swing,
                "front_y": GROUND - lift,
                "back_x": 16 - swing,
                "back_y": GROUND - lift_b,
            },
            arms={
                # Arms counter-swing against the legs, which is what makes a run
                # read as a run rather than a shuffle.
                "front_x": 20 - swing * 0.8,
                "front_y": 35 - abs(swing) * 0.2,
                "back_x": 12 + swing * 0.8,
                "back_y": 35 - abs(swing) * 0.2,
            },
            sword=75,
            bob=bob,
            lean=1,  # leaning forward the whole cycle
        ))
    return out


def attack():
    """Wind-up, two swing frames, recovery — matching the sim's phases."""
    poses = [
        # (sword angle, front hand x, front hand y, lean, bob)
        (-120, 13, 28, -1, 0),   # startup: blade drawn back over the shoulder
        (-35, 21, 30, 1, 0),     # active: coming down
        (10, 24, 34, 2, 0),      # active: full extension
        (45, 21, 36, 0, 0),      # recovery
    ]
    out = []
    for ang, hx, hy, lean, bob in poses:
        out.append(frame(
            legs={"front_x": 19 + lean, "front_y": GROUND, "back_x": 13 + lean, "back_y": GROUND},
            arms={"front_x": hx, "front_y": hy, "back_x": 12 + lean, "back_y": 36},
            sword=ang,
            bob=bob,
            lean=lean,
        ))
    return out


def save_strip(frames, name):
    sheet = Image.new("RGBA", (W * len(frames), H), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        sheet.paste(f, (i * W, 0))
    path = OUT / name
    sheet.save(path)
    print(f"{name}: {len(frames)} frame(s), {sheet.width}x{sheet.height}")
    return path


save_strip(idle(), "player-idle.png")
save_strip(run(), "player-run.png")
save_strip(attack(), "player-attack.png")

# A zoomed contact sheet, so the result can actually be judged.
allf = idle() + run() + attack()
scale = 5
sheet = Image.new("RGBA", (W * len(allf) * scale, H * scale), (0x0b, 0x0e, 0x14, 255))
for i, f in enumerate(allf):
    big = f.resize((W * scale, H * scale), Image.NEAREST)
    sheet.alpha_composite(big, (i * W * scale, 0))
sheet.save(OUT / "_preview.png")
print("preview written")
