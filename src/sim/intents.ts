/**
 * The player's input vocabulary.
 *
 * ARCH AD-21: the core owns this. Every shell that produces intents (keyboard,
 * touch) or consumes them (the replay validator) imports from here. A shell that
 * declares its own set will drift by a member and mis-validate every replay
 * containing it.
 *
 * ARCH AD-6: these are abstract and device-agnostic. Nothing here knows what a
 * key or a thumb is.
 *
 * Represented as a bitfield rather than a Set so a replay log entry is a single
 * integer — compact to store and trivially comparable when re-simulating.
 */

export const Intent = {
  None: 0,
  Left: 1 << 0,
  Right: 1 << 1,
  Jump: 1 << 2,
  Crouch: 1 << 3,
  Slide: 1 << 4,
  Attack: 1 << 5,
  Block: 1 << 6,
  Stun: 1 << 7,
  Bow: 1 << 8,
  /** Flick a lever, or step through an open shortcut door (PRD FR-3). */
  Interact: 1 << 9,
  /**
   * Drink the two potions that have a button. One flag each rather than a
   * "use item" flag plus a selection, because a selection is state the replay
   * would have to carry and the player would have to manage mid-fight — and
   * there are two of them.
   *
   * Two of the six potions have no flag. The spike ward spends itself on the
   * trap that would have taken you down and iron skin on the next hit — both
   * are moments that give you half a second to react, which is not enough time
   * to also choose an item.
   */
  Restoration: 1 << 10,
  Breath: 1 << 11,
  Haste: 1 << 12,
  Venom: 1 << 13,
  /**
   * Milk. The fifth potion with a button, and the first one added since the row
   * was written — the four before it are drunk on 1 to 4.
   *
   * It replaced the fireproofing draught rather than joining it: one thing that
   * stops both fire and poison is one button, and two things that each stopped
   * one were two buttons for a decision the environment had already made.
   */
  Milk: 1 << 14,
  /** The shield. Seven seconds where nothing at all gets through. */
  Shield: 1 << 15,
} as const;

export type IntentFlag = (typeof Intent)[keyof typeof Intent];

/** A frame's worth of held intents, as a bitfield. */
export type Intents = number;

export function has(intents: Intents, flag: IntentFlag): boolean {
  return (intents & flag) !== 0;
}

export function add(intents: Intents, flag: IntentFlag): Intents {
  return intents | flag;
}

export function remove(intents: Intents, flag: IntentFlag): Intents {
  return intents & ~flag;
}

/** Intents newly pressed this tick — held now, absent last tick. */
export function pressed(now: Intents, previous: Intents): Intents {
  return now & ~previous;
}

/** One entry in a replay log. PRD FR-15.5, ARCH AD-6. */
export type InputRecord = {
  tick: number;
  intents: Intents;
};
