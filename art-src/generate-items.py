"""
Shop item icons: one per thing on the shelves.

    py art-src/generate-items.py

Output: public/art/items.png — 23 frames of 32x32, in the order `SHOP` lists
them in src/config/shop.ts. The index IS the frame, so nothing has to be looked
up; if an item is added there, add its icon here in the same place.

Drawn at 32 and shown at 64, so every pixel is two. That is the whole reason
these are generated rather than found: an icon set from anywhere else is at
somebody else's resolution, and one crisp 2x sprite beside eleven smooth ones
looks worse than twelve of either.

Same palette family as the player, so a rack of these reads as belonging to the
same game — and the same rule about tone: base, shadow, highlight, lit from the
upper left. Flat fills are what make procedural art look procedural.
"""
from pathlib import Path
from PIL import Image

S = 32
OUT = Path(__file__).resolve().parent.parent / "public" / "art"
OUT.mkdir(parents=True, exist_ok=True)
CLEAR = (0, 0, 0, 0)


def rgb(h):
    return ((h >> 16) & 255, (h >> 8) & 255, h & 255, 255)


P = {
    "steel_hi": rgb(0xE8F0F8), "steel": rgb(0xB8C4D2), "steel_sh": rgb(0x7A8694),
    "steel_dk": rgb(0x49525E),
    "lea_hi": rgb(0x9A6A3C), "lea": rgb(0x6E4520), "lea_sh": rgb(0x472B14),
    "lea_dk": rgb(0x281708),
    "brass_hi": rgb(0xFFD887), "brass": rgb(0xD3A544), "brass_sh": rgb(0x8E6C22),
    "coat_hi": rgb(0x5A6B76), "coat": rgb(0x3E4C56), "coat_sh": rgb(0x27313A),
    "glass": rgb(0x9FB4C4), "glass_hi": rgb(0xDDE9F2),
    "red": rgb(0xE8556D), "red_hi": rgb(0xFF97A6),
    "teal": rgb(0x5FD9CF), "teal_hi": rgb(0xCFFFF8),
    "amber": rgb(0xF2A03C), "amber_hi": rgb(0xFFD79A),
    "rub": rgb(0x2E333A), "rub_hi": rgb(0x434B54),
    "frost": rgb(0xCADCEA), "frost_hi": rgb(0xF2FAFF),
    "ember": rgb(0xE0603A), "ember_hi": rgb(0xFFA070),
    "lime": rgb(0x7DC24B), "lime_hi": rgb(0xC4F08A),
    "violet": rgb(0x9A5FD0), "violet_hi": rgb(0xD8B0F5),
    "stone": rgb(0x9AA6B4), "stone_hi": rgb(0xDCE6F0),
    "verdant": rgb(0x5E8B45), "verdant_hi": rgb(0x92C46E),
    "void": rgb(0x3A3550), "void_hi": rgb(0x5E5680),
    "bone": rgb(0xE4DCC2), "bone_hi": rgb(0xFFFAE8),
    # The two armour skins, matching the sheets generate-player.py builds.
    "crimson": rgb(0xA8967C), "crimson_hi": rgb(0xE8D9C0),
    "crimson_crest": rgb(0x94303F),
    "pale": rgb(0xC2CBD6), "pale_hi": rgb(0xF4F8FF),
    "pale_crest": rgb(0xD6CDB8),
    "shroud": rgb(0x2A2145), "shroud_hi": rgb(0x3E3260),
    "shroud_glow": rgb(0xB56AF0),
    "deep": rgb(0x5E7FA8), "deep_hi": rgb(0x9FC4E8),
    "deep_glow": rgb(0x4FC7F0),
}


