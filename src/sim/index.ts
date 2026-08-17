/**
 * The simulation's public surface.
 *
 * ARCH AD-5: `render` and `app` import from here. This module imports only
 * `config` and the standard library — never the other way around.
 * ARCH AD-7: everything reachable from here runs unmodified in the browser and
 * in a Node route handler.
 */

import { tuning } from "../config/tuning.ts";
import {
  dungeonStart,
  environmentAt,
  interactReach,
  shortcuts,
  themeAt,
  themeEnd,
  themeStart,
} from "../config/dungeon.ts";
import {
  builtEnd,
  chamber,
  escapes,
  environmentsBuilt,
  exitX,
  gateX,
  hazardAt,
  terrain,
  tutorial as TUT,
} from "../config/terrain.ts";
import { onSpikes, groundUnder } from "./collide.ts";
import { Intent, type Intents, type InputRecord } from "./intents.ts";
import { createRng, deriveSeed, type Rng } from "./rng.ts";
import {
  EMPTY_LOADOUT,
  potionsFor,
  statsFor,
  type Loadout,
} from "../config/shop.ts";
import { gradeFor, step } from "./step.ts";
import type {
  Carried,
  Chest,
  ChestLoot,
  Enemy,
  LootTier,
  SimState,
} from "./types.ts";

export { Intent, has, add, remove, pressed } from "./intents.ts";
export type { Intents, InputRecord, IntentFlag } from "./intents.ts";
export {
  scoreOf,
  scoresOf,
  bagValue,
  ticksFromSpeed,
  BOARDS,
  SPEED_CEILING,
  type Board,
} from "./score.ts";
export { createRng, deriveSeed, type Rng } from "./rng.ts";
export {
  step,
  isParrying,
  playerHitbox,
  enemySize,
  gradeFor,
  type Box,
} from "./step.ts";
export {
  EMPTY_LOADOUT,
  statsFor,
  potionsFor,
  levelOf,
  priceOf,
  SHOP,
  CATEGORIES,
  afford,
  pay,
  type Loadout,
  type ShopItem,
  type Purse,
} from "../config/shop.ts";
export type {
  SimState,
  Player,
  PlayerStance,
  ActionState,
  RunOutcome,
  Enemy,
  EnemyPhase,
  EnemyVerbs,
  SimEvent,
  Chest,
  ChestLoot,
  LootTier,
  Carried,
} from "./types.ts";

/**
 * Named random streams. ARCH AD-4: one stream per concern, derived from the run
 * seed, never shared and never renumbered. Changing how many enemies a run
 * places must not shift where its chests land — otherwise tuning one system
 * silently invalidates every stored replay of the other.
 */
export const Stream = {
  Encounters: 1,
  Chests: 2,
  Traps: 3,
  Modifier: 4,
  /**
   * What monsters drop. Its own stream so that changing how many enemies a run
   * places cannot shift what the ones that remain are carrying — the same rule
   * every other stream here exists for.
   */
  Drops: 5,
} as const;

/**
 * The seed used when none is supplied. Real runs get theirs from the server
 * (PRD FR-15.1); this exists so tests and local play are reproducible.
 */
export const DEFAULT_SEED = 1;

/**
 * A goblin: the floor of the verb scale — it moves and it attacks (FR-7.1).
 *
 * Exported so tests build one the same way the game does. They used to write
 * the object literal out by hand, which meant every field added to `Enemy`
 * broke six fixtures that had no opinion about it.
 */
export function goblin(x: number, y: number): Enemy {
  return {
    kind: "enemy.goblin",
    x,
    y,
    vx: 0,
    vy: 0,
    facing: -1,
    hp: tuning.enemies.goblin.maxHp,
    phase: "idle",
    phaseTicks: 0,
    verbs: {
      move: true,
      attack: true,
      slide: false,
      block: false,
      jump: true,
      shoot: false,
      slam: false,
    },
    parriedThisTick: false,
    shoulder: null,
    attackKind: "swing",
    // Filled in by `rollDrops` once the whole roster is placed.
    drop: { gems: 0, gold: 0 },
  };
}

/**
 * A corrupt archer. The second verb set (FR-7.2): it keeps its distance and
 * shoots, where the goblin closes and swings.
 *
 * No jump. It gives ground rather than chasing, so a ledge is cover from a
 * goblin and emphatically not from this — which is the point of having both.
 */
export function archer(x: number, y: number): Enemy {
  return {
    kind: "enemy.archer",
    x,
    y,
    vx: 0,
    vy: 0,
    facing: -1,
    hp: tuning.enemies.archer.maxHp,
    phase: "idle",
    phaseTicks: 0,
    verbs: {
      move: true,
      attack: true,
      slide: false,
      block: false,
      jump: false,
      shoot: true,
      slam: false,
    },
    parriedThisTick: false,
    shoulder: null,
    attackKind: "swing",
    // Filled in by `rollDrops` once the whole roster is placed.
    drop: { gems: 0, gold: 0 },
  };
}

/**
 * The phoenix. Environment 2's shooter.
 *
 * `shoot` is what routes a projectile out of it; the kind is what decides that
 * the projectile is a fireball and that a parry breaks rather than returns it.
 * No `jump` and no `move` in the ground sense — it rides its own altitude, and
 * `stepPhoenix` writes the height every tick.
 */
export function phoenix(x: number, y: number): Enemy {
  return {
    kind: "enemy.phoenix",
    x,
    y,
    vx: 0,
    vy: 0,
    facing: -1,
    hp: tuning.enemies.phoenix.maxHp,
    phase: "idle",
    phaseTicks: 0,
    verbs: {
      move: true,
      attack: true,
      slide: false,
      block: false,
      jump: false,
      shoot: true,
      slam: false,
    },
    parriedThisTick: false,
    shoulder: null,
    attackKind: "swing",
    drop: { gems: 0, gold: 0 },
  };
}

/**
 * The flamethrower. Environment 2's pressure.
 *
 * Deliberately NOT `shoot`: it has no projectile, it has a box in front of it
 * that is on or off. Giving it `shoot` would route it through the archer's
 * mind and it would start backing away from the player, which is the exact
 * opposite of the thing it is for.
 */
export function flamer(x: number, y: number): Enemy {
  return {
    kind: "enemy.flamer",
    x,
    y,
    vx: 0,
    vy: 0,
    facing: -1,
    hp: tuning.enemies.flamethrower.maxHp,
    phase: "idle",
    phaseTicks: 0,
    verbs: {
      move: true,
      attack: true,
      slide: false,
      block: false,
      jump: false,
      shoot: false,
      slam: false,
    },
    parriedThisTick: false,
    shoulder: null,
    attackKind: "swing",
    drop: { gems: 0, gold: 0 },
  };
}

/**
 * The Kiln. Environment 2's mini-boss.
 *
 * No riders. The Warden is a composite — a body plus two archers on it — and
 * doing that twice would make "boss" mean "thing with passengers". This one is
 * a single object whose danger is the space around it.
 */
