"""
Shared pixel-drawing engine for the sprite generators.

The techniques here are what separate the output from coloured boxes:

* **Three tones per surface.** Every material carries base, highlight and
  shadow, lit from the upper left. Flat fills are the clearest tell of
  generated art.
* **Selective outlining.** Edges take a dark tone from the region's OWN colour
  family rather than a uniform black. A black keyline reads as clip art.
* **Tapered limbs.** Constant-width strokes look mechanical; real limbs narrow
  toward the extremity.

Palettes and anatomy stay in the individual generators. This module only knows
how to put pixels down and light them.
"""
from PIL import Image


def rgb(h):
    """0xRRGGBB -> RGBA tuple."""
    return ((h >> 16) & 255, (h >> 8) & 255, h & 255, 255)


class Canvas:
    """
    A pixel buffer with lighting.

    `shade_map` maps a base colour to (highlight, shadow).
    `outline_map` maps any colour to the tone its edge should take.
    """

    def __init__(self, w, h, shade_map=None, outline_map=None, fallback_outline=None):
        self.w, self.h = w, h
        self.px = [[None] * w for _ in range(h)]
        self.shade_map = shade_map or {}
        self.outline_map = outline_map or {}
        self.fallback_outline = fallback_outline

    def set(self, x, y, col):
        x, y = int(round(x)), int(round(y))
        if 0 <= x < self.w and 0 <= y < self.h:
            self.px[y][x] = col

    def get(self, x, y):
        x, y = int(x), int(y)
        return self.px[y][x] if 0 <= x < self.w and 0 <= y < self.h else None

    def rect(self, x0, y0, x1, y1, col):
        for y in range(int(round(y0)), int(round(y1)) + 1):
            for x in range(int(round(x0)), int(round(x1)) + 1):
                self.set(x, y, col)

    def disc(self, cx, cy, r, col):
        for y in range(int(cy - r), int(cy + r) + 1):
            for x in range(int(cx - r), int(cx + r) + 1):
                if (x - cx) ** 2 + (y - cy) ** 2 <= r * r:
                    self.set(x, y, col)

    def taper(self, x0, y0, x1, y1, w0, w1, col):
        """A limb: thickness eases from w0 at the root to w1 at the tip."""
        steps = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 1
        for i in range(steps):
            t = i / max(steps - 1, 1)
            x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
            r = (w0 + (w1 - w0) * t) / 2
            for dy in range(int(-r - 1), int(r + 2)):
                for dx in range(int(-r - 1), int(r + 2)):
                    if dx * dx + dy * dy <= r * r:
                        self.set(x + dx, y + dy, col)

    @staticmethod
    def _hash(x, y, seed):
        """Deterministic 0..1 from a coordinate. Not random: the same sprite
        must texture identically on every run, or the art churns in git."""
        h = (int(x) * 374761393 + int(y) * 668265263 + seed * 2246822519) & 0xFFFFFFFF
        h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
        return ((h ^ (h >> 16)) & 0xFFFFFFFF) / 0xFFFFFFFF

    def mottle(self, base, col, density, seed=0, scale=2):
        """Break a flat fill into blotches of another tone.

        Only pixels already holding `base` are touched, so this can never spill
        past a silhouette. `scale` clumps the noise — at 1 it reads as static,
        which is worse than the flat colour it was meant to fix.

        Run AFTER shade() and BEFORE outline(): by then the rim lighting has
        turned the edge pixels into highlight and shadow tones, so only the
        interior still matches `base` and the lit edge survives intact.
        """
        for y in range(self.h):
            for x in range(self.w):
                if self.px[y][x] == base and self._hash(x // scale, y // scale, seed) < density:
                    self.px[y][x] = col

    def shade(self):
        """Light from the upper left. Applied after all shapes are down."""
        out = [row[:] for row in self.px]
        for y in range(self.h):
            for x in range(self.w):
                c = self.px[y][x]
                if c not in self.shade_map:
                    continue
                hi, sh = self.shade_map[c]
                if self.get(x - 1, y) is None or self.get(x, y - 1) is None:
                    out[y][x] = hi
                elif self.get(x + 1, y) is None or self.get(x, y + 1) is None:
                    out[y][x] = sh
        self.px = out

    def outline(self):
        add = {}
        for y in range(self.h):
            for x in range(self.w):
                if self.px[y][x] is not None:
                    continue
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    n = self.get(x + dx, y + dy)
                    if n is not None:
                        add[(x, y)] = self.outline_map.get(n, self.fallback_outline)
                        break
        for (x, y), c in add.items():
            if c is not None:
                self.set(x, y, c)

    def image(self):
        img = Image.new("RGBA", (self.w, self.h), (0, 0, 0, 0))
        for y in range(self.h):
            for x in range(self.w):
                if self.px[y][x]:
                    img.putpixel((x, y), self.px[y][x])
        return img


def save_strip(frames, path, w, h):
    """Lay frames left to right into one strip, the format the game loads."""
    sheet = Image.new("RGBA", (w * len(frames), h), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        sheet.paste(f, (i * w, 0))
    sheet.save(path)
    print(f"{path.name}: {len(frames)} frames -> {sheet.width}x{sheet.height}")


def save_preview(frames, path, w, h, scale=4, bg=(0x0B, 0x0E, 0x14, 255)):
    canvas = Image.new("RGBA", (w * len(frames) * scale, h * scale), bg)
    for i, f in enumerate(frames):
        canvas.alpha_composite(f.resize((w * scale, h * scale), Image.NEAREST), (i * w * scale, 0))
    canvas.save(path)
    print(f"preview -> {path.name}")
