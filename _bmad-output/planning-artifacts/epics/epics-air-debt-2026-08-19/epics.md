# EPICS — Air Debt

**Written 2026-08-19, from the built product.**

The epics-and-stories pass was skipped: development ran straight from the PRD
and the architecture spine. So this is a reconstruction, not a plan that was
followed — every story marked **done** is done because the code exists and the
tests pass, not because a ticket was closed.

That makes it useful for exactly two things: knowing what is actually in there,
and having somewhere to put the next piece of work. Both are the reasons the
brief asks for it.

**Status key** — `DONE` · `PARTIAL` · `TODO`

**Verification**: 298 unit tests, 27 browser tests, typecheck, lint and build all
green as of 2026-08-19.

---

## EPIC 1 — The deterministic simulation core `DONE`

*The reducer everything else is built on. `ARCH AD-1`.*

| # | Story | Status |
|---|---|---|
| 1.1 | `step(state, intents) -> state`, pure, at a fixed 60Hz | DONE |
| 1.2 | No randomness anywhere — "coin flips" are integer hashes of tick and position | DONE |
| 1.3 | Abstract `Intents` vocabulary; the core never learns what a key is (`ARCH AD-6`) | DONE |
| 1.4 | `replay(seed, log)` reproduces a run exactly | DONE |
| 1.5 | ESLint determinism guard over `src/sim/**` and `src/config/**` | DONE |
| 1.6 | Input log records on change only, and replay holds intents forward across gaps | DONE |

> **The bug worth remembering:** `replay()` originally filled gaps with
> `Intent.None`, while the client logs only on change. Every honest submission
> would have been rejected as a forgery.

---

## EPIC 2 — Renderer as a pure view layer `DONE`

*PixiJS 8 over the simulation. Never the other way round.*

| # | Story | Status |
|---|---|---|
| 2.1 | Fixed 1280×720 internal canvas, stretched to fit | DONE |
| 2.2 | Camera follow with bounded lead and a margin backstop | DONE |
| 2.3 | Lighting: the lantern, forward-facing, upgradeable | DONE |
| 2.4 | Debug overlay — ticks, velocities, sprite-manifest check | DONE |
| 2.5 | 168 procedurally generated art frames (`art-src/*.py`) | DONE |
| 2.6 | Reduce-flashing damping | DONE |

---

## EPIC 3 — The dungeon and its five environments `DONE`

| # | Story | Status |
|---|---|---|
| 3.1 | Fixed layout, reshuffling encounters | DONE |
| 3.2 | Parkour · poison · water · rock · fire, hardest last | DONE |
| 3.3 | Water: swimming, diving, breath pockets, sharks | DONE |
| 3.4 | Eight shortcuts, each opened by a lever placed past the ground it skips | DONE |
| 3.5 | Shortcuts are permanent and survive a failed run | DONE |
| 3.6 | **The map is frozen** — `environmentLength` and `shortcutSpan` are literals | DONE |

> **The architectural inversion that mattered:** the map used to be *derived*
> from the time budget, so changing the air ceiling moved every piece and broke
> eighteen fixtures. Freezing the map made the budget *describe* the world
> instead of building it, after which the same change moved nothing.

---

## EPIC 4 — Defensive combat `DONE`

| # | Story | Status |
|---|---|---|
| 4.1 | 0.3s parry window; reflects arrows | DONE |
| 4.2 | 0.4s punish for mistiming | DONE |
| 4.3 | Stun as the only guard-breaker | DONE |
| 4.4 | 12 enemies built from the player's own verb set | DONE |
| 4.5 | Final boss with phases and a fireball that respects walls | DONE |
| 4.6 | Difficulty is verb breadth, never stat inflation | DONE |

---

## EPIC 5 — Economy and shop `DONE`

| # | Story | Status |
|---|---|---|
| 5.1 | Two currencies: graded gems, generic gold | DONE |
| 5.2 | **The 70% rule**, measured per grade | DONE |
| 5.3 | 30 shop items across gear, cosmetics and pets | DONE |
| 5.4 | Air tank: 30s base, ten +18s steps, 3.5-minute ceiling | DONE |
| 5.5 | Death and transformation cost the run's loot, never gear | DONE |
| 5.6 | Revive for gold, clock carrying on from where it stopped | DONE |

---

## EPIC 6 — Accounts and persistence `DONE`

| # | Story | Status |
|---|---|---|
| 6.1 | Sign up, sign in | DONE |
| 6.2 | Forgot password → one-time link → set new password | DONE |
| 6.3 | **Change password while signed in** | DONE (2026-08-19) |
| 6.4 | Display names, shown on boards; email never public | DONE |
| 6.5 | Save on the server, cached locally, pulled on open | DONE |
| 6.6 | RLS: the browser may READ its own row and nothing else | DONE |
| 6.7 | Every write goes through server code holding the service key | DONE |

---

## EPIC 7 — Server-authoritative runs and leaderboards `DONE`

