"""
Pull the masked walk cycle out of the reference sheet and normalise it into a
game-ready strip.

The source is a high-resolution illustration, so the work is: isolate frames,
strip the background, align every frame to a common baseline (or the character
jitters), downscale, then quantise the palette so the result reads as deliberate
pixel art rather than a blurry photo.
"""
import sys
from collections import Counter
from pathlib import Path
from PIL import Image

SRC = Path(sys.argv[1])
OUT = Path(sys.argv[2])
OUT.mkdir(parents=True, exist_ok=True)
TARGET_W, TARGET_H = int(sys.argv[3]), int(sys.argv[4])
PALETTE_SIZE = 24

im = Image.open(SRC).convert("RGBA")
W, H = im.size
px = im.load()

bg = Counter(px[x, y][:3] for y in range(0, H, 3) for x in range(0, W, 3)).most_common(1)[0][0]


def is_bg(c, tol=10):
    # Tight tolerance on purpose: the character's trousers are nearly as dark as
    # the backdrop, and a loose threshold eats his legs.
    return all(abs(c[i] - bg[i]) <= tol for i in range(3))


# The sheet has two labelled rows; the masked cycle is the lower half.
row_top, row_bot = int(H * 0.55), int(H * 0.94)

cols = [any(not is_bg(px[x, y][:3]) for y in range(row_top, row_bot)) for x in range(W)]
groups, start = [], None
for x, filled in enumerate(cols + [False]):
    if filled and start is None:
        start = x
    elif not filled and start is not None:
        if x - start > 40:  # ignore caption digits
            groups.append((start, x - 1))
        start = None

print(f"background rgb{bg}")
print(f"frames in masked row: {len(groups)}")

boxes = []
for x0, x1 in groups:
    ys = [y for y in range(row_top, row_bot) if any(not is_bg(px[x, y][:3]) for x in range(x0, x1 + 1))]
    # Trim the caption: keep the tallest contiguous run of content.
    runs, s = [], None
    for y in range(row_top, row_bot):
        hit = y in set(ys)
        if hit and s is None:
            s = y
        elif not hit and s is not None:
            runs.append((s, y - 1))
            s = None
    if s is not None:
        runs.append((s, row_bot - 1))
    y0, y1 = max(runs, key=lambda r: r[1] - r[0])
    # Caption digits survive the column scan; a character is far taller.
    if y1 - y0 < 150:
        continue
    boxes.append((x0, y0, x1, y1))
    print(f"  frame: x {x0}-{x1} ({x1 - x0 + 1}w)  y {y0}-{y1} ({y1 - y0 + 1}h)")

if len(boxes) != 6:
    print(f"WARNING: expected 6 frames, kept {len(boxes)}")

# A common scale for every frame, driven by the tallest, so relative size holds.
max_h = max(b[3] - b[1] + 1 for b in boxes)
scale = (TARGET_H - 2) / max_h  # 2px of headroom

frames = []
for x0, y0, x1, y1 in boxes:
    crop = im.crop((x0, y0, x1 + 1, y1 + 1))
    # Knock out the background so the sprite composites cleanly.
    data = [(0, 0, 0, 0) if is_bg(p[:3]) else p for p in crop.getdata()]
    crop.putdata(data)

    w = max(1, int(round(crop.width * scale)))
    h = max(1, int(round(crop.height * scale)))
    small = crop.resize((w, h), Image.LANCZOS)

    canvas = Image.new("RGBA", (TARGET_W, TARGET_H), (0, 0, 0, 0))
    # Align on the feet and the horizontal centre — misalignment here is what
    # makes a walk cycle look like it is sliding around.
    canvas.alpha_composite(small, ((TARGET_W - w) // 2, TARGET_H - h))
    frames.append(canvas)

# Quantise across all frames together so the palette is shared and stable.
sheet = Image.new("RGBA", (TARGET_W * len(frames), TARGET_H), (0, 0, 0, 0))
for i, f in enumerate(frames):
    sheet.paste(f, (i * TARGET_W, 0))

alpha = sheet.getchannel("A").point(lambda a: 255 if a > 110 else 0)
flat = Image.new("RGB", sheet.size, bg)
flat.paste(sheet.convert("RGB"), (0, 0), alpha)
q = flat.quantize(colors=PALETTE_SIZE, method=Image.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB")
q.putalpha(alpha)

q.save(OUT / "player-run.png")
print(f"wrote player-run.png {q.width}x{q.height} ({PALETTE_SIZE} colours)")

idle = q.crop((0, 0, TARGET_W, TARGET_H))
idle.save(OUT / "player-idle.png")
print(f"wrote player-idle.png {idle.width}x{idle.height}")

scale_up = 5
prev = Image.new("RGBA", (q.width * scale_up, q.height * scale_up), (0x15, 0x16, 0x1a, 255))
prev.alpha_composite(q.resize((q.width * scale_up, q.height * scale_up), Image.NEAREST), (0, 0))
prev.save(OUT / "_preview.png")
print("wrote _preview.png")
