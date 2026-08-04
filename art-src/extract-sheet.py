"""
Extract a labelled row of frames from a reference sheet into a game-ready strip.

    py art-src/extract-sheet.py <sheet.png> <row: top|bottom> <out.png> <w> <h> [frames]

Frames are split using the CAPTION DIGITS, not gaps in the artwork. Slash arcs
bridge the space between frames, so gap-detection silently merges them and drops
exactly the frames with the biggest effects — the ones worth having. The digits
are always isolated and evenly spaced, so they are a reliable ruler.

Alignment uses the centroid of the bottom fifth of each frame. Boots sit under
the character and never carry effects, so this stops him lurching sideways
whenever an arc appears.
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
PALETTE_SIZE = 32  # generous, so bright spark colours survive quantisation

im = Image.open(SRC).convert("RGBA")
W, H = im.size
px = im.load()
bg = Counter(px[x, y][:3] for y in range(0, H, 3) for x in range(0, W, 3)).most_common(1)[0][0]


def is_bg(c, tol=6):
    # Tight: trousers are nearly as dark as the backdrop, and the faint outer
    # glow of a slash is only a few levels above it. Both must survive.
    return all(abs(c[i] - bg[i]) <= tol for i in range(3))


y_lo, y_hi = (int(H * 0.06), int(H * 0.48)) if ROW == "top" else (int(H * 0.53), int(H * 0.97))

rows = [sum(1 for x in range(W) if not is_bg(px[x, y][:3])) for y in range(y_lo, y_hi)]

# The row contains three horizontal bands: a title, the characters, and the
# caption digits. Split on empty rows and identify them by height — the title
# would otherwise be cropped in with frame 1 and wreck every frame's scale.
runs, s = [], None
for i, count in enumerate(rows + [0]):
    if count > 0 and s is None:
        s = i
    elif count == 0 and s is not None:
        runs.append((y_lo + s, y_lo + i - 1))
        s = None

if not runs:
    raise SystemExit("no content found in row band")

char_lo, char_hi = max(runs, key=lambda r: r[1] - r[0])
below = [r for r in runs if r[0] > char_hi]
cap_lo, cap_hi = below[0] if below else (char_hi, char_hi)
print(f"  bands: characters y {char_lo}-{char_hi}, captions y {cap_lo}-{cap_hi}")

# Digit centres give the frame ruler.
cap_cols = [any(not is_bg(px[x, y][:3]) for y in range(cap_lo, cap_hi + 1)) for x in range(W)]
digits, start = [], None
for x, filled in enumerate(cap_cols + [False]):
    if filled and start is None:
        start = x
    elif not filled and start is not None:
        digits.append((start + x - 1) / 2)
        start = None

print(f"{SRC.name} [{ROW}]: {len(digits)} caption digits")
if len(digits) != WANT:
    print(f"  WARNING: expected {WANT} digits, splitting evenly instead")
    cols = [any(not is_bg(px[x, y][:3]) for y in range(char_lo, char_hi)) for x in range(W)]
    xs = [x for x, f in enumerate(cols) if f]
    lo, hi = min(xs), max(xs)
    step = (hi - lo) / WANT
    digits = [lo + step * (i + 0.5) for i in range(WANT)]

# Slice at the midpoints between digits, so every arc stays with its own frame.
bounds = []
for i, c in enumerate(digits):
    left = 0 if i == 0 else int((digits[i - 1] + c) / 2)
    right = W - 1 if i == len(digits) - 1 else int((c + digits[i + 1]) / 2)
    bounds.append((left, right))

crops = []
for x0, x1 in bounds:
    ys = [y for y in range(char_lo, char_hi) if any(not is_bg(px[x, y][:3]) for x in range(x0, x1 + 1))]
    xs = [x for x in range(x0, x1 + 1) if any(not is_bg(px[x, y][:3]) for y in range(char_lo, char_hi))]
    if not ys or not xs:
        print("  WARNING: empty slice")
        continue
    crops.append((min(xs), min(ys), max(xs), max(ys)))
    print(f"  frame: x {min(xs)}-{max(xs)} ({max(xs) - min(xs) + 1}w)  h {max(ys) - min(ys) + 1}")

max_h = max(c[3] - c[1] + 1 for c in crops)
scale = (TARGET_H - 2) / max_h

frames = []
for x0, y0, x1, y1 in crops:
    crop = im.crop((x0, y0, x1 + 1, y1 + 1))
    crop.putdata([(0, 0, 0, 0) if is_bg(p[:3]) else p for p in crop.getdata()])

    w = max(1, round(crop.width * scale))
    h = max(1, round(crop.height * scale))
    small = crop.resize((w, h), Image.LANCZOS)

    sp = small.load()
    xs = [x for y in range(int(h * 0.8), h) for x in range(w) if sp[x, y][3] > 100]
    anchor = sum(xs) / len(xs) if xs else w / 2

    canvas = Image.new("RGBA", (TARGET_W, TARGET_H), (0, 0, 0, 0))
    canvas.alpha_composite(small, (int(round(TARGET_W / 2 - anchor)), TARGET_H - h))
    frames.append(canvas)

sheet = Image.new("RGBA", (TARGET_W * len(frames), TARGET_H), (0, 0, 0, 0))
for i, f in enumerate(frames):
    sheet.paste(f, (i * TARGET_W, 0))

# Keep soft-edged sparks: a high alpha cut erases exactly the glow we want.
alpha = sheet.getchannel("A").point(lambda a: 255 if a > 40 else 0)
flat = Image.new("RGB", sheet.size, bg)
flat.paste(sheet.convert("RGB"), (0, 0), alpha)
q = flat.quantize(colors=PALETTE_SIZE, method=Image.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB")
q.putalpha(alpha)

OUT.parent.mkdir(parents=True, exist_ok=True)
q.save(OUT)
print(f"  wrote {OUT.name} {q.width}x{q.height} ({len(frames)} frames)")

prev = Path(__file__).resolve().parent / f"_preview-{OUT.stem}.png"
s = 4
canvas = Image.new("RGBA", (q.width * s, q.height * s), (0x15, 0x16, 0x1a, 255))
canvas.alpha_composite(q.resize((q.width * s, q.height * s), Image.NEAREST), (0, 0))
canvas.save(prev)
print(f"  wrote {prev.name}")
