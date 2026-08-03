---
title: "Research digest: run length and timer pressure in comparable games"
status: reference
created: 2026-08-03
---

# Research: run length and timer pressure

Web research digest gathered during PRD discovery. Reference material — not decisions.
Decisions derived from this are logged in `.memlog.md` and land in `prd.md`.

## Run length benchmarks

| Game | Run length | How enforced |
|---|---|---|
| Vampire Survivors | 30 min hard cap; meaningful part is first 15–25 | Reaper spawns at 30:00, +1 each minute after — timer *ends* you, isn't a fail-to-extract |
| Brotato | 15–30 min total, 20 waves of 20–90s (wave 1 = 20s, +5s/wave to 60s cap, wave 20 = 90s boss) | Per-wave countdown; shop between waves |
| 20 Minutes Till Dawn | 20 min | Survival timer |
| Halls of Torment | 30 min; "Hastening Sands" artifact cuts to 20 | Player-chosen shortening |
| Hell Clock (2025) | **7 min base, extendable to 15+** | Countdown ends run; pauses in boss fights/special encounters; boss kills grant minutes; skill tree adds base time; "Relaxed Mode" removes it |
| Loop Hero | 10–30 min | Player chooses when to retreat |
| Risk of Rain 2 | ~5 min/stage, loop by ~30 min | No timer — difficulty scales per minute (Drizzle 50%, Monsoon 150%) |
| Hades | 20–40 min typical; 8 min WR | Boss gate |
| Dead Cells | Timed doors at 2 / 8 / 15 / 19:30 / 26 min | Optional bonus gate, not a fail state; timer pauses in shops, transitions, treasure and lore rooms |
| Spelunky | 2:30 per level | Ghost spawns — anti-loitering, not a kill timer |
| Escape from Tarkov | Factory 15, Customs 35, most 30–60 | Timer expiry = lose everything outside secure container |
| ARC Raiders | 30 min cap, typical run 15–20 | Map wiped by missile at cap |
| Dark and Darker | ~10–15 min | Damage in final minute, death at zero; **exits don't appear until timer is below half** |
| Deep Rock Galactic | Mission variable + **5 min drop-pod escape** (3 min Point Extraction/Refining, 1 min Salvage) | Hard countdown; Molly drops arrow breadcrumbs along the route; pod doors open seconds before launch as a grace |
| Endless Dungeon | 60–90 min | Counterexample — too long for anything mobile |

## Patterns worth stealing

- **Timer as spendable budget, not a wall.** Hell Clock is the closest living model to our design: short base clock, boss kills refund time, permanent upgrades raise the base, clock *pauses* during scripted fights so players never lose to a cutscene. Crazy Taxi / OutRun is the ancestor — time is both reward currency and the only "continue."
- **Sub-run beats.** Brotato's real unit is a 20–90s wave, not the 20-minute run. Micro-timers give constant closure; the run-level timer sets the ceiling.
- **Timer that gates reward, not survival.** Dead Cells' timed doors add pressure only for players chasing the loot. No punishment for slow players, strong pull for fast ones.
- **Anti-loiter timers are a different job from run timers.** Spelunky's ghost exists to stop farming, not to end runs. Tuned differently.
- **Extraction tension comes from *information*, not distance.** Hunt marks the bounty carrier on everyone's map; Dark and Darker hides exits until half-time; Tarkov's secure container softens total loss. None make the walk longer — they make it *observed*.
- **The return trip is compressed, never re-walked.** DRG's drop pod lands near the player, not at the entrance, and Molly leaves a marked path. The 5-minute clock *is* the whole return trip. Player complaints are that 4–5 min is too long, not too short.

## Mobile session reality

Median mobile session is 5–6 min (average 5–8). Hypercasual sits under 3 min with 8–10 sessions/day; midcore runs 6–7 sessions/day, ~34 min/day. Players return 4–6 times daily.

**Our 3–10 min target is correct for the session, and is shorter than every shipped comparable's run.** Consequence: we are designing a genre-atypical run length and cannot copy anyone's pacing curve wholesale.

## Implications flagged by the research (not yet decisions)

1. **Target ~4–6 min baseline, ceiling ~10.** Follow Hell Clock's shape rather than Vampire Survivors': short base clock, gear/upgrades raise the base, boss kills refund time. This would make "gear raises reachable distance" literally a timer stat, turning progression into the timer economy.
2. **Chunk the run into 30–60s encounter beats** (Brotato). A 5-minute run needs ~6–8 discrete beats with visible resolution, or the clock reads as one undifferentiated blur on a phone.
3. **Pause the clock during anything the player doesn't control** — boss intros, loot pickup animations, shop/altar screens. Both Dead Cells and Hell Clock do this. Single biggest defence against the timer feeling arbitrary.
4. **Expiry should probably not be total loss.** Tarkov's secure container and Dead Cells' optional doors exist because binary wipe-on-timeout hurts retention. Note the counter-argument: on a 5-minute run a total wipe costs little time, which is also why it may not sting enough to drive the near-miss reflex. Tension may need to come from the loot delta rather than the clock.
5. **Extraction should cost time, not travel.** Consider an exit that spawns near the player (DRG drop pod) with a fixed 30–60s escape countdown, rather than re-walking inward geometry. Our shortcuts + skip items system is the right lever — priced in *seconds saved*, so the shop sells timer directly.

## Sources

Vampire Survivors 30-min cap — https://gamerant.com/vampire-survivors-30-minutes-reaper-boss-death-beat-kill/ ·
VS pacing analysis — https://delayedrespawnse.com/blog/does-vampire-survivors-respect-your-limited-play-time/ ·
Brotato waves — https://brotato.wiki.spellsandguns.com/Waves ·
Hell Clock timer — https://www.thegamer.com/hell-clock-beginner-tips-guide/ ·
Hell Clock design — https://bignerdgaming.com/2025/07/22/three-reasons-why-you-should-keep-the-timer-on-in-hell-clock/ ·
Dead Cells time doors — https://deadcells.wiki.gg/wiki/Time,_killstreak_and_no-hit_doors ·
Spelunky ghost — https://spelunky.fandom.com/wiki/Ghost_(HD) ·
RoR2 difficulty scaling — https://riskofrain2.fandom.com/wiki/Difficulty ·
DRG drop pod — https://deeprockgalactic.wiki.gg/wiki/Drop_Pod ·
DRG escape-length debate — https://steamcommunity.com/app/548430/discussions/1/3014556944186773934/ ·
Tarkov raid timers — https://cyberpost.co/how-many-minutes-is-a-tarkov-raid/ ·
ARC Raiders raids — https://www.xda-developers.com/arc-raiders-pc-review/ ·
Dark and Darker exits — https://steamcommunity.com/app/2016590/discussions/0/4340987242599488255/ ·
Hunt bounty visibility — https://huntshowdown.wiki.gg/wiki/Game_Modes/Bounty_Hunt ·
Hunt hidden extractions — https://www.crytek.com/news/devils-trail-transforms-hunt-showdown-1896 ·
Crazy Taxi time-extension design — https://crowence.com/2025/01/03/06-crazy-taxis-elegant-scoring/ ·
Mobile session benchmarks — https://www.gamigion.com/mobile-gaming-benchmarks-2025/ ·
Session length stats — https://playercounter.com/average-gaming-session-length-by-age-group/ ·
Loop Hero length — https://www.thegamer.com/loop-hero-completion-time/ ·
Halls of Torment run length — https://steamcommunity.com/app/2218750/discussions/0/3833171785694385131/
