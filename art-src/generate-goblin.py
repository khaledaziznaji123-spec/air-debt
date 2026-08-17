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
    # Texture tones. The skin is diseased, so it gets three extra values on top
    # of the standard base/highlight/shadow: a liverish blotch, a bright bile
    # pustule, and a dry grey scab. Flat green is what made it read as a blob.
    "blotch": rgb(0x4C5B2C), "bile": rgb(0xA8C25A), "scab": rgb(0x6E6A48),
    # Rust, so the cleaver reads as scavenged rather than issued.
    "rust": rgb(0x7A4A2C), "rust_dk": rgb(0x4B2C19),
    "bone": rgb(0xC9C2A4),
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
    P["blotch"]: P["skin_dk"], P["bile"]: P["skin_dk"], P["scab"]: P["skin_dk"],
    P["rust"]: P["rust_dk"], P["rust_dk"]: P["rust_dk"], P["bone"]: P["rag_dk"],
}

# Scaled to loom over the player: he is 82 units of hurtbox, this is 86. A
# goblin that reads as smaller reads as harmless, which it is not.
CX, GROUND, HIP, SHOULDER = 23, 92, 60, 40


def canvas():
    return Canvas(W, H, SHADE, OUTLINE, P["skin_dk"])


def draw_leg(c, hip_x, foot_x, back=False, lift=0):
    col = P["skin_sh"] if back else P["skin"]
    g = GROUND - lift
    knee_x = (hip_x + foot_x) / 2 - 2  # knees bow outward
    c.taper(hip_x, HIP, knee_x, (HIP + g) / 2, 9, 7, col)
    c.taper(knee_x, (HIP + g) / 2, foot_x, g - 3, 7, 5, col)
    c.rect(foot_x - 4, g - 2, foot_x + 3, g, P["rag_sh"])  # wrapped foot
    c.rect(foot_x - 4, g - 3, foot_x + 1, g - 3, P["rag"])


def draw_cleaver(c, hx, hy):
    """A scavenged, chipped cleaver.

    The player's blade is the only clean steel in the game, so nothing here may
    look manufactured: the haft is a bound stick, the edge has bites taken out
    of it, and the whole thing is more rust than metal. It also has to read as
    a heavy chopping shape rather than a sword, because the wind-up it appears
    in is the pose the parry is timed against.
    """
    # Haft: a stick, wrapped in the same rag as everything else it owns.
    c.taper(hx - 3, hy + 3, hx + 7, hy - 4, 3, 3, P["rag_sh"])
    c.rect(hx, hy - 2, hx + 3, hy + 1, P["rag"])

    # Blade: a wedge that gets DEEPER toward the tip. A cleaver's mass is out
    # at the end — that is what makes the silhouette read as a chopper.
    bx, by = hx + 6, hy - 12
    for i in range(11):
        top = by + 3 - i * 0.2
        bot = by + 7 + i * 0.62
        c.rect(bx + i, top, bx + i, bot, P["met"])
        c.set(bx + i, top, P["met_hi"])          # lit spine
        c.set(bx + i, bot, P["met_sh"])          # edge in shadow
    # Two bites chipped out of the cutting edge.
    for i, depth in ((3, 2), (8, 3)):
        bot = by + 7 + i * 0.62
        for d in range(depth):
            c.set(bx + i, bot - d, None)
    # A rivet where blade meets haft.
    c.set(bx + 1, by + 6, P["bone"])
    # Rust eats the flat of the blade. Scale 1 here, not 2: pitting should be
    # finer than the blotching on skin or the two read as the same material.
    c.mottle(P["met"], P["rust"], 0.18, seed=41, scale=1)
    c.mottle(P["met"], P["rust_dk"], 0.06, seed=42, scale=1)


def draw_arm(c, sh_x, hand_x, hand_y, back=False, weapon=False):
    col = P["skin_sh"] if back else P["skin"]
    ex, ey = (sh_x + hand_x) / 2, (SHOULDER + hand_y) / 2 + 2
    c.taper(sh_x, SHOULDER, ex, ey, 7, 5, col)
    c.taper(ex, ey, hand_x, hand_y, 5, 4, col)
    c.disc(hand_x, hand_y, 2, P["rag_sh"])
    if not back:
        # A single binding on the forearm — asymmetric, because a matched pair
        # reads as equipment and this thing scavenges.
        c.rect(ex, ey + 4, ex + 3, ey + 5, P["rag_sh"])
    if weapon:
        draw_cleaver(c, hand_x, hand_y)


