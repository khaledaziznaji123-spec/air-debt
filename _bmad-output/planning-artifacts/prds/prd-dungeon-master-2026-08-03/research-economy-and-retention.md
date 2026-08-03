---
title: "Research digest: gear curves, F2P economy tuning, retention benchmarks"
status: reference
created: 2026-08-03
---

# Research: gear curves, economy tuning, retention benchmarks

Web research digest gathered during PRD discovery. Reference material — not decisions.

## Grind-curve tuning: shipped numbers

**Vampire Survivors** — two-layer cost. Per-PowerUp base rises linearly (each rank adds the initial price: 200 → 400 → 600…). On top sits a *global* fee `⌊20 × 1.1^TotalBought⌋` that scales with every purchase across the whole shop. Totals: 27,148,513 gold to max everything, of which only 2,469,640 is base cost and **24,678,873 (91%) is the global fee**. Initial prices span 10 (Defang) to 10,000 (Revival, Charm, Seals); most items have 5 ranks. https://vampire.survivors.wiki/w/PowerUps

**Hades' Mirror of Night** — pure arithmetic: 500/750/1000/1250/1500/1750/2000/2250 = 11,000 Darkness per talent, +250 per rank. Breadth is gated separately by Chthonic Keys in tiers of 5 → 10 → 20 → 30, so cost never walls you — *access* does. Respec is cheap and refunds all Darkness. https://hades.fandom.com/wiki/Mirror_of_Night

**Rogue Legacy** — every Manor level raises all upgrade costs by +10 gold (+50 for weight); at Manor level 30 "Labor Costs" inflation applies to everything. Cautionary detail: Gold Gain traits are additive, so the first (~1,900g) needs ~17,000g of subsequent earnings to break even — **a ~10x payback period on the economy item**. https://rogue-legacy.fandom.com/wiki/Upgrades

**Archero** — one gear piece from L1→60 costs 817,500 coins + 3,561 scrolls. Deconstructor of Fun banked the game at ~$35M IAP in 3 months but flagged the failure mode directly: meta systems bolted on late, chest incentives decay on maturation, and players end up "with a pile of coins and unusable items." https://www.deconstructoroffun.com/blog/2019/8/9/why-archero-banked-25m-but-leaves-25m-hanging-hlx9n

**Industry tuning heuristic:** work backwards from pacing — "if players should upgrade every two days and earn 200 coins/day, the upgrade costs ~400." Documented top cause of mid-game churn is *back-loaded stinginess* — earn rate failing to track cost escalation. https://machinations.io/articles/game-economy-design-free-to-play-games

## "Always one purchase away"

The mechanism is the near-miss effect: near misses recruit win-related brain circuitry and raise motivation as much as wins do. Note the precedent — the Nevada Gaming Commission's 1989 ruling banned engineering near-miss frequency above chance. Deliberately setting prices just above a player's balance is the same lever with regulatory history behind it. https://www.psychologyofgames.com/2016/09/the-near-miss-effect-and-game-rewards/

## Retention and conversion benchmarks (2025)

GameAnalytics, all mobile: **D1** top quartile 26.5–27.7% (down from 28–29% in 2023), bottom quartile 10–11.5%; iOS 31–33% vs Android 25–27%. **D7** median 3.4–3.9%, top quartile 7–8%. **D28**: 75% of projects under 3%. Median daily playtime 22 min; session 5–6 min (top quartile 8–9); ~4 sessions/day, midcore 6–7. https://gamedevreports.substack.com/p/gameanalytics-mobile-gaming-benchmarks

Conversion: **1.9% of mobile game users pay in a given month** (AppsFlyer); freemium generally 2–5%; top 10% of payers drive 65–80% of midcore revenue. https://maf.ad/en/blog/mobile-game-conversion-rates/

**Browser is measurably worse.** RevenueCat data: external web checkout cuts initial conversion **25–45%** vs native IAP; app-native flows convert 27–30% where web checkout does 17–19%. Poki ~30M MAU; CrazyGames ~30M MAU / 300M plays per month, both ~50/50 net ad revenue share; CrazyGames gates full launch on playtime (10+ min average) and retention. Rewarded video carries the highest eCPM on web. https://docs.crazygames.com/resources/basic-launch-metrics/

## Cosmetics as primary revenue

Skins run **50–70% of revenue** where well implemented; Fortnite, Roblox and League sit near **80%**. Caveat worth holding onto: in Path of Exile the top MTX categories are **stash tabs** — convenience, not cosmetic — alongside weapon effects. The cosmetic-purity story is partly myth. https://massivelyop.com/2015/06/15/an-exclusive-chat-with-path-of-exiles-chris-wilson/

## Implications flagged by the research (not yet decisions)

1. **Split the curve like Vampire Survivors.** Keep individual gear prices near-linear so nothing reads as a wall, and put the real sink in a global escalation term tied to total purchases. One lever tunes pacing without retouching every item — and it is why VS never goes flat.
2. **Price in runs, not gold.** Our loot already scales with distance. Define the target as "3–5 runs per meaningful upgrade" and derive prices from measured run income per distance band. A linear cost curve against superlinear income makes runs-per-upgrade *fall* — reads as accelerating power, good, but flattens unless a global fee climbs.
3. **Consumable shortcut/skip items are the anti-Archero sink.** Archero's terminal state (coins with nothing to buy) is the failure mode for any finite gear tree. Consumables are the only sink that never saturates. Weight accordingly — and never let purchased gold buy them at a discount to earned gold.
4. **Do not ship a gold-gain upgrade with Rogue Legacy's payback math.** Any economy item must beat a direct power item within ~2–3 runs, or it is a trap players correctly refuse.
5. **Assume browser conversion at roughly half the 1.9% mobile figure.** The brief's ≥2% target may be optimistic for web. Plan for rewarded video as a likely primary revenue line at launch.
6. **⚠ Timing conflict worth naming.** Cosmetics carry 50–80% of revenue *only where they are seen*. Our visibility surfaces are leaderboards (v2) and PvP (v3). A cosmetics-primary model whose visibility arrives in v2/v3 is a real sequencing tension — flagged for the PRD and for the brief's business model.
