"""
The cave mouth: the drawing, doubled, with its threshold cropped.

    py art-src/extend-cave.py

Input:  art-src/cave-entrance-src.png   (the drawn boulder, 383x300)
Output: public/art/cave-entrance.png    (766x516)

This script used to do a great deal more, and all of it was wrong.

It grew a procedural cliff up from the drawing to reach the ceiling, cut that
cliff back so the player could walk in underneath, then cropped the drawing's
left mass away and faded its right lip out. Four operations, each one added to
fix damage from the one before, and every one of them left a straight edge
somewhere — a ruled diagonal under the cliff, a vertical seam down the left,
a fade line down the right. The drawing had none of those.

So it does almost nothing now. The renderer draws the ceiling and the rock
around the mouth, in the same idiom as the ground and reacting to the terrain,
which is work a baked sprite could never do well. What is left here is the
minimum the game actually needs from the drawing:

* Double it, at exactly 2. A fractional scale mixes one- and two-pixel blocks
  and reads as a mistake next to a crisp player sprite.
* Crop the drawn threshold under the mouth, so the opening's floor becomes the
  GAME's floor. Left on, the doubled lip stands 90 units tall behind the player
  and reads as a wall across the entrance.

Nothing else. No cuts, no fades, no generated rock.
"""
from pathlib import Path
from PIL import Image

HERE = Path(__file__).resolve().parent
SRC = HERE / "cave-entrance-src.png"
OUT = HERE.parent / "public" / "art" / "cave-entrance.png"

SCALE = 2

# The drawn threshold under the mouth. Everything below this row is the lip the
# game's own floor replaces.
CROP_BELOW = 258


def main() -> None:
    drawn = Image.open(SRC).convert("RGBA")
    drawn = drawn.crop((0, 0, drawn.width, CROP_BELOW))
    out = drawn.resize((drawn.width * SCALE, drawn.height * SCALE), Image.NEAREST)
    out.save(OUT)
    print(f"cave-entrance.png -> {out.width}x{out.height}")

    preview = Image.new("RGBA", out.size, (0x0B, 0x0E, 0x14, 255))
    preview.alpha_composite(out)
    preview.save(HERE / "_preview-cave.png")
    print("preview -> art-src/_preview-cave.png")


main()
