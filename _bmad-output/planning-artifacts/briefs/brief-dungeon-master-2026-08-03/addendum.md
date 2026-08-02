---
title: "Addendum: Dungeon Master brief"
status: final
created: 2026-08-03
updated: 2026-08-03
---

# Addendum — Dungeon Master

Depth captured during the brief conversation that belongs downstream (PRD, architecture, economy
design) rather than in the brief itself.

## Monetization: options considered

Four models were weighed against the same problem — the game sells power, but earning power *is*
the game, so selling it deletes the fun.

| Option | Mechanism | Verdict |
|---|---|---|
| Cosmetics only | Skins, pets, effects. Zero power sold. | **Adopted as primary.** Protects loop and PvP fully. Lower ARPU, healthier game. |
| Sell time, not power | Buy gold that could have been earned. Nothing purchase-exclusive. | **Adopted as secondary.** Softens the problem without eliminating it. |
| Split modes | Sell power in campaign, normalize gear in PvP. | **Adopted, extended.** Applied to both PvP *and* the Endless leaderboard. |
| Sell power outright | Purchase-exclusive gear and stats. | **Rejected.** Highest short-term ARPU, kills the loop and the PvP population. |

### Competitive-integrity fixes considered

Once Endless mode with a public leaderboard entered the design, purchased gold threatened the
leaderboard the same way it threatened PvP.

- **Normalize both surfaces** — *adopted.* Fixed loadouts in PvP; common baseline in Endless.
- **Split free and paid leaderboards** — rejected. Honest, but fragments an already small player base into two thin ladders.
- **Daily cap on purchasable gold** — rejected. Slows the leapfrog without removing it; the leaderboard is still ultimately rankable by spending.

## Free-to-play scale math

Conversion in F2P sits at roughly 1–3% of players spending anything, with revenue concentrated in
a small fraction of those.

| Monthly players | Payers (~2%) | Revenue at ~$5 average |
|---|---|---|
| 1,000 | 20 | ~$100 |
| 10,000 | 200 | ~$1,000 |
| 100,000 | 2,000 | ~$10,000 |

Consequence: distribution is the binding constraint on this business, not development. Design
decisions that improve shareability (leaderboards, clip-worthy near-miss moments, visually
distinct modifiers) carry business weight beyond their gameplay value.

## The re-traversal problem

With a fixed layout and distance-based progression, a naive design restarts every run at the
entrance. Run 20 then spends most of its clock re-crossing ground solved fifteen runs ago — and
because the resource being consumed is *time*, the game punishes players precisely for progressing.
Run length grows without bound while new content per run shrinks.

Resolution: unlockable shortcuts plus purchasable skip items. This is load-bearing, not a
convenience feature. The PRD should treat shortcut placement and pacing as a core system with the
same weight as combat.

## Level geometry

Traversal is mostly **horizontal**, ascending near the end. "Depth" throughout the brief means
*distance reached*, not vertical descent. This matters for camera design, level authoring, and how
the map communicates progress to the player.

## Trademark note

"Dungeon Master" is Wizards of the Coast's term of art for D&D and was also a landmark 1987 FTL
game. For a commercial product with real-money purchases on a public URL, this is a live
takedown risk. Retained as working title, folder name, and repo name only. A final name is
required before: domain purchase, logo or key art commission, store listings, or any paid
marketing.

## Platform sequencing

Web first (Next.js), native mobile app later. This constrains the client architecture: the
renderer and game loop should be chosen so they can be wrapped for mobile rather than rewritten.
Flagged for the architecture phase.

## Anti-cheat constraint

Because currency is purchasable with real money, forged currency is equivalent to theft, and a
browser client that self-reports loot is trivially edited. The run must be server-validated and
the economy server-authoritative. This is an architectural constraint established at brief stage,
not a later hardening task.
