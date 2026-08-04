# Art sources

The editable `.piskel` files. These are the originals — `public/art/` holds the
exported PNGs the game actually loads.

**Keep both.** The PNG is the output; the `.piskel` is what you can still change
your mind about. Losing the source means redrawing from scratch.

## Why they live in the repo

Piskel keeps recent sprites in **browser storage**, which is wiped whenever you
clear your browsing data. Its online accounts work today, but the project has
been dormant for years and is not somewhere to trust long-term work.

In here, art gets exactly what code gets: version history, and a copy on GitHub
that survives anything happening to this machine. Every past version stays
recoverable, so an experiment that goes wrong costs nothing.

The files are tiny — a 32×64 sprite is under a kilobyte.

## Workflow

1. Draw in Piskel
2. **File → Save → Download as .piskel** → save it here
3. **File → Export → PNG → Download as single file** → save to `public/art/` with the name the game expects
4. Commit

Step 4 is the one that makes it permanent. Until it is committed and pushed, it
only exists on this machine.

## Naming

Match the exported PNG, so source and output are obviously paired:

| Source | Export |
|---|---|
| `player-idle.piskel` | `public/art/player-idle.png` |
| `goblin-idle.piskel` | `public/art/goblin-idle.png` |
| `goblin-windup.piskel` | `public/art/goblin-windup.png` |
| `tile-floor.piskel` | `public/art/tile-floor.png` |

## Note

This repository is public, so anything committed here is publicly visible. The
exported sprites are already served publicly by the game, so the sources add
little exposure — but it is worth knowing.
