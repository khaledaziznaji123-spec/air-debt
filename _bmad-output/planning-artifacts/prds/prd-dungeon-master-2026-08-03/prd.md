---
title: "PRD: Dungeon Master (working title) — v1"
status: final
created: 2026-08-03
updated: 2026-08-04
---

# PRD: Dungeon Master (working title) — v1

> Scoped to v1 only: single-player timed dungeon loop, full economy, shortcuts,
> bosses + Hard Mode, training mode, accounts and persistent progression.
> Monetization, Endless, leaderboards (v2) and PvP (v3) are out of scope except
> where v1 must not foreclose them.

**Working mode:** coaching path, journey-led entry. Sections land as they are worked.
Canonical decision trail is `.memlog.md`. Research reference lives in the three
`research-*.md` files alongside this one. Technical depth and sourcing options live in
`addendum.md`.

**On FR numbering:** IDs are stable identifiers assigned in the order decisions were made, and
are not renumbered when new requirements land in earlier sections. Read the section, not the
sequence.

---

## Glossary

Terms used precisely throughout. Downstream documents should use them identically.

| Term | Meaning |
|---|---|
| **Air** | The run timer, expressed diegetically as the player's oxygen supply |
| **Air tank** | The upgradeable container that sets starting air. Ten upgrade tiers, 30s to 5.5min |
| **Bag** | Everything a player is carrying on the current run, unbanked and at risk |
| **Depth run** | A run entered with the intent to push past the frontier |
| **Environment** | One of the dungeon's five sequential parts, each with its own monsters, traps and mini-boss |
| **Extraction** | Leaving through an exit, which banks the bag in full |
| **Frontier** | The boundary between ground the player has cleared many times and ground they have not |
| **Gem** | Specific currency, graded by the distance at which it is mined. Upgrade material, potion ingredient, and shop spend |
| **Gold** | Generic currency. Covers gem shortfalls only, under the 70% rule. Purchasable with real money |
| **Grade** | A gem's tier. Determines what it can upgrade and which recipes it satisfies |
| **Known ground** | Territory the player has cleared many times; traversed fast, low tension |
| **Lever** | The switch that permanently opens one shortcut. Sits past the ground that shortcut skips |
| **Mini-boss** | The fight ending each environment. Five in total, ~10 seconds each |
| **Modifier** | A per-run condition assigned with the seed that alters the run's terms |
| **Parry** | A block landed inside its ~0.3-second window. Damages a melee attacker; reflects an arrow |
| **Passage** | The potion family that moves the player — deeper, or to the nearest exit |
| **Resource run** | A run entered with the intent to gather rather than to progress |
| **Reshuffle** | The per-run re-randomization of monster placement, chest positions and trap locations |
| **Shortcut** | A permanently openable door that skips ground already cleared. Opened only by its lever |
| **Stun** | The slow, weak attack that freezes an enemy for ~1 second. The only guard-breaker |
| **The 70% rule** | Gold may only cover a shortfall once the player holds ≥70% of the required gems, measured per grade |
| **Transformation** | The fail state on reaching zero air. The player becomes a monster |

---

## World and Fiction

The dungeon is saturated with a **virus**. The virus is what turned everything living
down there into the monsters that now defend it — the corruption is literal, biological,
and ongoing.

The player enters wearing an **oxygen mask**. Clean air is finite, and that supply *is*
the run timer. Every second spent inside is air spent.

This matters beyond flavour. It converts the timer from an arbitrary game rule into a
survival constraint the fiction justifies, which is the strongest available defence
against a countdown feeling unfair. It also gives the enemy roster a coherent naming
logic — "corrupt archers" are infected, not evil.

### Fail states

Two, and they are different in kind:

| Fail state | Cause | Fiction |
|---|---|---|
| **Death** | HP reaches zero — killed by monsters or traps | Conventional death |
| **Transformation** | Oxygen reaches zero | The player breathes the virus and **becomes one of the monsters** |

Transformation is not a death screen with different art. It is the world's premise
applied to the player: you become the thing you were fighting.

**Both fail states carry the same penalty** (FR-21.1): lose the run's loot, keep gear and
purchased items. Transformation is not punished harder than death. The fiction carries the
drama; a harsher penalty would add frustration without adding meaning, and on a run this short
a heavier loss has nothing left to take.

---

## The Timer

### What the timer is actually for

The timer's job is **not** to end runs. It is to **degrade the quality of the player's
play**. The causal chain:

> timer → rushes the player → denies them focus → they make mistakes → they take damage → they die

Monsters kill the player. The timer is *why*. This reframes the brief, which described
the timer structurally (pressure, difficulty curve, progression gate) without naming the
mechanism. Running out of air is the **uncommon** failure; being killed *because* you
were hurrying is the common one.

Design consequence: the timer must be felt continuously, not merely checked. Tuning it is
tuning how rushed the player feels, which is a different target from tuning how long a run
lasts.

### FR-1 — Timer display

- **FR-1.1** The oxygen timer is displayed large, centred, at the top of the screen, visible at all times during a run.
- **FR-1.2** During the final 10 seconds, the screen corners darken progressively inward — a vignette closing as oxygen depletes. The effect is diegetic (hypoxia), not a UI overlay.
- **FR-1.3** On reaching zero, the player transforms into a monster and the run ends.

### FR-21 — Fail states and the clock

- **FR-21.1** **Death and transformation carry the identical penalty**: the run's loot is lost; gear and purchased items are kept.
- **FR-21.2** **The clock pauses during anything the player does not control** — boss intros, loot pickup animations, and any full-screen interstitial.

FR-21.2 is not a nicety at this run length. A two-second uncontrollable animation is **7% of a
base run**. Both Dead Cells and Hell Clock pause their clocks for exactly this reason, and the
research names it as the single biggest defence against a timer reading as arbitrary.

### FR-17 — The oxygen budget and the air tank

- **FR-17.1** A player begins with roughly **30 seconds of air**.
- **FR-17.2** The **air tank is upgradeable**, raising the starting budget permanently.
- **FR-17.3** Every run starts with the tank full.

Thirty seconds is far shorter than any comparable in the research — the nearest, Hell Clock,
starts at seven minutes. That is not an error; it is a different shape of game, and it has
consequences worth being deliberate about.

**The air tank is a second progression axis, and it may be the primary one.** Gear raises
reachable distance *indirectly*, by absorbing mistakes. The air tank raises it *directly*, by
buying seconds. Two tracks that both convert into depth:

| Track | Mechanism | What it feels like |
|---|---|---|
| **Gear** | Absorbs mistakes | "I survive things that used to kill me" |
| **Air tank** | Extends the budget | "I can get further before the run ends" |

**Everything in this game is now denominated in time.** Shortcuts save seconds. Passage buys
seconds. Exits spend the remaining ones. The air tank mints them. That is an unusually coherent
economy — one unit, five systems trading in it — and it is worth protecting as the design fills
in.

**The rhythm this produces is many short runs, not few long ones.** At a 30-second base, a
five-minute session is roughly eight runs, which means the between-run screen — shop, upgrades,
loadout — is proportionally a much larger share of the experience than in any comparable. That
screen is not a menu in this design. It is roughly half the game, and should be resourced as
such.

### FR-19 — The air tank curve

- **FR-19.1** Each environment takes roughly **60 seconds** to traverse and clear at average play.
- **FR-19.2** Each air tank upgrade adds **30 seconds**.
- **FR-19.3** The tank's ceiling is **5.5 minutes (330 seconds)**. Beyond that it cannot be upgraded.
- **FR-19.4** The final boss requires **more than 30 seconds** to defeat.
- **FR-19.5** The 60-second figure is **average play**. Skilled players clear faster; the surplus is the design's intended slack.

**Ten upgrades, and every two of them unlock one environment.** The curve is fully determined
by FR-19.1–19.3, and it is unusually legible:

| Tank | Upgrades | Reach at average play |
|---|---|---|
| 0:30 | base | Halfway through environment 1 |
| 1:00 | 1 | **Environment 1 cleared** |
| 2:00 | 3 | **Environment 2 cleared** |
| 3:00 | 5 | **Environment 3 cleared** |
| 4:00 | 7 | **Environment 4 cleared** |
| 5:00 | 9 | **Environment 5 cleared — the boss is reachable** |
| 5:30 | 10 | Boss reached with 30 seconds in hand |

Two upgrades per environment gives the player a rhythm they can feel and name: every second
upgrade is a milestone, and every odd one is visible progress toward the next.

### Why the maximum tank is deliberately not enough

At a full 5.5-minute tank, walking the whole dungeon costs 5 minutes and leaves **30 seconds** —
and the boss needs **more than 30 seconds** (FR-19.4). So a maxed-out player who walks the whole
way **still loses**.

This is the most structurally important number in the design, because of what it forces:

> **Shortcuts are not a convenience. They are the win condition.**

The game cannot be beaten by air alone. It can only be beaten by air *plus* the accumulated
time savings of levered shortcuts — and levers can only be earned by walking the ground they
skip (FR-3.2). Which means the path to victory is exactly:

1. Walk every stretch of the dungeon at least once, earning its lever
2. Max the tank
3. Use the shortcuts to convert that earned ground into the seconds the boss demands

The lever rule started life as an anti-walkthrough-video measure. It has ended up as the game's
progression spine. Nothing about the win condition can be bought, skipped, or watched on
YouTube — the only route runs through having personally cleared every part of the dungeon.

> **NOTE — the boss inverts the timer thesis, and that is probably correct.** The Timer section
> states that running out of air is the *uncommon* failure and being killed while hurrying is the
> common one. At the final boss that reverses: the fight is explicitly budgeted so that air is
> the binding constraint. The boss is the one place in the game where the clock kills you
> directly. Worth keeping deliberate — it makes the finale feel different from everything
> preceding it, which is what a finale should do.

### FR-20 — Fight durations and shortcut savings

- **FR-20.1** A **mini-boss** takes roughly **10 seconds**.
- **FR-20.2** The **final boss** takes roughly **60 seconds**.
- **FR-20.3** Each shortcut saves roughly **10–15 seconds**.

### The time budget, solved

These numbers close the system, and the arithmetic produces a hard constraint on how many
shortcuts the game can afford. Write **S** for total savings across every levered shortcut.

