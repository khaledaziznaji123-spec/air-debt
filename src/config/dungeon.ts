/**
 * The dungeon's fixed geometry — five environments, seven shortcuts, and the
 * lever that opens each one.
 *
 * PRD FR-2.3 and the reshuffle section are explicit that this layer does NOT
 * reshuffle: "what deliberately does not change is the geometry — the rooms,
 * the shortcut doors, the lever positions and the exits". Encounters move
 * between runs; this does not. That fixity is what makes mastery legible and
 * what makes a levered shortcut a permanent, knowable asset.
 *
 * Positions are derived from the time budget in `tuning.ts` rather than typed
 * in as world coordinates. A shortcut is *defined* as "thirteen seconds of
 * ground" (FR-20.6); its length in world units is a consequence of how fast the
 * player moves. Authoring it the other way round would let a movement-speed
 * change silently break FR-20.5's 80–110 second window while every number in
 * this file still looked correct.
 *
 * ARCH AD-12: this is the local fallback and the schema. At runtime the layout
 * is expected to arrive from the server alongside the tuning document.
 */

import { tuning } from "./tuning.ts";

/**
 * The fraction of an environment's 60-second traverse (FR-19.1) that is spent
 * moving. The remaining third is spent fighting, reading trap tells and
 * hesitating — FR-19.5 is explicit that 60 seconds is *average* play, not a
 * clean run at full speed.
 *
 * This single number converts the whole design's time budget into distance.
 */
export const TRAVERSE_PACE = 0.65;

/** Effective world units per tick when traversing at average play. */
/**
 * Deliberately the WALK speed, not the sprint. The dungeon's length is the
 * design's time budget made concrete, and PRD says walking it all at full air
 * still loses — sizing the world off the sprint would quietly hand back the
 * distance that shortcuts are supposed to be the answer to.
 */
export const averageSpeed = tuning.movement.walkSpeed * TRAVERSE_PACE;

/**
 * How long one environment is, in world units.
 *
 * A FIXED NUMBER, and it used to be `environmentTraverse * averageSpeed`.
 *
 * That derivation was right while the dungeon was being designed: the time
 * budget was the specification and the world was poured from it. It is the wrong
 * way round now that the world exists and has been played, because it makes the
 * air ceiling and the map the same decision — lower the tank, and every piece,
 * fixture and shortcut in the game moves. That is what happened when the ceiling
 * was tried at three and a half minutes: eighteen placement invariants broke,
 * none of which had anything to do with air.
 *
 * So the arrow is reversed. The map is the fact now, and the budget describes
 * it. `checkTimeBudget` still guards FR-20 exactly as before — it just checks a
 * world it no longer builds, which means the ceiling can be tuned against
 * measured runs without moving anything.
 *
 * The literal is the value the old expression produced, so nothing shifted the
 * day this changed. If the dungeon is ever meant to get longer or shorter, this
 * is now the number to change, deliberately, on its own.
 */
export const environmentLength = 10062;

/**
 * How much ground one shortcut skips, in world units. Fixed for the same reason
 * as `environmentLength`, and the same value the old derivation produced.
 *
 * Worth knowing: this is what a shortcut IS, so it constrains what one can be
 * worth in the budget. It is 37% of an environment; a saving claimed in
 * `tuning.budget` that implies much more than that is a claim about ground that
 * does not exist.
 */
export const shortcutSpan = 3689;

/**
 * How far past the shortcut's far end its lever sits.
 *
 * FR-3.2 requires the lever to be on the far side of the ground the shortcut
 * skips. Close enough that emerging from the walk and finding it reads as a
 * reward for the walk, rather than as a separate errand.
 */
export const leverGap = 140;

/** How close the player must be to a lever or a door to use it. */
export const interactReach = 46;

/** Where the dungeon proper begins — everything left of this is outside. */
export const dungeonStart = tuning.room.entranceX;

/** The end of the last environment. The world is clamped to this. */
export const worldEnd =
  dungeonStart + environmentLength * tuning.budget.environmentCount;

export type Shortcut = {
  /** Content slug — the join key everywhere (ARCH conventions). */
  id: string;
  /** Which environment it lives in, zero-based. */
  environment: number;
  /** The near, shallow side. A locked door until its lever is flicked. */
  fromX: number;
  /** The far, deeper side. */
  toX: number;
  /** The lever, past the ground this shortcut skips (FR-3.2). */
  leverX: number;
};

/**
 * Where each shortcut starts, as a fraction along its environment.
 *
 * One or two per environment (FR-2.2), seven in total, because FR-20.5 derives
 * the count from the time budget rather than choosing it independently:
 * 7 x 13s = 91s of savings against an 80s deficit.
 */