class Icon:
    def __init__(self):
        self.px = [[CLEAR] * S for _ in range(S)]

    def set(self, x, y, c):
        x, y = int(round(x)), int(round(y))
        if 0 <= x < S and 0 <= y < S:
            self.px[y][x] = c

    def rect(self, x0, y0, x1, y1, c):
        for y in range(int(y0), int(y1) + 1):
            for x in range(int(x0), int(x1) + 1):
                self.set(x, y, c)

    def disc(self, cx, cy, r, c):
        for y in range(int(cy - r), int(cy + r) + 1):
            for x in range(int(cx - r), int(cx + r) + 1):
                if (x - cx) ** 2 + (y - cy) ** 2 <= r * r:
                    self.set(x, y, c)

    def line(self, x0, y0, x1, y1, w, c):
        steps = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 1
        for i in range(steps):
            t = i / max(steps - 1, 1)
            x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
            r = w / 2
            for dy in range(int(-r - 1), int(r + 2)):
                for dx in range(int(-r - 1), int(r + 2)):
                    if dx * dx + dy * dy <= r * r:
                        self.set(x + dx, y + dy, c)

    def outline(self, c):
        """Collected then written — writing as it scans grows an outline on the
        outline and floods the frame. See the same note in generate-loot.py."""
        edge = {}
        for y in range(S):
            for x in range(S):
                if self.px[y][x] != CLEAR:
                    continue
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < S and 0 <= ny < S and self.px[ny][nx] != CLEAR:
                        edge[(x, y)] = c
                        break
        for (x, y), col in edge.items():
            self.set(x, y, col)
        return self

    def image(self):
        im = Image.new("RGBA", (S, S), CLEAR)
        for y in range(S):
            for x in range(S):
                im.putpixel((x, y), self.px[y][x])
        return im


def sword(length, wide, edge_hi):
    """A blade held point-up, angled slightly. Shared by both weapon icons so
    the pair reads as the same weapon changed rather than two objects."""
    c = Icon()
    tipy = 30 - length
    c.line(11, 29, 20, tipy, wide + 2, P["steel_sh"])
    c.line(11, 29, 20, tipy, wide, P["steel"])
    c.line(12, 28, 20, tipy + 2, max(1, wide - 3), edge_hi)
    # Guard and grip, at the bottom.
    c.line(6, 26, 16, 30, 4, P["brass"])
    c.set(7, 26, P["brass_hi"])
    c.line(8, 29, 12, 31, 4, P["lea"])
    return c


def honed():
    c = sword(19, 6, P["steel_hi"])
    # A whetted line down the edge — the whole difference from the plain blade.
    c.line(14, 26, 21, 12, 1, P["steel_hi"])
    c.disc(22, 9, 1.6, P["steel_hi"])
    return c.outline(P["steel_dk"])


def longblade():
    c = sword(25, 5, P["steel_hi"])
    return c.outline(P["steel_dk"])


def riposte():
    """A bracer: a curved plate with straps. Not a weapon shape, because it is
    not a weapon — it is what a parry does afterwards."""
    c = Icon()
    c.rect(7, 8, 24, 24, P["steel_sh"])
    c.rect(8, 9, 23, 22, P["steel"])
    c.rect(8, 9, 23, 11, P["steel_hi"])
    for y in (13, 19):
        c.rect(6, y, 25, y + 2, P["lea"])
        c.rect(6, y, 25, y, P["lea_hi"])
        c.rect(14, y - 1, 17, y + 3, P["brass"])
    c.rect(20, 14, 22, 20, P["steel_hi"])
    return c.outline(P["steel_dk"])


def tank():
    """The air tank. The one thing on the shelves that already exists in the
    game — it is on the player's back in every frame."""
    c = Icon()
    c.rect(10, 7, 21, 27, P["steel_sh"])
    c.rect(11, 8, 20, 26, P["steel"])
    c.rect(11, 8, 13, 26, P["steel_hi"])
    c.rect(10, 11, 21, 13, P["brass_sh"])
    c.rect(10, 11, 21, 11, P["brass"])
    c.rect(10, 21, 21, 23, P["brass_sh"])
    c.rect(10, 21, 21, 21, P["brass"])
    # Valve and hose off the top.
    c.rect(14, 4, 17, 7, P["brass"])
    c.rect(14, 4, 15, 6, P["brass_hi"])
    for i, (x, y) in enumerate(((18, 4), (20, 3), (22, 4), (23, 6), (23, 9))):
        c.disc(x, y, 1.4, P["rub"])
    return c.outline(P["steel_dk"])


