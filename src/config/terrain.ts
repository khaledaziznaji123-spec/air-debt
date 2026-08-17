/**
 * Environment 1, laid out.
 *
 * PRD FR-2 puts terrain in the half of the dungeon that does NOT reshuffle: the
 * rooms, the ledges, the pits and the ladders are fixed, and only the encounters
 * and chests move between runs. So nothing here takes the run seed. It is
 * derived from position instead, which makes it stable across runs, stable
 * across devices, and free — a fifty-thousand-unit dungeon does not need fifty
 * thousand units of data to be the same every time.
 *
 * All five are built now.
 *
 * Each has its own rotation of set pieces and its own idea of what the ground
 * is for, because a environment built from the same rotation with a different
 * palette is a recolour rather than a place:
 *
 *   1  rock       machinery, pits, and things that swing
 *   2  fire       the floor is lava and more of it comes down at you
 *   3  water      a beach that becomes an ocean; you swim, and you dive
 *   4  parkour    no monsters at all — the level IS the enemy
 *   5  poison     everything that touches you leaves something behind
 *
 * They share the piece machinery and nothing else.
 *
 * Determinism: this module is reachable from `src/sim`, so it obeys the same
 * rules — no `Math.random`, no transcendentals, no wall clock. The hash below is
 * integer arithmetic only.
 */

import { tuning } from "./tuning.ts";
import {
  dungeonStart,
  environmentAt,
  environmentStart,
  geyserId,
  interactReach,
  shortcutById,
  highRoadId,
  shortcuts,
  themeAt,
  themeEnd,
  themeStart,
  type Theme,
} from "./dungeon.ts";

/**
 * How many environments actually exist. The design's five are a time budget;
 * this is the content.
 */
export const environmentsBuilt = 5;

/** Where the built world stops. Walking past it is walking into nothing. */
export const builtEnd = environmentStart(environmentsBuilt);

/**
 * The way out at the far end.
 *
 * PRD FR-4.2 — extracting through ANY exit banks the whole run, so the mouth
 * you came in by is not supposed to be the only one. Until now it was, which
 * made a deep run a round trip and the far half of the environment worth half
 * as much as it should be.
 *
 * The wall sits just past it. Without one the player simply kept walking into
 * ground that does not exist and fell out of the world.
 */
export const exitX = builtEnd - 260;

/**
 * The Warden's ground: the throat at the end of environment 1.
 *
 * It used to be the exit, because environment 1 was the whole world. Now that
 * there is somewhere past it, the same spot is the GATE — the mini-boss is what
 * stands between the rock and the fire, which is a better job for it than
 * standing on the way out. The arithmetic is unchanged, so nothing about
 * environment 1 moves: this is the old `exitX`, renamed for what it does now.
 */
export const gateX = environmentStart(1) - 260;

const FLOOR = tuning.room.floorY;

/**
 * A block of solid rock.
 *
 * Everything is solid. Ledges used to be one-way — passed through from below,
 * landed on from above — which is the friendlier default and the wrong one
 * here: a platform you can pop up through is a platform you never have to find
 * a route onto, and the whole point of the terrain is the route.
 *
 * Solid means the underside is a ceiling. The reducer bumps a rising head on it
 * (see `ceilingSurface`), so a jump into the bottom of a ledge stops there
 * rather than passing through and being shoved sideways.
 */
export type Surface = {
  x0: number;
  x1: number;
  /** The standable top. */
  top: number;
  /** How far the mass extends down. Ground goes well past the view. */
  bottom: number;
  oneWay: boolean;
  /** A slab rather than a mass. Drawing only — collision treats both alike. */
  thin: boolean;
  /**
   * Stops shots from BOTH sides, rather than only from above like every other
   * thin slab.
   *
   * For the high road, and for anything else you have to buy with a lever. A
   * thin platform lets a shot through from below on purpose — that is the same
   * rule your own jump plays by, and it is why standing on a ledge is cover
   * rather than immunity. But the fire shortcut is not a ledge you found, it is
   * a road you paid for, and phoenixes hovering under it were shooting straight
   * up through the deck at anyone walking it. A shortcut you cannot be hit on
   * is the entire thing the lever buys.
   */
  shotproof?: boolean;
};

/**
 * A body of water. Inside one you swim instead of walk.
 *
 * `surface` is where the air is: above it you are in the air with your head
 * out, below it you are under and holding your breath. Two heights rather than
 * one because a pool you can stand in the shallow end of and drown in the deep
 * end of is the whole of environment 3.
 */
export type Water = {
  x0: number;
  x1: number;
  /** The waterline. */
  surface: number;
  /** The bottom of it. */
  floor: number;
};

/** Climbable. Vertical input while inside it moves the player up or down. */
export type Ladder = {
  x: number;
  /** The rung the player can stand off at. */
  top: number;
  /** The foot of it. */
  bottom: number;
};

/** Static hazard. No tell, because it never changes — it is simply there. */
export type Spikes = {
  x0: number;
  x1: number;
  /** The tip height. Touching at or below this hurts. */
  top: number;
  /**
   * Drawing only. Lava and iron spikes are the same rule — fall in and you are
   * put back on the edge on your last bar — and the reducer must not care which
   * it is, or environment 2 would need its own copy of the pit code.
   */
  lava?: boolean;
  /**
   * Same rule again, third face. A sump leaves poison on you the way lava
   * leaves fire; the pit code itself does not know the difference.
   */
  poison?: boolean;
};

/**
 * A pressure plate. PRD FR-18.5: it shows its tell before it fires, and the
 * tell is long enough to react to — a trap that cannot be answered is a tax on
 * the air rather than a thing to play around.
 */
export type Trap = {
  id: string;
  x: number;
  halfWidth: number;
  /** The surface it is set into. */
  top: number;
};

/**
 * A moving hazard: the swinging blade, the ceiling crusher, the sliding saw.
 *
 * All three are pure functions of the tick. That is the whole design of them —
 * no state in `SimState`, nothing to persist, nothing to desynchronise, and the
 * renderer and the reducer compute the identical position from the identical
 * number. A hazard whose phase lived in state would be one more thing a replay
 * could disagree about.
 *
 * It also means they are readable BEFORE they are dangerous: the cycle runs
 * whether or not anyone is watching, so a player can stand and learn the rhythm
 * rather than discovering it by being hit. That is the same bargain the goblin's
 * telegraph makes (FR-6.1), spent on the terrain instead of on a monster.
 */
export type HazardKind = "pendulum" | "crusher" | "saw" | "flow";

// There was a fifth: `steam`, a jet out of a broken pipe in the sea. It is
// gone. A horizontal jet on a timer is a thing you wait out, and waiting is the
// one thing the water already charges you for — the air runs double down there,
// so a hazard whose answer is "hold still for two seconds" was asking the
// player to spend the resource the environment is about. The sharks are the
// water's threat. It does not need a second one that is worse at it.

export type Hazard = {
  id: string;
  kind: HazardKind;
  /** The anchor: ceiling for a pendulum and a crusher, floor for a saw. */
  x: number;
  y: number;
  /** Ticks for one full cycle. */
  period: number;
  /** Where in the cycle this one starts, so neighbours never move together. */
  offset: number;
  /** Travel: arc width for a pendulum and a saw, drop distance for a crusher. */
  span: number;
  /** Arm length for a pendulum, blade radius for a saw, block height otherwise. */
  size: number;
};

export type HazardBox = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  /** 0..1 through the cycle, for the view to draw the tell and the chain. */
  phase: number;
  /** Live only while this is true — a retracted crusher hurts nothing. */
  armed: boolean;
};

/** Where a hazard is, and whether it bites, at a given tick. */
export function hazardAt(h: Hazard, tick: number): HazardBox {
  const f = (((tick + h.offset) % h.period) + h.period) % h.period;
  const phase = f / h.period;

  if (h.kind === "crusher") {
    // Hangs, tells, slams, holds, retracts. The tell is the only part that is
    // not linear, because it is the part the player is reading.
    const drop =
      phase < 0.55
        ? 0
        : phase < 0.72
          ? 0
          : phase < 0.79
            ? (phase - 0.72) / 0.07
            : phase < 0.88
              ? 1
              : 1 - (phase - 0.88) / 0.12;
    const top = h.y + drop * h.span;
    return {
      left: h.x - h.size,
      right: h.x + h.size,
      top,
      bottom: top + 44,
      phase,
      armed: phase >= 0.72 && phase < 0.9,
    };
  }

  if (h.kind === "flow") {
    // A curtain of lava out of the roof: dry, then a run of drips as the lip
    // fills, then the pour, then dry again. The drip is the whole point — it is
    // the half-second that turns a wall of fire into something you walk through
    // the gap in, and it is why the curtains are authored out of step.
    const pour = phase >= 0.42 && phase < 0.76;
    return {
      left: h.x - h.size,
      right: h.x + h.size,
      top: h.y,
      bottom: h.y + h.span,
      phase,
      armed: pour,
    };
  }

  // Both of the travelling hazards sweep out and back on a triangle.
  const sweep = phase < 0.5 ? phase * 2 : 2 - phase * 2;
  const across = (sweep * 2 - 1) * (h.span / 2);

  if (h.kind === "saw") {
    return {
      left: h.x + across - h.size,
      right: h.x + across + h.size,
      top: h.y - h.size * 2,
      bottom: h.y,
      phase,
      armed: true,
    };
  }

  // Pendulum. The blade is lowest at the middle of the swing and highest at
  // each end — a parabola, which is both what a pendulum does and the only
  // shape available without trigonometry.
  const sag = 1 - (sweep * 2 - 1) * (sweep * 2 - 1);
  const drop = h.size * (0.62 + 0.38 * sag);
  return {
    left: h.x + across - 26,
    right: h.x + across + 26,
    top: h.y + drop - 30,
    bottom: h.y + drop + 26,
    phase,
    armed: true,
  };
}

/** Somewhere a chest or a monster can legally stand. */
export type Anchor = {
  x: number;
  y: number;
  /** Off the main floor — up a ladder or across a jump. Worth more. */
  hidden: boolean;
};

export type Terrain = {
  surfaces: readonly Surface[];
  water: readonly Water[];
  ladders: readonly Ladder[];
  spikes: readonly Spikes[];
  traps: readonly Trap[];
  hazards: readonly Hazard[];
  /** Places a chest may be placed. */
  chestAnchors: readonly Anchor[];
  /** Places a monster may be placed. Floor only — goblins do not climb. */
  enemyAnchors: readonly Anchor[];
};

/** Stable pseudo-random from an integer. Integer ops only (see the header). */
function hash(i: number): number {
  let t = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  t ^= t >>> 13;
  t = Math.imul(t, 0xc2b2ae35);
  return ((t ^ (t >>> 16)) >>> 0) / 4294967296;
}

/**
 * A smooth periodic wave in -1..1, built from a triangle and a smoothstep.
 *
 * `Math.sin` would read better and is banned: transcendentals are
 * implementation-defined, and the roof is now real collision rather than
 * scenery — two devices disagreeing about where the ceiling is would be two
 * devices disagreeing about whether a jump hit it.
 */
export function wave(x: number, period: number, phase: number): number {
  const f = (((x / period + phase) % 1) + 1) % 1;
  const t = f < 0.5 ? f * 2 : 2 - f * 2;
  return t * t * (3 - 2 * t) * 2 - 1;
}

/**
 * How high the tunnel roof hangs, and the underside of it at a given x.
 *
 * This lives here rather than in the renderer because it is geometry now: the
 * player's head stops at it. A roof the view drew and the simulation did not
 * know about was a roof the player flew straight through from a tall ledge.
 *
 * The swell is two waves at different wavelengths, so the tunnel opens and
 * closes as you run through it rather than being a corridor of one height. The
 * throat term is what makes the roof MEET the mouth: at the threshold it hangs
 * to the drawn crown's level and lifts away over the first stretch inside.
 */
export const CEILING_Y = 106;

/**
 * How much higher the roof hangs in a given environment.
 *
 * The rock and the fire are corridors: the ceiling is close, and that is most
 * of why they feel like tunnels. The water and the parkour are not corridors —
 * one is an ocean and the other is a set of towers — and both were being drawn
 * inside the same low tube, which capped how far up either of them could go.
 *
 * Subtracted from the roof's y, so a bigger number is more sky.
 */
function headroomFor(theme: Theme): number {
  switch (theme) {
    case "water":
      // The sea. Room above the waterline for a shore that recedes, and for a
      // sky to breach up into.
      return 170;
    case "parkour":
      // The tallest thing in the game. Every route here is vertical, so the
      // roof has to be somewhere a chain of wall jumps can actually reach
      // rather than a lid two kicks up.
      return 260;
    default:
      return 0;
  }
}

export function roofAt(x: number): number {
  const into = Math.min(Math.max((x - dungeonStart) / 260, 0), 1);
  return (
    CEILING_Y +
    16 * wave(x, 1194, 0) +
    9 * wave(x, 383, 0.34) +
    hash(Math.floor(x / 14) + 9100) * 10 +
    (1 - into) * 62 -
    headroomFor(themeAt(x))
  );
}

/** The lowest the roof ever reaches, so ledge heights can be checked against it. */
export const ROOF_LOWEST = CEILING_Y + 16 + 9 + 10;

