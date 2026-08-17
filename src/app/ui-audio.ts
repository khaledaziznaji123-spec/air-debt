"use client";

import { readPrefs } from "./prefs.ts";

/**
 * The interface, heard.
 *
 * Separate from `src/render/audio.ts` on purpose. That one lives inside the game
 * loop, is handed a whole simulation state sixty times a second, and is torn
 * down with the run. This is a singleton for the shell — the menu, the shop, the
 * settings, the profile, the boards — which has no loop and no state and outlives
 * every run.
 *
 * Synthesised, like everything else here. Four noises rather than forty, because
 * an interface wants to be consistent rather than expressive: a click is a click
 * wherever you are, and the only distinctions worth making are "that worked" and
 * "that did not".
 *
 * Blocked until a gesture like all browser audio — but a UI is nothing BUT
 * gestures, so the first click both unlocks it and is the first thing heard.
 */

class UiAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private lastAt = 0;

  private wake(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  /**
   * Read fresh every time rather than cached.
   *
   * The settings page changes the volume while you are looking at it, and the
   * sound it makes doing so should be the volume you just chose — otherwise the
   * slider appears not to work on the one screen where you are listening for it.
   */
  private level(): number {
    const p = readPrefs();
    // Under the game's own level. A menu click should never be the loudest
    // thing anybody hears.
    return p.muted ? 0 : p.volume * 0.5;
  }

  private blip(
    from: number,
    to: number,
    decay: number,
    gain: number,
    type: OscillatorType = "triangle",
    delay = 0,
  ): void {
    const ctx = this.wake();
    if (!ctx || !this.master) return;
    const level = this.level();
    if (level <= 0) return;

    const t0 = ctx.currentTime + delay;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain * level, t0 + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);
    g.connect(this.master);

    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(from, t0);
    if (to !== from) {
      o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + decay);
    }
    o.connect(g);
    o.start(t0);
    o.stop(t0 + decay + 0.02);
  }

  /** Not twice in a frame. A click that also counts as a hover is a rattle. */
  private throttled(ms: number): boolean {
    const now = Date.now();
    if (now - this.lastAt < ms) return false;
    this.lastAt = now;
    return true;
  }

  /** Anything pressed. */
  click(): void {
    if (!this.throttled(40)) return;
    this.blip(680, 420, 0.07, 0.5, "triangle");
  }

  /** Anything pointed at. Quieter and higher, so it sits under the click. */
  hover(): void {
    if (!this.throttled(45)) return;
    this.blip(1100, 1250, 0.035, 0.16, "sine");
  }

  /** A purchase, a lever, anything that changed something for the better. */
  ok(): void {
    this.blip(660, 880, 0.1, 0.42, "triangle");
    this.blip(990, 1320, 0.22, 0.3, "triangle", 0.07);
  }

  /** Refused. Not harsh — the player did not do anything wrong. */
  no(): void {
    this.blip(260, 190, 0.16, 0.4, "square");
  }

  /** Something opened over the top: the shop, a dialog. */
  open(): void {
    this.blip(420, 700, 0.14, 0.34, "triangle");
  }

  /** And closed. */
  close(): void {
    this.blip(700, 380, 0.12, 0.3, "triangle");
  }
}

export const ui = new UiAudio();