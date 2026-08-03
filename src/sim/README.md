# `src/sim` — the simulation

This is the game. Everything here is plain TypeScript with no DOM, no PixiJS, no
React, and no Node built-ins, so the identical module runs in the browser during
play and on the server when a run is re-simulated for validation.

PRD references: **NFR-2** (deterministic fixed-timestep simulation), **NFR-5.3**
(renderer is a pure view layer), **FR-15.7** (replay capture).

## Why the rules below are absolute

Three separate requirements collapse into one technical constraint:

1. **FR-9.5** — combat timing is identical on PC and phone. A 0.3-second parry cannot vary with frame rate.
2. **FR-15** — the server re-computes rewards, and later re-simulates runs from seed + input log. That only works if the same inputs always produce the same result.
3. **Hitbox authoring** — attack windows are authored as tick ranges, which needs a stable clock.

Break determinism and all three fail at once, silently, in ways that surface as
players losing loot to false positives.

## Rules

**Never, inside this directory:**

- `Math.random()` — unseedable and engine-specific. Use `createRng()` from `./rng`.
- `Date.now()`, `performance.now()`, `new Date()` — the sim has no concept of wall-clock time. It advances in ticks.
- `Math.sin`, `Math.cos`, `Math.pow`, `Math.exp`, `Math.atan2` — transcendentals are explicitly implementation-defined and differ across platforms. Use lookup tables or integer math.
- Iteration over anything whose order is not guaranteed. `Map` and `Set` preserve insertion order; plain-object key order does not for numeric-like keys. Sort explicitly when in doubt.
- DOM, `window`, `document`, `localStorage`, `fetch`.

**Always:**

- Advance in whole ticks at `TICK_HZ` (see `src/config/tuning.ts`). Never integrate against a variable delta.
- Take the seed as an argument. The sim never sources its own randomness.
- Keep accumulating quantities in integers where practical. Plain `+ - * /` on doubles is IEEE-754 deterministic; the danger is library calls and variable timesteps, not arithmetic.

Plain arithmetic is safe. Library math is not.

## Structure

| Path | Holds |
|---|---|
| `rng.ts` | Seeded PRNG and stream derivation |
| `types.ts` | Core simulation types |
| `index.ts` | Fixed-timestep stepper and public surface |

## Enforcement

`eslint.config.mjs` carries a `src/sim/**` override that fails the build on
`Math.random`, `Date.now`, `performance.now`, and the transcendental `Math`
functions. It is a guardrail, not a proof — determinism drift is easiest to
catch with a test that re-runs a fixed seed and input log and compares the final
state hash. Add that test as soon as there is a sim worth hashing.
