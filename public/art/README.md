# Art drop folder

Put PNG files here with the exact names below and they appear in the game
automatically. No code, no config, no rebuild beyond the usual one.

A file that isn't here yet is not an error. The game falls back to procedural
shapes for anything missing, so art can arrive one piece at a time and the game
stays playable throughout. Everything on the list is currently present.

There is no floor tile. The ground is not a flat strip any more — it has pits,
ledges and raised blocks — so it is drawn from the terrain rather than tiled,
and a repeating texture has nowhere to go.

## Most of these are generated, not drawn

Before editing a PNG here, check whether a script owns it. If one does, the
script is the source and editing the export loses the change the next time
anyone runs it.

| Script in `art-src/` | Owns |
|---|---|
| `generate-player.py` | every `player-*.png` and `knight-*.png` |
| `generate-goblin.py` | every `goblin-*.png` and `archer-*.png` |
| `generate-warden.py` | every `warden-*.png` |
| `generate-pets.py` | every `pet-*.png` |
| `generate-chest.py` | `prop-chest.png` |
| `generate-loot.py` | `prop-loot.png` |
| `generate-items.py` | `items.png` |
| `generate-menu-strip.py` | `menu-back.png`, `menu-front.png` |
| `extend-cave.py` | `cave-entrance.png`, from the hand-drawn `cave-entrance-src.png` |

## What the game is looking for

Animations are **strips**: frames laid left to right, each one the frame size
below, so a 6-frame 48×96 strip is a 288×96 file. One-frame sprites go through
the same path.

The authority is `SPRITE_MANIFEST` in
[`src/render/sprites.ts`](../../src/render/sprites.ts) — this table is a copy,
and if the two disagree, the manifest is right.

| Filename | Frame size | Frames |
|---|---|---|
| `player-idle.png` | 48 × 96 | 4 |
| `player-walk.png` | 48 × 96 | 12 |
| `player-run.png` | 48 × 96 | 8 |
| `player-attack-a.png` | 88 × 96 | 6 |
| `player-attack-b.png` | 88 × 96 | 6 |
| `player-block.png` | 48 × 96 | 2 |
| `player-wall.png` | 48 × 96 | 2 |
| `player-stun.png` | 48 × 96 | 5 |
| `player-death.png` | 48 × 96 | 6 |
| `player-transform.png` | 48 × 96 | 7 |
| `prop-chest.png` | 48 × 40 | 3 |
| `prop-loot.png` | 20 × 20 | 6 |
| `player-smash.png` | 48 × 96 | 4 |
| `player-slide.png` | 80 × 96 | 4 |
| `player-backstep.png` | 48 × 96 | 3 |
| `player-crouch.png` | 48 × 96 | 2 |
| `player-crouch-walk.png` | 48 × 96 | 6 |
| `player-hurt.png` | 48 × 96 | 1 |
| `goblin-idle.png` | 48 × 96 | 2 |
| `goblin-walk.png` | 48 × 96 | 6 |
| `goblin-windup.png` | 48 × 96 | 2 |
| `goblin-strike.png` | 48 × 96 | 2 |
| `goblin-stagger.png` | 48 × 96 | 1 |
| `archer-idle.png` | 48 × 96 | 2 |
| `archer-walk.png` | 48 × 96 | 6 |
| `archer-draw.png` | 48 × 96 | 3 |
| `archer-loose.png` | 48 × 96 | 2 |
| `warden-idle.png` | 160 × 176 | 2 |
| `warden-windup.png` | 160 × 176 | 2 |
| `warden-strike.png` | 160 × 176 | 2 |
| `warden-slam-windup.png` | 160 × 176 | 2 |
| `warden-slam.png` | 160 × 176 | 2 |
| `warden-stagger.png` | 160 × 176 | 1 |
| `cave-entrance.png` | 766 × 516 | 1 |

Transparent background, and no scaling — these map 1:1 to the game world.

`items.png` (21 frames of 32 × 32, the shop's shelves in `SHOP` order) and
`menu-back.png` / `menu-front.png` (320 × 180 each) are not in that table
because the game never loads them — they are CSS backgrounds, on the shop and
the home screen respectively. Both tile seamlessly left to right; anything drawn across the seam has
to be drawn on both edges or the loop shows.

The 48×96 frame is deliberately larger than the body it draws: the player's
hurtbox is 30×82 and a goblin's is 34×86, so hair, ears and a swinging cleaver
overhang the box and are not hittable. Draw into the overhang freely.

Several sheets are wider than 48, and the reason is the same each time: the pose
does not fit a standing body's box. The slide is 80 because a lying body is
about two and a half heads long. The two attacks are 88 because an arm swung out
straight plus the sword on the end of it is nearly twice the width of the man
holding it — at 48 the blade was cropped by its own frame, which quietly forced
every swing to be posed with the hand tucked in near the shoulder. Every sheet
is anchored centre-bottom, so a wider frame costs nothing but empty pixels; the
body stays in the same place on screen. The Warden is 160 × 176 against an
84 × 132 hurtbox for the same reason, several times over: a raised fist, two
shoulder brackets and a shockwave along the floor all have to fit somewhere and
none of them are hittable.

## `goblin-windup.png` is the important one

The whole design is a 0.3-second read. This pose is what the player is reading.
It has to be **obviously different in silhouette** from `goblin-idle.png` — arm
drawn back, weight shifted, shape visibly changed. Not a colour change, not a
small detail: if someone squints at both side by side, they should be able to
tell instantly which one means "a hit is coming".

If that pose isn't readable, the parry isn't fair, and the fairness is the game.

## Sizes are checked, not assumed

A file with the wrong dimensions still loads, and the debug overlay reports the
mismatch rather than silently stretching it. Turn the overlay on to see the
warnings, and the `18/19 loaded` count for what is missing.

## Drawing by hand

For anything not owned by a script:

1. **File → Export → PNG → "Download as single file"** for one frame, or the
   **spritesheet** option with **1 row** for a strip
2. Save it here with the exact filename above
3. **File → Save → Download as .piskel** into `art-src/`, and commit both

The PNG is the output; the `.piskel` is the source. Losing the source means
redrawing from scratch — see [`art-src/README.md`](../../art-src/README.md).
