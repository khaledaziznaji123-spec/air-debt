"""
Split the six-frame attack strip into two distinct three-frame attacks.

The reference sheet already contains two different swings — an overhead cut with
a downward arc, and a thrust followed by a low sweep. Splitting rather than
inventing a second attack keeps both in the same hand and the same style, which
generating a new one procedurally would not.

  A: stance -> overhead wind-up -> downward slash
  B: thrust -> low sweep -> recovery
"""
from pathlib import Path
from PIL import Image

ART = Path(__file__).resolve().parent.parent / "public" / "art"
FW, FH = 88, 96

src = Image.open(ART / "player-attack.png").convert("RGBA")
frames = [src.crop((i * FW, 0, (i + 1) * FW, FH)) for i in range(src.width // FW)]
print(f"source: {len(frames)} frames of {FW}x{FH}")

for name, idx in (("player-attack-a.png", (0, 1, 2)), ("player-attack-b.png", (3, 4, 5))):
    out = Image.new("RGBA", (FW * len(idx), FH), (0, 0, 0, 0))
    for slot, i in enumerate(idx):
        out.paste(frames[i], (slot * FW, 0))
    out.save(ART / name)
    print(f"wrote {name}: frames {idx} -> {out.width}x{out.height}")
