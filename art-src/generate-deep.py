"""
Environments 3 and 5, and the boss at the bottom.

    py art-src/generate-deep.py

Five things, drawn against each other rather than one at a time, because what
matters most is that a player can tell them apart in the half second before one
of them reaches. So each has one silhouette rule and keeps to it:

    shark    one long horizontal wedge, no limbs      — reads at any distance
    crab     wide, low, symmetrical, a wall with legs  — the opposite of tall
    lizard   low and long with the head thrust forward — goblin-shaped, sideways
    bee      tiny, round, with a bright abdomen        — the only small thing
    Hollow   tall, thin, hunched, and mostly dark      — the only quiet one

Colour does the rest: the water things are cold, the poison things are acid
green, and the Hollow is nearly black with one lit seam — it is the last thing
you meet and it should not look like it belongs to any environment.

Output:
  shark-swim (4), shark-bite (2)
  crab-idle (2), crab-walk (4), crab-wind (2), crab-strike (2), crab-stagger (1)
  lizard-idle (2), lizard-walk (4), lizard-wind (2), lizard-strike (2),
  lizard-stagger (1)
  bee-hover (4), bee-wind (2), bee-dive (2)
  hollow-idle (4), hollow-sweep-windup (3), hollow-sweep (2),
  hollow-wave-windup (3), hollow-wave (2), hollow-stagger (1)
"""
from pathlib import Path
from pixel import Canvas, rgb, save_strip, save_preview

OUT = Path(__file__).resolve().parent.parent / "public" / "art"
OUT.mkdir(parents=True, exist_ok=True)

P = {
    # The water: cold greys and a green-blue, so a shark reads as part of the
    # pool it is in rather than as a sticker on top of it.
    "sea_hi": rgb(0x7FA8B8), "sea": rgb(0x46707F), "sea_sh": rgb(0x2A4956),
    "sea_dk": rgb(0x152A33),
    "belly_hi": rgb(0xE2ECEF), "belly": rgb(0xB4C6CC), "belly_sh": rgb(0x7E9199),
    "shell_hi": rgb(0xD98A5A), "shell": rgb(0xA85C34), "shell_sh": rgb(0x6E381D),
    "shell_dk": rgb(0x3D1D0F),
    # The poison: acid green with a sickly yellow highlight.
    "bile_hi": rgb(0xCFF06A), "bile": rgb(0x86B32E), "bile_sh": rgb(0x4E6B18),
    "bile_dk": rgb(0x28390B),
    "chitin_hi": rgb(0x6B5B33), "chitin": rgb(0x40361D), "chitin_sh": rgb(0x241D0F),
    "amber_hi": rgb(0xFFD98A), "amber": rgb(0xE0A32C), "amber_sh": rgb(0x8F6212),
    # The Hollow: almost nothing, and one light inside it.
    #
    # Opened out from four values inside 0x05..0x2E. That range was invisible on
    # a dungeon floor already drawn in near-black: the body, its shading and its
    # haze were all the same colour as the room, so the thing had no edge, no
    # depth and no smoke — it read as a hole cut in the screen. The mass is
    # blacker than the room now and the fringe is lighter than it, which is what
    # gives a shadow a silhouette without giving it an outline.
    "void_hi": rgb(0x4A4660), "void": rgb(0x2A2738), "void_sh": rgb(0x151320),
    "void_dk": rgb(0x030308),
    "seam_hi": rgb(0xEDFFFB), "seam": rgb(0x7FE8DC), "seam_sh": rgb(0x2F8C82),
    "bone_hi": rgb(0xE6DFC8), "bone": rgb(0xB3A98C), "bone_sh": rgb(0x6E664F),
}

SHADE = {
    P["sea"]: (P["sea_hi"], P["sea_sh"]),
    P["belly"]: (P["belly_hi"], P["belly_sh"]),
    P["shell"]: (P["shell_hi"], P["shell_sh"]),
    P["bile"]: (P["bile_hi"], P["bile_sh"]),
    P["chitin"]: (P["chitin_hi"], P["chitin_sh"]),
    P["amber"]: (P["amber_hi"], P["amber_sh"]),
    P["void"]: (P["void_hi"], P["void_sh"]),
    P["bone"]: (P["bone_hi"], P["bone_sh"]),
}
OUTLINE = {
    P["sea_hi"]: P["sea_dk"], P["sea"]: P["sea_dk"], P["sea_sh"]: P["sea_dk"],
    P["belly_hi"]: P["sea_sh"], P["belly"]: P["sea_sh"], P["belly_sh"]: P["sea_dk"],
    P["shell_hi"]: P["shell_dk"], P["shell"]: P["shell_dk"], P["shell_sh"]: P["shell_dk"],
    P["bile_hi"]: P["bile_dk"], P["bile"]: P["bile_dk"], P["bile_sh"]: P["bile_dk"],
    P["chitin_hi"]: P["void_dk"], P["chitin"]: P["void_dk"], P["chitin_sh"]: P["void_dk"],
    P["amber_hi"]: P["chitin_sh"], P["amber"]: P["chitin_sh"],
    P["void_hi"]: P["void_dk"], P["void"]: P["void_dk"], P["void_sh"]: P["void_dk"],
    # The seam glows, so it outlines in itself rather than in black.
    P["seam_hi"]: P["seam"], P["seam"]: P["seam_sh"], P["seam_sh"]: P["void_dk"],
    P["bone_hi"]: P["bone_sh"], P["bone"]: P["bone_sh"],
}