export function kiln(x: number, y: number): Enemy {
  return {
    kind: "enemy.kiln",
    x,
    y,
    vx: 0,
    vy: 0,
    facing: -1,
    hp: tuning.enemies.kiln.maxHp,
    phase: "idle",
    phaseTicks: 0,
    verbs: {
      move: true,
      attack: true,
      slide: false,
      block: false,
      jump: false,
      shoot: false,
      // Not the Warden's slam, but the same promise: an attack that the parry
      // has no answer to, so the block cannot be the answer to everything.
      slam: true,
    },
    parriedThisTick: false,
    shoulder: null,
    attackKind: "swing",
    drop: { gems: 0, gold: 0 },
  };
}

/** Something that walks, with its own numbers. Used by the four newcomers. */
function beast(
  kind: Enemy["kind"],
  hp: number,
  x: number,
  y: number,
  verbs?: Partial<Enemy["verbs"]>,
): Enemy {
  return {
    kind,
    x,
    y,
    vx: 0,
    vy: 0,
    facing: -1,
    hp,
    phase: "idle",
    phaseTicks: 0,
    verbs: {
      move: true,
      attack: true,
      slide: false,
      block: false,
      jump: false,
      shoot: false,
      slam: false,
      ...verbs,
    },
    parriedThisTick: false,
    shoulder: null,
    attackKind: "swing",
    drop: { gems: 0, gold: 0 },
  };
}

/** Environment 3, in the water. */
export function shark(x: number, y: number): Enemy {
  return beast("enemy.shark", tuning.enemies.shark.maxHp, x, y);
}

/** Environment 3, on the sand. */
export function crab(x: number, y: number): Enemy {
  return beast("enemy.crab", tuning.enemies.crab.maxHp, x, y);
}

/** Environment 5. Its bite is the poison. */
export function lizard(x: number, y: number): Enemy {
  return beast("enemy.lizard", tuning.enemies.lizard.maxHp, x, y);
}

/** Environment 5. One dive, and then it is finished either way. */
export function bee(x: number, y: number): Enemy {
  return beast("enemy.bee", tuning.enemies.bee.maxHp, x, y);
}

/**
 * The Revenant: somebody who came this far before you and did not come back.
 *
 * It gets the player's verbs, which is the entire point — `block` is what makes
 * it parry, `jump` and `slide` are what make it move like a person rather than
 * a monster, and `shoot` is the fireball it has where you have a stun.
 */
export function revenant(x: number, y: number): Enemy {
  return beast("enemy.revenant", tuning.enemies.revenant.maxHp, x, y, {
    move: true,
    attack: true,
    block: true,
    jump: true,
    slide: true,
    shoot: true,
  });
}

/** The bottom of the dungeon. */
export function hollow(x: number, y: number): Enemy {
  return beast("enemy.hollow", tuning.enemies.hollow.maxHp, x, y, {
    slam: true,
  });
}

/**
 * The Warden and the two archers strapped to its shoulders.
 *
 * It stands ON the exit — the run cannot be banked through the far door while
 * it lives (the mouth still works, so retreating is always available and the
 * boss is never a trap). Beat it and the chest behind it unlocks.
 *
 * The riders are ordinary archers with `shoulder` set. They keep the whole
 * archer mind — the draw, the tell, the aimed shot, the fact that a reflected
 * arrow kills one — and give up only their legs. That is the cheapest possible
 * way to make a boss that is a COMPOSITE rather than a bag of health, and it is
 * why parrying is a live answer to a boss whose own swing you might not reach.
 */
export function warden(x: number, y: number): Enemy {
  return {
    kind: "enemy.warden",
    x,
    y,
    vx: 0,
    vy: 0,
    facing: -1,
    hp: tuning.enemies.warden.maxHp,
    phase: "idle",
    phaseTicks: 0,
    verbs: {
      move: true,
      attack: true,
      slide: false,
      block: false,
      // No jump. It is a door: it holds ground and it does not chase you onto
      // a ledge — which is what makes the ledges around it worth using.
      jump: false,
      shoot: false,
      slam: true,
    },
    parriedThisTick: false,
    shoulder: null,
    attackKind: "swing",
    // Filled in by `rollDrops` once the whole roster is placed.
    drop: { gems: 0, gold: 0 },
  };
}

/** A rider: an archer that cannot walk, because it is tied to something. */
export function rider(side: -1 | 1, x: number, y: number): Enemy {
  return { ...archer(x, y), shoulder: side };
}

/**
 * Where the Warden stands: in front of the GATE at the end of environment 1,
 * not in front of the exit.
 *
 * They were the same spot while environment 1 was the world. Now the exit is at
 * the far end of the fire, and a boss that followed it there would leave the
 * rock with nothing guarding it and put the only mini-boss in the game two
 * environments deep. It keeps the job it was built for - it is what you have to
 * beat to get anywhere new - and the arithmetic is untouched, so environment 1
 * plays exactly as it did.
 *
 * `step.ts` has the same expression under its own name — it cannot import this
 * one, because `index` imports `step`. A test asserts the two agree.
 */
export const wardenPost = gateX - 190;

/**
 * Where the Kiln stands: in front of the way out of the fire.
 *
 * The same relationship the Warden has to the gate. `step.ts` writes the
 * expression a second time under its own name for the same reason it does for
 * the Warden — index imports step, so the arrow cannot point back — and a test
 * keeps the two equal.
 */
export const kilnPost = exitX - 210;

/**
 * Where the Hollow stands: in the middle of its own chamber.
 *
 * It used to be `exitX - 240` — open floor at the end of the last corridor,
 * which made it a monster with a large health bar rather than an event. The
 * room exists now, so it stands in the room, and the room's own walls are what
 * the arena is drawn against.
 */
export const hollowPost = Math.round((chamber.x0 + chamber.x1) / 2);

/**
 * How thickly the built environment is populated.
 *
 * Every anchor the terrain offers gets a monster, and then this many extra are
 * scattered along the floor between them. The terrain lays out roughly one
 * anchor per set piece, which on its own leaves long empty walks; these are what
 * make the place feel occupied rather than decorated.
 *
 * Started at 26, came down to 12, and is now 4. Enemies wake at 900 units, so
 * this number is really a statement about how many are awake AT ONCE — and the
 * measurement kept saying something worse than the count suggested. At 12 the
 * worst stretch had ELEVEN awake together. A goblin's swing is a whole health
 * bar and there are three of them, so eleven is not a hard fight, it is a
 * queue of people taking turns to end the run.
 *
 * Between them, this and `ANCHOR_SHARE` bring the worst stretch down to a
 * handful. The environment is meant to be crossable by someone who is good at
 * it, and right now nobody is good at it yet.
 */
/**
 * How far apart two chests have to be.
 *
 * Comfortably more than one interact reach, so that standing in front of one
 * chest can never put a second inside the same press. The fire's `forge` piece
 * offers two anchors and the causeway adds a third overhead; without this, the
 * closest pair in the world came out thirteen units apart.
 */
const CHEST_APART = interactReach * 2 + 40;

/**
 * And how much room three of them need between the first and the last.
 *
 * `CHEST_APART` is a rule about PAIRS, and pairs were the whole problem when it
 * was written — two chests thirteen units apart meant one press opened both.
 * But a pairwise rule says nothing about a row: three chests each a hundred and
 * forty from the next satisfies it completely and comes out as a shelf of
 * treasure, which is neither a decision nor a reward. The tightest three in the
 * world were two hundred and eighty units end to end.
 *
 * Roughly a screen. Two chests near each other is a choice about which to spend
 * air on; three is a shop.
 */
const CHEST_CROWD = 620;

