"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CONTROLS,
  DEFAULT_LAYOUT,
  LIMITS,
  buttonStyle,
  clamp,
  placed,
  type TouchLayout,
} from "@/render/touch";
import { writeTouchLayout } from "../touch-layout.ts";

/**
 * Arranging the on-screen pad, at the size it will really be, on the screen it
 * will really be on.
 *
 * WHY FULL SCREEN RATHER THAN A LITTLE PREVIEW IN THE SETTINGS PAGE. A thumb is
 * a fixed size and a screen is not, so the only honest way to ask "can you reach
 * this" is to put the button where it will actually sit and let a thumb try. A
 * shrunken diagram would answer a different question, and answer it wrongly on
 * every device with a different screen. On a phone held in landscape — the only
 * way this game is played on a phone — the game fills the screen, so this
 * overlay and the real pad are the same rectangle.
 *
 * Everything is dragged and sized through the same `placed()` and
 * `buttonStyle()` the pad itself uses, so a button cannot be put in one place
 * here and turn up somewhere else in the game. That was the whole risk of having
 * two things draw the same pad.
 *
 * Changes are saved as they are made, not on the way out. There is no Cancel,
 * because the thing you are editing is a live picture of the result — Reset
 * undoes it, and a Cancel that reverted ten minutes of fiddling on a slider you
 * were happy with would be the crueller button.
 */

type Grab = {
  id: string;
  pointerId: number;
  /** Where inside the button the finger went down. */
  ox: number;
  oy: number;
};

