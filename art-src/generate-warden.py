"""
The Warden — environment 1's mini-boss, generated pixel by pixel.

    py art-src/generate-warden.py

Output: idle (2), wind-up (2), strike (2), slam wind-up (2), slam (2),
        stagger (1) — all 160 x 176.

Designed against the goblin, the way the goblin was designed against the player.
The goblin is hunched, spindly and lopsided; this is the opposite of all three —
squat, enormously wide, and near enough symmetrical that the one asymmetry (the
riders' platforms) is the thing you look at.

Two rules drove every pose:

* THE TWO ATTACKS MUST NOT SHARE A SILHOUETTE. The swing is answered by a parry
  and the slam by a jump, so reading the wrong one is the whole failure mode.
  The swing rears ONE arm up over the shoulder and leans back; the slam raises
  BOTH and squares up. High-and-lopsided against high-and-level, which is
  readable at a glance and at speed.
* IT IS A DOOR. Wide stance, feet planted, weight low, arms long enough to
  cover the ground in front of it. Nothing about it should suggest it will
  chase you — because it will not.

The shoulder platforms are drawn but the riders are NOT: they are two ordinary
archer sprites the renderer places on top, so they die, stagger and draw
independently of whatever the body is doing.
"""
from pathlib import Path
from pixel import Canvas, rgb, save_strip, save_preview

W, H = 160, 176
OUT = Path(__file__).resolve().parent.parent / "public" / "art"
OUT.mkdir(parents=True, exist_ok=True)

# Its own palette, deliberately: the goblin is sick green and the player is cold
# slate, so the boss is neither. Iron and old blood, over the same infected skin
# the fiction gives everything down here.
P = {
    "iron_hi": rgb(0x8A93A0), "iron": rgb(0x5C6572), "iron_sh": rgb(0x3B424D),
    "iron_dk": rgb(0x22272E),
    "skin_hi": rgb(0x7A8A4E), "skin": rgb(0x566337), "skin_sh": rgb(0x394223),
    "skin_dk": rgb(0x212714),
    "hide_hi": rgb(0x7A4B30), "hide": rgb(0x55321E), "hide_sh": rgb(0x371F12),
    "hide_dk": rgb(0x1F1109),
    "brass_hi": rgb(0xE8BC5E), "brass": rgb(0xB08430), "brass_sh": rgb(0x74551A),
    "eye_hi": rgb(0xFFD79A), "eye": rgb(0xE8873C), "eye_sh": rgb(0x8C4712),
    "rust": rgb(0x8A4A26), "rust_dk": rgb(0x4E2814),
}

SHADE = {
    P["iron"]: (P["iron_hi"], P["iron_sh"]),
    P["skin"]: (P["skin_hi"], P["skin_sh"]),
    P["hide"]: (P["hide_hi"], P["hide_sh"]),
    P["brass"]: (P["brass_hi"], P["brass_sh"]),
    P["eye"]: (P["eye_hi"], P["eye_sh"]),
}

OUTLINE = {
    P["iron_hi"]: P["iron_dk"], P["iron"]: P["iron_dk"], P["iron_sh"]: P["iron_dk"],
    P["skin_hi"]: P["skin_dk"], P["skin"]: P["skin_dk"], P["skin_sh"]: P["skin_dk"],
    P["hide_hi"]: P["hide_dk"], P["hide"]: P["hide_dk"], P["hide_sh"]: P["hide_dk"],
    P["brass"]: P["brass_sh"], P["brass_hi"]: P["brass_sh"],
    P["eye"]: P["eye_sh"], P["eye_hi"]: P["eye_sh"],
    P["rust"]: P["rust_dk"],
}

# Anatomy. The hurtbox is 84 x 132; the frame is 160 x 176 so the arms, the
# shoulder platforms and a raised fist all have somewhere to be without being
# hittable.
CX = 80
GROUND = 172
HIP = 108
CHEST = 70
SHOULDER = 58
HEAD = 40


def canvas():
    return Canvas(W, H, SHADE, OUTLINE, P["iron_dk"])


def draw_foot(c, x, y):
    """A slab, not a boot. It is standing on a doorway."""
    c.rect(x - 15, y - 12, x + 15, y - 3, P["iron_sh"])
    c.rect(x - 18, y - 3, x + 18, y + 2, P["iron"])
    c.rect(x - 18, y - 3, x + 12, y - 2, P["iron_hi"])
    for t in range(-14, 15, 7):
        c.rect(x + t, y - 1, x + t + 2, y + 2, P["iron_dk"])


def draw_leg(c, hip_x, foot_x, back=False):
    col = P["hide_sh"] if back else P["hide"]
    knee_y = (HIP + GROUND) / 2 + 6
    c.taper(hip_x, HIP, (hip_x + foot_x) / 2, knee_y, 26, 22, col)
    c.taper((hip_x + foot_x) / 2, knee_y, foot_x, GROUND - 10, 22, 18, col)
    # A strap above the knee, so the leg has a joint rather than a bend.
    c.rect(min(hip_x, foot_x) - 12, knee_y - 4, max(hip_x, foot_x) + 12, knee_y, P["iron_sh"])
    draw_foot(c, foot_x, GROUND)


