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
 * than like the menu.
 *
 * REWRITTEN FOR THE FOUR SECONDS. It used to be four full-width screenshots,
 * each followed by a paragraph of eighty words. That is a page you read, and
 * nobody reads a page they have not decided to care about yet — the words were
 * doing the persuading and the pictures were waiting their turn.
 *
 * So: one screenshot, at the moment the game is most itself, and everything
 * else in lines short enough to take in at a glance. The dungeon's own artwork
 * carries the atmosphere instead of more captures of the interface. The reader
 * should be able to skim the whole page in fifteen seconds and know whether
 * they want it — and only then meet a sign-in box.
 *
 * Everything here is still real. The capture is the live build with one point
 * eight seconds left on the clock, and every number in the strip is counted out
 * of the repository rather than rounded up for the page.
 */

/** What the game asks of you, in the order you do it. */
const STEPS = [
  {
    n: "01",
    t: "Go down",
    d: "Thirty seconds of air. The dungeon is far longer than that.",
  },
  {
    n: "02",
    t: "Take what you can",
    d: "Gems, gold, and the lever that opens a shortcut forever.",
  },
  {
    n: "03",
    t: "Get back out",
    d: "Walk out and it is yours. Don't, and none of it was.",
  },
];

/** The five, in the order they are played. */
const DEPTHS = [
  { name: "Parkour", d: "Teaches you to move", tone: "#7fd06a" },
  { name: "Poison", d: "Teaches you to read a room", tone: "#a58cf0" },
  { name: "Water", d: "Takes the floor away", tone: "#5fd9cf" },
  { name: "Rock", d: "Puts something in the doorway", tone: "#c08a5a" },
  { name: "Fire", d: "Where the clock beats you", tone: "#ff7a24" },
];

/** Counted out of the repository. Nothing here is rounded up. */
const COUNTS = [
  { v: "5", l: "environments" },
  { v: "12", l: "enemies" },
  { v: "30", l: "shop items" },
  { v: "3:30", l: "most air you can hold" },
  { v: "298", l: "tests" },
];

/**
 * The part worth saying to somebody who builds things.
 *
 * Every line is a fact about the build rather than a claim about the future,
 * and each one is checkable — which is the point. "Server-verified" is the kind
 * of phrase that usually means nothing; here it means the server re-simulates
 * the run.
 *
 * Cut to a sentence each. They used to be paragraphs, and a paragraph is where
 * an argument goes to be skipped.
 */
const FACTS = [
  {
    title: "The same run, every time",
    line: "The game is a pure function of the keys you press, sixty times a second. Play a run twice and it plays out identically, on any machine.",
  },
  {
    title: "Leaderboards you cannot fake",
    line: "A score is never submitted — the keystrokes are, and the server replays them from a seed it issued first. Forging a score means forging a run.",
  },
  {
    title: "Nothing is client-written",
    line: "No request in this game adds to a balance by asking. Your loot is credited from the replay of the run that earned it.",
  },
];

