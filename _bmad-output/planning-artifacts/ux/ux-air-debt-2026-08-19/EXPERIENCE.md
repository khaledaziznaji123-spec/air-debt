# EXPERIENCE — Air Debt

**Written 2026-08-19, from the built product.** Companion to `DESIGN.md`, which
covers what it looks like. This one covers what it feels like, and why it was
built to feel that way.

---

## 1. Who this is for

| | |
|---|---|
| **Age** | 16–28. School, university, and the first years of earning. Skews male, roughly 70/30, in line with the genre |
| **Already plays** | Dead Cells, Hades, Risk of Rain, Celeste. They have paid $10–25 for this exact loop before |
| **Searches** | "roguelite like Dead Cells", "browser game no download", "speedrun leaderboard" |
| **Found at** | itch.io, r/roguelites, speedrun clips on TikTok and YouTube, Discord servers |
| **Session length** | 3–8 minutes |
| **Region focus** | The Gulf and wider MENA — young, connected, and almost no competitive web titles built inside it |

**The session length is a design input, not an observation.** A full run is at
most 3.5 minutes. The product was built to the length of the gap in their day
rather than hoping their day had a longer one.

---

## 2. The feeling being sold

> **Thirty seconds of air — and every second you spend down there is a second
> you need to get back.**

Most games with a timer use it to hurry you. **This one uses it to make you
wrong.** The air is the only resource and it is spent on everything at once: the
fight, the chest, and the walk home. So the timer's job is not pressure for its
own sake — it is to *degrade the quality of your decisions* until you make one
you would never make with time to think.

The emotion at the centre is not fear. It is **greed arguing with arithmetic.**

---

## 3. The core decision

Every run reduces to one question, asked over and over:

> *One more chest, or start walking?*

For that question to be real, four things had to be true, and all four are:

1. **The loot must be worth wanting.** Gems are graded and specific; gold is
   generic and covers shortfalls only.
2. **Losing it must actually hurt.** Death and running out of air cost the same
   thing: the run's loot. Not your gear, not your purchases — the trip.
3. **The maths must be tight enough that the answer is not obvious.** The
   biggest air tank you can buy is *deliberately insufficient* to walk the whole
   dungeon. Full air, direct route: 141 seconds. Careful and chest-taking: 205.
   The ceiling is 210.
4. **There must be a way to change the maths that is not money.** Shortcuts.

---

## 4. Shortcuts are the win condition

A shortcut opens only by throwing a lever, and **the lever is always placed past
the ground it skips.** You have to make the long walk once in order never to
make it again.

This is the single most important experiential decision in the game:

- **Permanent progress can never be bought.** Not with gems, not with gold, not
  with real money if money is ever taken.
- **It cannot be skipped, and it cannot be learned from a video.** Knowing where
  a lever is does not flick it.
- A failed run still keeps its levers. **Loot is lost, ground is not.** That is
  the consolation that makes a bad run worth having made, and the lobby says so
  explicitly: *"One lever flicked. That shortcut is open for good."*

The 70% rule serves the same principle inside the economy: gold may only cover a
shortfall once you already hold **70% of the required gems, per grade**. Money
never buys more than the last 30% of anything.

---

## 5. The first five minutes

1. **Landing page.** Public, no account. Explains the loop, shows real
   screenshots, and puts the sign-in at the bottom where somebody who is
   convinced will look for it — not at the top, in front of somebody who is not.
2. **Sign up.** An email address and nothing else.
3. **The tutorial is offered first, and deliberately.** It is a built hall with
   no timer, where every station teaches one verb by making it the only way
   past: jump, wall jump, slide, step-back, stun, smash-down, parry, interact.
   You cannot proceed without performing the thing.
4. **It ends at the home screen**, not at itself. And it can be left at any
   point — every station is a wall to a player who has not learnt its verb, and
   somebody beaten by the wall jump is exactly the person least likely to go
   looking for a door.
5. **The shop opens with four grade-one gems** paid by the tutorial, so the
   first real decision is a purchase rather than an empty screen. Nothing the
   tutorial earns is real: a replayable tutorial that banked into your account
   would be a gem farm with a goblin in it.

---

## 6. The three ways a run ends

The design gives failure two distinct faces on purpose, because "you died" and
"you ran out of time" should not feel the same.

| Ending | What the player is told | What it costs |
|---|---|---|
| **Extracted** | *"Escaped the dungeon. Made it out from 380m in."* | Nothing. Everything banks |
| **Killed** | *"You died. Killed in the dungeon. The run's loot stays down there."* | The loot |
| **Transformed** | *"You breathed the virus. The air ran out. You are one of them now."* | The loot |

**Running out of air turns you into a monster.** Mechanically it is identical to
death; experientially it is the worse of the two, and it is the one the timer is
constantly steering you toward. It gives the countdown a meaning beyond a number
going down.

The bag is then shown either banked or struck through in red — *"41 gems, 3
gold, 1 legendary lost down there."* **The same sentence has to work both ways
round: banked is the reward, and forfeited is the entire reason banking felt
like a decision.**

---

## 7. Coming back tomorrow

- **The save is on the server, not in the browser**, so it follows the account
  to any machine. This is the answer to the most common anxiety a free web game
  produces: *will this still be here?*
- **Ranked mode** is the reason to return once the dungeon is beaten: maxed gear,
  every shortcut open, **no potions at all** — the same starting position for
  everybody, so the only variable left is the player. It returns to the
  leaderboard when it ends.
- **Two boards, both replay-verified**: fastest boss kill, and richest single
  run. All-time and weekly. The weekly board exists so a new player is not
  looking at a wall of records set months ago.

---

## 8. Trust as an experience, not a feature

This is the thing the product is really selling, and it has to be *felt* rather
than claimed:

- A score is never submitted. **The keystrokes are.** The server replays them
  through the same simulation from a seed it issued before the run began.
- Which means a leaderboard entry is a claim the server has personally checked.
  **Faking a score means faking a run that genuinely plays out — which is being
  that good.**
- When the server cannot be reached, the run still plays, and the game says so
  **before you go down**: *practice — nothing banks.* A player who walks out
  with a full bag and is only then told it did not count has already spent the
  run believing it did. That is a worse experience than not being allowed to
  start.

---

## 9. On a phone — the honest version

It plays. Turn the phone sideways and on-screen controls appear under your
thumbs, movable and resizable per device, and the pad disappears everywhere it
is not steering something.

**And it is not as good as the keyboard.** The game is built around timing
windows measured in tenths of a second — a 0.3s parry, a 0.4s punish — and touch
takes away both of the things that make those possible: you cannot feel a
button, and your thumbs sit on top of the screen you need to read.

This is not a polish problem and more tuning will not fix it. Mobile Air Debt
needs designing *for* mobile — contextual actions, wider windows, or a mode
built for it — and that sits with 1v1 and Survival, on the list, later, on
purpose. **What exists today proves the engine runs anywhere with a clock. It
does not yet prove the game is good there.**