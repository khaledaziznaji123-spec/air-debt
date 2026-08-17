"""
The loot icons: one gem per grade, and a gold coin.

    py art-src/generate-loot.py

These are HUD-scale rather than world-scale — they appear over a chest the
moment it is opened, and they sit in the run's tally in the top right corner.
So they are read at a glance, at a small size, against dark rock: high contrast,
a hard facet line, and no interior detail that would turn to mush.

Frames 0-4 are the five gem grades in order, frame 5 is the coin.

Every grade gets its own CUT, not just its own colour. Five recolours of one
rectangle would be five things the player has to read the hue of, in a cave lit
by teal crystals, at 20 pixels. A silhouette can be told apart in the dark:

    1 emerald   step cut, rectangular       green
    2 sapphire  cushion, round-shouldered   blue
    3 amethyst  marquise, pointed both ends violet
    4 topaz     pear, one point             amber
    5 diamond   brilliant, wide crown       near-white

They also climb in size a little with grade, so a screenful of them reads as a
ladder even before the shapes register.
"""
from pathlib import Path
from PIL import Image

W, H = 20, 20
OUT = Path(__file__).resolve().parent.parent / "public" / "art"
OUT.mkdir(parents=True, exist_ok=True)


def rgb(h):
    return ((h >> 16) & 255, (h >> 8) & 255, h & 255, 255)


CLEAR = (0, 0, 0, 0)

EM = {
    "hi": rgb(0x8CFFC4), "lit": rgb(0x3FE08A), "mid": rgb(0x1FA860),
    "sh": rgb(0x137A45), "dk": rgb(0x0A3F24),
}
SA = {  # sapphire
    "hi": rgb(0xBBD9FF), "lit": rgb(0x5F9BF0), "mid": rgb(0x2E63C8),
    "sh": rgb(0x1B3F8C), "dk": rgb(0x0C1F4A),
}
AM = {  # amethyst
    "hi": rgb(0xE6C4FF), "lit": rgb(0xB37AEA), "mid": rgb(0x8043C4),
    "sh": rgb(0x552A88), "dk": rgb(0x2B1348),
}
TO = {  # topaz
    "hi": rgb(0xFFE4A8), "lit": rgb(0xFFB25C), "mid": rgb(0xE07C1E),
    "sh": rgb(0xA35211), "dk": rgb(0x552706),
}
DI = {  # diamond — the only one that is nearly colourless, which is the point
    "hi": rgb(0xFFFFFF), "lit": rgb(0xE2F4FF), "mid": rgb(0xA8CEE4),
    "sh": rgb(0x6E93AC), "dk": rgb(0x37505F),
}
AU = {
    "hi": rgb(0xFFF3C4), "lit": rgb(0xFFD479), "mid": rgb(0xE0A43A),
    "sh": rgb(0xA8721E), "dk": rgb(0x5E3F0E),
}


def canvas():
    return [[CLEAR] * W for _ in range(H)]


def put(px, x, y, c):
    if 0 <= x < W and 0 <= y < H:
        px[y][x] = c


def rect(px, x0, y0, x1, y1, c):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            put(px, x, y, c)


def emerald():
    """A step cut: rectangular table, clipped corners, facets down each side."""
    px = canvas()
    # Body, with the corners clipped so the silhouette reads as a cut stone.
    rect(px, 5, 3, 14, 16, EM["mid"])
    rect(px, 4, 5, 15, 14, EM["mid"])
    for x, y in ((5, 3), (14, 3), (5, 16), (14, 16), (4, 4), (15, 4), (4, 15), (15, 15)):
        put(px, x, y, CLEAR)

    # The table — the flat top face, and the brightest plane on the stone.
    rect(px, 7, 5, 12, 9, EM["lit"])
    rect(px, 8, 6, 11, 8, EM["hi"])

    # Side facets, lit from the upper left.
    rect(px, 5, 5, 6, 14, EM["lit"])
    rect(px, 13, 5, 14, 14, EM["sh"])
    rect(px, 7, 11, 12, 15, EM["sh"])
    rect(px, 8, 12, 11, 14, EM["mid"])
    # Facet lines, which are what makes it read as cut rather than as a blob.
    rect(px, 7, 10, 12, 10, EM["sh"])
    rect(px, 6, 6, 6, 13, EM["sh"])
    rect(px, 13, 6, 13, 13, EM["dk"])
    return outline_in(px, EM)


