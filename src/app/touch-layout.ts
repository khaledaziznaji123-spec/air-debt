"use client";

import {
  CONTROLS,
  DEFAULT_LAYOUT,
  DEFAULT_SLOTS,
  LIMITS,
  clamp,
  type Slot,
  type TouchLayout,
} from "../render/touch.ts";

/**
 * Where the player has put their on-screen controls.
 *
 * A KEYMAP, for thumbs — and it sits beside `keybinds.ts` for exactly the reason
 * that one gives: a layout is a property of the device you are holding rather
 * than of the person holding it, so it follows the machine and never the login.
 * A phone and a tablet want different pads, and the same account plays on both.
 *
 * Like the keymap, it cannot affect a run, and that is not luck. The pad emits
 * `Intents` and the simulation is handed those, never the thing that produced
 * them (ARCH AD-6). Drag every button into one corner and make them all enormous
 * and the replay of that run still verifies tick for tick, because the log
 * records what was meant rather than what was touched.
 *
 * The defaults, the placement maths and the look all live in `render/touch.ts`
 * with the pad itself. This file only remembers.
 */

const KEY = "airdebt.touch.v1";

/** A stored slot, read defensively — anything odd falls back to the default. */
function slotOf(stored: unknown, fallback: Slot): Slot {
  if (typeof stored !== "object" || stored === null) return fallback;
  const s = stored as Partial<Slot>;
  const num = (v: unknown, d: number, lo: number, hi: number) =>
    typeof v === "number" && Number.isFinite(v) ? clamp(v, lo, hi) : d;
  return {
    side: s.side === "left" || s.side === "right" ? s.side : fallback.side,
    // Bounds generous enough for any screen, because this is storage: the
    // display a layout is applied to is not the display it was saved on, and
    // `placed()` clamps to the real one at the moment it draws.
    x: num(s.x, fallback.x, 0, 4000),
    y: num(s.y, fallback.y, 0, 4000),
    size: num(s.size, fallback.size, LIMITS.size.min, LIMITS.size.max),
  };
}

export function readTouchLayout(): TouchLayout {
  if (typeof window === "undefined") return DEFAULT_LAYOUT;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_LAYOUT;
    const stored = JSON.parse(raw) as Partial<TouchLayout>;
    const saved = stored.slots as Record<string, unknown> | undefined;
    const slots: Record<string, Slot> = {};
    // Driven by CONTROLS rather than by what was found, so a stored file can
    // never invent a button that does not exist or lose one that does.
    for (const c of CONTROLS) {
      slots[c.id] = slotOf(saved?.[c.id], DEFAULT_SLOTS[c.id]);
    }
    const num = (v: unknown, d: number, lo: number, hi: number) =>
      typeof v === "number" && Number.isFinite(v) ? clamp(v, lo, hi) : d;
    return {
      scale: num(stored.scale, 1, LIMITS.scale.min, LIMITS.scale.max),
      opacity: num(
        stored.opacity,
        DEFAULT_LAYOUT.opacity,
        LIMITS.opacity.min,
        LIMITS.opacity.max,
      ),
      slots,
    };
  } catch {
    return DEFAULT_LAYOUT;
  }
}

export function writeTouchLayout(next: TouchLayout): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("airdebt-touch"));
}

/** Back to the pad as it ships. Removed rather than overwritten, so a later
 *  change to the defaults reaches anybody who never arranged their own. */
export function resetTouchLayout(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
  window.dispatchEvent(new Event("airdebt-touch"));
}