export default function ArrangePad({
  layout,
  onChange,
  onClose,
  onReset,
}: {
  layout: TouchLayout;
  onChange: (next: TouchLayout) => void;
  onClose: () => void;
  onReset: () => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [area, setArea] = useState({ width: 0, height: 0 });
  const [selected, setSelected] = useState<string>("jump");
  const grab = useRef<Grab | null>(null);

  // Measured rather than assumed: `100svh` is not `window.innerHeight` on a
  // phone with a retracting address bar, and the difference is exactly the strip
  // a bottom-row button would fall into.
  useEffect(() => {
    const measure = () => {
      const el = hostRef.current;
      if (el) setArea({ width: el.clientWidth, height: el.clientHeight });
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
    };
  }, []);

  // Escape leaves. A keyboard is not the device this is for, but the arranger is
  // reachable from a desktop settings page and a full-screen thing with no way
  // out is a trap wherever it appears.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = useCallback(
    (next: TouchLayout) => {
      onChange(next);
      writeTouchLayout(next);
    },
    [onChange],
  );

  const move = (e: React.PointerEvent) => {
    const g = grab.current;
    if (!g || g.pointerId !== e.pointerId) return;
    const slot = layout.slots[g.id];
    if (!slot) return;
    const size = Math.round(slot.size * layout.scale);
    const left = clamp(e.clientX - g.ox, 0, Math.max(0, area.width - size));
    const top = clamp(e.clientY - g.oy, 0, Math.max(0, area.height - size));
    // Re-anchored to whichever half it was dropped in, so a pad arranged on a
    // wide screen still hugs the right edge on a narrow one. Anchoring is the
    // reason positions are stored per side at all.
    const side = left + size / 2 < area.width / 2 ? "left" : "right";
    save({
      ...layout,
      slots: {
        ...layout.slots,
        [g.id]: {
          side,
          x: Math.round(side === "left" ? left : area.width - left - size),
          y: Math.round(area.height - top - size),
          size: slot.size,
        },
      },
    });
  };

  const end = (e: React.PointerEvent) => {
    if (grab.current?.pointerId === e.pointerId) grab.current = null;
  };

  const chosen = layout.slots[selected];
  const chosenControl = CONTROLS.find((c) => c.id === selected);

  return (
    <div
      ref={hostRef}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      className="fixed inset-0 z-50 touch-none overscroll-none bg-[#080b11] select-none"
      style={{ height: "100svh" }}
    >
      {/* A hint of the game underneath, so the pad is being judged against
          something rather than against a black rectangle. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 0%, #16202c 0%, #0b0f16 55%, #06080c 100%)",
        }}
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center gap-3 p-3">
        <div className="pointer-events-auto flex w-full max-w-lg flex-col gap-3 rounded-2xl border-2 border-rock-edge bg-[#0b0e14]/95 p-3">
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-[10px] font-black tracking-[0.18em] text-brass uppercase">
              Drag to move · Tap to size one
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onReset}
                className="rounded-full border-2 border-b-4 border-rock-edge px-3 py-1 font-mono text-[10px] font-black tracking-[0.14em] text-foreground/60 uppercase active:translate-y-0.5 active:border-b-2"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border-2 border-b-4 border-[#4ecdc4]/60 bg-[#4ecdc4]/10 px-4 py-1 font-mono text-[10px] font-black tracking-[0.14em] text-[#4ecdc4] uppercase active:translate-y-0.5 active:border-b-2"
              >
                Done
              </button>
            </div>
          </div>

          <Slider
            name="All buttons"
            value={layout.scale}
            min={LIMITS.scale.min}
            max={LIMITS.scale.max}
            step={0.05}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={(scale) => save({ ...layout, scale })}
          />

          <Slider
            name={`Only ${chosenControl?.name ?? "this"}`}
            glyph={chosenControl?.label}
            value={chosen?.size ?? DEFAULT_LAYOUT.slots.jump.size}
            min={LIMITS.size.min}
            max={LIMITS.size.max}
            step={2}
            format={(v) => `${Math.round(v)}px`}
            onChange={(size) =>
              chosen &&
              save({
                ...layout,
                slots: { ...layout.slots, [selected]: { ...chosen, size } },
              })
            }
          />

          <Slider
            name="See-through"
            value={layout.opacity}
            min={LIMITS.opacity.min}
            max={LIMITS.opacity.max}
            step={0.05}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={(opacity) => save({ ...layout, opacity })}
          />
        </div>
      </div>

      {area.width > 0 &&
        CONTROLS.map((c) => {
          const slot = layout.slots[c.id] ?? DEFAULT_LAYOUT.slots[c.id];
          const place = placed(slot, layout, area);
          const isSelected = selected === c.id;
          return (
            <button
              key={c.id}
              type="button"
              aria-label={`${c.hint} — drag to move`}
              onPointerDown={(e) => {
                e.preventDefault();
                setSelected(c.id);
                (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
                grab.current = {
                  id: c.id,
                  pointerId: e.pointerId,
                  ox: e.clientX - place.left,
                  oy: e.clientY - (area.height - place.bottom - place.size),
                };
              }}
              onContextMenu={(e) => e.preventDefault()}
              style={{
                ...(buttonStyle(place, layout, isSelected) as React.CSSProperties),
                // The one difference from the real pad: the button being sized
                // has to be findable while the slider under your other thumb
                // moves it.
                boxShadow: isSelected ? "0 0 0 3px rgba(255,209,102,0.75)" : "none",
                touchAction: "none",
              }}
            >
              {c.label}
            </button>
          );
        })}

      <p className="pointer-events-none absolute inset-x-0 bottom-1 text-center font-mono text-[10px] tracking-[0.14em] text-foreground/25 uppercase">
        Saved as you go
      </p>
    </div>
  );
}

function Slider({
  name,
  glyph,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  name: string;
  /** The face of the button this slider is holding, if it is holding one. */
  glyph?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center gap-3">
      <span className="flex w-24 shrink-0 items-center gap-1.5 text-xs text-foreground/70">
        {glyph && (
          <span className="font-mono text-sm text-[#5fd9cf]" aria-hidden>
            {glyph}
          </span>
        )}
        <span className="truncate">{name}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={name}
        className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-rock-edge accent-[#ffd166]"
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="w-12 shrink-0 text-right font-mono text-[10px] text-foreground/45 tabular-nums">
        {format(value)}
      </span>
    </label>
  );
}