def outline_in(px, pal):
    """Edge the stone in its own darkest tone. Every cut ends with this.

    Collected first and written afterwards. Writing as it scans is what the
    first version did, and the pixel it had just darkened became a neighbour for
    the next one along — so the outline grew a fresh outline of its own, row
    after row, until the whole frame was filled with the stone's dark tone. On a
    green gem over dark rock that flood was near enough invisible to survive
    unnoticed; on five gems in a lit HUD row it is five coloured tiles.
    """
    edge = {}
    for y in range(H):
        for x in range(W):
            if px[y][x] != CLEAR:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < W and 0 <= ny < H and px[ny][nx] != CLEAR:
                    edge[(x, y)] = pal["dk"]
                    break
    for (x, y), c in edge.items():
        put(px, x, y, c)
    return px


def facet(px, x0, y0, x1, y1, c):
    """A flat plane on the stone, clipped to the stone.

    A plain rect would paint outside the silhouette and grow the gem wings —
    which is precisely what the diamond's girdle did before this existed.
    """
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if 0 <= x < W and 0 <= y < H and px[y][x] != CLEAR:
                px[y][x] = c


def blob(px, pal, inside):
    """Fill wherever `inside(x, y)` holds, then light it from the upper left.

    The lighting is done by distance from the stone's own centre rather than by
    a fixed pattern, so one routine serves shapes as different as a marquise and
    a round brilliant without either looking like the other's leftovers.
    """
    for y in range(H):
        for x in range(W):
            if inside(x + 0.5, y + 0.5):
                px[y][x] = pal["mid"]
    # Shade: the lower-right half of the stone falls away.
    for y in range(H):
        for x in range(W):
            if px[y][x] == CLEAR:
                continue
            if not inside(x + 1.5, y + 1.5):
                px[y][x] = pal["sh"]
            elif not inside(x - 0.5, y - 0.5):
                px[y][x] = pal["lit"]
    return px


def cushion():
    """Sapphire: a squarish stone with rounded shoulders and a big flat table."""
    px = canvas()
    cx, cy = 9.5, 9.7

    def inside(x, y):
        # Superellipse — square enough to be a cushion, round enough not to be
        # the emerald's box.
        return abs((x - cx) / 7.6) ** 2.6 + abs((y - cy) / 7.9) ** 2.6 <= 1

    blob(px, SA, inside)
    facet(px, 6, 5, 13, 10, SA["lit"])   # table
    facet(px, 7, 6, 12, 9, SA["hi"])
    facet(px, 6, 11, 13, 11, SA["sh"])   # girdle line under the table
    facet(px, 8, 13, 11, 15, SA["mid"])  # pavilion catching a little light
    return outline_in(px, SA)


def marquise():
    """Amethyst: pointed at both ends, the most distinctive silhouette here."""
    px = canvas()
    cx, cy = 9.5, 9.5

    def inside(x, y):
        # Two circular arcs meeting at points top and bottom.
        return ((x - cx) / 5.4) ** 2 + ((y - cy) / 9.6) ** 2 <= 1

    blob(px, AM, inside)
    # A spine of facets down the long axis, which is what a marquise reads as.
    facet(px, 8, 4, 11, 14, AM["lit"])
    facet(px, 9, 6, 10, 12, AM["hi"])
    facet(px, 7, 9, 12, 9, AM["sh"])
    facet(px, 6, 6, 6, 12, AM["sh"])
    return outline_in(px, AM)


