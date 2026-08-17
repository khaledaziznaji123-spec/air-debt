import Link from "next/link";
import SignedIn from "../signed-in.tsx";

/**
 * The home screen, laid out from the drawing: the title, four game modes
 * stacked down the middle, and one utility in each corner.
 *
 * It is deliberately BRIGHTER than the dungeon and slightly silly. The game is
 * lit at "you are running out of air", and a menu lit that way is a black
 * rectangle with a logo on it — the first thing anyone sees should look like
 * something worth pressing rather than like the inside of the thing you are
 * afraid of. Same palette, turned all the way up.
 *
 * Only Story is built. The other three modes and all four corners are drawn
 * because the shape of the game is the point of a home screen — a player should
 * see on arrival that there is a versus mode and a survival mode coming. They
 * are marked SOON and do nothing, rather than being hidden or, worse, linking
 * to a page that does not exist.
 */

/** The four modes, in the order they were drawn. */
const MODES = [
  {
    key: "tutorial",
    name: "Tutorial",
    tag: "start here",
    blurb: "Every control, taught by making you use it. Nothing can kill you.",
    index: "00",
    accent: "brass",
    href: "/play?tutorial=1",
  },
  {
    key: "story",
    name: "Story",
    tag: "v1",
    blurb: "Five environments, thirty seconds of air, and a walk back.",
    index: "01",
    accent: "lens",
    href: "/play",
  },
  {
    key: "pvp",
    name: "PvP",
    tag: "1v1",
    blurb: "Two scavengers. One tank of air. Guess how it ends.",
    index: "02",
    accent: "punch",
    href: null,
  },
  {
    key: "speedrun",
    name: "Speed run",
    tag: "ranked",
    blurb: "The whole dungeon against the clock. Every time is on the board.",
    index: "03",
    accent: "brass",
    // This IS the leaderboard, rather than a separate thing that happens to
    // resemble one. A speed run with nowhere to put the time is just a run, and
    // a board with no mode behind it is a page nobody has a reason to open — so
    // they are one entry, and it lands on the board it belongs to.
    href: "/leaderboard?board=speed",
  },
  {
    key: "survival",
    name: "Survival",
    tag: "3D",
    blurb: "Hold a map against waves. Ranked. Probably a bad idea.",
    index: "04",
    accent: "sprout",
    href: null,
  },
] as const;

/**
 * Shop, Profile, Settings, Contact us — one per corner, as drawn.
 *
 * No icons on any of it. The game is pixel art the whole way down and an emoji
 * is somebody else's font rendered at somebody else's resolution — it is the
 * one thing on the page guaranteed not to match. Words carry it.
 */
const CORNERS = [
  // The shop is real, so this one goes somewhere. It is an overlay on the
  // lobby rather than a page of its own, because it spends the same session
  // bank a run banks into — hence the query string rather than a route.
  { key: "shop", label: "Shop", at: "left-5 top-5", href: "/play?shop=1" },
  { key: "profile", label: "Profile", at: "right-5 top-5", href: "/profile" },
  {
    key: "settings",
    label: "Settings",
    at: "left-5 bottom-5",
    href: "/settings",
  },
  { key: "contact", label: "Contact us", at: "right-5 bottom-5", href: null },
] as const;

/** Tailwind cannot see a class name built at runtime, so the map is literal. */
const ACCENT: Record<string, string> = {
  lens: "bg-lens text-[#06231f] border-[#2e8c87]",
  punch: "bg-punch text-[#2c0714] border-[#a3234a]",
  brass: "bg-brass text-[#2c1f05] border-[#8a6722]",
  sprout: "bg-sprout text-[#0d2410] border-[#3f8a3c]",
};

function Corner({
  label,
  at,
  href,
}: {
  label: string;
  at: string;
  href: string | null;
}) {
  const base = `absolute ${at} z-20 rounded-2xl border-2 border-b-4 px-4 py-2 text-xs font-black tracking-wider uppercase backdrop-blur-sm`;

  if (href) {
    return (
      <Link
        href={href}
        className={`${base} inline-block border-brass/50 bg-brass/15 text-brass transition-transform hover:-translate-y-0.5 active:translate-y-0.5 active:border-b-2`}
      >
        {label}
      </Link>
    );
  }
  return (
    <button
      type="button"
      disabled
      title={`${label} — not built yet`}
      className={`${base} cursor-not-allowed border-rock-edge bg-rock/85 text-foreground/70`}
    >
      {label}
    </button>
  );
}

export default function Home() {
  return <SignedIn>{HomeScreen()}</SignedIn>;
}

function HomeScreen() {
  return (
    <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 py-24">
      {/* The dungeon, going past. No monsters in it: this is the bit of the run
          where nothing has gone wrong yet. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="ad-back absolute inset-0 opacity-70" />
        <div className="ad-front absolute inset-0" />
        {/* The runner does not move. The floor does. */}
        <div
          className="ad-runner absolute"
          style={{ left: "18%", bottom: "184px" }}
        />
        {/* Everything above the tile fades into the page, and the middle is
            knocked back so the menu on top of it stays readable. */}
        <div className="absolute inset-0 bg-gradient-to-b from-background/90 via-background/25 to-background/70" />
      </div>

      <div className="relative z-10 flex w-full max-w-xl flex-col items-center">
        <h1 className="ad-sway font-mono text-6xl font-black tracking-tight text-foreground drop-shadow-[0_4px_0_rgba(0,0,0,0.55)] sm:text-7xl">
          AIR<span className="text-lens">—</span>DEBT
        </h1>
        <p className="mt-4 rounded-full border-2 border-brass/40 bg-rock/80 px-4 py-1 text-center text-sm font-bold text-brass">
          you are renting every breath. good luck!
        </p>

        <nav className="mt-10 flex w-full flex-col gap-3">
          {MODES.map((m) => {
            const body = (
              <>
                <span
                  aria-hidden
                  className="grid size-11 shrink-0 place-items-center rounded-xl bg-black/15 font-mono text-lg font-black leading-none opacity-70"
                >
                  {m.index}
                </span>
                <span className="flex-1 text-left">
                  <span className="flex items-baseline gap-2">
                    <span className="font-mono text-xl font-black tracking-tight">
                      {m.name}
                    </span>
                    {m.tag && (
                      <span className="font-mono text-xs font-bold opacity-70">
                        ({m.tag})
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-xs font-semibold opacity-75">
                    {m.blurb}
                  </span>
                </span>
              </>
            );

            return m.href ? (
              <Link
                key={m.key}
                href={m.href}
                className={`ad-bob group flex items-center gap-4 rounded-2xl border-2 border-b-[6px] px-5 py-4 transition-transform hover:-translate-y-0.5 active:translate-y-0.5 active:border-b-2 ${ACCENT[m.accent]}`}
              >
                {body}
                <span
                  aria-hidden
                  className="text-2xl font-black transition-transform group-hover:translate-x-1"
                >
                  →
                </span>
              </Link>
            ) : (
              <div
                key={m.key}
                aria-disabled
                className="flex cursor-not-allowed items-center gap-4 rounded-2xl border-2 border-b-[6px] border-rock-edge bg-rock-edge/70 px-5 py-4 text-foreground/80 backdrop-blur-sm"
              >
                {body}
                <span className="shrink-0 rounded-lg border-2 border-brass/40 px-2 py-0.5 font-mono text-[10px] font-black tracking-widest text-brass/80 uppercase">
                  Soon
                </span>
              </div>
            );
          })}
        </nav>
      </div>

      {CORNERS.map((c) => (
        <Corner key={c.key} label={c.label} at={c.at} href={c.href} />
      ))}
    </main>
  );
}