**The cost of a winning run** is: traverse five environments − S + the boss fight.
**The maximum tank** is 330 seconds. **Nine upgrades** is 300 seconds.

For the design to hold, S has to sit inside a window with two walls:

- **Winnable at all** — cost must fit in 330s, or a maxed player with every shortcut still loses.
- **The top of the curve must matter** — cost must exceed 300s, or the tenth upgrade is dead progression and the player wins without it.

- **FR-20.4** A mini-boss fight sits **on top of** its environment's 60 seconds. An environment therefore costs **70 seconds**.

The budget resolves as follows:

| | |
|---|---|
| Per environment (60s traverse + 10s mini-boss) | 70s |
| Reach the boss — five environments | 350s |
| Plus the final boss | **410s unaided** |
| Maximum tank | 330s |
| **Deficit shortcuts must cover** | **80s** |
| Ceiling before the tenth upgrade goes dead | 110s |
| **Target total savings (S)** | **80–110s** |

- **FR-20.5** Total time saved across all levered shortcuts must fall within **80–110 seconds**. Shortcut **count is derived from this budget**, not fixed independently.
- **FR-20.6** Working value: **seven shortcuts at roughly 13 seconds each (≈91s)**, distributed one or two per environment. Adjustable during tuning provided FR-20.5 holds.

This supersedes FR-2.2's "one or two per environment" as an independent range. Ten shortcuts at
15 seconds would save 150s, bringing a winning run inside a six-upgrade tank and making
**upgrades seven through ten dead progression**. The count is an output of the time budget.

> **NOTE:** all of this is computed at average play (Q44). A skilled player clears faster and
> arrives with more air, which is the intended slack — and is the concrete mechanism behind
> "a veteran can beat the game with bad gear" (Q22). The budget should be tuned so that
> *average* play at max tank with full shortcut coverage wins with a modest margin, leaving
> skill to widen it.

**Sixty seconds is average play, not optimal play** (FR-19.5). Skill and gear compress it, so a
strong player arrives at the boss with more air than the curve predicts. That headroom is
deliberate — it is the concrete mechanism by which a veteran beats the game with bad gear, and
it is what keeps a single mistake from being fatal.

**Air progression terminates at ten upgrades.** Past the ceiling, seconds cannot be bought and
the only remaining progression is gear and shortcut coverage. That is a clean end to the air
economy; what a maxed player wants next is v2 content — Endless and leaderboards.

**The air tank is the most monetization-sensitive item in the game**, which is why it prices on
its own steeper curve (FR-13.6) rather than sharing one with gear. Gold accelerating tank
upgrades means money accelerating the master resource. It stays inside the brief's constraint —
it only accelerates what could be earned — but it is the purchase where the 70% rule
(FR-13.2a) does its heaviest work.

---

## Dungeon Structure

### FR-2 — Five environments

The dungeon is divided into **five environments**. They are the dungeon's coarse structure —
the unit players name, measure themselves against, and describe runs in terms of.

- **FR-2.1** The dungeon consists of five environments, traversed in fixed order.
- **FR-2.2** Each environment contains **one or two shortcuts**. The total count is **derived from the time budget** (FR-20.5), not chosen independently — working value seven.
- **FR-2.3** Environment boundaries are legible in play. A player always knows which environment they are in and when they have crossed into the next.
- **FR-2.4** Traversal is **mostly horizontal**, ascending near the end. "Depth" means distance travelled inward, not vertical descent.

Five environments with one or two shortcuts each also fixes the granularity of permanent
progression: a player's standing is readable as "I have levered four of eight," and every
lever is a visible fraction of a known whole.

### FR-18 — What changes between runs

The layout is fixed. Three things reshuffle, and together they are the reason cleared ground is
still worth walking.

- **FR-18.1** **Monster placement changes.** The same room is not populated the same way twice.
- **FR-18.2** **Chest positions shuffle.** Where loot sits is not memorizable.
- **FR-18.3** **Traps move.** A trap is not in the same place from run to run.
- **FR-18.4** **Traps telegraph.** A trap gives a **hint** before it triggers, so a player who is paying attention can avoid it. Falling into a trap is a failure of attention, not of luck.
- **FR-18.5** The tell is **visual and audible**, and fires roughly **half a second** before the trap triggers. Reading it costs attention, not time — a player who is watching loses nothing by noticing.

FR-18.4 is the important one, and it keeps two earlier commitments intact:

1. **"Every hit has an answer" (FR-6.1) survives.** An invisible, unavoidable trap would be the one thing in the game that damages a player with no counterplay. A tell makes the trap readable, which makes falling in a mistake rather than a dice roll.
2. **It is the same tax the parry is.** Reading a trap tell costs attention — the same attention the 0.3-second parry window needs and the same attention the clock is stealing. A rushed player misses the hint exactly as they miss the block. That is the timer thesis applied to the environment instead of to combat, and it means traps are not a separate system but another surface for the same pressure.

This also retro-explains UJ-1: Maya falls into the trap on run 15 not because it was hidden, but
because she was hurrying.

### FR-23 — Run modifiers

Beyond the reshuffle, each run carries a **random modifier** that changes its character
wholesale. This is the brief's stated mechanism for keeping a fixed route from ever being
fully solved.

- **FR-23.1** Every run is assigned **one random modifier**, issued by the server with the run seed (FR-15.1).
- **FR-23.2** The modifier is **shown before the player commits**, so it can inform what potions they carry and whether to attempt a depth run at all.
- **FR-23.3** Modifiers alter the run's terms, not its geometry. They may change loot, visibility, enemy behaviour, or the clock.

`[ASSUMPTION]` The starting set is taken from the brief's own examples and has not been
confirmed in detail:

| Modifier | Effect | Interacts with |
|---|---|---|
| **Double loot** | All loot yields doubled | Raises the value of the bag, so the extraction decision bites harder |
| **Darkness** | Visibility reduced | Attacks trap tells (FR-18.5) and parry reads directly — the hardest modifier by design |
| **Exploding enemies** | Enemies detonate on death | Punishes melee finishers, pushes the player toward bow and spacing |
| **Faster timer** | Air depletes more quickly | The purest version of the game's core pressure |

Two design notes follow from the systems already specified:

- **Modifiers are the answer to resource-run monotony.** A resource run over mastered ground is the least tense content in the game (Run Intent); a modifier is what stops run 200 through environment 1 being identical to run 40.
- **Darkness is the modifier to tune most carefully.** Every other modifier changes the maths. Darkness attacks *readability*, which is the one thing FR-6.1 promises the player always has.

**What deliberately does *not* change** is the geometry — the rooms, the shortcut doors, the
lever positions and the exits. That fixity is what makes mastery legible and what makes a
levered shortcut a permanent, knowable asset. The reshuffle sits inside a stable frame, which is
the whole point: the player learns the *place* and is tested on the *encounter*.

### The known/frontier split

A run has two halves that feel completely different, and the boundary between them moves
outward as the player gets stronger:

1. **Known ground.** Territory the player has cleared many times. Traversed fast and with
   confidence. Low tension, low information value.
2. **The frontier.** Where the player crosses into territory they have not seen. Tension,
   exploration, and genuine risk begin here.

The brief modelled the dungeon as a single continuous distance axis. The frontier model is
more accurate to how a run is actually experienced, and it makes shortcut placement
tractable: **shortcuts follow the frontier outward.**

### Traversal in, extraction out

- **Shortcuts** compress the way *in* — unlockable, plus purchasable skip items (locked upstream in the brief).
- **Exits** compress the way *out*. Multiple exits are placed throughout the dungeon rather than a single entrance/exit. The player extracts through a nearby exit instead of re-walking the full distance.

Together these close the re-traversal problem from both ends. This converges with what
shipped extraction games arrived at independently — Deep Rock Galactic's drop pod lands
near the player rather than at the entrance.

### FR-3 — Shortcuts and the lever

A shortcut is **earned ground, not discovered ground**. Its purpose is to remove the
boredom of re-walking territory the player has already solved — not to grant a head start
into territory they have not.

This distinction has a concrete threat behind it. Shortcut locations are exactly the kind
of thing that ends up in a walkthrough video. A brand-new player who has watched one could
otherwise walk straight to a deep shortcut on run 1 and skip the entire game leading up to
it. The lever closes that.

- **FR-3.1** Every shortcut is a **locked door**. It is visible and legible from the near side, but cannot be opened from it.
- **FR-3.2** The **lever** that opens a shortcut sits on the **far side of the ground that shortcut skips**. The only way to reach a lever is to traverse the ground its shortcut would have saved you.
- **FR-3.3** Flicking the lever opens that shortcut **permanently, for all future runs**. The unlock is account-persistent and recorded server-side.
- **FR-3.4** Flicking is an **explicit player action**, not an automatic trigger on crossing a threshold. The player chooses to spend the moment.
- **FR-3.5** A shortcut whose lever has never been flicked is **inert for that account**, regardless of how the player learned it exists. Foreknowledge confers nothing.
- **FR-3.6** Shortcuts chain. Using an already-open shortcut to reach a deeper, unflicked lever is legitimate — the earlier ground was already earned once. Each shortcut has exactly one lever and is flicked exactly once, ever.

The rule is self-enforcing: the reward for clearing a stretch of dungeon is never having to
clear it again, and it is issued at the moment you finish clearing it.

### FR-4 — Exits and extraction

- **FR-4.1** Exits are distributed throughout the dungeon. All exits are **equivalent** — where the player leaves from carries no bonus and no penalty.
- **FR-4.2** Extracting through any exit **banks the entire run's loot**. Nothing carried is lost, taxed, or left behind.
- **FR-4.3** An exit is a **safe stop**, and reads as one. Its function in the design is to give the player a standing, always-available alternative to pushing their luck.

---

## Run Intent

**Not every run is trying to go deeper.** A player enters the dungeon with a purpose, and
there are two:

| | **A — Resource run** | **B — Depth run** |
|---|---|---|
| **Goal** | Stock up for future runs | Push the frontier |
| **Ground covered** | Known, shallow, mastered | Out past the known band |
| **Shortcuts** | Deliberately not used — the shallow ground *is* the point | Used, to skip solved ground and arrive deep with air left |
| **Loot wanted** | Volume of low-grade gems, potion ingredients | Grade, density, legendary rolls |
| **Extraction** | The plan from the start | A decision made under pressure |
| **Tension** | Low | High |