def draw_body(c, hunch, bob):
    x = CX + hunch
    y = bob

    # torso: narrow chest, heavy shoulders, leaning with the hunch
    c.taper(CX, HIP + y, x, SHOULDER + y, 17, 20, P["skin"])

    # Spine ridge — a row of vertebrae pushing through the skin down the back.
    # It gives the hunch somewhere to read from, which a smooth oval never did.
    for i in range(6):
        sy = SHOULDER + y + 1 + i * 4
        c.rect(x - 9 + i * 0.4, sy, x - 8 + i * 0.4, sy + 1, P["skin_hi"])
        c.set(x - 10 + i * 0.4, sy + 1, P["skin_dk"])

    # Ribs on the near side, starved enough to show. Uneven lengths — a tidy
    # ladder reads as a drawn pattern rather than a body.
    for i, w in enumerate((5, 6, 4)):
        ry = SHOULDER + y + 5 + i * 3
        c.rect(x + 1, ry, x + 1 + w, ry, P["skin_sh"])
        c.rect(x + 1, ry - 1, x + w, ry - 1, P["skin_hi"])

    # Rag wrap across the middle, with a torn hem rather than a straight cut.
    c.rect(x - 7, HIP + y - 9, x + 7, HIP + y - 3, P["rag"])
    c.rect(x - 7, HIP + y - 9, x + 5, HIP + y - 8, P["rag_hi"])
    for i, d in enumerate((2, 0, 3, 1, 2, 0, 1)):
        c.rect(x - 7 + i * 2, HIP + y - 2, x - 6 + i * 2, HIP + y - 2 + d, P["rag_sh"])
    # Strap over the shoulder, holding the wrap up. Kept thin: at four pixels
    # it merged with the arm behind it and the whole midsection went to one
    # brown mass, which cost more form than the strap was worth.
    c.taper(x - 7, HIP + y - 7, x + 7, SHOULDER + y + 2, 3, 2, P["rag_sh"])
    c.set(x - 1, (HIP + SHOULDER) / 2 + y, P["bone"])  # a bone toggle

    # Boils. Placed rather than scattered, so they sit in the same spot every
    # frame and read as anatomy instead of noise crawling over the sprite.
    for bx_, by_, r in ((x + 6, SHOULDER + y + 15, 2), (x - 5, HIP + y - 14, 1.6),
                        (x + 3, SHOULDER + y + 1, 1.4)):
        c.disc(bx_, by_, r, P["bile"])
        c.set(bx_, by_ - 1, P["skin_dk"])


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
    # A crack across the salvaged lens — it is stolen and broken, which is the
    # whole story of the piece.
    c.set(x - 2, y - 2, P["met_hi"])
    c.set(x - 1, y - 1, P["met_hi"])
    c.set(x, y, P["met_hi"])

    # jaw and teeth, uneven because nothing about this thing is maintained
    c.rect(x - 3, y + 4, x + 6, y + 6, P["skin_sh"])
    for tx, th in ((x - 2, 2), (x + 1, 1), (x + 4, 2)):
        c.rect(tx, y + 4, tx, y + 3 + th, P["bone"])

    # Warts along the brow and jaw, and a scar over the bare eye.
    for wx, wy in ((x + 8, y - 4), (x - 6, y + 2), (x + 2, y - 8)):
        c.disc(wx, wy, 1.3, P["skin_hi"])
        c.set(wx + 1, wy + 1, P["skin_dk"])
    c.rect(x + 3, y - 5, x + 6, y - 5, P["scab"])


def frame(front_foot, back_foot, front_hand, back_hand,
          hunch=2, bob=0, eyes_hot=False, weapon=True,
          front_lift=0, back_lift=0):
    c = canvas()
    draw_leg(c, CX - 3, back_foot, back=True, lift=back_lift)
    draw_arm(c, CX - 5, back_hand[0], back_hand[1] + bob, back=True)
    draw_body(c, hunch, bob)
    draw_head(c, hunch, bob, eyes_hot)
    draw_leg(c, CX + 3, front_foot, lift=front_lift)
    draw_arm(c, CX + 5, front_hand[0], front_hand[1] + bob, weapon=weapon)
    c.shade()
    # Between shading and outlining: the rim light is already down, so this
    # only breaks up the interior and the lit edge survives. Three passes at
    # different densities, because one uniform speckle is just a second flat
    # colour laid over the first.
    c.mottle(P["skin"], P["blotch"], 0.34, seed=11, scale=2)
    c.mottle(P["skin"], P["skin_sh"], 0.16, seed=12, scale=3)
    c.mottle(P["skin"], P["bile"], 0.04, seed=13, scale=1)
    c.mottle(P["skin_sh"], P["skin_dk"], 0.20, seed=14, scale=2)
    c.mottle(P["rag"], P["rag_sh"], 0.28, seed=21, scale=2)
    c.mottle(P["rag_sh"], P["rag_dk"], 0.22, seed=22, scale=2)
    c.outline()
    return c.image()


