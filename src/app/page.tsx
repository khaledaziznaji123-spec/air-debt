"use client";

import Image from "next/image";
import Gate from "./gate.tsx";
import { useAuthLinkLanding } from "./link-landing.ts";

/**
 * The landing page — the first thing anyone sees.
 *
 * The home screen behind it is bright and a bit silly on purpose, because it is
 * a menu you come back to between runs. This is not that. This is the page that
 * has to answer "what is this" in about four seconds, and the honest answer is
 * a dark hole with a clock running, so the page is lit like the game rather
 * than like the menu. The screenshots do most of the work; the words get out of
 * their way.
 *
 * Everything here is real. The four shots are captures of the live build — a run
 * with one point eight seconds left on the clock, the flooded cave, the shop,
 * and a leaderboard with real scores on it — not mock-ups, and the one line
 * under the title is the game's rule rather than a slogan.
 */

/**
 * The captures, and the one thing each is there to show.
 *
 * The copy here described an older game — "rock, then fire", back when those
 * were the first two environments. They are the fourth and fifth now, and the
 * order is deliberate: parkour teaches you to move, poison teaches you to read
 * a room, water takes the floor away, rock puts something in a doorway, and
 * fire is where the clock finally beats you. Saying "rock then fire" sold two
 * environments out of five and the two least interesting.
 */
const SHOTS = [
  {
    src: "/shots/fire.png",
    alt: "The fire environment with one point eight seconds of air left: the clock and its dial have gone red, a phoenix hangs above a lava pit throwing fire down at the player, and two chests sit further along the ledge.",
    title: "Thirty seconds",
    line: "The clock is the whole game. Every fight, every chest and every step back out is spent from the same tank. The biggest one you can buy holds three and a half minutes — and a careful run that takes every chest finishes with about five seconds left, which is exactly as much room as it sounds like.",
  },
  {
    src: "/shots/cenote.png",
    alt: "Underwater in the flooded cave: two shafts of daylight fall through openings in the rock to the seabed, sharks cross the middle distance, and chests sit on the bottom.",
    title: "Five environments, hardest last",
    line: "Parkour, poison, water, rock, fire. The water is a flooded cave modelled on a real one — the rock closes over your head and the only air is the shafts of daylight. Down there you are on a second clock: five breaths.",
  },
  {
    src: "/shots/shop.png",
    alt: "The shop, gear tab: an air tank at ten of ten and maxed, then rib plate, gripped boots and long stride with their gem prices and upgrade levels.",
    title: "What you carry back",
    line: "Gems come out of the dark and turn into reach, air and armour. Walk out and it is yours. Die down there and it stays down there — that decision, made with the clock running, is the game.",
  },
  {
    src: "/shots/board.png",
    alt: "The leaderboard, showing four ranked runs with their scores.",
    title: "Scores you cannot fake",
    line: "A score is never submitted. The keys that were pressed are, and the server replays them through the same simulation from a seed it issued before the run began. Forging a score means forging a run.",
  },
];

/**
 * The part that is worth saying out loud to somebody who builds things.
 *
 * Every line here is a fact about the build rather than a claim about the
 * future, and each one is checkable — which is the point. "Server-verified" is
 * the kind of phrase that usually means nothing; here it means the server
 * re-simulates the run.
 */
const FACTS = [
  {
    title: "The same run, every time",
    line: "The game is a pure function of the keys you press, at a fixed sixty ticks a second. Play the same run twice and it plays out identically — on any machine, in any browser, a year from now.",
  },
  {
    title: "Leaderboards you cannot fake",
    line: "A score is never submitted. The keystrokes are, and the server replays them through the same reducer from a seed it issued before the run started. Forging a score means forging a run.",
  },
  {
    title: "Nothing is client-written",
    line: "There is no request in this game that adds to a balance by asking. Your loot is credited from the replay of the run that earned it — so the economy cannot be edited from a browser console, and it never could be.",
  },
];

