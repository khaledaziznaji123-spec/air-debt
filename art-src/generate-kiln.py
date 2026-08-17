"""
The Kiln — environment 2's mini-boss, generated pixel by pixel.

    py art-src/generate-kiln.py

Designed against the Warden rather than beside it. The Warden is a wall: square,
symmetrical, plated, arms out. This is a furnace on legs — bottom-heavy, leaning,
asymmetrical, with the mass in a belly that is visibly full of fire and a head
that is barely there. You should be able to tell which boss you are looking at
from the silhouette alone at a quarter of the screen.

The read matters more here than on anything else in the game, because its two
attacks are answered in opposite ways:

    rake       one arm hauled back across the body   — parry it
    eruption   both fists driven into the floor      — jump; parry does nothing

So they get separate sheets and deliberately different shapes: the rake is all
horizontal and high, the eruption is all vertical and low. Nothing about them is
shared except the body they are attached to.

Output: idle (4), rake wind-up (3), rake (2), eruption wind-up (3),
eruption (2), stagger (1).
"""
from pathlib import Path
from pixel import Canvas, rgb, save_strip, save_preview

OUT = Path(__file__).resolve().parent.parent / "public" / "art"
OUT.mkdir(parents=True, exist_ok=True)

# 176 x 200 against a 96 x 140 hurtbox. The overhang is arms, the vent hood and
# the heat coming off it — none of which is hittable, and all of which is what
# makes it read as huge.
W, H = 176, 200
CX, GROUND = 88, 196
HIP, SHOULDER = 128, 74

P = {
    "iron_hi": rgb(0x8A93A0), "iron": rgb(0x565E6B), "iron_sh": rgb(0x343A45),
    "iron_dk": rgb(0x1A1E25),
    "rust_hi": rgb(0x8A5533), "rust": rgb(0x5E3620), "rust_sh": rgb(0x3A2013),
    "brass_hi": rgb(0xE3C077), "brass": rgb(0xA8823A), "brass_sh": rgb(0x6B5122),
    # The fire inside it, shared with the lava and the two fire monsters.
    "core_hi": rgb(0xFFF0C0), "core": rgb(0xFFA83C), "core_sh": rgb(0xE0561A),
    "core_dk": rgb(0x8A2A0C),
    "coal_hi": rgb(0x4A3C38), "coal": rgb(0x2C2422), "coal_sh": rgb(0x18120F),
}
SHADE = {
    P["iron"]: (P["iron_hi"], P["iron_sh"]),
    P["rust"]: (P["rust_hi"], P["rust_sh"]),
    P["brass"]: (P["brass_hi"], P["brass_sh"]),
    P["core"]: (P["core_hi"], P["core_sh"]),
    P["coal"]: (P["coal_hi"], P["coal_sh"]),
}
OUTLINE = {
    P["iron_hi"]: P["iron_dk"], P["iron"]: P["iron_dk"], P["iron_sh"]: P["iron_dk"],
    P["rust_hi"]: P["iron_dk"], P["rust"]: P["iron_dk"], P["rust_sh"]: P["iron_dk"],
    P["brass_hi"]: P["brass_sh"], P["brass"]: P["brass_sh"],
    # The fire outlines in fire. Ringed in black it would read as a decal stuck
    # on the front rather than as something burning inside the body.
    P["core_hi"]: P["core"], P["core"]: P["core_sh"], P["core_sh"]: P["core_dk"],
    P["coal_hi"]: P["coal_sh"], P["coal"]: P["coal_sh"],
}


def canvas():
    return Canvas(W, H, SHADE, OUTLINE, P["iron_dk"])


def legs(c, stance=0):
    """Short, wide and planted. It never runs; it leans."""
    for side in (-1, 1):
        hip_x = CX + side * 20
        foot_x = CX + side * (30 + stance)
        c.taper(hip_x, HIP, foot_x - side * 2, (HIP + GROUND) / 2, 24, 20, P["iron_sh"])
        c.taper(foot_x - side * 2, (HIP + GROUND) / 2, foot_x, GROUND - 8, 20, 22, P["iron"])
        # A splayed foot, so the weight reads as going into the floor.
        c.rect(foot_x - 18, GROUND - 10, foot_x + 18, GROUND, P["iron_sh"])
        c.rect(foot_x - 18, GROUND - 10, foot_x + 14, GROUND - 7, P["iron_hi"])
        # Rivets, which are most of what says "made" rather than "grown".
        for k in range(-1, 2):
            c.disc(foot_x + k * 10, GROUND - 5, 1.6, P["brass"])