# --------------------------------------------------------------- the archer
#
# It has to read as a DIFFERENT CREATURE, not a goblin holding a bow. Sharing
# the body made the two indistinguishable at a glance, which is the one thing
# a second enemy type may not be: the player has to know which fight they are
# in before it starts, because the answers are opposite — close on an archer,
# keep spacing from a goblin.
#
# So: taller and much thinner, hooded so the goblin skull never shows, wrapped
# in dark rags instead of bare green, and carrying a quiver. The only skin left
# is the hands and a slot of face, which is where the corruption shows.

A = {
    # Ashen, not green. The same disease further along.
    "flesh_hi": rgb(0x8C8A76), "flesh": rgb(0x6B6957), "flesh_sh": rgb(0x49483B),
    # The robe. Dark enough that the silhouette is the read.
    "robe_hi": rgb(0x3E3A33), "robe": rgb(0x2B2823), "robe_sh": rgb(0x1B1916),
    "robe_dk": rgb(0x101010),
    # Bindings and the quiver.
    "bind": rgb(0x5A4029), "bind_hi": rgb(0x7A5836),
    # The eyes, and the only warm thing on it.
    "eye": rgb(0xF0A83C), "eye_hi": rgb(0xFFE9A8),
}

ARCHER_SHADE = {
    A["flesh"]: (A["flesh_hi"], A["flesh_sh"]),
    A["robe"]: (A["robe_hi"], A["robe_sh"]),
}
ARCHER_OUTLINE = {
    A["flesh_hi"]: A["flesh_sh"], A["flesh"]: A["flesh_sh"],
    A["robe_hi"]: A["robe_dk"], A["robe"]: A["robe_dk"], A["robe_sh"]: A["robe_dk"],
    A["bind"]: A["robe_dk"], A["bind_hi"]: A["robe_dk"],
    A["eye"]: A["robe_dk"], A["eye_hi"]: A["robe_dk"],
}

# Taller and standing straight, against the goblin's hunch.
A_GROUND, A_HIP, A_SHOULDER, A_HEAD = 92, 56, 30, 14


def archer_canvas():
    return Canvas(W, H, ARCHER_SHADE, ARCHER_OUTLINE, A["robe_dk"])


def draw_quiver(c, x, y):
    """On the back, over the far shoulder. The instant read for 'ranged'."""
    c.taper(x, y, x - 5, y + 26, 9, 7, A["bind"])
    c.taper(x, y, x - 5, y + 26, 3, 2, A["bind_hi"])
    for i, dx in enumerate((-3, 0, 3)):
        c.taper(x + dx, y - 2, x + dx - 2, y - 11 - i * 2, 2, 1, P["rust"])
        c.set(x + dx - 2, y - 12 - i * 2, P["bone"])


def draw_bow(c, hx, hy, draw):
    """A crude recurve. `draw` is 0 at rest and 1 at full pull.

    The string carries the tell: straight down the back of the bow at rest, and
    a sharp V pulled past the shoulder at full draw. That silhouette change is
    what has to survive being read across a room, which is the entire reason
    this enemy is worth having.
    """
    for sign in (-1, 1):
        c.taper(hx, hy, hx + 3, hy + sign * 12, 4, 3, A["bind"])
        c.taper(hx + 3, hy + sign * 12, hx - 1, hy + sign * 21, 3, 2, P["rag_sh"])
    c.rect(hx - 1, hy - 3, hx + 1, hy + 3, A["bind_hi"])

    pull = int(draw * 14)
    for sign in (-1, 1):
        c.taper(hx - 1, hy + sign * 21, hx - 2 - pull, hy, 1, 1, P["bone"])
    if draw > 0.05:
        c.taper(hx - 2 - pull, hy, hx + 16, hy, 2, 1, P["rust"])
        c.taper(hx + 13, hy, hx + 18, hy, 3, 1, P["met_hi"])
        c.taper(hx - 2 - pull, hy - 3, hx + 3 - pull, hy, 1, 1, P["bone"])
        c.taper(hx - 2 - pull, hy + 3, hx + 3 - pull, hy, 1, 1, P["bone"])


def draw_hood(c, x, y, hot):
    """A deep cowl. No skull, no ears — the goblin head is what had to go."""
    c.disc(x, y, 9, A["robe_sh"])
    c.disc(x - 1, y - 1, 8, A["robe"])
    # The peak, drawn back over the crown.
    c.taper(x - 2, y - 7, x - 12, y - 2, 7, 3, A["robe_sh"])
    # Shoulders of the cowl, spreading onto the chest.
    c.taper(x - 9, y + 6, x + 8, y + 7, 8, 7, A["robe_sh"])
    # The face slot, and what is in it.
    c.rect(x - 2, y - 2, x + 7, y + 3, A["robe_dk"])
    c.rect(x + 1, y - 1, x + 3, y + 1, A["flesh_sh"])
    for ex in (x + 2, x + 5):
        c.set(ex, y, A["eye_hi"] if hot else A["eye"])
        c.set(ex, y + 1, A["eye"])