def finish(frames, name, w, h):
    images = []
    for f in frames:
        f.shade()
        f.outline()
        images.append(f.image())
    save_strip(images, OUT / f"{name}.png", w, h)
    return images


# ===========================================================================
# The shark. 128 x 64 against a 96 x 44 hurtbox — the overhang is tail and
# snout, neither of which is hittable.
# ===========================================================================
SW, SH = 128, 64
SCX, SCY = 64, 32


def shark_body(c, bend):
    """`bend` is -1..1: how far the tail is thrown over."""
    # One wedge, nose to tail, and nothing else. A shark with fins picked out
    # in detail stops reading as a shape at forty pixels.
    c.taper(SCX - 44, SCY + bend * 3, SCX + 30, SCY, 10, 22, P["sea"])
    c.taper(SCX + 30, SCY, SCX + 52, SCY - 2, 22, 6, P["sea"])
    # The pale underside, which is what makes it read as an animal.
    c.taper(SCX - 30, SCY + 8, SCX + 44, SCY + 6, 6, 10, P["belly"])
    # Dorsal, and the tail thrown the other way from the body.
    c.taper(SCX + 4, SCY - 10, SCX - 2, SCY - 26, 12, 3, P["sea_sh"])
    c.taper(SCX - 40, SCY + bend * 4, SCX - 58, SCY + bend * 16, 8, 3, P["sea_sh"])
    c.taper(SCX - 40, SCY + bend * 4, SCX - 56, SCY - 12 + bend * 10, 7, 3, P["sea_sh"])
    # A pectoral fin, low and forward.
    c.taper(SCX + 12, SCY + 10, SCX - 4, SCY + 24, 9, 3, P["sea_sh"])
    # The eye: one dark pixel with a lit rim, which is all it needs.
    c.set(SCX + 34, SCY - 5, P["sea_dk"])
    c.set(SCX + 35, SCY - 6, P["belly_hi"])


def shark_swim(n):
    c = Canvas(SW, SH, SHADE, OUTLINE, P["sea_dk"])
    shark_body(c, (0, 1, 0, -1)[n])
    return c