/** Whether a third chest here would make a row of them. */
function crowded(at: number, placed: readonly { x: number }[]): boolean {
  return placed.filter((c) => Math.abs(c.x - at) < CHEST_CROWD).length >= 2;
}

/**
 * The nearest spot to `x` with room around it.
 *
 * Two rules, in order of how badly they read when broken: nothing within
 * `CHEST_APART` (one press must not open two), and no third inside
 * `CHEST_CROWD` (a row of chests is a shop, not a decision).
 *
 * It used to give up after seven hundred units and place at the original `x`
 * regardless, which is how three chests ended up a hundred and ninety-five
 * apart end to end. It now searches the whole slot, and when it genuinely
 * cannot satisfy both it returns the LEAST crowded thing it saw rather than the
 * spot it started from — falling back to the failure is not a fallback.
 */
function nudgeApart(x: number, placed: readonly { x: number }[]): number {
  let best = x;
  let bestScore = Infinity;
  for (let step = 0; step <= 1400; step += 40) {
    for (const at of step === 0 ? [x] : [x - step, x + step]) {
      const settled = clearOfSolid(
        clearOfFixtures(at),
        tuning.room.floorY,
        40,
        30,
      );
      if (onSpikes(settled, groundUnder(settled, tuning.room.floorY - 40), 30))
        continue;
      const tooClose = placed.some(
        (c) => Math.abs(c.x - settled) < CHEST_APART,
      );
      if (tooClose) continue;
      if (!crowded(settled, placed)) return settled;
      // Legal but crowded. Remember the emptiest one in case nothing better
      // turns up — scored by how many neighbours are in the window, then by how
      // far it has wandered from where it wanted to be.
      const score =
        placed.filter((c) => Math.abs(c.x - settled) < CHEST_CROWD).length *
          10000 +
        step;
      if (score < bestScore) {
        bestScore = score;
        best = settled;
      }
    }
  }
  return best;
}

const EXTRA_ENEMIES = 5;

/**
 * Phoenixes placed in the fire's open air, on top of whatever the ledges give.
 *
 * Nine across the environment, which comes out at roughly one every eleven
 * hundred units — close enough that crossing the fire means dealing with them,
 * far enough that they are never a wall of fireballs.
 */
const FIRE_SHOOTERS = 9;

/**
 * Bees loose in environment 5.
 *
 * One about every eight hundred units. Each is a single question with one good
 * answer and it dies either way, so they are cheap to meet often — and meeting
 * them often is the only way the answer gets learned.
 */
const HIVE = 12;

/**
 * How many of the terrain's raised spots get an archer.
 *
 * Half. Height is what an archer is for — a goblin on a ledge never joins the
 * fight, so the raised ground was otherwise just scenery with loot on it. But
 * ALL of them meant every ledge in the environment was shooting at once, and an
 * archer you have not reached yet is damage you cannot answer.
 *
 * Half leaves the ledges worth checking before you commit to the ground under
 * them, without making the ground unusable.
 */
const ARCHER_SHARE = 0.5;

/**
 * How much clear ground a lever or a door keeps around itself. A goblin
 * standing on a lever would turn "walk the ground" into "win a fight on one
 * exact pixel", which is not the bargain FR-3.2 offers.
 */
const FIXTURE_KEEPOUT = 110;

/**
 * The nearest spot that is clear of every fixture at once.
 *
 * Fixtures cluster. A shortcut's far door and its lever sit `leverGap` apart,
 * which is narrower than two keep-outs, so the ground between them is not
 * standable at all. Clearing one fixture at a time therefore does not converge:
 * pushed off the door you land on the lever, and pushed off the lever you land
 * back on the door.
 *
 * So the keep-outs are merged into spans first and the position is pushed out
 * of the whole span. That is also the only version that terminates.
 */
function clearOfFixtures(x: number): number {
  const spans: Array<[number, number]> = [];
  for (const s of shortcuts) {
    for (const fixture of [s.fromX, s.toX, s.leverX]) {
      spans.push([fixture - FIXTURE_KEEPOUT, fixture + FIXTURE_KEEPOUT]);
    }
  }
  // And the escape shafts, for a reason that only shows up when you use one: a
  // press does exactly one thing, and a chest standing on a shaft takes the
  // press. What that looks like is a way out that ignored you the first time
  // you asked it.
  for (const e of escapes) {
    spans.push([e - FIXTURE_KEEPOUT, e + FIXTURE_KEEPOUT]);
  }
  spans.sort((a, b) => a[0] - b[0]);

  const merged: Array<[number, number]> = [];
  for (const [from, to] of spans) {
    const last = merged[merged.length - 1];
    if (last && from <= last[1]) last[1] = Math.max(last[1], to);
    else merged.push([from, to]);
  }

  for (const [from, to] of merged) {
    if (x > from && x < to) return x - from < to - x ? from : to;
  }
  return x;
}

/**
 * The nearest spot at `y` that is not inside solid rock.
 *
 * Placement only ever checked the fixtures. It never checked the TERRAIN, which
 * was harmless while enemies had no horizontal collision and became visible the
 * moment they did: a goblin slotted onto the floor inside a raised block was
 * shoved out of it on the first tick, so monsters that were supposed to be
 * asleep appeared to move.
 *
 * Merged spans for the same reason `clearOfFixtures` uses them — pushing out of
 * one surface can land inside the next, and one at a time does not converge.
 */
/**
 * The nearest x to this one whose ground is not lava, or null for nowhere near.
 *
 * The fire cuts wide pools, and the floor of a pool is perfectly good ground as
 * far as `groundUnder` is concerned — so a monster slotted over one was placed
 * standing in the lava and killed by it on the first tick of the run. The
 * roster is built before anything has stepped, so the only sign of it was an
 * enemy that had quietly vanished by the time anyone looked.
 *
 * Searched outward in both directions, so a spot is nudged to the nearer lip
 * rather than always pushed the same way and piled up at one end of the pool.
 */
/**
 * How much is already going on around a spot, 0 (bare floor) to 1 (packed).
 *
 * Monsters and terrain are two ways of asking the player the same question, and
 * before this they were dealt out independently: a set piece with a pit, a
 * crusher and two ledges got the same number of goblins as four hundred units
 * of empty corridor, so the busy ground was unfair and the empty ground was a
 * walk. Density is spent where there is nothing else to spend it on.
 *
 * Counted from the fixed geometry only. The encounters reshuffle with the seed
 * and the terrain does not (FR-2), so this stays stable run to run.
 */
function clutterAt(x: number): number {
  const near = 300;
  let score = 0;
  for (const s of terrain.surfaces) {
    // Only things standing on the floor: the ground itself is not clutter.
    if (s.top >= tuning.room.floorY - 4) continue;
    if (s.x1 < x - near || s.x0 > x + near) continue;
    score += s.thin ? 0.5 : 0.8;
  }
  for (const h of terrain.hazards) {
    if (Math.abs(h.x - x) > near) continue;
    score += 1.2;
  }
  for (const p of terrain.spikes) {
    if (p.x1 < x - near || p.x0 > x + near) continue;
    score += 1.4;
  }
  for (const l of terrain.ladders) {
    if (Math.abs(l.x - x) > near) continue;
    score += 0.6;
  }
  return Math.min(1, score / 4);
}