def plate():
    """Rib plate: a chest piece, seen from the front."""
    c = Icon()
    for y in range(7, 26):
        f = (y - 7) / 19
        half = int(10 - f * f * 8)
        c.rect(16 - half, y, 15 + half, y, P["coat"])
    c.rect(8, 7, 23, 9, P["steel"])
    c.rect(8, 7, 23, 7, P["steel_hi"])
    for y in (12, 16, 20):
        c.rect(9, y, 22, y, P["coat_sh"])
        c.rect(9, y - 1, 22, y - 1, P["coat_hi"])
    c.rect(14, 9, 17, 12, P["brass"])
    c.set(15, 10, P["brass_hi"])
    return c.outline(P["lea_dk"])


def boots():
    """Gripped boots: a pair, one behind the other, with studded soles."""
    c = Icon()
    for dx, tone in ((0, P["lea_sh"]), (5, P["lea"])):
        c.rect(6 + dx, 10, 14 + dx, 24, tone)
        c.rect(6 + dx, 24, 18 + dx, 27, tone)
        c.rect(6 + dx, 10, 8 + dx, 24, P["lea_hi"] if dx else P["lea"])
        c.rect(5 + dx, 27, 19 + dx, 29, P["rub"])
        for sx in range(6 + dx, 19 + dx, 3):
            c.set(sx, 29, P["steel"])
        c.rect(6 + dx, 15, 14 + dx, 16, P["brass_sh"])
    return c.outline(P["lea_dk"])


def scale():
    """Cinder scale: a shoulder plate of overlapping fired tiles.

    Deliberately not another flask and not another breastplate — it shares a
    shelf with the rib plate, so it has to be told apart from it at icon size.
    Tiles read as scale, and scale reads as heat-treated."""
    c = Icon()
    # The pauldron shape: a curved cap over a shoulder.
    c.rect(7, 10, 24, 24, P["ember_dk"] if "ember_dk" in P else P["lea"])
    c.disc(15, 12, 8, P["steel_sh"])
    # Three courses of tiles, each lit along its top edge.
    for row, y in enumerate((11, 16, 21)):
        wide = 9 - row
        for n in range(-wide, wide, 4):
            x = 15 + n
            c.rect(x, y, x + 3, y + 4, P["ember"])
            c.rect(x, y, x + 3, y + 1, P["ember_hi"])
    # A cooled rim, so it does not read as simply glowing.
    c.rect(6, 9, 25, 10, P["steel"])
    c.rect(6, 24, 25, 25, P["steel_sh"])
    return c.outline(P["steel_dk"])



def sovereign():
    """The Sovereign edge: the legendary blade.

    It shares a shelf with four other swords, so the difference has to be
    readable at thirty-two pixels — and "slightly better sword" is not readable
    at any size. So it is not a longer honed blade: it is a black blade with a
    burning edge and a crown for a guard. The one weapon on the shelf that is
    not made of steel.
    """
    c = Icon()
    tipy = 3
    # The blade, dark all the way through with a lit edge down one side.
    c.line(11, 29, 21, tipy, 8, P["void"])
    c.line(11, 29, 21, tipy, 5, P["shroud"])
    c.line(12, 27, 21, tipy + 2, 2, P["ember"])
    c.line(13, 26, 21, tipy + 3, 1, P["ember_hi"])
    # A crown-shaped guard rather than a crossbar. Three points, so it reads as
    # a crown and not as a wider guard.
    c.line(5, 25, 17, 30, 5, P["brass"])
    for px, py in ((6, 22), (10, 21), (14, 23)):
        c.rect(px, py, px + 2, py + 4, P["brass"])
        c.set(px, py, P["brass_hi"])
    c.line(8, 29, 12, 31, 4, P["lea_sh"])
    # And a mote coming off the tip, which is the cheapest way to say "this one
    # is not ordinary".
    c.disc(23, 2, 1.8, P["ember_hi"])
    return c.outline(P["void"])


