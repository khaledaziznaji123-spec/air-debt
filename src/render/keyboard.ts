/**
 * Keyboard → intents. ARCH AD-6: the shell translates device events into the
 * core's abstract vocabulary; the core never learns what a key is.
 *
 * Bindings live here as a plain map because PRD FR-9.2 requires them to be
 * fully rebindable. Touch controls will be a sibling module producing the same
 * intent bitfield — which is what makes FR-9.5's universal timing possible.
 */

import { Intent, type IntentFlag, type Intents } from "../sim/index.ts";

export type Bindings = Record<string, IntentFlag>;

export const DEFAULT_BINDINGS: Bindings = {
  ArrowLeft: Intent.Left,
  KeyA: Intent.Left,
  ArrowRight: Intent.Right,
  KeyD: Intent.Right,
  ArrowUp: Intent.Jump,
  KeyW: Intent.Jump,
  Space: Intent.Jump,
  ArrowDown: Intent.Crouch,
  KeyS: Intent.Crouch,
  ShiftLeft: Intent.Slide,
  ShiftRight: Intent.Slide,
  KeyQ: Intent.Attack,
  KeyJ: Intent.Attack,
  KeyR: Intent.Block,
  KeyK: Intent.Block,
  KeyL: Intent.Stun,
  KeyI: Intent.Bow,
};

/**
 * Tracks which intents are currently held.
 *
 * Reads held state rather than edge events so the sim sees a consistent
 * snapshot per tick — a key pressed and released between two ticks would
 * otherwise vanish, and the replay would not match the play.
 */
export class KeyboardInput {
  private held = new Set<IntentFlag>();
  private bindings: Bindings;
  private onKeyDown: (e: KeyboardEvent) => void;
  private onKeyUp: (e: KeyboardEvent) => void;
  private onBlur: () => void;

  constructor(bindings: Bindings = DEFAULT_BINDINGS) {
    this.bindings = bindings;

    this.onKeyDown = (e) => {
      const intent = this.bindings[e.code];
      if (intent === undefined) return;
      e.preventDefault();
      this.held.add(intent);
    };

    this.onKeyUp = (e) => {
      const intent = this.bindings[e.code];
      if (intent === undefined) return;
      e.preventDefault();
      this.held.delete(intent);
    };

    // Losing focus mid-key would otherwise leave the player running forever.
    this.onBlur = () => this.held.clear();
  }

  attach(target: Window = window): void {
    target.addEventListener("keydown", this.onKeyDown);
    target.addEventListener("keyup", this.onKeyUp);
    target.addEventListener("blur", this.onBlur);
  }

  detach(target: Window = window): void {
    target.removeEventListener("keydown", this.onKeyDown);
    target.removeEventListener("keyup", this.onKeyUp);
    target.removeEventListener("blur", this.onBlur);
    this.held.clear();
  }

  /** The current frame's intents, as the bitfield the core expects. */
  read(): Intents {
    let intents: Intents = Intent.None;
    for (const flag of this.held) intents |= flag;
    return intents;
  }
}