/**
 * How far below the floor the rock is drawn and collided as solid.
 *
 * Generous, because a pit's bed is a surface like any other and the mass under
 * it has to reach past the deepest thing anyone digs. The sea's bed goes three
 * hundred and sixty down and the parkour's shafts three hundred and forty, so
 * this has to clear both by a wide margin or the world has a hole under it.
 */
const DEEP = 900;

/**
 * Set pieces are spaced by this. Roughly three seconds of walking, so the
 * player is never more than a moment from something to do — and never in the
 * middle of two things at once.
 */
const PIECE_SPACING = 560;

/** Kept clear at the mouth so the first thing inside is not a pit. */
const ENTRY_RUN = 900;

/**
 * How high a ledge can sit above the surface below it and still be reachable.
 *
 * A jump rises `jumpImpulse^2 / (2 * gravity)` = 183 units, so this is a
 * deliberate margin under that. Authoring a ledge the player cannot reach is
 * the single easiest mistake to make here, and `checkTerrain` fails the build
 * over it rather than leaving it to be discovered at the top of a run.
 */
export const MAX_STEP_UP = 132;

function ledge(x0: number, x1: number, top: number): Surface {
  return { x0, x1, top, bottom: top + 26, oneWay: false, thin: true };
}

function block(x0: number, x1: number, top: number): Surface {
  return { x0, x1, top, bottom: FLOOR + DEEP, oneWay: false, thin: false };
}

/**
 * Whether a stretch is clear of the fixed fixtures.
 *
 * A trench through a shortcut door, or a ledge over a lever, would make a piece
 * of permanent progress unreachable — and FR-3 makes that ground the win
 * condition, so it cannot be blocked by scenery.
 */
/**
 * The escape shafts.
 *
 * Two per environment — one at its middle, one at its end — and each one is a
 * hole in the roof with a rope down it that banks the run where you stand.
 *
 * They exist because of a shape the design had and did not want: everything you
 * pick up has to be carried back out past everything that has already tried to
 * kill you once, and with only the mouth and the far door that meant the middle
 * of environment three was a forty-second walk from anywhere safe. That is not
 * tension, it is a commute — the decision "do I go deeper" had already been
 * made and the walk back was just the price of having made it.
 *
 * What they deliberately do NOT do is shorten the way IN. You still walk every
 * metre of the way down; the shafts only ever go up. That is the difference
 * between this and a shortcut, and it is why they cost no lever: a shortcut is
 * permanent progress you earn once (FR-3), and this is a door marked EXIT.
 *
 * Computed before `clearOfFixtures` and with a check of their own, because that
 * function has to know about them — the pieces must not lay a lava pool at the
 * foot of one — and a shaft that asked it where to go would be asking a
 * question that depended on the answer.
 */
export const escapes: readonly number[] = (() => {
  const out: number[] = [];
  /** Clear of the things that were here before the shafts were. */
  const roomy = (at: number) => {
    const pad = interactReach + 120;
    for (const s of shortcuts) {
      for (const fixture of [s.fromX, s.toX, s.leverX]) {
        if (Math.abs(at - fixture) < pad) return false;
      }
    }
    if (Math.abs(at - gateX) < 420) return false;
    if (Math.abs(at - exitX) < 620) return false;
    return !out.some((o) => Math.abs(o - at) < 1200);
  };
  for (let e = 0; e < environmentsBuilt; e++) {
    const start = environmentStart(e);
    const end = environmentStart(e + 1);
    for (const at of [start + (end - start) / 2, end - 520]) {
      let x = Math.round(at);
      for (let step = 60; step <= 1200 && !roomy(x); step += 60) {
        x = Math.round(at) + (Math.floor(step / 60) % 2 === 0 ? step : -step);
      }
      out.push(x);
    }
  }
  return out;
})();

/**
 * The high road: the fire's shortcut, laid as terrain.
 *
 * A ledge running the length of the ground the shortcut skips, two hundred and
 * forty units up, over everything. It is there from the very first run and it
 * is visible from below the whole way — FR-3.1 wants a shortcut legible from
 * the near side, and this is the most legible one in the game: you can see the
 * road you are not allowed on.
 *
 * The lever does not build it. The lever arms the vent at the near end that
 * throws you up onto it, which is the difference between "there is a way" and
 * "you may use it".
 */
export function highRoad(): { x0: number; x1: number; top: number } | null {
  const s = shortcutById.get(highRoadId);
  if (!s) return null;
  return { x0: s.fromX - 40, x1: s.toX + 40, top: FLOOR - 250 };
}

/** The escape shaft within reach, or null. */
export function escapeAt(x: number): number | null {
  for (const e of escapes) {
    if (Math.abs(x - e) <= interactReach) return e;
  }
  return null;
}

function clearOfFixtures(x0: number, x1: number): boolean {
  const pad = interactReach + 60;
  for (const s of shortcuts) {
    for (const fixture of [s.fromX, s.toX, s.leverX]) {
      if (x1 + pad >= fixture && x0 - pad <= fixture) return false;
    }
  }
  // And the gate. The Warden needs floor to fight on: a lava trench laid
  // through its arena would decide the fight by geometry, and a boss you win by
  // walking it into a hole is not the boss anyone designed.
  if (x1 + 320 >= gateX && x0 - 520 <= gateX) return false;
  // And the doorstep of the exit, for a plainer reason: the fire laid a pool of
  // lava across the last hundred and fifty units before the way out, so a run
  // that had survived the whole environment fell in the moment it could see the
  // door. Banking a run is not a place for one more hazard.
  if (x1 + 200 >= exitX && x0 - 560 <= exitX) return false;
  // And the drowned passage, mouths and all. The pieces do not know it is
  // there, and a beach boulder laid across its entrance is a wall in front of
  // the only way through the environment — which is exactly what happened, and
  // what a bot walking east found before it found the water.
  {
    const pass = drownedPassage();
    if (x1 > pass.x0 - 420 && x0 < pass.x1 + 420) return false;
  }
  // And each escape shaft, which needs flat floor under it and clear air above
  // it. A shaft with a lava pool at the foot of it is a way out you cannot
  // reach, which is worse than not having one.
  for (const e of escapes) {
    if (x1 + 150 >= e && x0 - 150 <= e) return false;
  }
  // And each geyser vent, which needs flat floor to stand on and clear air to
  // throw through. Only the vents themselves — the rest of the chain's span
  // keeps its pieces, because the ground being worth skipping is the entire
  // reason the shortcut is worth anything.
  for (const vent of geyserVents) {
    if (x1 + 150 >= vent && x0 - 150 <= vent) return false;
  }
  return true;
}

type Piece = (at: number, index: number, out: Mutable) => void;

type Mutable = {
  surfaces: Surface[];
  water: Water[];
  ladders: Ladder[];
  spikes: Spikes[];
  traps: Trap[];
  hazards: Hazard[];
  chestAnchors: Anchor[];
  enemyAnchors: Anchor[];
  /** Stretches where the ground is cut away, as [x0, x1]. */
  cuts: Array<[number, number]>;
};

/** Three rising ledges and a chest on the top one. Pure climb. */
const stair: Piece = (at, i, out) => {
  // 70 a step rather than 118: the floor came up, and the top of three steps
  // has to stay clear of the roof by a standing player's height.
  const step = 70;
  for (let n = 0; n < 3; n++) {
    const x0 = at + n * 150;
    out.surfaces.push(ledge(x0, x0 + 130, FLOOR - step * (n + 1)));
  }
  out.chestAnchors.push({
    x: at + 2 * 150 + 65,
    y: FLOOR - step * 3,
    hidden: true,
  });
  out.enemyAnchors.push({ x: at - 90, y: FLOOR, hidden: false });
};

/**
 * A blade swinging across the corridor, and two ledges to time the crossing
 * from. The blade is the reason to stand still and watch — the ledges are what
 * make waiting a position rather than a pause.
 */
const swing: Piece = (at, i, out) => {
  out.surfaces.push(ledge(at - 30, at + 90, FLOOR - 88));
  out.surfaces.push(ledge(at + 300, at + 420, FLOOR - 88));
  out.hazards.push({
    id: `hazard.swing.${i}`,
    kind: "pendulum",
    x: at + 195,
    y: roofAt(at + 195),
    period: 132,
    offset: i * 37,
    span: 250,
    size: FLOOR - roofAt(at + 195) - 70,
  });
  out.chestAnchors.push({ x: at + 360, y: FLOOR - 88, hidden: true });
  out.enemyAnchors.push({ x: at + 470, y: FLOOR, hidden: false });
};

/**
 * A ceiling block that drops on a tell. Under it is the only way past, so the
 * piece is a question about timing rather than about route — and the ledge
 * beside it is where the answer is worked out from.
 */
const crush: Piece = (at, i, out) => {
  out.surfaces.push(ledge(at - 40, at + 80, FLOOR - 96));
  for (let n = 0; n < 2; n++) {
    out.hazards.push({
      id: `hazard.crush.${i}.${n}`,
      kind: "crusher",
      x: at + 170 + n * 190,
      y: roofAt(at + 170 + n * 190),
      period: 168,
      // The pair is deliberately out of step: crossing under both in one run is
      // the whole trick, and two that slammed together would be one obstacle.
      offset: i * 23 + n * 84,
      span: FLOOR - roofAt(at + 170 + n * 190) - 52,
      size: 46,
    });
  }
  out.chestAnchors.push({ x: at + 20, y: FLOOR - 96, hidden: true });
  out.enemyAnchors.push({ x: at + 420, y: FLOOR, hidden: false });
};

/** A saw running a track along the floor. Jump it, or stand on the island. */
const saw: Piece = (at, i, out) => {
  out.surfaces.push(ledge(at + 130, at + 240, FLOOR - 104));
  out.hazards.push({
    id: `hazard.saw.${i}`,
    kind: "saw",
    x: at + 185,
    y: FLOOR,
    period: 150,
    offset: i * 41,
    span: 300,
    size: 30,
  });
  out.chestAnchors.push({ x: at + 185, y: FLOOR - 104, hidden: true });
  out.enemyAnchors.push({ x: at + 380, y: FLOOR, hidden: false });
};

/** A trench with spikes in it. Jump it, or pay for not jumping. */
const pit: Piece = (at, i, out) => {
  const width = 190 + Math.round(hash(i * 17) * 90);
  const depth = 150;
  out.cuts.push([at, at + width]);
  out.surfaces.push({
    x0: at,
    x1: at + width,
    top: FLOOR + depth,
    bottom: FLOOR + DEEP,
    oneWay: false,
    thin: false,
  });
  out.spikes.push({
    x0: at + 14,
    x1: at + width - 14,
    top: FLOOR + depth - 16,
  });
  // A ledge partway across, so the pit is crossable in two hops as well as one.
  out.surfaces.push(
    ledge(at + width / 2 - 34, at + width / 2 + 34, FLOOR - 96),
  );
  out.enemyAnchors.push({ x: at + width + 120, y: FLOOR, hidden: false });
};

/**
 * A spiked shaft under a floating platform. The only way on is up the walls.
 *
 * Every other pit in here is 150 deep against a 183-unit jump, which means the
 * floor of it is a place you bounce off on the way out — the spikes are a toll,
 * not a problem. This one is 300. A jump does not touch it. The walls do:
 * pressed into either face you slide instead of fall, and two kicks off them
 * clears the rim.
 *
 * That makes it the first piece in the dungeon that a movement option is
 * REQUIRED for rather than merely useful in, which is the whole reason to build
 * it. A mechanic no level asks for is a mechanic nobody learns.
 *
 * The platform overhead is the target. Falling in and looking up, there is
 * somewhere to be — and the chest on it is the argument for going there rather
 * than sprinting the gap in the first place.
 */
const shaft: Piece = (at, i, out) => {
  const width = 200;
  // Deeper than a standing jump AND one kick off the wall put together.
  //
  // The first version was 300, which looked comfortably past the 183 a jump
  // clears — and was escapable in a single kick, because the player jumps off
  // the floor of the shaft first and the two rises add: 183 + 163 = 346. So the
  // number that matters is that sum, not the jump. At 420 it takes the jump and
  // two kicks, which is a chain rather than a lucky bounce.
  const depth = 420;

  out.cuts.push([at, at + width]);
  out.surfaces.push({
    x0: at,
    x1: at + width,
    top: FLOOR + depth,
    bottom: FLOOR + DEEP,
    oneWay: false,
    thin: false,
  });
  out.spikes.push({
    x0: at + 12,
    x1: at + width - 12,
    top: FLOOR + depth - 16,
  });

  // The floating platform, hanging over the far lip so it can be landed on
  // from inside the shaft but is a real jump from the near rim.
  out.surfaces.push(ledge(at + width - 70, at + width + 130, FLOOR - 122));
  out.chestAnchors.push({ x: at + width + 60, y: FLOOR - 122, hidden: true });
  out.enemyAnchors.push({ x: at + width + 250, y: FLOOR, hidden: false });
};

/** A raised block with an overhanging ledge — jump on, jump up, jump off. */
const shelf: Piece = (at, i, out) => {
  const top = FLOOR - 104;
  out.surfaces.push(block(at, at + 240, top));
  out.surfaces.push(ledge(at + 180, at + 330, top - 116));
  out.chestAnchors.push({ x: at + 120, y: top, hidden: false });
  out.enemyAnchors.push({ x: at + 300, y: FLOOR, hidden: false });
  out.traps.push({
    id: `trap.${i}`,
    x: at + 120,
    halfWidth: 46,
    top,
  });
};