def draw_arm(c, sh_x, hand_x, hand_y, back=False):
    """One arm, elbow solved rather than guessed at the midpoint."""
    col = P["skin_sh"] if back else P["skin"]
    upper, fore = 34.0, 32.0
    dx, dy = hand_x - sh_x, hand_y - SHOULDER
    import math
    d = max(math.hypot(dx, dy), 0.001)
    ux, uy = dx / d, dy / d
    dc = min(d, upper + fore - 1)
    a = (upper * upper - fore * fore + dc * dc) / (2 * dc)
    h = math.sqrt(max(upper * upper - a * a, 0.0))
    # Elbow outward, away from the body — the pose is a shoulder press, not a
    # tuck, and a tucked elbow on something this wide reads as broken.
    side = 1 if hand_x >= sh_x else -1
    ex = sh_x + ux * a - uy * h * side
    ey = SHOULDER + uy * a + ux * h * side

    c.taper(sh_x, SHOULDER, ex, ey, 28, 22, col)
    c.taper(ex, ey, hand_x, hand_y, 22, 16, col)
    # Banding down the forearm: iron cuffs, so the limb is armoured rather than
    # just big.
    c.taper(ex, ey, (ex + hand_x) / 2, (ey + hand_y) / 2, 20, 18, P["iron_sh"])
    # The fist.
    c.disc(hand_x, hand_y, 13, P["iron"])
    c.disc(hand_x - 3, hand_y - 3, 8, P["iron_hi"])
    for k in (-7, 0, 7):
        c.rect(hand_x + k - 1, hand_y - 12, hand_x + k + 1, hand_y - 8, P["brass"])


def draw_platform(c, side, drop=0):
    """A rider's perch: a bracket bolted to the shoulder."""
    # Forty out, not thirty. The riders are 32-wide archers and at thirty they
    # overlapped each other across the Warden's head — two sprites sharing a
    # torso, which read as one wide enemy rather than as two things to kill.
    x = CX + side * 40
    y = SHOULDER - 16 + drop
    c.rect(x - 16, y, x + 16, y + 7, P["hide"])
    c.rect(x - 16, y, x + 16, y + 1, P["hide_hi"])
    c.rect(x - 14, y + 7, x - 10, y + 16, P["iron_sh"])
    c.rect(x + 10, y + 7, x + 14, y + 16, P["iron_sh"])
    # A rail, so it reads as something you could be strapped to.
    c.rect(x - 17, y - 9, x - 14, y, P["iron"])
    c.rect(x + 14, y - 9, x + 17, y, P["iron"])


def draw_body(c, lean=0, squat=0):
    x = CX + lean
    y = squat

    # Chest: a wedge, widest at the shoulders. Iron over the front, hide behind.
    c.taper(x, SHOULDER + y, x, HIP + y - 6, 74, 56, P["iron"])
    c.taper(x - 4, SHOULDER + y + 4, x - 4, HIP + y - 10, 58, 44, P["iron_sh"])
    c.taper(x + 6, SHOULDER + y + 2, x + 4, HIP + y - 12, 30, 22, P["iron_hi"])

    # Ribs of brass across it, counting down toward the belt.
    for i, ry in enumerate((CHEST - 4, CHEST + 10, CHEST + 24)):
        half = 30 - i * 4
        c.rect(x - half, ry + y, x + half, ry + y + 3, P["brass_sh"])
        c.rect(x - half, ry + y, x + half - 6, ry + y + 1, P["brass"])

    # Belt and hide skirt.
    c.rect(x - 40, HIP + y - 14, x + 40, HIP + y - 2, P["hide"])
    c.rect(x - 40, HIP + y - 14, x + 34, HIP + y - 12, P["hide_hi"])
    c.rect(x - 8, HIP + y - 16, x + 8, HIP + y, P["brass"])
    c.rect(x - 5, HIP + y - 13, x + 5, HIP + y - 4, P["brass_sh"])
    for i, dx in enumerate((-32, -18, -4, 10, 24)):
        depth = (16, 22, 14, 24, 18)[i]
        c.rect(x + dx, HIP + y - 2, x + dx + 10, HIP + y - 2 + depth, P["hide_sh"])

    # The air the thing is not short of: a bank of tanks across its back.
    for i, tx in enumerate((-46, -38, -30)):
        c.rect(x + tx, SHOULDER + y - 4, x + tx + 6, HIP + y - 22, P["iron_sh"])
        c.rect(x + tx, SHOULDER + y - 4, x + tx + 1, HIP + y - 22, P["iron"])
        c.rect(x + tx, SHOULDER + y + 8 + i * 4, x + tx + 6, SHOULDER + y + 10 + i * 4, P["brass_sh"])