def aegis():
    """The Aegis plate: the legendary armour.

    A tower shield rather than another breastplate — it shares a shelf with the
    rib plate and the cinder scale and has to be told apart from both. Pale
    metal with a struck boss in the middle, and a rim that catches the light all
    the way round, because what it does is stop things.
    """
    c = Icon()
    # The body: a tall shield, flat-topped and tapering to a point.
    c.rect(7, 5, 25, 22, P["pale"])
    for y in range(22, 29):
        inset = (y - 22) * 3 // 2
        c.rect(7 + inset, y, 25 - inset, y + 1, P["pale"])
    # Lit down the left, shaded down the right — one light source, like the
    # rest of the sheet.
    c.rect(7, 5, 11, 22, P["pale_hi"])
    c.rect(22, 5, 25, 22, P["steel_sh"])
    # The rim.
    c.rect(6, 4, 26, 6, P["steel"])
    c.rect(6, 4, 26, 5, P["steel_hi"])
    # A boss, struck and holding.
    c.disc(16, 15, 6, P["steel"])
    c.disc(16, 15, 4, P["pale_hi"])
    c.disc(15, 14, 2, P["frost_hi"])
    return c.outline(P["steel_dk"])


def lamp():
    """Hooded lamp: a shuttered lantern with the shutter half open.

    A lamp is the easiest icon on this sheet to draw badly — a yellow circle is
    a coin, a gem and a lamp all at once. So what carries it is the HOOD: a
    metal shade over the top with the light escaping in one direction, which is
    also exactly what the item does.
    """
    c = Icon()
    # The hood, wide and overhanging.
    c.rect(6, 6, 26, 12, P["steel_sh"])
    c.rect(6, 6, 26, 8, P["steel"])
    c.rect(8, 5, 24, 6, P["steel_hi"])
    # A ring to carry it by.
    c.disc(16, 4, 3, P["brass"])
    c.disc(16, 4, 1.6, P["rub"])
    # The body: glass between two bands, lit from inside.
    c.rect(9, 12, 23, 24, P["brass_sh"])
    c.rect(11, 13, 21, 23, P["amber"])
    c.rect(12, 14, 19, 21, P["amber_hi"])
    c.disc(15, 18, 3, P["bone_hi"])
    # The bands, and a foot.
    c.rect(9, 12, 23, 13, P["brass"])
    c.rect(9, 23, 23, 25, P["brass"])
    c.rect(11, 25, 21, 27, P["brass_sh"])
    # And the light going ONE way, which is the whole item.
    for n, x in enumerate((24, 26, 28)):
        c.rect(x, 14 + n, x + 1, 22 - n, P["amber_hi"])
    return c.outline(P["lea_dk"])


def weave():
    """Verdigris weave: the poison plate.

    The cinder scale's twin and drawn as one — same pauldron, same three courses
    of tiles — because they do the same thing to two hazards that share their
    arithmetic. What changes is the material: woven, verdigrised, and cold.
    """
    c = Icon()
    # The pauldron first, exactly as the scale draws it — a curved cap, not a
    # rectangle. The first attempt laid the weave on a flat slab and the whole
    # icon read as a window with green panes.
    c.disc(15, 16, 10, P["lea_sh"])
    c.rect(5, 16, 26, 25, P["lea_sh"])
    c.disc(15, 13, 9, P["steel_sh"])
    # Woven rather than tiled: a lattice inside the cap's silhouette, so it is
    # cloth at a glance and not more scale.
    for y in range(9, 24, 3):
        wide = 9 if y < 18 else 10
        c.rect(15 - wide, y, 15 + wide, y + 1, P["verdant"])
        c.rect(15 - wide, y, 15 + wide, y, P["verdant_hi"])
    for x in range(7, 25, 4):
        c.rect(x, 10, x + 1, 24, P["verdant_hi"])
    # Verdigris gathering along the bottom lip, which is what tells you what it
    # is proof against.
    c.rect(5, 23, 26, 25, P["lime"])
    c.rect(5, 23, 26, 23, P["lime_hi"])
    # And the cooled rim over the top, matching the scale. An ARC, not a disc —
    # a filled one covered the whole weave and the icon came out a green blob.
    c.disc(15, 13, 10, P["steel"])
    c.disc(15, 13, 8, P["verdant"])
    c.disc(15, 12, 7, P["verdant_hi"])
    c.disc(15, 14, 7, P["verdant"])
    for x in range(9, 23, 4):
        c.rect(x, 7, x + 1, 20, P["verdant_hi"])
    for y in range(8, 21, 3):
        c.rect(9, y, 22, y + 1, P["lime"])
    return c.outline(P["steel_dk"])