/**
 * A ladder to an alcove. The chest up there is the secret: nothing about the
 * ground below says it is there, and the only way to find out is to climb.
 */
const tower: Piece = (at, i, out) => {
  // Was 296. The alcove is the highest standable thing in the environment, so
  // it is what the roof clearance is really sized against.
  const shelfTop = FLOOR - 220;
  const hole = at + 30;
  out.ladders.push({ x: hole, top: shelfTop, bottom: FLOOR });
  // The platform is split around the ladder. Solid platforms mean a climber
  // bumps their head on the underside, so a ladder that ran into an unbroken
  // shelf would stop dead a body's height below the top of itself.
  out.surfaces.push(ledge(at - 20, hole - 26, shelfTop));
  out.surfaces.push(ledge(hole + 26, at + 250, shelfTop));
  out.chestAnchors.push({ x: at + 170, y: shelfTop, hidden: true });
  out.enemyAnchors.push({ x: at + 150, y: FLOOR, hidden: false });
};

/** A run of stepping stones over open ground. Rhythm rather than obstacle. */
const stones: Piece = (at, i, out) => {
  // Three, not four. The fourth pushed the plate past the piece's own footprint
  // and under the NEXT piece's ledge, which made it unstandable again — the
  // same failure the comment below is about, arriving from the other side.
  for (let n = 0; n < 3; n++) {
    const x0 = at + n * 132;
    const lift = 92 + (n % 2) * 54;
    out.surfaces.push(ledge(x0, x0 + 84, FLOOR - lift));
  }
  // Past the stones, on open floor. It used to sit at `at + 306`, which is
  // directly under the third stone — and a stone hangs 92 above the floor with
  // an 82-tall player under it, so standing on that plate shoved you sideways
  // out from under the ledge. The plate was unstandable, which means the trap
  // could not fire the way it was designed to. `checkTerrain` now asserts this.
  out.traps.push({
    id: `trap.${i}`,
    x: at + 430,
    halfWidth: 52,
    top: FLOOR,
  });
  out.enemyAnchors.push({ x: at + 60, y: FLOOR, hidden: false });
  out.enemyAnchors.push({ x: at + 420, y: FLOOR, hidden: false });
};

/**
 * A low lintel across the corridor. Standing height does not fit; a slide does.
 *
 * The gap is sized off `slideHeightScale` rather than typed in, so tuning the
 * slide can never quietly seal the corridor — `checkTerrain` asserts the same
 * relationship from the other side.
 */
const duck: Piece = (at, i, out) => {
  const gap = tuning.player.height * tuning.movement.slideHeightScale + 14;
  out.surfaces.push({
    x0: at + 90,
    x1: at + 250,
    top: FLOOR - 240,
    bottom: FLOOR - gap,
    oneWay: false,
    thin: false,
  });
  // A chest on top of it, reachable the long way round rather than by ducking.
  out.chestAnchors.push({ x: at + 170, y: FLOOR - 240, hidden: true });
  out.surfaces.push(ledge(at + 290, at + 400, FLOOR - 120));
  out.enemyAnchors.push({ x: at + 40, y: FLOOR, hidden: false });
};

/** Flat ground, monsters, and a chest in the open. The floor of the rotation. */
const yard: Piece = (at, i, out) => {
  out.chestAnchors.push({ x: at + 130, y: FLOOR, hidden: false });
  out.enemyAnchors.push({ x: at, y: FLOOR, hidden: false });
  out.enemyAnchors.push({ x: at + 230, y: FLOOR, hidden: false });
  out.enemyAnchors.push({ x: at + 420, y: FLOOR, hidden: false });
};

/**
 * The rotation. Fixed order rather than a hashed pick.
 *
 * A hash over the ~14 slots an environment has room for is not a distribution,
 * it is a small sample: the first draft rolled four yards, two pits and no
 * ladder at all, which is a whole mechanic that simply never appeared. A
 * rotation guarantees every piece is present and every piece is spaced.
 *
 * Ordered so neighbours differ in kind — a climb, then a gap, then a fight,
 * then a climb of a different sort — and repeating on a period long enough
 * (~8 pieces, roughly twenty seconds of ground) that it reads as a place with
 * motifs rather than as a loop.
 */
const PIECES: Piece[] = [
  yard,
  stones,
  stair,
  swing,
  duck,
  pit,
  tower,
  crush,
  // Straight after the rams, so the shaft is the thing on the far side of them.
  shaft,
  saw,
  shelf,
];

// ---------------------------------------------------------------------------
// Environment 2 - the fire.
//
// Two rules run through all of it. Lava on the FLOOR is a pit: fall in and the
// pit rule puts you back on the edge on your last bar, which is why every pool
// below is pushed through `spikes` rather than through some new hazard of its
// own. Lava from the ROOF is a hazard: it runs on a cycle you can read and it
// costs half a bar, the same as every plate in environment 1.
//
// So the fire adds no new way to be hurt. What it adds is that the ground is
// now the thing trying to kill you, and every piece here is a question about
// where to put your feet rather than about when to swing.
// ---------------------------------------------------------------------------

/** A pool of it, cut into the floor. */
function pool(out: Mutable, x0: number, x1: number, depth: number): void {
  out.cuts.push([x0, x1]);
  out.surfaces.push({
    x0,
    x1,
    top: FLOOR + depth,
    bottom: FLOOR + DEEP,
    oneWay: false,
    thin: false,
  });
  out.spikes.push({
    x0: x0 + 10,
    x1: x1 - 10,
    top: FLOOR + depth - 22,
    lava: true,
  });
}

/**
 * Curtains of lava out of the roof, deliberately out of step.
 *
 * Two of them, on the same period and half a cycle apart, so one or two are
 * pouring at any moment and never the same one twice running. Between them is a
 * shelf, which is what makes the piece a rhythm rather than a wall: you get on
 * it, you watch one cycle, and then you know.
 */
const flowfall: Piece = (at, i, out) => {
  // Two or three of them, and never at quite the same spacing. A set piece that
  // is identical every time it comes round is a set piece the player stops
  // looking at, and the fire's rotation comes round twice in one environment.
  const count = 2 + (hash(i * 5) > 0.6 ? 1 : 0);
  const gap = 190 + Math.round(hash(i * 11) * 80);
  for (let n = 0; n < count; n++) {
    const x = at + 110 + n * gap;
    out.hazards.push({
      id: "hazard.flow." + i + "." + n,
      kind: "flow",
      x,
      y: roofAt(x),
      period: 210 + Math.round(hash(i * 3) * 90),
      offset: i * 41 + n * 123,
      span: FLOOR - roofAt(x),
      size: 34,
    });
  }
  out.surfaces.push(ledge(at + 232, at + 318, FLOOR - 92));
  out.chestAnchors.push({ x: at + 275, y: FLOOR - 92, hidden: true });
  out.enemyAnchors.push({ x: at + 470, y: FLOOR, hidden: false });
};

/** A pool with basalt standing out of it. Two hops, or one long one. */
const lavapit: Piece = (at, i, out) => {
  // Two pillars or three, over a pool that is never the same width twice.
  const pillars = 2 + (hash(i * 7) > 0.55 ? 1 : 0);
  const spacing = 100 + Math.round(hash(i * 13) * 26);
  const width = 78 * 2 + (pillars - 1) * spacing + 52;
  pool(out, at, at + width, 120 + Math.round(hash(i * 17) * 40));
  for (let n = 0; n < pillars; n++) {
    const x0 = at + 78 + n * spacing;
    out.surfaces.push(
      block(x0, x0 + 52, FLOOR - 22 - Math.round(hash(i + n) * 16)),
    );
  }
  out.enemyAnchors.push({ x: at + width + 130, y: FLOOR, hidden: false });
};

/** Cooled columns, stepping up. The climb, and the reward for making it. */
const basalt: Piece = (at, i, out) => {
  // Climbs left-to-right or right-to-left, and never at the same pitch. Three
  // rising steps in the same direction every time is the piece the repeat was
  // most obvious on.
  const step = 58 + Math.round(hash(i * 19) * 22);
  const back = hash(i * 23) > 0.5;
  for (let n = 0; n < 3; n++) {
    const rung = back ? 2 - n : n;
    const x0 = at + rung * 140;
    out.surfaces.push(ledge(x0, x0 + 118, FLOOR - step * (n + 1)));
  }
  const topX = at + (back ? 0 : 280) + 59;
  out.chestAnchors.push({ x: topX, y: FLOOR - step * 3, hidden: true });
  out.enemyAnchors.push({ x: at + 470, y: FLOOR, hidden: false });
};

/**
 * A blade over a pool. Environment 1's pendulum, asked a harder question.
 *
 * There it swept a corridor you could stand still in and wait. Here the only
 * place to wait is a shelf in the middle of the lava, so reading the swing and
 * committing to the crossing happen in the same breath.
 */
const emberfall: Piece = (at, i, out) => {
  pool(out, at + 120, at + 340, 120);
  out.hazards.push({
    id: "hazard.ember." + i,
    kind: "pendulum",
    x: at + 230,
    y: roofAt(at + 230),
    period: 138,
    offset: i * 29,
    span: 230,
    size: FLOOR - roofAt(at + 230) - 96,
  });
  out.surfaces.push(ledge(at + 196, at + 274, FLOOR - 86));
  out.enemyAnchors.push({ x: at + 440, y: FLOOR, hidden: false });
};

/**
 * A long span of it with one bridge across, and something already on the
 * bridge. There is no route around and no room to back up - the saw has to be
 * jumped, over the widest pool in the environment.
 */
const causeway: Piece = (at, i, out) => {
  const x0 = at + 60;
  const x1 = at + 460;
  pool(out, x0, x1, 150);
  out.surfaces.push(ledge(x0 + 38, x1 - 38, FLOOR - 10));
  out.hazards.push({
    id: "hazard.cause." + i,
    kind: "saw",
    x: (x0 + x1) / 2,
    y: FLOOR - 10,
    period: 190,
    offset: i * 53,
    span: 250,
    size: 26,
  });
  out.enemyAnchors.push({ x: x1 + 60, y: FLOOR, hidden: false });
};

/**
 * The breather. Every rotation needs one - a stretch of honest floor with
 * something on it, so the fire reads as a place with rooms rather than as an
 * unbroken gauntlet.
 */
const forge: Piece = (at, i, out) => {
  out.surfaces.push(ledge(at + 120, at + 250, FLOOR - 104));
  out.chestAnchors.push({ x: at + 185, y: FLOOR - 104, hidden: true });
  out.chestAnchors.push({ x: at + 380, y: FLOOR, hidden: false });
  out.enemyAnchors.push({ x: at + 60, y: FLOOR, hidden: false });
  out.enemyAnchors.push({ x: at + 430, y: FLOOR, hidden: false });
};

/**
 * A stack, with the fire coming down the middle of it.
 *
 * The only piece in the environment whose answer is UP rather than across. The
 * curtain runs the full height beside the ledges, so the climb has to be timed
 * as well as made, and a player who reads it wrong is somewhere worse than the
 * floor when it pours.
 */
const chimney: Piece = (at, i, out) => {
  const step = 62 + Math.round(hash(i * 29) * 18);
  for (let n = 0; n < 3; n++) {
    const x0 = at + (n % 2 === 0 ? 40 : 210);
    out.surfaces.push(ledge(x0, x0 + 120, FLOOR - step * (n + 1)));
  }
  const x = at + 380;
  out.hazards.push({
    id: `hazard.flow.${i}.c`,
    kind: "flow",
    x,
    y: roofAt(x),
    period: 228,
    offset: i * 67,
    span: FLOOR - roofAt(x),
    size: 30,
  });
  out.chestAnchors.push({
    x: at + (2 % 2 === 0 ? 40 : 210) + 60,
    y: FLOOR - step * 3,
    hidden: true,
  });
  out.enemyAnchors.push({ x: at + 470, y: FLOOR, hidden: false });
};

/**
 * Two small pools with a shelf of cooled rock between them.
 *
 * Deliberately the easy one. A rotation of nothing but its hardest pieces reads
 * as flat as a rotation of its easiest, and this is the piece that makes the
 * causeway feel like something when it comes round.
 */
const steppes: Piece = (at, i, out) => {
  const w = 130 + Math.round(hash(i * 31) * 50);
  pool(out, at, at + w, 110);
  pool(out, at + w + 150, at + w * 2 + 150, 110);
  // Solid, not a thin ledge. At this height a ledge leaves eight units of gap
  // underneath — too low to slide through and too low to walk through, which is
  // the one shape `lintelsDuckable` exists to reject.
  out.surfaces.push(block(at + w + 20, at + w + 130, FLOOR - 34));
  out.chestAnchors.push({ x: at + w + 75, y: FLOOR - 34, hidden: true });
  out.enemyAnchors.push({ x: at + w * 2 + 280, y: FLOOR, hidden: false });
};

/**
 * A wide pool with one pillar in the middle and a crusher over it.
 *
 * The pillar is the only footing and the crusher owns it, so the piece is a
 * question about whether to commit to the middle at all — the alternative is a
 * single long jump, which is possible and does not feel it.
 */
const cauldron: Piece = (at, i, out) => {
  const w = 300 + Math.round(hash(i * 37) * 60);
  pool(out, at, at + w, 140);
  const mid = at + w / 2;
  out.surfaces.push(block(mid - 34, mid + 34, FLOOR - 30));
  out.hazards.push({
    id: `hazard.crush.${i}.c`,
    kind: "crusher",
    x: mid,
    y: roofAt(mid),
    period: 180,
    offset: i * 43,
    span: FLOOR - 30 - roofAt(mid) - 56,
    size: 40,
  });
  out.enemyAnchors.push({ x: at + w + 140, y: FLOOR, hidden: false });
};