This is the correction that resolves the apparent conflict between the recipe rule (FR-11.3)
and the shortcut rule (FR-3). They do not compete for the same run. A veteran walking past a
shortcut they unlocked forty runs ago is not being punished — they are on a resource run, and
the shallow ground is what they came for. On a depth run the same player takes the same
shortcut without a thought.

### Consequences

- **Depth is not the only measure of a good run.** A run that never leaves environment 1 and comes home with a bag of grade-1 gems is a success. The game needs a second success axis, and progression readouts that only track distance will misreport half the runs played.
- **The exit is not always a compromise.** On a depth run, taking an exit means giving something up. On a resource run, the exit was always the plan. The same action carries opposite emotional weight depending on intent.
- **Gear and potions serve different run types.** Gear raises how far a depth run reaches. Potion ingredients are what a resource run brings back. The two feed each other in a cycle: resource runs fund the potions that make depth runs survivable.
- **Session length gets a natural short mode.** A resource run is bounded, safe, and predictable — well suited to a player with four minutes. Depth runs want the full clock and full attention. That is a real asset for a mobile-shaped session profile.

### FR-22 — Run intent is emergent, and the HUD serves both

- **FR-22.1** Run intent is **emergent**. The player is never asked to declare it, and the game does not branch on it.
- **FR-22.2** The HUD always shows **both a depth meter and a gem counter**, on every run, regardless of intent.

FR-22.2 is what makes emergent intent work. The player is never told there are two ways to
play — they are simply shown, at all times, both things a run can be measured by. A resource run
watches the gem counter climb while the depth meter sits still, and that reads as success rather
than failure because the readout treats them as equals.

This also settles the concern raised under Run Intent that "progression readouts which only
track distance will misreport half the runs played." They don't, because there are two readouts
and neither is subordinate.

Explicit intent — declared modes, objectives, per-mode bonuses — is deliberately deferred. It
costs UI, content and tuning, and nothing here forecloses it. If telemetry shows players never
discover resource runs on their own, that is the signal to make it explicit in v2.

### Why resource runs do not become a grind

The obvious failure mode — "two boring runs to afford one good one" — is headed off by three
properties of the design rather than by making resource runs exciting:

1. **Potions are optional.** They assist struggling players and unstick walled ones. A player who is neither does not need to farm at all.
2. **Depth runs also gather.** Going deep does not mean skipping chests. A depth run opens chests the whole way in and comes back with gems as a by-product.
3. **Deep chests roll shallow loot** (FR-10). Low grades arrive from the deep band too, so the shallow band is not their only source.

Resource runs are therefore **infrequent** — something a player chooses when they want to
stock up, not a tax they pay on a schedule.

And what makes one worth pressing play on is not the run itself. It is **anticipation of the
next one**. A resource run is charged by what it enables; the tension belongs to the depth run
it funds. That is a preparation phase, and preparation phases are only tolerable in proportion
to how rarely they are required — which is exactly why point 1 matters most.

---

## Combat and Enemies

Combat is the differentiator the brief names, and it is a **defensive** game. The player has
one sword combo, one bow, and one smash — and four ways to not get hit. The interesting
decisions are about the incoming attack, not the outgoing one.

### FR-5 — Controls

**Movement**

- **FR-5.1** Left and right run. Up jumps. Down crouches.
- **FR-5.2** Slide is **context-sensitive**. Pressed while moving forward, the player slides forward. Pressed while standing still — or while attacking — the player takes a **large step back**.

**Attacks**

- **FR-5.3** The sword button attacks, chaining into a **combo** on repeated presses.
- **FR-5.4** The bow is **two-stage**: the first press enters aim mode and displays the arrow's **trajectory**; the second press fires.
- **FR-5.5** Jump, then press down, to perform a **smash-down attack**.
- **FR-5.6** The **stun attack** has a longer wind-up than a normal attack and deals **substantially less damage**. On connecting it **stuns** the target: roughly **one second** in which the enemy cannot move or act, and the player attacks freely.

**Defence**

- **FR-5.7** The block button opens a **~0.3-second** window. An attack met inside that window is **parried**.
- **FR-5.8** A parried melee attack **damages the attacker**. A parried arrow is **reflected back at the archer that fired it**.
- **FR-5.9** A **mistimed block is punished**: the player cannot move or dodge for roughly **0.4 seconds** after the block ends. Blocking is a commitment, not a safety button.

**Cancelling**

- **FR-5.10** Any attack can be **cancelled** mid-swing by pressing slide or block. The player is never locked into a committed animation they can see going wrong.

> **Timing values are provisional.** 0.3s parry, 0.4s punish, 1s stun are starting points for
> playtest, not fixed constants. They are recorded because their *relationship* is the design —
> parry shorter than punish, stun long enough to convert — and that relationship should survive
> tuning even if the numbers do not.

### FR-6 — Every hit has an answer

- **FR-6.1** Every incoming attack has at least one defensive answer available: block, parry, slide, backstep, jump, or crouch.
- **FR-6.2** Damage taken is attributable to a specific missed input, and legible to the player as such.

This is the section that makes the timer thesis work. The Timer section claims
*timer → rushing → mistakes → damage → death* but could not name the mistake. Now it can:

> Maya is mid-combo on a goblin when an archer's arrow hits her. **She could have parried it**
> — the window was there, she was committed to her swing, and FR-5.10 even let her cancel out
> of it. She didn't, because she was hurrying. A second goblin closes behind her and she fails
> to slide clear.

**The parry window is 0.3 seconds. That is the exact quantity of attention the clock steals.**
Combat and the timer are not two systems in tension — the timer taxes precisely the resource
combat charges for. And because a mistimed block costs 0.4 seconds of paralysis (FR-5.9), a
rushed player who guesses instead of reading is punished harder than one who simply takes the
hit. Panic compounds.

### FR-7 — Enemies are built from the player's own verb set

Difficulty is not primarily a stat curve. **An enemy is defined by how many of the player's
moves it has.**

| Enemy | Verbs it has | Environment |
|---|---|---|
| **Goblin** | Move left/right, one basic attack | 1 |
| **Corrupt archer** | Ranged attack — the parry-and-reflect target | Early |
| **Late monster** | Moves, attacks, **slides**, and **sometimes blocks the player's attacks** | 5 |

- **FR-7.1** Every enemy is specified as a subset of the player's verb set.
- **FR-7.2** That subset **broadens with environment depth**.
- **FR-7.3** Late-environment enemies can slide and can block the player's attacks.
- **FR-7.4** The **stun attack (FR-5.6) is the answer to a guarding enemy.** Its slow wind-up and low damage are what it costs to open a guard the sword cannot.

The payoff is that the game never has to teach a second vocabulary. A player who has learned
to slide, cancel, and parry has simultaneously learned to *read* every enemy in the game,
because the enemies are made of the same parts. Environment 5 is hard because it fights the
way the player does.

### The stun attack is the game's risk verb

Stun is the only attack that asks the player to give something up before it pays:

| | Sword combo | Stun attack |
|---|---|---|
| **Wind-up** | Fast | Long |
| **Damage** | Full | Substantially reduced |
| **On connect** | Damage | ~1 second in which the enemy cannot act |
| **Beats a guard** | No | Yes |
| **When it fails** | Cheap | Expensive — you were committed and slow |

Two things make it interesting. First, the payoff is **conversion**: the stun itself barely
hurts, so its value is entirely in what the player does with the free second. Second — and
this is the connection back to the whole design — **a long wind-up is the single most
timer-sensitive input in the game.** A calm player lands the stun and converts. A rushed
player starts it, panics, and eats the recovery.

> **NOTE FOR PM:** watch for stun becoming the dominant opener. If a stun plus a free combo
> out-damages an unopened combo against *any* enemy, the correct play is to open with stun
> every time and the sword's speed advantage never matters. The intended cost is the wind-up
> being punishable when other enemies are on the field — which means the constraint is
> **encounter composition**, not the stun's own numbers. Belongs in the tuning model (Q9).

### FR-8 — Environment difficulty and mini-bosses

- **FR-8.1** Each environment has **its own monsters and its own traps**.
- **FR-8.2** Difficulty rises environment by environment, expressed primarily as enemy verb breadth (FR-7.2) rather than as inflated numbers.
- **FR-8.3** Each environment **ends with a mini-boss**, slightly stronger than that environment's regular monsters.
- **FR-8.4** **Mini-bosses can be stunned**, but for a **reduced duration** (roughly half the normal stun). The **final boss is immune to stun** and instead presents its own scripted openings.
- **FR-8.5** **There is no soft block.** A block either parries inside its window or fails entirely — no chip-blocking, no partial absorption. Defence is binary and timing is the whole skill.

Five environments, five mini-bosses. They give the run a rhythm of resolved beats — the
30–60 second chunking the research recommends, at a coarser scale — and they mark the
frontier in a way the player can name: "I can kill the environment 3 mini-boss now."

### FR-9 — Input and device

The game runs on two very different input surfaces and does not pretend otherwise.

- **FR-9.1** The game **auto-detects the device** and offers a **manual override**. The choice is remembered **per device**, not per account, since one account may play both.
- **FR-9.2** **PC** plays on the keyboard, across a range of keys. Bindings are **fully customizable**.
- **FR-9.3** **Phone** plays on on-screen controls, split by hand: **movement on the left, attacks on the right**.
- **FR-9.4** On phone, the on-screen controls are **customizable in size and position**. The player can resize individual buttons and move them.

Both surfaces are therefore player-configurable — rebindable keys on PC, a movable and
resizable layout on phone. That is the correct posture for a game where a 0.3-second read is
the defining skill: hands differ, phones differ, and a fixed layout would silently tax
whoever it fits worst.

FR-9.4 also does real design work rather than just being a settings screen. It is the
mitigation for the two problems the split layout alone does not solve:

- **Right-thumb density.** Sword, bow, stun and block all live under one thumb, with the bow wanting a second press to fire. Resizing lets a player enlarge the button their build leans on — a parry-heavy player grows block, a ranged player grows bow.
- **Occlusion.** The attack cluster sits where the fight tends to be. Repositioning lets the player move it clear of the space they need to read.