def flask(body, hi, cork):
    """A round-bottomed bottle. Same silhouette for all three potions, because
    the colour of what is IN it is the thing being sold."""
    c = Icon()
    c.disc(16, 21, 8, P["glass"])
    c.rect(13, 7, 18, 15, P["glass"])
    c.disc(16, 21, 7, body)
    c.rect(14, 12, 17, 15, body)
    c.disc(13, 19, 2.6, hi)          # the light through it
    c.rect(13, 7, 18, 8, P["glass_hi"])
    c.rect(14, 4, 17, 7, cork)
    c.rect(14, 4, 15, 6, P["lea_hi"])
    c.rect(12, 15, 19, 16, P["glass_hi"])
    return c.outline(P["steel_dk"])


def rig(shell, hi, lens):
    """A cosmetic: the player's own mask, recoloured. It is what changes, so it
    is what is shown."""
    c = Icon()
    c.disc(16, 16, 11, P["coat_sh"])
    c.disc(16, 17, 9, shell)
    c.rect(5, 13, 9, 21, P["coat_sh"])
    c.disc(16, 17, 9, shell)
    c.disc(20, 20, 3.4, hi)
    c.disc(20, 20, 2.2, shell)
    c.disc(15, 23, 2.8, hi)
    c.disc(19, 14, 3.2, P["rub"])
    c.disc(19, 14, 2.3, lens)
    c.set(18, 13, P["teal_hi"] if lens == P["teal"] else P["frost_hi"])
    c.disc(11, 15, 2.6, P["rub"])
    c.disc(11, 15, 1.8, lens)
    c.rect(9, 9, 22, 10, hi)
    c.rect(8, 9, 9, 11, P["brass"])
    return c.outline(P["coat_sh"])




def pommel():
    """A weighted pommel: the sword held hilt-down, the counterweight enormous."""
    c = Icon()
    c.line(16, 4, 16, 18, 5, P["steel_sh"])
    c.line(16, 4, 16, 18, 3, P["steel"])
    c.line(9, 19, 23, 19, 4, P["brass"])
    c.set(10, 18, P["brass_hi"])
    c.line(16, 20, 16, 25, 5, P["lea"])
    c.disc(16, 27, 4.6, P["steel_sh"])
    c.disc(16, 27, 3.4, P["steel"])
    c.disc(14, 25, 1.6, P["steel_hi"])
    return c.outline(P["steel_dk"])


def breaker():
    """A maul head. Blunt, wide, and obviously not for cutting."""
    c = Icon()
    c.line(16, 30, 16, 14, 4, P["lea"])
    c.rect(7, 6, 25, 16, P["steel_sh"])
    c.rect(8, 7, 24, 14, P["steel"])
    c.rect(8, 7, 24, 8, P["steel_hi"])
    c.rect(7, 10, 25, 11, P["steel_dk"])
    for x in (10, 21):
        c.rect(x, 8, x + 2, 13, P["brass"])
    return c.outline(P["steel_dk"])


def stride():
    """A greave with a wing on it. The shape says 'faster', not 'tougher'."""
    c = Icon()
    c.rect(11, 6, 20, 24, P["steel_sh"])
    c.rect(12, 7, 19, 22, P["steel"])
    c.rect(12, 7, 14, 22, P["steel_hi"])
    c.rect(10, 24, 21, 27, P["lea"])
    c.rect(10, 24, 21, 25, P["lea_hi"])
    for i, y in enumerate((10, 15, 20)):
        c.line(22, y, 29 - i, y - 2, 2, P["brass"])
    c.rect(11, 12, 20, 13, P["brass_sh"])
    return c.outline(P["steel_dk"])


def soles():
    """A boot seen from underneath: the sole is the product."""
    c = Icon()
    for y in range(6, 27):
        f = (y - 6) / 21
        half = int(5 + f * 4)
        c.rect(16 - half, y, 15 + half, y, P["lea"])
    c.rect(8, 20, 23, 26, P["lea"])
    # The padding, in rows of studs.
    for y in (10, 15, 21, 24):
        for x in range(10, 23, 4):
            c.rect(x, y, x + 2, y + 1, P["rub_hi"])
    c.rect(9, 18, 22, 19, P["rub"])
    return c.outline(P["lea_dk"])


