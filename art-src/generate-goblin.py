"""
The goblin — original design, generated pixel by pixel.

    py art-src/generate-goblin.py

Designed against the player rather than beside him. He is upright, sealed and
symmetrical; this thing is hunched, exposed and lopsided, with a heavy head and
spindly limbs. The silhouettes have to be distinguishable at a glance in a game
where you are reading a wind-up in a fraction of a second.

Infected rather than evil, per the fiction — the skin carries the same sickly
green as the virus, and the one salvaged piece of gear is a stolen rebreather
lens over a single eye, cracked and dim.

Output: idle (2), walk (6), wind-up (2), strike (2), stagger (1).
"""
import math
from pathlib import Path
from pixel import Canvas, rgb, save_strip, save_preview

W, H = 48, 96
OUT = Path(__file__).resolve().parent.parent / "public" / "art"
OUT.mkdir(parents=True, exist_ok=True)

P = {
    "skin_hi": rgb(0x7E9152), "skin": rgb(0x5C6C3A), "skin_sh": rgb(0x3F4B26), "skin_dk": rgb(0x252D16),
    "rag_hi": rgb(0x6B4A32), "rag": rgb(0x4A3122), "rag_sh": rgb(0x2F1E14), "rag_dk": rgb(0x1B110B),
    "met_hi": rgb(0xC6CFD8), "met": rgb(0x8B96A2), "met_sh": rgb(0x5C6570), "met_dk": rgb(0x373E46),
    "eye_hi": rgb(0xFFE9A8), "eye": rgb(0xF0A83C), "eye_sh": rgb(0xA96B18),
    "lens": rgb(0x4E8C86), "lens_sh": rgb(0x2B514E),
}

SHADE = {
    P["skin"]: (P["skin_hi"], P["skin_sh"]),
    P["rag"]: (P["rag_hi"], P["rag_sh"]),
    P["met"]: (P["met_hi"], P["met_sh"]),
    P["eye"]: (P["eye_hi"], P["eye_sh"]),
}
OUTLINE = {
    P["skin_hi"]: P["skin_dk"], P["skin"]: P["skin_dk"], P["skin_sh"]: P["skin_dk"],
    P["rag_hi"]: P["rag_dk"], P["rag"]: P["rag_dk"], P["rag_sh"]: P["rag_dk"],
    P["met_hi"]: P["met_dk"], P["met"]: P["met_dk"], P["met_sh"]: P["met_dk"],
    P["eye_hi"]: P["eye_sh"], P["eye"]: P["eye_sh"],
    P["lens"]: P["lens_sh"],
}

# Scaled to loom over the player: he is 82 units of hurtbox, this is 86. A
# goblin that reads as smaller reads as harmless, which it is not.
CX, GROUND, HIP, SHOULDER = 23, 92, 60, 40


def canvas():
    return Canvas(W, H, SHADE, OUTLINE, P["skin_dk"])


def draw_leg(c, hip_x, foot_x, back=False):
    col = P["skin_sh"] if back else P["skin"]
    knee_x = (hip_x + foot_x) / 2 - 2  # knees bow outward
    c.taper(hip_x, HIP, knee_x, (HIP + GROUND) / 2, 9, 7, col)
    c.taper(knee_x, (HIP + GROUND) / 2, foot_x, GROUND - 3, 7, 5, col)
    c.rect(foot_x - 4, GROUND - 2, foot_x + 3, GROUND, P["rag_sh"])  # wrapped foot
    c.rect(foot_x - 4, GROUND - 3, foot_x + 1, GROUND - 3, P["rag"])


def draw_arm(c, sh_x, hand_x, hand_y, back=False, weapon=False):
    col = P["skin_sh"] if back else P["skin"]
    ex, ey = (sh_x + hand_x) / 2, (SHOULDER + hand_y) / 2 + 2
    c.taper(sh_x, SHOULDER, ex, ey, 7, 5, col)
    c.taper(ex, ey, hand_x, hand_y, 5, 4, col)
    c.disc(hand_x, hand_y, 2, P["rag_sh"])
    if weapon:
        # A cleaver: broad, crude, nothing like the player's tapered blade.
        c.taper(hand_x, hand_y, hand_x + 11, hand_y - 5, 3, 3, P["met_sh"])
        c.rect(hand_x + 6, hand_y - 11, hand_x + 15, hand_y - 4, P["met"])
        c.rect(hand_x + 6, hand_y - 11, hand_x + 14, hand_y - 10, P["met_hi"])