/**
 * A run of narrow curtains with narrow gaps.
 *
 * Three or four in a row on one short period, so it is not a thing to time once
 * but a thing to walk through in rhythm. The last piece in the fire that is
 * purely about movement, and the only one with no floor hazard at all.
 */
const gauntlet: Piece = (at, i, out) => {
  const count = 3 + (hash(i * 41) > 0.5 ? 1 : 0);
  for (let n = 0; n < count; n++) {
    const x = at + 80 + n * 120;
    out.hazards.push({
      id: `hazard.flow.${i}.g${n}`,
      kind: "flow",
      x,
      y: roofAt(x),
      // All on one period, staggered evenly, so the gaps walk along the row.
      period: 168,
      offset: i * 17 + n * Math.round(168 / count),
      span: FLOOR - roofAt(x),
      size: 26,
    });
  }
  out.enemyAnchors.push({ x: at + 90 + count * 120, y: FLOOR, hidden: false });
};

// ---------------------------------------------------------------------------
// Environment 3 - the water.
//
// It starts as a beach and ends as an ocean, and that is a gradient rather than
// a set of rooms: `depthAt` reports how far through the environment a piece is,
// and every piece here uses it. The first ones have a puddle you can walk
// through; the last have a ceiling of water with a floor a long way under it.
//
// Swimming is the reducer's business. What the terrain does is say where the
// water IS, and put things on the far side of it worth crossing for.
// ---------------------------------------------------------------------------

/** The shallows. Sand, and something standing in it. */
const shallows: Piece = (at, i, out) => {
  out.surfaces.push(block(at + 380, at + 500, FLOOR - 36));
  out.chestAnchors.push({ x: at + 440, y: FLOOR - 36, hidden: true });
  out.enemyAnchors.push({ x: at + 540, y: FLOOR, hidden: false });
};

/**
 * A reef: a slab of rock hanging in the water with a way under it.
 *
 * The piece that makes diving compulsory rather than optional. It sits IN the
 * sea rather than in a pond of its own, so the way past is down and along and
 * coming up for air is a decision.
 */
const reef: Piece = (at, i, out) => {
  out.surfaces.push(ledge(at + 120, at + 350, FLOOR - 30));
  out.surfaces.push(ledge(at + 180, at + 290, FLOOR + 150));
  out.chestAnchors.push({ x: at + 235, y: FLOOR - 30, hidden: true });
};

/** Open water. Nothing in it but one rock to breathe beside. */
const trench: Piece = (at, i, out) => {
  out.surfaces.push(ledge(at + 230, at + 330, FLOOR - 40));
  out.chestAnchors.push({ x: at + 280, y: FLOOR - 40, hidden: true });
};

/** A wreck: something to climb out onto, and a reason to. */
const wreck: Piece = (at, i, out) => {
  // The lowest deck within a breach of the waterline, and each one a jump
  // above the last.
  for (let n = 0; n < 3; n++) {
    out.surfaces.push(
      ledge(at + 60 + n * 140, at + 170 + n * 140, FLOOR - 36 - n * 60),
    );
  }
  out.chestAnchors.push({ x: at + 395, y: FLOOR - 156, hidden: true });
};

/** A sandbar breaking the surface. Air, and a moment to take it. */
const sandbar: Piece = (at, i, out) => {
  out.surfaces.push(block(at + 140, at + 340, FLOOR - 40));
  out.chestAnchors.push({ x: at + 240, y: FLOOR - 40, hidden: true });
  out.enemyAnchors.push({ x: at + 240, y: FLOOR - 40, hidden: false });
};

// ---------------------------------------------------------------------------
// Environment 4 - the parkour.
//
// No monsters. Not "few" - none: the enemy is the geometry, and the only thing
// that can kill you is a hazard or the ground running out.
//
// It is also the tallest place in the game. The roof here hangs six hundred
// units up and the shafts go three hundred down, because every route is
// vertical and a low ceiling turns a chain of wall jumps into a single hop.
//
// Nine pieces rather than five, and every one of them varies with its index —
// the first version had five that repeated three times each and it read as one
// stunt performed over and over.
// ---------------------------------------------------------------------------

/** A shaft with nothing at the bottom, crossed or climbed by kicking walls. */
function shaft4(out: Mutable, x0: number, width: number, depth: number): void {
  out.cuts.push([x0, x0 + width]);
  out.surfaces.push({
    x0,
    x1: x0 + width,
    top: FLOOR + depth,
    bottom: FLOOR + DEEP,
    oneWay: false,
    thin: false,
  });
  out.spikes.push({
    x0: x0 + 10,
    x1: x0 + width - 10,
    top: FLOOR + depth - 20,
  });
}

/** Two walls facing each other over a hole. Up is the only way. */
const chimney4: Piece = (at, i, out) => {
  const gap = 140 + Math.round(hash(i * 71) * 60);
  const tall = 240 + Math.round(hash(i * 17) * 150);
  shaft4(out, at + 40, gap, 320);
  out.surfaces.push(block(at + 8, at + 40, FLOOR - tall));
  out.surfaces.push(block(at + 40 + gap, at + 72 + gap, FLOOR - tall));
  out.chestAnchors.push({ x: at + 56 + gap, y: FLOOR - tall, hidden: true });
};

/** A staircase of walls, each above and beyond the last. Kick, kick, kick. */
const ladder4: Piece = (at, i, out) => {
  shaft4(out, at + 20, 440, 300);
  const rise = 96 + Math.round(hash(i * 23) * 30);
  let topX = 0;
  let topY = 0;
  for (let n = 0; n < 4; n++) {
    const side = n % 2 === 0 ? at + 20 : at + 400;
    const top = FLOOR - 60 - n * rise;
    out.surfaces.push(block(side, side + 34, top));
    topX = side + 17;
    topY = top;
  }
  out.chestAnchors.push({ x: topX, y: topY, hidden: true });
};

/** Stands with nothing between them, at heights that keep changing. */
const steps4: Piece = (at, i, out) => {
  shaft4(out, at + 30, 440, 300);
  let lastX = 0;
  let lastLift = 0;
  // Each stand is placed RELATIVE to the one before it, within a jump either
  // way, rather than at a free height. Free heights put a hundred and ninety
  // between two neighbours often enough that one stand in the run was a stand
  // you could see and not reach.
  let lift = 70 + Math.round(hash(i * 13) * 60);
  for (let n = 0; n < 4; n++) {
    const x = at + 60 + n * 110;
    if (n > 0) {
      const step = Math.round(hash(i * 13 + n) * 200) - 90;
      lift = Math.min(300, Math.max(60, lift + step));
    }
    out.surfaces.push(ledge(x, x + 56, FLOOR - lift));
    lastX = x;
    lastLift = lift;
  }
  out.chestAnchors.push({ x: lastX + 28, y: FLOOR - lastLift, hidden: true });
};

/** One long gap. Only a running jump clears it. */
const leap4: Piece = (at, i, out) => {
  const width = 240 + Math.round(hash(i * 17) * 80);
  shaft4(out, at + 100, width, 340);
  out.surfaces.push(block(at + 20, at + 100, FLOOR - 30));
  out.surfaces.push(block(at + 100 + width, at + 190 + width, FLOOR - 30));
  out.chestAnchors.push({ x: at + 145 + width, y: FLOOR - 30, hidden: true });
};

/** A blade sweeping the only ledge across. */
const blades4: Piece = (at, i, out) => {
  shaft4(out, at, 500, 300);
  out.surfaces.push(ledge(at, at + 500, FLOOR - 130));
  for (let n = 0; n < 2; n++) {
    const x = at + 150 + n * 210;
    out.hazards.push({
      id: `hazard.para.${i}.${n}`,
      kind: "pendulum",
      x,
      y: roofAt(x),
      period: 120 + Math.round(hash(i * 7 + n) * 60),
      offset: i * 31 + n * 63,
      span: 220,
      size: FLOOR - 130 - roofAt(x) - 60,
    });
  }
};

/** A climb into a ceiling you have to slide under to pass. */
const duck4: Piece = (at, i, out) => {
  // Measured up from the shelf below it rather than from the floor, so the
  // step between the two is always a jump — free numbers put it as much as a
  // hundred and forty-seven apart, which is a jump and a half.
  const high = 116 + 108 + Math.round(hash(i * 41) * 22);
  out.surfaces.push(ledge(at + 120, at + 380, FLOOR - 116));
  out.surfaces.push(ledge(at + 200, at + 300, FLOOR - high));
  out.chestAnchors.push({ x: at + 250, y: FLOOR - high, hidden: true });
};

/** A tower to climb, and a long drop off the far side of it. */
const tower4: Piece = (at, i, out) => {
  // Built downward from the top in whole steps, so however tall it comes out
  // every block is one jump above the one before it. Writing the heights as
  // free numbers meant a shoulder could land a hundred and forty-seven units
  // above anything, which is a jump and a half.
  const rungs = 2 + (hash(i * 29) > 0.5 ? 1 : 0);
  const step = 110;
  const tall = rungs * step + 40;
  out.surfaces.push(block(at + 120, at + 200, FLOOR - tall));
  for (let n = 0; n < rungs; n++) {
    const x = at + 300 + n * 100;
    out.surfaces.push(block(x, x + 70, FLOOR - tall + (n + 1) * step));
  }
  shaft4(out, at + 200, 100, 320);
  out.chestAnchors.push({ x: at + 160, y: FLOOR - tall, hidden: true });
};

/** A run of narrow pillars over a long drop. Rhythm, not reading. */
const teeth4: Piece = (at, i, out) => {
  shaft4(out, at + 20, 480, 340);
  const rise = Math.round(hash(i * 53) * 60);
  for (let n = 0; n < 5; n++) {
    const x = at + 50 + n * 90;
    out.surfaces.push(block(x, x + 40, FLOOR - 40 - (n % 2) * rise));
  }
};

/** A crusher over the one ledge across a shaft. Timing, at height. */
const press4: Piece = (at, i, out) => {
  shaft4(out, at + 40, 420, 300);
  // A hundred and thirty, not a hundred and fifty: a jump rises a hundred and
  // eighty-three and the reachability budget allows a hundred and thirty-two,
  // so the taller version was a ledge you could see and not get onto.
  out.surfaces.push(ledge(at + 40, at + 460, FLOOR - 130));
  const x = at + 250;
  out.hazards.push({
    id: `hazard.press.${i}`,
    kind: "crusher",
    x,
    y: roofAt(x),
    period: 156,
    offset: i * 43,
    span: FLOOR - 130 - roofAt(x) - 56,
    size: 46,
  });
  out.chestAnchors.push({ x: at + 60, y: FLOOR - 130, hidden: true });
};

// ---------------------------------------------------------------------------
// Environment 5 - the poison.
//
// The last one before the boss, and the one where nothing hits you cleanly:
// the lizards leave poison on you, the sumps leave poison on you, and the bees
// take two bars from anyone who does not block. It is the environment that
// punishes carrying damage, which is the right note to end a run on.
// ---------------------------------------------------------------------------

/** A sump of the stuff. Same rule as a lava pool; different afterwards. */
const sump: Piece = (at, i, out) => {
  const width = 220 + Math.round(hash(i * 23) * 120);
  const depth = 120 + Math.round(hash(i * 29) * 40);
  out.cuts.push([at, at + width]);
  out.surfaces.push({
    x0: at,
    x1: at + width,
    top: FLOOR + depth,
    bottom: FLOOR + DEEP,
    oneWay: false,
    thin: false,
  });
  out.spikes.push({
    x0: at + 10,
    x1: at + width - 10,
    top: FLOOR + depth - 22,
    poison: true,
  });
  out.surfaces.push(
    block(at + width / 2 - 30, at + width / 2 + 30, FLOOR - 26),
  );
  out.enemyAnchors.push({ x: at + width + 130, y: FLOOR, hidden: false });
};

/** A hive shelf. Somewhere for the things that fly to come out of. */
const hive: Piece = (at, i, out) => {
  out.surfaces.push(ledge(at + 90, at + 240, FLOOR - 120));
  out.surfaces.push(ledge(at + 320, at + 440, FLOOR - 190));
  out.chestAnchors.push({ x: at + 380, y: FLOOR - 190, hidden: true });
  out.enemyAnchors.push({ x: at + 60, y: FLOOR, hidden: false });
  out.enemyAnchors.push({ x: at + 500, y: FLOOR, hidden: false });
};

/** Roots and drips. A crusher, and poison under it. */
const roots: Piece = (at, i, out) => {
  out.spikes.push({ x0: at + 180, x1: at + 340, top: FLOOR - 4, poison: true });
  const x = at + 260;
  out.hazards.push({
    id: `hazard.crush.p${i}`,
    kind: "crusher",
    x,
    y: roofAt(x),
    period: 174,
    offset: i * 37,
    span: FLOOR - roofAt(x) - 60,
    size: 44,
  });
  out.surfaces.push(ledge(at + 20, at + 140, FLOOR - 96));
  out.enemyAnchors.push({ x: at + 450, y: FLOOR, hidden: false });
};

