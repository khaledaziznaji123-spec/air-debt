"use client";

import { useEffect, useState } from "react";
import { DEFAULT_PREFS, readPrefs, writePrefs, type Prefs } from "../prefs.ts";

/**
 * How the game is shown.
 *
 * Volume, mute, and two display switches — all of them real, which is the bar
 * this page is held to. There is still no resolution, because the canvas is a
 * fixed internal size stretched to the window; a settings page full of
 * greyed-out promises is worse than a short one.
 *
 * The sound section could be written the day sound existed, and sound is
 * synthesised at the moment it plays rather than loaded from files — see
 * `src/render/audio.ts`.
 *
 * Neither of these can affect a run. The simulation is a pure reducer over
 * intents and knows nothing about what is drawn, so a view preference is safe to
 * keep on the machine — and anything that COULD change a run would have to be
 * server-owned instead. Nothing here should ever become that.
 */

type Switch = { key: "reduceFlashes" | "debugOverlay"; name: string; note: string };

const SWITCHES: Switch[] = [
  {
    key: "reduceFlashes",
    name: "Reduce flashing",
    note: "The screen flashes a colour when a potion is drunk and when a legendary is found. This damps it to a fifth rather than removing it, so the moment still reads.",
  },
  {
    key: "debugOverlay",
    name: "Debug overlay",
    note: "Tick counts, velocities and the sprite manifest check, drawn over the top left. Development readout — it found the art size mismatch and more than one collision bug.",
  },
];

export default function ViewBox() {
  const [prefs, setPrefs] = useState<Prefs | null>(null);

  useEffect(() => {
    let live = true;
    queueMicrotask(() => {
      if (live) setPrefs(readPrefs());
    });
    return () => {
      live = false;
    };
  }, []);

  const shown = prefs ?? DEFAULT_PREFS;

  return (
    <section className="flex flex-col gap-4 rounded-2xl border-2 border-rock-edge bg-rock/40 p-5">
      <h2 className="font-mono text-sm font-black tracking-[0.2em] text-brass uppercase">
        Sound
      </h2>

      {/* A real control. Every noise in the game is synthesised at the moment it
          plays — there is not one audio file in the project — which is why this
          could go from "belongs to a system that does not exist" to a slider in
          one sitting. */}
      <div className="flex flex-col gap-3">
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            className="size-4 shrink-0 accent-[#ffd166]"
            checked={shown.muted}
            disabled={prefs === null}
            onChange={(e) => {
              const next = { ...shown, muted: e.target.checked };
              setPrefs(next);
              writePrefs(next);
            }}
          />
          <span className="text-sm font-semibold text-foreground/90">Mute</span>
        </label>

        <label className="flex items-center gap-3">
          <span className="w-16 shrink-0 text-sm text-foreground/70">Volume</span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={Math.round(shown.volume * 100)}
            disabled={prefs === null || shown.muted}
            aria-label="Volume"
            className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-rock-edge accent-[#ffd166] disabled:opacity-40"
            onChange={(e) => {
              const next = { ...shown, volume: Number(e.target.value) / 100 };
              setPrefs(next);
              writePrefs(next);
            }}
          />
          <span className="w-10 shrink-0 text-right font-mono text-xs text-foreground/50">
            {Math.round(shown.volume * 100)}
          </span>
        </label>
      </div>

      <h2 className="mt-2 font-mono text-sm font-black tracking-[0.2em] text-brass uppercase">
        Display
      </h2>

      <ul className="flex flex-col divide-y divide-rock-edge/60">
        {SWITCHES.map((s) => (
          <li key={s.key} className="flex items-start gap-4 py-3">
            <label className="flex flex-1 cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                className="mt-0.5 size-4 shrink-0 accent-[#ffd166]"
                checked={shown[s.key]}
                disabled={prefs === null}
                onChange={(e) => {
                  const next = { ...shown, [s.key]: e.target.checked };
                  setPrefs(next);
                  writePrefs(next);
                }}
              />
              <span>
                <span className="block text-sm font-semibold text-foreground/90">
                  {s.name}
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-foreground/40">
                  {s.note}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>

      <p className="text-xs leading-relaxed text-foreground/40">
        Volume and mute take effect at once. The display switches are applied
        when a run starts, so change those before you go down. All of it is saved
        on this computer, and none of it can change what happens in a run — only
        what you see and hear of it.
      </p>
    </section>
  );
}