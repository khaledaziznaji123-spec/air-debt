# Air Debt

A free-to-play 2D action roguelite for the browser, built on a timed dungeon
extraction loop.

You enter a fixed dungeon wearing an oxygen mask. The air supply *is* the run
timer. You fight inward, take what you can carry, and leave before the clock
runs out — because if it does, you breathe the virus that made the monsters and
become one of them.

> **Testing:** `air.testingOverride` in `tuning.ts` is set to 120 seconds so a
> run is long enough to walk the environment and look at it. The design value is
> 30, and the whole time budget is solved against 30 — set the override to
> `null` before drawing any balance conclusion from play.

**Status: playable, single-player, and with nothing behind it.** The run loop
works end to end — walk in, fight, open chests, walk back out with what you
carried. Everything it remembers, it remembers in memory: close the tab and the
balance is gone. `npm run dev`, then `/play`.

## Start here

- **[PRD](_bmad-output/planning-artifacts/prds/prd-dungeon-master-2026-08-03/prd.md)** — the v1 specification
- [Addendum](_bmad-output/planning-artifacts/prds/prd-dungeon-master-2026-08-03/addendum.md) — hitbox model, asset sourcing, technical depth
- [Architecture spine](_bmad-output/planning-artifacts/architecture/architecture-air-debt-2026-08-04/ARCHITECTURE-SPINE.md) — the `ARCH AD-*` decisions the code cites throughout
- [Quality review](_bmad-output/planning-artifacts/prds/prd-dungeon-master-2026-08-03/review-rubric.md) — what holds up and what is still owed
- [Product brief](_bmad-output/planning-artifacts/briefs/brief-dungeon-master-2026-08-03/brief.md) — vision, scope, business model
- [`CLAUDE.md`](CLAUDE.md) — the decisions that should not be relitigated

## What is built

- **Movement and combat** — the full defensive set: a parry and its punish, the
  slide and the sprint it carries into, the smash, and the stun guard-breaker.
- **Wall grab and wall jump.** Airborne and pressed into a wall, you catch it
  and keep sliding down at a third of terminal speed; jump from there and you
  are thrown up and away, chainable.
- **The shaft**, which is what needs it: a 420-unit spiked hole under a floating
  platform, past the rams. A standing jump clears 183 and one kick adds 163, so
  getting out takes the jump and two kicks — the first piece in the dungeon that
  a movement option is required for rather than merely useful in.
- **The Warden**, environment 1's mini-boss. It stands on the far exit with two
  archers strapped to its shoulders, and the exit does not work while it lives —
  the mouth always does, so meeting it with four seconds of air is a decision
  rather than a death. Two attacks with opposite answers, chosen by where you
  stand: a high cut you parry up close, and a two-fisted slam you jump from
  range. Beat it and the chest behind it unlocks.
- **Two ordinary enemies.** The goblin, with solid collision, a readable tell, a stagger
  when it is parried, and gravity — it falls into pits and jumps after the
  player onto low ledges. Jumping is a *verb* (FR-7.1), so an enemy without it
  still cannot follow, and its impulse is under the player's: height stays an
  advantage rather than becoming immunity.
- **One environment, built.** Ledges, spike pits, raised blocks, ladders,
  pressure-plate traps, and three moving hazards — a swinging blade, a ceiling
  crusher and a sliding saw — laid out as nine set pieces in a fixed rotation.
  The geometry does not reshuffle (FR-2); the encounters and chests do.
  Population is deliberately thin — about eighteen enemies, at most five awake
  at once, and none of them inside the Warden's arena. It was three times that,
  and the measurement that settled it was simple: a bot that walks right and
  swings at whatever is in front of it now reaches the boss on four seeds in
  six, without ever parrying or blocking.
  The moving hazards hold no state: their positions are a pure function of the
  tick, so the reducer and the renderer compute the same thing from the same
  number and a replay cannot disagree about where a blade was.
- **A roof that is geometry.** The ceiling used to be drawn by the renderer and
  unknown to the simulation, so a jump from a tall ledge went straight through
  it. `roofAt` now lives in `terrain.ts` and the player's head stops at it.
- **The dungeon's frame** — five environments sized from the time budget, seven
  shortcuts with their levers and doors, and chests whose contents are rolled
  from the run seed rather than at the moment they are opened.
- **The chute.** Shortcut 1 is not a door. Its lever opens the ground above it,
  and walking into the hole starts a ride you do not steer: down through the
  rock, along the sag, and out the far end launched into the air. It covers its
  2,180 units in about a third of the time the ground would take.
- **Death, and a second chance.** Being killed holds on the body, then offers a
  revive for 10 gold: full health, the same air, the run picks up where it fell
  over. Running out of air does not offer it — you would come back with zero
  air and transform again on the next tick — and it plays the transformation
  instead, which is the premise rather than a death.
