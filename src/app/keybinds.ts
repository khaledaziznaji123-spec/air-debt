"use client";

import {
  DEFAULT_BINDINGS,
  type Bindings,
} from "../render/keyboard.ts";
import { Intent, type IntentFlag } from "../sim/index.ts";

/**
 * What the player has bound their keys to.
 *
 * PRD FR-9.2 asks for bindings to be fully rebindable, and the keyboard module
 * has always taken them as an argument — the only missing piece was somewhere to
 * put a changed one. This is that: a small store in `localStorage`, read once
 * when a run starts.
 *
 * IT IS NOT ACCOUNT STATE and deliberately so. A keymap is a property of the
 * desk you are sitting at rather than of the person playing, so it should follow
 * the machine and not the login — the same reason it does not go anywhere near
 * the server. It also means nothing here can affect a score: the sim is handed
 * intents, never keys (ARCH AD-6), so a replay of a run reproduces it whatever
 * the player had bound.
 */

const KEY = "airdebt.keybinds.v1";

/** Every action a player can bind, in the order they are shown. */
export const ACTIONS: {
  intent: IntentFlag;
  name: string;
  note?: string;
}[] = [
  { intent: Intent.Left, name: "Left" },
  { intent: Intent.Right, name: "Right" },
  { intent: Intent.Jump, name: "Jump", note: "and swim up" },
  { intent: Intent.Crouch, name: "Crouch", note: "dive, and smash from the air" },
  { intent: Intent.Slide, name: "Slide", note: "step back when standing still" },
  { intent: Intent.Attack, name: "Attack" },
  { intent: Intent.Block, name: "Block / parry", note: "reflects arrows" },
  { intent: Intent.Stun, name: "Stun", note: "the only guard-breaker" },
  { intent: Intent.Interact, name: "Interact", note: "levers, chests, doors" },
  { intent: Intent.Restoration, name: "Restoration potion" },
  { intent: Intent.Breath, name: "Breath potion" },
  { intent: Intent.Haste, name: "Quickstep potion" },
  { intent: Intent.Venom, name: "Etched potion" },
  { intent: Intent.Milk, name: "Milk potion" },
  { intent: Intent.Shield, name: "Ward potion" },
];

/** The keys currently bound to one action, in a stable order. */
export function keysFor(bindings: Bindings, intent: IntentFlag): string[] {
  return Object.keys(bindings)
    .filter((code) => bindings[code] === intent)
    .sort();
}

export function readBindings(): Bindings {
  if (typeof window === "undefined") return DEFAULT_BINDINGS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_BINDINGS;
    const stored = JSON.parse(raw) as Record<string, number>;
    // Rebuilt rather than trusted. A stored map is a file a user can edit, and
    // an intent that is not a real flag would be a key that silently does
    // nothing — which is indistinguishable from a broken keyboard.
    const out: Bindings = {};
    const valid = new Set<number>(ACTIONS.map((a) => a.intent));
    for (const [code, intent] of Object.entries(stored)) {
      if (typeof code === "string" && valid.has(intent)) {
        out[code] = intent as IntentFlag;
      }
    }
    // An empty or unusable file falls back rather than leaving somebody unable
    // to move.
    return Object.keys(out).length > 0 ? out : DEFAULT_BINDINGS;
  } catch {
    return DEFAULT_BINDINGS;
  }
}

export function writeBindings(bindings: Bindings): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(bindings));
  window.dispatchEvent(new Event("airdebt-keybinds"));
}

export function resetBindings(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
  window.dispatchEvent(new Event("airdebt-keybinds"));
}

/**
 * Bind a key to an action, taking it off whatever had it.
 *
 * One key can only ever mean one thing. Letting it mean two would send both
 * intents on the same press, which for `Left` and `Right` is a player who cannot
 * move — so the theft is the correct behaviour rather than a convenience.
 */
export function bind(
  bindings: Bindings,
  code: string,
  intent: IntentFlag,
  replacing?: string,
): Bindings {
  const next: Bindings = { ...bindings };
  if (replacing) delete next[replacing];
  delete next[code];
  next[code] = intent;
  return next;
}

export function unbind(bindings: Bindings, code: string): Bindings {
  const next = { ...bindings };
  delete next[code];
  return next;
}

/**
 * A key code as something a person recognises.
 *
 * `event.code` is a physical position rather than a letter — which is what makes
 * bindings work on any layout — but "KeyA" and "BracketLeft" are not things to
 * show anybody.
 */
export function keyLabel(code: string): string {
  const named: Record<string, string> = {
    Space: "Space",
    ArrowLeft: "←",
    ArrowRight: "→",
    ArrowUp: "↑",
    ArrowDown: "↓",
    ShiftLeft: "L Shift",
    ShiftRight: "R Shift",
    ControlLeft: "L Ctrl",
    ControlRight: "R Ctrl",
    AltLeft: "L Alt",
    AltRight: "R Alt",
    Tab: "Tab",
    Enter: "Enter",
    Backspace: "Backspace",
    CapsLock: "Caps",
    Escape: "Esc",
    Comma: ",",
    Period: ".",
    Slash: "/",
    Semicolon: ";",
    Quote: "'",
    BracketLeft: "[",
    BracketRight: "]",
    Backslash: "\\",
    Minus: "-",
    Equal: "=",
    Backquote: "`",
  };
  if (named[code]) return named[code];
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Numpad")) return "Num " + code.slice(6);
  return code;
}