def belly(c, glow=1.0, crack=0):
    """The furnace. The single biggest shape and the whole silhouette."""
    # The drum.
    c.disc(CX, (SHOULDER + HIP) // 2 + 6, 44, P["iron"])
    c.rect(CX - 44, SHOULDER + 16, CX + 44, HIP + 4, P["iron"])
    # Hooped bands around it.
    for y in (SHOULDER + 22, SHOULDER + 40, HIP - 6):
        c.rect(CX - 46, y, CX + 46, y + 5, P["iron_sh"])
        c.rect(CX - 46, y, CX + 40, y + 2, P["iron_hi"])

    # The grate, and the fire behind it. Off centre, because a furnace door in
    # the middle of a symmetrical drum is a washing machine.
    gx = CX + 6
    gy = (SHOULDER + HIP) // 2 + 4
    c.disc(gx, gy, 26, P["coal_sh"])
    c.disc(gx, gy, 23, P["core_sh"])
    if glow > 0:
        c.disc(gx, gy, int(19 * glow), P["core"])
        c.disc(gx - 4, gy - 4, int(10 * glow), P["core_hi"])
    # Bars across it.
    for n in range(-2, 3):
        c.rect(gx + n * 9 - 1, gy - 24, gx + n * 9 + 2, gy + 24, P["iron_sh"])

    # Splits opening down the drum once it is hurt, so the phase change is
    # visible on the body and not only in the numbers.
    for n in range(crack):
        y = SHOULDER + 20 + n * 22
        c.taper(CX - 40, y, CX - 20, y + 10, 4, 2, P["core"])
        c.taper(CX - 38, y + 2, CX - 22, y + 9, 2, 1, P["core_hi"])


def hood(c, lit=1.0):
    """A vent hood where a head should be. Barely a head at all."""
    c.rect(CX - 20, SHOULDER - 16, CX + 20, SHOULDER + 8, P["iron_sh"])
    c.rect(CX - 20, SHOULDER - 16, CX + 14, SHOULDER - 12, P["iron_hi"])
    # Three chimneys, uneven.
    for n, (dx, tall) in enumerate(((-12, 26), (2, 34), (14, 20))):
        c.rect(CX + dx - 5, SHOULDER - 16 - tall, CX + dx + 5, SHOULDER - 14, P["iron"])
        c.rect(CX + dx - 5, SHOULDER - 16 - tall, CX + dx - 2, SHOULDER - 14, P["iron_hi"])
        if lit > 0:
            # Flame off the stacks, taller on the middle one.
            h = int((6 + n % 2 * 5) * lit)
            c.taper(CX + dx, SHOULDER - 18 - tall, CX + dx, SHOULDER - 18 - tall - h,
                    6, 2, P["core"])
            c.taper(CX + dx, SHOULDER - 18 - tall, CX + dx, SHOULDER - 20 - tall - h // 2,
                    3, 1, P["core_hi"])
    # One eye slit under the hood, lit from inside.
    c.rect(CX - 10, SHOULDER - 6, CX + 12, SHOULDER - 1, P["coal_sh"])
    if lit > 0:
        c.rect(CX - 7, SHOULDER - 5, CX - 1, SHOULDER - 3, P["core_hi"])
        c.rect(CX + 3, SHOULDER - 5, CX + 9, SHOULDER - 3, P["core"])


def arm(c, side, hand_x, hand_y, thick=15):
    """Shoulder to hand, with an elbow that actually bends."""
    sx, sy = CX + side * 40, SHOULDER + 12
    ex, ey = (sx + hand_x) / 2 + side * 10, (sy + hand_y) / 2 + 8
    c.taper(sx, sy, ex, ey, thick + 5, thick, P["iron_sh"])
    c.taper(ex, ey, hand_x, hand_y, thick, thick - 3, P["iron"])
    c.disc(sx, sy, thick + 3, P["iron_hi"])
    # The fist: a lump of rust-welded scrap, not a hand.
    c.disc(hand_x, hand_y, thick - 1, P["rust"])
    c.disc(hand_x - 2, hand_y - 3, thick - 6, P["rust_hi"])


def idle(n):
    c = canvas()
    breathe = (0, 1, 2, 1)[n]
    legs(c)
    belly(c, glow=0.85 + breathe * 0.05)
    arm(c, -1, CX - 58, HIP - 4 + breathe)
    arm(c, 1, CX + 58, HIP - 8 + breathe)
    hood(c, lit=0.7 + breathe * 0.15)
    return c


def rake_wind(n):
    """One arm hauled back across the body, high. All horizontal."""
    c = canvas()
    legs(c, stance=2)
    belly(c, glow=1.0)
    # The off arm drops out of the way, so the reading arm is unmistakable.
    arm(c, -1, CX - 50, HIP + 6)
    pull = (0, 1, 2)[n]
    arm(c, 1, CX - 10 - pull * 14, SHOULDER + 2 - pull * 6, thick=17)
    hood(c, lit=1.0)
    # Heat trailing off the cocked fist, which is the tell.
    for k in range(3 + pull * 2):
        c.disc(CX - 26 - pull * 14 + k * 5, SHOULDER - 6 - pull * 6 - k, 3, P["core"])
    return c


def rake(n):
    """Through, and past. The arm ends up fully extended on the far side."""
    c = canvas()
    legs(c, stance=4)
    belly(c, glow=0.9)
    arm(c, -1, CX - 44, HIP + 10)
    reach = (46, 70)[n]
    arm(c, 1, CX + reach, SHOULDER + 16, thick=16)
    hood(c, lit=0.8)
    # The arc it swept, drawn as a smear of fire rather than a white line.
    for k in range(9):
        f = k / 8
        c.disc(CX - 20 + f * (reach + 26), SHOULDER + 30 - f * 16, 7 - f * 4,
               P["core"] if k % 2 else P["core_hi"])
    return c


def erupt_wind(n):
    """Both fists up and the body coiling down. All vertical."""
    c = canvas()
    lift = (0, 1, 2)[n]
    legs(c, stance=-1)
    belly(c, glow=1.0, crack=lift)
    for side in (-1, 1):
        arm(c, side, CX + side * 46, SHOULDER - 10 - lift * 12, thick=16)
    hood(c, lit=1.0)
    # The floor answering before it lands — the real tell, because the columns
    # come out of the ground and not out of the boss.
    for k in range(2 + lift * 2):
        x = CX + (-1 if k % 2 else 1) * (30 + k * 16)
        c.rect(x - 5, GROUND - 3, x + 5, GROUND, P["core_sh"])
    return c


def erupt(n):
    """Down. Both fists in the floor, body at its lowest."""
    c = canvas()
    legs(c, stance=6)
    belly(c, glow=1.0, crack=3)
    for side in (-1, 1):
        arm(c, side, CX + side * 40, GROUND - 16, thick=17)
    hood(c, lit=0.9)
    # A shock of fire out from under the fists.
    for k in range(10):
        f = k / 9
        for side in (-1, 1):
            c.disc(CX + side * (36 + f * 46), GROUND - 6 - (1 - f) * (10 + n * 6),
                   5 - f * 3, P["core"] if k % 2 else P["core_hi"])
    return c


def stagger():
    c = canvas()
    legs(c, stance=-3)
    # The fire drops right down, which is the only moment it is safe to be near.
    belly(c, glow=0.25, crack=3)
    arm(c, -1, CX - 52, HIP + 16)
    arm(c, 1, CX + 50, HIP + 20)
    hood(c, lit=0.15)
    return c


def main():
    sets = [
        ("kiln-idle", [idle(n) for n in range(4)]),
        ("kiln-rake-windup", [rake_wind(n) for n in range(3)]),
        ("kiln-rake", [rake(n) for n in range(2)]),
        ("kiln-erupt-windup", [erupt_wind(n) for n in range(3)]),
        ("kiln-erupt", [erupt(n) for n in range(2)]),
        ("kiln-stagger", [stagger()]),
    ]
    everything = []
    for name, frames in sets:
        images = []
        for f in frames:
            f.shade()
            f.outline()
            images.append(f.image())
        save_strip(images, OUT / f"{name}.png", W, H)
        everything.extend(images)
    save_preview(
        everything, Path(__file__).resolve().parent / "_preview-kiln.png", W, H, scale=2
    )


if __name__ == "__main__":
    main()