The consequence for UX is that the default layout is a *starting point*, not the design — and
the customization screen is a first-class surface, not a settings afterthought. It should be
reachable early, ideally during a run's first minutes rather than buried in a menu.

### Timing is identical on every device

- **FR-9.5** All combat timing values — parry window, mistime punish, stun duration — are **identical on PC and phone**. There are no per-device windows.
- **FR-9.6** Timings are tuned to be as fair as possible on **both** surfaces, which in practice means tuned against the harder one.

This protects something the brief locks in and v1 must not foreclose: leaderboards (v2) and
1v1 PvP (v3) both assume players are competing at the same game. A wider parry on touch would
have made cross-device competition meaningless, and it would have been discovered in v2, when
it is expensive.

The cost is accepted deliberately. Because touch has no tactile feedback and higher latency,
a universal window is effectively set by what is reachable on glass — so the keyboard player's
experience is defined by the phone player's ceiling. Two consequences follow:

- **Configurable touch controls stop being a convenience** (FR-9.4). They are the only remaining accommodation for the harder surface, which raises the customization screen from a settings nicety to a fairness mechanism.
- **The window cannot be tuned on desktop alone.** Whatever number playtest lands on has to be validated on a phone, because the phone sets it.

### Hazards

- **Traps.** Environmental hazard that can drop the player into an unplanned fight. In UJ-1 the trap is what converts a routine run into a crisis. Each environment has its own trap types (FR-8.1).

### What gear is actually for — Q22 resolved

**"Veteran" means: has finished the game, and plays perfectly, making no mistakes.**

That definition settles the apparent conflict with the brief's "gear raises reachable
distance," and it settles it cleanly:

- **Gear absorbs mistakes.** A perfect player makes none, so a perfect player needs no gear.
- **Everyone else has an error rate**, and their gear requirement is proportional to it.
- **Every veteran was new once** and needed gear to get good. Gear is the on-ramp to mastery, not a substitute for it.

So gear **raises the floor**; skill raises the ceiling. For any real player — anyone with a
non-zero error rate — gear does literally raise reachable distance, because it converts
mistakes that would have ended the run into mistakes that merely hurt.

This is also the strongest available answer to pay-to-win, and it is worth stating plainly for
the business model: **the ceiling of this game is skill-defined and cannot be bought.** Money
accelerates the on-ramp. It does not move the top.

Two consequences of this framing, both settled:

**Passage skips mini-bosses** (FR-12.6), so all five gate fights are avoidable by a player who
is walled. That is the intended function, not a hole — being stuck at one fight would otherwise
end the game for that player, and the escape costs them the mini-boss's loot and gold.

**A perfect player buys no gear**, so the top of the gear economy has few customers. That cohort
is small by definition, and what it wants is v2 content — Endless and leaderboards — rather than
more v1 purchases.

---

## Loot and the Extraction Decision

### Loot sources

- **Chests** — opened. Density **increases with distance**.
- **Gems** — mined. **Graded by distance**: grade 1 near the entrance, rising the deeper the player goes.

Gem grade gates what it can upgrade. Grade 1 gems only work on weak gear; higher grades
unlock more powerful upgrades. Distance is therefore not just *more* loot but *categorically
better* loot.

- **Legendary chests** — a small chance on any chest. Contains loot that should not be
  reachable until far later in the dungeon. This is the jackpot beat and the strongest
  single driver of "one more run."

### Chest quality is distance-weighted, not distance-locked

Variance runs **both ways**. A shallow chest can roll a legendary; a deep chest can roll
front-of-dungeon junk. Distance moves the odds, it does not fence the table.

- **FR-10.1** Every chest rolls against a distance-weighted table. Any chest can produce loot from any band.
- **FR-10.2** The upside case (shallow chest → legendary) and the downside case (deep chest → shallow junk) are both live at all times.

Two things follow. The jackpot stays possible everywhere, so no chest is ever safely
ignorable — and **depth runs passively supply low-grade gems**, because a player pushing deep
still opens chests the whole way in and some of them pay out shallow. Resource acquisition is
not confined to resource runs.

### The push-or-bail decision

The core moment-to-moment tension. Pushing deeper pays three ways at once:

1. **Better gem grade** — access to upgrades the player cannot otherwise buy
2. **Higher chest density** — more volume per minute
3. **Legendary chest chance** — more rolls at the jackpot

### What bailing costs — nothing

**Leaving is free.** Extraction takes no cut, exits are interchangeable, and everything the
player is carrying is banked in full. Bailing forfeits only what the player *would have*
earned: the deeper grades, the denser chests, the extra legendary rolls. Pure opportunity
cost.

The decision is therefore not "which side is punished." It is an asymmetry of **risk**, and
it sits entirely on the push side:

| | Bail now | Push deeper |
|---|---|---|
| **Loot already carried** | Banked, guaranteed | Wagered — death forfeits all of it |
| **Additional loot** | None | Better grades, denser chests, more legendary rolls |
| **What the player is deciding** | Take the sure thing | Bet a known quantity on an unknown stretch |

Every step past the exit re-wagers the whole bag. That is what makes carrying a good run
feel different from carrying a bad one: the more the run has already paid, the more pushing
costs to lose, and the harder the same exit is to walk past. A player at 1 HP holding a
legendary is in a genuinely different decision from a player at 1 HP holding nothing.

**Consequence for tuning.** The loop breaks in one specific way: if the marginal value of
the next stretch never justifies re-wagering the bag, the correct play is always to leave at
the first exit after the first good chest. Depth reward must outrun accumulated risk across
the whole distance axis, not just near the entrance. That is the constraint the numbers have
to satisfy, and it replaces Q2.

> **NOTE FOR PM — a second-order risk to watch in playtest.** Runs are short (30s to 5.5min),
> so losing a run's loot costs the player very little *time*. Death may therefore not sting
> enough to make banking feel like a real decision. If that proves true, the lever is **loot
> value per run, not penalty severity** — the bag has to be worth something before risking it
> means anything. The counter-metric for this is the share of players who ever choose an exit
> over pushing on.

### Gear legibility

**A purchase must be feelable in a fight.** In UJ-1, Maya survives at 1 HP specifically
because of a gear upgrade bought before the run — without it she dies. The upgrade proves
itself in a moment the player can perceive.

If gear only ever manifested as "you reached 40 metres further," players would not feel
they had bought anything. Reachable distance is the *outcome* of gear; survivability is how
gear is *experienced*.

**Gem-grade obsolescence is solved, and it was the economy's biggest risk.** Once a player
outgrows the entrance band, grade-1 gems would ordinarily become dead weight — precisely the
failure mode the economy research documents in Archero, where players end up holding currency
with nothing to spend it on. Two rules prevent it: potions require mixed grades (FR-11.3), and
top-tier gear requires low grades alongside high ones (FR-14.4). Low-grade gems are consumed at
both ends of the curve and never stop mattering.

**The currency split** is settled in **Currency and Economy**: gems are specific and do three
jobs; gold is generic and covers shortfalls under the 70% rule.

---

## Potions

Potions are the **preparation decision**. They are bought between runs, from gems already
banked, and carried in — so choosing them means predicting what the coming run will demand.
Everything else in the loop accumulates; potions are the one thing spent and gone.

Buying them between runs rather than inside the dungeon is forced by the clock: at a
30-second base budget (FR-17.1), a shop screen mid-run would consume a meaningful share of the
run even with the clock paused (FR-21.2). It also gives the between-run screen (Q42) real
decisions to hold, which it needs.

They are deliberately **expensive and deliberately powerful**. A potion should read as a real
sacrifice of banked value and a real change to the run's outcome. A potion cheap enough to
buy casually is not doing its job.

### Potions are an assist, not a requirement

This is the load-bearing framing, and it is easy to get backwards.

**A veteran can beat the game with bad gear and no potions.** Potions exist primarily for
players who are struggling — and for the specific moment when any player is stuck. They are a
difficulty floor, not a difficulty tax.

The catalogue is **small** by design, and potions are the **only** system in the game that
requires mixed gem types.

Consequences worth holding onto:

- **The game is beatable on skill.** Potions raise the floor rather than the ceiling, which means the assist never becomes the correct play for a strong player.
- **Resource runs stay infrequent.** If potions were mandatory, resource runs would be a standing tax on every player. Because they are not, farming happens when a player *wants* an assist — most often when walled.
- **Potions cannot be the economy's engine.** They are too rare to absorb a veteran's currency. Whatever carries the long-run sink, it is not this (see Q21, Q4).

### FR-11 — Potions

- **FR-11.1** Potions are bought with **gems**, in a **shop between runs**, and carried into the dungeon. No potion is purchasable with real money.
- **FR-11.1a** A player carries at most **two potions** into a run. The slot count may expand later as a progression reward.
- **FR-11.2** Potions are consumed within a single run. They unlock nothing and persist nothing.
- **FR-11.3** Every potion costs a **combination of gem grades**. High-grade gems alone cannot buy one — low grades are required ingredients, permanently.
- **FR-11.4** The catalogue is **small** and closed-ended in v1. Confirmed entries:

| Potion | Effect | Trades |
|---|---|---|
| **Restoration** | Heals the player to full | Gems → survivability |
| **Air** | Grants additional oxygen | Gems → time |
| **Passage** | Skips ahead to the next environment | Gems + loot → depth |
| **Passage (exit)** | Travels the player to the nearest exit | Gems → a banked run |

### The recipe rule and why it matters

FR-11.3 is the single most load-bearing line in the economy. Gems are graded by distance, so
without it every gem a player outgrows becomes dead weight — the Archero end-state the
research documents, where players sit on currency they cannot spend. Requiring a *mix* means
a grade-1 gem is as necessary on run 300 as on run 3.

Three consequences follow:

1. **The sink does not saturate — but it is small.** Potion demand is real and recurring rather than finite like a gear tree. It is also *optional*, so it absorbs low-grade gems steadily for struggling players and barely at all for veterans. That is a meaningful limit on how much of Q1 this actually solves (see Q21).
2. **Shallow ground keeps economic value.** Depth is no longer strictly dominant. The entrance band produces something the deep band cannot — though FR-7 means the deep band produces it sometimes too.
3. **It gives resource runs their reason to exist.** A player who needs grade-1 gems has a reason to walk ground they have earned the right to skip — not as a penalty, but as a different kind of run. See **Run Intent**.

