# Air Debt

A free-to-play 2D action roguelite for browser. Timed dungeon extraction loop.

**No application code exists yet.** Planning artifacts only.

## Read these first

- [PRD (final)](_bmad-output/planning-artifacts/prds/prd-dungeon-master-2026-08-03/prd.md) — the v1 spec. Start here
- [PRD addendum](_bmad-output/planning-artifacts/prds/prd-dungeon-master-2026-08-03/addendum.md) — hitbox model, asset sourcing, technical depth
- [PRD review](_bmad-output/planning-artifacts/prds/prd-dungeon-master-2026-08-03/review-rubric.md) — quality review and what is still owed
- [Product brief](_bmad-output/planning-artifacts/briefs/brief-dungeon-master-2026-08-03/brief.md) — vision, scope, business model
- Memlogs (`.memlog.md` in each artifact folder) — every decision and its reasoning

Artifact folders keep the `dungeon-master` slug from before the rename. The paths are
historical; the project is Air Debt.

## Method

**BMAD.** Completed: product brief, PRD. Next: UX → architecture → epics/stories → dev.

## Decisions already made — do not relitigate

Full detail in the PRD. The load-bearing ones:

- **Core loop**: fixed layout, encounters reshuffle. Win = reach the final boss with air left to fight it.
- **The timer is oxygen.** Its job is to degrade decision quality — it rushes the player into mistakes. Running out transforms the player into a monster.
- **30 seconds base air**, upgradeable in ten +30s steps to a 5.5-minute ceiling.
- **The max tank is deliberately insufficient.** Walking the whole dungeon at full air still loses. Shortcuts close the gap, so **shortcuts are the win condition**.
- **Shortcuts open only via a lever** placed past the ground they skip. Permanent progress can never be bought, skipped, or learned from a video.
- **Combat is defensive.** 0.3s parry (reflects arrows), 0.4s punish for mistiming, stun as the only guard-breaker. Enemies are built from the player's own verb set; difficulty is verb breadth, not stat inflation.
- **Two currencies**: gems are specific and graded; gold is generic and covers shortfalls only.
- **The 70% rule**: gold is spendable only once the player holds ≥70% of the required gems, measured **per grade**. Money never buys more than the last 30% of anything.
- **Death and transformation cost the same**: the run's loot. Gear and purchases are kept.
- **Scope order**: v1 single-player loop + economy → v2 monetization + Endless + leaderboards → v3 PvP.

## Hard constraints

- **Server-authoritative economy.** The server issues the run seed, times the run, and computes the reward. Client-claimed loot is a display value only. Balances are never client-written.
- **Deterministic fixed-timestep simulation.** Required by three things at once: identical timing across devices, replay validation, and tick-range hitbox authoring. Do not let simulation state leak into the renderer.
- **Zero fixed infrastructure cost.** Stateless serverless plus managed Postgres. No always-on process.
- **Web now, native mobile later.** The app is the end goal; the website is a validation stage.

## Stack

- Frontend: Next.js (App Router), deployed on Vercel
- Backend/data/auth: Supabase — **new project**, do not reuse `lumis-cookies` or `plural space`
- Renderer: **PixiJS as a pure view layer** over an independent TypeScript simulation. Phaser + Arcade physics is rejected — it pulls simulation state into the engine and forecloses replay validation.

## Naming

"Air Debt" was chosen 2026-08-04, replacing the "Dungeon Master" placeholder (a Wizards of the
Coast trademark and a 1987 FTL game). Screened against Steam and itch.io with no collisions
found. **Not yet cleared for trademark or domain** — do that before any spend on brand, domain,
or store listing.

## Next.js note

This project's Next.js may differ from training data. Read the relevant guide in
`node_modules/next/dist/docs/` before writing framework code, and heed deprecation notices.