def shark_bite(n):
    c = Canvas(SW, SH, SHADE, OUTLINE, P["sea_dk"])
    shark_body(c, -0.4)
    # The jaw drops open at the front. Teeth as a row of notches rather than
    # as drawn triangles — at this size a triangle is a smudge.
    gap = 6 + n * 5
    c.taper(SCX + 30, SCY + 4, SCX + 52, SCY + 4 + gap, 14, 5, P["sea_sh"])
    for k in range(5):
        c.set(SCX + 36 + k * 4, SCY + 2, P["belly_hi"])
        c.set(SCX + 36 + k * 4, SCY + 5 + gap // 2, P["belly_hi"])
    return c


# ===========================================================================
# The crab. 80 x 64 against 56 x 46. Wide, low and symmetrical: the opposite
# silhouette to everything else in the game, which is the whole point of it.
# ===========================================================================
CW, CH = 80, 64
CCX, CGROUND = 40, 60


def crab_body(c, lift=0, claw=0):
    # Legs first, so the shell overlaps them.
    for side in (-1, 1):
        for n in range(3):
            hip = CCX + side * 12
            foot = CCX + side * (24 + n * 8)
            c.taper(hip, CGROUND - 22, foot, CGROUND - 4 - (lift if n == 1 else 0),
                    4, 2, P["shell_sh"])
    # The shell: a broad dome, wider than it is tall.
    c.disc(CCX, CGROUND - 26, 22, P["shell"])
    c.rect(CCX - 24, CGROUND - 26, CCX + 24, CGROUND - 14, P["shell"])
    c.rect(CCX - 24, CGROUND - 30, CCX + 18, CGROUND - 26, P["shell_hi"])
    # Two eyes on stalks, because a wall with legs needs somewhere to look.
    for side in (-1, 1):
        c.rect(CCX + side * 8 - 1, CGROUND - 44, CCX + side * 8 + 1, CGROUND - 34, P["shell_sh"])
        c.disc(CCX + side * 8, CGROUND - 46, 3, P["amber"])
        c.set(CCX + side * 8 - 1, CGROUND - 47, P["amber_hi"])
    # The claw, held out front and opening as it winds up.
    cx = CCX + 26 + claw * 6
    c.taper(CCX + 16, CGROUND - 26, cx, CGROUND - 30, 7, 5, P["shell_sh"])
    c.disc(cx, CGROUND - 32, 8, P["shell_hi"])
    c.taper(cx, CGROUND - 36 - claw * 3, cx + 12, CGROUND - 40 - claw * 6, 6, 3, P["shell"])
    c.taper(cx, CGROUND - 28 + claw * 2, cx + 12, CGROUND - 26 + claw * 5, 6, 3, P["shell"])


def crab_idle(n):
    c = Canvas(CW, CH, SHADE, OUTLINE, P["shell_dk"])
    crab_body(c, lift=n)
    return c


def crab_walk(n):
    c = Canvas(CW, CH, SHADE, OUTLINE, P["shell_dk"])
    crab_body(c, lift=(0, 2, 0, 2)[n])
    return c


def crab_wind(n):
    c = Canvas(CW, CH, SHADE, OUTLINE, P["shell_dk"])
    crab_body(c, claw=1 + n)
    return c


def crab_strike(n):
    c = Canvas(CW, CH, SHADE, OUTLINE, P["shell_dk"])
    crab_body(c, claw=0)
    # The snap: a bright arc where the claw closed.
    for k in range(6):
        c.set(CCX + 34 + k * 2, CGROUND - 34 + (k - 3) * (2 + n), P["amber_hi"])
    return c


def crab_stagger():
    c = Canvas(CW, CH, SHADE, OUTLINE, P["shell_dk"])
    crab_body(c, lift=-2, claw=0)
    c.mottle(P["shell"], P["shell_sh"], 0.4, seed=9)
    return c


# ===========================================================================
# The lizard. 72 x 56 against 60 x 52. Low and long, head thrust forward.
# ===========================================================================
LW, LH = 72, 56
LCX, LGROUND = 36, 52


def lizard_body(c, stride=0, gape=0):
    for side, col in ((-1, P["bile_sh"]), (1, P["bile"])):
        foot = LCX + side * (10 + stride)
        c.taper(LCX + side * 6, LGROUND - 16, foot, LGROUND - 2, 5, 3, col)
    # Body: a long low tube with the tail trailing behind.
    c.taper(LCX - 26, LGROUND - 14, LCX + 14, LGROUND - 20, 8, 14, P["bile"])
    c.taper(LCX - 26, LGROUND - 14, LCX - 44, LGROUND - 8, 8, 2, P["bile_sh"])
    # A ridge of spines, which is most of what says "do not touch this".
    for k in range(6):
        x = LCX - 18 + k * 6
        c.taper(x, LGROUND - 26, x + 1, LGROUND - 34 - (k % 2) * 3, 4, 1, P["bile_hi"])
    # Head, forward and low, with the jaw opening on the wind-up.
    c.taper(LCX + 14, LGROUND - 22, LCX + 30, LGROUND - 20, 13, 8, P["bile_hi"])
    c.taper(LCX + 26, LGROUND - 18 + gape, LCX + 34, LGROUND - 16 + gape * 2, 6, 3, P["bile_sh"])
    c.set(LCX + 24, LGROUND - 25, P["amber"])
    c.set(LCX + 25, LGROUND - 25, P["amber_hi"])
    if gape:
        # Something dripping off it, so the poison is visible before it lands.
        for k in range(gape + 1):
            c.set(LCX + 30 + k * 2, LGROUND - 12 + k * 3, P["bile_hi"])


def lizard_idle(n):
    c = Canvas(LW, LH, SHADE, OUTLINE, P["bile_dk"])
    lizard_body(c, stride=n)
    return c


def lizard_walk(n):
    c = Canvas(LW, LH, SHADE, OUTLINE, P["bile_dk"])
    lizard_body(c, stride=(0, 3, 6, 3)[n])
    return c


def lizard_wind(n):
    c = Canvas(LW, LH, SHADE, OUTLINE, P["bile_dk"])
    lizard_body(c, stride=-2, gape=1 + n)
    return c


def lizard_strike(n):
    c = Canvas(LW, LH, SHADE, OUTLINE, P["bile_dk"])
    lizard_body(c, stride=8, gape=3 - n)
    return c


def lizard_stagger():
    c = Canvas(LW, LH, SHADE, OUTLINE, P["bile_dk"])
    lizard_body(c, stride=-4)
    c.mottle(P["bile"], P["bile_sh"], 0.45, seed=4)
    return c


# ===========================================================================
# The bee. 48 x 40 against 34 x 30 — the only small thing in the game, and it
# is small on purpose: two bars of damage arriving in something you can barely
# see is the whole of its character.
# ===========================================================================
BW, BH = 48, 40
BCX, BCY = 24, 20


def bee_body(c, wing, tuck=0):
    # Abdomen: banded, bright, and pointed at the end that matters.
    c.disc(BCX - 4, BCY + 2, 9, P["chitin"])
    for k in range(3):
        c.rect(BCX - 10 + k * 5, BCY - 5, BCX - 8 + k * 5, BCY + 9, P["amber"])
    c.taper(BCX - 12, BCY + 4, BCX - 22, BCY + 8 + tuck, 6, 1, P["amber_hi"])
    # Thorax and head, forward.
    c.disc(BCX + 7, BCY - 1, 7, P["chitin_hi"])
    c.disc(BCX + 15, BCY - 2, 5, P["chitin"])
    c.set(BCX + 17, BCY - 4, P["amber_hi"])
    # The sting, out front when it dives.
    if tuck:
        c.taper(BCX + 19, BCY - 1, BCX + 30, BCY + 1, 3, 1, P["bile_hi"])
    # Wings: two blurred ovals, higher or lower with the beat.
    for side in (-1, 1):
        c.disc(BCX + 2, BCY - 12 - wing * 2 + side, 7, P["belly"])


def bee_hover(n):
    c = Canvas(BW, BH, SHADE, OUTLINE, P["chitin_sh"])
    bee_body(c, wing=(0, 1, 2, 1)[n])
    return c


def bee_wind(n):
    c = Canvas(BW, BH, SHADE, OUTLINE, P["chitin_sh"])
    bee_body(c, wing=2, tuck=n)
    # It rears back before it goes, which is the read.
    for k in range(2 + n):
        c.set(BCX - 20 - k * 2, BCY + 10, P["amber"])
    return c


def bee_dive(n):
    c = Canvas(BW, BH, SHADE, OUTLINE, P["chitin_sh"])
    bee_body(c, wing=0, tuck=2 + n)
    for k in range(5):
        c.set(BCX - 16 - k * 3, BCY + 2 - k, P["belly_sh"])
    return c


# ===========================================================================
# The Hollow. 320 x 360 against a 210 x 270 hurtbox.
#
# It was tall, thin and hunched — which was a fine monster and the wrong one.
# A final boss in a room of its own has to be the biggest thing the player has
# ever stood next to, and thin reads as fast; this has to read as heavy.
#
# So: enormous across the shoulders, a chest like a door, arms that reach the
# floor without bending, and legs too short for any of it. Nothing about the
# silhouette should suggest it can catch you. Everything about it should suggest
# that being anywhere near it is the mistake.
#
# And it is made of SHADOW rather than painted dark. Three things do that work,
# and none of them is the colour:
#   * the edges are ragged and they change every frame, so it never holds a
#     shape long enough to read as a solid object
#   * it frays out at the bottom — the legs go into the floor rather than
#     standing on it
#   * there is one light inside it, seen THROUGH the body, which is what makes
#     the body read as something you are looking into rather than at
# ===========================================================================
HW, HH = 320, 360
HCX, HGROUND = 160, 352
HHIP, HSHO = 232, 96


def hnoise(n):
    """Repeatable per-frame jitter. Integer arithmetic, like everything else in
    this file — the art has to be the same on every machine that builds it."""
    n = (n * 1103515245 + 12345) & 0x7FFFFFFF
    return ((n >> 16) & 0xFFFF) / 65535.0


def hollow_canvas():
    return Canvas(HW, HH, SHADE, OUTLINE, P["void_dk"])


def hollow_haze(c, seed, spread=1.0):
    """The ragged edge, redrawn per frame from `seed`.

    The silhouette is never the same twice, so the eye never settles on an
    outline — which is most of the difference between a dark shape and a shadow.
    """
    for k in range(96):
        n = hnoise(seed * 31 + k * 7)
        m = hnoise(seed * 17 + k * 13)
        # Dense at the shoulders, thin at the feet: it is standing IN smoke
        # rather than wearing it.
        f = k / 58
        # Hugging the silhouette rather than filling a box: pushed OUT from the
        # centre line so the smoke gathers along the edges, which is where a
        # shadow frays. Filling the middle just drew a grey rectangle behind a
        # black one.
        side = -1 if m < 0.5 else 1
        out = 70 + int(abs(m - 0.5) * 2 * 130 * spread)
        x = HCX + side * out
        y = HSHO - 54 + int(f * 330)
        r = int(6 + n * 18 * (1 - f * 0.4))
        # Lighter than the mass, not darker. The fringe is what you SEE of a
        # shadow — the body itself is the part that is simply absent.
        c.disc(x, y, r, P["void_hi"] if n > 0.66 else P["void"])


def hollow_body(c, stoop=0, seam=1.0, squat=0):
    """The mass. `stoop` leans it, `squat` drops it toward the floor."""
    top = HSHO + squat

    # Legs: short, thick, and buried. No feet — the mass simply stops being
    # solid before it reaches the ground, which is the cheapest way to say a
    # thing is not standing on the floor so much as coming out of it.
    for side, col in ((-1, P["void_dk"]), (1, P["void_sh"])):
        hip = HCX + side * 40
        c.taper(hip, HHIP + squat, hip + side * 12, HGROUND - 26, 62, 46, col)
        for k in range(7):
            n = hnoise(side * 91 + k * 29)
            c.disc(hip + side * 14 + int((n - 0.5) * 40), HGROUND - 20 + k * 3,
                   int(20 - k * 2), P["void"] if k % 2 else P["void_sh"])

    # Chest: a door. Widest at the shoulders and barely tapering — taper is what
    # made the old one read as a person.
    c.taper(HCX - stoop, top, HCX + stoop, HHIP + squat, 168, 120, P["void_sh"])
    c.taper(HCX - stoop, top + 8, HCX + stoop, HHIP + squat - 20, 140, 96,
            P["void_dk"])

    # The light inside it, seen THROUGH the body. A core with a bloom around it
    # rather than the bright line it used to have: a line on a dark shape reads
    # as a decal, and a glow reads as depth.
    if seam > 0:
        cy = (top + HHIP + squat) // 2
        # A TEAR, not a lens. A clean disc of light on a dark chest reads as a
        # component — a reactor, a gem, something installed — and the whole
        # figure went with it: symmetric shoulders plus a round glowing core is
        # a robot however black you paint it.
        #
        # So it is a ragged vertical split with the light coming through it,
        # widest a third of the way down and never the same twice.
        for k in range(26):
            f = k / 25
            # Narrow. A wide split is a hole and a hole is a shape; what is
            # wanted is a crack you can see light through.
            wide = int((2 + 7 * (1 - abs(f - 0.34) * 2.2)) * seam)
            if wide < 1:
                continue
            jag = int((hnoise(k * 37) - 0.5) * 7)
            y = top + 24 + int(f * (HHIP + squat - top - 44))
            c.rect(HCX - wide + jag, y, HCX + wide + jag, y + 3, P["seam_sh"])
            if wide > 5:
                c.rect(HCX - wide // 2 + jag, y, HCX + wide // 2 + jag, y + 3,
                       P["seam"])
            if wide > 10:
                c.rect(HCX - 2 + jag, y, HCX + 2 + jag, y + 3, P["seam_hi"])
        # There is no bloom around it, and there were two attempts at one.
        # Concentric discs got filled in by the shading pass and a scatter of
        # dots got welded together by the outline pass — both put a clean teal
        # circle back on the chest, which is the exact shape the tear exists to
        # avoid. Anything soft drawn in this palette comes out hard. So: the
        # split, and nothing else.

    # Shoulders: two masses ABOVE the chest line. This is the single thing that
    # sells bulk at a glance — a silhouette whose widest point is its shoulders
    # is a heavy thing, one whose widest point is its waist is a fat thing.
    # Asymmetric, and deliberately so. Two matched pauldrons is armour, and
    # armour is a thing somebody MADE — the moment this had a left that matched
    # its right it stopped being a shadow and started being a suit.
    #
    # The right shoulder is bigger and rides higher, the left is dropped and
    # torn. Nothing else about the pose changes.
    for side, lift, size in ((-1, 14, 40), (1, -6, 52)):
        # The shoulder catches what little light there is; everything under it
        # does not. One lit edge along the top is what gives a black mass a
        # direction and stops it reading as a cut-out.
        c.disc(HCX + side * 84, top + 10 + lift, size, P["void_sh"])
        c.disc(HCX + side * 84, top + 6 + lift, size - 2, P["void_dk"])
        c.disc(HCX + side * 86, top - 4 + lift, size - 16, P["void"])
        c.disc(HCX + side * 86, top + 2 + lift, size - 16, P["void_dk"])
        # Torn edges coming off the top of each, different on each side.
        for k in range(6):
            n = hnoise(side * 71 + k * 19)
            c.disc(HCX + side * (60 + k * 12),
                   top + lift - 20 - int(n * 26),
                   int(4 + n * 8), P["void"] if n > 0.5 else P["void_sh"])

    # A head far too small for it, sunk between them. Small heads read as big
    # bodies; it is the oldest trick there is.
    c.disc(HCX, top - 14, 30, P["void"])
    c.disc(HCX, top - 10, 26, P["void_dk"])
    # No face. Pale marks where one would be, and they are not eyes: there are
    # too many of them and they do not line up.
    for k in range(7):
        n = hnoise(k * 53)
        c.set(HCX - 18 + k * 6, top - 22 + int(n * 6), P["bone"])
        if n > 0.6:
            c.set(HCX - 18 + k * 6, top - 21 + int(n * 6), P["bone_sh"])


def hollow_arm(c, side, hand_x, hand_y, thick=44):
    """One arm — thick enough to be a leg, hanging off the shoulder mass."""
    sx, sy = HCX + side * 84, HSHO + 16
    ex, ey = (sx + hand_x) / 2 + side * 22, (sy + hand_y) / 2 + 18
    c.taper(sx, sy, ex, ey, thick + 8, thick, P["void_sh"])
    c.taper(ex, ey, hand_x, hand_y, thick, thick - 12, P["void_dk"])
    # A knot, not fingers. Fingers on something this size read as a glove; what
    # is wanted is a fist you could not get out from under.
    c.disc(hand_x, hand_y, int(thick * 0.5), P["void_dk"])
    c.disc(hand_x - side * 4, hand_y - 8, int(thick * 0.3), P["void_sh"])
    for k in range(-1, 2):
        c.disc(hand_x + side * 14, hand_y + k * 13, 7, P["bone_sh"])


# ---------------------------------------------------------------------------
# The Hollow's animation.
#
# Every pose below is a function of PROGRESS — a float from 0 to 1 — rather than
# of a frame index, and the frame counts are declared once at the bottom. That
# is the whole reason this was rewritten: the first version keyed each pose off
# `n` with hardcoded tuples like `(40, 120, 210)[n]`, so "make it smoother" was
# not a number you could change, it was a rewrite of nine functions.
#
# It also lets the timing be shaped rather than linear. A wind-up that moves at
# a constant rate reads as a machine; every telegraph here accelerates into its
# strike and every recovery decays out of it, which is what makes two hundred
# and seventy units of monster feel like it has weight.
# ---------------------------------------------------------------------------


def ease_in(f):
    """Slow, then fast. For wind-ups: the tell hangs, then commits."""
    return f * f * f


def ease_out(f):
    """Fast, then slow. For strikes and recoveries: the blow lands, then rests."""
    return 1 - (1 - f) ** 3


def ease_both(f):
    return f * f * (3 - 2 * f)


def hollow_idle(f):
    c = hollow_canvas()
    # Two overlapping cycles at different rates, so the loop never has an
    # obvious seam. A single sine on an eight-frame loop reads as a metronome.
    import math
    breathe = 3 + 3 * math.sin(f * 2 * math.pi)
    drift = 2 * math.sin(f * 2 * math.pi * 2 + 1.1)
    hollow_haze(c, 10 + int(f * 64), spread=1.0 + drift * 0.04)
    hollow_body(c, stoop=int(breathe * 0.6), seam=0.74 + breathe * 0.03,
                squat=int(breathe))
    hollow_arm(c, -1, HCX - 128 - int(drift * 3), HHIP + 44 + int(breathe))
    hollow_arm(c, 1, HCX + 128 + int(drift * 3), HHIP + 38 + int(breathe))
    # Embers coming off it even at rest, drifting up. It is the cheapest way to
    # say a thing is not inert while it is standing still.
    for k in range(9):
        n = hnoise(k * 47)
        rise = (f + n) % 1.0
        c.disc(HCX + int((n - 0.5) * 240),
               HGROUND - 30 - int(rise * 250),
               max(1, int(4 - rise * 3)),
               P["seam_sh"] if n > 0.5 else P["void_hi"])
    return c


def hollow_sweep_wind(f):
    """One arm hauled across the body. Horizontal, and parryable.

    Accelerating: it hangs at the top of the wind for most of the frames and
    then goes, which is what makes a one-second telegraph readable rather than
    merely long.
    """
    c = hollow_canvas()
    g = ease_in(f)
    hollow_haze(c, 30 + int(f * 64), spread=1.0 + g * 0.2)
    hollow_body(c, stoop=-int(g * 6), seam=0.9 + g * 0.1, squat=-int(g * 4))
    hollow_arm(c, -1, HCX - 110, HHIP + 50)
    hollow_arm(c, 1, HCX - 40 - int(g * 90), HSHO + 10 - int(g * 48), thick=48)
    # Light gathering in the hand, and more of it the closer the strike is.
    for k in range(2 + int(g * 12)):
        n = hnoise(k * 29 + int(f * 100))
        c.disc(HCX - 60 - int(g * 90) + int((n - 0.5) * 40),
               HSHO - int(g * 48) + int((n - 0.5) * 40),
               max(1, int(2 + n * 5)),
               P["seam_hi"] if n > 0.7 else P["seam"])
    return c


def hollow_sweep(f):
    """The arm coming across. Five frames of arc rather than two of pose."""
    c = hollow_canvas()
    g = ease_out(f)
    hollow_haze(c, 50 + int(f * 64), spread=1.2)
    hollow_body(c, stoop=int(2 + g * 6), seam=0.95 - g * 0.15, squat=int(g * 4))
    hollow_arm(c, -1, HCX - 96, HHIP + 56)
    reach = int(-30 + g * 220)
    hollow_arm(c, 1, HCX + reach, HSHO + 60 + int(g * 30), thick=46)
    # The arc, drawn as a TRAIL behind the hand rather than as a line in front
    # of it: the eye follows the leading edge and the tail says where it has
    # been, which is the difference between a swing and a laser.
    for k in range(18):
        t = k / 17
        # Only the part of the arc already swept.
        if t > g:
            continue
        fade = t / max(g, 0.001)
        ang = -0.9 + t * 1.9
        import math
        r = 210
        px = HCX - 30 + int(math.cos(ang) * r * 0.85)
        py = HSHO + 70 + int(math.sin(ang) * r * 0.35)
        c.disc(px, py, max(1, int(4 + fade * 9)),
               P["seam_hi"] if fade > 0.72 else P["seam"])
    return c


def hollow_wave_wind(f):
    """Both fists over the floor. Vertical, and not parryable."""
    c = hollow_canvas()
    g = ease_in(f)
    hollow_haze(c, 70 + int(f * 64))
    hollow_body(c, stoop=-int(2 + g * 6), seam=0.9 + g * 0.1,
                squat=-int(2 + g * 10))
    for side in (-1, 1):
        hollow_arm(c, side, HCX + side * 104, HSHO - 20 - int(g * 78), thick=46)
    # The floor answering first, and it answers MORE as the strike nears. This
    # is the real tell and it is on the ground, where a jump gets decided.
    for k in range(3 + int(g * 10)):
        n = hnoise(k * 37)
        x = HCX + (-1 if k % 2 else 1) * (60 + k * 24)
        h = int(6 + g * 22 * n)
        c.rect(x - 8, HGROUND - 2 - h, x + 8, HGROUND - 2, P["seam_sh"])
        if g > 0.5:
            c.rect(x - 4, HGROUND - 2 - h, x + 4, HGROUND - 2 - h // 2,
                   P["seam"])
    return c


def hollow_wave(f):
    c = hollow_canvas()
    g = ease_out(f)
    hollow_haze(c, 90 + int(f * 64), spread=1.25)
    hollow_body(c, stoop=int(4 + g * 8), seam=1.0, squat=int(4 + g * 10))
    for side in (-1, 1):
        hollow_arm(c, side, HCX + side * 78, HGROUND - 60 + int(g * 20),
                   thick=48)
    # Two waves running outward along the floor, and they LEAVE — the far end
    # of each is brighter than the near, so the eye reads travel rather than a
    # pair of glowing patches.
    for side in (-1, 1):
        for k in range(16):
            t = k / 15
            head = g * 1.15
            if t > head:
                continue
            lead = 1 - (head - t)
            x = HCX + side * int(70 + t * 210)
            c.disc(x, HGROUND - 14 - int(lead * 26), max(1, int(3 + lead * 12)),
                   P["seam_hi"] if lead > 0.78 else P["seam"])
    return c


def hollow_stagger(f):
    """Rocked back. Three frames of it settling rather than one held pose."""
    c = hollow_canvas()
    g = ease_out(f)
    hollow_haze(c, 110 + int(f * 40), spread=1.35 - g * 0.2)
    hollow_body(c, stoop=-int(10 - g * 4), seam=0.08 + g * 0.1,
                squat=int(16 - g * 6))
    hollow_arm(c, -1, HCX - 140 + int(g * 14), HHIP + 76)
    hollow_arm(c, 1, HCX + 136 - int(g * 14), HHIP + 82)
    # The light guttering out of it where it was hit.
    for k in range(10):
        n = hnoise(k * 53 + int(f * 40))
        c.disc(HCX + int((n - 0.5) * 200), HSHO + 60 + int(n * 120),
               max(1, int(2 + n * 4)), P["seam_sh"])
    return c


def hollow_sink(f):
    """Going under. What has to read is that it is LEAVING, not crouching — so
    the body keeps its width and goes down through the floor line."""
    c = hollow_canvas()
    g = ease_both(f)
    drop = int(g * 250)
    hollow_haze(c, 130 + int(f * 64), spread=1.0 + g * 0.35)
    hollow_body(c, stoop=0, seam=1.0 - g * 0.75, squat=drop)
    for side in (-1, 1):
        hollow_arm(c, side, HCX + side * int(120 - g * 60),
                   HHIP + drop + 30, thick=int(44 - g * 20))
    # The floor taking it: a pool spreading as it goes down, brightest at the
    # rim, so the exact spot it left from is unmistakable.
    w = int(90 + g * 110)
    c.rect(HCX - w, HGROUND - 10, HCX + w, HGROUND, P["void_dk"])
    c.rect(HCX - w, HGROUND - 13, HCX + w, HGROUND - 10, P["seam_sh"])
    for k in range(12):
        n = hnoise(k * 31 + int(f * 40))
        c.disc(HCX + int((n - 0.5) * 2 * w), HGROUND - 14 - int(g * n * 30),
               max(1, int(2 + n * 5)), P["seam"] if n > 0.6 else P["seam_sh"])
    return c


def hollow_under(f):
    """Travelling. Nothing but the patch — this is the frame where there is no
    body in the room, and the sprite has to say so or the player keeps swinging
    at a thing that is not there."""
    c = hollow_canvas()
    import math
    w = 150 + int(math.sin(f * 2 * math.pi) * 18)
    for k in range(7):
        t = k / 6
        c.rect(HCX - int(w * (1 - t * 0.42)), HGROUND - 18 + k * 3,
               HCX + int(w * (1 - t * 0.42)), HGROUND - 15 + k * 3,
               P["void_dk"] if k % 2 else P["void_sh"])
    # A rim of light travelling along it, which makes the patch a THING rather
    # than a shadow cast by something off-screen — and it moves, so the patch
    # visibly has a direction.
    for k in range(11):
        t = (k / 10 + f) % 1.0
        x = HCX - w + int(t * 2 * w)
        c.disc(x, HGROUND - 13 + int(hnoise(k * 41) * 6),
               max(1, int(3 + (1 - abs(t - 0.5) * 2) * 5)),
               P["seam"] if k % 2 else P["seam_sh"])
    return c


def hollow_rise(f):
    """Coming up, and helpless for all of it.

    The window the whole fight is about, so it is drawn as something visibly not
    ready: arms hanging, light still coming back, nothing braced. It is also the
    slowest thing it does, and the frames are eased so most of them are spent
    near the bottom — a rise that was linear would be over before the player
    had decided to commit to it.
    """
    c = hollow_canvas()
    g = ease_in(f)
    up = int(250 - g * 250)
    w = int(200 - g * 150)
    c.rect(HCX - w, HGROUND - 10, HCX + w, HGROUND, P["void_dk"])
    c.rect(HCX - w, HGROUND - 13, HCX + w, HGROUND - 10, P["seam_sh"])
    hollow_haze(c, 150 + int(f * 64), spread=1.35 - g * 0.35)
    hollow_body(c, stoop=0, seam=0.2 + g * 0.7, squat=up)
    for side in (-1, 1):
        hollow_arm(c, side, HCX + side * int(90 + g * 40),
                   HHIP + up + 50, thick=int(28 + g * 16))
    return c


def main():
    sets = [
        ("shark-swim", [shark_swim(n) for n in range(4)], SW, SH),
        ("shark-bite", [shark_bite(n) for n in range(2)], SW, SH),
        ("crab-idle", [crab_idle(n) for n in range(2)], CW, CH),
        ("crab-walk", [crab_walk(n) for n in range(4)], CW, CH),
        ("crab-wind", [crab_wind(n) for n in range(2)], CW, CH),
        ("crab-strike", [crab_strike(n) for n in range(2)], CW, CH),
        ("crab-stagger", [crab_stagger()], CW, CH),
        ("lizard-idle", [lizard_idle(n) for n in range(2)], LW, LH),
        ("lizard-walk", [lizard_walk(n) for n in range(4)], LW, LH),
        ("lizard-wind", [lizard_wind(n) for n in range(2)], LW, LH),
        ("lizard-strike", [lizard_strike(n) for n in range(2)], LW, LH),
        ("lizard-stagger", [lizard_stagger()], LW, LH),
        ("bee-hover", [bee_hover(n) for n in range(4)], BW, BH),
        ("bee-wind", [bee_wind(n) for n in range(2)], BW, BH),
        ("bee-dive", [bee_dive(n) for n in range(2)], BW, BH),
        # Frame counts, in one place. Every pose above is a function of
        # progress rather than of an index, so smoothing the boss is this
        # number and nothing else.
        #
        # An idle loops, so its last frame must not repeat its first — it is
        # sampled over [0, 1) and the rest over [0, 1].
        ("hollow-idle", [hollow_idle(n / 10) for n in range(10)], HW, HH),
        ("hollow-sweep-windup",
         [hollow_sweep_wind(n / 7) for n in range(8)], HW, HH),
        ("hollow-sweep", [hollow_sweep(n / 6) for n in range(7)], HW, HH),
        ("hollow-wave-windup",
         [hollow_wave_wind(n / 7) for n in range(8)], HW, HH),
        ("hollow-wave", [hollow_wave(n / 6) for n in range(7)], HW, HH),
        ("hollow-stagger", [hollow_stagger(n / 3) for n in range(4)], HW, HH),
        ("hollow-sink", [hollow_sink(n / 5) for n in range(6)], HW, HH),
        ("hollow-under", [hollow_under(n / 6) for n in range(6)], HW, HH),
        ("hollow-rise", [hollow_rise(n / 7) for n in range(8)], HW, HH),
    ]
    done = []
    for name, frames, w, h in sets:
        done.append((name, finish(frames, name, w, h), w, h))

    here = Path(__file__).resolve().parent
    for tag, width in (("shark", SW), ("crab", CW), ("lizard", LW), ("bee", BW), ("hollow", HW)):
        imgs = [f for name, fs, w, _ in done if name.startswith(tag) for f in fs]
        h = next(h for name, _, w, h in done if name.startswith(tag))
        save_preview(imgs, here / f"_preview-{tag}.png", width, h, scale=2)


if __name__ == "__main__":
    main()