export default function Landing() {
  // A link that Supabase redirected here instead of to /auth/confirm.
  useAuthLinkLanding();

  return (
    <main className="min-h-full bg-[#0b0e14] text-[#e7ecf2]">
      {/* ------------------------------------------------------------ hero */}
      <section className="relative overflow-hidden border-b border-white/5">
        {/* The mouth of the cave, as light rather than as a picture: a cold
            spill from the top and a warm one from below, which is exactly how
            the game itself is lit. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 90% at 50% -20%, rgba(95,217,207,0.16), transparent 60%)," +
              "radial-gradient(90% 70% at 50% 120%, rgba(255,122,36,0.13), transparent 65%)",
          }}
        />
        <div className="relative mx-auto flex max-w-5xl flex-col items-center px-6 pt-20 pb-16 text-center sm:pt-28">
          <h1 className="font-mono text-5xl font-bold tracking-[0.3em] sm:text-7xl">
            AIR<span className="text-[#5fd9cf]"> DEBT</span>
          </h1>
          {/* The argument, not a description.
              This used to read "Thirty seconds of air. Five environments deep.
              Everything you are carrying is on you" — three true facts that ask
              the reader nothing. The second sentence is the whole game: it is
              the reason the timer is interesting rather than merely present,
              and it puts a question in your head before you have scrolled. */}
          <p className="mt-6 max-w-xl text-balance text-xl leading-relaxed text-[#e7ecf2] sm:text-2xl">
            Thirty seconds of air — and every second you spend down there is a
            second you need to get back.
          </p>
          <p className="mt-4 max-w-lg text-balance text-base leading-relaxed text-[#9fb0c0] sm:text-lg">
            Walk out and everything you are carrying is yours. Don&apos;t, and
            none of it was.
          </p>

          {/* The sign-in used to sit here.
              Asking for an account is the first thing a stranger was met with,
              before they had seen a single frame of the game — which is asking
              somebody to commit to something they have not been shown. It is at
              the bottom now, after the screenshots and after the argument, where
              the answer to "why would I" has already been given. */}
          <a
            href="#play"
            className="mt-9 inline-flex items-center gap-2 rounded-full border border-[#5fd9cf]/40 px-6 py-2.5 font-mono text-xs font-bold tracking-[0.18em] text-[#5fd9cf] uppercase transition-colors hover:border-[#5fd9cf] hover:bg-[#5fd9cf]/10"
          >
            Play free <span aria-hidden>↓</span>
          </a>

          <p className="mt-8 font-mono text-xs tracking-widest text-[#5a6875]">
            FREE · IN YOUR BROWSER · KEYBOARD ONLY
          </p>
        </div>
      </section>

      {/* ------------------------------------------------------------ shots */}
      <section className="mx-auto max-w-5xl px-6 py-16 sm:py-24">
        <ul className="flex flex-col gap-16 sm:gap-24">
          {SHOTS.map((shot) => (
            <li key={shot.src} className="flex flex-col gap-5">
              <div className="overflow-hidden rounded-xl border border-white/10 bg-black shadow-2xl shadow-black/60">
                <Image
                  src={shot.src}
                  alt={shot.alt}
                  width={1400}
                  height={713}
                  className="h-auto w-full"
                  /* The first one is what the page is judged on, so it is not
                     lazy: it should be there when the hero is. */
                  priority={shot.src === SHOTS[0].src}
                />
              </div>
              <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-6">
                <h2 className="shrink-0 font-mono text-sm tracking-[0.25em] text-[#5fd9cf]">
                  {shot.title.toUpperCase()}
                </h2>
                <p className="text-pretty text-[#9fb0c0]">{shot.line}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* ------------------------------------------------------------ facts */}
      <section className="border-t border-white/5 bg-white/[0.02]">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <h2 className="font-mono text-sm tracking-[0.25em] text-[#5fd9cf]">
            THINGS YOU CAN CHECK
          </h2>
          <ul className="mt-8 grid gap-8 sm:grid-cols-3">
            {FACTS.map((fact) => (
              <li key={fact.title} className="flex flex-col gap-2">
                <h3 className="text-balance font-semibold text-[#e7ecf2]">
                  {fact.title}
                </h3>
                <p className="text-pretty text-sm leading-relaxed text-[#9fb0c0]">
                  {fact.line}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* -------------------------------------------------------------- play */}
      <section
        id="play"
        className="border-t border-white/5 px-6 py-20 sm:py-28"
      >
        <div className="mx-auto flex max-w-xl flex-col items-center text-center">
          <h2 className="font-mono text-2xl font-bold tracking-tight text-[#e7ecf2] sm:text-3xl">
            Thirty seconds is not very long.
          </h2>
          <p className="mt-4 text-pretty text-[#9fb0c0]">
            Free, in the browser, no download. An account keeps what you carry
            out — the shortcuts you open are permanent, and they are the only way
            the maths ever works.
          </p>
          {/* A flex container, not a plain div.
              The form inside is `w-full max-w-md` with no automatic margins, so
              in an ordinary block it capped its width and then sat against the
              left edge — centred text above it, left-aligned form under it. The
              parent's `items-center` could not reach it because the wrapper, not
              the form, was the flex child. Its own top margin does the spacing,
              so there is none here. */}
          <div className="flex w-full justify-center">
            <Gate />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- foot */}
      <footer className="border-t border-white/5 px-6 py-10 text-center">
        <p className="font-mono text-xs tracking-widest text-[#5a6875]">
          AIR DEBT — IN DEVELOPMENT
        </p>
        {/* A stranger arrives here rather than on the home screen, so the way to
            reach anybody has to exist on this page too. */}
        <a
          href="/contact"
          className="mt-3 inline-block font-mono text-xs tracking-widest text-[#5fd9cf]/70 underline decoration-[#5fd9cf]/25 underline-offset-4 transition-colors hover:text-[#5fd9cf] hover:decoration-[#5fd9cf]"
        >
          CONTACT AND SUPPORT
        </a>
      </footer>
    </main>
  );
}