def draw_body(c, hunch, bob):
    x = CX + hunch
    y = bob

    # torso: narrow chest, heavy shoulders, leaning with the hunch
    c.taper(CX, HIP + y, x, SHOULDER + y, 17, 20, P["skin"])
    # rag wrap across the middle
    c.rect(x - 7, HIP + y - 9, x + 7, HIP + y - 4, P["rag"])
    c.taper(x - 8, HIP + y - 6, x + 6, SHOULDER + y + 3, 4, 4, P["rag_sh"])
    # ribs, suggested rather than drawn
    for i in range(3):
        c.rect(x + 2, SHOULDER + y + 4 + i * 3, x + 6, SHOULDER + y + 4 + i * 3, P["skin_sh"])


def draw_head(c, hunch, bob, eyes_hot=False):
    # Heavy head carried forward of the shoulders — the opposite of the
    # player's upright, sealed posture.
    x = CX + hunch * 2 + 2
    y = 24 + bob

    c.disc(x, y, 10, P["skin"])
    c.rect(x - 10, y - 4, x - 6, y + 3, P["skin_sh"])   # back of skull
    # ears, deliberately different sizes
    c.taper(x - 7, y - 1, x - 14, y - 6, 5, 1, P["skin_sh"])
    c.taper(x + 6, y, x + 12, y - 3, 4, 1, P["skin_hi"])
    # heavy brow
    c.rect(x - 5, y - 5, x + 6, y - 3, P["skin_sh"])
    c.rect(x - 5, y - 6, x + 5, y - 6, P["skin_hi"])
    # one bare eye, one behind a salvaged lens
    eye = P["eye_hi"] if eyes_hot else P["eye"]
    c.disc(x + 4, y - 1, 1.8, eye)
    c.disc(x - 1, y - 1, 2.6, P["met_sh"])
    c.disc(x - 1, y - 1, 1.7, P["lens"])
    # jaw and teeth
    c.rect(x - 3, y + 4, x + 6, y + 6, P["skin_sh"])
    for tx in (x - 2, x + 1, x + 4):
        c.rect(tx, y + 4, tx, y + 5, P["met_hi"])


def frame(front_foot, back_foot, front_hand, back_hand,
          hunch=2, bob=0, eyes_hot=False, weapon=True):
    c = canvas()
    draw_leg(c, CX - 3, back_foot, back=True)
    draw_arm(c, CX - 5, back_hand[0], back_hand[1] + bob, back=True)
    draw_body(c, hunch, bob)
    draw_head(c, hunch, bob, eyes_hot)
    draw_leg(c, CX + 3, front_foot)
    draw_arm(c, CX + 5, front_hand[0], front_hand[1] + bob, weapon=weapon)
    c.shade()
    c.outline()
    return c.image()


def idle(n=2):
    return [
        frame(CX + 6, CX - 6, (CX + 11, 58 + (i == 1)), (CX - 11, 57), bob=(0, -1)[i])
        for i in range(n)
    ]


def walk(n=6):
    out = []
    for i in range(n):
        p = (i / n) * math.tau
        sw = math.sin(p) * 10
        out.append(frame(
            CX + sw, CX - sw,
            (CX + 10 - sw * 0.4, 59), (CX - 10 + sw * 0.4, 58),
            hunch=3, bob=-1 if math.sin(p * 2) > 0.4 else 0,
        ))
    return out


def windup(n=2):
    """Rears back, cleaver overhead, eyes flaring. Must be unmistakable — the
    entire parry depends on reading this in a fraction of a second."""
    return [
        frame(CX + 9, CX - 8, (CX + 2, 30 - i * 3), (CX - 13, 54),
              hunch=-4, bob=-2 - i, eyes_hot=True)
        for i in range(n)
    ]


def strike(n=2):
    return [
        frame(CX + 11, CX - 5, (CX + 15 + i * 2, 56 + i * 5), (CX - 10, 58),
              hunch=5, bob=i, eyes_hot=True)
        for i in range(n)
    ]


def stagger():
    return [frame(CX - 2, CX - 11, (CX - 6, 62), (CX - 14, 56), hunch=-5, bob=2)]


save_strip(idle(), OUT / "goblin-idle.png", W, H)
save_strip(walk(), OUT / "goblin-walk.png", W, H)
save_strip(windup(), OUT / "goblin-windup.png", W, H)
save_strip(strike(), OUT / "goblin-strike.png", W, H)
save_strip(stagger(), OUT / "goblin-stagger.png", W, H)

save_preview(
    idle() + walk() + windup() + strike() + stagger(),
    Path(__file__).resolve().parent / "_preview-goblin.png", W, H, scale=5,
)
