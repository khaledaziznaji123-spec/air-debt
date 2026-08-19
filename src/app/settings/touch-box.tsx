"use client";

import { useEffect, useState } from "react";
import { DEFAULT_LAYOUT, LIMITS, hasTouch, type TouchLayout } from "@/render/touch";
import {
  readTouchLayout,
  resetTouchLayout,
  writeTouchLayout,
} from "../touch-layout.ts";
import ArrangePad from "./arrange-pad";

/**
 * The on-screen pad: how big, how solid, and where.
 *
 * The touch equivalent of the keymap above it, and stored the same way and for
 * the same reason — a layout belongs to the device you are holding, not to the
 * account you are signed into. Nothing here can change a run either: the pad
 * emits intents, and the simulation is handed intents (ARCH AD-6), so a bigger
 * jump button is easier to hit and no more powerful when hit.
 *
 * Sizing lives here because a slider is a slider anywhere. PLACEMENT does not,
 * and gets a full-screen arranger instead: where a button should go is a
 * question about reach, and reach can only be answered at the real size on the
 * real screen.
 */
export default function TouchBox() {
  const [layout, setLayout] = useState<TouchLayout | null>(null);
  const [touch, setTouch] = useState(false);
  const [arranging, setArranging] = useState(false);

  // After mount, both of them: `hasTouch` reads `navigator` and the layout
  // reads storage, neither of which the server had when it drew this. Queued
  // out of the effect body itself for the same reason the keymap box queues —
  // a synchronous set there is a second render nobody asked for.
  useEffect(() => {
    let live = true;
    queueMicrotask(() => {
      if (!live) return;
      setLayout(readTouchLayout());
      setTouch(hasTouch());
    });
    return () => {
      live = false;
    };
  }, []);

  const shown = layout ?? DEFAULT_LAYOUT;
  const save = (next: TouchLayout) => {
    setLayout(next);
    writeTouchLayout(next);
  };
  const reset = () => {
    resetTouchLayout();
    setLayout(DEFAULT_LAYOUT);
  };

  return (
    <section className="flex flex-col gap-4 rounded-2xl border-2 border-rock-edge bg-rock/40 p-5">
      <div>
        <h2 className="font-mono text-sm font-black tracking-[0.2em] text-brass uppercase">
          On-screen controls
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-foreground/45">
          {touch
            ? "The buttons you play with on this device. They appear only while a run is running — never over the hub or the shop."
            : "For phones and tablets. This device has a keyboard, so the pad will not appear on it — but everything here still works, if you want to set it up for one."}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <label className="flex items-center gap-3">
          <span className="w-24 shrink-0 text-sm text-foreground/70">Size</span>
          <input
            type="range"
            min={LIMITS.scale.min}
            max={LIMITS.scale.max}
            step={0.05}
            value={shown.scale}
            disabled={layout === null}
            aria-label="Button size"
            className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-rock-edge accent-[#ffd166] disabled:opacity-40"
            onChange={(e) => save({ ...shown, scale: Number(e.target.value) })}
          />
          <span className="w-12 shrink-0 text-right font-mono text-xs text-foreground/50 tabular-nums">
            {Math.round(shown.scale * 100)}%
          </span>
        </label>

        <label className="flex items-center gap-3">
          <span className="w-24 shrink-0 text-sm text-foreground/70">
            See-through
          </span>
          <input
            type="range"
            min={LIMITS.opacity.min}
            max={LIMITS.opacity.max}
            step={0.05}
            value={shown.opacity}
            disabled={layout === null}
            aria-label="Button opacity"
            className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-rock-edge accent-[#ffd166] disabled:opacity-40"
            onChange={(e) => save({ ...shown, opacity: Number(e.target.value) })}
          />
          <span className="w-12 shrink-0 text-right font-mono text-xs text-foreground/50 tabular-nums">
            {Math.round(shown.opacity * 100)}%
          </span>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={layout === null}
          onClick={() => setArranging(true)}
          className="rounded-full border-2 border-b-4 border-[#4ecdc4]/60 bg-[#4ecdc4]/10 px-4 py-1.5 font-mono text-[10px] font-black tracking-[0.16em] text-[#4ecdc4] uppercase transition-transform hover:-translate-y-0.5 active:translate-y-0.5 active:border-b-2 disabled:opacity-40"
        >
          Arrange on screen
        </button>
        <button
          type="button"
          disabled={layout === null}
          onClick={reset}
          className="rounded-full border-2 border-b-4 border-rock-edge px-4 py-1.5 font-mono text-[10px] font-black tracking-[0.16em] text-foreground/60 uppercase transition-transform hover:-translate-y-0.5 active:translate-y-0.5 active:border-b-2 disabled:opacity-40"
        >
          Reset layout
        </button>
      </div>

      <p className="text-xs leading-relaxed text-foreground/40">
        Arranging opens the pad full screen so you can drag each button to where
        your thumb actually falls, and size them one at a time. Do it on the
        device you play on and turn it sideways first — the layout is saved on
        that device, so a phone and a tablet can each have their own.
      </p>

      {arranging && (
        <ArrangePad
          layout={shown}
          onChange={setLayout}
          onClose={() => setArranging(false)}
          onReset={reset}
        />
      )}
    </section>
  );
}