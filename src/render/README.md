# `src/render` — the view layer

PixiJS lives here and nowhere else. This directory reads simulation state and
draws it. It never owns state, never decides anything, and never advances time.

PRD reference: **NFR-5.3**.

## The boundary

```
input  →  src/sim  →  state  →  src/render  →  pixels
                ↑
          server-issued seed
```

Data flows one way. If you find yourself wanting the renderer to tell the sim
something, that thing is an *input*, and it belongs on the input path.

## Why Phaser was rejected

Phaser with Arcade physics puts collision, movement and animation-driven state
inside the engine. That is convenient and it forecloses deterministic replay
validation (PRD FR-15.7), because the engine's internals become part of the
simulation and cannot be re-run headless on the server. PixiJS is a renderer and
nothing more, which is exactly what this design needs.

## Consequences worth remembering

- **Interpolation belongs here.** The sim runs at a fixed 60 ticks; the display may run faster. Smoothing between the last two sim states is a rendering concern and must not feed back into the sim.
- **The debug overlay is not optional.** A toggle that draws every active hurtbox, hitbox, and animation phase label. For a game whose defining skill is a 0.3-second read, "why did that hit me" has to be answerable in one keypress. See `addendum.md`.
- **Art is data** (PRD NFR-3.1). Sprites, animations and hitbox definitions load from data files so assets can be replaced without touching game logic — which matters because everything ships on CC0 placeholders first.