/** Open ground, thick with them. */
const nest: Piece = (at, i, out) => {
  out.chestAnchors.push({ x: at + 260, y: FLOOR, hidden: false });
  out.enemyAnchors.push({ x: at + 80, y: FLOOR, hidden: false });
  out.enemyAnchors.push({ x: at + 330, y: FLOOR, hidden: false });
  out.enemyAnchors.push({ x: at + 480, y: FLOOR, hidden: false });
};

/** A climb over a sump, with the reward at the top. */
const canopy: Piece = (at, i, out) => {
  out.spikes.push({ x0: at + 60, x1: at + 420, top: FLOOR - 4, poison: true });
  const step = 72;
  for (let n = 0; n < 3; n++) {
    out.surfaces.push(
      ledge(at + 40 + n * 150, at + 160 + n * 150, FLOOR - step * (n + 1)),
    );
  }
  out.chestAnchors.push({ x: at + 400, y: FLOOR - step * 3, hidden: true });
};

/**
 * Environment 2's rotation.
 *
 * Ten, against seventeen slots. It was six, which meant the rotation played
 * very nearly three times in one environment and the second half of the fire
 * was the first half again in the same order — which is exactly what it looked
 * like. Ten plus a shuffled order plus per-instance variation means no two
 * passes lay down the same sequence and no two instances of a piece are the
 * same size.
 */
const FIRE_PIECES: Piece[] = [
  flowfall,
  lavapit,
  basalt,
  emberfall,
  causeway,
  forge,
  chimney,
  steppes,
  cauldron,
  gauntlet,
];

// ---------------------------------------------------------------------------
// The beach.
//
// The water environment does not begin in the water. It begins on a shore, and
// the shore is a place with its own furniture — driftwood, boulders left by a
// tide, pools the sea forgot — laid on dry sand that slopes down until it is
// under the sea and you did not notice the step where it happened.
//
// It had none of that before. The first nine hundred units were ordinary rock
// floor with sea pieces on it, and a reef hanging four units off dry ground is
// not a reef, it is a wall with a rock texture. That is the shape this set
// exists to stop.
// ---------------------------------------------------------------------------

/** Where the dry sand stops and the sea starts. */
export function shoreX(): number {
  return themeStart("water") + BEACH_RUN;
}

/** How much of the water environment is beach before the sea. */
const BEACH_RUN = 1180;

/** Driftwood and a boulder, with a gap to walk between. */
const strand: Piece = (at, i, out) => {
  const log = 140 + Math.round(hash(i * 19) * 80);
  out.surfaces.push(ledge(at + 90, at + 90 + log, FLOOR - 44));
  out.surfaces.push(
    block(at + 330, at + 330 + 70, FLOOR - 78 - Math.round(hash(i * 7) * 40)),
  );
  out.chestAnchors.push({
    x: at + 120 + log / 2,
    y: FLOOR - 44,
    hidden: false,
  });
  out.enemyAnchors.push({ x: at + 470, y: FLOOR, hidden: false });
};

/** A pool the tide left behind: ankle deep, and the first water you touch. */
const tidepool: Piece = (at, i, out) => {
  const w = 200 + Math.round(hash(i * 23) * 120);
  const deep = 34 + Math.round(hash(i * 41) * 18);
  out.cuts.push([at + 120, at + 120 + w]);
  out.surfaces.push({
    x0: at + 120,
    x1: at + 120 + w,
    top: FLOOR + deep,
    bottom: FLOOR + DEEP,
    oneWay: false,
    thin: false,
  });
  out.water.push({
    x0: at + 120,
    x1: at + 120 + w,
    surface: FLOOR,
    floor: FLOOR + deep,
  });
  out.enemyAnchors.push({ x: at + 160 + w, y: FLOOR, hidden: false });
};

/** A dune: a rise you walk over, with something on the back of it. */
const dune: Piece = (at, i, out) => {
  const high = 60 + Math.round(hash(i * 31) * 50);
  out.surfaces.push(ledge(at + 80, at + 240, FLOOR - high / 2));
  out.surfaces.push(ledge(at + 200, at + 400, FLOOR - high));
  out.chestAnchors.push({ x: at + 300, y: FLOOR - high, hidden: true });
  out.enemyAnchors.push({ x: at + 460, y: FLOOR, hidden: false });
};

/** Sand, and nothing on it. Somewhere to see the sea from. */
const foreshore: Piece = (at, i, out) => {
  void i;
  out.enemyAnchors.push({ x: at + 260, y: FLOOR, hidden: false });
};

const BEACH_PIECES: Piece[] = [foreshore, strand, tidepool, dune];

/** The sea floor proper. The beach has its own set, above. */
const WATER_PIECES: Piece[] = [shallows, reef, wreck, trench, sandbar];

/** Environment 4: no monsters, only the route. */
/**
 * Environment 4's rotation. Nine, against eighteen slots — so it plays twice,
 * shuffled the second time, and every piece varies with its own index.
 */
const PARKOUR_PIECES: Piece[] = [
  chimney4,
  leap4,
  ladder4,
  steps4,
  blades4,
  teeth4,
  tower4,
  press4,
  duck4,
];

/** Environment 5: the poison. */
const POISON_PIECES: Piece[] = [nest, sump, hive, canopy, roots];

/** Which set of pieces a stretch of the world is built from. */
function piecesFor(x: number): Piece[] {
  switch (themeAt(x)) {
    case "parkour":
      return PARKOUR_PIECES;
    case "poison":
      return POISON_PIECES;
    case "water":
      // Two sets, by where you are in it. The beach is dry and the sea is not,
      // and a reef laid on dry sand is a wall — which is exactly what the first
      // stretch of this environment was full of.
      return x < shoreX() ? BEACH_PIECES : WATER_PIECES;
    case "fire":
      return FIRE_PIECES;
    case "rock":
      return PIECES;
  }
}

/**
 * The order a rotation is laid down in on its `pass` through the environment.
 *
 * A permutation, not a reshuffle with replacement: every piece still appears
 * exactly once per pass, so nothing is ever skipped and nothing comes up twice
 * running. What changes is the ORDER, and that is the whole of the fix — the
 * fire's second half was its first half in the same sequence, and a player does
 * not notice that a pool got wider, they notice that they have seen this
 * corridor before.
 *
 * Fisher-Yates over `hash`, which is integer arithmetic, so this is the same
 * dungeon on every device and every run (FR-2: the geometry does not reshuffle
 * with the seed — it does not reshuffle at all).
 */
function passOrder(n: number, pass: number): number[] {
  const out = Array.from({ length: n }, (_, i) => i);
  // The FIRST pass is the authored order and stays that way. That order is a
  // deliberate ramp — it is what a player meets on the way in — and shuffling
  // it would be throwing away the one arrangement that was designed rather than
  // generated. Everything the repeat problem is about happens on pass two.
  if (pass === 0) return out;
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(hash(pass * 977 + i * 31) * (i + 1));
    const swap = out[i];
    out[i] = out[j];
    out[j] = swap;
  }
  return out;
}

/**
 * The cenote system.
 *
 * A ROCK, and a way under it.
 *
 * The sea used to be open water you could swim the length of on the surface,
 * which made every dive optional and the breath meter decorative. So the middle
 * of it is closed: a rock too tall to jump, standing from well above the
 * waterline down past the seabed, and the only way past it is under.
 *
 * The passage under it is short and it is the whole of the diving in this
 * environment. Two openings to the sky along it — cenotes, after the real ones
 * at Chac Mol — and those are the only air between the two mouths. Everything
 * either side of the rock is open sea again: the reef, the trench, the shelves,
 * exactly as they were.
 *
 * That balance is deliberate. A long cave is a different game — three thousand
 * units of ceiling turns an action environment into a breath-management puzzle
 * and there is nothing to fight in it. A short one is a GATE: you can see the
 * rock coming, you know what it is going to cost, and the sea on the far side
 * is a relief rather than more of the same.
 */
const CAVE_MOUTH = 900;
const CAVE_RUN = 1250;
/** Openings to the sky. These are the only air between the mouths. */
const CENOTES = 2;

/** Where the flooded system starts and ends. */
export function drownedPassage(): { x0: number; x1: number } {
  const x0 = shoreX() + CAVE_MOUTH;
  return { x0, x1: x0 + CAVE_RUN };
}

/**
 * Whether this stretch of the water environment belongs to the system.
 *
 * `sea()` asks so it can leave the water here alone: a flooded leg's waterline
 * is the rock over your head rather than the sea's surface, and two builders
 * pushing rects over the same ground would leave the player swimming in
 * whichever was found first.
 */
function inPassage(x: number): boolean {
  const p = drownedPassage();
  return x >= p.x0 - 300 && x < p.x1 + 300;
}

/**
 * How wide a cenote's shaft is, either side of centre.
 *
 * A shaft, not a swelling. The first version lifted the tunnel roof toward each
 * opening on a ramp, and every version of that was wrong in a different way: a
 * narrow ramp put a staircase in the ceiling that a swimmer holding up was
 * stopped by, and a wide one merged five openings into one continuous
 * air-filled corridor three thousand units long.
 *
 * A cenote on the survey map is a HOLE — a vertical column of water from the
 * passage straight up to daylight — so that is what this is. The lid simply is
 * not there for a hundred and forty units, and the column is open to the sky.
 * Nothing ramps, nothing merges, and the thing the player is looking for is a
 * shaft of light rather than a slightly higher ceiling.
 */
const CENOTE_HALF = 150;

/**
 * The two rocks that close the sea, as boxes.
 *
 * Exported because the renderer draws them as rock rather than as the
 * rectangles they are, and it should not be guessing at where they stand: a
 * boulder drawn a few units off its own collision is a boulder you bounce off
 * thin air beside.
 */
export function caveMouths(): {
  x0: number;
  x1: number;
  top: number;
  bottom: number;
}[] {
  const p = drownedPassage();
  return [p.x0 - 130, p.x1 + 40].map((at) => ({
    x0: at,
    x1: at + 90,
    // From well above anything a jump reaches, down past the waterline to the
    // tunnel's roof. Too tall to get over is the entire point of it — the sea
    // was skippable along the surface until this stood in the way.
    top: roofAt(at) - 240,
    bottom: FLOOR + 70,
  }));
}

/** Where each cenote's shaft comes down, in world units. */
export function cenoteShafts(): number[] {
  const p = drownedPassage();
  const out: number[] = [];
  for (let i = 1; i <= CENOTES; i++) {
    out.push(Math.round(p.x0 + (p.x1 - p.x0) * (i / (CENOTES + 1))));
  }
  return out;
}

/** Whether this x is under the open sky of a cenote. */
function inCenote(x: number): boolean {
  for (const at of cenoteShafts()) {
    if (Math.abs(x - at) <= CENOTE_HALF) return true;
  }
  return false;
}

/**
 * The passage's roof and bed at a given x, as world y.
 *
 * THE BED IS FLAT, and that is a decision rather than an oversight.
 *
 * A wandering floor is what the survey map shows and it is what three rewrites
 * of this function tried to build. Every one of them failed the same way: the
 * bed is a staircase of rectangles, so any gradient at all puts steps in it,
 * and a step in the floor is a wall to anything resting on it. Gentling the
 * profile moved the failure rather than fixing it; a swimmer who sinks arrives
 * at the next riser and stops, twelve hundred units short of daylight, every
 * time.
 *
 * So the floor is one depth and the CEILING carries the variety — it swells and
 * pinches the whole way, which is what you actually read while swimming, and
 * nothing rests on it. What is lost is a detail of the map. What is gained is a
 * cave that can be swum.
 */
function passageAt(x: number): { roof: number; bed: number } {
  const bed = FLOOR + 300;
  // Two waves at different wavelengths, so the tunnel opens and closes the
  // length of the system rather than being a corridor of one height. The
  // restrictions are where the roof comes closest to the floor.
  const swell = wave(x, 940, 0.2);
  const ripple = wave(x, 260, 0.6);
  // Gentle enough that a segment boundary is never a step taller than the
  // duck-under allowance. The ceiling is a staircase of rectangles like the
  // floor is, so its step height is the profile's gradient times the segment
  // width — and at the amplitudes this started with, that was twenty-two
  // against an eighteen-unit allowance, which is a wall every fourth segment.
  const roofed = FLOOR + 96 + swell * 30 + ripple * 18;
  // Never narrower than a swimmer, with room to spare — a swimmer holding up
  // rides the ceiling, and with no margin every step in it stops them.
  const clearance = tuning.player.height + 60;
  return {
    roof: Math.round(Math.min(roofed, bed - clearance)),
    bed,
  };
}

/**
 * The system's chests, laid AFTER the anchor filters have run.
 *
 * Everything else places its anchors during the build and lets the filter at
 * the end drop any that ended up over a cut. The cave is nothing but cut — it
 * is a hole in the world by definition — so anything it placed during the build
 * was thrown away, and environment three came out with two chests along its
 * whole length.
 */
function caveChests(out: Mutable): void {
  // A chest at every cenote, and one on the bed between each pair.
  //
  // The system covers a third of the environment and the pieces are kept out of
  // it, so whatever it holds is all the environment holds along that stretch —
  // it came out with two chests in the whole of environment three, which is a
  // long swim for nothing. The cenotes are the only landmarks, so they get the
  // obvious ones; the floor between them gets the rest, for anybody who looks
  // down on the way past.
  //
  // All of them stand on the BED rather than at the waterline under a shaft.
  // There is nothing at the waterline to stand on — the lid is omitted over a
  // cenote, which is what makes it a cenote — so a chest put there hangs in
  // open water, and the layout check says so.
  const shafts = cenoteShafts();
  for (const [i, at] of shafts.entries()) {
    out.chestAnchors.push({ x: at, y: passageAt(at).bed, hidden: true });
    if (i + 1 < shafts.length) {
      const between = Math.round((at + shafts[i + 1]) / 2);
      out.chestAnchors.push({
        x: between,
        y: passageAt(between).bed,
        hidden: true,
      });
    }
  }
}