const PLACEMENTS: { theme: Theme; at: number }[] = [
  // One each, and NONE in the parkour.
  //
  // A shortcut is a lever you walk to and a stretch you then stop walking. The
  // parkour has no stretch worth skipping — the walking IS the environment, and
  // a door through the middle of it would be a door out of the only thing it
  // does.
  //
  // FOUR, against the seven FR-20.5 solves the time budget with. That is a
  // deliberate choice and it has a cost: see `shortcutDeficit` below, which
  // measures it rather than leaving it to be discovered.
  { theme: "poison", at: 0.3 },
  // Late in the water, because the first third of it is now the cenote system
  // and the system is the environment. A shortcut over the top of it would be a
  // shortcut past the only thing there.
  { theme: "water", at: 0.55 },
  { theme: "rock", at: 0.3 },
  { theme: "fire", at: 0.3 },
];

/** Where environment `i` begins, in world units. */
export function environmentStart(index: number): number {
  return dungeonStart + index * environmentLength;
}

/**
 * Which environment a world position falls in, clamped to the real range.
 * Outside the mouth counts as environment 0 — you are not in the dungeon yet,
 * but the first thing you will be in is its first part.
 */
export function environmentAt(x: number): number {
  const index = Math.floor((x - dungeonStart) / environmentLength);
  if (index < 0) return 0;
  const last = tuning.budget.environmentCount - 1;
  return index > last ? last : index;
}

/**
 * What each environment IS, in the order the player meets them.
 *
 * The single place the running order lives. Everything else asks "what theme is
 * here" rather than "is this index 2", which is what makes the order something
 * you can change — before this, the fire was environment 2 in nineteen separate
 * places (the pieces, the monsters, the roof height, the palette, the hazards,
 * five test fixtures) and moving it meant finding all nineteen.
 *
 * The order is a difficulty ramp, and it is the player's: parkour is the
 * gentlest thing here because nothing in it fights back, and the fire is the
 * hardest, so the fire goes last. What used to be first — the rock — is now
 * second from the end, which is roughly where "normal" belongs once there are
 * four other things to compare it against.
 */
export type Theme = "parkour" | "poison" | "water" | "rock" | "fire";

export const THEMES: readonly Theme[] = [
  "parkour",
  "poison",
  "water",
  "rock",
  "fire",
];

/** Which theme a world position falls in. */
export function themeAt(x: number): Theme {
  return THEMES[environmentAt(x)];
}

/** Where a theme's environment begins, in world units. */
export function themeStart(theme: Theme): number {
  return environmentStart(indexOfTheme(theme));
}

/** Where a theme's environment ends. */
export function themeEnd(theme: Theme): number {
  return environmentStart(indexOfTheme(theme) + 1);
}

/** Which slot a theme occupies. Throws rather than returning -1: a typo here
 * would otherwise place things at the world's origin and look like a bug in
 * whatever asked. */
export function indexOfTheme(theme: Theme): number {
  const at = THEMES.indexOf(theme);
  if (at < 0) throw new Error(`no environment is themed ${theme}`);
  return at;
}

function build(): readonly Shortcut[] {
  const counters = new Map<number, number>();
  return PLACEMENTS.map(({ theme, at }) => {
    const environment = indexOfTheme(theme);
    const nth = counters.get(environment) ?? 0;
    counters.set(environment, nth + 1);
    const fromX = Math.round(
      environmentStart(environment) + at * environmentLength,
    );
    const toX = fromX + shortcutSpan;
    return {
      // 1-based and lettered so it reads in a log and in the UI: the second
      // shortcut of environment 3 is "shortcut.3b".
      id: `shortcut.${environment + 1}${String.fromCharCode(97 + nth)}`,
      environment,
      fromX,
      toX,
      leverX: toX + leverGap,
    };
  });
}

export const shortcuts: readonly Shortcut[] = build();

/**
 * The first shortcut in a given environment.
 *
 * By environment rather than by position in the list, because the list is
 * ordered by where things are and that order changes whenever the placements
 * do. It changed once already: the geyser chain is a thing the FIRE does, and
 * picking it as `shortcuts[1]` quietly moved it into the rock the moment
 * environment 1 gained a second shortcut.
 */
function firstIn(theme: Theme): string {
  const environment = indexOfTheme(theme);
  const found = shortcuts.find((s) => s.environment === environment);
  if (!found) throw new Error(`no shortcut in the ${theme}`);
  return found.id;
}

/**
 * The chute. One shortcut is not a door — it is a hole.
 *
 * The rock's, which is where a hole belongs: it is a run of smooth stone, and
 * smooth stone is a thing the rock has and the poison and the fire do not.
 *
 * Flicking its lever opens the ground above it, and stepping in drops the
 * player into a run of smooth rock that carries them the whole way at speed and
 * spits them out the far end in the air.
 *
 * Only the first one. A door is legible and instant and that is the right
 * default for six of them; making every shortcut a ride would turn permanent
 * progress into a theme park and take the geometry out of the player's hands.
 * One is a reward for the first lever anybody ever flicks.
 */
