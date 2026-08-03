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