- **The whole shop** — twenty-three items. Five weapons and five pieces of gear,
  both LADDERS of two to ten levels each costing more than the last; six potions
  restocked every run; and a cosmetics shelf of three pets and four suits of
  armour. A skin is a whole alternate sprite FAMILY rather than a tint — the
  generator takes a palette and a silhouette, so a knight gets pauldrons and a
  crested helm, the shroud gets a tall ragged hood and a needle, and the
  leviathan gets slab plate, horns and a cleaver — and a pet is drawn entirely by the view so
  it cannot touch a single thing the simulation decides. A loadout travels inside
  `SimState`, so a replay reproduces the fight it was played with rather than a
  different one — and progress is persisted, because it used to live in a React
  ref and every refresh silently reset it.
- **The loop** — air burns only inside; walking out banks the run's loot,
  dying or suffocating forfeits it. Two ways out (FR-4.2): back through the
  mouth, or on through the exit at the far end of the environment. A wall sits
  behind that exit, because the world stops where the content does.
- **The view** — PixiJS over the sim, a procedural cave, and a sprite pipeline
  in [`art-src/`](art-src/). Reference art the generators were drawn from is
  catalogued in [`art-src/references/`](art-src/references/).

## What is not

Read this before assuming a subsystem exists.

- **No server.** No run lifecycle, no replay submission, no Supabase — the
  `supabase/` directory is empty and there are no API routes. Balances and
  levered shortcuts live in a React ref, which is precisely what FR-15 and
  ARCH AD-10 say the client may never own. Every run accumulates a replay log
  and throws it away.
- **Developer mode**, from Settings on the home screen. Say the word and
  nothing can end a run: damage does not kill, the air does not run out, and the
  shop has more money than it has stock. It survives a reload and only the
  second phrase turns it off. It is a switch with a word on it and not a lock —
  but `SimState.god` travels with the run, so a server can refuse to credit
  anything made with it on. See [`src/app/admin.ts`](src/app/admin.ts).
- **One of four modes.** The home screen lists Story, PvP, Speed run and
  Survival, and only Story goes anywhere. The other three are drawn and marked
  SOON rather than hidden, because a player arriving should be able to see the
  shape of the game — but nothing behind them exists. The four corner buttons
  (Shop, Profile, Settings, Contact us) are in the same state.
- **No server, so no real persistence.** Progress is in `localStorage`
  ([`src/app/progress.ts`](src/app/progress.ts)), which survives a refresh and
  nothing else: it is per-browser, trivially editable, and exactly the account
  FR-15.8 and ARCH AD-10 say must be server-owned. That file is deleted rather
  than migrated the day there is a server.
- **Four of the five environments.** Only the first is built; `environmentsBuilt`
  is what stops the player walking into the rest. Because there is one
  environment, there is one grade of gem — the distance-weighted loot table
  underneath is complete and rolls the full range, but what it hands out is
  clamped to the bands the game has a use for, and the clamp lifts on its own.
- **One boss of three.** The Warden is built; the environment 2-5 mini-bosses
  and the final boss have time-budget entries and no behaviour. The bow is bound
  to a key and does nothing.
- **Goblins jump but do not climb.** They can follow onto a low ledge and no
  further — no ladders, no tall towers, no pathfinding. A goblin that jumps
  into a pit dies in it, which is the point: hazards kill enemies outright, so
  the answer to a crowd can be leading them over one.

Artifact folders keep a `dungeon-master` slug from before the project was named.
The paths are historical.

## The numbers

| | |
|---|---|
| Player | 100 health in **5 bars** of 20 |
| Sword | 10 — a goblin is 2 hits, an archer 1, the Warden 6 |
| Goblin | 20 health, hits for **half a bar** |
| Archer | 10 health, hits for **a full bar** |
| Warden | 60 health, hits for **a full bar** |
| Trap | no damage — takes you to your last bar, or kills you if you were already on one |
| Pit | the same floor, **and it throws you back out onto the edge**. Falling in on one bar ends the run |

Chests roll one of four, the same odds in every environment. What depth changes
is the *grade* of the stone, not the chance of a good roll.

| | | |
|---|---|---|
| trash | 15% | 1–2 gems |
| normal | 50% | 3–5 gems |
| better | 30% | 5–8 gems |
| legendary | 5% | 5 gold |

A chest that cost a climb comes out **one tier better** — trash becomes normal,
normal becomes better. Never legendary: terrain pays skill, and skill is allowed
to buy a reliably good chest but not the jackpot, or every legendary in the game
would come from the same few alcoves. Monsters have a **30% chance of one gem**,
rolled when the dungeon is laid out rather than when they die. The Warden pays
**2 gold**.

## The design in six lines

- **30 seconds of air to start**, upgradeable in ten steps to 5.5 minutes.
- **A maxed tank still is not enough** to walk the whole dungeon and beat the boss. Shortcuts close the gap, which makes them the win condition rather than a convenience.
- **Shortcuts open only from a lever** placed past the ground they skip — so permanent progress cannot be bought, skipped, or learned from a walkthrough. Most are doors; the first is a chute, whose lever opens the floor above it and whose ride ends by throwing you into the air.
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
