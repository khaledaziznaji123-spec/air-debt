# Air Debt

A free-to-play 2D action roguelite for the browser, built on a timed dungeon
extraction loop.

You enter a fixed dungeon wearing an oxygen mask. The air supply *is* the run
timer. You fight inward, take what you can carry, and leave before the clock
runs out — because if it does, you breathe the virus that made the monsters and
become one of them.

**Status: pre-development.** The PRD is finalized; no game code exists yet.
This repository currently holds planning artifacts and an application scaffold.

## Start here

- **[PRD](_bmad-output/planning-artifacts/prds/prd-dungeon-master-2026-08-03/prd.md)** — the v1 specification
- [Addendum](_bmad-output/planning-artifacts/prds/prd-dungeon-master-2026-08-03/addendum.md) — hitbox model, asset sourcing, technical depth
- [Quality review](_bmad-output/planning-artifacts/prds/prd-dungeon-master-2026-08-03/review-rubric.md) — what holds up and what is still owed
- [Product brief](_bmad-output/planning-artifacts/briefs/brief-dungeon-master-2026-08-03/brief.md) — vision, scope, business model
- [`CLAUDE.md`](CLAUDE.md) — the decisions that should not be relitigated

Artifact folders keep a `dungeon-master` slug from before the project was named.
The paths are historical.

## The design in six lines

- **30 seconds of air to start**, upgradeable in ten steps to 5.5 minutes.
- **A maxed tank still is not enough** to walk the whole dungeon and beat the boss. Shortcuts close the gap, which makes them the win condition rather than a convenience.
- **Shortcuts open only from a lever** placed past the ground they skip — so permanent progress cannot be bought, skipped, or learned from a walkthrough.
- **Combat is defensive.** A 0.3-second parry that reflects arrows, a 0.4-second punish for guessing, and a slow stun as the only guard-breaker.
- **Enemies are built from the player's own verb set.** Difficulty is how many of your moves they have, not how much health.
- **Money never buys more than the last 30%** of anything — gold covers a gem shortfall only once you hold 70% of what a purchase needs, measured per grade.

## Architecture constraints

Three requirements collapse into one technical rule, so it is not negotiable:
identical combat timing across devices, server-side replay validation, and
tick-range hitbox authoring all require a **deterministic, fixed-timestep
simulation** that is independent of the renderer.

```
input  →  src/sim  →  state  →  src/render  →  pixels
                ↑
          server-issued seed
```

| Path | Holds | Rules |
|---|---|---|
| `src/sim` | The game. Pure TypeScript, runs in browser *and* on the server | No `Math.random`, no `Date.now`, no transcendentals, no DOM. Enforced by ESLint |
| `src/render` | PixiJS view layer | Reads state, draws it. Owns nothing |
| `src/config` | Tuning tables | Everything the feel depends on, in ticks. Server-overridable at runtime |
| `src/app` | Next.js App Router | Routes and API |

See [`src/sim/README.md`](src/sim/README.md) for why the determinism rules are
absolute, and [`src/render/README.md`](src/render/README.md) for why Phaser was
rejected.

## Commands

```bash
npm run dev        # development server
npm run build      # production build
npm test           # unit tests, including the time-budget invariants
npm run typecheck  # tsc --noEmit
npm run lint       # eslint, including the src/sim determinism guard
```

`npm test` includes assertions that the game's time budget still holds — that a
maxed tank cannot win alone, that full shortcut coverage makes it winnable, and
that the last upgrade is not dead progression. A tuning change that breaks the
design fails the build.

## Stack

Next.js (App Router) on Vercel · Supabase for data and auth · PixiJS as a pure
view layer over an independent TypeScript simulation.

## A note on the name

"Air Debt" was chosen after screening against Steam and itch.io. It has **not**
been cleared for trademark or domain — do that before any spend on branding.