function clearOfLava(x: number, width: number): number | null {
  for (let step = 0; step <= 420; step += 30) {
    for (const at of step === 0 ? [x] : [x - step, x + step]) {
      if (survivable(at, width)) return at;
    }
  }
  return null;
}

/**
 * Whether something standing here would still be alive when the player arrived.
 *
 * Two ways it would not be. The floor might be lava — the fire cuts wide pools
 * and the floor of one is perfectly good ground as far as `groundUnder` is
 * concerned. Or the spot might be under something on a cycle: hazards kill
 * monsters as readily as they kill players, which is the best thing about them
 * and also means a monster parked under a crusher is a monster that dies to the
 * scenery in the first eight seconds of the run, before anyone has seen it.
 *
 * Neither failure is visible from a screenshot. Both look exactly like an
 * encounter that was never placed.
 */
/** The same question for something that flies, asked at flying height. */
function clearAloft(x: number): boolean {
  const p = tuning.enemies.phoenix;
  const ground = groundUnder(x, tuning.room.floorY - 40);
  const body = {
    left: x - p.width / 2,
    right: x + p.width / 2,
    top: ground - p.hover - p.height,
    bottom: ground - p.hover + p.bob,
  };
  for (const h of terrain.hazards) {
    for (let tick = 0; tick < h.period; tick += 2) {
      const box = hazardAt(h, tick);
      if (!box.armed) continue;
      if (box.right <= body.left || box.left >= body.right) continue;
      if (box.bottom <= body.top || box.top >= body.bottom) continue;
      return false;
    }
  }
  return true;
}

function survivable(x: number, width: number): boolean {
  const ground = groundUnder(x, tuning.room.floorY - 40);
  if (onSpikes(x, ground, width)) return false;

  const body = {
    left: x - width / 2,
    right: x + width / 2,
    top: ground - tuning.enemies.goblin.height,
    bottom: ground,
  };
  for (const h of terrain.hazards) {
    for (let tick = 0; tick < h.period; tick += 2) {
      const box = hazardAt(h, tick);
      if (!box.armed) continue;
      if (box.right <= body.left || box.left >= body.right) continue;
      if (box.bottom <= body.top || box.top >= body.bottom) continue;
      return false;
    }
  }
  return true;
}

function clearOfSolid(x: number, y: number, height: number, width: number) {
  const spans: Array<[number, number]> = [];
  for (const s of terrain.surfaces) {
    // Thin platforms count too. Collision stopped distinguishing them when
    // platforms became solid, so a body standing under a low ledge is inside
    // it exactly as much as one standing inside a block — and the goblins
    // slotted under ledges were being shoved out on the first tick.
    //
    // The vertical test is what excludes the ground: a surface the body is
    // standing ON has its top at the feet, and is skipped.
    if (y <= s.top || y - height >= s.bottom) continue;
    spans.push([s.x0 - width / 2, s.x1 + width / 2]);
  }
  spans.sort((a, b) => a[0] - b[0]);

  const merged: Array<[number, number]> = [];
  for (const [from, to] of spans) {
    const last = merged[merged.length - 1];
    if (last && from <= last[1]) last[1] = Math.max(last[1], to);
    else merged.push([from, to]);
  }
  for (const [from, to] of merged) {
    if (x > from && x < to) return x - from < to - x ? from : to;
  }
  return x;
}

/**
 * Where the monsters are this run.
 *
 * PRD FR-2 / the reshuffle section: the geometry is fixed and the encounters
 * are not. This is the half that moves. Density rises with depth because
 * FR-7.2 makes difficulty a matter of breadth and pressure rather than stats.
 *
 * Positions are slotted then jittered rather than drawn freely, so two goblins
 * can never roll the same spot and a stretch can never come up empty.
 */