def pet_icon(body, hi, trim, kind):
    """A pet, small and centred. The three shapes have to be tellable apart at
    icon size, which is the same job the sprites themselves have."""
    c = Icon()
    if kind == "moth":
        for side in (-1, 1):
            c.line(16 + side * 2, 17, 16 + side * 11, 8, 9, body)
            c.line(16 + side * 2, 17, 16 + side * 9, 10, 5, hi)
        c.line(16, 12, 16, 24, 7, body)
        c.rect(13, 17, 18, 18, trim)
        c.disc(16, 11, 4, hi)
        c.line(13, 8, 10, 3, 2, body)
        c.line(19, 8, 22, 3, 2, body)
    elif kind == "pup":
        for x, dy in ((10, 0), (14, 1), (19, 0), (23, 1)):
            c.line(x, 18, x - 1, 26 - dy, 3, body)
        c.line(8, 17, 21, 16, 11, body)
        c.line(9, 14, 19, 13, 5, hi)
        c.line(8, 16, 4, 9, 4, body)
        c.disc(24, 13, 6, body)
        c.disc(25, 11, 4, hi)
        c.line(21, 8, 19, 3, 4, body)
        c.line(27, 8, 29, 4, 4, trim)
        c.disc(26, 13, 1.4, P["rub"])
    else:
        for x in (11, 15, 19, 22):
            c.line(x, 20, x, 26, 3, body)
        c.line(9, 19, 21, 19, 10, body)
        c.rect(12, 11, 17, 17, body)
        c.rect(12, 11, 13, 17, trim)
        c.rect(11, 13, 18, 14, trim)
        c.disc(24, 17, 5, body)
        c.disc(25, 15, 3, hi)
        c.disc(21, 12, 2.4, trim)
        for k in range(8):
            f = k / 7
            c.disc(8 - f * 6, 18 - f * f * 9, 1.6 - f * 0.6, body)
    return c.outline(P["rub"])


def helm(plate, plate_hi, crest, lens):
    """An armour skin, shown as its helm. The crest is what tells the two
    apart at a glance, so it gets the saturated colour."""
    c = Icon()
    c.disc(16, 18, 10, plate)
    c.disc(15, 16, 7, plate_hi)
    c.rect(5, 16, 27, 20, plate)
    c.rect(5, 16, 24, 17, plate_hi)
    c.rect(8, 20, 24, 24, P["rub"])
    c.rect(10, 21, 14, 22, lens)
    c.rect(18, 21, 22, 22, lens)
    # The crest, swept back.
    for k in range(9):
        f = k / 8
        c.rect(12 + k, 3 + int(f * 4), 13 + k, 9 + int(f * 3), crest)
    c.rect(11, 4, 13, 10, P["brass"])
    return c.outline(P["rub"])


def hood(cloth, cloth_hi, glow):
    """The void shroud, shown as its hood: tall, ragged, and empty."""
    c = Icon()
    c.disc(16, 16, 11, cloth)
    c.disc(15, 13, 8, cloth_hi)
    c.disc(16, 19, 7, P["rub"])
    c.disc(13, 19, 1.8, glow)
    c.disc(19, 18, 1.8, glow)
    # A ragged hem rather than a straight one. No hard edges anywhere on it.
    for i, dx in enumerate((-10, -5, 0, 5, 10)):
        c.line(16 + dx, 24, 16 + dx - 2, 28 + (i % 2) * 3, 4, cloth)
    return c.outline(P["rub"])


