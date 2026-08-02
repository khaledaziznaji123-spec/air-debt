---
title: "Product Brief: Dungeon Master (working title)"
status: final
created: 2026-08-03
updated: 2026-08-03
---

# Product Brief: Dungeon Master (working title)

> Working title only. "Dungeon Master" carries trademark risk (Wizards of the Coast; also the 1987 FTL game).
> A final name is required before launch or any spend on brand, art, or domain.

## Executive Summary

**Dungeon Master** is a free-to-play 2D action roguelite for browser, built on a timed extraction
loop. The player enters a fixed dungeon with a weak character and a countdown, fights inward,
grabs what they can carry, and races back out before the clock kills them. Everything they
escape with buys gear. Better gear means they get further next time.

The design bet is that a **fixed layout plus shuffled encounters** beats a randomly generated one.
Players learn the geography and build a route — that is the mastery. But monster count, variety,
and placement re-roll every run, plus a random modifier (double loot, darkness, exploding enemies,
faster timer), so the route can never be fully solved. The tension sits between the map you know
and the fight you don't.

The timer is the elegant part: it is simultaneously the pressure, the difficulty curve, and the
progression gate. How far in you can get is not a level you unlock — it is a function of how fast
you kill and how well you survive. Beating the final boss means finally being strong enough to
reach it *with time left to fight*. After that, Endless mode removes the upgrade ceiling and
scales forever against a public leaderboard.

## The Core Loop

1. **Enter** the dungeon with a countdown running
2. **Fight inward** — mostly horizontal traversal, ascending near the end
3. **Collect** gems and gold, scaling with distance reached
4. **Extract** before the timer expires
5. **Spend** on gear, consumables, and shortcut items
6. **Return** stronger, reach further, repeat

**Death** costs the entire run's loot. Equipped gear and purchased items are kept. The player
loses their haul, never their progress — tense enough to make extraction matter, forgiving enough
that a bad run doesn't make someone quit forever.

**Re-traversal** is solved with unlockable shortcuts and purchasable skip items, so late runs
don't waste the clock re-walking solved ground. This is load-bearing: without it, run length
grows unboundedly and the timer punishes players for progressing.

## Why Players Come Back

Four retention layers, roughly in the order a player meets them:

- **Near-miss pull** — dying 10 seconds from the exit, or watching a chest go by with no time to grab it, produces the "one more run" reflex the entire game rests on
- **Visible next goal** — the shop always shows the item just out of reach
- **Difficulty tiers** — Boss 1 unlocks Hard Mode, Boss 2 unlocks Nightmare; bosses scale, and so does their loot
- **Endless mode + leaderboard** — post-campaign, the ceiling comes off and scores go public

Achievements and a free training mode (practice with no timer pressure or loot stakes) sit
underneath as low-cost support.

## What Makes This Different

Honestly: **not novelty.** Every mechanic here exists somewhere. The differentiation is the
combination and the execution.

- **Fixed map, variable encounters** — most roguelites randomize geometry, which trades mastery for variety. This inverts it: keep the mastery, randomize the threat. Genuinely uncommon, and it makes runs feel like *skill* rather than *luck*.
- **Timer as progression axis** — depth is earned through combat efficiency, not unlocked through content gating. One system does three jobs.
- **Instant play** — no download, no install, no account wall to try it. A link is the whole funnel.

The real moat is feel: responsive combat, readable enemies, a satisfying extraction. That is
execution, and it cannot be specced — only tuned.

## Who This Serves

**Primary: short-session action-roguelite players on browser and mobile web.** They want a
complete, meaningful loop in 3–10 minutes. They play on a phone or a laptop between other
things. They have played Vampire Survivors, Slay the Spire, or Spelunky and want that shape
without a download or a purchase decision.

**Secondary: competitive/completionist players** who stay for Endless leaderboards and 1v1 PvP
after the campaign ends.