function drownedCave(out: Mutable): void {
  const p = drownedPassage();

  // The rock at each mouth. It stops at the tunnel's roof, not at the bed:
  // taken all the way down it is not a rock, it is a wall, and a swimmer simply
  // stops against it.
  for (const m of caveMouths()) {
    out.surfaces.push({
      x0: m.x0,
      x1: m.x1,
      top: m.top,
      bottom: m.bottom,
      oneWay: false,
      thin: false,
    });
  }

  // Narrow segments. The bed is a staircase of rectangles and the height of
  // each step is how far the profile moves across one segment — at seventy
  // units the steps were tall enough to stop a swimmer walking the bottom, and
  // halving the segment halves the step.
  const step = 28;
  for (let x = p.x0 - 300; x < p.x1 + 300; x += step) {
    const width = Math.min(step, p.x1 + 300 - x);
    const mid = x + width / 2;
    const apron = mid < p.x0 - 40 || mid > p.x1 + 40;

    // The apron is open water down to the same bed: no lid, so the mouth can be
    // seen from the surface and dropped into.
    if (apron) {
      // Its bed is the PASSAGE's bed, continued out of the mouth.
      //
      // A flat apron at a fixed depth leaves a step where the two meet — the
      // first build had the approach a hundred and sixteen units below the
      // tunnel floor, so a swimmer hugging the bed arrived at a cliff and sat
      // against it until they drowned. The seabed has to run into the cave, not
      // stop at it.
      const bed = passageAt(mid).bed;
      out.cuts.push([x, x + width]);
      out.surfaces.push({
        x0: x,
        x1: x + width,
        top: bed,
        bottom: FLOOR + DEEP,
        oneWay: false,
        thin: false,
      });
      out.water.push({ x0: x, x1: x + width, surface: FLOOR, floor: bed });
      continue;
    }

    const { roof, bed } = passageAt(mid);
    const air = inCenote(mid);

    // The lid, from well inside the world's own roof down to the passage's —
    // and simply absent over a cenote, which is what makes the shaft a shaft.
    // Two hundred and forty ABOVE the roof rather than just under it, so the
    // headroom invariant reads it as a wall rather than as a shelf nobody can
    // stand on.
    if (!air) {
      out.surfaces.push({
        x0: x,
        x1: x + width,
        top: roofAt(x) - 240,
        bottom: roof,
        oneWay: false,
        thin: false,
      });
    }
    // The bed, cut so the base floor does not fill it back in.
    out.cuts.push([x, x + width]);
    out.surfaces.push({
      x0: x,
      x1: x + width,
      top: bed,
      bottom: FLOOR + DEEP,
      oneWay: false,
      thin: false,
    });
    // And the water, whose surface is whichever is lower: the sea's waterline,
    // or the rock over your head. That one line is the whole mechanic — under a
    // lid there is nothing above you to breathe, and under a cenote there is.
    out.water.push({
      x0: x,
      x1: x + width,
      // Under a lid the waterline IS the lid; under a shaft it is the sea's own
      // surface, and there is sky above it. That one line is the mechanic.
      surface: air ? FLOOR : Math.max(FLOOR, roof),
      floor: bed,
    });


  }


}

/**
 * The sea.
 *
 * Environment 3 was a set of ponds with dry land between them, which made it a
 * platformer with puddles rather than an ocean — you jumped over most of it and
 * the swimming was a novelty in the gaps. So the water is not built by the
 * pieces any more. It is laid down once, in one continuous run, and the pieces
 * put rocks and wrecks and pipes INTO it.
 *
 * The shape is a beach that stops being a beach. Sea level is the floor line
 * itself, and the bed drops away from it: at the shore the bed is a few units
 * down and you wade, and a thousand units later it is three hundred down and
 * you are swimming with the surface over your head. Nothing announces the
 * change and there is no edge to jump over — the ground just stops being under
 * you, which is the only honest way to do a coastline.
 */
function sea(out: Mutable): void {
  const end = themeEnd("water");
  // A short dry beach to arrive on, and a lip at the far end to climb out onto.
  const shore = shoreX();
  const far = end - 700;
  const step = 260;

  for (let x = shore; x < far; x += step) {
    const width = Math.min(step, far - x);
    // The drowned passage lays its own water and its own bed: its waterline is
    // the rock over your head rather than the sea's surface, and two builders
    // pushing rects over the same ground would leave the player swimming in
    // whichever was found first.
    if (inPassage(x) || inPassage(x + width)) continue;
    const through = (x - shore) / (far - shore);
    // Deepens fast at first and then levels off, the way a shelf does.
    const depth = Math.round(30 + Math.sqrt(through) * 330);
    out.cuts.push([x, x + width]);
    out.surfaces.push({
      x0: x,
      x1: x + width,
      top: FLOOR + depth,
      bottom: FLOOR + DEEP,
      oneWay: false,
      thin: false,
    });
    // Sea level is the floor line. That is what makes the shore work: at the
    // shallow end your feet are on the bed and your chest is above the water,
    // so you walk; further out the bed drops below you and you do not.
    out.water.push({
      x0: x,
      x1: x + width,
      surface: FLOOR,
      floor: FLOOR + depth,
    });
  }
}

/**
 * The geyser chain's vents.
 *
 * Only the ground they stand on is built here — the throw itself is in the
 * reducer, because it is a thing that happens to a player rather than a thing
 * that is somewhere. What matters at this end is that all four have flat floor
 * under them and nothing overhead, or the arc off one lands on a ledge instead
 * of on the next.
 */
export const geyserVents: readonly number[] = (() => {
  const s = shortcutById.get(geyserId);
  if (!s) return [];
  const reach = geyserReach();
  // As many as it takes to cross the span, not four.
  //
  // Four was right when a shortcut skipped thirteen seconds of ground. It skips
  // twenty-two now — there are four shortcuts in the game rather than seven, so
  // each has to be worth more — and a fixed count meant the chain ended two
  // thirds of the way along and dropped you in open water to swim the rest.
  // The number of vents is a consequence of the span and the arc, exactly like
  // the spacing is.
  const span = s.toX - s.fromX;
  const count = Math.max(2, Math.round(span / reach));
  return Array.from({ length: count }, (_, n) => s.fromX + n * reach);
})();

/** How far one throw carries, from the numbers that produce it. */
export function geyserReach(): number {
  const m = tuning.movement;
  return Math.round(m.geyserThrow * geyserFlight());
}

/** How long one throw is in the air. */
export function geyserFlight(): number {
  const m = tuning.movement;
  return (2 * m.geyserLaunch) / m.gravity;
}

/**
 * The chain's two numbers have to agree, and neither is obviously wrong on its
 * own: the vents are spaced by how far a throw carries, and they fire spaced by
 * how long a throw lasts. Change the launch and both move. This fails the build
 * rather than leaving a chain that lands you a stride short of every vent.
 */
export function checkGeyserChain() {
  const flight = geyserFlight();
  const stagger = tuning.movement.geyserStagger;
  const blow = tuning.movement.geyserBlow;
  return {
    /** You arrive while the next one is actually blowing. */
    sequenced: Math.abs(flight - stagger) <= blow / 2,
    /** And you arrive on top of it, not beside it. */
    onTarget:
      Math.abs(geyserReach() - tuning.movement.geyserThrow * flight) <=
      tuning.movement.geyserRadius,
    /** The whole chain fits inside the span it is shortening. */
    insideSpan:
      geyserVents.length > 0 &&
      geyserVents[geyserVents.length - 1] <=
        (shortcutById.get(geyserId)?.toX ?? 0),
  };
}

// ---------------------------------------------------------------------------
// The boss chamber.
//
// A room, and deliberately not a wider piece of corridor.
//
// The final boss was standing on open floor at the end of environment 5, which
// made it a monster with a large health bar rather than an event — you did not
// arrive anywhere, you simply kept walking and it was there. So the room comes
// first and the boss comes second: this is somewhere you go INTO, through a
// door, and the moment you are through it the corridor is gone and there is
// stone on all four sides.
//
// It is built PAST the end wall rather than carved out of the fire, so nothing
// in environment 5 has to move to make space for it and no piece can lay a lava
// pool through it. The door is the only way in and the only way out, which is
// what a chamber is.
//
// Empty for now. That is the whole point of shipping it empty — the room can be
// walked, looked at and judged before anything is put in it.
// ---------------------------------------------------------------------------

/** The door at the end of the fire, and the room it opens onto. */
export const chamber = (() => {
  const doorX = exitX - 360;
  const x0 = builtEnd + 460;
  const width = 900;
  return {
    /** Where you press it, in the fire. */
    doorX,
    x0,
    x1: x0 + width,
    /**
     * Where you arrive: well clear of the way back.
     *
     * This was `x0 + 120` against a `backX` of `x0 + 90` — thirty units apart,
     * against a reach of eighty-six. So you came through the door and landed
     * standing ON the door, and the next press of the same key threw you
     * straight back out into the fire. From the player's side that is a boss
     * room that ejects you, which is exactly what it looked like.
     *
     * Two hundred and forty apart now, which is more than five reaches.
     */
    insideX: x0 + 310,
    /**
     * And the way back, which is the same door from the other side.
     *
     * On the wall, not near it: the player clamps to `x0 + halfWidth` and the
     * reach is forty-six, so anything past `x0 + 60` is a door you can see and
     * cannot touch. Seventy was, and the room was a cell for one build.
     */
    backX: x0 + 40,
    /**
     * The way out, at the far end, and it only exists once the room is quiet.
     *
     * The near door works the whole time — FR-4.2 wants retreating to be a
     * decision you can always make, so the boss is never a trap. But retreating
     * takes you back into the fire with the whole run still to carry home, and
     * that is the wrong ending for the fight at the bottom of the dungeon.
     *
     * So there is a second door, past the boss, and it banks the run where you
     * stand. It is sealed while the boss lives — walking round it was never the
     * point — and the moment it falls the far wall opens onto daylight.
     */
    outX: x0 + width - 70,
    /** High, because the room has to feel like one. */
    roof: FLOOR - 470,
  };
})();

/** Whether a position is inside the chamber rather than in the dungeon. */
export function inChamber(x: number): boolean {
  return x >= chamber.x0 - 40 && x <= chamber.x1 + 40;
}

/** The room's stone: a floor, two walls and a lid. */
/** The road itself, and the two stubs that make it look built. */
function layHighRoad(out: Mutable): void {
  const road = highRoad();
  if (!road) return;
  // Thin, so it is a road rather than a roof: things can be dropped off it and
  // the ground below stays visible, which is the whole reason it reads as a
  // shortcut instead of as a ceiling.
  out.surfaces.push({
    x0: road.x0,
    x1: road.x1,
    top: road.top,
    bottom: road.top + 26,
    oneWay: false,
    thin: true,
    // Thin to a body, solid to a fireball. The phoenixes in the fire
    // environment fly under it, and a thin slab only stops a shot coming down
    // — so they were firing up through the deck at anyone walking the road.
    shotproof: true,
  });
  // The pylons that hold it up are drawn by the view and are not surfaces.
  //
  // They were, and they were a ladder: twenty-eight units wide, standable, and
  // topping out twenty-six below the road. A player could climb a fire ledge,
  // hop a pylon and step onto the shortcut without ever finding the lever,
  // which is the one thing FR-3.1 says a shortcut must not allow.
  //
  // Nothing is lost by drawing them instead. They exist to be looked at from
  // below.
  // And a chest at the far end, because walking a road nobody can reach ought
  // to end in something.
  out.chestAnchors.push({ x: road.x1 - 120, y: road.top, hidden: true });
}

/**
 * Nothing under the road tall enough to climb onto it.
 *
 * Run after everything is laid, because the pieces do not know the road is
 * there — a fire ledge two hundred and nineteen units up under a road two
 * hundred and fifty up is a step, and a step is a way past the lever.
 *
 * Only the tall ones go. The pools, the curtains and the low ledges all stay,
 * so the ground the shortcut skips is still ground worth skipping.
 */
function clearUnderTheRoad(out: Mutable): void {
  const road = highRoad();
  if (!road) return;
  // Everything standable in the band, thin or solid.
  //
  // It started as thin surfaces only, and a solid tower three hundred up left
  // of the near end was still a staircase: jump the tower, jump again, and you
  // are on the road with the lever untouched. The world floor is well below the
  // band so it is never caught by this, and what is left underneath is a long
  // open stretch of pools and curtains — which is the right thing to be looking
  // down at from a road you had to earn.
  const ceiling = road.top + 230;
  out.surfaces = out.surfaces.filter(
    (s) =>
      !(
        s.x1 > road.x0 - 420 &&
        s.x0 < road.x1 + 60 &&
        s.top > road.top + 2 &&
        s.top < ceiling
      ),
  );
  // And the curtains. A lava flow hangs from the roof and pours to the floor,
  // which means it pours straight through a road drawn between the two — the
  // first crossing caught fire twice and arrived on one bar. A shortcut you
  // have to survive is not a shortcut, it is a corridor with a lever.
  out.hazards = out.hazards.filter(
    (h) => !(h.x > road.x0 - 60 && h.x < road.x1 + 60 && h.kind === "flow"),
  );
  out.chestAnchors = out.chestAnchors.filter(
    (a) =>
      !(
        a.x > road.x0 - 420 &&
        a.x < road.x1 + 60 &&
        a.y > road.top + 2 &&
        a.y < ceiling
      ),
  );
  out.enemyAnchors = out.enemyAnchors.filter(
    (a) =>
      !(
        a.x > road.x0 - 420 &&
        a.x < road.x1 + 60 &&
        a.y > road.top + 2 &&
        a.y < ceiling
      ),
  );
}

