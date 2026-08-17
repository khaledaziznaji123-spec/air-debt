"use client";

import { useEffect, useState } from "react";
import { DEFAULT_PREFS, readPrefs, writePrefs, type Prefs } from "../prefs.ts";

/**
 * How the game is shown.
 *
 * Two switches, and both are real — which is the bar this page is held to. There
 * is no volume here because there is no audio in the game, and no resolution
 * because the canvas is a fixed internal size stretched to the window. A settings
 * page full of greyed-out promises is worse than a short one.
 *
 * Neither of these can affect a run. The simulation is a pure reducer over
 * intents and knows nothing about what is drawn, so a view preference is safe to
 * keep on the machine — and anything that COULD change a run would have to be
 * server-owned instead. Nothing here should ever become that.
 */

const SWITCHES: {
  key: keyof Prefs;
  name: string;
  note: string;
}[] = [
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
        Applied when a run starts, so change these before you go down rather than
        during. Saved on this computer, and neither can change what happens in a
        run — only what you see of it.
      </p>
    </section>
  );
}