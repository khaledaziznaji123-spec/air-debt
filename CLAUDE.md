# Dungeon Master (working title)

A free-to-play 2D action roguelite for browser. Timed dungeon extraction loop.

**This is a fresh project — no application code exists yet.** Planning artifacts only.

## Read these first

- [Product brief](_bmad-output/planning-artifacts/briefs/brief-dungeon-master-2026-08-03/brief.md) — the vision, scope, and business model
- [Addendum](_bmad-output/planning-artifacts/briefs/brief-dungeon-master-2026-08-03/addendum.md) — options considered, rejected alternatives, constraints
- [Memlog](_bmad-output/planning-artifacts/briefs/brief-dungeon-master-2026-08-03/.memlog.md) — every decision and its reasoning

## Method

This project uses **BMAD**. Completed: product brief. Next: PRD → UX → architecture → epics/stories → dev.

## Decisions already made — do not relitigate

- **Core loop**: fixed dungeon layout, encounters reshuffle every run. Timer caps how far in you get. Gear raises reachable distance. Win = reach the final boss with time left to fight it.
- **Death**: lose the run's loot, keep gear and purchased items.
- **Re-traversal**: solved by unlockable shortcuts + purchasable skip items. Load-bearing system.
- **Geometry**: mostly horizontal traversal, ascending near the end. "Depth" means distance in, not vertical descent.
- **Business model**: F2P. Cosmetics are primary revenue; purchasable gold only accelerates what could be earned. No purchase-exclusive power.
- **Competitive integrity**: 1v1 PvP uses fixed loadouts; Endless mode starts everyone from a common baseline. Purchased currency never influences either.
- **Scope order**: v1 single-player loop + economy → v2 monetization + Endless + leaderboards → v3 PvP. PvP is last on purpose.

## Hard constraints

- **Server-authoritative economy.** Currency is purchasable with real money, so a client that self-reports loot is a theft vector. Runs must be server-validated. This is not a later hardening task.
- **Web now, native mobile later.** Pick a renderer and game loop that can be wrapped for mobile rather than rewritten.
- **The name is a placeholder.** "Dungeon Master" is a Wizards of the Coast trademark and a 1987 FTL game. Must be replaced before any domain, art, store listing, or paid marketing spend.

## Stack direction

- Frontend: Next.js (App Router), deployed on Vercel
- Backend/data/auth: Supabase — needs a new project, do not reuse `lumis-cookies` or `plural space`
- Game renderer: **not yet decided** (Phaser vs. PixiJS vs. hand-rolled canvas) — architecture phase

## Next.js note

This project's Next.js may differ from training data. Read the relevant guide in
`node_modules/next/dist/docs/` before writing framework code, and heed deprecation notices.