def revenant_mask():
    """The Revenant's coat, shown as its mask.

    Not a helm — the other three cosmetics are armour and this one is not. It is
    the ORDINARY scavenger's gas mask, which is the same one the player is
    wearing right now, gone green in the water with the lamp burning cold. What
    is being sold is not a better suit; it is the fact that you took this one
    off something.
    """
    c = Icon()
    # The hood, drawn as cloth over a round skull.
    c.disc(16, 15, 11, P["verdant_sh"] if "verdant_sh" in P else P["rub"])
    c.disc(16, 14, 10, P["verdant"])
    c.disc(15, 12, 7, P["verdant_hi"])
    # The mask: two round lenses and a filter, exactly the player's.
    c.disc(12, 17, 4, P["rub_hi"])
    c.disc(20, 17, 4, P["rub_hi"])
    c.disc(12, 17, 2.4, P["teal_hi"])
    c.disc(20, 17, 2.4, P["teal_hi"])
    c.rect(13, 21, 19, 26, P["rub"])
    c.rect(14, 22, 18, 25, P["rub_hi"])
    # Straps, and a verdigrised buckle.
    c.rect(6, 17, 10, 19, P["lea_sh"])
    c.rect(22, 17, 26, 19, P["lea_sh"])
    c.rect(7, 16, 9, 20, P["teal"])
    # Weed hanging off it. The one thing that says it came out of the water.
    for i, dx in enumerate((-9, -3, 4, 9)):
        c.line(16 + dx, 25, 16 + dx - 1, 29 + (i % 2) * 2, 2, P["verdant"])
    return c.outline(P["rub"])


def horned(plate, plate_hi, glow):
    """The leviathan, shown as its helm: small face, enormous horns."""
    c = Icon()
    for side in (-1, 1):
        for k in range(6):
            f = k / 5
            c.disc(16 + side * (5 + k * 2.4), 14 - k * 1.6 + f * f * 5,
                   3.4 - f * 2.2, plate)
    c.disc(16, 19, 8, plate)
    c.disc(15, 17, 5.5, plate_hi)
    c.rect(9, 20, 23, 24, P["rub"])
    c.rect(11, 21, 14, 22, glow)
    c.rect(18, 21, 21, 22, glow)
    c.rect(8, 25, 24, 27, plate)
    return c.outline(P["rub"])


# The order here IS the order in src/config/shop.ts. Both are the frame index.
FRAMES = [
    # weapons
    honed(),
    longblade(),
    riposte(),
    pommel(),
    breaker(),
    sovereign(),
    # gear
    tank(),
    plate(),
    boots(),
    stride(),
    scale(),
    lamp(),
    weave(),
    aegis(),
    soles(),
    # potions — one silhouette, six contents, because what is IN it is the item
    flask(P["red"], P["red_hi"], P["lea"]),
    flask(P["teal"], P["teal_hi"], P["lea"]),
    flask(P["lime"], P["lime_hi"], P["lea"]),
    flask(P["violet"], P["violet_hi"], P["lea"]),
    flask(P["amber"], P["amber_hi"], P["lea"]),
    # Milk. The only white one on the shelf, and the only one that is not a
    # single colour: it is water over embers, because it answers both.
    flask(P["bone_hi"], P["frost_hi"], P["steel"]),
    # The ward. Cold cyan rather than the frost it started as — frost put it a
    # shade off the milk beside it, and two pale flasks next to each other on a
    # shelf is one flask twice.
    flask(P["deep_glow"], P["frost_hi"], P["steel_hi"]),
    # cosmetics — three pets, then two suits of armour
    pet_icon(P["bone"], P["bone_hi"], P["teal"], "moth"),
    pet_icon(P["lea"], P["lea_hi"], P["ember"], "pup"),
    pet_icon(P["steel_sh"], P["steel"], P["brass"], "rat"),
    helm(P["crimson"], P["crimson_hi"], P["crimson_crest"], P["ember"]),
    hood(P["shroud"], P["shroud_hi"], P["shroud_glow"]),
    horned(P["deep"], P["deep_hi"], P["deep_glow"]),
    revenant_mask(),
    helm(P["pale"], P["pale_hi"], P["pale_crest"], P["teal"]),
]

sheet = Image.new("RGBA", (S * len(FRAMES), S), CLEAR)
for i, f in enumerate(FRAMES):
    sheet.paste(f.image(), (i * S, 0))
sheet.save(OUT / "items.png")
print(f"items.png: {len(FRAMES)} frames -> {sheet.width}x{sheet.height}")

scale = 6
preview = Image.new("RGBA", (sheet.width * scale, S * scale), (0x1A, 0x21, 0x2B, 255))
preview.alpha_composite(sheet.resize((sheet.width * scale, S * scale), Image.NEAREST))
preview.save(Path(__file__).resolve().parent / "_preview-items.png")
print("preview -> art-src/_preview-items.png")
