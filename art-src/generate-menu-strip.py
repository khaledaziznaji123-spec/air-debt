"""
The menu backdrop: one tile of dungeon that joins to itself.

    py art-src/generate-menu-strip.py

Output: public/art/menu-back.png   (320x180) — wall, crystals, stalactites
        public/art/menu-front.png  (320x180) — the floor and its face

Two layers rather than one, because a single image scrolled behind a running
character is a treadmill: everything moves at the same rate and the eye reads it
as a sheet of wallpaper sliding past. Parallax is the whole trick — the floor
goes by fast, the far wall goes by slow, and only then does it look like the man
is the one moving.

Each tile is seamless left-to-right: the CSS scrolls it by exactly its own width
and repeats, so anything drawn across the seam has to be drawn on both edges.
`wrapped()` handles that — draw at x, and it also draws at x - W and x + W.

Brighter than the game itself, deliberately. The dungeon is lit at "you are
running out of air"; a menu lit that way is a black rectangle with a logo on it.
Same palette, turned up.
"""
from pathlib import Path
from PIL import Image

W, H = 320, 180
OUT = Path(__file__).resolve().parent.parent / "public" / "art"
OUT.mkdir(parents=True, exist_ok=True)

# Where the floor sits in the tile, matching the proportion the game uses.
FLOOR_Y = 132


def rgb(h, a=255):
    return ((h >> 16) & 255, (h >> 8) & 255, h & 255, a)


# The game's rock, two stops up. The menu is the same place with the lights on.
C = {
    "far": rgb(0x3A4759),
    "wall": rgb(0x4E617A),
    "wall_hi": rgb(0x6A7F99),
    "wall_sh": rgb(0x3A4859),
    "floor": rgb(0x6A5570),
    "floor_hi": rgb(0x8A7089),
    "floor_sh": rgb(0x4A3A50),
    "edge": rgb(0xA98FA0),
    "crystal": rgb(0x5FD9CF),
    "crystal_hi": rgb(0xCFFFF8),
    "brass": rgb(0xC89A3E),
    "brass_hi": rgb(0xFFD479),
}


class Tile:
    def __init__(self):
        self.im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        self.px = self.im.load()

    def set(self, x, y, c):
        x %= W  # the seam is handled by wrapping, not by clipping
        if 0 <= y < H:
            self.px[x, y] = c

    def rect(self, x0, y0, x1, y1, c):
        for y in range(int(y0), int(y1) + 1):
            for x in range(int(x0), int(x1) + 1):
                self.set(x, y, c)

    def tri_down(self, x, y, w, h, c):
        """A stalactite: widest at the top, tapering to a point below."""
        for i in range(int(h)):
            half = max(0, int(w * (1 - i / h) / 2))
            for dx in range(-half, half + 1):
                self.set(x + dx, y + i, c)

    def tri_up(self, x, y, w, h, c):
        for i in range(int(h)):
            half = max(0, int(w * (1 - i / h) / 2))
            for dx in range(-half, half + 1):
                self.set(x + dx, y - i, c)


def crystal(t, x, y, h):
    """A lit shard. The one thing down here that makes its own light."""
    t.tri_up(x, y, max(3, h // 3), h, C["crystal"])
    t.tri_up(x, y - 1, max(1, h // 6), h - 3, C["crystal_hi"])
    # A pool of it on the ground under the shard.
    for dx in range(-h, h + 1):
        f = 1 - abs(dx) / (h + 1)
        if f > 0.35:
            t.set(x + dx, y, C["crystal"])


def back():
    t = Tile()
    # Far wall, banded so it has depth without any detail to catch the eye.
    t.rect(0, 0, W - 1, FLOOR_Y, C["far"])
    for y in range(0, FLOOR_Y, 2):
        f = y / FLOOR_Y
        if f > 0.55:
            t.rect(0, y, W - 1, y, C["wall_sh"])

    # Brickwork, offset row to row. The seam works because the row offset is a
    # divisor of the tile width.
    bw, bh = 40, 16
    for row, y in enumerate(range(FLOOR_Y - bh * 5, FLOOR_Y, bh)):
        shift = (row % 2) * (bw // 2)
        for x in range(-bw, W + bw, bw):
            bx = x + shift
            t.rect(bx, y, bx + bw - 2, y + bh - 2, C["wall"])
            t.rect(bx, y, bx + bw - 2, y, C["wall_hi"])
            t.rect(bx, y + bh - 3, bx + bw - 2, y + bh - 3, C["wall_sh"])

    # Stalactites along the roof, at irregular intervals so it never reads as a
    # comb. The list is hand-picked rather than random: the tile has to be the
    # same every time it is regenerated or the seam moves.
    for x, w, h in ((14, 9, 26), (47, 5, 14), (86, 12, 34), (121, 6, 18),
                    (163, 8, 22), (198, 14, 40), (232, 5, 12), (259, 10, 28),
                    (296, 7, 20)):
        t.tri_down(x, 0, w, h, C["wall_sh"])
        t.tri_down(x, 0, max(2, w // 3), h - 4, C["wall"])

    for x, h in ((60, 14), (150, 9), (272, 17)):
        crystal(t, x, FLOOR_Y - 2, h)

    # A couple of brass sconces, for warmth. Everything else down here is blue
    # or teal, and a menu wants one colour that is neither.
    for x in (104, 226):
        t.rect(x - 1, FLOOR_Y - 54, x + 1, FLOOR_Y - 44, C["wall_sh"])
        t.rect(x - 3, FLOOR_Y - 58, x + 3, FLOOR_Y - 54, C["brass"])
        t.rect(x - 2, FLOOR_Y - 62, x + 2, FLOOR_Y - 58, C["brass_hi"])
        t.rect(x - 1, FLOOR_Y - 65, x + 1, FLOOR_Y - 62, C["brass_hi"])
    return t.im


def front():
    t = Tile()
    # The floor's top face, and the wall of rock below it.
    t.rect(0, FLOOR_Y, W - 1, H - 1, C["floor"])
    t.rect(0, FLOOR_Y, W - 1, FLOOR_Y + 1, C["edge"])
    t.rect(0, FLOOR_Y + 2, W - 1, FLOOR_Y + 4, C["floor_hi"])

    # Blocks in the face, on a fixed grid so the tile joins to itself.
    for row, y in enumerate(range(FLOOR_Y + 8, H, 14)):
        shift = (row % 2) * 18
        for x in range(-36, W + 36, 36):
            bx = x + shift
            t.rect(bx, y, bx + 33, y + 11, C["floor_sh"])
            t.rect(bx + 1, y + 1, bx + 32, y + 9, C["floor"])
            t.rect(bx + 1, y + 1, bx + 32, y + 1, C["floor_hi"])

    # Rubble on the top surface, so the ground is not a ruled line.
    for x, w in ((23, 5), (78, 3), (112, 7), (170, 4), (214, 6), (287, 4)):
        t.rect(x, FLOOR_Y - 2, x + w, FLOOR_Y - 1, C["floor_hi"])
    return t.im


back().save(OUT / "menu-back.png")
front().save(OUT / "menu-front.png")
print(f"menu-back.png / menu-front.png -> {W}x{H} each, floor at y={FLOOR_Y}")
