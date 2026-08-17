import Link from "next/link";
import AdminBox from "./admin-box";

export const metadata = { title: "Air Debt — settings" };

/**
 * Settings.
 *
 * There is one setting, and it is the developer switch. Everything a settings
 * page would normally hold — volume, keybinds, resolution — belongs to systems
 * that do not exist yet, and listing them greyed out would be four more lies on
 * a screen that already has enough.
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

        <AdminBox />

        <p className="text-xs text-foreground/40">
          Sound, keybinds and display will live here. None of those systems
          exist yet, so none of them are listed.
        </p>
      </div>
    </main>
  );
}
