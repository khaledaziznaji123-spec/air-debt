import Link from "next/link";
import AdminBox from "./admin-box";
import ControlsBox from "./controls-box";
import ViewBox from "./view-box";

export const metadata = { title: "Air Debt — settings" };

/**
 * Settings.
 *
 * Keys, and the developer switch.
 *
 * The keymap is the real one: PRD FR-9.2 asks for bindings to be fully
 * rebindable, and the keyboard module has always taken them as an argument — the
 * only missing piece was somewhere to change one. It doubles as the controls
 * reference that used to sit under the game canvas.
 *
 * Still not here, and still not listed as "coming soon": volume, because there
 * is no audio in the game at all, and resolution, because the canvas is a fixed
 * internal size stretched to fit. Both would be greyed-out lies on a screen that
 * has had enough of those.
 */
export default function SettingsPage() {
  return (
    <main className="relative flex flex-1 flex-col items-center px-6 py-16">
      <div className="flex w-full max-w-xl flex-col gap-6">
        <Link
          href="/home"
          className="self-start rounded-full border-2 border-b-4 border-rock-edge px-5 py-2 text-xs font-black tracking-[0.16em] text-foreground/70 uppercase transition-transform hover:-translate-y-0.5 active:translate-y-0.5 active:border-b-2"
        >
          ← Home
        </Link>

        <h1 className="font-mono text-4xl font-black tracking-tight">
          Settings
        </h1>

        <ControlsBox />

        <ViewBox />

        {/* The account lives on its own page rather than being duplicated here.
            Two places to change one name is two places for them to disagree. */}
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-rock-edge bg-rock/40 p-5">
          <div>
            <h2 className="font-mono text-sm font-black tracking-[0.2em] text-brass uppercase">
              Account
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

        <AdminBox />

        <p className="text-xs leading-relaxed text-foreground/40">
          There is no sound in the game yet, so there is no volume here. The
          canvas is a fixed size stretched to your window, so there is no
          resolution either. Both will appear when they are real.
        </p>
      </div>
    </main>
  );
}