| # | Story | Status |
|---|---|---|
| 7.1 | Server issues the seed, times the run, writes the row before a tick is played | DONE |
| 7.2 | Client submits the input log; server replays and credits from *its* result | DONE |
| 7.3 | Two boards — fastest boss kill, richest single run | DONE |
| 7.4 | All-time and weekly | DONE |
| 7.5 | One definition of each board, shared by client and server (`src/sim/score.ts`) | DONE |
| 7.6 | Identity from the bearer token, never the request body | DONE |
| 7.7 | Practice runs when the server is unreachable — playable, banks nothing, said up front | DONE |
| 7.8 | Ranked mode: maxed gear, all shortcuts, no potions, returns to the board | DONE |
| 7.9 | Admin runs rank, labelled, decided server-side | DONE |
| 7.10 | Tick-count cap on submitted logs (denial-of-service bound) | DONE |

> **The hole that was closed:** `bank()` accepted client-claimed loot — 300 gems
> and 4 legendaries per call, with no run id. It was deleted rather than
> patched, and replaced by `credit(userId, run)`, which is not reachable from
> any route.

---

## EPIC 8 — The tutorial `DONE`

| # | Story | Status |
|---|---|---|
| 8.1 | A built hall, no timer | DONE |
| 8.2 | One station per verb, each impassable without performing it | DONE |
| 8.3 | Step-back vs slide, stun, wall jump, smash-down all taught explicitly | DONE |
| 8.4 | Combat station with a real enemy | DONE |
| 8.5 | Shop station, funded with four grade-one gems | DONE |
| 8.6 | Leaves at any time; **ends at the home screen, not at itself** | DONE |
| 8.7 | Earns nothing real | DONE |

---

## EPIC 9 — Input, settings and audio `DONE`

| # | Story | Status |
|---|---|---|
| 9.1 | Fully rebindable keys, including removing a binding (`FR-9.2`) | DONE |
| 9.2 | Volume, mute, live during a run | DONE |
| 9.3 | Reduce flashing, debug overlay | DONE |
| 9.4 | Every noise synthesised at play time — no audio files | DONE |
| 9.5 | Per-monster voices and parry telegraphs | DONE |
| 9.6 | Interface audio: shop, buying, mode selection, settings, profile | DONE |

---

## EPIC 10 — Phone `PARTIAL`

| # | Story | Status |
|---|---|---|
| 10.1 | Touch → the same `Intents` the keyboard produces, OR'd together | DONE |
| 10.2 | Rotate prompt in portrait; chrome hidden in landscape | DONE |
| 10.3 | Pad hidden outside a run — hub, shop, revive, error | DONE |
| 10.4 | Arrangeable: drag to move, size all, size one, opacity, reset | DONE |
| 10.5 | Layout stored per device, like the keymap | DONE |
| 10.6 | **A control scheme actually designed for touch** | **TODO** |

> 10.6 is the honest one. The game is built around tenth-of-a-second timing
> windows and touch is the wrong instrument for them. More tuning will not fix
> it — it needs designing for, and it belongs after 1v1.

---

## EPIC 11 — Public site, support and trust `DONE`

| # | Story | Status |
|---|---|---|
| 11.1 | Landing page: the loop, five screenshots, the trust argument, sign-in at the bottom | DONE |
| 11.2 | Home screen with modes, shortcuts progress and balance | DONE |
| 11.3 | Support: **FAQs** and a **working contact form** | DONE (2026-08-19) |
| 11.4 | Direct channels — WhatsApp, phone, Discord | DONE |
| 11.5 | Privacy page: no tracking, one login cookie, and why there is no banner | DONE |
| 11.6 | Messages stored server-side first, emailed second | DONE |

---

## EPIC 12 — Monetisation `TODO`

*Nothing built. The economy it would sell into is finished and server-owned,
which had to be true first.*

| # | Story | Status |
|---|---|---|
| 12.1 | Payment provider and checkout | TODO |
| 12.2 | Paid cosmetics on top of the existing cosmetic-only shop | TODO |
| 12.3 | Ranked seasons and a season pass | TODO |
| 12.4 | Receipts, refunds, and the legal tidying (**the name is not trademark-cleared**) | TODO |

---

## EPIC 13 — 1v1 `TODO`

*The next mode. Two scavengers, one dungeon, one tank of air each — the
extraction decision becomes a decision about another person.*

| # | Story | Status |
|---|---|---|
| 13.1 | Lockstep or server-authoritative netcode over the existing deterministic core | TODO |
| 13.2 | Matchmaking and lobbies | TODO |
| 13.3 | Interference rules — what one player can do to the other | TODO |
| 13.4 | Ranked ladder, reusing replay verification | TODO |

---

## EPIC 14 — Survival, in 3D `TODO`

*A different game sharing the same spine. Hold a map against waves, ranked.*

---

## EPIC 15 — Native mobile `TODO`

*The end goal. The web build is the validation stage; the simulation already
runs anywhere with a clock.*

---

## What this list says about the project

Eleven epics done, one partial, four not started — and **the four not started
are all additions rather than rewrites**, because the hard architectural
problems (determinism, replay verification, a server-owned economy) were solved
before anything was built on top of them.

That ordering was the bet. It is why monetisation is a feature and not a
refactor.