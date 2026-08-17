# Demo run-of-show

For the investor meeting. Everything here is true of the build that is live at
**https://air-debt-game.vercel.app** — nothing in this document is a promise
about a future version, because the fastest way to lose a room is to be caught
describing something that does not exist yet.

---

## Before they arrive

Ten minutes, the morning of.

- [ ] Open the live URL on the machine you will present from. **Not localhost.**
      If the laptop's connection dies you still want a URL somebody else can open.
- [ ] Sign in already. Do not do the sign-up flow live for the first time.
- [ ] `BASE_URL=https://air-debt-game.vercel.app npm run e2e` — ten tests, twenty
      seconds. If they pass, the site is genuinely up rather than probably up.
- [ ] Check both leaderboards have rows on them. An empty board undersells the
      most technically interesting thing in the project.
- [ ] Close `.env.local`, the Vercel dashboard, and the Supabase dashboard.
      Your `service_role` key is visible on two of those.
- [ ] Turn admin mode **off** in Settings. The oxygen timer and the risk of dying
      are the entire pitch; being invincible in front of them is showing a
      different, worse game.
- [ ] Have `/contact` open in a tab. It is the natural last click.

---

## The order to show it in

Roughly fifteen minutes. The shape is: let them *play* before you explain
anything, because the game teaches itself and a played thing is remembered.

### 1. The landing page — 30 seconds

Do not talk over it. Let them read the one line:

> Thirty seconds of air. Five environments deep. Everything you are carrying is
> on you — and the way out is the way you came.

That is the pitch. If they get it from that sentence, the rest of the meeting is
detail.

### 2. Put a controller in their hands — 5 minutes

Send them to **Tutorial** on the home screen. Then stop talking.

This is the strongest five minutes of the product and it is the part most
founders skip. It works because every station is *geometry they cannot get past
without learning the move*: the gap is wider than a stride, the lintel lower than
a crouch, the slot deeper than a jump. Nothing can kill them in there, so they
will experiment rather than freeze.

What to say only if they ask: **twelve stations, and nine of them are verified by
a bot that plays with exactly one move disabled and has to get stuck at the
matching gate.** That is what stops a lesson quietly becoming scenery.

### 3. A real run — 4 minutes

You play this one. Narrate two decisions and nothing else:

- **When you turn back.** Say the number out loud — "I have eleven seconds and
  I am four seconds from the shaft, so this chest is not mine." That single
  sentence is the whole game design.
- **A parry.** Block an arrow and let them watch it kill the archer that fired
  it. It reads as skill because it is.

If you die, **do not restart and do not apologise.** Dying is the product. Say
what it cost — the loot, and only the loot — and move on.

### 4. The shop, briefly — 1 minute

Show that gems became reach, air and armour. Point at the air tank and say the
thing that makes the economy interesting:

> The biggest tank you can buy still is not enough to walk the whole dungeon.
> Shortcuts are the only way the maths ever works, and a shortcut only opens
> from a lever placed *past* the ground it skips — so it cannot be bought, and it
> cannot be learned from a video.

### 5. The leaderboards — 2 minutes

This is the part that lands with anyone technical, so slow down.

> A score is never submitted. The browser sends the keys that were pressed, and
> the server replays them through the same simulation — from a seed it issued
> before the run started. Then it scores the result itself.

Then the consequence, which is the line worth rehearsing:

> To cheat you would have to forge inputs that genuinely produce the score. That
> is not cheating. That is playing.

If they push on it: the simulation is a deterministic reducer at a fixed sixty
ticks a second, and the same function scores it on both sides, so the client and
the server cannot disagree. Developer runs are allowed on the boards and are
labelled `dev · no risk` on the row, because an unmarked invincible score would
make the board worthless.

### 6. Contact — 30 seconds

Land on `/contact`. It says a real person made this and here is how to reach him.

---

## Answering the hard questions honestly

Investors trust founders who know what is missing. Every one of these is better
answered plainly than deflected.

**"Can you make money from it today?"**
No. There is no payment integration — no Stripe, no checkout, nothing. The
economy it would sell into is finished and server-authoritative, which is the
part that had to be right first: selling gems on top of an economy players can
edit from a browser console is selling something you do not control. That was a
real hole in this build until recently and it is closed.

**"How many players?"**
None yet. It went live today.

**"What stops people cheating the leaderboards?"**
Answered above. This is your strongest technical answer — do not rush it.

**"Is it on mobile?"**
No. Keyboard only, and touch controls are not designed yet. The plan has always
been web first as validation, native app after.

**"What is left to build?"**
1v1 PvP, then a 3D wave-survival mode, then monetisation. PvP and payments both
need server work that does not exist yet.

**"Who made the art?"**
It is generated — procedural pixel art from Python scripts in `art-src/`, which
are checked in alongside their output. No asset licensing to worry about.

**"How much does it cost to run?"**
Effectively nothing at this scale. Vercel and Supabase free tiers, no always-on
process, and the architecture was chosen so that stays true.

---

## Things that could go wrong, and what to do

| If | Then |
|---|---|
| The site will not load | You already ran the e2e suite, so this is the venue's wifi. Have a phone hotspot ready. |
| A run behaves oddly | Every run is stored as the keys that were pressed, so it can be replayed exactly. Say that — it turns a bug into a demonstration of the architecture. |
| The leaderboard is empty | Play a run there and then. It appears within seconds. |
| Someone asks to sign up | Fine, but you should have tested a reset email first so you know it works. |
| You are asked something you do not know | "I do not know, I will find out" costs nothing. A wrong answer they later check costs the round. |

---

## The one sentence to leave them with

> One person built a deterministic action game with a server-verified economy and
> leaderboards that cannot be faked, and it is live.