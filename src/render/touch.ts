/**
 * Touch → intents. The sibling module `keyboard.ts` always said would exist.
 *
 * ARCH AD-6: the shell turns device events into the core's abstract vocabulary
 * and the core never learns what a key — or a thumb — is. So this produces
 * exactly the same `Intents` bitfield the keyboard does, and the two are OR'd
 * together by the run loop. A device with both keeps both, and nothing about
 * this file can change how the simulation behaves.
 *
 * That independence is the whole safety argument. Touch is additive: if every
 * line of this went wrong, a keyboard player would not be able to tell.
 *
 * WHY DOM BUTTONS RATHER THAN DRAWING THEM ON THE CANVAS. The canvas is a fixed
 * 1280x720 stretched to fit, so anything drawn into it scales with the game and
 * would be the wrong size on every phone. These are real elements over the top:
 * they size in CSS pixels, they respect safe areas, and a browser's own
 * touch handling — the part that stops a long press selecting text or firing a
 * context menu — works on them for free.
 */

import { Intent, type IntentFlag, type Intents } from "../sim/index.ts";

/** One control: where it sits, what it says, and what it means. */
type Control = {
  intent: IntentFlag;
  label: string;
  hint: string;
  side: "left" | "right";
  /** Grid slot within its cluster, from the bottom corner outward. */
  col: number;
  row: number;
  big?: boolean;
};

/**
 * The layout.
 *
 * Movement under the left thumb, everything you DO under the right, which is
 * the arrangement every player already has in their hands from every other
 * game. Jump is the big one because it is pressed more than everything else
 * combined, and it sits where the thumb rests.
 *
 * Crouch is on the left with the directions rather than on the right with the
 * verbs, because underwater it IS a direction — it is how you dive — and that
 * is where a thumb looks for it.
 */
const CONTROLS: Control[] = [
  { intent: Intent.Left, label: "◀", hint: "left", side: "left", col: 0, row: 0 },
  { intent: Intent.Right, label: "▶", hint: "right", side: "left", col: 1, row: 0 },
  { intent: Intent.Crouch, label: "▼", hint: "crouch and dive", side: "left", col: 0.5, row: 1 },

  { intent: Intent.Jump, label: "▲", hint: "jump", side: "right", col: 0, row: 0, big: true },
  { intent: Intent.Attack, label: "⚔", hint: "attack", side: "right", col: 1, row: 0 },
  { intent: Intent.Block, label: "◆", hint: "block and parry", side: "right", col: 2, row: 0 },
  { intent: Intent.Slide, label: "»", hint: "slide", side: "right", col: 1, row: 1 },
  { intent: Intent.Stun, label: "✷", hint: "stun", side: "right", col: 2, row: 1 },
  { intent: Intent.Interact, label: "E", hint: "levers and chests", side: "right", col: 0, row: 1 },
];

/** Whether this device is worth showing any of it to. */
export function hasTouch(): boolean {
  if (typeof window === "undefined") return false;
  return (
    "ontouchstart" in window ||
    (navigator.maxTouchPoints ?? 0) > 0
  );
}

export class TouchInput {
  private held = new Set<IntentFlag>();
  private root: HTMLDivElement;
  /**
   * Which pointer is on which control.
   *
   * By pointer id rather than by button, because two thumbs are two pointers
   * and a phone will happily report both. Tracking it this way is also what
   * makes sliding a thumb off a button release it — the browser keeps sending
   * that pointer's events to the element it started on, so the pointer has to
   * be followed rather than the element.
   */
  private on = new Map<number, IntentFlag>();

  constructor(parent: HTMLElement) {
    this.root = document.createElement("div");
    this.root.setAttribute("aria-hidden", "true");
    Object.assign(this.root.style, {
      position: "absolute",
      inset: "0",
      // The pad itself must not eat taps meant for the game area; only the
      // buttons inside it are interactive.
      pointerEvents: "none",
      touchAction: "none",
      userSelect: "none",
      WebkitUserSelect: "none",
      WebkitTapHighlightColor: "transparent",
      zIndex: "5",
    } as Partial<CSSStyleDeclaration>);

    for (const c of CONTROLS) this.root.appendChild(this.button(c));
    parent.appendChild(this.root);

    // Released globally rather than per-button: a thumb that leaves the screen
    // entirely never sends `pointerup` to the element it started on, and a
    // control stuck down is a player walking into a wall forever.
    window.addEventListener("pointerup", this.release);
    window.addEventListener("pointercancel", this.release);
    window.addEventListener("blur", this.clear);
  }

  private button(c: Control): HTMLButtonElement {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = c.label;
    b.setAttribute("aria-label", c.hint);

    const size = c.big ? 88 : 68;
    const gap = 12;
    const edge = 18;
    const x = edge + c.col * (size + gap);
    const y = edge + c.row * (size + gap);

    Object.assign(b.style, {
      position: "absolute",
      [c.side]: `${x}px`,
      bottom: `${y}px`,
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: "50%",
      border: "2px solid rgba(95,217,207,0.35)",
      background: "rgba(16,21,29,0.55)",
      color: "#5fd9cf",
      font: `${c.big ? 30 : 24}px ui-monospace, Menlo, Consolas, monospace`,
      lineHeight: "1",
      padding: "0",
      pointerEvents: "auto",
      touchAction: "none",
      WebkitTapHighlightColor: "transparent",
      transition: "background 90ms, border-color 90ms",
    } as Partial<CSSStyleDeclaration>);

    b.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      this.held.add(c.intent);
      this.on.set(e.pointerId, c.intent);
      b.style.background = "rgba(95,217,207,0.28)";
      b.style.borderColor = "rgba(95,217,207,0.9)";
    });
    // The visual half of release. The intent half is handled globally above,
    // so a thumb lifted off-screen still lets go.
    const up = () => {
      b.style.background = "rgba(16,21,29,0.55)";
      b.style.borderColor = "rgba(95,217,207,0.35)";
    };
    b.addEventListener("pointerup", up);
    b.addEventListener("pointercancel", up);
    b.addEventListener("pointerleave", up);
    // A long press must not offer to copy the arrow.
    b.addEventListener("contextmenu", (e) => e.preventDefault());
    return b;
  }

  private release = (e: PointerEvent) => {
    const intent = this.on.get(e.pointerId);
    if (intent === undefined) return;
    this.held.delete(intent);
    this.on.delete(e.pointerId);
  };

  private clear = () => {
    this.held.clear();
    this.on.clear();
  };

  /** Everything held this tick, in the core's vocabulary. */
  read(): Intents {
    let out = 0;
    for (const i of this.held) out |= i;
    return out as Intents;
  }

  destroy(): void {
    window.removeEventListener("pointerup", this.release);
    window.removeEventListener("pointercancel", this.release);
    window.removeEventListener("blur", this.clear);
    this.root.remove();
  }
}