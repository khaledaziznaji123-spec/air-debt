import Link from "next/link";

export const metadata = { title: "Air Debt — terms" };

/**
 * The terms, on one page, in words a player can read.
 *
 * Long terms are not safer terms — they are terms nobody reads, which means
 * nobody agreed to them in any sense that matters. A free game made by one
 * person with no payments in it does not need eleven pages, and pretending it
 * does would be dressing up as a company.
 *
 * Written in the same voice as the privacy page and for the same reason: this
 * is one of the few pages a stranger reads before deciding whether to trust the
 * thing, so it should sound like a person rather than a template.
 */

const TERMS: { h: string; p: React.ReactNode[] }[] = [
  {
    h: "What this is",
    p: [
      <>
        Air Debt is a free browser game, in development, made by one person. By
        playing it you are agreeing to what is on this page. If you do not, the
        remedy is simple and costs you nothing: do not play it.
      </>,
    ],
  },
  {
    h: "Your account",
    p: [
      <>
        You need an email address and nothing else. Keep your password to
        yourself — anything done from your account is treated as done by you.
      </>,
      <>
        You may have it deleted at any time, with your runs and your save,
        by asking on the{" "}
        <Link href="/contact" className="text-lens underline decoration-lens/30 underline-offset-4 hover:decoration-lens">
          support page
        </Link>
        . You do not have to give a reason.
      </>,
      <>
        One account per person is the intent. It is not enforced today, and if
        that changes this page changes with it.
      </>,
    ],
  },
  {
    h: "Playing fairly",
    p: [
      <>
        Modifying the game to forge a score, or automating play to farm one, is
        the one thing that will get an account removed from the leaderboards or
        removed entirely.
      </>,
      <>
        It is also the thing least worth attempting. Every ranked run is
        replayed on the server from a seed the server issued, so a score that did
        not happen does not survive the check. This rule exists to say what
        happens next, not to plug a hole.
      </>,
    ],
  },
  {
    h: "There is nothing to buy",
    p: [
      <>
        No payment provider is connected to this game. Gems, gold and everything
        in the shop are earned by playing and have no monetary value, cannot be
        exchanged for money, and cannot be transferred between accounts.
      </>,
      <>
        If that ever changes — and paid cosmetics are on the plan — this page
        will say so before a single thing is sold.
      </>,
    ],
  },
  {
    h: "It is in development",
    p: [
      <>
        Things change, break, and occasionally get reset while the game is being
        built. Balance will be altered, leaderboards may be cleared between
        seasons, and features may be removed as well as added.
      </>,
      <>
        The service is provided as it is, with no promise that it will be
        available, correct, or here at all in a year. Nothing you earn in it is
        property, and nobody is owed compensation for a game that stops.
      </>,
    ],
  },
  {
    h: "What belongs to whom",
    p: [
      <>
        Air Debt — its name, code, artwork and sound — is © 2026 Khalid Aziz. All
        of it was generated or written for this project; there is no licensed art
        or stock audio in it.
      </>,
      <>
        Record it, stream it, and show it to people, commercially or not — that
        is a favour, not an infringement. Do not sell it, and do not ship a copy
        of it as your own work.
      </>,
      <>
        It is built on open-source software, each piece used under its own
        licence and none of it claimed here.
      </>,
    ],
  },
  {
    h: "Your data",
    p: [
      <>
        Covered properly on the{" "}
        <Link href="/privacy" className="text-lens underline decoration-lens/30 underline-offset-4 hover:decoration-lens">
          privacy page
        </Link>
        , which is shorter than this one. The summary: no tracking of any kind,
        no cookies at all until you sign in, and then exactly one.
      </>,
    ],
  },
  {
    h: "If these change",
    p: [
      <>
        They will, because the game is not finished. Material changes will be
        said plainly rather than slipped in — and the dated line at the bottom of
        this page is how you can tell.
      </>,
    ],
  },
];

export default function TermsPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-8 p-6">
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="rounded-full border border-[#2b3644] px-4 py-1.5 text-xs font-semibold tracking-[0.16em] text-[#8a94a6] uppercase transition-colors hover:border-lens/50 hover:text-lens"
        >
          ← Air Debt
        </Link>
        <div className="flex items-center gap-5">
          <Link
            href="/privacy"
            className="text-xs font-semibold tracking-[0.16em] text-[#6b7a89] uppercase transition-colors hover:text-[#e7ecf2]"
          >
            Privacy
          </Link>
          <Link
            href="/contact"
            className="text-xs font-semibold tracking-[0.16em] text-[#6b7a89] uppercase transition-colors hover:text-[#e7ecf2]"
          >
            Support
          </Link>
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#e7ecf2]">
          Terms
        </h1>
        <p className="mt-3 text-pretty text-sm leading-relaxed text-[#8a94a6]">
          One page, in plain words. Long terms are not safer terms — they are
          terms nobody reads, and nobody agreed to what they did not read.
        </p>
      </div>

      <div className="flex flex-col divide-y divide-[#1c2531] border-y border-[#1c2531]">
        {TERMS.map((s) => (
          <section key={s.h} className="py-5">
            <h2 className="font-mono text-xs font-bold tracking-[0.2em] text-lens uppercase">
              {s.h}
            </h2>
            {s.p.map((para, i) => (
              <p
                key={i}
                className="mt-2.5 text-sm leading-relaxed text-[#8a94a6]"
              >
                {para}
              </p>
            ))}
          </section>
        ))}
      </div>

      <p className="text-xs leading-relaxed text-[#5a6875]">
        Last changed 20 August 2026. Air Debt is made by one person; there is no
        company behind it and no legal department to route this through, which is
        why it reads like it was written by somebody rather than assembled from a
        template.
      </p>
    </main>
  );
}