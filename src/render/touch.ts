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
 *
 * The layout is an argument, exactly as the keymap is: defaults live here, the
 * player's arrangement is stored by `src/app/touch-layout.ts` and handed in.
 */

import { Intent, type IntentFlag, type Intents } from "../sim/index.ts";

/** One control: what it means, and what it says on it. */
export type Control = {
  /** Stable across everything — intent numbers are an implementation detail. */
  id: string;
  intent: IntentFlag;
  label: string;
  hint: string;
};

/** Where one control has been put. */
export type Slot = {
  /** Which corner its position is measured from. */
  side: "left" | "right";
  /** Pixels from that side, and from the bottom, to the button's near corner. */
  x: number;
  y: number;
  /** Its own diameter in pixels, before the global size multiplier. */
  size: number;
};

export type TouchLayout = {
  /** Multiplies every button at once. */
  scale: number;
  /** How solid the pad looks over the game. */
  opacity: number;
  slots: Record<string, Slot>;
};

const BASE = 68;
const BIG = 88;
const GAP = 12;
const EDGE = 18;

/** Pixels from the anchored corner, so a slot reads as the measurement it is. */
function at(side: "left" | "right", x: number, y: number, size = BASE): Slot {
  return { side, x: Math.round(x), y: Math.round(y), size };
}

/** The bottom row of each cluster, and the row above it. */
const ROW0 = EDGE;
const COL0 = EDGE;
/** Clears the jump button rather than a normal one — it is the tallest thing
 *  in the right cluster, and a row spaced for the others sat on top of it. */
const ROW1 = EDGE + BIG + GAP;

/**
 * The pad as it comes out of the box.
 *
 * Movement under the left thumb, everything you DO under the right, which is the
 * arrangement every player already has in their hands from every other game.
 * Jump is the big one because it is pressed more than the rest combined, and it
 * sits where the thumb rests.
 *
 * Crouch is on the left with the directions rather than on the right with the
 * verbs, because underwater it IS a direction — it is how you dive — and that is
 * where a thumb goes looking for it.
 *
 * All of which is an opinion, and the arranger exists because it is only mine.
 */
export const CONTROLS: Control[] = [
  { id: "left", intent: Intent.Left, label: "◀", hint: "left" },
  { id: "right", intent: Intent.Right, label: "▶", hint: "right" },
  { id: "crouch", intent: Intent.Crouch, label: "▼", hint: "crouch and dive" },
  { id: "jump", intent: Intent.Jump, label: "▲", hint: "jump" },
  { id: "attack", intent: Intent.Attack, label: "⚔", hint: "attack" },
  { id: "block", intent: Intent.Block, label: "◆", hint: "block and parry" },
  { id: "slide", intent: Intent.Slide, label: "»", hint: "slide" },
  { id: "stun", intent: Intent.Stun, label: "✷", hint: "stun" },
  { id: "interact", intent: Intent.Interact, label: "E", hint: "levers and chests" },
];

export const DEFAULT_SLOTS: Record<string, Slot> = {
  left: at("left", COL0, ROW0),
  right: at("left", COL0 + BASE + GAP, ROW0),
  // Between and above the two directions, where a thumb rocking back from
  // either of them lands.
  crouch: at("left", COL0 + (BASE + GAP) / 2, ROW1),

  // The right cluster is spaced off jump's width, not off a normal button's.
  // Doing it the other way put attack eight pixels inside jump, which is a
  // button you cannot press without pressing the other one.
  jump: at("right", COL0, ROW0, BIG),
  attack: at("right", COL0 + BIG + GAP, ROW0),
  block: at("right", COL0 + BIG + GAP + BASE + GAP, ROW0),
  interact: at("right", COL0, ROW1),
  slide: at("right", COL0 + BIG + GAP, ROW1),
  stun: at("right", COL0 + BIG + GAP + BASE + GAP, ROW1),
};

export const DEFAULT_LAYOUT: TouchLayout = {
  scale: 1,
  opacity: 0.85,
  slots: DEFAULT_SLOTS,
};

/** The bounds a size or a scale is allowed to take, shared with the arranger. */
export const LIMITS = {
  scale: { min: 0.6, max: 1.6 },
  opacity: { min: 0.25, max: 1 },
  size: { min: 44, max: 132 },
} as const;

export const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));

/**
 * Where a button actually goes on a screen of this size.
 *
 * The pad and the arranger both place buttons through here, so a button cannot
 * be dragged to one place and then turn up in another — which was the whole risk
 * of having two things draw the same pad.
 *
 * Clamped HERE rather than when a layout is saved. A layout arranged on a tablet
 * and then opened on a phone has to survive the trip, and clamping on save would
 * quietly flatten somebody's pad the first time they rotated the device.
 */