export const chuteId = firstIn("rock");

/**
 * The rising chain. The water's shortcut, and the only one in the game you can
 * fail halfway.
 *
 * Four columns in the seabed. Left alone they blow at random and are simply
 * another thing not to be floating over. The lever re-times them so they fire
 * in SEQUENCE — each one throws you up and forward far enough to land on the
 * next as it goes off — and the shortcut is a rhythm you ride rather than a
 * route you take.
 *
 * It was vents of steam in the floor of the fire. The mechanic is the same
 * either way — a column that throws you — and it is a better fit down here,
 * because water is the one place a player is already thinking about which way
 * is up.
 *
 * Miss the timing and nothing dramatic happens: you come down on the ordinary
 * ground somewhere in the middle of the span and walk the rest, having lost the
 * time the chain would have saved. That is deliberate. A shortcut is permanent
 * progress (FR-3), and permanent progress that can kill you is a trap with a
 * lever on it.
 *
 * Sat two thirds of the way through the fire to begin with, which put the whole
 * chain in the last stretch before the exit — the ground it skipped was ground
 * you had nearly finished anyway. It runs through the middle now.
 */
export const geyserId = firstIn("water");

/**
 * The burrow. The poison's shortcut.
 *
 * A ride, like the chute, and it costs you something the chute does not: you
 * come out the far end POISONED. It is a hole in the wall of a sump and it goes
 * through the roots — of course it does.
 *
 * That is the whole design of it. Every other shortcut in the game is free once
 * bought, which is right for permanent progress (FR-3), and one that charges a
 * status effect every single time is a different bargain rather than a worse
 * one: it is fifteen seconds against a bar and a half, and the answer changes
 * depending on how much health you are carrying and whether you have milk. A
 * shortcut you sometimes decline is more interesting than a shortcut you always
 * take.
 */
export const burrowId = firstIn("poison");

/**
 * The high road. The fire's shortcut, and the only one that does not move you.
 *
 * A ledge running the length of the ground it skips, high over the pools — it
 * is there from the first run, visible from below the whole way (FR-3.1 wants a
 * shortcut legible from the near side), and completely unreachable. The lever
 * arms a vent at the near end that throws you up onto it.
 *
 * So the other three are all "you are moved" — a door teleports, a chute rides,
 * a chain throws — and this one is "a road appears". You still walk every metre
 * of it yourself. What it skips is not the distance, it is the FLOOR, and the
 * floor is what the fire is made of.
 */
export const highRoadId = firstIn("fire");

export const shortcutById = new Map(shortcuts.map((s) => [s.id, s]));

/**
 * The layout invariants, checked rather than trusted — the same idea as
 * `checkTimeBudget`. A placement change that pushes a lever past the end of its
 * environment, or overlaps two shortcuts, should fail the build rather than
 * quietly produce an unreachable lever.
 */
export function checkDungeonLayout() {
  const perEnvironment = new Map<number, Shortcut[]>();
  for (const s of shortcuts) {
    const list = perEnvironment.get(s.environment) ?? [];
    list.push(s);
    perEnvironment.set(s.environment, list);
  }

  let contained = true;
  let disjoint = true;
  let densityOk = true;

  for (const [environment, list] of perEnvironment) {
    const start = environmentStart(environment);
    const end = start + environmentLength;
    // FR-2.2 — one or two per environment.
    if (list.length > 2) densityOk = false;
    for (const s of list) {
      if (s.fromX < start || s.leverX >= end) contained = false;
    }
    const sorted = [...list].sort((a, b) => a.fromX - b.fromX);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].fromX <= sorted[i - 1].leverX) disjoint = false;
    }
  }

  return {
    count: shortcuts.length,
    /** Every door, exit and lever sits inside its own environment. */
    contained,
    /** No two shortcuts in an environment overlap. */
    disjoint,
    /** FR-2.2 — one or two per environment. */
    densityOk,
    /** FR-20.6 — the count the time budget asked for. */
    countMatchesBudget: shortcuts.length === tuning.budget.shortcutCount,
    /** Every lever is past the ground its shortcut skips (FR-3.2). */
    leversPastTheGround: shortcuts.every((s) => s.leverX >= s.toX),
  };
}

/**
 * Every shortcut, open.
 *
 * For ranked runs. FR-3.3 makes a levered shortcut permanent and FR-3.5 makes an
 * unlevered one inert however the player came to know it was there — both of
 * which are about Story, where finding the lever IS the progress. A competitive
 * mode cannot ask that: the boards would rank whoever had already done the
 * unlocking, which is the same problem as ranking whoever had already done the
 * shopping.
 */
export function allShortcutIds(): string[] {
  return shortcuts.map((s) => s.id);
}