function bossChamber(out: Mutable): void {
  const { x0, x1, roof } = chamber;
  // Floor.
  out.surfaces.push({
    x0: x0 - 60,
    x1: x1 + 60,
    top: FLOOR,
    bottom: FLOOR + DEEP,
    oneWay: false,
    thin: false,
  });
  // Walls, both ends, floor to lid. There is no way out of here on foot.
  out.surfaces.push(block(x0 - 60, x0, roof));
  out.surfaces.push(block(x1, x1 + 60, roof));
  // The lid.
  out.surfaces.push({
    x0: x0 - 60,
    x1: x1 + 60,
    top: roof - 60,
    bottom: roof,
    oneWay: false,
    thin: false,
  });
}

/**
 * THE TUTORIAL HALL.
 *
 * A sealed room past the boss chamber, laid out as stations left to right: one
 * verb per station, and each station is geometry you cannot get past without
 * using the verb it teaches. Walk, jump a gap, slide a lintel, kill a goblin,
 * parry an archer, dive a pool, open a chest, walk out with what you earned.
 *
 * WHY IT IS A ROOM IN THE WORLD rather than its own level. The terrain is one
 * module-level constant, built once, and every collision function in the game
 * reads it directly — that is the deal the whole architecture is built on and
 * it is why the geometry is fixed and testable in the first place. A second
 * level would mean making `terrain` swappable, which means threading it through
 * `insideSolid`, `blocksShot`, `waterAt` and everything else that currently
 * just knows. The boss chamber already solved this the cheap way: build the
 * room past the end of the world and teleport into it. This is that, again.
 *
 * WHY IT TEACHES BY GATING rather than by telling. A prompt that says "press F
 * to slide" and a corridor you can walk down teaches nothing, because nothing
 * checks. Every station here is a wall to a player who has not learnt it: the
 * gap is wider than a step, the lintel is lower than a crouch, the pool is
 * roofed, and the goblin is between you and the rest of the room. The prompt is
 * a hint about a problem you already have.
 */
export const tutorial = (() => {
  // Well past the chamber, which itself runs to `builtEnd + 1360`. There is
  // nothing between them and nothing needs to be — you arrive by teleport.
  const x0 = builtEnd + 3000;
  /**
   * Each station's start, relative to `x0`, in TEACHING order.
   *
   * Movement before combat, and inside each group simplest first, because a
   * station is only a fair test of one verb if every verb before it is already
   * in the hands. The backstep sits immediately after the slide on purpose:
   * they are the same key and the difference between them is the thing players
   * actually get wrong, so the contrast wants to be back to back.
   */
  const at = {
    walk: 0,
    gap: 520,
    slide: 900,
    back: 1180,
    wall: 1520,
    // The combat stations are spaced further apart than the movement ones, and
    // that spacing is load-bearing rather than cosmetic. Each one is about ITS
    // monster, so each has to own a stretch of hall wide enough that the next
    // station's monster is not standing in it — at four hundred and twenty
    // apart the first fight could not be finished without also killing the
    // goblin belonging to the station after it.
    fight: 2000,
    stun: 2620,
    smash: 3240,
    parry: 3900,
    dive: 4380,
    loot: 5080,
    leave: 5440,
  } as const;
  const width = 5780;
  return {
    x0,
    x1: x0 + width,
    roof: FLOOR - 620,
    /** Where you appear. */
    spawnX: x0 + 90,
    at,
    /** The gap. Wider than a stride, well inside a jump. */
    gap: { x0: x0 + at.gap, x1: x0 + at.gap + 130 },
    /**
     * The lintel. Thirty-eight units of clearance against a standing height of
     * eighty-two and a crouch of forty-five — so neither walking nor crouching
     * fits under it and the slide is the only way through. This is the one
     * station whose numbers have to be checked rather than chosen: the walking
     * allowance in `blockHorizontally` was once generous enough to make lintels
     * like this walkable, which silently deleted the lesson.
     *
     * Under a hundred and fifty wide, too, because a slide only carries about a
     * hundred and seventy units before you stand back up.
     */
    lintel: { x0: x0 + at.slide, x1: x0 + at.slide + 150, clearance: 38 },
    /**
     * The wall-jump slot.
     *
     * Two hundred and sixty deep against a floor jump that rises a hundred and
     * eighty-three: you cannot get out by jumping. A jump plus one kick reaches
     * three hundred and forty-six, so one kick is enough — which is the right
     * first lesson. The shipped shafts in the dungeon are four hundred and
     * twenty and want two, and that is not a thing to meet before you have done
     * it once.
     *
     * A hundred and eighty wide, so both faces are inside a kick of each other
     * and the chain is comfortable rather than frame-tight.
     */
    slot: { x0: x0 + at.wall + 120, x1: x0 + at.wall + 300, depth: 260 },
    /**
     * The drop the smash is taught from. `jumpImpulse` is sized to give the
     * dive something to fall through, so the ledge wants to be a real height —
     * and the goblin waits underneath it rather than on it.
     */
    /**
     * The drop the smash is taught from. Reached by a plain jump, which rises a
     * hundred and eighty-three — a hundred and fifty leaves room to spare.
     *
     * There was a step up to it at chest height, meant to make climbing on
     * easier. A player is eighty-two tall and the step's underside sat
     * fifty-six above the floor, so it was not a step, it was a wall across the
     * corridor, and the bot walked into it and stood there until the test timed
     * out. The ledge does not need help being reached; nothing is here.
     */
    ledge: {
      x0: x0 + at.smash + 160,
      x1: x0 + at.smash + 400,
      top: FLOOR - 150,
    },
    /** The pool, and the rock in it you have to go under. */
    pool: { x0: x0 + at.dive, x1: x0 + at.dive + 620, bed: FLOOR + 260 },
    plug: { x0: x0 + at.dive + 300, x1: x0 + at.dive + 380 },
    goblinX: x0 + at.fight + 300,
    /**
     * The stun's goblin, and the smash's.
     *
     * Neither can be forced by geometry — a stun is a button and a smash is a
     * button, and no shape of rock demands either. So both stations gate on the
     * ACTION rather than on a position, and the goblin is there to give the
     * action something to be about.
     */
    stunX: x0 + at.stun + 280,
    smashX: x0 + at.smash + 300,
    archerX: x0 + at.parry + 320,
    chestX: x0 + at.loot + 180,
    /** The way home at the end. Standing here and pressing E banks the run. */
    doorX: x0 + at.leave + 200,
    /**
     * And a second one behind where you appear, which is the more important of
     * the two.
     *
     * Every station in the hall is a wall to a player who has not learnt its
     * verb — that is the whole design — and the failure mode of that design is
     * a player who cannot do the wall jump being sealed in a room forever. The
     * game already has a rule about this and it is FR-4.2: retreating has to be
     * a decision you can always make. The hall broke it, so it gets a door you
     * start next to and can always walk back to.
     */
    backX: x0 + 20,
  };
})();

/** Whether a position is inside the tutorial hall. */
export function inTutorial(x: number): boolean {
  return x >= tutorial.x0 - 60 && x <= tutorial.x1 + 60;
}

function tutorialHall(out: Mutable): void {
  const t = tutorial;
  const ground = (x0: number, x1: number, top: number = FLOOR) =>
    out.surfaces.push({
      x0,
      x1,
      top,
      bottom: FLOOR + DEEP,
      oneWay: false,
      thin: false,
    });

  // Floor, in runs with the holes between them. Laid here rather than left to
  // the base floor because the base floor stops at `builtEnd + 400`.
  ground(t.x0 - 60, t.gap.x0);
  ground(t.gap.x1, t.slot.x0);
  ground(t.slot.x1, t.pool.x0);
  ground(t.pool.x1, t.x1 + 60);

  // Something at the bottom of the gap to see. Not spikes — the first hole a
  // new player meets should cost a moment, not a life.
  ground(t.gap.x0, t.gap.x1, FLOOR + 220);

  // The wall-jump slot's floor. The two faces are the ends of the ground runs
  // either side of it, which are full-depth and not one-way, so both are
  // grabbable — a one-way surface or a short lip is not.
  ground(t.slot.x0, t.slot.x1, FLOOR + t.slot.depth);

  // The lintel: a mass hanging from the lid to `clearance` above the floor.
  out.surfaces.push({
    x0: t.lintel.x0,
    x1: t.lintel.x1,
    top: t.roof,
    bottom: FLOOR - t.lintel.clearance,
    oneWay: false,
    thin: false,
  });

  // The ledge the smash is taught from. Thin, so it reads as something to stand
  // on rather than as a wall, and reachable by a plain jump from the floor.
  out.surfaces.push({
    x0: t.ledge.x0,
    x1: t.ledge.x1,
    top: t.ledge.top,
    bottom: t.ledge.top + 24,
    oneWay: false,
    thin: true,
  });

  // The pool: a bed, water to the floor line, and a plug of rock in the middle
  // standing from above the waterline down to well under it. Same idea as the
  // rock in the sea and deliberately so — this is the station that teaches the
  // one thing the water environment will ask of you later.
  out.surfaces.push({
    x0: t.pool.x0,
    x1: t.pool.x1,
    top: t.pool.bed,
    bottom: FLOOR + DEEP,
    oneWay: false,
    thin: false,
  });
  out.water.push({
    x0: t.pool.x0,
    x1: t.pool.x1,
    surface: FLOOR,
    floor: t.pool.bed,
  });
  out.surfaces.push({
    x0: t.plug.x0,
    x1: t.plug.x1,
    top: t.roof,
    bottom: FLOOR + 110,
    oneWay: false,
    thin: false,
  });

  // Walls at both ends and a lid over the whole thing. There is no way out of
  // the hall on foot; the way out is the door at the end, which is the last
  // thing it teaches.
  out.surfaces.push(block(t.x0 - 120, t.x0 - 60, t.roof));
  out.surfaces.push(block(t.x1 + 60, t.x1 + 120, t.roof));
  out.surfaces.push({
    x0: t.x0 - 120,
    x1: t.x1 + 120,
    top: t.roof - 60,
    bottom: t.roof,
    oneWay: false,
    thin: false,
  });
}

/**
 * The sealed room this position is in, if any.
 *
 * There are two rooms built PAST the end of the world — the boss chamber and
 * the tutorial hall — because the alternative was making `terrain` swappable
 * and threading it through every collision function in the game. Both are
 * rooms with their own walls rather than more corridor, so every "clamp to the
 * end of the world" in this file has to ask which walls apply.
 *
 * This exists because that question was answered separately in six places, each
 * one hardcoding the chamber by name, and each one was found the same way: by
 * something being silently dragged four hundred units west and the bug looking
 * like a completely different feature failing. Adding the tutorial would have
 * meant six more chances to forget. Now there is one.
 */
export function roomAt(x: number): { x0: number; x1: number } | null {
  if (inChamber(x)) return { x0: chamber.x0, x1: chamber.x1 };
  if (inTutorial(x)) return { x0: tutorial.x0, x1: tutorial.x1 };
  return null;
}

