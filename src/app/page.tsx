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
 * Everything here is real. The three shots are captures of the actual build at
 * the actual resolution, not mock-ups, and the one line under the title is the
 * game's rule rather than a slogan.
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
    src: "/shots/rock.png",
    alt: "Inside the dungeon: the player facing two goblins with an archer on a ledge above, a chest beside them, and the air clock running down at the top of the screen.",
    title: "Thirty seconds",
    line: "The clock is the whole game. Every fight, every chest and every step back out is spent from the same tank — and the biggest tank you can buy still is not enough to walk the whole way. Shortcuts are the only way the maths works.",
  },
  {
    src: "/shots/fire.png",
    alt: "The fire environment: a mini-boss holding a doorway, a curtain of lava pouring from the ceiling, and a flamethrower enemy further in.",
    title: "Five environments, hardest last",
    line: "Parkour, poison, water, rock, fire. Something is standing in the way out of each one and it will not let you slide past. At the bottom is a boss built from your own move set, with the one move it cannot answer left out of its own.",
  },
  {
    src: "/shots/shop.png",
    alt: "The shop, showing weapons with gem prices, upgrade levels and short descriptions.",
    title: "What you carry back",
    line: "Gems come out of the dark and turn into reach, air and armour. Walk out and it is yours. Die down there and it stays down there — that decision, made with the clock running, is the game.",
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
    title: "Deterministic simulation",
    line: "The game is a pure reducer at a fixed sixty ticks a second, with PixiJS as a view layer over the top. Nothing about how the game plays lives in the renderer.",
  },
  {
    title: "Leaderboards you cannot fake",
    line: "A score is never submitted. The keystrokes are, and the server replays them through the same reducer from a seed it issued before the run started. Forging a score means forging a run.",
  },
  {
    title: "Nothing is client-written",
    line: "No request in the game adds to a balance by asking. Loot is credited from the replay, so the economy cannot be edited from a browser console.",
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
          <p className="mt-6 max-w-xl text-balance text-lg leading-relaxed text-[#9fb0c0] sm:text-xl">
            Thirty seconds of air. Five environments deep. Everything you are
            carrying is on you — and the way out is the way you came.
          </p>

          <Gate />

          <p className="mt-8 font-mono text-xs tracking-widest text-[#5a6875]">
            KEYBOARD ONLY · A D MOVE · SPACE JUMP · SHIFT SLIDE · Q SWING · R
            PARRY · L STUN
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
                  width={1281}
                  height={721}
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
            UNDER IT
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

      {/* ------------------------------------------------------------- foot */}
      <footer className="border-t border-white/5 px-6 py-10 text-center">
        <p className="font-mono text-xs tracking-widest text-[#5a6875]">
          AIR DEBT — IN DEVELOPMENT
        </p>
      </footer>
    </main>
  );
}