function placeEncounters(seed: number): Enemy[] {
  const rng = createRng(deriveSeed(seed, Stream.Encounters));
  const placed: Enemy[] = [];

  /**
   * Whether anything at all may stand here.
   *
   * The parkour has NO monsters — not few, none. Its
   * pieces lay down no anchors, but three separate passes place things by
   * position rather than by anchor, and each of them would happily drop a
   * goblin into the middle of a wall-jump shaft. One rule, asked by all of them.
   */
  const monstersAllowed = (x: number) => themeAt(x) !== "parkour";

  // Who lives where.
  //
  // The placement rules — guard every other anchor, put a shooter on the raised
  // ground, fill the walks — are about SHAPE, and the shape is right in both
  // environments. Only the casting changes: the rock has goblins and archers,
  // the fire has flamethrowers and phoenixes. Writing the loops twice with two
  // sets of names would be two places for the shape to drift apart.
  const walker = (x: number, y: number) => {
    switch (themeAt(x)) {
      case "rock":
        return goblin(x, y);
      case "fire":
        return flamer(x, y);
      case "water":
        // The beach's own. Sharks are placed separately, in the water.
        return crab(x, y);
      case "poison":
        return lizard(x, y);
      case "parkour":
        // No monsters at all. It never reaches here because the parkour's
        // pieces lay down no anchors, but saying so out loud is cheaper than
        // finding out the hard way.
        return goblin(x, y);
    }
  };
  /**
   * And the size to place one at. The fire's walker is four units wider than
   * the rock's, which sounds like nothing and is not: slotted at the goblin's
   * width, two of them spawn overlapping and spend the first second of the run
   * shoving each other apart in full view of nobody.
   */
  const walkerSize = (x: number) => {
    switch (themeAt(x)) {
      case "fire":
        return tuning.enemies.flamethrower;
      case "water":
        return tuning.enemies.crab;
      case "poison":
        return tuning.enemies.lizard;
      default:
        return tuning.enemies.goblin;
    }
  };
  /**
   * What stands on the raised ground, if anything.
   *
   * Explicit per environment rather than "archer in the rock, phoenix
   * everywhere else" — that fallback quietly seeded phoenixes across the water
   * and the parkour, which are the two places whose whole identity is that they
   * do not have them. The water's threat is in the water; null here means the
   * shelf simply stays empty.
   */
  const shooter = (x: number, y: number): Enemy | null => {
    switch (themeAt(x)) {
      case "rock":
        return archer(x, y);
      case "fire":
        // Already at altitude: spawned on the floor it would spend its first
        // second climbing, in full view, doing nothing.
        return phoenix(x, y - tuning.enemies.phoenix.hover);
      case "poison":
        return bee(x, y - tuning.enemies.bee.hover);
      default:
        return null;
    }
  };

  // The terrain's own anchors first — the spots it laid out expecting to be
  // guarded. A pit whose far lip has nothing standing on it is just a gap.
  //
  // Every OTHER one. The terrain lays out an anchor per set piece and then some,
  // which guarded everything and left nowhere to breathe between the guards.
  // Alternating keeps the set pieces defended and halves the crowd.
  for (const [n, a] of terrain.enemyAnchors.entries()) {
    if (n % 2 === 1) continue;
    // Busy ground guards itself. An anchor beside a crusher and a pit is
    // already asking the player a question; putting a monster on top of it asks
    // two at once and neither gets read.
    // Capped, not scaled to nothing. The fire is cluttered almost everywhere —
    // it is made of pools and curtains — and at full strength this emptied its
    // floor of everything that walks. Even the busiest ground keeps roughly
    // half its guards; the difference is made up by open ground getting more.
    if (rng.next() < clutterAt(a.x) * 0.5) continue;
    if (!monstersAllowed(a.x)) continue;
    const size = walkerSize(Math.round(a.x));
    const dry = clearOfLava(Math.round(a.x), size.width);
    if (dry === null) continue;
    const y = groundUnder(clearOfFixtures(dry), a.y - 40);
    // Fixtures LAST. `clearOfSolid` moves things too, and moving something out
    // of a wall can put it straight back onto the lever it was just moved off —
    // which is how a flamer ended up standing on the fire's shortcut, on the
    // one piece of ground FR-3 makes the win condition.
    const x = clearOfFixtures(
      clearOfSolid(clearOfFixtures(dry), y, size.height, size.width),
    );
    if (!survivable(x, size.width)) continue;
    placed.push(walker(x, groundUnder(x, a.y - 40)));
  }

  // Archers on the raised ground the terrain offers. A goblin on a ledge is a
  // goblin that never joins the fight; an archer on one is the whole reason
  // ledges are worth looking at.
  // Phoenixes are placed in the fire's open air rather than on its ledges: a
  // hovering enemy put down on a shelf would spend its first second climbing
  // off it, and the shelf is not what makes it dangerous anyway.
  for (const a of terrain.chestAnchors) {
    // Every RAISED anchor, not only the hidden ones. A shelf is as good a
    // firing position as an alcove.
    if (a.y >= tuning.room.floorY) continue;
    if (rng.next() > ARCHER_SHARE) continue;
    // Cleared against the ground it will ACTUALLY stand on, not against the
    // anchor. Clearing at one height and then placing at another is how the
    // goblins ended up inside the scenery the first time.
    // Shooters get the same treatment, measured at the height they will
    // actually occupy: a phoenix hovers a hundred and fifty units up, which is
    // exactly where a curtain of lava is.
    const at = Math.round(a.x) + 60;
    if (!monstersAllowed(at)) continue;
    if (!clearAloft(at)) continue;
    const size = tuning.enemies.archer;
    const x = clearOfSolid(
      at,
      groundUnder(at, a.y - 40),
      size.height,
      size.width,
    );
    const y = groundUnder(x, a.y - 40);
    // And off the fixtures, checked last for the same reason the walkers'
    // pass checks it last: `clearOfSolid` moves things, and moving something
    // out of a wall can put it back on the lever it was moved off.
    const settled = clearOfFixtures(
      clearOfSolid(x, y, size.height, size.width),
    );
    const up = shooter(settled, groundUnder(settled, a.y - 40));
    if (up) placed.push(up);
  }

  // Phoenixes in the open air of the fire.
  //
  // The other shooters are placed on the raised ground the terrain offers,
  // because that is where an archer is worth standing. A phoenix does not stand
  // anywhere — the whole point of it is that it has height without needing a
  // ledge — so tying its numbers to how many shelves a stretch happens to have
  // gave the fire six of them across ten thousand units, and you could cross a
  // whole environment named after a firebird without meeting one.
  //
  // Slotted like the ground filler, and skipped where a curtain of lava is
  // already pouring through the air they would hover in.
  if (environmentsBuilt > 1) {
    const from = themeStart("fire") + 500;
    // Its own environment and no further. Measured against `builtEnd`, this
    // pass seeded phoenixes through the water, the parkour and the poison.
    const span = themeEnd("fire") - 500 - from;
    for (let i = 0; i < FIRE_SHOOTERS; i++) {
      const at = Math.round(
        from + (span / FIRE_SHOOTERS) * (i + 0.15 + rng.next() * 0.7),
      );
      if (!clearAloft(at)) continue;
      // And off the fixtures. This pass places by slot rather than by anchor,
      // so it was the one route by which something could end up hovering over a
      // lever — which is ground FR-3 makes the win condition.
      const clear = clearOfFixtures(at);
      if (!clearAloft(clear)) continue;
      placed.push(
        phoenix(
          clear,
          groundUnder(clear, tuning.room.floorY - 40) -
            tuning.enemies.phoenix.hover,
        ),
      );
    }
  }

  // Bees, in the open air of the poison.
  //
  // They were placed only on raised ledges, the way the archers are — and the
  // poison has few of those, so a run could cross the whole environment and
  // meet one. A bee does not need a ledge: it hovers. Slotted like the ground
  // filler instead, which is what actually puts them in your way.
  if (environmentsBuilt > 4) {
    const from = themeStart("poison") + 500;
    // To the end of the POISON, not the end of the world.
    //
    // This said `builtEnd - 700`, which was very nearly right when the poison
    // was the last environment and completely wrong the moment it became the
    // second: twelve bees were being spread across everything from the poison
    // to the fire, so they turned up in the water, the rock and the fire — three
    // places whose whole identity is that they do not have them.
    const span = themeEnd("poison") - 400 - from;
    for (let i = 0; i < HIVE; i++) {
      const at = Math.round(
        from + (span / HIVE) * (i + 0.2 + rng.next() * 0.6),
      );
      if (!monstersAllowed(at)) continue;
      const clear = clearOfFixtures(at);
      // And checked AFTER the nudge, because `clearOfFixtures` moves things and
      // a bee slotted at the last metre of the poison can be moved out of it.
      if (themeAt(clear) !== "poison") continue;
      placed.push(
        bee(
          clear,
          groundUnder(clear, tuning.room.floorY - 40) -
            tuning.enemies.bee.hover,
        ),
      );
    }
  }

  // Sharks, spaced along the deep water rather than one per body of it.
  //
  // The sea is laid in short segments so its bed can slope, and "one per body"
  // read that as thirty-two separate oceans and put a shark in each. What the
  // player experiences is a distance, so that is what this measures.
  //
  // Five hundred rather than nine hundred, and skipped one time in ten rather
  // than one in five. The environment was too quiet: a diver could cross most of
  // it without meeting anything, which makes the breath meter the only pressure
  // in the water and the breath meter is a clock rather than an enemy. The
  // passage under the rock gets them too — it is the tightest water in the game
  // and the least comfortable place to meet one, which is exactly the argument
  // for it being there.
  {
    // SORTED, which is load-bearing rather than tidy. The spacing below walks
    // the list keeping the last position it used, so it only means anything if
    // the list ascends — and `terrain.water` does not. The sea is laid first,
    // across the whole environment, and the flooded passage is laid afterwards
    // into the middle of it. So by the time the walk reached the passage,
    // `lastAt` was already past the far end of the sea, every segment came out
    // as "too close to the last one", and the tightest water in the game had no
    // sharks in it at all.
    const deepEnough = terrain.water
      // Deep enough to swim, and INSIDE THE DUNGEON. There is water past the
      // end of the world — the tutorial hall has a pool in it — and sorting the
      // list put that pool last, so the first thing the fixed spacing did was
      // drop a shark into the room where nothing is supposed to be able to hurt
      // anybody. `monstersAllowed` guards themes rather than the world's edge.
      .filter((w) => w.floor - w.surface > 150 && w.x1 < builtEnd)
      .slice()
      .sort((a, b) => a.x0 - b.x0);
    let lastAt = -Infinity;
    for (const w of deepEnough) {
      const at = (w.x0 + w.x1) / 2;
      if (at - lastAt < 500) continue;
      if (!monstersAllowed(at)) continue;
      lastAt = at;
      if (rng.next() > 0.9) continue;
      // Off the levers. This pass places by position rather than by anchor, so
      // it was a route by which something could end up sitting on the one piece
      // of ground FR-3 makes the win condition.
      const clear = clearOfFixtures(at);
      placed.push(shark(clear, w.surface + (w.floor - w.surface) * 0.6));
    }
  }

  // The Hollow, at the bottom, on the same terms the mini-bosses were: not
  // jittered, because a boss you could roll a good position for is a boss with
  // a difficulty setting nobody chose.
  if (tuning.finalBoss) {
    // Nothing else is anywhere near it — the chamber is past the end of the
    // world and no placement pass reaches out there — but the sweep is kept
    // because turning the flag off must put the world back exactly as it was.
    const arena = tuning.enemies.hollow.arena + 260;
    for (let i = placed.length - 1; i >= 0; i--) {
      if (Math.abs(placed[i].x - hollowPost) < arena) placed.splice(i, 1);
    }
    placed.push(
      revenant(hollowPost, groundUnder(hollowPost, tuning.room.floorY - 40)),
    );
  }

  // Then fill the walks between them. Slotted so two never roll the same spot
  // and no stretch comes up empty.
  // And fill the walks between them, weighted the other way: the emptier a
  // stretch is, the more likely it is to get something. A slot is tried more
  // than once so an empty corridor can come away with two.
  const from = dungeonStart + 700;
  const slot = (builtEnd - from) / EXTRA_ENEMIES;
  for (let i = 0; i < EXTRA_ENEMIES * 2; i++) {
    const want = Math.round(
      from + slot * ((i % EXTRA_ENEMIES) + 0.15 + rng.next() * 0.7),
    );
    // Bare floor almost always takes one; cluttered ground almost never does.
    if (rng.next() > 1 - clutterAt(want) * 0.85) continue;
    const size = walkerSize(want);
    const dry = clearOfLava(want, size.width);
    if (dry === null) continue;
    const x = clearOfSolid(
      clearOfFixtures(dry),
      tuning.room.floorY,
      size.height,
      size.width,
    );
    if (!survivable(x, size.width)) continue;
    // Asked again about where it ACTUALLY landed. The clearances above can walk
    // a slot several hundred units, which is enough to cross into the parkour.
    if (!monstersAllowed(x)) continue;
    // On the floor, never on a ledge: a goblin cannot climb down off one, so a
    // ledge-bound goblin is a goblin that never joins the fight.
    placed.push(walker(x, groundUnder(x, tuning.room.floorY - 40)));
  }

  // Clear the Warden's ground before it is placed on it.
  //
  // The measurement that prompted this: the worst crowd in the environment —
  // eleven awake at once — was at x=9350, which is where the boss stands. So
  // the one fight in the game that is supposed to be about reading two attacks
  // was being fought through a queue of goblins, and the reading was never the
  // thing that decided it.
  //
  // Everything ordinary inside the arena is removed rather than moved: pushing
  // them out would just pile them at the edge of it, and they would walk back
  // in the moment the player woke them.
  const arena = tuning.enemies.warden.leash + 220;
  for (let i = placed.length - 1; i >= 0; i--) {
    if (Math.abs(placed[i].x - wardenPost) < arena) placed.splice(i, 1);
  }

  // The Warden, last, and NOT jittered. Everything else in the environment
  // reshuffles with the seed (FR-2); the boss does not, because it is part of
  // the geometry — it is what the exit is behind.
  // And the Kiln, on the way out of the fire, on the same terms: not jittered,
  // because a boss that moved with the seed would be a boss you could roll a
  // good position for.
  if (tuning.miniBosses && environmentsBuilt > 1) {
    const arena = tuning.enemies.kiln.leash + 240;
    for (let i = placed.length - 1; i >= 0; i--) {
      if (Math.abs(placed[i].x - kilnPost) < arena) placed.splice(i, 1);
    }
    placed.push(kiln(kilnPost, groundUnder(kilnPost, tuning.room.floorY - 40)));
  }

  // The Warden and its riders, if mini-bosses are switched on. Wrapped rather
  // than returned around: an early return here skipped `rollDrops` as well, and
  // every monster in the game silently stopped paying anything.
  if (tuning.miniBosses) {
    const W = tuning.enemies.warden;
    const post = wardenPost;
    const ground = groundUnder(post, tuning.room.floorY - 40);
    placed.push(warden(post, ground));
    placed.push(rider(-1, post - W.shoulderX, ground - W.shoulderY));
    placed.push(rider(1, post + W.shoulderX, ground - W.shoulderY));
  }

  return rollDrops(placed, seed);
}

