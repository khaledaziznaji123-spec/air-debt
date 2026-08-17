"use client";

/**
 * How the game is shown, as opposed to how it plays.
 *
 * Everything in here is a VIEW preference and none of it can touch a run. That
 * is the line worth holding: the simulation is a pure reducer over intents
 * (ARCH AD-1, AD-6), so a setting that changed what the player could see or hear
 * is safe, and a setting that changed what the player could DO would have to be
 * server-owned or it would be a way to buy an advantage. Nothing here is the
 * second kind, and nothing here should become it.
 *
 * Stored per machine like the keymap, for the same reason: a screen is a
 * property of the desk rather than of the account.
 */

const KEY = "airdebt.prefs.v1";

export type Prefs = {
  /**
   * The renderer's development readout — tick counts, velocities, the sprite
   * manifest check. It found the art size mismatch and more than one collision
   * bug, and it used to be a checkbox under the game canvas.
   */
  debugOverlay: boolean;
  /**
   * Damp the full-screen colour flashes.
   *
   * The game flashes the whole view when a potion is drunk and when a legendary
   * is found. It is a small thing to most people and not a small thing to
   * somebody photosensitive, and there is no reason at all for that to be
   * unavoidable — the flash is decoration over an event the player already sees
   * in three other places.
   */
  reduceFlashes: boolean;
  /**
   * How loud, 0 to 1.
   *
   * There is audio now — synthesised at the moment it plays, see
   * `src/render/audio.ts` — so this is a real control rather than the
   * placeholder the settings page used to refuse to draw.
   */
  volume: number;
  muted: boolean;
};

export const DEFAULT_PREFS: Prefs = {
  debugOverlay: false,
  reduceFlashes: false,
  // Not full. A game that opens at maximum is a game somebody turns off.
  volume: 0.7,
  muted: false,
};

export function readPrefs(): Prefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_PREFS;
    const stored = JSON.parse(raw) as Partial<Prefs>;
    // Field by field rather than a spread, so a stored file with extra or
    // wrongly-typed keys cannot put anything unexpected into the object.
    const volume =
      typeof stored.volume === "number" && Number.isFinite(stored.volume)
        ? Math.max(0, Math.min(1, stored.volume))
        : DEFAULT_PREFS.volume;
    return {
      debugOverlay: stored.debugOverlay === true,
      reduceFlashes: stored.reduceFlashes === true,
      volume,
      muted: stored.muted === true,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function writePrefs(next: Prefs): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("airdebt-prefs"));
}