### FR-12 — The Passage potion

- **FR-12.1** Drinking Passage advances the player to the **start of the next environment**, regardless of how much of the current one remains.
- **FR-12.2** If the player is **near the end** of the current environment, Passage instead carries them to the **nearest next shortcut door** — further in, past the boundary. Passage never delivers a trivial hop.
- **FR-12.3** Everything in the skipped stretch is **forfeited** — chests, gems, and any legendary sitting in it. Passage buys distance and pays for it in loot.
- **FR-12.4** A lever the player is carried over is **not flicked**. That shortcut remains closed. Passage costs the player the loot *and* the unlock.
- **FR-12.5** A Passage variant travels to the **nearest exit** rather than deeper — emergency extraction for a player about to run out of air.
- **FR-12.6** Passage lands the player **past that environment's mini-boss**. The mini-boss's loot and gold are forfeited along with everything else in the skipped stretch. This is the intended escape for a player repeatedly walled by the same fight.
- **FR-12.7** **Using an exit is free.** Passage is only ever a way to reach one faster, never a toll on leaving. The exit-Passage variant (FR-12.5) is priced so that drinking it is worthwhile **only when the bag is worth saving** — it should cost more than a poor run's loot, so a rescue is a real decision rather than a reflex.

### What Passage is for

Two stated purposes, and they are opposite ends of the same run:

- **Getting past a wall.** A player who keeps dying in the same section can buy their way past it. This matters more than it sounds: without it, a section the player cannot beat is a hard stop on the entire game. Passage converts a wall into a toll.
- **Getting out alive.** A player who has misjudged their oxygen can spend gems to reach an exit instead of transforming. It turns the worst outcome in the game into an expensive one.

The second is a safety valve on the fail state the entire fiction is built around, which makes
its price load-bearing — see Q17.

### Why Passage does not break the lever rule

Passage moves a player across ground they have not earned, which is exactly what FR-3 exists
to prevent. It survives that test on four counts:

1. **It is paid for in earned currency.** Gems come out of the run. Real money never buys a jump.
2. **It is consumable.** It rents distance for one run. Nothing is unlocked and nothing persists.
3. **It costs loot.** The player pays for the jump twice — once in gems, once in everything they flew over.
4. **It leaves levers unflicked** (FR-12.4). Ground crossed by Passage is not earned ground, and the game records it that way.
5. **It does not make the skipped ground survivable.** A new player who potions into environment 3 arrives underlevelled and dies there. Distance without gear is not progress.

The result is that permanent access stays strictly earned-by-traversal, while temporary
access is a costly tactical option. Those are two different economies and they should stay
that way.

### Passage as the mirror of the exit decision

The two in-run decisions run on one axis, in opposite directions:

| | Gives up | Buys |
|---|---|---|
| **Take an exit** | Depth, grade, legendary rolls | Certainty — the bag is banked |
| **Drink Passage** | Loot in the skipped stretch, gems spent | Depth, and the time to use it |

A player who has just found a legendary should be pulled hard toward the exit. A player who
has found nothing and is watching their oxygen should be pulled hard toward Passage. That
symmetry is the loop's decision structure, and it means both levers can be tuned against the
same quantity: what the bag is currently worth.

---

## Currency and Economy

Two currencies, and the difference between them is **specificity**.

### Gems — earned, specific, three jobs

A gem is a particular thing: a grade-3 gem is a grade-3 gem and nothing else. Gems carry
three roles, all established above:

1. **Graded upgrade material** — grade gates what a gem can improve
2. **Potion ingredients** — in mixed grades (FR-11.3)
3. **The run's live spend** — the only in-run purchasing power

### FR-13 — Gold, the universal currency

Gold is the **best** currency precisely because it is not specific. It does not do a job of
its own — it stands in for whatever the player is short of.

- **FR-13.1** Gold **covers shortfalls**. A player who wants a purchase and lacks the required gems can make up the missing gems with gold.
- **FR-13.2** The gold cost of covering a gem **scales with grade**. Covering a high-grade gem costs substantially more gold than covering a low-grade one.
- **FR-13.2a** **The 70% rule.** Gold may only be used to cover a shortfall when the player already holds **at least 70% of the required gems**. Below that threshold, gold cannot be spent on the purchase at all.
- **FR-13.2b** The 70% threshold is measured **per grade**, not across the purchase as a whole. A purchase requiring two grades must be at 70% of *each* before gold applies to *either*.
- **FR-13.3** Gold drops from **chests**, on a chance.
- **FR-13.3a** **Mini-boss and boss clears award gold.** Five mini-bosses on a full run makes this a reliable faucet that does not depend on chest luck — and it means gold is earned by *fighting*, which is the behaviour the game wants to reward.
- **FR-13.3b** **Gems cannot be converted into gold.** Substitution runs one way only.
- **FR-13.4** Winning a **1v1 PvP match** awards a small amount of gold. *(v3 — recorded here because it is a gold source the economy must eventually account for.)*
- **FR-13.5** **Gems are distinguished by grade only.** There are no elemental or material kinds. Recipe variety comes from grade mixing (FR-11.3, FR-14.2), not from a second axis.
- **FR-13.6** **Air tank upgrades price on their own curve**, steeper than gear. The tank is the master resource — it converts directly into reachable distance — so it is where the 70% rule (FR-13.2a) does its heaviest work and it must not share a pricing curve with ordinary gear.

### Why substitution is the right monetization shape

Gold is the currency real money can buy, which makes FR-13 the load-bearing structure of the
whole business model. Substitution is close to the best available answer:

- **It sells time, not power.** Every single thing gold buys is reachable in gems by playing. Nothing is behind gold that is not also behind effort.
- **It satisfies the brief's locked constraint literally**, not just in spirit: purchased gold accelerates exactly what could have been earned, because it is *defined* as a stand-in for earned material.
- **It matches the shipped precedent.** The economy research notes that Path of Exile's top-selling MTX is stash tabs — convenience, not power. Substitution is the same shape.
- **It gives the model one legible path**: money → gold → covers a shortfall → the gear the player was already working toward. One dial, one story, easy to defend publicly.

### The conversion rate is the entire monetization dial

FR-13.2 hides the most commercially sensitive number in the game. The gold-per-gem rate, by
grade, sets exactly how much money compresses the grind — it is simultaneously the paying
player's value proposition and the free player's sense of fairness, and there is no second
lever that can compensate for getting it wrong.

Two things from the research bear directly on it:

- **Price in runs, not gold.** Define the target as *runs saved* per purchase and derive the rate from measured run income per distance band, rather than picking a gold number and discovering the pacing later.
- **Watch the escalation term.** Vampire Survivors puts 91% of its total cost in a global fee that scales with everything already bought. If gear prices climb but the gold rate does not, late purchases silently become far better money-value than early ones — or far worse.

### The 70% rule is the anti-pay-to-win guarantee

FR-13.2a converts a promise into arithmetic. **Money can never buy more than the last 30% of
anything.** The other 70% has to be played for, on every purchase, by every player, forever.

That is a far stronger public position than most F2P games can take, because it is checkable
rather than rhetorical. It also means gold is a **finisher**, not a substitute: it closes gaps,
it does not open doors.

A second effect, which is favourable and probably unintended: high-grade gems are the rare
ones, so reaching 70% of a high-grade requirement is the hard part of any expensive purchase.
Gold therefore helps *least* where players want help *most*. Good for integrity — and a real
ceiling on revenue per player, which the business model should expect rather than discover.

> **NOTE FOR PM — the 70% rule monetizes the near-miss, deliberately or not.** The only state
> in which gold is spendable is "so close I can taste it," which is precisely the near-miss
> effect the economy research documents: near misses recruit win-related brain circuitry and
> raise motivation as much as wins do. That is commercially potent and it is a known lever with
> regulatory history — the Nevada Gaming Commission banned engineering near-miss frequency above
> chance in 1989. Nothing here is near that line: the threshold is a fixed, disclosed rule and
> the player's progress toward it is entirely earned, not engineered per-player. Recorded so the
> choice is made with open eyes, not discovered later by someone less friendly.

FR-13.2b closes the loophole. Stockpiling common gems can never unlock gold spending on the
rare portion, because each grade clears its own threshold independently. The guarantee holds
at every tier of the shop rather than only at the cheap end.

### FR-26 — What the shop sells

The between-run shop (FR-11.1) carries four kinds of thing, and they map onto the four ways a
player can get further:

| Category | Examples | Buys the player |
|---|---|---|
| **Weapons** | Swords, bows | Faster clears — which converts directly into time |
| **Armour and equipment** | Defensive gear | Mistake absorption (Q22) |
| **Air tank upgrades** | Ten tiers (FR-19) | Time, directly |
| **Potions** | Restoration, Air, Passage | A single run's insurance or escape |

- **FR-26.1** Weapons and armour are permanent once bought; potions are consumed (FR-11.2).
- **FR-26.2** Weapon choice affects how a fight is approached, not only how much damage it does — a bow build and a sword build should play differently against the same room.

### FR-14 — What purchases cost

Requirement complexity is **reserved for the top end**. Most of the shop is simple.

- **FR-14.1** Ordinary gear and weapons require **a single gem grade**. One grade, one quantity, one threshold.
- **FR-14.2** Only **very strong gear and weapons** require **multiple gem grades** in combination.
- **FR-14.3** **Potions always require multiple grades** (FR-11.3), regardless of how minor the potion is. They are the exception to FR-14.1.

This is a better structure than a uniformly compound economy, for three reasons:

1. **The early game stays legible.** A new player reads one number and knows what they need. Compound requirements arrive only once the player is deep enough to have met several grades.
2. **The per-grade rule matters exactly where the stakes are highest.** FR-13.2b only bites on multi-grade purchases — which are precisely the top-tier items where a pay-to-win loophole would have done the most damage. The complexity sits where it earns its keep.
3. **Potions stay distinctive.** Being the one cheap thing with a compound cost is what makes them feel like *crafting* rather than shopping, and it is what keeps mixed-grade demand alive for players who never reach the top tier.