/**
 * What each monster is carrying.
 *
 * A flat chance of one stone, for everything that is not the boss; the boss
 * pays gold instead, and does not roll. Applied as a separate pass over the
 * finished roster so the draw order depends only on how many enemies there are
 * and in what order they were placed — not on which branch placed them.
 */
function rollDrops(placed: Enemy[], seed: number): Enemy[] {
  const rng = createRng(deriveSeed(seed, Stream.Drops));
  const L = tuning.loot;
  return placed.map((e) => {
    // Bosses pay gold and do not roll for it. Listed rather than tested one at
    // a time, so adding a boss is adding a line here and not remembering to.
    const bossGold: Partial<Record<Enemy["kind"], number>> = {
      "enemy.warden": L.bossGold,
      "enemy.kiln": tuning.enemies.kiln.gold,
      "enemy.hollow": tuning.enemies.hollow.gold,
      "enemy.revenant": tuning.enemies.revenant.gold,
    };
    const paid = bossGold[e.kind];
    if (paid !== undefined) {
      return { ...e, drop: { gems: 0, gold: paid } };
    }
    // A bee carries nothing. It is one question with one answer and dies
    // whatever you do, so paying for it would pay for standing still.
    if (e.kind === "enemy.bee") {
      rng.next();
      return { ...e, drop: { gems: 0, gold: 0 } };
    }
    // The draw happens for every enemy whether or not it can pay, so the
    // stream stays in step.
    const roll = rng.next();
    return {
      ...e,
      drop: { gems: roll < L.killDropChance ? L.killDropGems : 0, gold: 0 },
    };
  });
}

/**
 * What one chest holds.
 *
 * FR-10.1: the roll is distance-WEIGHTED, never distance-locked. Every band is
 * reachable from every environment, which is what keeps the jackpot possible at
 * the mouth and keeps a deep run supplying the low grades that top-tier recipes
 * permanently need. The floor added to each weight is the whole guarantee — take
 * it out and the tails close, and with them the reason to open a shallow chest.
 *
 * The draw order is fixed and the number of draws per chest is constant. A
 * conditional draw would desynchronise every chest after it the moment the odds
 * were tuned, and with them every stored replay of the run.
 */
/** The four things a chest can be, worst to best. `hidden` promotes by one. */
const TIERS = ["trash", "normal", "better"] as const;