def draw_head(c, lean=0, squat=0, hot=False):
    """Small, sunk between the shoulders, and mostly helmet.

    Small on purpose. A big head reads as a character; a small one on a huge
    body reads as a thing that was made rather than born, which is what a
    Warden is.
    """
    x, y = CX + lean + 2, HEAD + squat
    c.disc(x, y, 17, P["iron_sh"])
    c.disc(x + 1, y + 1, 14, P["iron"])
    c.rect(x - 18, y - 4, x + 18, y + 2, P["iron_hi"])   # brow ridge
    c.rect(x - 20, y + 2, x + 20, y + 5, P["iron_sh"])

    # A visor slot rather than eyes, with one lit slit behind it.
    c.rect(x - 13, y + 7, x + 13, y + 13, P["iron_dk"])
    glow = P["eye_hi"] if hot else P["eye"]
    c.rect(x - 10, y + 9, x - 2, y + 11, glow)
    c.rect(x + 3, y + 9, x + 9, y + 11, glow)

    # Tusks of brass on the jaw, off-centre, because nothing here is mirrored.
    c.rect(x - 12, y + 15, x - 8, y + 22, P["brass"])
    c.rect(x + 7, y + 15, x + 10, y + 19, P["brass_sh"])


def frame(front_hand, back_hand, lean=0, squat=0, hot=False,
          stance=(-26, 28), platform_drop=0, shock=0):
    c = canvas()
    back_foot, front_foot = stance

    draw_leg(c, CX - 20 + lean, CX + back_foot, back=True)
    draw_arm(c, CX - 26 + lean, back_hand[0], back_hand[1], back=True)
    draw_platform(c, -1, platform_drop)
    draw_body(c, lean, squat)
    draw_head(c, lean, squat, hot)
    draw_leg(c, CX + 18 + lean, CX + front_foot)
    draw_platform(c, 1, platform_drop)
    draw_arm(c, CX + 26 + lean, front_hand[0], front_hand[1])

    # The shockwave, for the slam's live frames. Drawn as dust ridges along the
    # floor on BOTH sides, because that is exactly what the hitbox does — and a
    # hazard whose drawing disagrees with its box is the one kind of unfair the
    # game cannot afford.
    if shock:
        for i in range(shock):
            spread = 26 + i * 22
            rise = 10 - i * 2
            for side in (-1, 1):
                sx = CX + side * spread
                c.rect(sx - 6, GROUND - rise, sx + 6, GROUND - 1, P["rust"])
                c.rect(sx - 3, GROUND - rise - 3, sx + 3, GROUND - rise, P["brass_sh"])

    c.shade()
    c.outline()
    return c.image()


def idle(n=2):
    """Breathing, barely. The platforms rock a little; the body does not."""
    return [
        frame((CX + 46, 108 + b), (CX - 46, 106 + b), squat=b, platform_drop=b)
        for b in (0, 2)
    ]


def windup(n=2):
    """ONE arm up and back, weight on the rear foot. Answered with a parry."""
    return [
        frame((CX + 40, 44), (CX - 44, 100), lean=-4, squat=2, stance=(-30, 22)),
        frame((CX + 34, 26), (CX - 48, 104), lean=-7, squat=3, stance=(-32, 20), hot=True),
    ]


def strike(n=2):
    """And down through it, arm extended past the body."""
    return [
        frame((CX + 62, 78), (CX - 40, 108), lean=6, squat=0, stance=(-20, 34), hot=True),
        frame((CX + 68, 116), (CX - 34, 110), lean=8, squat=6, stance=(-16, 38)),
    ]


def slam_windup(n=2):
    """BOTH arms up, squared, no lean. Answered with a jump.

    The difference from `windup` is deliberately structural rather than
    decorative: one arm versus two, and leaning back versus standing level. At
    speed those are the only two things anyone actually reads.
    """
    return [
        frame((CX + 44, 40), (CX - 44, 40), squat=-2, stance=(-28, 30)),
        frame((CX + 40, 22), (CX - 40, 22), squat=-4, stance=(-30, 32), hot=True),
    ]


def slam(n=2):
    """Both fists into the floor, and the floor answers."""
    return [
        frame((CX + 36, 150), (CX - 36, 150), squat=14, stance=(-34, 36), hot=True, shock=2),
        frame((CX + 34, 158), (CX - 34, 158), squat=18, stance=(-36, 38), shock=3),
    ]


def stagger(n=1):
    """Parried. Head down, arms loose, weight on the back foot."""
    return [
        frame((CX + 30, 130), (CX - 34, 128), lean=-9, squat=10, stance=(-34, 14)),
    ]


frames = {
    "warden-idle": idle(),
    "warden-windup": windup(),
    "warden-strike": strike(),
    "warden-slam-windup": slam_windup(),
    "warden-slam": slam(),
    "warden-stagger": stagger(),
}
for name, fs in frames.items():
    save_strip(fs, OUT / f"{name}.png", W, H)

allf = [f for fs in frames.values() for f in fs]
save_preview(allf, Path(__file__).resolve().parent / "_preview-warden.png", W, H, scale=2)