- **FR-14.4** The grades required by top-tier gear **include low grades**, not only high ones.

FR-14.4 is what makes the economy self-balancing at the top end, and it closes the veteran
surplus problem (Q21) without needing a conversion mechanic. A player deep enough to be
shopping for endgame gear is exactly the player sitting on a pile of grade-1 gems — and that
gear is what consumes them. Low-grade gems never stop mattering, at any point on the curve:
potions want them early, endgame gear wants them late.

It also means a veteran cannot skip the shallow band entirely. Not as a tax, but because the
best items in the game are partly made of cheap material — which is a quietly elegant reason
for resource runs to survive into the endgame rather than being a beginner's phase.

**Gold supply in v1** was nearly a problem. PvP is v3, so chest drops would have been the only
faucet at launch, making chest luck the sole determinant of the free player's earn-versus-buy
ratio. FR-13.3a fixes it: **mini-boss and boss clears award gold.** Five mini-bosses on a full
run is a reliable, skill-driven faucet — and it means gold is earned by *fighting*, which is the
behaviour the game most wants to reward.

**Substitution runs one way only** (FR-13.3b). Gold covers missing gems; gems never become gold.
The reverse would have been a way to solve the veteran surplus problem, but FR-14.4 already
solves it more cleanly, and a two-way exchange would only weaken gem demand.

**Note on competitive integrity:** gold flows *out* of PvP as a reward, never *into* it as an
advantage (FR-13.4). That direction is safe — winning PvP accelerates PvE progression, while
buying gold still cannot influence a PvP match, which is what the brief locks in.

---

## Progression Beyond the First Clear

### FR-24 — Hard Mode

- **FR-24.1** Defeating the final boss unlocks **Hard Mode**, a re-run of the same five environments at raised difficulty.
- **FR-24.2** Hard Mode scales enemies by **verb breadth first** (FR-7.2) — early-environment monsters gain moves they did not have — rather than by inflating health and damage.
- **FR-24.3** Hard Mode loot scales with it, including higher gem grades than the base campaign offers.

FR-24.2 is the important line. The obvious way to build a hard mode is to multiply numbers,
which makes fights longer rather than harder and works directly against a 30-second-to-5.5-minute
time budget. Giving a goblin the ability to slide and block instead makes environment 1 genuinely
new without costing a single extra second — and it reuses the enemy model already specified
rather than requiring new content.

*(Nightmare Mode, unlocked from the second boss, is v2 and out of scope here.)*

### FR-25 — Training mode

- **FR-25.1** A **free training mode** is available, with **no timer and no loot stakes**.
- **FR-25.2** Training mode uses the same simulation and the same timing values as a real run (FR-9.5, NFR-2). What is practised there transfers exactly.
- **FR-25.3** Training mode grants **no currency, no gems, and no progression**. Nothing earned there is bankable.

Training mode earns its place in v1 rather than being a nicety, for one reason: the game's
defining skill is a **0.3-second parry with a 0.4-second punish for guessing** (FR-5.7, FR-5.9).
That is not learnable under a clock that is actively degrading the player's attention — the
timer thesis guarantees it. Training mode is where the player is allowed to learn the thing the
rest of the game charges them for.

FR-25.3 keeps it honest: it is a practice room, not a safe farming route.

---

## Run Validation and Economy Integrity

Two things in this game are bought with real money: **gold** and **cosmetics**. Both must be
server-authoritative, and neither is protected by the other.

Gold is purchasable, which makes gold a product. A client that reports its own loot is therefore
not a cheating problem but a **counterfeiting** problem — and it would also make the 70%
guarantee (FR-13.2a) unenforceable, since a cheater can fabricate the 70% as easily as the rest.
Cosmetics are attacked differently and are covered in FR-16.

**The platform does not change this.** A native app is obfuscated, not secure: memory editors,
APK repacking and function-hooking tools are mature and free, and mobile cheating scales in a
way browser cheating does not — one person repacks the client, uploads it, and everyone else
just downloads. Native attestation (Play Integrity, App Attest) raises the cost and is worth
using later, but it verifies *the app*, not *the gameplay*. Validation is required on every
surface this game ships to.

### The chosen model — checkpointed and plausibility-bounded, capturing replays

Full server-side simulation is the strongest option and is **rejected on cost**: it requires an
always-on stateful process, which means recurring hosting spend and a second engine's worth of
prediction-and-reconciliation work to keep combat feeling responsive. The chosen model runs
entirely on stateless serverless functions and managed Postgres.

- **FR-15.1** **The server issues the run seed.** The client never chooses or influences it. This alone removes seed-shopping for legendary drops.
- **FR-15.2** Starting a run creates a server-side run record with a **server-recorded start time**, and returns a **signed, single-use run token**.
- **FR-15.3** During a run the client posts periodic **signed checkpoints** — depth, elapsed time, encounter index.
- **FR-15.4** The server **rejects checkpoints that are impossible**: non-monotonic depth, progress faster than traversal allows, elapsed time inconsistent with its own clock.
- **FR-15.5** On ending a run the client submits its **full input log**.
- **FR-15.6** **The server computes the reward itself** — from the seed, the validated progress, and the gear it knows the account owns. The client's claimed loot is **never trusted**; it is a display value only.
- **FR-15.7** Input logs are **stored for every run**, under a retention policy, whether or not they are re-simulated.
- **FR-15.8** **Currency balances are never written by the client.** Awards happen server-side only, atomically, against an **append-only ledger keyed by run ID**, so a duplicate award fails as a constraint violation rather than silently doubling a balance.

### Why capture logs you are not yet using

FR-15.7 is the part that pays off later. Deterministic replay validation — re-simulating a run
from its seed and inputs to see what actually happened — is the strong answer, and it is
expensive to adopt cold. Capturing logs from day one means switching it on becomes a **sampling
job** (re-simulate a random few percent of runs, plus every top-percentile run) rather than a
rewrite.

**NFR-2 already made this cheap.** The deterministic fixed-timestep simulation was committed to
for a different reason — identical timing across devices (FR-9.5) — and it is the same
prerequisite. Two requirements, one piece of work.

### What this does not catch, and why that is acceptable for v1

Checkpoints and plausibility bounds do not stop a **bot** — a script that plays the game
legitimately. That is a real gap and it is the right one to accept, because a bot earns at
human speed. It cannot mint currency; it can only grind. The damage is bounded by wall-clock
time, which is exactly the property FR-15.4 enforces. Statistical alerting on gold-per-hour and
depth-per-second is the later answer, and it needs the telemetry NFR-1.4 already requires.

### FR-16 — Cosmetic and purchase entitlements

Cosmetics are bought with real money directly, which makes them the second thing a client must
never be trusted about. The threat model is different from currency, and the difference decides
the design.

**A cosmetic's value is that other people see it.** A player who hacks a skin onto their own
screen has fooled only themselves — contained, and not worth engineering against. The damage
happens the moment a hacked cosmetic becomes **visible to others**, because at that point every
player who paid for that skin has been devalued, and the primary revenue line stops meaning
anything. Visibility is the asset, so visibility is what has to be authoritative.

- **FR-16.1** Cosmetic ownership is a **server-side record**. The client never asserts what it owns.
- **FR-16.2** Entitlements are granted **only by server-side verification of a completed payment** — a payment-provider webhook or a validated store receipt. A client claiming "I bought this" is never sufficient.
- **FR-16.3** Grants are **idempotent**, keyed by transaction ID, so a replayed or duplicated webhook cannot double-grant.
- **FR-16.4** Equipped state is **validated against owned entitlements server-side** before it is shown to anyone.
- **FR-16.5** What other players see is served from the **server's entitlement record**, never relayed from the wearing client. *(Bites in v2 and v3, when leaderboards and PvP create the first surfaces where players see each other — designed in now so it is not retrofitted then.)*