function rollLoot(rng: Rng, environment: number, hidden: boolean): ChestLoot {
  const L = tuning.loot;
  const odds = L.chestOdds;

  // One draw decides the tier. Taken in a fixed order so the same seed always
  // lands in the same band — the order IS part of the table.
  const pick = rng.next();
  let tier: LootTier;
  if (pick < odds.legendary) tier = "legendary";
  else if (pick < odds.legendary + odds.trash) tier = "trash";
  else if (pick < odds.legendary + odds.trash + odds.normal) tier = "normal";
  else tier = "better";

  // A chest that cost a climb comes out one tier up. Legendary is off the
  // ladder in BOTH directions: it is never promoted into, and never out of.
  // Terrain pays skill, and skill buys a reliably good chest rather than the
  // jackpot — otherwise every legendary in the game comes from the same few
  // alcoves and the 5% stops being true.
  if (hidden && L.hiddenPromotesOneTier && tier !== "legendary") {
    const at = TIERS.indexOf(tier);
    tier = TIERS[Math.min(at + 1, TIERS.length - 1)];
  }

  // The second draw always happens, whatever the tier, so the stream stays in
  // step regardless of what the terrain is holding. A legendary does not use
  // its count, but skipping the call would shift every later chest.
  const spread = rng.next();

  if (tier === "legendary") {
    return {
      tier,
      grade: gradeFor(environment),
      gems: 0,
      gold: L.legendaryGold,
      legendary: true,
    };
  }

  const [low, high] = L.chestGems[tier];
  return {
    tier,
    grade: gradeFor(environment),
    // Inclusive of both ends: `spread` is [0, 1), so scaling across the span
    // plus one and flooring gives every value in the range equal weight.
    gems: Math.min(high, low + Math.floor(spread * (high - low + 1))),
    gold: 0,
    legendary: false,
  };
}

/**
 * Where the loot is this run.
 *
 * FR-18.2 — chest positions shuffle, so where loot sits is never memorisable.
 * Density climbs with depth, which is one of the three things distance actually
 * buys; the other two are in `rollLoot`.
 *
 * Slotted then jittered, for the same reason encounters are: drawn freely, two
 * chests eventually roll the same spot and a whole environment eventually comes
 * up empty.
 */
function placeChests(seed: number): Chest[] {
  const rng = createRng(deriveSeed(seed, Stream.Chests));
  const L = tuning.loot;
  const placed: Chest[] = [];

  // Every anchor the terrain offers gets one. The hidden ones — up a ladder,
  // across a pit, at the top of a climb — are the reason to leave the floor at
  // all, so they are placed rather than rolled for.
  terrain.chestAnchors.forEach((a, i) => {
    if (placed.some((c) => Math.abs(c.x - a.x) < CHEST_APART)) return;
    // And never a third in the same stretch. The anchors come from the pieces,
    // and a piece that offers two of them next to a piece that offers one is
    // how a row of three gets laid without anything being wrong pairwise.
    if (crowded(a.x, placed)) return;
    placed.push({
      id: `chest.set.${i + 1}`,
      x: Math.round(a.x),
      y: a.y,
      loot: rollLoot(rng, environmentAt(a.x), a.hidden),
      opened: false,
      locked: false,
    });
  });

  // Then loose chests along the floor, so the walk between set pieces is not
  // empty either.
  //
  // Scaled by how much world there is, rather than by the constant that was
  // right when there was one environment. Left as it was, adding the fire
  // spread the same handful of loose chests over twice the distance and the
  // walk between set pieces went back to being empty.
  const count = L.chestBase + L.chestPerEnvironment * environmentsBuilt;
  const from = dungeonStart + 600;
  const slot = (builtEnd - from) / count;
  for (let i = 0; i < count; i++) {
    const x = clearOfSolid(
      clearOfFixtures(Math.round(from + slot * (i + 0.25 + rng.next() * 0.5))),
      tuning.room.floorY,
      40,
      30,
    );
    // Never on top of another one — but never dropped for it either.
    //
    // Two chests inside one interact reach is two chests that open on one
    // press, and the second press pays out again from the neighbour, which
    // reads exactly like a chest paying twice. The loose one gives way, because
    // the set ones are on anchors the terrain chose for a reason.
    //
    // Nudged rather than skipped: how MANY chests a run has is geometry and
    // must not depend on the shuffle (FR-18.2), and dropping one whenever the
    // roll landed near an anchor made the count wander with the seed. A slot is
    // sixteen hundred units wide, so there is always somewhere to go.
    const clear = nudgeApart(x, placed);
    placed.push({
      id: `chest.loose.${i + 1}`,
      x: clear,
      y: groundUnder(clear, tuning.room.floorY - 40),
      loot: rollLoot(rng, environmentAt(clear), false),
      opened: false,
      locked: false,
    });
  }

  // The Warden's chest. Rolled as HIDDEN, because it is: the deepest thing in
  // the environment and the one nothing lets you reach without a fight. Sealed
  // until the boss is dead — which is what makes the boss the lock rather than
  // an obstacle you can walk around.
  if (tuning.miniBosses) {
    placed.push({
      id: "chest.warden",
      x: wardenPost + 120,
      y: groundUnder(wardenPost + 120, tuning.room.floorY - 40),
      loot: rollLoot(rng, environmentAt(wardenPost), true),
      opened: false,
      locked: true,
      lockedBy: "enemy.warden",
    });
  }

  // And the Hollow's, which is the run's last chest — while it is there to
  // guard it. A sealed chest with nothing holding the key is a chest nobody can
  // ever open.
  if (tuning.finalBoss) {
    placed.push({
      id: "chest.hollow",
      x: hollowPost + 150,
      y: groundUnder(hollowPost + 150, tuning.room.floorY - 40),
      loot: rollLoot(rng, environmentAt(hollowPost), true),
      opened: false,
      locked: true,
      lockedBy: "enemy.revenant",
    });
  }

  // And the Kiln's, on the same terms one environment deeper.
  if (tuning.miniBosses && environmentsBuilt > 1) {
    placed.push({
      id: "chest.kiln",
      x: kilnPost + 130,
      y: groundUnder(kilnPost + 130, tuning.room.floorY - 40),
      loot: rollLoot(rng, environmentAt(kilnPost), true),
      opened: false,
      locked: true,
      lockedBy: "enemy.kiln",
    });
  }

  return placed;
}

/** An empty bag. One counter per grade, so a grade can never be lost to a typo. */
export function emptyCarried(): Carried {
  return {
    gems: new Array(tuning.loot.grades).fill(0),
    gold: 0,
    legendaries: 0,
  };
}

/** Every gem in the bag, whatever its grade. What the HUD counts (FR-22.2). */
export function totalGems(carried: Carried): number {
  return carried.gems.reduce((sum, n) => sum + n, 0);
}

export type RunOptions = {
  /** The server-issued run seed (PRD FR-15.1, ARCH AD-4). */
  seed?: number;
  /**
   * Shortcuts this account has already levered, which are therefore open from
   * the first tick (PRD FR-3.3). Resolved server-side — FR-3.5 makes a
   * shortcut inert for an account that never flicked it, however the player
   * came to know it was there.
   */
  openShortcuts?: readonly string[];
  /**
   * Developer mode. Nothing can end the run: damage never kills and the air
   * never runs out. Everything else — the enemies, the traps, the geometry —
   * behaves exactly as it always does, because a debug mode that also changes
   * the game is not much use for looking at the game.
   */
  god?: boolean;
  /** What the player owns and is carrying down. See `src/config/shop.ts`. */
  loadout?: Loadout;
  /**
   * Run the tutorial hall instead of the dungeon.
   *
   * The hall is a sealed room past the end of the world (see `tutorial` in
   * `src/config/terrain.ts`) with one station per verb. Turning this on moves
   * the spawn there, replaces the procedurally placed encounters and chests
   * with the hall's fixed ones, and starts the lesson machine.
   *
   * It also implies `god`. A tutorial that ends your run because you mistimed
   * your first parry is a tutorial that teaches you to stop playing — the hits
   * still land and still hurt, so the lesson is real, but nothing in here can
   * kill you and the air does not run down.
   */
  tutorial?: boolean;
};

