"""
Extract a labelled row of frames from a reference sheet into a game-ready strip.

    py art-src/extract-sheet.py <sheet.png> <row: top|bottom> <out.png> <w> <h> [frames]

Two things make this harder than cropping:

* Frames are different widths, and attack frames include slash effects that
  extend well past the body. Centring on the bounding box would make the
  character lurch sideways whenever an effect appears, so alignment uses the
  centroid of the LOWER body — the boots are always under the character and
  never carry effects.
* Scale must be shared across every frame, or the character changes size
  mid-animation.
"""
import sys
from collections import Counter
from pathlib import Path
from PIL import Image

SRC = Path(sys.argv[1])
ROW = sys.argv[2]
OUT = Path(sys.argv[3])
TARGET_W, TARGET_H = int(sys.argv[4]), int(sys.argv[5])
WANT = int(sys.argv[6]) if len(sys.argv) > 6 else 6
PALETTE_SIZE = 24

im = Image.open(SRC).convert("RGBA")
W, H = im.size
px = im.load()
bg = Counter(px[x, y][:3] for y in range(0, H, 3) for x in range(0, W, 3)).most_common(1)[0][0]


def is_bg(c, tol=10):
    # Tight on purpose: the trousers are nearly as dark as the backdrop, and a
    # loose threshold removes the character's legs.
    return all(abs(c[i] - bg[i]) <= tol for i in range(3))


if ROW == "top":
    y_lo, y_hi = int(H * 0.06), int(H * 0.46)
else:
    y_lo, y_hi = int(H * 0.55), int(H * 0.95)

cols = [any(not is_bg(px[x, y][:3]) for y in range(y_lo, y_hi)) for x in range(W)]
groups, start = [], None
for x, filled in enumerate(cols + [False]):
    if filled and start is None:
        start = x
    elif not filled and start is not None:
        if x - start > 30:
            groups.append((start, x - 1))
        start = None

boxes = []
for x0, x1 in groups:
    hits = {y for y in range(y_lo, y_hi) if any(not is_bg(px[x, y][:3]) for x in range(x0, x1 + 1))}
    runs, s = [], None
    for y in range(y_lo, y_hi + 1):
        hit = y in hits
        if hit and s is None:
            s = y
        elif not hit and s is not None:
            runs.append((s, y - 1))
            s = None
    if s is not None:
        runs.append((s, y_hi))
    if not runs:
        continue
    y0, y1 = max(runs, key=lambda r: r[1] - r[0])
    if y1 - y0 < 120:  # caption digits
        continue
    boxes.append((x0, y0, x1, y1))

print(f"{SRC.name} [{ROW}] -> {len(boxes)} frames")
if len(boxes) != WANT:
    print(f"  WARNING: expected {WANT}")

# Shared scale, from the tallest frame.
max_h = max(b[3] - b[1] + 1 for b in boxes)
scale = (TARGET_H - 2) / max_h

frames = []
for x0, y0, x1, y1 in boxes:
    crop = im.crop((x0, y0, x1 + 1, y1 + 1))
    crop.putdata([(0, 0, 0, 0) if is_bg(p[:3]) else p for p in crop.getdata()])

    w = max(1, round(crop.width * scale))
    h = max(1, round(crop.height * scale))
    small = crop.resize((w, h), Image.LANCZOS)

    # Horizontal anchor: centroid of the bottom fifth, which is boots and never
    # slash effects. This is what stops the character sliding under its own VFX.
    sp = small.load()
    band = range(int(h * 0.8), h)
    xs = [x for y in band for x in range(w) if sp[x, y][3] > 100]
    anchor = sum(xs) / len(xs) if xs else w / 2

    canvas = Image.new("RGBA", (TARGET_W, TARGET_H), (0, 0, 0, 0))
    canvas.alpha_composite(small, (int(round(TARGET_W / 2 - anchor)), TARGET_H - h))
    frames.append(canvas)

sheet = Image.new("RGBA", (TARGET_W * len(frames), TARGET_H), (0, 0, 0, 0))
for i, f in enumerate(frames):
    sheet.paste(f, (i * TARGET_W, 0))

# Quantise across the whole strip so the palette is shared and stable.
alpha = sheet.getchannel("A").point(lambda a: 255 if a > 110 else 0)
flat = Image.new("RGB", sheet.size, bg)
flat.paste(sheet.convert("RGB"), (0, 0), alpha)
q = flat.quantize(colors=PALETTE_SIZE, method=Image.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB")
q.putalpha(alpha)

OUT.parent.mkdir(parents=True, exist_ok=True)
q.save(OUT)
print(f"  wrote {OUT.name} {q.width}x{q.height}")

prev = Path(__file__).resolve().parent / f"_preview-{OUT.stem}.png"
s = 4
canvas = Image.new("RGBA", (q.width * s, q.height * s), (0x15, 0x16, 0x1a, 255))
canvas.alpha_composite(q.resize((q.width * s, q.height * s), Image.NEAREST), (0, 0))
canvas.save(prev)
print(f"  wrote {prev.name}")