One mitigation is already locked upstream and worth stating: because no purchase confers power
(the brief's F2P constraint), a hacked cosmetic can never produce a **gameplay** advantage. The
exposure is confined to revenue and to the perceived value of paid skins — which is serious, but
bounded, and it is exactly what FR-16.5 protects.

> **NOTE:** this closes the sequencing tension flagged during discovery — that cosmetics carry
> 50–80% of revenue only where they are *seen*, while our visibility surfaces (leaderboards,
> PvP) arrive in v2 and v3. Whatever else that tension costs, it must not also cost the
> integrity of the cosmetics themselves. FR-16.5 is the cheap version of that guarantee,
> written while it is still a schema decision rather than a migration.

### NFR-5 — Zero fixed infrastructure cost

- **NFR-5.1** The validation model must run on **stateless serverless functions and managed Postgres**, with no always-on process and no fixed monthly infrastructure spend at low scale.
- **NFR-5.2** Input logs (FR-15.7) are retained on a **30-day rolling window**, with **permanent retention for a sampled 5% and for all top-percentile runs**. This is the only component whose cost grows with play, and the policy caps it.
- **NFR-5.3** The renderer is a **pure view layer over an independent TypeScript simulation** — working choice **PixiJS**. The simulation owns collision, timing and state; the renderer only draws. An engine whose physics and animation system holds simulation state forecloses deterministic replay validation (FR-15.7) and cannot satisfy NFR-2.

The constraint is real and it shaped the decision: the rejected option was rejected on
recurring cost, not on capability.

---

## User Journeys

### UJ-1 — Maya, run 15

*Maya, 24. Playing on her phone on the bus, roughly twelve minutes to her stop. Fifteen runs
in: she knows the opening stretch cold, has bought a couple of gear upgrades, and has not yet
beaten a boss.*

1. **Opening — known ground.** She clears the first stretch fast and without incident. Fifteen runs of familiarity.
2. **Shortcut.** She finds one and takes it, skipping ahead past ground she has already solved.
3. **Mid — real fights.** Goblins and corrupt archers. She handles them, but they cost her.
4. **The frontier.** She crosses into territory she has not seen before.
5. **Trap.** She falls into it. Monsters are on her immediately.
6. **Panic.** She fights and barely survives — **1 HP**.

The upgrade she bought before this run is the only reason she is alive. Without it, step 6
is a death.

Throughout, the oxygen clock is running and she never consciously looks at it. That is the
design working: the pressure is what made the trap fight go badly in the first place.

7. **The decision.** At 1 HP, deep, carrying a run's worth of loot, Maya has two moves and they are the whole game:

| | **Run for the nearest exit** | **Drink Restoration and continue** |
|---|---|---|
| **Requires** | Nothing — exits are free and always available | Having bought the potion *before* the run |
| **Gets** | The bag, banked, guaranteed | Full HP and the rest of the run |
| **Costs** | Everything deeper — grade, density, legendary rolls | The potion, and the bag stays wagered |
| **The feeling** | Relief | Nerve |

Both are correct plays. Which one is *available* was decided in the shop before she pressed
start — and that is the design working. The between-run screen is where the run's second half
is really decided.

**What this journey demonstrates end to end:** the timer degrading her play (the trap), gear
paying off legibly (surviving at 1 HP), preparation mattering (the potion she did or did not
buy), and the extraction decision landing with real weight because the bag is worth something.
Four systems, one bus ride.

---

## Success Metrics

**The web build is a validation stage, not the business.** The end goal is an app; the website
exists to find out whether the loop works and to build an audience. Any interim revenue there is
acceptable, and the brief's ≥2% paying-conversion target belongs to the app stage — browser
checkout converts materially worse than app-native, so holding a web build to an app-stage
number would only produce a false failure.

The two stages are therefore measured differently.

### Stage 1 — Web: does the loop work?

| Metric | Target | Why this one |
|---|---|---|
| **D1 retention** | 25%+ | Top-quartile mobile is 26.5–27.7%. Below ~20% the loop is not holding people |
| **D7 retention** | 5%+ | Median is 3.4–3.9%; top quartile 7–8% |
| **Average session length** | 10+ min | Web portals gate full launch on this. At ~8 runs per session it is also the honest test of "one more run" |
| **Runs per session** | 6–10 | Falls out of a 30s–5.5min run. Materially below means players are bouncing off; far above may mean runs are too shallow to satisfy |
| **Reached environment 2** | 60%+ of players | The first real progression gate. A low number means the opening is too hard or the first upgrades too slow |
| **Levered a first shortcut** | 50%+ of players | The single most important onboarding event — it is the moment the game's core promise pays out |
| **Beat the final boss** | Any non-trivial number | Long-tail. Zero means the time budget (FR-19, FR-20) is wrong |

### Stage 2 — App: does it earn?

| Metric | Target |
|---|---|
| **Paying conversion** | ≥2% (brief target — applies here, not to web) |
| **Cosmetic attach rate** | Meaningful share of payers, since cosmetics are the primary line |
| **Gold purchases as a share of total spend** | Tracked, not maximised — see counter-metrics |

### Where these differ from the brief, and why

The brief sets **D1 ≥ 30% and D7 ≥ 10%**. This PRD proposes **D1 25%+ and D7 5%+** for the web
stage. The difference is deliberate and should be reconciled rather than quietly overwritten:

- **D1 30% is roughly the top decile of mobile**, and mobile figures are measured on installed apps. A browser game has no install commitment, so its D1 is structurally lower — the same player who would have "retained" simply closes a tab.
- **D7 10% is close to triple the industry median** of 3.4–3.9%, and above the top quartile of 7–8%.

The brief's numbers are the right *ambition* and the wrong *pass mark*. Treating them as a gate
would report a healthy game as a failure. The recommendation is to hold the brief's figures as
app-stage targets alongside the ≥2% conversion goal, and judge the web build against the numbers
above.

Two brief metrics carry over unchanged because they test the loop rather than the platform:

- **Median session contains 3+ runs** — comfortably met if runs-per-session lands in the 6–10 band.
- **≥40% of players who finish a first run start a second** — the sharpest single test of "one more run," and worth tracking exactly as written.

**Organic sharing** is the third brief signal and the hardest to instrument. The brief names
distribution as the project's top risk, so referral traffic from clips and shared runs should be
measurable from launch rather than added once growth stalls.

### Counter-metrics

Each of these is a way the targets above can be hit while the game gets worse. They are the
ones to watch when a number improves.

| Counter-metric | What it would mean |
|---|---|
| **Deaths with no available counterplay** | Should be near zero. FR-6.1 promises every hit has an answer; if players die to things they could not have read, the promise is broken and the difficulty is fake |
| **Share of runs ending in transformation, outside the boss** | Running out of air should be the *uncommon* failure everywhere except the final fight (FR-19.4). If it is common mid-dungeon, the tank curve is too tight |
| **Median runs to the first levered shortcut** | If this climbs, onboarding is failing regardless of what D1 says |
| **Resource runs as a share of all runs** | If resource runs dominate, the economy has become a grind and Q20's answer has stopped being true in practice |
| **Gold covering the last 30% on most purchases** | The 70% rule (FR-13.2a) is meant to make money a finisher. If nearly every purchase is finished with gold, the earn rate is too slow and the game is monetizing frustration |
| **Air-tank upgrade pace stalling at a specific tier** | A wall in the curve. FR-19's ten steps should feel even; a stall means one price is wrong |
| **Session length rising while runs per session falls** | Players idling in menus rather than playing. Time-in-app is not engagement |

> The last one is worth naming explicitly because web portals reward playtime, which creates a
> real incentive to inflate it. Playtime that is not *runs* is not the game working.

---

## Non-Functional Requirements

### NFR-1 — Live iteration is a first-class requirement

The project ships online early and is tuned continuously — content and systems added and
removed while real players are in the game. That is a development method, and it imposes
requirements the architecture must satisfy from day one rather than retrofit.

- **NFR-1.1** **Tuning values live server-side, not in the client.** Parry window, stun duration, drop rates, gem requirements, gold conversion rates, oxygen budget — all of it must be changeable without shipping a new build. A design that requires a redeploy to test a number cannot be tuned at the pace this project intends.
- **NFR-1.2** **Content is additive and removable without breaking saved progress.** Removing a potion, a gear item, or an enemy must not corrupt or orphan an account that owns or has encountered it. Every removal needs a defined fate for what players already hold.
- **NFR-1.3** **Persistent player state survives content change.** Levered shortcuts (FR-3.3), owned gear, and banked currency are permanent records. Schema changes must migrate, not reset.
- **NFR-1.4** **Changes are observable.** A tuning change is only useful if its effect is measurable — run outcomes, deaths by cause, extraction rates, and purchase completion need to be recorded per run from the first playable build.

> NFR-1.1 and the server-authoritative economy locked in the brief point the same direction:
> the server is the source of truth for both **what is true** and **what the numbers are**.
> Building one gives most of the other.

### NFR-2 — Deterministic, fixed-timestep simulation

- **NFR-2.1** The game simulation runs on a **fixed logical timestep**, independent of frame rate and device performance.
- **NFR-2.2** All combat timing is expressed in **simulation ticks**, not wall-clock seconds or rendered frames.

This is not a technical preference; three separate requirements already in this PRD depend on
it:

1. **FR-9.5 — identical timing on every device.** A 0.3-second parry is only identical across a 144Hz desktop and a throttled phone if the simulation does not vary with frame rate.
2. **Q10 — run validation.** Server-side validation of runs is dramatically cheaper against a deterministic simulation than against a free-running one. The brief makes this a hard constraint, and the renderer choice can foreclose it (see `addendum.md`).
3. **Hitbox authoring.** Attack windows, parry windows and recovery windows are all authored as tick ranges on an animation timeline. They need a stable clock to be authored against.

### NFR-3 — Asset pipeline and licensing

- **NFR-3.1** Art and audio are **data, not code**. Sprites, animations, hitbox definitions and sound are loaded from data files so assets can be replaced without touching game logic.
- **NFR-3.2** Every shipped asset must carry a **license permitting commercial use**, recorded in an asset manifest with its source and terms.
- **NFR-3.3** Any asset used in a **sold cosmetic** must be owned outright or licensed with explicit resale rights.
- **NFR-3.4** A **style guide capturing the intended art direction is authored before commissioning**, and placeholder assets are chosen to approximate that direction rather than whatever is nearest to hand. The target look is the designer's own; placeholders exist to stand in for it, not to define it.

> **NFR-3.4 matters more than it reads.** Placeholder art quietly becomes the design if it is
> allowed to — encounters get spaced to its proportions, readability gets tuned to its contrast,
> and the "temporary" look ends up shipped. Choosing placeholders that resemble the intended
> style keeps the eventual swap a substitution rather than a redesign.

> **NFR-3.3 is a real commercial risk, not boilerplate.** The business model makes cosmetics
> the primary revenue line. Most free and paid asset-pack licenses permit use *in* a game but
> forbid selling the art itself as a product — which is arguably what a cosmetic skin is. A
> placeholder skin that quietly becomes a store item is the failure mode. Sourcing detail and
> options are in `addendum.md`.

### NFR-4 — Browser delivery

- **NFR-4.1** Initial load must stay small enough for a browser player to start quickly. Asset weight is a gameplay requirement, not an optimization.
- **NFR-4.2** The game must run acceptably on mid-range mobile hardware in a browser, since FR-9 commits to phone as a first-class surface.

> Web portals gate promotion on engagement metrics — CrazyGames requires a 10-minute average
> playtime for full launch — and load time is the first filter on that. Recorded because it
> affects art budget and scope, not only engineering.

---

## Open Items

| # | Item | Blocking? |
|---|---|---|
| ~~Q1~~ | ~~Gem-grade obsolescence~~ — **RESOLVED**: potions cost a mix of grades (FR-11.3), so low grades stay permanently required. Partial — see Q21 | Closed |
| ~~Q2~~ | ~~Cost of bailing early~~ — **RESOLVED**: bailing is free; the cost is opportunity only, and the risk sits on the push side | Closed |
| ~~Q3~~ | ~~Transformation penalty~~ - **RESOLVED**: identical to death (FR-21.1) | Closed |
| ~~Q4~~ | ~~Gold vs. gems~~ — **RESOLVED**: gold is the universal substitute currency, covering gem shortfalls at a grade-scaled rate. Sources: chests, and PvP wins in v3 (FR-13) | Closed |
| ~~Q5~~ | ~~Combat inputs, attack feel, enemy readability~~ — **RESOLVED**: full control scheme, parry/reflect, cancels, and the verb-subset enemy model are specified (FR-5 to FR-8) | Closed |
| ~~Q6~~ | ~~Clock pause during uncontrollable moments~~ - **RESOLVED**: yes (FR-21.2) | Closed |
| ~~Q7~~ | ~~Cosmetics visibility vs. v2/v3 sequencing~~ — **RESOLVED**: cosmetics-primary belongs to the app stage, where the visibility surfaces exist. Not a web-stage expectation | Closed |
| ~~Q8~~ | ~~Browser conversion below the ≥2% target~~ — **RESOLVED**: the web build is a validation stage. Any interim revenue is acceptable; the conversion target applies to the app stage | Closed |
| ~~Q9~~ | ~~Run length, gear curve, modifier set~~ — **RESOLVED**: 30s base with a 10-step tank curve (FR-17, FR-19) and the reshuffle defined (FR-18). Gear curve pricing remains, tracked under Q40/Q43 | Closed |
| ~~Q10~~ | ~~Run validation model~~ — **RESOLVED**: checkpointed + plausibility-bounded, server-computed rewards, replay logs captured from day one. Full server simulation rejected on recurring cost (FR-15, NFR-5) | Closed |
| ~~Q38~~ | ~~Input-log retention~~ - **RESOLVED**: 30-day rolling, permanent for sampled 5% and top-percentile (NFR-5.2) | Closed |
| ~~Q39~~ | ~~The air tank curve~~ — **RESOLVED**: 30s base, +30s per upgrade, 5.5min ceiling, 60s per environment. Ten upgrades, two per environment, and the max tank is deliberately short of the boss (FR-19) | Closed |
| ~~Q43~~ | ~~How much time does a shortcut save?~~ — **RESOLVED**: 10–15s each, mini-boss 10s, boss 60s (FR-20). Budget solved | Closed |
| ~~Q46~~ | ~~Mini-boss inside or on top of the 60s?~~ — **RESOLVED**: on top. An environment costs 70s (FR-20.4) | Closed |
| ~~Q47~~ | ~~Shortcut savings cap~~ — **RESOLVED**: total savings must land in 80–110s; count is derived from the budget, working value seven at ~13s (FR-20.5, FR-20.6) | Closed |
| ~~Q44~~ | ~~60s per environment: average or optimal?~~ - **RESOLVED**: average play. Skill and gear compress it; that is the slack | Closed |
| ~~Q45~~ | ~~What does a maxed player want?~~ - **RESOLVED**: v2 content (Endless, leaderboards) | Closed |
| ~~Q40~~ | ~~Air-tank pricing~~ - **RESOLVED**: its own curve, steeper than gear (FR-13.6) | Closed |
| ~~Q41~~ | ~~Form of the trap tell~~ - **RESOLVED**: visual and audible, ~0.5s before trigger (FR-18.5) | Closed |
| ~~Q42~~ | ~~Between-run screen as a major surface?~~ - **RESOLVED**: yes, resourced in the UX phase | Closed |
| ~~Q11~~ | ~~Skip items vs. the lever rule~~ — **RESOLVED**: potions are bought with gems earned in-run, are consumable, and cost loot. Real money never buys distance | Closed |
| ~~Q12~~ | ~~Do potions cost gems of any grade?~~ — **RESOLVED**: a combination of grades, high grades alone insufficient | Closed |
| ~~Q13~~ | ~~Where are potions bought?~~ - **RESOLVED**: a shop between runs, from banked gems, carried in (FR-11.1) | Closed |
| ~~Q14~~ | ~~Can Passage deliver a player to an unearned lever?~~ — **RESOLVED**: no. Flying over a lever does not flick it | Closed |
| ~~Q15~~ | ~~Potion carry limit~~ - **RESOLVED**: two slots, expandable later (FR-11.1a) | Closed |
| ~~Q16~~ | ~~Recipe rule vs. shortcut rule~~ — **DISSOLVED**: the two serve different run types. See **Run Intent** | Closed |
| ~~Q17~~ | ~~Exit-Passage price~~ - **RESOLVED**: using an exit is free; the potion is priced to be worthwhile only when the bag is worth saving (FR-12.7) | Closed |
| ~~Q18~~ | ~~Gem kinds as well as grades?~~ - **RESOLVED**: grade only (FR-13.5) | Closed |
| ~~Q19~~ | ~~Run intent explicit or emergent?~~ - **RESOLVED**: emergent, with depth meter and gem counter both always on the HUD (FR-22) | Closed |
| ~~Q20~~ | ~~Are resource runs a grind?~~ — **RESOLVED**: potions are optional, depth runs also gather, and deep chests roll shallow loot. Resource runs are infrequent | Closed |
| ~~Q21~~ | ~~Veteran low-grade gem surplus~~ — **RESOLVED**: top-tier gear requires low grades too (FR-14.4), so endgame purchases consume them. No conversion mechanic needed | Closed |
| ~~Q22~~ | ~~"Veteran beats it with bad gear" vs. "gear raises reachable distance"~~ — **RESOLVED**: veteran means *plays perfectly*. Gear absorbs mistakes, so it raises the floor while skill sets the ceiling | Closed |
| ~~Q23~~ | ~~Does Passage skip a mini-boss?~~ - **RESOLVED**: yes, forfeiting its loot and gold (FR-12.6) | Closed |
| ~~Q24~~ | ~~Perfect players buy no gear~~ - **RESOLVED**: v2 content is the answer, as with Q45 | Closed |
| ~~Q25~~ | ~~Touch controls~~ — **RESOLVED**: device chosen at entry; PC keys rebindable; phone layout split left/right and customizable in size and position (FR-9) | Closed |
| ~~Q26~~ | ~~Block cooldown / failure cost~~ — **RESOLVED**: ~0.3s parry window, ~0.4s movement lockout on a mistime. Mashing is punished | Closed |
| ~~Q27~~ | ~~Do bosses resist stun?~~ - **RESOLVED**: mini-bosses stunnable at reduced duration; final boss immune (FR-8.4) | Closed |
| ~~Q28~~ | ~~Non-parry block?~~ - **RESOLVED**: no soft block. Parry or eat it (FR-8.5) | Closed |
| ~~Q29~~ | ~~Cross-device timing parity~~ — **RESOLVED**: universal. Identical values on PC and phone, tuned to be fair on both (FR-9.5, FR-9.6) | Closed |
| ~~Q30~~ | ~~Device choice~~ - **RESOLVED**: auto-detect with manual override, remembered per device (FR-9.1) | Closed |
| ~~Q31~~ | ~~Can gold cover 100%?~~ — **RESOLVED**: the 70% rule. Gold is spendable only once the player holds ≥70% of the required gems, so money never buys more than the last 30% (FR-13.2a) | Closed |
| ~~Q34~~ | ~~Per grade or across the whole cost?~~ — **RESOLVED**: per grade (FR-13.2b). Stockpiling common gems can never unlock gold spending on the rare portion | Closed |
| ~~Q35~~ | ~~Do top-tier requirements include low grades?~~ — **RESOLVED**: yes (FR-14.4). Closes Q21 | Closed |
| ~~Q36~~ | ~~Renderer choice~~ - **RESOLVED**: PixiJS as a pure view layer over an independent TS simulation (NFR-5.3) | Closed |
| ~~Q37~~ | ~~Art direction~~ - **RESOLVED**: style guide before commissioning; placeholders approximate the intended look (NFR-3.4) | Closed |
| ~~Q32~~ | ~~Gold supply in v1~~ - **RESOLVED**: mini-boss and boss clears award gold (FR-13.3a) | Closed |
| ~~Q33~~ | ~~Gems to gold?~~ - **RESOLVED**: no, substitution is one-way (FR-13.3b) | Closed |

---

## Resume Point

**Every hard constraint from the brief now has an answer.** Server-authoritative economy (FR-15),
web-first with a mobile-viable input model (FR-9), and a renderer direction constrained rather
than chosen (NFR-2, Q36). The loop, combat, economy and integrity model are all specified.

**Status: final.** Finalize completed 2026-08-04 — memlog audited, brief reconciled
(`reconcile-brief.md`), reviewed against the PRD quality rubric (`review-rubric.md`), open items
triaged and closed.

### Carried forward — not blocking, but owed

| Item | Owner phase |
|---|---|
| **Enemy roster and per-environment verb table.** Three enemies specified for a game whose difficulty axis is verb breadth across five environments | Epics/stories |
| **Combat-feel acceptance proxies.** Feel cannot be specced; measurable stand-ins can — latency budget, animation frames before hitbox activation, target parry rate in playtest | Architecture |
| **Gem grade count.** Referenced as 1..n throughout, with n never fixed | Economy tuning |
| **Boss and mini-boss designs** beyond duration and stun rules | Epics/stories |
| **Confirm the FR-23 modifier set**, currently `[ASSUMPTION]` from the brief's examples | One conversation |
| **Distribution plan.** The brief names it the project's top risk, harder than any technical piece. Nothing in a product PRD owns it | Go-to-market, before launch |
| **The name.** "Dungeon Master" is a Wizards of the Coast trademark and a 1987 FTL game. Must be replaced before any domain, art, store listing, or paid marketing | Before brand spend |

### Next phases

- **`bmad-ux`** — the between-run screen and the touch layout carry the most weight; both were promoted to first-class surfaces during this walk
- **`bmad-architecture`** — renderer and simulation design, constrained by NFR-2 and NFR-5.3
- **`bmad-create-epics-and-stories`** — break into buildable work

Then **Success Metrics** (with counter-metrics, and revisiting the brief's ≥2% conversion target
against browser reality — Q8), and the tail of smaller items: Q32 (gold's only v1 faucet is
chests), Q23 (does Passage skip mini-bosses), Q28 (parry-or-eat-it), Q27 (do bosses resist
stun), Q19 (explicit vs. emergent intent), Q13 (where potions are bought), Q17 (exit-potion
price), Q33 (whether substitution runs backwards), Q38 (log retention).

**Sections still to work:** the modifier set and tuning model (Q9), success metrics. UJ-1's
extraction half is still unnarrated.

**Sections still to work:** combat specification, economy and currency model, shortcut
placement within environments, the full modifier set, run validation, success metrics, NFRs.