def pear():
    """Topaz: round at the bottom, drawn to a single point at the top."""
    px = canvas()
    cx, cy = 9.5, 12.0

    def inside(x, y):
        if y >= cy:
            return ((x - cx) / 6.6) ** 2 + ((y - cy) / 6.2) ** 2 <= 1
        # Above the belly it tapers linearly to the point.
        # Clamped: above the point there is no stone, and a negative width
        # raised to a fractional power is a complex number, not an empty shape.
        f = min((cy - y) / 9.0, 1.0)
        return abs(x - cx) <= 6.6 * (1 - f) ** 0.85

    blob(px, TO, inside)
    facet(px, 7, 10, 12, 15, TO["lit"])  # table, low on the stone
    facet(px, 8, 11, 11, 14, TO["hi"])
    facet(px, 7, 16, 12, 16, TO["sh"])
    put(px, 9, 4, TO["hi"])             # a glint on the point
    return outline_in(px, TO)


def brilliant():
    """Diamond: a wide crown over a short pavilion, the classic round cut."""
    px = canvas()

    def inside(x, y):
        if y <= 9.5:
            # Crown: a shallow trapezoid, widest at the girdle.
            return abs(x - 9.5) <= 3.0 + (y - 3.0) * 1.15 and y >= 3.0
        # Pavilion: tapering to a culet.
        return abs(x - 9.5) <= 8.4 - (y - 9.5) * 1.25 and y <= 16.5

    blob(px, DI, inside)
    facet(px, 6, 4, 12, 6, DI["lit"])    # table
    facet(px, 7, 4, 11, 5, DI["hi"])
    facet(px, 1, 8, 17, 9, DI["hi"])     # the girdle, the brightest line on it
    # Pavilion facets, alternating, so the underside sparkles rather than fades.
    for i, x in enumerate((4, 7, 10, 13)):
        facet(px, x, 10, x + 1, 13 - (i % 2), DI["lit"] if i % 2 else DI["sh"])
    return outline_in(px, DI)


def coin():
    """A disc on edge, with a rim. Round, so it never reads as a second gem."""
    px = canvas()
    cx, cy = 9.5, 9.5
    for y in range(H):
        for x in range(W):
            # Slightly oval, so it sits like a coin rather than a ball.
            d = ((x - cx) / 7.4) ** 2 + ((y - cy) / 8.2) ** 2
            if d <= 1:
                px[y][x] = AU["mid"]
            if d <= 0.62:
                px[y][x] = AU["lit"]
    # Rim shadow and a highlight on the upper left.
    for y in range(H):
        for x in range(W):
            if px[y][x] == CLEAR:
                continue
            d = ((x - cx) / 7.4) ** 2 + ((y - cy) / 8.2) ** 2
            if d > 0.86:
                px[y][x] = AU["sh"] if x > cx else AU["mid"]
    rect(px, 7, 5, 10, 6, AU["hi"])
    rect(px, 8, 11, 11, 12, AU["sh"])
    return outline_in(px, AU)


def to_image(px):
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for y in range(H):
        for x in range(W):
            img.putpixel((x, y), px[y][x])
    return img


frames = [
    to_image(emerald()),    # grade 1
    to_image(cushion()),    # grade 2
    to_image(marquise()),   # grade 3
    to_image(pear()),       # grade 4
    to_image(brilliant()),  # grade 5
    to_image(coin()),       # gold
]
sheet = Image.new("RGBA", (W * len(frames), H), (0, 0, 0, 0))
for i, f in enumerate(frames):
    sheet.paste(f, (i * W, 0))
sheet.save(OUT / "prop-loot.png")
print(f"prop-loot.png: {len(frames)} frames -> {sheet.width}x{sheet.height}")

s = 10
preview = Image.new("RGBA", (W * len(frames) * s, H * s), (0x0D, 0x0A, 0x13, 255))
preview.alpha_composite(sheet.resize((W * len(frames) * s, H * s), Image.NEAREST))
preview.save(Path(__file__).resolve().parent / "_preview-loot.png")
print("preview -> art-src/_preview-loot.png")