def archer_frame(front_foot, back_foot, hand_y, draw, bob=0, hot=False):
    c = archer_canvas()
    g = A_GROUND

    # Legs: thin, bound, and straight. The goblin bows its knees; this does not.
    for foot, col in ((back_foot, A["robe_sh"]), (front_foot, A["robe"])):
        c.taper(CX, A_HIP + bob, foot, g - 4, 7, 5, col)
        c.rect(foot - 4, g - 3, foot + 3, g, A["bind"])

    draw_quiver(c, CX - 9, A_SHOULDER + bob + 2)

    # A long, narrow robe. Narrow is most of what separates the silhouettes.
    c.taper(CX, A_SHOULDER + bob, CX - 2, A_HIP + 10 + bob, 15, 19, A["robe"])
    c.taper(CX + 2, A_SHOULDER + 2 + bob, CX, A_HIP + 6 + bob, 6, 8, A["robe_hi"])
    for hem in range(-8, 9, 5):
        c.rect(CX + hem - 1, A_HIP + 10 + bob, CX + hem + 1,
               A_HIP + 14 + bob + (hem % 3), A["robe_sh"])
    # A cord at the waist.
    c.rect(CX - 8, A_HIP - 2 + bob, CX + 8, A_HIP + bob, A["bind"])

    draw_hood(c, CX + 1, A_HEAD + bob, hot)

    # The bow arm, held out straight, and the drawing hand at the string.
    c.taper(CX + 5, A_SHOULDER + 4 + bob, CX + 16, hand_y + bob, 6, 4, A["robe"])
    c.disc(CX + 17, hand_y + bob, 2.6, A["flesh"])
    pull = int(draw * 14)
    c.taper(CX + 2, A_SHOULDER + 6 + bob, CX + 17 - 4 - pull, hand_y + bob,
            6, 4, A["robe_sh"])
    c.disc(CX + 17 - 5 - pull, hand_y + bob, 2.4, A["flesh_sh"])

    draw_bow(c, CX + 20, hand_y + bob, draw)

    c.shade()
    c.mottle(A["robe"], A["robe_sh"], 0.22, seed=31, scale=2)
    c.mottle(A["robe_sh"], A["robe_dk"], 0.18, seed=32, scale=2)
    c.mottle(A["flesh"], A["flesh_sh"], 0.24, seed=33, scale=1)
    c.outline()
    return c.image()


def archer_idle(n=2):
    return [archer_frame(CX + 5, CX - 5, 52, 0.0, bob=(0, -1)[i]) for i in range(n)]


def archer_walk(n=6):
    out = []
    for i in range(n):
        sw = [0, 5, 7, 0, -5, -7][i]
        out.append(archer_frame(CX + sw, CX - sw, 52, 0.0, bob=(0, -1)[i % 2]))
    return out


def archer_draw(n=3):
    """Nearly a second of wind-up, and it has to look like one throughout."""
    return [archer_frame(CX + 6, CX - 7, 50, d, hot=(d > 0.5))
            for d in (0.35, 0.72, 1.0)]


def archer_loose(n=2):
    return [
        archer_frame(CX + 7, CX - 8, 50, 0.0, hot=True),
        archer_frame(CX + 6, CX - 7, 53, 0.0),
    ]


def idle(n=2):
    return [
        frame(CX + 6, CX - 6, (CX + 11, 58 + (i == 1)), (CX - 11, 57), bob=(0, -1)[i])
        for i in range(n)
    ]


def walk(n=6):
    """A lurch rather than a stride: it drags one foot and picks the other up
    too high, so it never quite looks like it has done this before."""
    out = []
    for i in range(n):
        p = (i / n) * math.tau
        sw = math.sin(p) * 10
        out.append(frame(
            CX + sw, CX - sw,
            (CX + 10 - sw * 0.4, 59), (CX - 10 + sw * 0.4, 58),
            hunch=3, bob=-1 if math.sin(p * 2) > 0.4 else 0,
            # Uneven on purpose — the near foot lifts, the far one scuffs.
            front_lift=max(0.0, math.sin(p)) * 7,
            back_lift=max(0.0, math.sin(p + math.pi)) * 3,
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

# The corrupt archer — the same stock, the other verb set.
save_strip(archer_idle(), OUT / "archer-idle.png", W, H)
save_strip(archer_walk(), OUT / "archer-walk.png", W, H)
save_strip(archer_draw(), OUT / "archer-draw.png", W, H)
save_strip(archer_loose(), OUT / "archer-loose.png", W, H)

save_preview(
    idle() + walk() + windup() + strike() + stagger()
    + archer_idle() + archer_draw() + archer_loose(),
    Path(__file__).resolve().parent / "_preview-goblin.png", W, H, scale=5,
)
