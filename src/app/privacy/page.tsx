import Link from "next/link";

export const metadata = {
  title: "Air Debt — privacy",
};

/**
 * What this site knows about you, which is very little.
 *
 * NOT A COOKIE BANNER, deliberately. A consent pop-up is for sites that set
 * cookies a visitor would want to refuse — analytics, advertising, tracking
 * across other people's sites. This one sets none of those, so a banner would be
 * asking permission for something that does not happen, and putting a dismissal
 * box between a visitor and the page for no reason.
 *
 * A page that says plainly what is stored is the honest version of the same
 * thing, and it is the version worth showing somebody who reads it.
 *
 * Everything here is a statement about the code and has to stay true of it. If
 * analytics are ever added, this page changes first.
 */

const STORED = [
  {
    what: "Your account",
    where: "On the server",
    detail:
      "An email address and a display name, because a leaderboard needs something to put next to a score and a saved run needs somewhere to belong. The email is never shown to anybody else — the boards show only the name you chose.",
  },
  {
    what: "What you have earned",
    where: "On the server",
    detail:
      "Gems, gold, the gear you own and the shortcuts you have opened. This is the save file, and it is on the server rather than in your browser so it follows you to any machine you sign in from.",
  },
  {
    what: "Your runs",
    where: "On the server",
    detail:
      "The keys you pressed, tick by tick, for each run you finish. That is how a leaderboard score is verified — the run is replayed rather than believed. It records what you did in the game and nothing about what you did anywhere else.",
  },
  {
    what: "Your settings",
    where: "In this browser only",
    detail:
      "Key bindings, volume and the display switches. They stay on the machine you set them on and are never sent anywhere, because a keymap belongs to the desk you are sitting at.",
  },
];

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-8 p-6">
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="rounded-full border border-[#2b3644] px-4 py-1.5 text-xs font-semibold tracking-[0.16em] text-[#8a94a6] uppercase transition-colors hover:border-lens/50 hover:text-lens"
        >
          ← Air Debt
        </Link>
        <Link
          href="/contact"
          className="text-xs font-semibold tracking-[0.16em] text-[#6b7a89] uppercase transition-colors hover:text-[#e7ecf2]"
        >
          Contact
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#e7ecf2]">
          Privacy
        </h1>
        <p className="mt-3 text-pretty text-sm leading-relaxed text-[#8a94a6]">
          Short, because there is not much to say.
        </p>
      </div>

      {/* The headline, and the reason there is no banner on this site. */}
      <section className="rounded-lg border border-lens/25 bg-lens/[0.06] p-5">
        <h2 className="font-mono text-xs font-bold tracking-[0.2em] text-lens uppercase">
          No tracking, of any kind
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-[#c7d2dc]">
          There is no analytics on this site. No advertising, no third-party
          scripts, no pixels, and nothing that follows you to other people&apos;s
          websites. Visiting without signing in sets{" "}
          <span className="text-[#e7ecf2]">no cookies at all</span>.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-[#c7d2dc]">
          Signing in sets one, and only one: the cookie that keeps you signed in.
          It exists so the site knows the next page you open is still you. It is
          not used for anything else, and signing out removes it.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-[#8a94a6]">
          That is also why there is no cookie pop-up here. A consent box is for
          asking permission to track you, and asking would imply we do.
        </p>
      </section>

      <section>
        <h2 className="font-mono text-xs font-bold tracking-[0.2em] text-brass uppercase">
          What is stored
        </h2>
        <ul className="mt-4 flex flex-col divide-y divide-[#1c2531] border-y border-[#1c2531]">
          {STORED.map((s) => (
            <li key={s.what} className="py-4">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h3 className="text-sm font-semibold text-[#e7ecf2]">
                  {s.what}
                </h3>
                <span className="font-mono text-[10px] tracking-[0.14em] text-[#6b7a89] uppercase">
                  {s.where}
                </span>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-[#8a94a6]">
                {s.detail}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-mono text-xs font-bold tracking-[0.2em] text-brass uppercase">
          Your side of it
        </h2>
        <p className="text-sm leading-relaxed text-[#8a94a6]">
          Ask for your data or ask for it deleted and it will be done — deleting
          an account removes the runs and the save file with it. There is one
          person to ask, and the ways to reach him are on the{" "}
          <Link href="/contact" className="text-lens underline decoration-lens/30 underline-offset-4 hover:decoration-lens">
            contact page
          </Link>
          .
        </p>
        <p className="text-sm leading-relaxed text-[#8a94a6]">
          Accounts and data are held in Supabase, which stores them on managed
          Postgres, and the site is served by Vercel. Those two see the traffic
          that any host sees; neither is used to profile anybody.
        </p>
      </section>

      <p className="text-xs leading-relaxed text-[#5a6875]">
        Air Debt is in development and made by one person. If any of this changes
        — analytics, for instance — this page changes before the thing does.
      </p>
    </main>
  );
}