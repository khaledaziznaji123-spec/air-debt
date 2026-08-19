/**
 * The questions that get asked, answered before they are asked.
 *
 * Every one of these is a real question somebody has put to this project, or a
 * real confusion watched happening over a shoulder — the shortcut that cannot
 * be bought, the run that did not count, the timer that seems impossible. An
 * invented FAQ is a marketing page with question marks in it; the useful kind
 * is a list of the places people actually get stuck.
 *
 * A server component built from `<details>`: it opens and closes with no
 * JavaScript at all, works before hydration, and is searchable by the browser's
 * own find-in-page even while collapsed.
 */

const FAQS: { q: string; a: React.ReactNode }[] = [
  {
    q: "Is it free?",
    a: (
      <>
        Yes, all of it, and there is nothing to buy at any price — there is no
        payment provider connected to this game. Everything in the shop is paid
        for with gems and gold you carried out of the dungeon yourself.
      </>
    ),
  },
  {
    q: "Do I need an account?",
    a: (
      <>
        To keep anything, yes. Without one you can still play the tutorial, but
        a run cannot bank what it earns and cannot appear on a leaderboard,
        because there is nowhere to put either. Signing up takes an email
        address and nothing else.
      </>
    ),
  },
  {
    q: "The timer feels impossible. Am I missing something?",
    a: (
      <>
        Yes, and it is the whole game. The biggest air tank you can buy is
        deliberately not enough to walk the dungeon — you are meant to run out.
        What closes the gap is <strong>shortcuts</strong>: each one is opened by
        a lever placed <em>past</em> the ground it skips, so you have to make the
        long walk once to never make it again. A shortcut is permanent, survives
        death, and cannot be bought.
      </>
    ),
  },
  {
    q: "I died. Did I lose everything?",
    a: (
      <>
        You lost the run&apos;s loot, and only that. Gear and anything bought
        stay yours, and every lever you flicked on the way down stays open
        forever. Dying costs you the trip, not the progress.
      </>
    ),
  },
  {
    q: "My run did not appear on the leaderboard.",
    a: (
      <>
        Two reasons cover almost every case. Only <strong>ranked</strong> runs
        are ranked — a normal run is yours to earn from, not to be scored on.
        And if the server could not be reached when the run started, the game
        says so before you go down and marks it a practice run: it plays, but
        nothing banks and nothing ranks. If neither of those fits, write below
        and say roughly when.
      </>
    ),
  },
  {
    q: "Can people cheat the leaderboards?",
    a: (
      <>
        A score is never submitted. What is submitted is the input log — which
        buttons, on which ticks — and the server replays it through the same
        simulation from a seed it issued before the run began. Faking a score
        means producing a log that genuinely plays out to it, which is a run. See{" "}
        <a
          href="/privacy"
          className="text-[#5fd9cf] underline decoration-[#5fd9cf]/30 underline-offset-4 hover:decoration-[#5fd9cf]"
        >
          the privacy page
        </a>{" "}
        for what is stored while doing it.
      </>
    ),
  },
  {
    q: "Will my progress still be there tomorrow?",
    a: (
      <>
        Yes. Your save lives on the server rather than in this browser, so it
        follows the account to any machine you sign in from. What stays on the
        machine is only what belongs to it: key bindings, volume, and the layout
        of the on-screen controls.
      </>
    ),
  },
  {
    q: "Does it work on a phone?",
    a: (
      <>
        Turned sideways, yes — on-screen controls appear under your thumbs and
        can be moved and resized in Settings. Being honest about it: the game is
        built around timing windows measured in tenths of a second, and touch is
        not the right instrument for that yet. It works. It is not the way to see
        it at its best.
      </>
    ),
  },
  {
    q: "I forgot my password.",
    a: (
      <>
        Use &ldquo;Reset your password&rdquo; on the sign-in form and a one-time
        link comes to your email. No password is ever sent to you in an email,
        because an email is not a safe place to keep one.
      </>
    ),
  },
  {
    q: "Can I delete my account and everything in it?",
    a: (
      <>
        Yes — ask below and it is done, including the runs and the save. There is
        one person to ask.
      </>
    ),
  },
];

export default function Faqs() {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-mono text-xs font-bold tracking-[0.2em] text-[#5fd9cf] uppercase">
        Common questions
      </h2>
      <ul className="flex flex-col divide-y divide-[#1c2531] border-y border-[#1c2531]">
        {FAQS.map((f) => (
          <li key={f.q}>
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-3.5 text-sm font-semibold text-[#e7ecf2] transition-colors hover:text-[#5fd9cf]">
                {f.q}
                <span
                  aria-hidden
                  className="shrink-0 font-mono text-lg leading-none text-[#4a5765] transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="pb-4 text-sm leading-relaxed text-[#8a94a6]">
                {f.a}
              </p>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}