export function placed(
  slot: Slot,
  layout: TouchLayout,
  area: { width: number; height: number },
): { left: number; bottom: number; size: number } {
  const size = Math.round(slot.size * layout.scale);
  // Resolved to a distance from the left whichever side it was stored against:
  // absolute positioning wants one origin, and the arranger wants to drag in it.
  const left = slot.side === "left" ? slot.x : area.width - slot.x - size;
  return {
    left: clamp(left, 0, Math.max(0, area.width - size)),
    bottom: clamp(slot.y, 0, Math.max(0, area.height - size)),
    size,
  };
}

/** How a button looks. One definition, used by the pad and by the arranger. */
export function buttonStyle(
  place: { left: number; bottom: number; size: number },
  layout: TouchLayout,
  held: boolean,
): Record<string, string> {
  return {
    position: "absolute",
    left: `${place.left}px`,
    bottom: `${place.bottom}px`,
    width: `${place.size}px`,
    height: `${place.size}px`,
    borderRadius: "50%",
    border: `2px solid rgba(95,217,207,${held ? 0.9 : 0.35})`,
    background: held ? "rgba(95,217,207,0.28)" : "rgba(16,21,29,0.55)",
    color: "#5fd9cf",
    font: `${Math.round(place.size * 0.34)}px ui-monospace, Menlo, Consolas, monospace`,
    lineHeight: "1",
    padding: "0",
    opacity: `${layout.opacity}`,
    pointerEvents: "auto",
    touchAction: "none",
    WebkitTapHighlightColor: "transparent",
    transition: "background 90ms, border-color 90ms",
  };
}

/** Whether this device is worth showing any of it to. */
export function hasTouch(): boolean {
  if (typeof window === "undefined") return false;
  return "ontouchstart" in window || (navigator.maxTouchPoints ?? 0) > 0;
}

export class TouchInput {
  private held = new Set<IntentFlag>();
  private root: HTMLDivElement;
  private parent: HTMLElement;
  private layout: TouchLayout;
  private buttons = new Map<string, HTMLButtonElement>();
  private visible = false;
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

  constructor(parent: HTMLElement, layout: TouchLayout = DEFAULT_LAYOUT) {
    this.parent = parent;
    this.layout = layout;
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
      // Hidden until a run is actually being played. The pad has no business
      // over the shop, and a thumb aimed at a price should not find a sword.
      display: "none",
    } as unknown as Partial<CSSStyleDeclaration>);

    for (const c of CONTROLS) {
      const b = this.button(c);
      this.buttons.set(c.id, b);
      this.root.appendChild(b);
    }
    parent.appendChild(this.root);
    this.place();

    // Released globally rather than per-button: a thumb that leaves the screen
    // entirely never sends `pointerup` to the element it started on, and a
    // control stuck down is a player walking into a wall forever.
    window.addEventListener("pointerup", this.release);
    window.addEventListener("pointercancel", this.release);
    window.addEventListener("blur", this.clear);
    // A phone rotated mid-run changes which pixels exist. Re-place rather than
    // let a button hang off the new edge.
    window.addEventListener("resize", this.place);
    window.addEventListener("orientationchange", this.place);
  }

  private button(c: Control): HTMLButtonElement {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = c.label;
    b.setAttribute("aria-label", c.hint);

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

  /** Put every button where this screen says it goes. */
  private place = (): void => {
    const area = {
      width: this.parent.clientWidth,
      height: this.parent.clientHeight,
    };
    for (const c of CONTROLS) {
      const b = this.buttons.get(c.id);
      if (!b) continue;
      const slot = this.layout.slots[c.id] ?? DEFAULT_SLOTS[c.id];
      Object.assign(
        b.style,
        buttonStyle(placed(slot, this.layout, area), this.layout, false),
      );
    }
  };

  /** Adopt a layout the player has just changed. */
  apply(layout: TouchLayout): void {
    this.layout = layout;
    this.place();
  }

  /**
   * Shown only while a run is actually being played.
   *
   * The pad sits over the whole play area, so in the hub or the shop it is nine
   * transparent circles on top of the things you came there to press. Hiding it
   * also drops every held intent: a button cannot be released by a thumb that
   * has nothing left to lift off.
   */
  setVisible(next: boolean): void {
    if (next === this.visible) return;
    this.visible = next;
    this.root.style.display = next ? "block" : "none";
    if (!next) this.clear();
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
    window.removeEventListener("resize", this.place);
    window.removeEventListener("orientationchange", this.place);
    this.root.remove();
  }
}