function build(): Terrain {
  const out: Mutable = {
    surfaces: [],
    water: [],
    ladders: [],
    spikes: [],
    traps: [],
    hazards: [],
    chestAnchors: [],
    enemyAnchors: [],
    cuts: [],
  };

  const from = dungeonStart + ENTRY_RUN;
  // Counted separately from the slot index, and separately PER ENVIRONMENT: a
  // slot skipped for sitting on a fixture must not also skip that piece out of
  // the rotation, and environment 2 has to start its own rotation at the top
  // rather than wherever environment 1 happened to leave off.
  const built = new Map<number, number>();
  for (
    let at = from, i = 0;
    at < builtEnd - PIECE_SPACING;
    at += PIECE_SPACING, i++
  ) {
    // Never build over a lever, a door, the gate or a geyser mouth: that ground
    // is either the win condition, the boss's floor, or a hole with a column of
    // steam coming out of it.
    //
    // Filled rather than skipped. The geyser chain reserves four mouths six
    // hundred units apart and the slots are five hundred and sixty, so nearly
    // every slot across its span comes here — and a slot that only got a single
    // guard left a bare corridor through the middle of the fire, which is the
    // one thing worse to walk down than a repeated one. No geometry, because
    // geometry is what the reservation is protecting: just something to fight
    // and something to open.
    if (!clearOfFixtures(at - 40, at + 520)) {
      // Each filler is cleared on its OWN footprint, not the slot's. The slot
      // is reserved because a lever or a door is somewhere inside it; that
      // leaves most of it free, and putting a chest down without checking put
      // one directly on top of a lever.
      for (const spot of [at + 120, at + 400]) {
        if (clearOfFixtures(spot - 30, spot + 30))
          out.enemyAnchors.push({ x: spot, y: FLOOR, hidden: false });
      }
      if (clearOfFixtures(at + 240, at + 300))
        out.chestAnchors.push({ x: at + 270, y: FLOOR, hidden: false });
      continue;
    }
    const environment = environmentAt(at);
    // And never across the seam. A piece is laid from `at` and reaches about
    // five hundred units; laid near the end of an environment it puts its pools
    // and its hazards in the NEXT one, which is how a lava pool ended up in the
    // middle of the ocean.
    if (environmentAt(at + 520) !== environment) {
      out.enemyAnchors.push({ x: at + 120, y: FLOOR, hidden: false });
      continue;
    }
    const set = piecesFor(at);
    const n = built.get(environment) ?? 0;
    const order = passOrder(set.length, Math.floor(n / set.length));
    set[order[n % set.length]](at, i, out);
    built.set(environment, n + 1);
  }

  sea(out);
  drownedCave(out);
  layHighRoad(out);
  clearUnderTheRoad(out);
  bossChamber(out);
  tutorialHall(out);

  // The exit, and the wall that stops the world.
  // The last guard before the way out, on ground rather than over it. The fire
  // cuts wide pools and one of them reaches under the old fixed offset, which
  // left this anchor standing on nothing at all.
  let guard = exitX - 220;
  while (
    guard > exitX - 900 &&
    out.cuts.some(([a, b]) => guard >= a - 30 && guard <= b + 30)
  ) {
    guard -= 30;
  }
  out.enemyAnchors.push({ x: guard, y: FLOOR, hidden: false });
  out.surfaces.push({
    x0: builtEnd - 40,
    x1: builtEnd + 400,
    top: roofAt(builtEnd) - 40,
    bottom: FLOOR + DEEP,
    oneWay: false,
    thin: false,
  });

  // Anchors last: a piece places its guard on floor that exists at the time,
  // and the piece after it can cut a pool out from under that exact spot. The
  // only place this can be known is here, with everything laid.
  const cutHere = (x: number) =>
    out.cuts.some(([a, b]) => x >= a - 30 && x <= b + 30);
  out.enemyAnchors = out.enemyAnchors.filter(
    (a) => a.y < FLOOR || !cutHere(a.x),
  );
  out.chestAnchors = out.chestAnchors.filter(
    (a) => a.y < FLOOR || !cutHere(a.x),
  );

  // And the cenote system's, which go in after that filter rather than before
  // it — the cave is a hole in the world by definition, so every anchor it laid
  // during the build was thrown away as "over a cut" and environment three came
  // out with two chests along its entire length.
  caveChests(out);

  // The base floor, cut where the pits are. Built last because the cuts are
  // collected as the pieces are laid out, and a span cannot be split before
  // anything has asked for it to be.
  const cuts = [...out.cuts].sort((a, b) => a[0] - b[0]);
  let edge = 0;
  const ground: Surface[] = [];
  for (const [x0, x1] of cuts) {
    if (x0 > edge) {
      ground.push({
        x0: edge,
        x1: x0,
        top: FLOOR,
        bottom: FLOOR + DEEP,
        oneWay: false,
        thin: false,
      });
    }
    edge = Math.max(edge, x1);
  }
  ground.push({
    x0: edge,
    x1: builtEnd + 400,
    top: FLOOR,
    bottom: FLOOR + DEEP,
    oneWay: false,
    thin: false,
  });

  return {
    surfaces: [...ground, ...out.surfaces],
    water: out.water,
    ladders: out.ladders,
    spikes: out.spikes,
    traps: out.traps,
    hazards: out.hazards,
    chestAnchors: out.chestAnchors,
    enemyAnchors: out.enemyAnchors,
  };
}

export const terrain: Terrain = build();

/**
 * The layout invariants, checked rather than trusted — the same idea as
 * `checkTimeBudget` and `checkDungeonLayout`.
 *
 * The one that matters most is `everyAnchorReachable`. A chest on a ledge one
 * unit too high is indistinguishable from a chest on a ledge that is fine,
 * right up until a player spends half a tank of air failing to reach it.
 */
export function checkTerrain(t: Terrain = terrain) {
  const jumpRise =
    (tuning.movement.jumpImpulse * tuning.movement.jumpImpulse) /
    (2 * tuning.movement.gravity);

  let anchorsOnSurfaces = true;
  for (const a of [...t.chestAnchors, ...t.enemyAnchors]) {
    const stood = t.surfaces.some(
      (s) => a.x >= s.x0 && a.x <= s.x1 && Math.abs(s.top - a.y) < 1,
    );
    if (!stood) anchorsOnSurfaces = false;
  }

  // Every ledge must be within a jump of something below it, or of a ladder.
  /**
   * Whether a span is under water.
   *
   * Two of the invariants below are about what a JUMP can do, and a jump is not
   * how you get anywhere in environment 3. A shelf hanging over a trench is
   * perfectly reachable — you swim up to it — and a slab with two feet of gap
   * beneath it is not a lintel when the gap is full of sea.
   */
  /**
   * How high a breach throws you above the waterline.
   *
   * Derived from the two numbers that produce it rather than typed in, for the
   * usual reason: retuning the stroke must not silently make a shelf in the sea
   * unreachable while this check still says it is fine.
   */
  const breachRise =
    (tuning.swim.breach * tuning.swim.breach) / (2 * tuning.movement.gravity);
  // At or under the waterline, or within one BREACH of it: coming up out of the
  // water throws you clear, so a shelf a stride above the surface is something
  // you swim to rather than something you jump to. Derived from the stroke and
  // gravity rather than the flat fifty it used to be, so retuning the swim
  // cannot quietly make a shelf in the sea unreachable while this still agrees.
  const submergedSpan = (x0: number, x1: number, top: number) =>
    t.water.some((w) => x1 > w.x0 && x0 < w.x1 && top > w.surface - breachRise);

  const roadSpan = highRoad();
  let everyLedgeReachable = true;
  for (const s of t.surfaces) {
    if (!s.thin) continue;
    const servedByLadder = t.ladders.some(
      (l) =>
        l.x >= s.x0 - 40 && l.x <= s.x1 + 40 && Math.abs(l.top - s.top) < 8,
    );
    if (servedByLadder) continue;
    // Or served by the lift. The fire's high road is DELIBERATELY out of reach
    // — that is the whole shortcut — and the thing that serves it is a vent at
    // its near end rather than a jump from below. Without this the invariant
    // reports the one surface in the game whose unreachability is the design.
    const onTheRoad =
      roadSpan !== null &&
      s.x1 > roadSpan.x0 - 4 &&
      s.x0 < roadSpan.x1 + 4 &&
      Math.abs(s.top - roadSpan.top) < 4;
    if (onTheRoad) continue;
    // Anything you could come FROM, above or below.
    //
    // This used to look only at surfaces strictly BELOW the ledge, which reads
    // as "what would I jump up from" and quietly excludes the commonest way
    // onto one: stepping across from a neighbour at the same height, or
    // dropping onto it from a higher one. A run of parkour stands at 130, 234,
    // 144 and 140 units up failed on the last of them — its neighbour was four
    // units HIGHER, so the check ignored it and fell back to the floor a
    // hundred and forty down.
    const reachableFrom = t.surfaces
      .filter((o) => o !== s && o.x1 > s.x0 - 150 && o.x0 < s.x1 + 150)
      .map((o) => o.top);
    // Unless it is in the sea, where a jump is not how you get anywhere: you
    // swim up to a shelf, and the height above whatever is beneath it is not a
    // fact about whether you can reach it.
    if (submergedSpan(s.x0, s.x1, s.top)) continue;
    // Or unless there is a wall facing it close enough to kick off.
    //
    // Environment 4 is built almost entirely out of that move, and this check
    // only ever knew about a standing jump — so it read every chimney in the
    // parkour as a shelf nobody could get to.
    const facing = t.surfaces.some(
      (o) =>
        o !== s &&
        !o.thin &&
        o.top < FLOOR &&
        o.bottom > s.top &&
        Math.abs((o.x0 + o.x1) / 2 - (s.x0 + s.x1) / 2) < 300,
    );
    if (facing) continue;
    // A step UP of more than a jump is unreachable; a step down is always fine,
    // which is why this is a signed comparison rather than a distance.
    if (
      reachableFrom.length === 0 ||
      Math.min(...reachableFrom) - s.top > MAX_STEP_UP
    ) {
      everyLedgeReachable = false;
    }
  }

  // Every standable surface must leave a standing player's head under the roof.
  // This is the invariant the raised floor would otherwise have broken silently:
  // the ground came up 90 units and the tallest ledge went with it, straight
  // into the ceiling.
  let ledgesUnderRoof = true;
  for (const s of t.surfaces) {
    if (s.top >= FLOOR) continue;
    // A surface whose top is already inside the ceiling is a WALL — the plug at
    // the end of the world is one — and walls are not stood on. Only things a
    // player could land on need headroom.
    // Against the roof where the surface actually IS. A single number for the
    // whole world stopped being true the moment the sea and the parkour got
    // ceilings of their own.
    const roof = roofAt((s.x0 + s.x1) / 2);
    if (s.top <= roof) continue;
    if (s.top - tuning.player.height <= roof) ledgesUnderRoof = false;
  }

  // And every hazard has to be reachable-but-avoidable: a crusher whose block
  // stops above head height never threatens anything.
  //
  // Against the ground the hazard actually guards, not against the floor. The
  // floor was the only ground there was until the firebreak's causeway went in
  // two hundred units above it; measured against the floor, every hazard up
  // there reads as hanging harmlessly in the air when it is in fact sitting on
  // the only route across the fire.
  let hazardsBite = true;
  for (const h of t.hazards) {
    let lowest = -Infinity;
    for (let tick = 0; tick < h.period; tick++) {
      const box = hazardAt(h, tick);
      if (box.armed) lowest = Math.max(lowest, box.bottom);
    }
    // The highest standable top anywhere under the hazard's span.
    let deck: number = FLOOR;
    for (const s of t.surfaces) {
      if (s.x1 < h.x - h.size || s.x0 > h.x + h.size) continue;
      if (s.top < deck && s.top >= lowest - tuning.player.height * 2)
        deck = s.top;
    }
    if (lowest < deck - tuning.player.height) hazardsBite = false;
  }

  // The lintel has to be duckable and not walkable, or it is either a wall or
  // scenery. Both failures look identical from a screenshot.
  let lintelsDuckable = true;
  const standing = tuning.player.height;
  const sliding = tuning.player.height * tuning.movement.slideHeightScale;
  for (const s of t.surfaces) {
    if (s.top >= FLOOR || s.bottom >= FLOOR) continue;
    const clearance = FLOOR - s.bottom;
    if (clearance <= 0 || clearance >= standing) continue;
    // A gap full of sea is a gap you swim through, whatever its height.
    if (submergedSpan(s.x0, s.x1, s.bottom)) continue;
    if (clearance <= sliding) lintelsDuckable = false;
  }

  // Every trap has to be STANDABLE. A pressure plate under a low ledge is a
  // plate the player is shoved sideways off the moment they step on it, so the
  // trap can never fire the way it was designed to — and nothing about that is
  // visible from a screenshot.
  let trapsStandable = true;
  for (const trap of t.traps) {
    const head = trap.top - tuning.player.height;
    for (const s of t.surfaces) {
      if (s.top >= trap.top) continue;
      if (head >= s.bottom || trap.top <= s.top) continue;
      const half = tuning.player.width / 2;
      if (trap.x + half <= s.x0 || trap.x - half >= s.x1) continue;
      trapsStandable = false;
    }
  }

  // Nothing may be placed past the wall.
  let nothingPastTheWall = true;
  for (const a of [...t.chestAnchors, ...t.enemyAnchors]) {
    if (a.x > builtEnd - 40) nothingPastTheWall = false;
  }

  let fixturesClear = true;
  for (const s of shortcuts) {
    for (const fixture of [s.fromX, s.toX, s.leverX]) {
      const buried = t.surfaces.some(
        (v) => !v.thin && v.top < FLOOR && fixture >= v.x0 && fixture <= v.x1,
      );
      const overPit = t.spikes.some((v) => fixture >= v.x0 && fixture <= v.x1);
      if (buried || overPit) fixturesClear = false;
    }
  }

  return {
    surfaces: t.surfaces.length,
    traps: t.traps.length,
    chestAnchors: t.chestAnchors.length,
    enemyAnchors: t.enemyAnchors.length,
    /** No chest or monster is floating in the air. */
    anchorsOnSurfaces,
    /** MAX_STEP_UP is genuinely under what a jump clears. */
    stepUnderJump: MAX_STEP_UP < jumpRise,
    /** Nothing is placed where it cannot be climbed to. */
    everyLedgeReachable,
    /** And nothing standable is inside the ceiling. */
    ledgesUnderRoof,
    /** No pressure plate is under a ledge a standing player does not fit beneath. */
    trapsStandable,
    /** Every low overhang can be slid under and not walked under. */
    lintelsDuckable,
    /** Nothing is placed beyond the wall at the end. */
    nothingPastTheWall,
    /** Every moving hazard actually reaches the ground it guards. */
    hazardsBite,
    hazards: t.hazards.length,
    /** No lever or door is buried in scenery or hanging over a pit. */
    fixturesClear,
    /** The whole built environment is covered. */
    spansEnvironment: t.surfaces.some((s) => s.x1 >= builtEnd),
  };
}
