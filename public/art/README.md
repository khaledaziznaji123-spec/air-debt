# Art drop folder

Put PNG files here with the exact names below and they appear in the game
automatically. Nothing else needs changing — no code, no config, no rebuild
beyond the usual one.

A file that isn't here yet is not an error. The game falls back to coloured
rectangles for anything missing, so you can add art one piece at a time and
keep playing throughout.

## What the game is looking for

| Filename | Size | What it is |
|---|---|---|
| `player-idle.png` | **32 × 64** | The player standing still |
| `goblin-idle.png` | **32 × 48** | A goblin walking / at rest |
| `goblin-windup.png` | **32 × 48** | A goblin about to swing — see below |
| `tile-floor.png` | **32 × 32** | Ground tile, must repeat seamlessly left-to-right |

Transparent background. No scaling — these sizes map 1:1 to the game world, so
what you draw is what appears.

## `goblin-windup.png` is the important one

Your whole design is a 0.3-second read. This pose is what the player is reading.
It has to be **obviously different in silhouette** from `goblin-idle.png` — arm
drawn back, weight shifted, shape visibly changed. Not a colour change, not a
small detail: if someone squints at both images side by side, they should be
able to tell instantly which one means "a hit is coming".

If that pose isn't readable, the parry isn't fair, and the fairness is the game.

## Exporting from Piskel

1. **File → Export → PNG**
2. Choose **"Download as single file"** for a one-frame image (what you want for now)
3. Save it here with the exact filename from the table

For animations later, use the **spritesheet** option with **1 row**, and tell me
the frame count — the loader is already built to take strips.

Also use **File → Save → Download as .piskel** to keep an editable copy. The PNG
is the output; the `.piskel` is your source. Keep both.

## Sizes are checked, not assumed

If a file is the wrong dimensions the game still loads it, and the debug overlay
reports the mismatch rather than silently stretching it. Turn the debug overlay
on to see any warnings.