/**
 * The tutorial hall's fixed cast.
 *
 * Placed rather than rolled, and that is the whole point of them. Every other
 * encounter in the game comes out of `placeEncounters(seed)`, which picks what
 * lives where from the ENVIRONMENT — and the hall is past the end of the world,
 * so that lookup would hand a brand new player whatever the fire environment
 * fields. The first monster anybody meets should be the one the game was
 * designed to teach with, which is the goblin: one attack, a long wind-up, and
 * a recovery you can punish.
 */
function tutorialCast(): Enemy[] {
  return [
    goblin(TUT.goblinX, tuning.room.floorY),
    // One each for the stun and the smash. Both of those stations gate on the
    // action rather than on a position — no shape of rock demands a button —
    // so the goblin is there to give the action something to be about, and to
    // make "it froze" and "it hit both sides" things you can see happen.
    goblin(TUT.stunX, tuning.room.floorY),
    goblin(TUT.smashX, tuning.room.floorY),
    // An archer for the parry, because a parry needs something to catch and an
    // arrow is the one attack you can practise from a safe distance. Reflecting
    // it kills the archer outright, which makes the lesson its own reward.
    archer(TUT.archerX, tuning.room.floorY),
  ];
}

/**
 * The hall's one chest.
 *
 * Grade one and a fixed count: a tutorial's payout should be the same for
 * everybody, so it is written down rather than rolled from the seed.
 */
function tutorialChests(): Chest[] {
  return [
    {
      id: "chest.tutorial",
      x: TUT.chestX,
      y: tuning.room.floorY,
      loot: { tier: "normal", grade: 1, gems: 4, gold: 0, legendary: false },
      opened: false,
      locked: false,
    },
  ];
}

/**
 * A fresh run.
 *
 * @param airTicks starting air. Defaults to the base tank (PRD FR-17.1);
 *   the real value comes from the player's upgrades, resolved server-side.
 */
export function createInitialState(
  airTicks: number = tuning.air.base,
  options: RunOptions = {},
): SimState {
  const teaching = options.tutorial ?? false;
  return {
    tick: 0,
    felledTick: null,
    tutorial: teaching
      ? { step: "walk" as const, ticks: 0, justPassed: false }
      : null,
    air: airTicks,
    airCapacity: airTicks,
    // All inside the cave. Nothing waits for you in the open, and nothing is
    // worth taking out there either.
    enemies: teaching
      ? tutorialCast()
      : placeEncounters(options.seed ?? DEFAULT_SEED),
    chests: teaching
      ? tutorialChests()
      : placeChests(options.seed ?? DEFAULT_SEED),
    // Fixed geometry, so every run starts with all of them idle and armed.
    traps: terrain.traps.map((t) => ({
      id: t.id,
      phase: "idle" as const,
      ticks: 0,
    })),
    arrows: [],
    eruptions: [],
    inArena: false,
    nextArrowId: 1,
    carried: emptyCarried(),
    // The tutorial implies it: see `RunOptions.tutorial`.
    god: (options.god ?? false) || teaching,
    loadout: options.loadout ?? EMPTY_LOADOUT,
    potions: potionsFor(options.loadout ?? EMPTY_LOADOUT),
    buffs: { haste: 0, venom: 0, milk: 0, shield: 0 },
    // Already inside. The hall has no mouth to walk in through, and a tutorial
    // that will not start until you have found the entrance is a tutorial that
    // needs a tutorial.
    entered: teaching,
    enteredTick: teaching ? 0 : null,
    endedTick: null,
    deepestX: teaching ? TUT.spawnX : tuning.room.entranceX,
    environment: 0,
    openShortcuts: options.openShortcuts ?? [],
    leversFlicked: [],
    events: [],
    player: {
      x: teaching ? TUT.spawnX : tuning.room.playerSpawnX,
      y: tuning.room.floorY,
      vx: 0,
      vy: 0,
      facing: 1,
      stance: "grounded",
      dashTicks: 0,
      dashCooldown: 0,
      riding: null,
      ridingWhich: null,
      wallDir: 0,
      wallCoyote: 0,
      wallLaunch: 0,
      running: false,
      hp: statsFor(options.loadout ?? EMPTY_LOADOUT).maxHp,
      action: { kind: null, elapsed: 0, lockout: 0, variant: 0 },
      struck: [],
      burning: 0,
      poisoned: 0,
      breath: tuning.swim.bubbles * tuning.swim.bubbleTicks,
      nextAttack: 0,
      comboWindow: 0,
    },
    outcome: "running",
    previousIntents: Intent.None,
  };
}

/**
 * Re-run a recorded input log from the start.
 *
 * This is the whole point of the pure core: the server can call this on a
 * submitted log and see what actually happened (PRD FR-15.7, ARCH AD-7).
 * Ticks with no recorded entry replay as "no intents held".
 */
export function replay(
  log: readonly InputRecord[],
  airTicks?: number,
  options: RunOptions = {},
): SimState {
  let state = createInitialState(airTicks, options);
  if (log.length === 0) return state;

  const byTick = new Map<number, Intents>();
  for (const record of log) byTick.set(record.tick, record.intents);

  // HELD FORWARD, not reset between entries.
  //
  // The client records a tick only when what is held CHANGES — anything else
  // would be sixty entries a second and a twenty-minute run would submit a
  // seventy-two-thousand-entry array. So a gap in the log means "still holding
  // the same keys", and filling gaps with nothing replayed a player who let go
  // of everything between every keystroke. That is not a subtle difference: it
  // is a different run, and it would have failed EVERY honest submission while
  // looking exactly like the anti-cheat working.
  let held: Intents = Intent.None;

  // And PAST the last entry, until the run actually ends.
  //
  // The last thing a log records is the last time the keys changed, which is
  // usually a long way before the run finishes — a player who turns for the
  // mouth and holds left logs nothing for the whole walk home. Stopping at the
  // final entry stops the replay somewhere in the middle of the tunnel, and the
  // run being verified never extracts, never banks, and scores nothing.
  const lastTick = log[log.length - 1].tick;
  for (let t = 0; t <= lastTick; t++) {
    if (byTick.has(t)) held = byTick.get(t)!;
    state = step(state, held);
  }
  // The tail, with the last keys still down. Bounded because a run that never
  // entered the dungeon has no clock running and would otherwise loop forever.
  for (let t = 0; t < REPLAY_TAIL && state.outcome === "running"; t++) {
    state = step(state, held);
  }
  return state;
}

/**
 * How far past the end of the log a replay will keep going.
 *
 * Twenty minutes, matching the speed board's ceiling. It is a bound on work
 * rather than a rule about runs: the loop stops the moment the outcome stops
 * being "running", and this only decides how long it waits for a run that never
 * ends at all.
 */
const REPLAY_TAIL = 60 * 60 * 20;
