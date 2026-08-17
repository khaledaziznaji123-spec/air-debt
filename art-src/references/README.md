# Reference art

Source images the generators were drawn from. **These are references, not
assets** — nothing here is loaded by the game. They live in the repo so the next
person changing a generator can see what it was aiming at, and so the intent
survives being described second-hand.

## Drop the files here

Three were supplied on 2026-08-06 and are described below. Save them with these
exact names so the notes line up:

| Filename | What it shows |
|---|---|
| `spiky-traps.png` | A sheet of spike traps: wall-mounted spiked rams on beams, ceiling-hung spike blocks on shafts, pivoting spiked platforms, and free-standing spiked pillars. Blue-white spikes, brown timber, heavy black keyline. |
| `chain-hazards.png` | Chains, a spiked ball, a circular saw blade, wooden and steel spike strips, and ceiling mounts the chains hang from. |
| `chest.png` | A chest in three states — closed, open and empty, open and paying out in gold. Orange staves, pale stone banding and lock plate, arched lid. |

They were also given a torch sheet, which nothing uses yet — it belongs with the
lighting work, whenever that happens.

## What they drove

- **`chest.png` → [`../generate-chest.py`](../generate-chest.py)**, closely.
  Orange wood in vertical staves, stone bands up the sides and along the foot,
  stone lock plate with a dark keyhole, shallow arched lid. All three states are
  reproduced. Two deliberate departures, both noted in the generator: the
  reference's heavy black keyline is replaced by this project's per-region dark
  outline, and the gold starburst is thrown by the renderer's particles instead
  of being baked into the sprite, so it can light the rock around it.

- **`spiky-traps.png` and `chain-hazards.png` → the moving hazards** in
  [`../../src/config/terrain.ts`](../../src/config/terrain.ts). The ceiling
  shafts and hanging spike blocks became the **crusher**; the chains and spiked
  ball became the **pendulum**; the saw blade became the **saw**. Those are
  drawn procedurally in the renderer rather than as sprites, because all three
  move every frame and their positions have to come from the same function the
  simulation uses to decide what they hit.

  The still-unused ideas worth coming back to: the **pivoting spiked platform**
  (a see-saw that tips when stood on), the **wall-mounted ram** that punches out
  of the rock horizontally, and the **spike strips** as a cheaper wall hazard
  than a full pit.

## Why these are not in `public/`

`public/art` is served to every visitor. These are someone else's artwork used
as reference, and the game does not need them at runtime — so they stay on the
source side of the line, with the `.piskel` files and the generators.