The audience is reachable through social media clip content — a highscore run or a
10-seconds-left extraction is inherently watchable, which is the distribution plan.

## Business Model

Free to play. Revenue from in-game purchases, with a deliberate constraint: **no purchase-exclusive
power.**

- **Cosmetics are primary revenue** — skins, pets, weapon appearances, special attack effects, trails
- **Gold and gems are purchasable**, but only ever accelerate what a player could earn by playing
- **Competitive modes are normalized** — 1v1 PvP uses fixed loadouts, and Endless mode starts every player from a common baseline. Purchased currency cannot influence either.

This protects the core loop. If money bought power outright, paying players would delete the
progression that makes the game fun, and non-paying players would feel cheated. Selling *time*
rather than *power* keeps both sides intact.

Normalization closes the remaining gap. Purchasable gold still converts to gear in the campaign,
which is fine — that is single-player. But it must not reach the two places where players are
measured against each other. A leaderboard that ranks spending is not worth sharing, and a
competitive mode that rewards spending loses its population. Normalizing costs nothing in revenue,
since cosmetics sell better in modes players take seriously.

**Scale requirement, stated plainly:** free-to-play converts at roughly 1–3% of players. This
model needs tens of thousands of monthly players to produce meaningful revenue. Distribution is
therefore the hardest problem in this project — harder than any technical piece — and the plan
is organic social media growth. Platform sequence: **web first, native mobile app later.**

## Success Criteria

**Player signals**
- Median session contains 3+ runs (the "one more run" reflex is working)
- D1 retention ≥ 30%, D7 ≥ 10% (healthy for the genre)
- ≥ 40% of players who finish a first run start a second
- Campaign completion by a meaningful share of engaged players

**Business signals**
- Paying conversion ≥ 2%
- Cosmetics outsell currency (confirms the loop is fun rather than bypassed)
- Organic sharing measurable: leaderboard/clip referrals as a real traffic source

**Technical**
- Loads and plays smoothly on mid-range mobile browsers
- Server-authoritative economy with no successful currency forgery

## Scope

The full concept is large. Proposed sequencing so something playable exists early rather than
many half-built systems existing late:

**v1 — the game is fun, or nothing else matters**
- Single-player timed dungeon loop, fixed layout, shuffled encounters
- Full economy: gems, gold, shop, gear (swords, bows, potions)
- Random modifiers
- Shortcuts and skip items
- Bosses + Hard Mode
- Free training mode
- Accounts and persistent progression

**v2 — monetization and endgame**
- Cosmetics store, payments, purchasable currency
- Nightmare Mode, Endless mode, leaderboards
- Achievements, pets

**v3 — competitive**
- 1v1 PvP with bot fallback

**Explicitly out for now:** native mobile app, guilds/social systems, seasonal content, user-generated levels.

PvP is deliberately last. It is the highest-risk piece — realtime netcode between two browsers is
a separate engineering problem from the single-player game — and its value depends entirely on
having a player base that only v1 and v2 can produce.

## Vision

If it works: a game people open on their phone for five minutes and lose an hour to. A leaderboard
worth fighting over. A steady cosmetics economy funding a stream of new monsters, modifiers, and
bosses on top of a dungeon everyone knows by heart. Then the same game, native, on mobile stores —
where the loop was always meant to live.

## Key Risks

1. **Distribution** — the business model requires scale that organic social growth may not deliver. This is the top risk, and it is not a technical one.
2. **Anti-cheat** — a browser client reporting its own loot is trivially forged. Because currency is purchasable, the economy must be server-authoritative or it is worthless. This constrains the architecture from day one.
3. **Combat feel** — the entire differentiation is execution quality, which cannot be guaranteed by planning.
4. **Timer tuning** — the gear, distance, and timer relationship *is* the game. Mis-tuned, it is either trivial or impossible.
5. **Scope** — the concept is large for a solo build. The v1/v2/v3 split is the mitigation.
6. **Naming** — the working title must be replaced before any brand spend.