export default function Landing() {
  // A link that Supabase redirected here instead of to /auth/confirm.
  useAuthLinkLanding();

  return (
    <main className="min-h-full bg-[#0b0e14] text-[#e7ecf2]">
      {/* ------------------------------------------------------------ hero */}
      <section className="relative overflow-hidden border-b border-white/5">
        {/* The dungeon's own back wall, from the menu's parallax — artwork
            rather than another capture of the interface. Held well back so it
            reads as atmosphere and never competes with the words. */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <Image
            src="/art/menu-back.png"
            alt=""
            width={1280}
            height={720}
            priority
            className="h-full w-full object-cover opacity-[0.13] [image-rendering:pixelated]"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(120% 90% at 50% -20%, rgba(95,217,207,0.16), transparent 60%)," +
                "radial-gradient(90% 70% at 50% 120%, rgba(255,122,36,0.14), transparent 65%)," +
                "linear-gradient(to bottom, rgba(11,14,20,0.55), rgba(11,14,20,0.92))",
            }}
          />
        </div>

        <div className="relative mx-auto flex max-w-5xl flex-col items-center px-6 pt-20 pb-14 text-center sm:pt-24">
          <h1 className="font-mono text-5xl font-bold tracking-[0.3em] sm:text-7xl">
            AIR<span className="text-[#5fd9cf]"> DEBT</span>
          </h1>
          <p className="mt-6 max-w-xl text-balance text-xl leading-snug text-[#e7ecf2] sm:text-2xl">
            Thirty seconds of air — and every second you spend down there is a
            second you need to get back.
          </p>

          <a
            href="#play"
            className="mt-8 inline-flex items-center gap-2 rounded-full border border-[#5fd9cf]/40 px-6 py-2.5 font-mono text-xs font-bold tracking-[0.18em] text-[#5fd9cf] uppercase transition-colors hover:border-[#5fd9cf] hover:bg-[#5fd9cf]/10"
          >
            Play free <span aria-hidden>↓</span>
          </a>
          <p className="mt-6 font-mono text-xs tracking-widest text-[#5a6875]">
            FREE · IN YOUR BROWSER · KEYBOARD OR PHONE
          </p>
        </div>
      </section>

      {/* ------------------------------------------------------------ steps */}
      <section className="mx-auto max-w-5xl px-6 py-14">
        {/* Numbered because it IS a sequence — three things in the order they
            happen, not three features wearing numbers for decoration. */}
        <ol className="grid gap-8 sm:grid-cols-3 sm:gap-10">
          {STEPS.map((s) => (
            <li key={s.n} className="flex flex-col gap-1.5">
              <span className="font-mono text-xs tracking-[0.3em] text-[#5fd9cf]/50">
                {s.n}
              </span>
              <h2 className="font-mono text-lg font-bold tracking-tight text-[#e7ecf2]">
                {s.t}
              </h2>
              <p className="text-pretty text-sm leading-relaxed text-[#9fb0c0]">
                {s.d}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* ------------------------------------------------------------- shot */}
      <section className="mx-auto max-w-5xl px-6 pb-14">
        {/* ONE capture, not four. This is the game at the moment it is most
            itself: the clock red at one point eight seconds, a phoenix over a
            lava pit, and two chests still further along the ledge. */}
        <figure className="flex flex-col gap-3">
          <div className="overflow-hidden rounded-xl border border-white/10 bg-black shadow-2xl shadow-black/60">
            <Image
              src="/shots/fire.png"
              alt="The fire environment with one point eight seconds of air left: the clock and its dial have gone red, a phoenix hangs above a lava pit throwing fire down at the player, and two chests sit further along the ledge."
              width={1400}
              height={713}
              priority
              className="h-auto w-full"
            />
          </div>
          <figcaption className="text-center font-mono text-xs tracking-[0.18em] text-[#5a6875] uppercase">
            1.8 seconds left · two chests still ahead · this is the decision
          </figcaption>
        </figure>
      </section>

      {/* ------------------------------------------------------------ depths */}
      <section className="border-y border-white/5 bg-white/[0.02]">
        <div className="mx-auto max-w-5xl px-6 py-12">
          <h2 className="font-mono text-sm tracking-[0.25em] text-[#5fd9cf]">
            FIVE ENVIRONMENTS, HARDEST LAST
          </h2>
          <p className="mt-2 text-sm text-[#5a6875]">
            Parkour, poison, water, rock, fire — each one takes something away
            from you.
          </p>
          <ul className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-5">
            {DEPTHS.map((d) => (
              <li key={d.name} className="flex flex-col gap-1">
                {/* A rule in the environment's own colour does the work an icon
                    would, at none of the cost of drawing five icons. */}
                <span
                  aria-hidden
                  className="h-0.5 w-8 rounded-full"
                  style={{ background: d.tone }}
                />
                <span className="mt-1 font-mono text-sm font-bold text-[#e7ecf2]">
                  {d.name}
                </span>
                <span className="text-xs leading-snug text-[#7d8b9a]">
                  {d.d}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ------------------------------------------------------------ counts */}
      <section className="mx-auto max-w-5xl px-6 py-12">
        <ul className="grid grid-cols-2 gap-6 sm:grid-cols-5">
          {COUNTS.map((c) => (
            <li key={c.l} className="flex flex-col">
              <span className="font-mono text-3xl font-bold tabular-nums text-[#ffd166]">
                {c.v}
              </span>
              <span className="mt-0.5 font-mono text-[11px] tracking-[0.14em] text-[#5a6875] uppercase">
                {c.l}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* ------------------------------------------------------------ facts */}
      <section className="border-t border-white/5 bg-white/[0.02]">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <h2 className="font-mono text-sm tracking-[0.25em] text-[#5fd9cf]">
            THINGS YOU CAN CHECK
          </h2>
          <ul className="mt-6 grid gap-8 sm:grid-cols-3">
            {FACTS.map((fact) => (
              <li key={fact.title} className="flex flex-col gap-1.5">
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
        className="border-t border-white/5 px-6 py-16 sm:py-20"
      >
        <div className="mx-auto flex max-w-xl flex-col items-center text-center">
          <h2 className="font-mono text-2xl font-bold tracking-tight text-[#e7ecf2] sm:text-3xl">
            Thirty seconds is not very long.
          </h2>
          <p className="mt-3 text-pretty text-[#9fb0c0]">
            Free, no download, and it plays on a phone turned sideways. An
            account keeps what you carry out.
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
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          <a
            href="/contact"
            className="inline-block font-mono text-xs tracking-widest text-[#5fd9cf]/70 underline decoration-[#5fd9cf]/25 underline-offset-4 transition-colors hover:text-[#5fd9cf] hover:decoration-[#5fd9cf]"
          >
            CONTACT AND SUPPORT
          </a>
          <a
            href="/terms"
            className="inline-block font-mono text-xs tracking-widest text-[#5a6875] underline decoration-[#5a6875]/40 underline-offset-4 transition-colors hover:text-[#9fb0c0]"
          >
            TERMS
          </a>
          <a
            href="/privacy"
            className="inline-block font-mono text-xs tracking-widest text-[#5a6875] underline decoration-[#5a6875]/40 underline-offset-4 transition-colors hover:text-[#9fb0c0]"
          >
            PRIVACY
          </a>
        </div>
      </footer>
    </main>
  );
}