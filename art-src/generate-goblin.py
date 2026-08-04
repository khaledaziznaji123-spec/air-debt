"""
Generate the goblin: idle, walk cycle, and the wind-up pose.

Shorter and hunched, so it reads as a different silhouette from the player at a
glance rather than as a smaller copy. Palette shares the reference's browns and
darks so it sits in the same world, with a sickly green that is the player's
teal pushed toward rot.

The WIND-UP pose is the one that matters. The whole parry depends on being able
to read it in a fraction of a second, so it is not a subtle variation: the body
rears back, the arm goes fully overhead, and the eyes flare.
"""
import math
from pathlib import Path
from PIL import Image

W, H = 48, 64
OUT = Path(__file__).resolve().parent.parent / "public" / "art"
OUT.mkdir(parents=True, exist_ok=True)

C = {
    "line":    (0x1c, 0x14, 0x12, 255),
    "skin":    (0x5a, 0x6b, 0x3f, 255),
    "skin_l":  (0x6f, 0x82, 0x4d, 255),
    "skin_d":  (0x3d, 0x4a, 0x2b, 255),
    "rag":     (0x4e, 0x2c, 0x20, 255),
    "rag_d":   (0x36, 0x1e, 0x16, 255),
    "leather": (0x67, 0x39, 0x25, 255),
    "eye":     (0xf4, 0xa2, 0x59, 255),
    "eye_hot": (0xff, 0xd9, 0x8a, 255),
    "metal":   (0x8f, 0x98, 0xa4, 255),
    "metal_l": (0xc9, 0xd2, 0xdd, 255),
}


class Canvas:
    def __init__(self, w=W, h=H):
        self.w, self.h, self.px = w, h, [[None] * w for _ in range(h)]

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
        edge = [
            (x, y)
            for y in range(self.h)
            for x in range(self.w)
            if not filled[y][x]
            and any(
                0 <= x + dx < self.w and 0 <= y + dy < self.h and filled[y + dy][x + dx]
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))
            )
        ]
        for x, y in edge:
            self.set(x, y, col)

    def image(self):
        img = Image.new("RGBA", (self.w, self.h), (0, 0, 0, 0))
        for y in range(self.h):
            for x in range(self.w):
                if self.px[y][x]:
                    img.putpixel((x, y), self.px[y][x])
        return img


GROUND = 61
CX = 24


def goblin(front_foot, back_foot, arm_angle, bob=0, hunch=0, eyes_hot=False, weapon=True):
    """hunch leans the torso forward; arm_angle is degrees, -90 is straight up."""
    c = Canvas()
    hip_y = 44 + bob
    sh_y = 32 + bob + hunch
    head_y = 24 + bob + hunch * 2

    # legs — bandy and wide, nothing like the player's stride
    for foot, col in ((back_foot, C["skin_d"]), (front_foot, C["skin"])):
        c.line(CX, hip_y, foot, GROUND - 2, col, thick=4)
        c.rect(foot - 3, GROUND - 2, foot + 3, GROUND, C["rag_d"])

    # torso, leaning with the hunch
    c.line(CX, hip_y, CX + hunch, sh_y, C["skin"], thick=9)
    c.rect(CX - 5 + hunch, sh_y + 2, CX + 5 + hunch, hip_y - 1, C["rag"])
    c.rect(CX - 5 + hunch, sh_y + 2, CX - 3 + hunch, hip_y - 1, C["rag_d"])
    c.rect(CX - 5 + hunch, hip_y - 3, CX + 5 + hunch, hip_y - 2, C["leather"])

    # head: low and forward, ears wide for silhouette
    hx, hy = CX + hunch * 2, head_y
    c.rect(hx - 5, hy - 4, hx + 5, hy + 4, C["skin"])
    c.rect(hx + 3, hy - 4, hx + 5, hy + 4, C["skin_d"])
    c.rect(hx - 8, hy - 3, hx - 6, hy + 1, C["skin_l"])   # ears
    c.rect(hx + 6, hy - 3, hx + 8, hy + 1, C["skin_d"])
    c.rect(hx - 6, hy - 5, hx + 6, hy - 5, C["skin_l"])   # brow
    eye = C["eye_hot"] if eyes_hot else C["eye"]
    c.rect(hx - 3, hy - 2, hx - 2, hy - 1, eye)
    c.rect(hx + 1, hy - 2, hx + 2, hy - 1, eye)
    c.rect(hx - 3, hy + 2, hx + 3, hy + 2, C["skin_d"])   # mouth line

    # arm and cleaver
    a = math.radians(arm_angle)
    sx, sy = CX + hunch + 3, sh_y + 3
    hand_x, hand_y = sx + math.cos(a) * 11, sy + math.sin(a) * 11
    c.line(sx, sy, hand_x, hand_y, C["skin_l"], thick=3)
    if weapon:
        tip_x = hand_x + math.cos(a) * 13
        tip_y = hand_y + math.sin(a) * 13
        c.line(hand_x, hand_y, tip_x, tip_y, C["metal"], thick=3)
        c.line(hand_x, hand_y, tip_x, tip_y, C["metal_l"], thick=1)

    c.outline()
    return c.image()


def idle():
    return [goblin(front_foot=CX + 6, back_foot=CX - 6, arm_angle=55)]


def walk(frames=4):
    out = []
    for i in range(frames):
        p = (i / frames) * math.tau
        swing = math.sin(p) * 7
        out.append(goblin(
            front_foot=CX + swing,
            back_foot=CX - swing,
            arm_angle=55 - math.sin(p) * 18,
            bob=-1 if math.sin(p * 2) > 0.4 else 0,
            hunch=1,
        ))
    return out


def windup():
    # Rears back, arm fully overhead, eyes flaring. Has to be unmistakable in a
    # fraction of a second or the parry is not a fair read (PRD FR-6.1).
    return [goblin(
        front_foot=CX + 8, back_foot=CX - 7, arm_angle=-95,
        bob=-2, hunch=-3, eyes_hot=True,
    )]


def save(frames, name):
    sheet = Image.new("RGBA", (W * len(frames), H), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        sheet.paste(f, (i * W, 0))
    sheet.save(OUT / name)
    print(f"{name}: {len(frames)} frame(s) -> {sheet.width}x{sheet.height}")


save(idle(), "goblin-idle.png")
save(walk(), "goblin-walk.png")
save(windup(), "goblin-windup.png")

preview = idle() + walk() + windup()
s = 5
canvas = Image.new("RGBA", (W * len(preview) * s, H * s), (0x15, 0x16, 0x1a, 255))
for i, f in enumerate(preview):
    canvas.alpha_composite(f.resize((W * s, H * s), Image.NEAREST), (i * W * s, 0))
canvas.save(Path(__file__).resolve().parent / "_preview-goblin.png")
print("preview -> art-src/_preview-goblin.png")
