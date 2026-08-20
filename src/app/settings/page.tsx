import Link from "next/link";
import AdminBox from "./admin-box";
import ControlsBox from "./controls-box";
import LegalBox from "./legal-box";
import SecurityBox from "./security-box";
import TouchBox from "./touch-box";
import ViewBox from "./view-box";

export const metadata = { title: "Air Debt — settings" };

/**
 * Settings, in sections rather than in one column.
 *
 * It used to be every box stacked on top of every other one, which was fine
 * with two boxes and stopped being fine at six: the keymap alone is fifteen
 * rows, so anybody looking for the volume slider scrolled past a page of keys to
 * find it, and the legal section would have been below even that.
 *
 * TABS AS LINKS, NOT AS STATE. Each one is a real URL — `/settings?tab=sound`
 * can be sent to somebody, opened in a new tab, and reached by the back button,
 * and the page stays a server component with no hydration to get wrong. The
 * only cost is that the active tab has to be read from the query string, which
 * is one line.
 *
 * The bar this page is held to has not changed: every control on it does
 * something. Volume could not be written until there was sound, and the pad
 * could not be arranged until there was a pad. Resolution is still absent,
 * because the canvas is a fixed size stretched to fit.
 */

const TABS = [
  {
    id: "controls",
    name: "Controls",
    hint: "Keys, and what each one does",
  },
  {
    id: "touch",
    name: "Touch",
    hint: "The on-screen pad for phones",
  },
  {
    id: "sound",
    name: "Sound & display",
    hint: "Volume, flashing, the debug readout",
  },
  {
    id: "account",
    name: "Account",
    hint: "Your name, your password, signing out",
  },
  {
    id: "legal",
    name: "Legal",
    hint: "Terms, copyright, privacy",
  },
  {
    id: "developer",
    name: "Developer",
    hint: "The switch that makes everything free",
  },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const asked = typeof params.tab === "string" ? params.tab : "";
  // Falls back rather than 404s. A settings page reached with a stale link
  // should open, not scold.
  const active: TabId = TABS.some((t) => t.id === asked)
    ? (asked as TabId)
    : "controls";
  const current = TABS.find((t) => t.id === active)!;

  return (
    <main className="relative flex flex-1 flex-col items-center px-6 py-10 sm:py-16">
      <div className="flex w-full max-w-5xl flex-col gap-6">
        <Link
          href="/home"
          className="self-start rounded-full border-2 border-b-4 border-rock-edge px-5 py-2 text-xs font-black tracking-[0.16em] text-foreground/70 uppercase transition-transform hover:-translate-y-0.5 active:translate-y-0.5 active:border-b-2"
        >
          ← Home
        </Link>

        <h1 className="font-mono text-4xl font-black tracking-tight">
          Settings
        </h1>

        {/* Side by side on a desktop, a scrolling row of chips on a phone. The
            same links either way — only the shape of the list changes. */}
        <div className="flex flex-col gap-6 sm:flex-row sm:gap-8">
          <nav
            aria-label="Settings sections"
            className="-mx-6 flex shrink-0 gap-2 overflow-x-auto px-6 pb-1 sm:mx-0 sm:w-56 sm:flex-col sm:overflow-visible sm:px-0"
          >
            {TABS.map((t) => {
              const on = t.id === active;
              return (
                <Link
                  key={t.id}
                  href={`/settings?tab=${t.id}`}
                  aria-current={on ? "page" : undefined}
                  className={
                    "shrink-0 rounded-xl border-2 px-4 py-2.5 text-left transition-colors sm:shrink " +
                    (on
                      ? "border-lens/60 bg-lens/10 text-lens"
                      : "border-rock-edge bg-rock/30 text-foreground/60 hover:border-rock-edge hover:text-foreground/90")
                  }
                >
                  <span className="block font-mono text-xs font-black tracking-[0.14em] whitespace-nowrap uppercase">
                    {t.name}
                  </span>
                  {/* The hint would wrap a phone's chip row into three lines,
                      so it belongs to the vertical layout only. */}
                  <span className="mt-0.5 hidden text-[11px] leading-snug text-foreground/35 sm:block">
                    {t.hint}
                  </span>
                </Link>
              );
            })}
          </nav>

          <div className="flex min-w-0 flex-1 flex-col gap-6">
            {/* Says which section you are in on a phone, where the chip row has
                scrolled the answer off the side of the screen. */}
            <p className="font-mono text-[11px] tracking-[0.16em] text-foreground/35 uppercase sm:hidden">
              {current.hint}
            </p>

            {active === "controls" && <ControlsBox />}
            {active === "touch" && <TouchBox />}
            {active === "sound" && <ViewBox />}

            {active === "account" && (
              <>
                {/* The profile is not duplicated here. Two places to change one
                    name is two places for them to disagree. */}
                <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-rock-edge bg-rock/40 p-5">
                  <div>
                    <h2 className="font-mono text-sm font-black tracking-[0.2em] text-brass uppercase">
                      Profile
                    </h2>
                    <p className="mt-1 text-xs text-foreground/45">
                      Your name, what you have banked, and signing out.
                    </p>
                  </div>
                  <Link
                    href="/profile"
                    className="rounded-full border-2 border-b-4 border-rock-edge px-4 py-1.5 font-mono text-[10px] font-black tracking-[0.16em] text-foreground/70 uppercase transition-transform hover:-translate-y-0.5 active:translate-y-0.5 active:border-b-2"
                  >
                    Open profile
                  </Link>
                </section>
                <SecurityBox />
              </>
            )}

            {active === "legal" && <LegalBox />}

            {active === "developer" && (
              <>
                <AdminBox />
                <p className="text-xs leading-relaxed text-foreground/40">
                  There is no resolution setting: the game is drawn at a fixed
                  size and stretched to your window, so there is nothing here to
                  change. It will appear when it is real, like the rest of this
                  page did.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}