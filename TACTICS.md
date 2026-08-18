# How to run the room

Notes for the meeting. `DEMO.md` is the order to show things in; this is how to
carry it.

None of this is generic advice — it is written for the specific position you are
in, which is: **a solo founder with a finished, live, technically unusual product,
no revenue and almost no players.** That combination has particular strengths and
particular holes, and the whole tactic is to lead with the strengths without ever
appearing to hide the holes.

---

## The one thing to understand first

**They are not evaluating the game. They are evaluating you.**

At this stage, with no users and no revenue, there is no traction to analyse and
no market data to argue about. Everything they could possibly learn about the
opportunity, they could learn from the website in ten minutes without you. So
what is the meeting for?

It is for answering one question: *can this person build things and finish them?*

That question is already answered, and answered unusually well. One person built
a deterministic game engine, five environments, a boss, an economy, a tutorial,
a server, replay-verified leaderboards, and shipped it to a public URL. Most
people who pitch a game have a prototype and a plan. You have a thing that works.

So the tactic is not to oversell the opportunity. It is to **let them discover
how much is actually built**, because the size of what exists is the argument.

---

## Lead with the product, not the pitch

Open the game, not the deck. Say something like:

> "Before I talk about any of it — here it is, it's live, have a go."

Then hand it over and **stop talking**. Let them play the tutorial.

This is the strongest possible opening and almost nobody does it, because it
feels like giving up control of the room. It is not. It does three things at
once:

1. It proves the thing is real in five seconds, with no claims needed.
2. It puts them in a good mood. Playing is more fun than being pitched at.
3. It changes what the rest of the meeting is about — from "will this work" to
   "how do we make this bigger", which is the conversation you want.

The tutorial is built for exactly this. It teaches itself, nothing can kill them,
and every station is geometry they cannot pass without learning something. They
will feel competent within a minute. **A person who feels competent at your game
is a person who likes your game.**

---

## Then narrate one real run — and narrate the decision, not the action

When you play, do not commentate on what you are doing. They can see it. Narrate
what you are *deciding*:

> "I've got eleven seconds. The shaft is four seconds behind me. So this chest
> isn't mine."

That single sentence teaches the entire design in eight words. It is the thing
that makes this a game rather than a platformer with a timer, and it is invisible
unless you say it out loud.

**If you die, do not restart and do not apologise.** Say what it cost — the run's
loot, and only that — and carry on talking. A founder who is comfortable with
their game killing them in front of investors is a founder who believes the
design is right. Flinching there is worse than dying.

---

## The technical argument, and when to spend it

The anti-cheat story is your strongest card and most founders in your position
have nothing like it. Do not open with it — it means nothing until they care
about the game. Save it for the moment somebody asks about cheating, leaderboards
or the economy, and then be precise:

> "A score is never submitted. The keystrokes are, and the server replays them
> through the same simulation from a seed it issued before the run started. To
> cheat you'd have to submit keys that genuinely produce the score — which isn't
> cheating, that's playing."

Then, and only if they are technical, the second half:

> "That's also why the economy is safe to sell into later. Loot is credited from
> the replay, not from anything the browser claims. Most games discover that
> problem when money is already involved."

That second point is the one that turns a game pitch into a business pitch. It
says: *the hard, boring, expensive thing is already done.*

---

## What to do about the holes

You have three obvious ones: **no revenue, no users, no mobile.** They will find
all three. The tactic is to name them first, in a flat voice, without apology.

Saying "we can't take money yet" before they ask costs you nothing and buys a
great deal, because it makes everything else you say more believable. A founder
who volunteers the bad news is a founder whose good news can be trusted.

The specific framings, and why each works:

| They ask | Say | Why it lands |
|---|---|---|
| "Can you make money today?" | "No. There's no payment provider yet. What's finished is the economy it would sell into — server-owned, can't be edited by a player. That had to be right first, because selling currency on top of an economy the client controls is selling something you don't own." | Turns a missing feature into evidence of judgement. |
| "How many players?" | "Almost none. It went live this week. The runs on the leaderboard are real, and there aren't many." | Precision beats spin. Vagueness here reads as hiding. |
| "Is it on mobile?" | "Not yet — keyboard only. Web first as validation, native after. The simulation already runs anywhere; it's touch controls that don't exist." | Shows the plan is sequenced, not aspirational. |
| "Who else is on the team?" | "Just me." | Say it plainly. It is a strength here, not a weakness — see below. |

---

## Being solo is an asset in this room. Use it.

Do not apologise for being one person. One person who shipped this is more
impressive than four people who shipped this, and they know it. The number they
are quietly running is *how much did this cost to build*, and the answer is
nearly nothing.

Two specifics worth mentioning if it comes up naturally:

- **The art is generated**, not licensed — fourteen scripts checked in beside
  their output. No asset bill, nothing to clear.
- **Infrastructure is effectively free** at this scale, by design. No always-on
  process.

Together those say: *this project has a very low burn and a very high ceiling.*
That is exactly the shape investors like.

---

## What to actually ask for

Have a number and a reason. "We're raising X to do Y for Z months" is a complete
sentence; "we're looking for investment" is not, and it is the single most common
way a good meeting ends in nothing.

You do not have to have the perfect number. You do have to have **a** number, and
be able to say what it buys. Yours buys time and reach:

- finishing 1v1, which is the next thing and needs live connections
- standing up payments properly
- putting it in front of players

If you are not ready to name a figure, say that instead — plainly. "I want to
understand what a raise would look like before I name a number" is an honest
position and a respectable one. What is not respectable is being vague because
you have not thought about it.

---

## Reading the room

- **If they start asking "how would you..." questions** — how would you get
  players, how would you monetise, how would you handle cheating — that is a good
  sign. They are imagining themselves involved. Answer briefly and let them keep
  going.
- **If they go quiet and start playing again**, stop pitching entirely. That is
  the best thing that can happen in the meeting.
- **If they push on the same hole twice**, they have found their real objection.
  Do not defend it a second time. Say "that's the thing I'd want your help
  thinking about" and let them talk. People invest in problems they helped solve.
- **If they ask something you don't know**, say "I don't know, I'll find out."
  Every founder is tempted to guess. A wrong answer they later check costs the
  round; "I don't know" costs nothing.

---

## Things not to do

- **Don't say "it's like Hades meets Spelunky"**, or any other pair of names. It
  invites the comparison, and you will lose it — those had studios. Describe the
  mechanic instead; it is unusual enough to stand on its own.
- **Don't demo with admin mode on.** The oxygen timer and the risk of dying are
  the entire pitch. Being invincible in front of them is showing a worse game.
- **Don't promise dates.** "Next" and "after that" are enough. A missed date you
  volunteered is a fact they will remember.
- **Don't oversell the market.** You do not have market data and they know it.
  Any number you invent will be the weakest thing you say.
- **Don't fill silences.** After you make a strong point, stop. The temptation to
  keep talking is what turns a strong point into a rambling one.

---

## The last thirty seconds

Whatever else happens, leave them with the sentence that is actually true and
actually rare:

> One person built a deterministic action game with a server-verified economy and
> leaderboards that cannot be faked, and it is live right now.

Then give them the URL and let them play it again after you have gone. That is
the part you cannot fake and nobody else in their week will have.