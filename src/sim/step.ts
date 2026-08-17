/**
 * The reducer. ARCH AD-1.
 *
 * step(state, intents) -> state. No I/O, no clock, no randomness sourced here.
 * Everything it needs arrives as an argument, and it returns a new state rather
 * than mutating the one it was given.
 *
 * Resolution order within a tick matters and is fixed: player action, player
 * movement, enemy decisions, then damage. Anything else and two builds of the
 * same inputs could disagree about who hit whom first.
 */

import { tuning } from "../config/tuning.ts";
import {
  burrowId,
  chuteId,
  geyserId,
  highRoadId,
  dungeonStart,
  environmentAt,
  interactReach,
  shortcutById,
  shortcuts,
  worldEnd,
} from "../config/dungeon.ts";
import {
  builtEnd,
  environmentsBuilt,
  chamber as CHAMBER,
  escapeAt,
  exitX,
  highRoad,
  inChamber,
  gateX,
  geyserVents,
  hazardAt,
  roofAt,
  wave,
  terrain,
  roomAt,
  tutorial as TUT,
} from "../config/terrain.ts";
import {
  blockHorizontally,
  ceilingSurface,
  duckUnder,
  groundUnder,
  inLava,
  inPoison,
  blocksShot,
  submerged,
  waterAt,
  ladderAt,
  landingSurface,
  safeGroundBefore,
  wallBeside,
  onSpikes,
} from "./collide.ts";
import { statsFor } from "../config/shop.ts";
import { Intent, has, pressed, type Intents } from "./intents.ts";
import type {
  ActionState,
  Eruption,
  Enemy,
  Player,
  SimEvent,
  SimState,
  Tutorial,
  TutorialStep,
} from "./types.ts";

const {
  movement: MOVE,
  room: ROOM,
  player: BODY,
  combat: COMBAT,
  enemies: ENEMY,
  parry: PARRY,
} = tuning;

const FLOOR = ROOM.floorY;
const GOBLIN = ENEMY.goblin;
const ARCHER = ENEMY.archer;
const WARDEN = ENEMY.warden;
const PHOENIX = ENEMY.phoenix;
const FLAMER = ENEMY.flamethrower;
const FIRE = tuning.fire;
const SWIM = tuning.swim;
const POISON = tuning.poison;
const KILN = ENEMY.kiln;
const SHARK = ENEMY.shark;
const CRAB = ENEMY.crab;
const LIZARD = ENEMY.lizard;
const BEE = ENEMY.bee;
const HOLLOW = ENEMY.hollow;
const REV = ENEMY.revenant;
/**
 * Where the Warden's leash is anchored.
 *
 * Duplicated from `index.ts` rather than imported: `index` imports `step`, so
 * the arrow points the other way and importing it back would be a cycle. Both
 * are one expression over `gateX`, which is the actual shared fact.
 */
const WARDEN_POST = gateX - 190;
/** And the Kiln's, in front of the way out of the fire. */
const KILN_POST = exitX - 210;
/** The Hollow's, at the bottom. With the mini-bosses gone it holds the exit. */
const HOLLOW_POST = Math.round((CHAMBER.x0 + CHAMBER.x1) / 2);
/** Widened from its literal type, for the collision helpers. */
const GOBLIN_WIDTH: number = GOBLIN.width;
const TRAP = tuning.traps;
/** Fixed layout, indexed once — the reducer runs sixty times a second. */
const TRAPS_BY_ID = new Map(terrain.traps.map((t) => [t.id, t]));
/** How far above or below a chest still counts as standing at it. */
const CHEST_REACH_Y = 52;
/**
 * What a trap does: takes the run down to its last bar, or ends it.
 *
 * Not damage. Whatever health you walked in with, you walk out of a trap on one
 * bar — and if you were already on one, that is the run. It is the only cost in
 * the game that does not scale with how well things have been going, which is
 * the right shape for something you are meant to READ rather than fight:
 * reading it is worth exactly the same to everybody.
 */
function trapped(hp: number, bar: number): number {
  return hp <= bar + 0.001 ? 0 : bar;
}

export type Box = { left: number; right: number; top: number; bottom: number };

function overlaps(a: Box, b: Box): boolean {
  return (
    a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
  );
}

/** How tall the body is right now. A slide is lower than a crouch. */
export function playerHeight(stance: Player["stance"]): number {
  if (stance === "sliding") return BODY.height * MOVE.slideHeightScale;
  if (stance === "crouching") return BODY.height * MOVE.crouchHeightScale;
  return BODY.height;
}

function playerBox(p: Player): Box {
  const h = playerHeight(p.stance);
  return {
    left: p.x - BODY.width / 2,
    right: p.x + BODY.width / 2,
    top: p.y - h,
    bottom: p.y,
  };
}

/**
 * The stone an environment pays in.
 *
 * Grade tracks depth one for one, which is the whole of FR-10 now that the
 * chest table is identical everywhere: what changes with depth is the CURRENCY,
 * not the odds. Clamped to what is BUILT, so the game never hands out a grade
 * with no shop entry — the clamp lifts on its own as `environmentsBuilt` rises.
 *
 * Here rather than in `index.ts` because both the layout and the reducer need
 * it: chests are graded when the dungeon is built, and a monster's drop is
 * graded where it happened to die.
 */
export function gradeFor(environment: number): number {
  return Math.min(environment + 1, tuning.loot.grades, environmentsBuilt);
}

/** An enemy's own dimensions. Difficulty is verb breadth, but size is not. */
export function enemySize(kind: Enemy["kind"]) {
  if (kind === "enemy.archer") return ARCHER;
  if (kind === "enemy.warden") return WARDEN;
  if (kind === "enemy.phoenix") return PHOENIX;
  if (kind === "enemy.kiln") return KILN;
  if (kind === "enemy.shark") return SHARK;
  if (kind === "enemy.crab") return CRAB;
  if (kind === "enemy.lizard") return LIZARD;
  if (kind === "enemy.bee") return BEE;
  if (kind === "enemy.hollow") return HOLLOW;
  if (kind === "enemy.revenant") return REV;
  if (kind === "enemy.flamer") return FLAMER;
  return GOBLIN;
}

function enemyBox(e: Enemy): Box {
  const size = enemySize(e.kind);
  // Under the floor there is nothing to hit and nothing to be hit BY.
  //
  // The Hollow spends a second at a time as a patch of dark travelling along
  // the ground, and while it is down there the body is not in the room: a
  // sword swung at it passes through, and it cannot shove or strike anybody
  // either. Expressed as a box of nothing rather than as a check at each of the
  // seven places that ask for one, because seven places is seven chances to
  // forget.
  if (underneath(e)) {
    return { left: e.x, right: e.x, top: e.y, bottom: e.y };
  }
  return {
    left: e.x - size.width / 2,
    right: e.x + size.width / 2,
    top: e.y - size.height,
    bottom: e.y,
  };
}

/** Whether this enemy is currently inside the floor rather than on it. */
export function underneath(e: Enemy): boolean {
  return (
    e.kind === "enemy.hollow" &&
    e.attackKind === "sink" &&
    (e.phase === "striking" ||
      // The last third of the sink and the first third of the rise are still
      // under, so the two boundaries are not frames where a shadow flickers
      // back into something you can hit.
      (e.phase === "telegraphing" && e.phaseTicks > HOLLOW.sinkTicks * 0.6) ||
      (e.phase === "recovering" && e.phaseTicks < HOLLOW.riseTicks * 0.3))
  );
}


/**
 * A swing's hitbox, projected ahead of whoever threw it.
 *
 * `top` and `bottom` are heights above the feet. For the player this is the
 * band the blade actually sweeps rather than the whole body — the attack box is
 * the sword, so a swing does not connect with someone's ankles.
 */
function swingBox(
  x: number,
  y: number,
  facing: 1 | -1,
  reach: number,
  top: number,
  bottom = 0,
): Box {
  return {
    left: facing > 0 ? x : x - reach,
    right: facing > 0 ? x + reach : x,
    top: y - top,
    bottom: y - bottom,
  };
}

function stepAction(action: ActionState): ActionState {
  if (action.kind === null && action.lockout === 0) return action;
  const lockout = action.lockout > 0 ? action.lockout - 1 : 0;
  if (lockout === 0)
    return { kind: null, elapsed: 0, lockout: 0, variant: action.variant };
  return {
    kind: action.kind,
    elapsed: action.elapsed + 1,
    lockout,
    variant: action.variant,
  };
}

export function isBusy(p: Player): boolean {
  return p.action.lockout > 0 || p.dashTicks > 0;
}

/** True while a block is inside its parry window rather than its punish tail. */
export function isParrying(p: Player): boolean {
  return p.action.kind === "block" && p.action.elapsed < COMBAT.parryWindow;
}

/**
 * Live frames of the player's own swing, by action kind.
 * Exported so the renderer can draw exactly what the sim resolves — a swing the
 * player cannot see is a swing they will not believe happened.
 */
export function playerHitbox(
  p: Player,
  reach: number = BODY.attackReach,
  smashRadius: number = BODY.smashRadius,
): Box | null {
  if (p.action.kind === "attack") {
    const t = p.action.elapsed;
    if (t < BODY.attackStartup || t >= BODY.attackStartup + BODY.attackActive)
      return null;
    return swingBox(
      p.x,
      p.y,
      p.facing,
      reach,
      BODY.height * BODY.attackBoxTop,
      BODY.height * BODY.attackBoxBottom,
    );
  }
  if (p.action.kind === "smash") {
    // Only live for a moment after touchdown, and it hits BOTH sides — the one
    // attack that answers being surrounded (PRD FR-5.5).
    if (p.action.elapsed >= BODY.smashActive) return null;
    return {
      left: p.x - smashRadius,
      right: p.x + smashRadius,
      top: p.y - BODY.height * 0.5,
      bottom: p.y,
    };
  }
  if (p.action.kind === "stun") {
    const t = p.action.elapsed;
    if (t < BODY.stunStartup || t >= BODY.stunStartup + BODY.stunActive)
      return null;
    return swingBox(
      p.x,
      p.y,
      p.facing,
      BODY.stunReach,
      BODY.height * BODY.attackBoxTop,
      BODY.height * BODY.attackBoxBottom,
    );
  }
  return null;
}

/**
 * Enemy decisions. Deterministic and readable on purpose — the player has to be
 * able to learn the tell, or the parry is unfair (PRD FR-6.1).
 */
/**
 * Gravity and ground for an enemy, applied after whatever it decided to do.
 *
 * Goblins had no vertical physics at all: they translated in x at a fixed y,
 * which was invisible while the world was one flat floor and became absurd the
 * moment it was not — a goblin under a ledge would stand there swinging at the
 * air beneath the player's feet forever.
 */
function fall(e: Enemy, fromX: number): Enemy {
  const vy = Math.min(e.vy + MOVE.gravity, MOVE.maxFallSpeed);
  const y = e.y + vy;
  // Nothing hunts you outside, and now nothing WALKS out either. The mouth is
  // the dungeon's boundary in both directions: a goblin chasing the player out
  // through the entrance would be strolling across open ground and straight
  // through the drawn cliff — the same hole the player was walking through
  // before the art was cut back off the approach.
  // The enemy's OWN size. This used to be the goblin's for everybody, which
  // was invisible until a second enemy existed and then quietly shoved every
  // archer two units sideways on the first tick — including the ones that were
  // supposed to be asleep.
  const size = enemySize(e.kind);
  const width: number = size.width;
  // Clamped to the built world — except in the chamber, which is built PAST
  // that end on purpose and has walls of its own.
  //
  // The player learned this lesson first, and the boss learned it the hard way:
  // standing it in the chamber and switching it on, it was dragged four hundred
  // units west on the first tick and spent the whole run standing inside the
  // world's end wall. What that looked like from a test was "a monster fifty
  // thousand units away moved by itself".
  const eRoom = roomAt(e.x);
  const x = eRoom
    ? Math.min(Math.max(e.x, eRoom.x0 + width / 2), eRoom.x1 - width / 2)
    : Math.min(Math.max(e.x, dungeonStart + width / 2), builtEnd - width / 2);
  const landed = landingSurface(x, e.y, y, vy, width);
  const feet = landed ? landed.top : y;
  // And the same walls the player has. Enemies fell onto surfaces but walked
  // straight THROUGH them: they had the vertical half of collision and none of
  // the horizontal, so a goblin crossed a raised block or a lintel as if it
  // were painted on.
  const solid = blockHorizontally(x, fromX, feet, size.height, width);
  return { ...e, x: solid, y: feet, vy: landed ? 0 : vy };
}

/**
 * The archer. PRD FR-7.2 — a different verb set, not a tougher goblin.
 *
 * It backs away to keep the range it wants and draws from there, so the fight
 * it creates is about closing distance rather than about trading swings. The
 * draw is nearly a second because the tell has to be readable across a room:
 * that is the whole exchange, and an arrow you cannot see coming is a tax.
 */
function stepArcher(e: Enemy, player: Player): Enemy {
  const ticks = e.phaseTicks + 1;
  const dx = player.x - e.x;
  const distance = Math.abs(dx);
  const facing: 1 | -1 = dx >= 0 ? 1 : -1;

  switch (e.phase) {
    case "staggered":
      return fall(
        ticks >= PARRY.staggerTicks
          ? {
              ...e,
              phase: "approaching",
              phaseTicks: 0,
              parriedThisTick: false,
            }
          : { ...e, phaseTicks: ticks, parriedThisTick: false },
        e.x,
      );
    case "recovering":
      return fall(
        ticks >= ARCHER.recovery
          ? { ...e, phase: "approaching", phaseTicks: 0 }
          : { ...e, phaseTicks: ticks },
        e.x,
      );
    case "striking":
      // The loose itself is one tick; the arrow is spawned by the caller.
      return fall({ ...e, phase: "recovering", phaseTicks: 0 }, e.x);
    case "telegraphing":
      // Committed once drawing. Walking out of the line is the answer, and it
      // only works if the draw does not track.
      return fall(
        ticks >= ARCHER.telegraph
          ? { ...e, phase: "striking", phaseTicks: 0 }
          : { ...e, phaseTicks: ticks },
        e.x,
      );
    default: {
      if (distance > ENEMY.activationRange)
        return fall({ ...e, phase: "idle", phaseTicks: 0, facing }, e.x);
      // Too close: give ground rather than draw. An archer that let you stand
      // on it would just be a slow goblin.
      if (distance < ARCHER.keepAway) {
        const x = e.x - facing * ARCHER.speed;
        return fall(
          { ...e, x, facing, phase: "approaching", phaseTicks: ticks },
          e.x,
        );
      }
      if (
        distance <= ARCHER.range &&
        Math.abs(e.y - player.y) < ARCHER.verticalReach
      ) {
        return fall(
          { ...e, phase: "telegraphing", phaseTicks: 0, facing },
          e.x,
        );
      }
      const x = e.x + facing * ARCHER.speed;
      return fall(
        { ...e, x, facing, phase: "approaching", phaseTicks: ticks },
        e.x,
      );
    }
  }
}

/**
 * The phoenix. Environment 2's archer, with the ground taken away.
 *
 * Everything an archer does, except that it does not stand anywhere: it rides a
 * fixed height above whatever is under it, so there is no ledge to knock it off
 * and no floor to corner it on. Height stops being a position the player can
 * take away from it and becomes the thing it simply has.
 *
 * The hover is driven, not simulated. A phoenix with buoyancy would need a
 * spring and a damper and would still end up somewhere slightly different on
 * two machines; being told where to be is both cheaper and exactly reproducible.
 */
function stepPhoenix(e: Enemy, player: Player, tick: number): Enemy {
  const ticks = e.phaseTicks + 1;
  const dx = player.x - e.x;
  const distance = Math.abs(dx);
  const facing: 1 | -1 = dx >= 0 ? 1 : -1;

  /** Ride to the altitude for this x, rather than fall to the floor. */
  const ride = (n: Enemy): Enemy => {
    // Against the FLOOR, not against whatever is nearest. Measured from the
    // nearest surface, a phoenix climbing past a ledge finds the ledge, decides
    // it is now too low, climbs again, and walks itself up into the roof — which
    // is exactly what the first one did.
    const ground = groundUnder(n.x, ROOM.floorY - 40);
    const want =
      ground - PHOENIX.hover + PHOENIX.bob * wave(tick, PHOENIX.bobPeriod, 0);
    const toward = want - n.y;
    const climb = Math.max(-3.2, Math.min(3.2, toward));
    return { ...n, y: n.y + climb, vy: 0 };
  };

  switch (e.phase) {
    case "staggered":
      return ride(
        ticks >= PARRY.staggerTicks
          ? {
              ...e,
              phase: "approaching",
              phaseTicks: 0,
              parriedThisTick: false,
            }
          : { ...e, phaseTicks: ticks, parriedThisTick: false },
      );
    case "recovering":
      return ride(
        ticks >= PHOENIX.recovery
          ? { ...e, phase: "approaching", phaseTicks: 0 }
          : { ...e, phaseTicks: ticks },
      );
    case "striking":
      return ride({ ...e, phase: "recovering", phaseTicks: 0 });
    case "telegraphing":
      // Committed once it is winding up, so walking out of the line works.
      return ride(
        ticks >= PHOENIX.telegraph
          ? { ...e, phase: "striking", phaseTicks: 0 }
          : { ...e, phaseTicks: ticks },
      );
    default: {
      if (distance > ENEMY.activationRange) {
        // Asleep is STILL, hover or no hover. A phoenix that kept trimming its
        // altitude across the map would be a phoenix the player can see moving
        // from four screens away, and FR-7 wants distant monsters inert.
        return { ...e, phase: "idle", phaseTicks: 0, facing };
      }
      if (distance < PHOENIX.keepAway) {
        return ride({
          ...e,
          x: e.x - facing * PHOENIX.speed,
          facing,
          phase: "approaching",
          phaseTicks: ticks,
        });
      }
      if (
        distance <= PHOENIX.range &&
        Math.abs(e.y - player.y) < PHOENIX.verticalReach
      ) {
        return ride({ ...e, phase: "telegraphing", phaseTicks: 0, facing });
      }
      return ride({
        ...e,
        x: e.x + facing * PHOENIX.speed,
        facing,
        phase: "approaching",
        phaseTicks: ticks,
      });
    }
  }
}

/**
 * The flamethrower. Environment 2's pressure.
 *
 * The first enemy that is not a question about a single frame. It closes, it
 * lights up for two seconds, and then for one second it can do nothing at all —
 * so the fight is not "read the swing", it is "be somewhere else for the two and
 * somewhere useful for the one". The cooldown is the opening, and it is long
 * enough to spend properly: the whole design is that you cannot out-trade it,
 * you have to out-wait it.
 *
 * It commits. Once the jet is lit it keeps burning whether or not you are still
 * in front of it, because a flamethrower that switched off the moment it missed
 * would have no cooldown worth waiting for.
 */
function stepFlamer(e: Enemy, player: Player): Enemy {
  const ticks = e.phaseTicks + 1;
  const dx = player.x - e.x;
  const distance = Math.abs(dx);
  const facing: 1 | -1 = dx >= 0 ? 1 : -1;

  switch (e.phase) {
    case "staggered":
      return fall(
        ticks >= PARRY.staggerTicks
          ? {
              ...e,
              phase: "approaching",
              phaseTicks: 0,
              parriedThisTick: false,
            }
          : { ...e, phaseTicks: ticks, parriedThisTick: false },
        e.x,
      );
    case "recovering":
      // The cooldown. It cannot attack, and it does not advance either — this
      // is the second the player is being handed.
      return fall(
        ticks >= FLAMER.cooldownTicks
          ? { ...e, phase: "approaching", phaseTicks: 0 }
          : { ...e, phaseTicks: ticks },
        e.x,
      );
    case "striking":
      // Burning. Held for the full window, aimed where it was aimed.
      return fall(
        ticks >= FLAMER.burnTicks
          ? { ...e, phase: "recovering", phaseTicks: 0 }
          : { ...e, phaseTicks: ticks },
        e.x,
      );
    case "telegraphing":
      return fall(
        ticks >= FLAMER.telegraph
          ? { ...e, phase: "striking", phaseTicks: 0 }
          : { ...e, phaseTicks: ticks },
        e.x,
      );
    default: {
      if (distance > ENEMY.activationRange)
        return fall({ ...e, phase: "idle", phaseTicks: 0, facing }, e.x);
      if (distance <= FLAMER.reach - 20)
        return fall(
          { ...e, phase: "telegraphing", phaseTicks: 0, facing },
          e.x,
        );
      const x = distance < FLAMER.engage ? e.x + facing * FLAMER.speed : e.x;
      return fall(
        { ...e, x, facing, phase: "approaching", phaseTicks: ticks },
        e.x,
      );
    }
  }
}

/**
 * Bodies a dash does NOT pass through.
 *
 * The slide goes through a goblin, which is what makes it an escape as well as
 * a dodge. It goes through neither boss, because a boss is a door: the whole
 * point of the thing is that the ground behind it is not available yet.
 */
export function isLock(kind: Enemy["kind"]): boolean {
  return (
    kind === "enemy.warden" ||
    kind === "enemy.kiln" ||
    kind === "enemy.hollow" ||
    kind === "enemy.revenant"
  );
}

/** Whether the Kiln has opened up. Half health, and it stays open. */
function kilnEnraged(e: Enemy): boolean {
  return e.hp <= KILN.maxHp * KILN.enrageAt;
}

/** How far its heat reaches right now. */
export function kilnAura(e: Enemy): number {
  return KILN.auraRadius * (kilnEnraged(e) ? KILN.enrageAura : 1);
}

/**
 * The Kiln. Environment 2's mini-boss.
 *
 * Structurally the Warden's fight — two attacks chosen by distance, opposite
 * answers, leashed to the door it is standing on — and it plays nothing like it,
 * because of the one thing that is not an attack at all: the heat. The front of
 * this boss is on fire. You cannot stand there and read it, which means the
 * reading has to happen from outside its reach and the commitment has to be
 * made before you can see what it is doing.
 *
 * Chosen on distance rather than at random, for the reason the Warden's is: a
 * boss that picks its attack by coin toss is a coin toss with a health bar, and
 * one that picks on where you stand lets the player choose which test to take.
 */
function stepKiln(e: Enemy, player: Player, post: number): Enemy {
  const ticks = e.phaseTicks + 1;
  const dx = player.x - e.x;
  const distance = Math.abs(dx);
  const facing: 1 | -1 = dx >= 0 ? 1 : -1;

  switch (e.phase) {
    case "staggered":
      return fall(
        ticks >= PARRY.staggerTicks
          ? { ...e, phase: "idle", phaseTicks: 0, parriedThisTick: false }
          : { ...e, phaseTicks: ticks, parriedThisTick: false },
        e.x,
      );
    case "recovering": {
      const over = e.attackKind === "slam" ? KILN.eruptRecovery : KILN.recovery;
      return fall(
        ticks >= over
          ? { ...e, phase: "idle", phaseTicks: 0 }
          : { ...e, phaseTicks: ticks },
        e.x,
      );
    }
    case "striking":
      // The rake's active window; the eruption's columns are spawned by the
      // caller on the frame it commits and outlive this phase entirely.
      return fall(
        ticks >= (e.attackKind === "slam" ? 1 : KILN.active)
          ? { ...e, phase: "recovering", phaseTicks: 0 }
          : { ...e, phaseTicks: ticks },
        e.x,
      );
    case "telegraphing": {
      const wind =
        e.attackKind === "slam" ? KILN.eruptTelegraph : KILN.telegraph;
      return fall(
        ticks >= wind
          ? { ...e, phase: "striking", phaseTicks: 0 }
          : { ...e, phaseTicks: ticks },
        e.x,
      );
    }
    default: {
      if (distance > ENEMY.activationRange)
        return fall({ ...e, phase: "idle", phaseTicks: 0, facing }, e.x);

      // Close enough to rake, and far enough to open the floor. The band
      // between the two is where the fight is decided.
      if (distance <= KILN.reach) {
        return fall(
          {
            ...e,
            phase: "telegraphing",
            phaseTicks: 0,
            facing,
            attackKind: "swing",
          },
          e.x,
        );
      }
      if (distance <= KILN.eruptRange) {
        return fall(
          {
            ...e,
            phase: "telegraphing",
            phaseTicks: 0,
            facing,
            attackKind: "slam",
          },
          e.x,
        );
      }

      // Otherwise shuffle back toward its post. It is a door, not a hunter.
      const home = e.x < post ? 1 : -1;
      const drift = Math.abs(e.x - post) > 6 ? home * KILN.speed : 0;
      return fall({ ...e, x: e.x + drift, facing, phaseTicks: ticks }, e.x);
    }
  }
}

/**
 * The shark. Environment 3.
 *
 * The only thing in the game that is faster than the player in its own element,
 * and it cannot leave that element — so the answer is never to out-fight it, it
 * is to be out of the water. It swims a lane rather than pathing: it drives at
 * you along its own depth, overshoots, turns, and comes back, which reads as
 * circling and is three lines of arithmetic.
 */
function stepShark(e: Enemy, player: Player): Enemy {
  const ticks = e.phaseTicks + 1;
  const dx = player.x - e.x;
  const distance = Math.abs(dx);
  const facing: 1 | -1 = dx >= 0 ? 1 : -1;
  const wet = waterAt(player.x, player.y, BODY.height) !== null;

  // It holds its own depth. Not approximately — exactly: `y` is never written
  // in this function, and every branch below passes `e.y` straight through.
  //
  // It used to be clamped into its water body each tick, which sounds like the
  // same thing and is not. The seabed slopes, so a shark swimming along it was
  // pushed up as the bed rose and down as it fell, and what that looked like
  // from the player's side was a shark rising to meet you — a thing that hunts
  // in two dimensions, in the one place where you are slow in both.
  //
  // So it patrols a LANE. Left and right along the depth it was placed at, and
  // when the lane runs out — the bed comes up, or the water ends — it turns
  // around rather than following the floor.
  const y = e.y;
  /** Whether the lane still exists that way. */
  const laneAt = (x: number) => waterAt(x, y, SHARK.height) !== null;
  /** One step that way, or a turn if the lane has run out. */
  const swim = (dir: 1 | -1, speed: number) =>
    laneAt(e.x + dir * speed + dir * SHARK.width * 0.5)
      ? { x: e.x + dir * speed, facing: dir }
      : { x: e.x, facing: -dir as 1 | -1 };

  switch (e.phase) {
    case "staggered":
      return ticks >= PARRY.staggerTicks
        ? { ...e, y, phase: "idle", phaseTicks: 0, parriedThisTick: false }
        : { ...e, y, phaseTicks: ticks, parriedThisTick: false };
    case "recovering":
      // The turn. It keeps going past you and comes about.
      return ticks >= SHARK.recovery
        ? { ...e, y, phase: "idle", phaseTicks: 0 }
        : { ...e, y, ...swim(e.facing, SHARK.speed * 0.6), phaseTicks: ticks };
    case "striking":
      return { ...e, y, phase: "recovering", phaseTicks: 0 };
    case "telegraphing":
      return ticks >= SHARK.telegraph
        ? { ...e, y, phase: "striking", phaseTicks: 0 }
        : { ...e, y, phaseTicks: ticks };
    default: {
      if (!wet || distance > SHARK.leash) {
        return { ...e, y, phase: "idle", phaseTicks: 0 };
      }
      if (distance <= SHARK.reach) {
        return { ...e, y, facing, phase: "telegraphing", phaseTicks: 0 };
      }
      return {
        ...e,
        y,
        ...swim(facing, SHARK.speed),
        phase: "approaching",
        phaseTicks: ticks,
      };
    }
  }
}

/**
 * The crab. Environment 3's beach.
 *
 * Slow, and it always faces you — so the front of it is never the answer. What
 * makes it interesting is that it is short: a slide goes under its claw, which
 * is the one place in the game where the slide is an ATTACK setup rather than
 * an escape.
 */
function stepCrab(e: Enemy, player: Player): Enemy {
  const ticks = e.phaseTicks + 1;
  const dx = player.x - e.x;
  const distance = Math.abs(dx);
  const facing: 1 | -1 = dx >= 0 ? 1 : -1;

  switch (e.phase) {
    case "staggered":
      return fall(
        ticks >= PARRY.staggerTicks
          ? {
              ...e,
              phase: "approaching",
              phaseTicks: 0,
              parriedThisTick: false,
            }
          : { ...e, phaseTicks: ticks, parriedThisTick: false },
        e.x,
      );
    case "recovering":
      return fall(
        ticks >= CRAB.recovery
          ? { ...e, phase: "approaching", phaseTicks: 0 }
          : { ...e, phaseTicks: ticks },
        e.x,
      );
    case "striking":
      return fall(
        ticks >= CRAB.active
          ? { ...e, phase: "recovering", phaseTicks: 0 }
          : { ...e, phaseTicks: ticks },
        e.x,
      );
    case "telegraphing":
      return fall(
        ticks >= CRAB.telegraph
          ? { ...e, phase: "striking", phaseTicks: 0 }
          : { ...e, phaseTicks: ticks },
        e.x,
      );
    default: {
      if (distance > ENEMY.activationRange)
        return fall({ ...e, phase: "idle", phaseTicks: 0, facing }, e.x);
      if (distance <= CRAB.reach)
        return fall(
          { ...e, facing, phase: "telegraphing", phaseTicks: 0 },
          e.x,
        );
      return fall(
        {
          ...e,
          x: e.x + facing * CRAB.speed,
          facing,
          phase: "approaching",
          phaseTicks: ticks,
        },
        e.x,
      );
    }
  }
}

/** The lizard. A goblin's fight, with three seconds of poison on the end. */
function stepLizard(e: Enemy, player: Player): Enemy {
  const ticks = e.phaseTicks + 1;
  const dx = player.x - e.x;
  const distance = Math.abs(dx);
  const facing: 1 | -1 = dx >= 0 ? 1 : -1;

  switch (e.phase) {
    case "staggered":
      return fall(
        ticks >= PARRY.staggerTicks
          ? {
              ...e,
              phase: "approaching",
              phaseTicks: 0,
              parriedThisTick: false,
            }
          : { ...e, phaseTicks: ticks, parriedThisTick: false },
        e.x,
      );
    case "recovering":
      return fall(
        ticks >= LIZARD.recovery
          ? { ...e, phase: "approaching", phaseTicks: 0 }
          : { ...e, phaseTicks: ticks },
        e.x,
      );
    case "striking":
      return fall(
        ticks >= LIZARD.active
          ? { ...e, phase: "recovering", phaseTicks: 0 }
          : { ...e, phaseTicks: ticks },
        e.x,
      );
    case "telegraphing":
      return fall(
        ticks >= LIZARD.telegraph
          ? { ...e, phase: "striking", phaseTicks: 0 }
          : { ...e, phaseTicks: ticks },
        e.x,
      );
    default: {
      if (distance > ENEMY.activationRange)
        return fall({ ...e, phase: "idle", phaseTicks: 0, facing }, e.x);
      if (distance <= LIZARD.reach)
        return fall(
          { ...e, facing, phase: "telegraphing", phaseTicks: 0 },
          e.x,
        );
      return fall(
        {
          ...e,
          x: e.x + facing * LIZARD.speed,
          facing,
          phase: "approaching",
          phaseTicks: ticks,
        },
        e.x,
      );
    }
  }
}

/**
 * The bee. Environment 5.
 *
 * One question, asked once. It hovers, picks a line, and dives along it; if it
 * lands, that is two bars, more than anything else in the game. And it dies
 * whatever happens next — blocked, hit, or having stung — so it is never a
 * fight, only a read.
 *
 * It commits absolutely. Once diving it does not steer, because a homing thing
 * that takes two bars would have no answer at all.
 */
function stepBee(e: Enemy, player: Player, tick: number): Enemy {
  const ticks = e.phaseTicks + 1;
  const dx = player.x - e.x;
  const dy = player.y - BODY.height * 0.5 - e.y;
  const distance = Math.abs(dx);
  const facing: 1 | -1 = dx >= 0 ? 1 : -1;

  switch (e.phase) {
    case "staggered":
    case "recovering":
      // It does not recover. Anything that interrupts a bee kills it, and the
      // drop payout keys off the transition into `dead`.
      return { ...e, hp: 0, phase: "dead", phaseTicks: 0 };
    case "striking": {
      // Diving, along the line it chose, until it hits something or runs out.
      const next = { ...e, x: e.x + e.vx, y: e.y + e.vy, phaseTicks: ticks };
      if (ticks > 90)
        return { ...next, hp: 0, phase: "dead" as const, phaseTicks: 0 };
      return next;
    }
    case "telegraphing": {
      if (ticks < BEE.telegraph) {
        return { ...e, phaseTicks: ticks, facing };
      }
      // Lock the line in now, and never touch it again.
      const reach = Math.max(Math.sqrt(dx * dx + dy * dy), 0.001);
      return {
        ...e,
        phase: "striking",
        phaseTicks: 0,
        facing,
        vx: (dx / reach) * BEE.speed,
        vy: (dy / reach) * BEE.speed,
      };
    }
    default: {
      const ground = groundUnder(e.x, ROOM.floorY - 40);
      const want = ground - BEE.hover + BEE.bob * wave(tick, BEE.bobPeriod, 0);
      const y = e.y + Math.max(-2.4, Math.min(2.4, want - e.y));
      if (distance > BEE.range)
        return { ...e, y, phase: "idle", phaseTicks: 0, facing };
      return { ...e, y, facing, phase: "telegraphing", phaseTicks: 0 };
    }
  }
}

/**
 * The Hollow. The bottom of the dungeon, and the only boss left.
 *
 * With the mini-bosses gone this is the whole of the game's boss design, so it
 * carries what they were each carrying: the Warden's readable single attack,
 * the Kiln's insistence that where you stand is the fight, and a phase change
 * so the back half is not the front half with a shorter bar.
 *
 * Two attacks with opposite answers, chosen by distance, exactly as before —
 * close is a sweep you parry, far is a wave along the floor you jump. Under
 * half health it stops choosing and does both, alternating, which is the only
 * time the game asks you to hold two reads at once.
 */
function stepHollow(
  e: Enemy,
  player: Player,
  post: number,
  tick: number,
): Enemy {
  const ticks = e.phaseTicks + 1;
  const dx = player.x - e.x;
  const distance = Math.abs(dx);
  const facing: 1 | -1 = dx >= 0 ? 1 : -1;
  const desperate = e.hp <= HOLLOW.maxHp * HOLLOW.enrageAt;

  switch (e.phase) {
    case "staggered":
      return fall(
        ticks >= PARRY.staggerTicks
          ? { ...e, phase: "idle", phaseTicks: 0, parriedThisTick: false }
          : { ...e, phaseTicks: ticks, parriedThisTick: false },
        e.x,
      );
    case "recovering":
      // The rise. Helpless for all of it, and that is the fight's only free
      // damage — earned by having read where the patch was going rather than by
      // out-trading two hundred health.
      if (e.attackKind === "sink") {
        return ticks >= HOLLOW.riseTicks
          ? fall({ ...e, phase: "idle", phaseTicks: 0 }, e.x)
          : { ...e, phaseTicks: ticks };
      }
      return fall(
        ticks >=
          (e.attackKind === "slam" ? HOLLOW.waveRecovery : HOLLOW.recovery)
          ? { ...e, phase: "idle", phaseTicks: 0 }
          : { ...e, phaseTicks: ticks },
        e.x,
      );
    case "striking":
      // Travelling, as a patch on the floor. It moves toward the player at a
      // speed a walk can beat — the answer to this attack is to not be standing
      // where it is going, and an unoutrunnable patch would make the answer
      // "guess".
      if (e.attackKind === "sink") {
        if (ticks >= HOLLOW.slideTicks) {
          return { ...e, phase: "recovering", phaseTicks: 0 };
        }
        const toward = dx >= 0 ? 1 : -1;
        return {
          ...e,
          x: e.x + toward * HOLLOW.slideSpeed,
          facing: toward,
          phaseTicks: ticks,
        };
      }
      return fall(
        ticks >= (e.attackKind === "slam" ? 1 : HOLLOW.active)
          ? { ...e, phase: "recovering", phaseTicks: 0 }
          : { ...e, phaseTicks: ticks },
        e.x,
      );
    case "telegraphing":
      if (e.attackKind === "sink") {
        return ticks >= HOLLOW.sinkTicks
          ? { ...e, phase: "striking", phaseTicks: 0 }
          : fall({ ...e, phaseTicks: ticks }, e.x);
      }
      return fall(
        ticks >=
          (e.attackKind === "slam" ? HOLLOW.waveTelegraph : HOLLOW.telegraph)
          ? { ...e, phase: "striking", phaseTicks: 0 }
          : { ...e, phaseTicks: ticks },
        e.x,
      );
    default: {
      if (distance > ENEMY.activationRange)
        return fall({ ...e, phase: "idle", phaseTicks: 0, facing }, e.x);

      // Every few seconds it goes under the floor instead of attacking.
      //
      // On a clock rather than on a roll, for the reason every other choice
      // this boss makes is on distance: a reducer with no randomness of its own
      // (ARCH AD-1) has nowhere to roll from, and a boss that teleported at
      // random would be a coin flip with a health bar. On a clock it is a beat
      // the player can learn to expect and then to use — the rise is the only
      // window in the fight, and a window you can predict is a window you can
      // set up for.
      //
      // Measured off the run's own tick so it keeps time whatever the player
      // does, and offset by the boss's position so two of them could never
      // move together.
      // A WINDOW rather than an instant. The boss is only in this branch for a
      // handful of ticks between attacks — seven out of every seven hundred in
      // the first measurement — so a two-tick trigger fired essentially never
      // and the third verb did not exist. A third of the cycle is open, and the
      // `attackKind` guard is what stops it sinking twice running.
      const beat = Math.round(HOLLOW.sinkEvery);
      const phaseAt = (tick + Math.round(post)) % beat;
      if (
        phaseAt < beat / 3 &&
        e.attackKind !== "sink" &&
        distance < HOLLOW.waveRange
      ) {
        return fall(
          {
            ...e,
            facing,
            phase: "telegraphing",
            phaseTicks: 0,
            attackKind: "sink",
          },
          e.x,
        );
      }

      // Desperate, it alternates instead of choosing, so neither answer works
      // twice running.
      const kind: "swing" | "slam" = desperate
        ? e.attackKind === "swing"
          ? "slam"
          : "swing"
        : distance <= HOLLOW.reach
          ? "swing"
          : "slam";

      if (kind === "swing" && distance > HOLLOW.reach) {
        const home = e.x < post ? 1 : -1;
        const drift = Math.abs(e.x - post) > 6 ? home * HOLLOW.speed : 0;
        return fall({ ...e, x: e.x + drift, facing, phaseTicks: ticks }, e.x);
      }
      if (kind === "slam" && distance > HOLLOW.waveRange) {
        const home = e.x < post ? 1 : -1;
        const drift = Math.abs(e.x - post) > 6 ? home * HOLLOW.speed : 0;
        return fall({ ...e, x: e.x + drift, facing, phaseTicks: ticks }, e.x);
      }
      return fall(
        {
          ...e,
          facing,
          phase: "telegraphing",
          phaseTicks: 0,
          attackKind: kind,
        },
        e.x,
      );
    }
  }
}

/**
 * The Warden. Environment 1's mini-boss.
 *
 * Two attacks with OPPOSITE answers, chosen by how far away the player is
 * standing rather than at random:
 *
 *   close  a high cut     — parry it, or eat a bar
 *   back   both fists     — jump it; the parry cannot help you here
 *
 * Deterministic on purpose. A boss that picked at random would be a coin flip
 * with a health bar; picking on distance means the player chooses which test
 * they are taking by choosing where to stand, and both tests stay learnable.
 *
 * Leashed. It is a door, not a hunter — walk far enough away and it goes back
 * to standing on the exit, because standing on the exit is its entire job.
 */
function stepWarden(e: Enemy, player: Player, post: number): Enemy {
  const ticks = e.phaseTicks + 1;
  const dx = player.x - e.x;
  const distance = Math.abs(dx);
  const facing: 1 | -1 = dx >= 0 ? 1 : -1;

  switch (e.phase) {
    case "staggered":
      return fall(
        ticks >= PARRY.staggerTicks
          ? {
              ...e,
              phase: "approaching",
              phaseTicks: 0,
              parriedThisTick: false,
            }
          : { ...e, phaseTicks: ticks, parriedThisTick: false },
        e.x,
      );

    case "recovering": {
      const wait = WARDEN.recovery;
      return fall(
        ticks >= wait
          ? { ...e, phase: "approaching", phaseTicks: 0 }
          : { ...e, phaseTicks: ticks },
        e.x,
      );
    }

    case "striking": {
      const live = WARDEN.active;
      return fall(
        ticks >= live
          ? { ...e, phase: "recovering", phaseTicks: 0 }
          : { ...e, phaseTicks: ticks },
        e.x,
      );
    }

    case "telegraphing": {
      // Committed, and it will not turn to follow. Walking around a wind-up is
      // a real answer to it, exactly as it is to a goblin.
      const tell = WARDEN.telegraph;
      return fall(
        ticks >= tell
          ? { ...e, phase: "striking", phaseTicks: 0 }
          : { ...e, phaseTicks: ticks },
        e.x,
      );
    }

    case "idle":
    case "approaching":
    default: {
      if (distance > ENEMY.activationRange)
        return fall({ ...e, phase: "idle", phaseTicks: 0, facing }, e.x);

      // Vertically out of reach — on the ledge above it, say. It cannot jump,
      // so it holds its post rather than shuffling under the player forever.
      const level = Math.abs(e.y - player.y) < WARDEN.height;

      if (level && distance <= WARDEN.reach) {
        return fall(
          {
            ...e,
            facing,
            phase: "telegraphing",
            phaseTicks: 0,
            attackKind: "swing",
          },
          e.x,
        );
      }
      // Step toward the player, but never off the leash.
      const wanted = e.x + facing * WARDEN.speed;
      const x = Math.min(
        Math.max(wanted, post - WARDEN.leash),
        post + WARDEN.leash,
      );
      return fall(
        { ...e, x, facing, phase: "approaching", phaseTicks: ticks },
        e.x,
      );
    }
  }
}

/**
 * The Revenant. The bottom of the dungeon, and the only fight in the game
 * against something that fights the way you do.
 *
 * Its whole design is one sentence: it has the player's verb set with the stun
 * swapped for a fireball, and it parries half of what you throw at it.
 *
 * That single swap is what stops it being a mirror match. Your stun is the
 * guard-breaker — the answer to anything that blocks — and it does not have
 * one; it has a ranged attack instead. So the fight has a shape neither of you
 * chose: you cannot out-block it, because it can shoot you from across the
 * room, and it cannot out-block YOU, because the one thing its guard does not
 * stop is the stun.
 *
 * WHY THE COIN IS NOT A COIN. This reducer has no randomness of its own (ARCH
 * AD-1) and cannot have any, so "fifty per cent" is a hash of the tick and its
 * own position. It is a fixed, replayable function — the same run always plays
 * the same way — but nothing in it is legible from the outside, which is
 * exactly what a fifty-fifty needs to be. A player cannot learn it and cannot
 * be cheated by it.
 */
function stepRevenant(
  e: Enemy,
  player: Player,
  post: number,
  tick: number,
): Enemy {
  const ticks = e.phaseTicks + 1;
  const dx = player.x - e.x;
  const distance = Math.abs(dx);
  const facing: 1 | -1 = dx >= 0 ? 1 : -1;
  // Half health. It stops waiting: the fire comes sooner and it does not pause
  // between attacks.
  const desperate = e.hp <= REV.maxHp * REV.enrageAt;
  const guardTicks = (e.guardTicks ?? 0) > 0 ? (e.guardTicks ?? 0) - 1 : 0;

  switch (e.phase) {
    case "staggered":
      return fall(
        ticks >= PARRY.staggerTicks
          ? {
              ...e,
              guardTicks,
              phase: "idle",
              phaseTicks: 0,
              parriedThisTick: false,
            }
          : { ...e, guardTicks, phaseTicks: ticks, parriedThisTick: false },
        e.x,
      );
    case "recovering":
      return fall(
        ticks >= (e.attackKind === "fireball" ? REV.fireRecovery : REV.recovery)
          ? { ...e, guardTicks, phase: "idle", phaseTicks: 0 }
          : { ...e, guardTicks, phaseTicks: ticks },
        e.x,
      );
    case "striking":
      return fall(
        ticks >= (e.attackKind === "fireball" ? 1 : REV.active)
          ? { ...e, guardTicks, phase: "recovering", phaseTicks: 0 }
          : { ...e, guardTicks, phaseTicks: ticks },
        e.x,
      );
    case "telegraphing":
      return fall(
        ticks >=
          (e.attackKind === "fireball" ? REV.fireTelegraph : REV.telegraph)
          ? { ...e, guardTicks, phase: "striking", phaseTicks: 0 }
          : { ...e, guardTicks, phaseTicks: ticks },
        e.x,
      );
    default: {
      if (distance > ENEMY.activationRange)
        return fall(
          { ...e, guardTicks, phase: "idle", phaseTicks: 0, facing },
          e.x,
        );

      // Its whole decision, in the order a player would make it: get over the
      // thing in the way, hit what is next to you, throw if the fire is ready,
      // and otherwise close.
      //
      // The order matters more than any single rule in it. Attack-before-move
      // is what turned the first version into a turret — it was always in
      // range, so it always threw, so it never took a step in the entire fight.

      // BY DISTANCE, with a gap between the two bands.
      //
      // Two clocks were tried and both failed for the same measured reason:
      // this branch is only reached in the tick or two between attacks, those
      // gaps land at nearly fixed intervals, and any cycle the fire was put on
      // beat against them — one throw in a hundred and three openings.
      //
      // So it is distance, like every other decision this boss makes. Inside
      // its reach it swings; past two and a half reaches it throws; in between
      // it walks at you. The gap in the middle is the important part — without
      // it the two bands touch and it flickers between sword and fire at the
      // boundary, which reads as indecision rather than as a fighter.
      // Desperate, it reaches for the fire from closer in — the one thing that
      // changes at half health, and the reason the second half of the fight
      // does not play like the first.
      const wantFire =
        distance > REV.fireFrom * (desperate ? 0.7 : 1) &&
        distance <= REV.fireRange;
      if (wantFire) {
        return fall(
          {
            ...e,
            guardTicks,
            facing,
            phase: "telegraphing",
            phaseTicks: 0,
            attackKind: "fireball",
          },
          e.x,
        );
      }

      // Close enough to swing.
      if (distance <= REV.reach) {
        return fall(
          {
            ...e,
            guardTicks,
            facing,
            phase: "telegraphing",
            phaseTicks: 0,
            attackKind: "swing",
          },
          e.x,
        );
      }

      // Over what you put between you.
      //
      // It jumps when you are above it and it is not already in the air. That
      // is the whole rule — no pathfinding, no arc planning — and it is enough,
      // because the only thing above it in a walled room is the player standing
      // on something.
      // On the ground, and the player above it. `below` originally read
      // `Math.abs(e.y - player.y) < 4` — the boss and the player level — which
      // is the exact opposite of the case this is for, so it never once fired.
      const grounded = Math.abs(e.vy) < 0.001;
      if (
        grounded &&
        player.y < e.y - REV.jumpOver &&
        distance < REV.fireRange
      ) {
        return fall(
          { ...e, guardTicks, vy: -REV.jumpImpulse, facing, phaseTicks: ticks },
          e.x,
        );
      }

      // And across the gap you just made.
      //
      // On a clock rather than on a roll — this reducer has no randomness (ARCH
      // AD-1) — and only from a distance a walk would take a while to cover. A
      // boss that dashed every time it was two steps away would be a boss you
      // could never disengage from, and disengaging is a real move.
      // A window rather than an instant, for the same reason the fire has one:
      // this branch is only reached between attacks, so a three-tick trigger on
      // a two-and-a-half second cycle coincided with an idle frame almost
      // never, and the dive did not exist.
      const beat = Math.round(REV.slideEvery);
      const canSlide = (tick + Math.round(post)) % beat < beat / 3;
      if (canSlide && distance > REV.slideFrom && distance < REV.slideRange) {
        return fall(
          {
            ...e,
            guardTicks,
            x: e.x + facing * REV.slideSpeed,
            facing,
            phaseTicks: ticks,
          },
          e.x,
        );
      }

      // Otherwise close the distance, at exactly your walking speed. It is
      // never faster than you: everything it does, you could do.
      const toward = distance > REV.reach * 0.8 ? facing : 0;
      const home = e.x < post ? 1 : -1;
      const drift =
        toward !== 0
          ? toward * REV.speed
          : Math.abs(e.x - post) > 6
            ? home * REV.speed * 0.5
            : 0;
      return fall(
        { ...e, guardTicks, x: e.x + drift, facing, phaseTicks: ticks },
        e.x,
      );
    }
  }
}

/**
 * Whether the Revenant catches this blow.
 *
 * A hash rather than a roll, because the reducer has no randomness (ARCH AD-1).
 * Fed by the tick and its own position so two attacks on the same frame cannot
 * both be caught by the same coin, and so a replay of the same inputs always
 * produces the same fight.
 *
 * `breaker` is the stun, and it is never caught. That is the fight's answer and
 * the reason the Revenant is beatable at all: its guard is the wall, your
 * guard-breaker is the door, and it does not own one.
 */
export function revenantGuards(
  e: Enemy,
  tick: number,
  breaker: boolean,
): boolean {
  if (breaker) return false;
  if (e.kind !== "enemy.revenant" || e.phase === "dead") return false;
  // Not while it is committed. A swing already thrown cannot become a block —
  // that would be a guard with no cost at all, and every blow it caught mid
  // attack would look like the hit simply failing to register.
  if (e.phase === "striking" || e.phase === "telegraphing") return false;
  const n = (Math.round(e.x) * 2654435761 + tick * 40503) >>> 0;
  return (n % 1000) / 1000 < REV.guardChance;
}

function stepEnemy(
  e: Enemy,
  player: Player,
  wardenPost: number,
  tick: number,
): Enemy {
  if (e.phase === "dead") return e;
  if (e.kind === "enemy.warden") return stepWarden(e, player, wardenPost);
  if (e.kind === "enemy.kiln") return stepKiln(e, player, KILN_POST);
  if (e.kind === "enemy.hollow")
    return stepHollow(e, player, HOLLOW_POST, tick);
  if (e.kind === "enemy.revenant")
    return stepRevenant(e, player, HOLLOW_POST, tick);
  if (e.kind === "enemy.shark") return stepShark(e, player);
  if (e.kind === "enemy.crab") return stepCrab(e, player);
  if (e.kind === "enemy.lizard") return stepLizard(e, player);
  if (e.kind === "enemy.bee") return stepBee(e, player, tick);
  if (e.kind === "enemy.phoenix") return stepPhoenix(e, player, tick);
  if (e.kind === "enemy.flamer") return stepFlamer(e, player);
  if (e.verbs.shoot) return stepArcher(e, player);

  const ticks = e.phaseTicks + 1;
  const dx = player.x - e.x;
  const distance = Math.abs(dx);
  const facing: 1 | -1 = dx >= 0 ? 1 : -1;
  const grounded =
    landingSurface(e.x, e.y, e.y, 0, enemySize(e.kind).width) !== null;

  switch (e.phase) {
    case "staggered":
      return fall(
        ticks >= PARRY.staggerTicks
          ? {
              ...e,
              phase: "approaching",
              phaseTicks: 0,
              parriedThisTick: false,
            }
          : { ...e, phaseTicks: ticks, parriedThisTick: false },
        e.x,
      );

    case "recovering":
      return fall(
        ticks >= GOBLIN.recovery
          ? { ...e, phase: "approaching", phaseTicks: 0 }
          : { ...e, phaseTicks: ticks },
        e.x,
      );

    case "striking":
      return fall(
        ticks >= GOBLIN.active
          ? { ...e, phase: "recovering", phaseTicks: 0 }
          : { ...e, phaseTicks: ticks },
        e.x,
      );

    case "telegraphing":
      // Committed. It will not turn to follow you — stepping around a wind-up
      // is a real answer, which is what makes the tell worth reading.
      return fall(
        ticks >= GOBLIN.telegraph
          ? { ...e, phase: "striking", phaseTicks: 0 }
          : { ...e, phaseTicks: ticks },
        e.x,
      );

    case "idle":
    case "approaching":
    default: {
      // Asleep until the player is near. The dungeon is fifty thousand units
      // long, so without this every monster in it converges on the mouth from
      // tick one and the run becomes a single crowd. A committed swing still
      // finishes — only the decision to start hunting is gated.
      if (distance > ENEMY.activationRange)
        return fall({ ...e, phase: "idle", phaseTicks: 0, facing }, e.x);
      if (!e.verbs.attack || !e.verbs.move)
        return fall({ ...e, phaseTicks: ticks, facing }, e.x);

      // Up, if the player is above and it has the verb for it (FR-7.1 — an
      // enemy is a subset of the player's moves, and this is one of them).
      // Without it a ledge is not cover, it is immunity, and every fight in the
      // environment could be won by standing on something.
      const above = e.y - player.y;
      if (
        e.verbs.jump &&
        grounded &&
        above > GOBLIN.jumpTrigger &&
        distance < GOBLIN.jumpReach
      ) {
        const x = e.x + facing * GOBLIN.speed;
        return fall(
          {
            ...e,
            x,
            facing,
            vy: -GOBLIN.jumpImpulse,
            phase: "approaching",
            phaseTicks: ticks,
          },
          e.x,
        );
      }

      // Height-gated rather than ground-gated: a goblin that has just landed on
      // the ledge beside you should swing, and one standing on the floor below
      // should not swing at the air under your feet.
      if (distance <= GOBLIN.attackRange && Math.abs(above) < GOBLIN.height) {
        return fall(
          { ...e, phase: "telegraphing", phaseTicks: 0, facing },
          e.x,
        );
      }
      // Steering mid-air is deliberate: a goblin that committed to an arc would
      // be trivially dodged by stepping aside as it left the ground. And it
      // steers FASTER in the air than it walks, or the leap goes nowhere.
      const speed = grounded ? GOBLIN.speed : GOBLIN.airControl;
      const x = e.x + facing * speed;
      return fall(
        { ...e, x, facing, phase: "approaching", phaseTicks: ticks },
        e.x,
      );
    }
  }
}

/**
 * Which geyser is throwing right now, or null.
 *
 * Sequenced rather than simultaneous: vent n goes off `geyserStagger` ticks
 * after vent n-1, which is exactly the time the arc off one takes to reach the
 * next. That sequencing IS the shortcut — the vents blow either way, and what
 * the lever buys is that they blow in an order you can ride.
 *
 * Pure in the tick, like the hazards, and for the same reason: the renderer has
 * to draw the same plume the reducer is throwing you off, and a phase that
 * lived in state is one more thing for a replay to disagree about.
 */

/**
 * Where a column of the Kiln's eruption is, and whether it bites, at its own
 * tick count.
 *
 * The same shape as `hazardAt` and for the same reason: the renderer has to
 * draw exactly the thing that hurts, so both read one function rather than each
 * keeping a copy of the timing.
 */
export function eruptionAt(e: Eruption) {
  const tell = e.ticks >= 0 && e.ticks < KILN.eruptTell;
  const live =
    e.ticks >= KILN.eruptTell && e.ticks < KILN.eruptTell + KILN.eruptLive;
  // Rises fast and drops away, so the column has a shape rather than being a
  // rectangle that blinks.
  //
  // Already most of its height on the first live frame, because that is the
  // frame it bites on. Starting from nothing meant the column hit you while it
  // was still a line on the floor — the damage was real and the thing that
  // caused it had not visibly happened yet.
  const through = live ? (e.ticks - KILN.eruptTell) / KILN.eruptLive : 0;
  const rise = live
    ? Math.min(1, 0.62 + through * 2.4) * (1 - through * 0.32)
    : 0;
  return {
    tell,
    live,
    /** 0..1 up the column, for the view. */
    rise,
    left: e.x - KILN.eruptWidth / 2,
    right: e.x + KILN.eruptWidth / 2,
    top: ROOM.floorY - KILN.eruptHeight * rise,
    bottom: ROOM.floorY,
    /** Done, and ready to be forgotten. */
    spent: e.ticks >= KILN.eruptTell + KILN.eruptLive,
  };
}

/**
 * The room a boss shuts you into, or null if you are not in one.
 *
 * A boss fight was being decided by the corridor it happened in. You could back
 * up out of range and plink, the fight could drift into a pit or a lava pool
 * two set pieces away, and a goblin that woke up behind you could walk into the
 * middle of the read you were trying to make. None of that is the fight; all of
 * it decided the fight.
 *
 * So the walls come down. Get close and you are in a room with it until one of
 * you is finished — no backing out, no wandering into the scenery, and nothing
 * else allowed in. That is what makes a boss a boss rather than a big monster
 * standing in a corridor.
 *
 * It closes on APPROACH and never re-opens while the boss lives, which is the
 * important half: a wall that only appeared when you tried to leave would be a
 * trap. This one is visible from outside, and walking in is a decision.
 */
export function bossArena(
  enemies: readonly Enemy[],
  playerX: number,
  already: boolean,
): { left: number; right: number; boss: Enemy } | null {
  for (const e of enemies) {
    if (!isLock(e.kind) || e.phase === "dead") continue;
    const size =
      e.kind === "enemy.kiln"
        ? KILN
        : e.kind === "enemy.hollow"
          ? HOLLOW
          : e.kind === "enemy.revenant"
            ? REV
            : WARDEN;
    const half = size.arena;
    // Shut once you are inside the trigger, and stays shut while you are in the
    // room at all — otherwise it would flicker open every time you backed off
    // to the wall.
    const near = Math.abs(playerX - e.x) <= size.arenaTrigger;
    const inside = already && Math.abs(playerX - e.x) <= half + 40;
    if (!near && !inside) continue;
    return { left: e.x - half, right: e.x + half, boss: e };
  }
  return null;
}

export function geyserAt(
  x: number,
  feet: number,
  tick: number,
  open: readonly string[],
): number | null {
  if (!open.includes(geyserId)) return null;
  for (const [n, vent] of geyserVents.entries()) {
    if (Math.abs(x - vent) > MOVE.geyserRadius) continue;
    // Only from the ground it stands on. A player already in the air over a
    // vent is riding the last one, and being thrown twice by one hop would
    // fling them over the whole chain.
    if (feet < ROOM.floorY - 6) continue;
    const f =
      (((tick - n * MOVE.geyserStagger) % MOVE.geyserPeriod) +
        MOVE.geyserPeriod) %
      MOVE.geyserPeriod;
    if (f < MOVE.geyserBlow) return n;
  }
  return null;
}

/**
 * The tutorial's lesson machine.
 *
 * One rule per station and every rule is the same shape: has the player DONE
 * the thing yet. Not "have they walked far enough to have probably read the
 * hint" — done it. The gap is passed by being on the far side of it, the
 * goblin by being dead, the pool by being through it, the chest by being open.
 *
 * That matters because the prompts are the only teaching in the game and a
 * prompt that advances on a timer teaches whoever waited the longest. It also
 * makes the whole thing testable in one line: hand a bot intents and assert
 * which step it got to.
 *
 * The steps only ever go FORWARD. Walking back west over the gap does not
 * un-teach the jump, and a player who wanders back to look at something should
 * not be told to do it again.
 */
function stepTutorial(t: Tutorial, state: SimState, player: Player): Tutorial {
  const TU = TUT;
  /** Is the thing this station is about still standing? */
  const alive = (kind: Enemy["kind"], near: number) =>
    state.enemies.some(
      (e) =>
        e.kind === kind && e.phase !== "dead" && Math.abs(e.x - near) < 280,
    );
  const passed = ((): boolean => {
    switch (t.step) {
      // Reaching the lip of the gap is the whole of the first lesson: the
      // arrow keys move you, and here is a problem walking will not solve.
      case "walk":
        return player.x > TU.gap.x0 - 130;
      case "jump":
        return player.x > TU.gap.x1 + 20;
      case "slide":
        return player.x > TU.lintel.x1 + 20;
      // The backstep cannot be gated by terrain and it is worth saying why:
      // it moves you AWAY from progress, it does not shrink your hurtbox, and
      // it has no invulnerability — so there is no shape of rock that only a
      // backstep gets past. What makes it a move worth owning is that it is the
      // only free cancel of your own attack recovery, and the only honest test
      // of "do you know this one" is that you did it.
      //
      // Same key as the slide, and that is exactly the confusion this station
      // exists to clear up: moving, it slides; standing still, it steps back.
      case "back":
        return player.stance === "backstepping";
      case "wall":
        return player.x > TU.slot.x1 + 20;
      // Dead, not "damaged" — the recovery after its swing is the opening, and
      // a player who has not found that has not learnt the fight.
      //
      // Scoped to THIS station's goblin. There are three in the hall, one per
      // combat station, and asking whether every goblin is dead would have made
      // the first lesson "walk two stations ahead and clear the whole room".
      case "fight":
        return !alive("enemy.goblin", TU.goblinX);
      // Landed, not merely thrown. The stun's whole job is that it goes through
      // a guard, and what it does when it lands is freeze the target for a bit
      // over half a second — so the lesson is passed when something is actually
      // frozen by it.
      case "stun":
        return (
          player.action.kind === "stun" &&
          state.enemies.some(
            (e) => e.phase === "staggered" && Math.abs(e.x - player.x) < 260,
          )
        );
      // Committed and landed. The dive is `Crouch` in the air, it cannot be
      // steered once started, and its hitbox is live only for the first seven
      // ticks after touchdown — so "did a smash" means the dive was seen all
      // the way to the ground, which is what `grounded` here is checking.
      case "smash":
        return player.action.kind === "smash" && player.stance === "grounded";
      // The archer dies to its own arrow coming back. Nothing else in the hall
      // can kill it, so passing this step IS the parry.
      case "parry":
        return !alive("enemy.archer", TU.archerX);
      case "dive":
        return player.x > TU.pool.x1 + 20;
      case "loot":
        return state.chests.every((c) => c.opened);
      // The shop is opened from outside the simulation, so what the reducer can
      // see is that the player carried the gems to the door. The view opens the
      // shop when it reads this step and moves it on when it is closed again.
      case "shop":
        return player.x > TU.doorX - 200;
      case "leave":
      case "done":
        return false;
    }
    return false;
  })();

  if (!passed) return { ...t, ticks: t.ticks + 1, justPassed: false };
  const order: TutorialStep[] = [
    "walk",
    "jump",
    "slide",
    "back",
    "wall",
    "fight",
    "stun",
    "smash",
    "parry",
    "dive",
    "loot",
    "shop",
    "leave",
    "done",
  ];
  const next = order[Math.min(order.indexOf(t.step) + 1, order.length - 1)];
  return { step: next, ticks: 0, justPassed: true };
}

export function step(state: SimState, intents: Intents): SimState {
  if (state.outcome !== "running") {
    // Still ticking. The run is over but the collapse is not, and the view
    // times it off `tick - endedTick`.
    return {
      ...state,
      tick: state.tick + 1,
      previousIntents: intents,
      events: [],
    };
  }

  const events: SimEvent[] = [];
  const justPressed = pressed(intents, state.previousIntents);
  const prev = state.player;

  // This run's numbers, from the tuning table plus whatever was bought.
  //
  // Derived here rather than read from `tuning` at each use, because the shop
  // exists: a player with a honed edge swings for twenty and one without swings
  // for ten, and both have to be reproducible from the state alone.
  const stats = statsFor(state.loadout);
  const bar = stats.perBar;

  // ------------------------------------------------------------------ chute
  // Riding is a state the player is IN, not something done to them: no control
  // until it ends. So it is resolved first and returns early — running the
  // ordinary movement code underneath would fight it for the same fields.
  if (prev.riding !== null) {
    // Whichever hole you went down. Two shortcuts are rides now — the rock's
    // chute and the poison's burrow — and they run on the same code because
    // they are the same verb; what differs is where they are and what the
    // burrow charges you on the way out.
    const chute = shortcutById.get(
      prev.ridingWhich === "burrow" ? burrowId : chuteId,
    )!;
    const at = prev.riding + MOVE.chuteSpeed / (chute.toX - chute.fromX);
    const span = chute.toX - chute.fromX;

    if (at >= 1) {
      // Spat out, and thrown. The launch is what makes it a ride rather than a
      // long corridor: it ends with the player somewhere they have to land from.
      events.push({ type: "chuteLaunched", x: chute.toX, y: FLOOR });
      const launched: Player = {
        ...prev,
        x: chute.toX,
        y: FLOOR - 2,
        vx: MOVE.runSpeed,
        vy: -MOVE.chuteLaunch,
        stance: "airborne",
        riding: null,
        ridingWhich: null,
        // The burrow's toll, paid on the way out rather than on the way in: a
        // status effect applied at the entrance would be most of the way worn
        // off by the time it mattered, and the point is that you arrive in the
        // second half of the poison already poisoned.
        poisoned:
          prev.ridingWhich === "burrow" ? tuning.poison.ticks : prev.poisoned,
        running: true,
        // No grip survives the ride. Being spat out is not touching a wall.
        wallDir: 0,
        wallCoyote: 0,
        wallLaunch: 0,
      };
      return {
        ...state,
        tick: state.tick + 1,
        air: state.air > 0 ? state.air - 1 : 0,
        deepestX: Math.max(state.deepestX, chute.toX),
        environment: environmentAt(chute.toX),
        player: launched,
        previousIntents: intents,
        events,
      };
    }

    // Along the run, dipping below the floor and coming back up. The sag is a
    // parabola so the bottom is in the middle, which is where a chute's bottom
    // actually is.
    const dip = 1 - (at * 2 - 1) * (at * 2 - 1);
    return {
      ...state,
      tick: state.tick + 1,
      air: state.air > 0 ? state.air - 1 : 0,
      deepestX: Math.max(state.deepestX, chute.fromX + span * at),
      player: {
        ...prev,
        x: chute.fromX + span * at,
        y: FLOOR + MOVE.chuteSag * dip,
        vx: MOVE.chuteSpeed,
        vy: 0,
        facing: 1,
        stance: "sliding",
        riding: at,
      },
      previousIntents: intents,
      events,
    };
  }

  /**
   * Set alight.
   *
   * One function so that every source of fire in the environment agrees about
   * what catching fire means, and so that adding the next one — environment 5's
   * poison is the same shape — is one call rather than a fifth copy of the
   * rule. Refreshes rather than stacks: standing in a jet for two seconds is
   * already being punished by the jet.
   */
  let poisoned = prev.poisoned;
  /**
   * Poisoned. The burn with a different face on it, and deliberately the same
   * numbers: a player who has learned what fire costs should not have to learn
   * a second set to know what a lizard costs.
   */
  const envenom = () => {
    // Milk stops it taking hold, and so does the last level of the scale — the
    // same two ways out that fire has, for the same reason: a status you cannot
    // feel should not have an animation.
    if (buffs.milk > 0 || stats.venomScale <= 0) return;
    if (poisoned === 0) events.push({ type: "poisoned", x: prev.x, y: prev.y });
    poisoned = POISON.ticks;
  };

  let burning = prev.burning;
  const ignite = () => {
    // Two ways to be proof against it and one place that knows about either.
    // Milk is thirty seconds of total immunity; the scale is permanent and
    // partial until its last level, where it also reaches nothing. Both stop
    // the burn STARTING rather than softening it, because a burn you cannot
    // feel is a burn that should not have an animation.
    if (buffs.milk > 0 || stats.burnScale <= 0) return;
    if (burning === 0)
      events.push({ type: "caughtFire", x: prev.x, y: prev.y });
    burning = FIRE.burnTicks;
  };

  /**
   * A trap fires. Returns the health left afterwards.
   *
   * One helper for both the pressure plates and the moving hazards, because the
   * spike ward has to be spent by either — and two copies of "check the ward,
   * then apply the floor" is one copy too many for a rule with a consumable
   * attached to it.
   */
  // Where a PIT has thrown the player, or null if none has. Spread into the
  // returned player at the very end — the player object is assembled well
  // before this fires, so assigning to the `x` and `y` locals would be dead
  // code, which is exactly what the first attempt at this was.
  let thrownTo: { x: number; y: number } | null = null;

  const springTrap = (current: number): number => {
    // The shield first, and it eats the whole thing — including the FLOOR.
    //
    // A pit does not go through `wound`, because a pit is not damage: it takes
    // everything above your last bar regardless of what that is, which is why
    // it has a scale of its own. But "protects you from all damage" has to mean
    // all of it, and a ward that stopped a goblin and not a spike pit is a ward
    // nobody would trust at the moment they needed it. It also saves the spike
    // ward from being spent while the shield is up.
    if (buffs.shield > 0) {
      events.push({ type: "shieldHeld", x: prev.x, y: prev.y });
      return current;
    }
    if (potions.includes("ward")) {
      potions = potions.filter((p) => p !== "ward");
      events.push({ type: "potionUsed", kind: "ward", x: prev.x, y: prev.y });
      // Walked out of it standing. Not unharmed — the ward stops the FLOOR,
      // which is the part that ends runs, and a trap that cost nothing at all
      // would make the ward strictly better than reading the tell.
      return Math.max(current - bar, bar);
    }
    const after = trapped(current, bar);
    events.push({ type: "playerHit", damage: current - after });
    return after;
  };

  // --------------------------------------------------------------- potions
  //
  // Resolved before movement, because both of them change a number the rest of
  // the tick reads. Each is spent by id, so a player who has drunk their
  // Restoration cannot drink a second one.
  let potions = state.potions;
  // Timed effects tick down whatever else happens.
  let buffs = {
    haste: state.buffs.haste > 0 ? state.buffs.haste - 1 : 0,
    venom: state.buffs.venom > 0 ? state.buffs.venom - 1 : 0,
    milk: state.buffs.milk > 0 ? state.buffs.milk - 1 : 0,
    shield: state.buffs.shield > 0 ? state.buffs.shield - 1 : 0,
  };
  let airBonus = 0;
  let healTo = 0;
  const drink = (kind: string) => {
    if (!potions.includes(kind)) return false;
    potions = potions.filter((p) => p !== kind);
    events.push({ type: "potionUsed", kind, x: prev.x, y: prev.y });
    return true;
  };
  if (has(justPressed, Intent.Restoration) && drink("restoration")) {
    healTo = stats.maxHp;
  }
  if (has(justPressed, Intent.Breath) && drink("breath")) {
    airBonus = tuning.air.breathTicks;
  }
  if (has(justPressed, Intent.Haste) && drink("haste")) {
    buffs = { ...buffs, haste: tuning.potions.hasteTicks };
  }
  if (has(justPressed, Intent.Venom) && drink("venom")) {
    buffs = { ...buffs, venom: tuning.potions.venomTicks };
  }
  if (has(justPressed, Intent.Milk) && drink("milk")) {
    buffs = { ...buffs, milk: tuning.potions.milkTicks };
  }
  if (has(justPressed, Intent.Shield) && drink("shield")) {
    buffs = { ...buffs, shield: tuning.potions.shieldTicks };
    events.push({ type: "shieldRaised", x: prev.x, y: prev.y });
  }

  // ---------------------------------------------------------------- player
  let vx = prev.vx;
  let vy = prev.vy;
  let x = prev.x;
  let y = prev.y;
  let facing = prev.facing;
  let hp = prev.hp;

  /**
   * Every point of damage the player takes, in one place.
   *
   * Eight separate sites used to write `hp -= something` — a bee, a jet, an
   * eruption, an arrow, a swing, the burn, the poison, drowning — and every one
   * of them was a place a new rule would have to be remembered. Two of the
   * things on the shelves now are exactly such rules (a plate that halves
   * everything, a draught that stops everything for seven seconds), and a rule
   * that eight call sites have to opt into is a rule seven of them will
   * eventually miss.
   *
   * `floor` is for the effects that must not finish a run on their own: the
   * burn and the poison stop at your last bar, because there is no answer to
   * either but waiting.
   */
  const wound = (amount: number, floor = 0) => {
    if (amount <= 0) return 0;
    // The shield eats it whole. Not "reduces" — a shield that let a little
    // through would be a percentage with a dramatic name.
    if (buffs.shield > 0) {
      events.push({ type: "shieldHeld", x: prev.x, y: prev.y });
      return 0;
    }
    const taken = amount * stats.damageScale;
    hp = Math.max(floor, hp - taken);
    return taken;
  };

  let dashTicks = prev.dashTicks > 0 ? prev.dashTicks - 1 : 0;
  let dashCooldown = prev.dashCooldown > 0 ? prev.dashCooldown - 1 : 0;
  // Captured here because a fresh slide below would overwrite dashTicks and
  // hide the fact that the previous one just ran out. A backstep is excluded
  // deliberately: it travels backwards, so there is no momentum to carry.
  const slideEnded =
    prev.dashTicks > 0 && dashTicks === 0 && prev.stance === "sliding";
  let action = stepAction(prev.action);

  // Standing on whatever is under the feet, which is no longer always the floor.
  const support = landingSurface(x, y, y, 0, BODY.width);
  const grounded = support !== null;
  const ladder = ladderAt(x, y);

  if (dashTicks === 0) {
    if (has(intents, Intent.Right) && !has(intents, Intent.Left)) facing = 1;
    else if (has(intents, Intent.Left) && !has(intents, Intent.Right))
      facing = -1;
  }

  /**
   * Whether the head is under, decided BEFORE the dash so the dash can be
   * refused.
   *
   * `submerged` rather than "is there water here": wading through a shallow pool
   * with your head out is still walking and a slide through it is still a slide.
   * What has to be stopped is the move happening when there is no ground under
   * you and no air above you.
   */
  const headUnder = submerged(prev.x, prev.y, BODY.height);

  // Slide / backstep — context-sensitive (FR-5.2), and cancels a swing (FR-5.10).
  //
  // NEITHER OF THEM UNDER WATER. Both are ground moves: a slide is a body
  // skidding on a surface and a backstep is a push off one, and the water has
  // no surface to do either against. Allowing them meant a tap of the slide key
  // while diving handed the water twenty-five ticks of movement it did not
  // control — you pressed up, nothing much happened, and the swimmer played a
  // slide and then a BACKSTEP animation on the way to the top, because the swim
  // block zeroes horizontal speed and the stance test reads a zero as
  // travelling backwards. From the player's side that is the water lagging and
  // refusing to let go of you, which is exactly what it was reported as.
  if (has(justPressed, Intent.Slide) && dashTicks === 0 && !headUnder) {
    const moving = has(intents, Intent.Left) !== has(intents, Intent.Right);
    const attacking = action.kind === "attack";
    const wantsSlide = moving && !attacking;
    if (wantsSlide && prev.dashCooldown === 0) {
      dashTicks = MOVE.slideDuration;
      vx = facing * MOVE.slideSpeed;
      dashCooldown = MOVE.slideCooldown;
      action = { kind: null, elapsed: 0, lockout: 0, variant: action.variant };
    } else if (!wantsSlide) {
      dashTicks = MOVE.backstepDuration;
      vx = -facing * MOVE.backstepSpeed;
      action = { kind: null, elapsed: 0, lockout: 0, variant: action.variant };
    }
    // Moving, not attacking, but still on cooldown: nothing happens. Falling
    // through to a backstep here would hand the player a move they did not ask
    // for, in the direction they are running away from.
  }

  /**
   * Sprint. A slide whose direction is still held as it runs out carries its
   * momentum into a run; everything else walks. The slide is the only door in,
   * which is what makes the fast gait something committed to rather than a
   * button held from standing — and it gives the dodge a second reason to
   * exist beyond the i-frames.
   */
  const heldDir =
    has(intents, Intent.Left) === has(intents, Intent.Right)
      ? 0
      : has(intents, Intent.Right)
        ? 1
        : -1;
  // Compared against the PREVIOUS facing throughout. `facing` has already been
  // turned to match this tick's input, so testing it would let a player spin
  // 180 degrees and keep the sprint — the one thing it must not survive.
  let running = prev.running;
  if (slideEnded) running = heldDir === prev.facing;
  // A dash in progress is its own movement state; the question is asked again
  // when it ends.
  if (dashTicks > 0) running = false;

  // Block: the whole commitment is taken up front. A correct read parries; a
  // wrong one costs more than simply eating the hit. That asymmetry is why
  // panic compounds (PRD FR-5.7, FR-5.9).
  if (has(justPressed, Intent.Block) && !isBusy(prev)) {
    action = {
      kind: "block",
      elapsed: 0,
      lockout: COMBAT.parryWindow + COMBAT.mistimePunish,
      variant: 0,
    };
  }

  // Consecutive attacks alternate between two swings. The chain only continues
  // while the window is open, so a swing after a pause always opens with the
  // first — the player learns "the first press looks like this" rather than
  // being surprised by whichever animation happened to be next.
  let nextAttack = prev.nextAttack;
  let comboWindow = prev.comboWindow > 0 ? prev.comboWindow - 1 : 0;
  if (comboWindow === 0) nextAttack = 0;

  if (has(justPressed, Intent.Attack) && !isBusy(prev)) {
    const total = BODY.attackStartup + BODY.attackActive + BODY.attackRecovery;
    action = {
      kind: "attack",
      elapsed: 0,
      lockout: total,
      variant: nextAttack,
    };
    nextAttack = nextAttack === 0 ? 1 : 0;
    comboWindow = total + BODY.comboWindow;
  } else if (has(justPressed, Intent.Stun) && !isBusy(prev)) {
    action = {
      kind: "stun",
      elapsed: 0,
      lockout: BODY.stunStartup + BODY.stunActive + BODY.stunRecovery,
      variant: 0,
    };
  }

  /**
   * Climbing. Holding a vertical direction inside a ladder's column takes over
   * from gravity entirely — no clinging, no state to enter or leave, just "am I
   * in the ladder and am I asking to move".
   *
   * Stepping off is therefore always available: let go and fall, or walk off
   * sideways. A ladder that had to be dismounted would be one more thing to get
   * wrong while the air runs out.
   */
  const wantsUp = has(intents, Intent.Jump);
  const wantsDown = has(intents, Intent.Crouch);
  const climbing =
    ladder !== null &&
    (wantsUp || wantsDown) &&
    dashTicks === 0 &&
    !isBusy(prev);

  // PRD FR-5.5 — jump, then press crouch to drive the blade into the floor.
  // Only available in the air, which is what makes it a deliberate setup
  // rather than a button to mash.
  const airborne = !grounded && !climbing;
  if (has(justPressed, Intent.Crouch) && airborne && action.kind === null) {
    action = { kind: "smash", elapsed: 0, lockout: 999, variant: 0 };
  }
  const smashing = action.kind === "smash";

  // Steering, stopping, crouching, or committing to anything sheds the
  // momentum. A sprint is a straight line the player keeps choosing to hold,
  // so it can never be the state you simply end up in.
  if (
    heldDir !== prev.facing ||
    has(intents, Intent.Crouch) ||
    action.kind !== null
  )
    running = false;

  // The push off a wall runs itself out before control comes back.
  let wallLaunch = prev.wallLaunch > 0 ? prev.wallLaunch - 1 : 0;

  if (dashTicks === 0 && !smashing && wallLaunch === 0) {
    const left = has(intents, Intent.Left);
    const right = has(intents, Intent.Right);
    // Quickstep overrides the gait entirely: the whole item is that you are
    // sprinting whatever you are doing, including while steering.
    const walk = buffs.haste > 0 ? MOVE.runSpeed : stats.walkSpeed;
    const speed =
      has(intents, Intent.Crouch) && !airborne
        ? stats.walkSpeed * MOVE.crouchSpeedScale
        : running
          ? MOVE.runSpeed
          : walk;
    vx = left === right ? 0 : right ? speed : -speed;
  } else if (smashing) {
    vx = 0; // committed straight down
  }

  if (has(justPressed, Intent.Jump) && grounded && !climbing && !isBusy(prev)) {
    vy = -MOVE.jumpImpulse;
  }

  // -------------------------------------------------------------- the wall
  //
  // A wall is a thing to hold. Two separate rules, and keeping them separate is
  // what makes it feel right:
  //
  //   HOLDING it — airborne, falling, and pressing into the face — slows the
  //   descent. You do not stop. Stopping turns every wall into a ledge and the
  //   whole point is that the clock is still running.
  //
  //   KICKING off it needs only that a wall was there recently, not that you
  //   were pressed into it. Requiring the press as well means a player who let
  //   go a frame early gets nothing for the input, and that frame is the one
  //   every hand actually releases on.
  const clinging =
    prev.wallDir !== 0 &&
    airborne &&
    !smashing &&
    dashTicks === 0 &&
    wallLaunch === 0 &&
    heldDir === prev.wallDir &&
    vy > 0;

  const wallJumped =
    has(justPressed, Intent.Jump) &&
    prev.wallCoyote > 0 &&
    airborne &&
    !grounded &&
    !climbing &&
    !smashing &&
    dashTicks === 0 &&
    !isBusy(prev);

  if (wallJumped) {
    vy = -MOVE.wallJumpImpulse;
    vx = -prev.wallDir * MOVE.wallJumpPush;
    // Thrown off it facing where you are going, which is also where the next
    // wall is if this is a chain.
    facing = prev.wallDir === 1 ? -1 : 1;
    wallLaunch = MOVE.wallLaunchTicks;
    running = false;
    events.push({ type: "wallJumped", x, y, dir: -prev.wallDir });
  }

  if (climbing) {
    // On the ladder the body is driven, not accelerated: momentum on a ladder
    // reads as slipping, and slipping while the air burns is not a difficulty
    // anyone asked for.
    vy =
      wantsUp === wantsDown
        ? 0
        : wantsUp
          ? -stats.climbSpeed
          : stats.climbSpeed;
    vx = 0;
  } else {
    vy = smashing
      ? BODY.smashFallSpeed
      : Math.min(vy + MOVE.gravity, MOVE.maxFallSpeed);
    // Friction, applied after gravity so it is a terminal speed rather than a
    // one-off subtraction that gravity immediately wins back.
    if (clinging && !wallJumped && vy > stats.wallSlideSpeed) {
      vy = stats.wallSlideSpeed;
    }
  }

  // --------------------------------------------------------------- water
  //
  // Swimming replaces gravity rather than modifying it, which is why it sits
  // here — after the fall has been computed and before the position moves.
  //
  // The rules are deliberately not "walking, slower". You can go UP under your
  // own power, which no other state allows; you sink slowly instead of falling;
  // and breaking the surface with up held throws you clear, so getting out is a
  // move rather than a climb.
  const inWater = waterAt(x, y, BODY.height);
  // Except while a column has hold of you.
  //
  // The rising chain lives in the sea now, and the water was quietly undoing
  // it: the throw set an upward velocity, and on the very next tick this block
  // overwrote it with the stroke speed. What that looked like from the outside
  // was a shortcut that fired, said so, and went nowhere.
  //
  // The launch lockout is already the flag for "you are riding something and
  // not steering it" — the wall jump and the vent both use it — so the water
  // yields to it for exactly as long as it lasts.
  if (inWater && wallLaunch <= 0) {
    const wantsUpNow = wantsUp;
    const wasIn = waterAt(prev.x, prev.y, BODY.height) !== null;
    if (!wasIn) {
      // Hitting water kills most of your speed. Without this a fall from a
      // ledge carries you to the bottom of a pool before you have the controls.
      vy = vy * SWIM.entryDrag;
      vx = vx * SWIM.entryDrag;
      events.push({ type: "splashed", x, y: inWater.surface });
    }

    const head = y - BODY.height * 0.86;
    // Fires whenever the head is at the line and up is held, INCLUDING on
    // consecutive frames.
    //
    // It was briefly restricted to the one frame you surface, to stop a swimmer
    // pogoing at the waterline while holding up. That stopped the pogo and also
    // stopped the thing the breach exists for: every shelf in the sea became
    // unreachable from the water again, because getting onto one is a launch you
    // line up and repeat until it lands. The cenote crossing test caught it
    // within seconds — a bot that could no longer cross its own environment.
    //
    // So the repeat stays. If the bob at the surface ever needs solving it wants
    // solving in the float branch below, not by taking the launch away.
    const breaching = wantsUpNow && head <= inWater.surface + 6;
    if (breaching) {
      // Out, rather than bobbing against the underside of the waterline.
      vy = -SWIM.breach;
    } else if (wantsUpNow) {
      // Never SLOW a rise that is already faster than a stroke.
      //
      // This was a flat assignment, and it quietly cancelled the breach. The
      // breach sets a hard upward kick on the frame your head reaches the
      // surface; on the very next frame your head is clear, `breaching` is
      // false, and this line replaced that kick with the ordinary stroke — so
      // instead of being thrown clear you rose fourteen units and stopped.
      //
      // What that meant in play is that every shelf in the sea was unreachable
      // from the water. You could see the sandbar and you could not get onto
      // it, which reads as the level being broken, and is.
      vy = Math.min(vy, -SWIM.stroke);
    } else if (wantsDown) {
      vy = SWIM.stroke;
    } else if (head <= inWater.surface + 6) {
      // Floating. At the surface with nothing held you STAY at the surface.
      //
      // The sink used to apply everywhere, which meant a player swimming
      // forward along the top of the sea drifted quietly under it and drowned
      // for holding one direction. Going down has to be something you choose,
      // the way coming up is — otherwise the breath meter is not a decision,
      // it is a tax on being in the environment at all.
      vy = 0;
      // Head clear of the line, not level with it. `submerged` counts a head
      // exactly at the surface as under, and floating with your face at the
      // waterline is a drowning man's pose anyway — what this is drawing is
      // someone treading water with their head out.
      y = inWater.surface + BODY.height * 0.86 - 5;
    } else {
      // Under, and idle. Here the sink stays: being down there and doing
      // nothing about it should cost you, and up is one button away.
      vy = SWIM.sink;
    }

    // Sideways is a kick, not a run, and the gait does not apply.
    const left = has(intents, Intent.Left);
    const right = has(intents, Intent.Right);
    vx = left === right ? 0 : right ? SWIM.kick : -SWIM.kick;
    running = false;
  }

  // ----------------------------------------------------------- the high road
  //
  // The fire's shortcut, and the only one that does not move you: a lift at the
  // near end of a ledge that runs over the whole span. The lever arms the lift;
  // the road was always there.
  //
  // Reuses the vent's launch and its air-control lockout, because it is the
  // same event — you are riding something upward and you are not steering it —
  // and a second copy of that arithmetic would be a second place for it to
  // drift.
  const road = highRoad();
  if (
    road &&
    state.openShortcuts.includes(highRoadId) &&
    // BESIDE the road, not under it. The road is solid from below like every
    // other surface, so a lift beneath it threw the player into its underside
    // and dropped them back on the floor — twice as much air and no road.
    Math.abs(x - (road.x0 - 90)) <= MOVE.geyserRadius &&
    y >= FLOOR - 6 &&
    vy >= -1
  ) {
    // Enough to clear the road with a little to spare, derived rather than
    // typed: the road's height is a terrain decision and the lift has to keep
    // agreeing with it.
    const rise = FLOOR - road.top + 70;
    vy = -Math.sqrt(2 * MOVE.gravity * rise);
    // Forward as well as up, so the arc puts you down ON the near end rather
    // than straight back where you started.
    vx = MOVE.geyserThrow * 0.55;
    wallLaunch = Math.round((2 * -vy) / MOVE.gravity) - 6;
    events.push({ type: "liftRode", x, y });
  }

  // ------------------------------------------------------------- geysers
  const blown = geyserAt(x, y, state.tick, state.openShortcuts);
  if (blown !== null && vy >= -1) {
    vy = -MOVE.geyserLaunch;
    vx = MOVE.geyserThrow;
    // And the air control goes with it, using the same lockout the wall jump
    // uses. It is what makes the arc a KNOWN arc: the vents are spaced by where
    // this throw lands, and a spacing that only works for one gait works for
    // nobody. You are riding a column of steam; you are not steering it.
    wallLaunch = Math.round((2 * MOVE.geyserLaunch) / MOVE.gravity) - 4;
    events.push({ type: "geyserThrew", x, y, vent: blown });
  }

  const prevX = x;
  const prevFeet = y;
  x = x + vx;
  y = y + vy;

  // Sliding forward gives the low profile, which is what lets it pass under a
  // lintel a standing body cannot. Computed here rather than from `stance`,
  // because stance is not resolved until after the move.
  const sliding = dashTicks > 0 && vx * facing > 0;
  const height = sliding
    ? BODY.height * MOVE.slideHeightScale
    : has(intents, Intent.Crouch)
      ? BODY.height * MOVE.crouchHeightScale
      : BODY.height;

  // Vertical before horizontal. The other order shoves a body walking onto a
  // step sideways out of ground it was about to stand on.
  const landedOn = climbing
    ? null
    : landingSurface(x, prevFeet, y, vy, BODY.width);
  if (landedOn) {
    y = landedOn.top;
    vy = 0;
    if (smashing && action.lockout > BODY.smashActive + BODY.smashRecovery) {
      // Touchdown: convert the endless dive into the impact plus recovery.
      action = {
        kind: "smash",
        elapsed: 0,
        lockout: BODY.smashActive + BODY.smashRecovery,
        variant: 0,
      };
    }
  }
  if (climbing && ladder) {
    // The ladder's own run bounds the climb, so the top rung is a place to
    // stand rather than a place to keep pressing up at.
    if (y < ladder.top) y = ladder.top;
    if (y > ladder.bottom) y = ladder.bottom;
  }

  // The underside of a platform, now that they are solid.
  const bonked = climbing
    ? null
    : ceilingSurface(x, prevFeet - height, y - height, vy, BODY.width);
  if (bonked) {
    y = bonked.bottom + height;
    vy = 0;
  }

  // The roof is geometry, not scenery. Without this a jump from the tallest
  // ledge carries the player straight up through the ceiling and out of the
  // world, which is exactly what it did before the roof moved into `terrain`.
  const roof = roofAt(x);
  if (y - height < roof) {
    y = roof + height;
    if (vy < 0) vy = 0;
  }

  // Forgiving in water only: the sea's bed and the cenote system's ceiling are
  // both staircases of rectangles, and every step in either was a wall to
  // anything resting against it.
  const afloat = waterAt(x, y, BODY.height) !== null;
  x = blockHorizontally(x, prevX, y, height, BODY.width, afloat);
  // And down out of anything the allowance let us move beneath.
  if (afloat) y = duckUnder(x, y, height, BODY.width);

  // The boss's walls, applied with the rest of the collision so they behave
  // like the geometry they are drawn as.
  const arena = bossArena(state.enemies, x, state.inArena);
  if (arena) {
    const half = BODY.width / 2;
    if (x - half < arena.left) x = arena.left + half;
    if (x + half > arena.right) x = arena.right - half;
  }

  const half = BODY.width / 2;
  if (x < half) x = half;
  // Clamped to what is BUILT, not to the design's five environments. Past the
  // built end there is no ground, so walking on meant falling out of the world.
  //
  // Except in the chamber, which is built past that end on purpose — it is a
  // room rather than more corridor, and it has walls of its own. Clamping it
  // dragged the player back through the end wall the moment they stepped
  // through the door, which read as the door not working.
  const room = roomAt(x);
  if (!room) {
    const edge = Math.min(worldEnd, builtEnd) - half;
    if (x > edge) x = edge;
  } else {
    if (x < room.x0 + half) x = room.x0 + half;
    if (x > room.x1 - half) x = room.x1 - half;
  }

  const onGround = climbing
    ? false
    : landingSurface(x, y, y, 0, BODY.width) !== null;

  // What is beside the body NOW, after it has been moved and pushed out. Read
  // here rather than before the move because the horizontal pass is what puts
  // the player flush against the face — asking beforehand finds the wall a tick
  // late on the way in and a tick early on the way out.
  //
  // Suppressed during the launch: for a tick or two after kicking off, the wall
  // is still within reach, and letting it register would hand back a second
  // jump off a face the player is no longer touching. That is the difference
  // between a wall jump and a free double jump.
  const wallNow =
    onGround || climbing || wallLaunch > 0
      ? 0
      : wallBeside(x, y, height, BODY.width);
  let wallDir = prev.wallDir;
  let wallCoyote = prev.wallCoyote > 0 ? prev.wallCoyote - 1 : 0;
  if (wallNow !== 0) {
    wallDir = wallNow;
    wallCoyote = MOVE.wallCoyote;
  } else if (wallCoyote === 0) {
    wallDir = 0;
  }
  if (onGround || climbing || wallJumped) {
    // Landing, or spending it, clears the grip. Otherwise a wall touched on the
    // way down is still worth a jump seconds later on flat ground.
    wallDir = wallJumped ? wallDir : 0;
    wallCoyote = 0;
    if (onGround || climbing) wallDir = 0;
  }

  const stance: Player["stance"] =
    dashTicks > 0
      ? vx * facing > 0
        ? "sliding"
        : "backstepping"
      : // Swimming outranks airborne and loses to a dash.
        //
        // UNDER THE SURFACE IS ALWAYS SWIMMING, even with both feet planted on
        // the bed. This used to be `inWater && !onGround`, on the reasoning that
        // feet down is wading — which is right in a shin-deep pool and quite
        // wrong three metres down, where it had the player striding along the
        // seabed with the walk animation playing and their head fully under.
        //
        // Wading survives, because it is the same test read the other way: feet
        // down and head OUT is not submerged, so it still comes out as walking.
        inWater && (!onGround || submerged(x, y, BODY.height))
        ? "swimming"
        : climbing
          ? "climbing"
          : !onGround
            ? clinging && !wallJumped
              ? "clinging"
              : "airborne"
            : has(intents, Intent.Crouch)
              ? "crouching"
              : "grounded";

  // Bodies are solid: you cannot walk through a goblin. Two ways past, and
  // both fall out of the geometry rather than being special-cased —
  //   SLIDE: a dash passes through, so it is an escape as well as a dodge
  //   JUMP:  clear its head and the boxes never overlap in the first place
  {
    const dashing = stance === "sliding" || stance === "backstepping";
    const playerHeight =
      stance === "crouching"
        ? BODY.height * MOVE.crouchHeightScale
        : BODY.height;
    for (const e of state.enemies) {
      if (e.phase === "dead") continue;
      // A shark cannot shove you and neither can a bee.
      //
      // Bodies are solid so that a goblin is something you have to get around.
      // A shark is something you are IN THE WATER with — being pushed by one is
      // being pushed by a thing you cannot brace against, and it turned every
      // encounter with one into being herded. A bee is thirty pixels of insect
      // moving at nearly six a tick; it should sting you or miss.
      if (e.kind === "enemy.shark" || e.kind === "enemy.bee") continue;

      // A slide goes through anything, the Revenant included.
      //
      // It did not, and the reason was sound while a boss stood on the way out:
      // the whole environment behind it was reachable by holding slide at the
      // right moment and never fighting at all. That is not this fight. The
      // Revenant stands in a room you walk into on purpose, and the room's door
      // is what holds you — so a slide through it costs nothing but positioning,
      // and gains the one thing a mirror match should have: you can get behind
      // somebody who fights the way you do.
      if (dashing) continue;
      // Its OWN size. This was the goblin's for everybody, which was invisible
      // while every body in the game was goblin-shaped and became absurd with
      // the Warden: 84 units of boss that you could walk through because the
      // collision thought it was 34.
      //
      // Riders are skipped. They are two metres up on a shoulder — a player
      // standing under the Warden was being shoved sideways by an archer they
      // could not even reach.
      if (e.shoulder !== null) continue;
      const eSize = enemySize(e.kind);
      const eLeft = e.x - eSize.width / 2;
      const eRight = e.x + eSize.width / 2;
      const eTop = e.y - eSize.height;
      // No vertical overlap means no collision — this is what lets a jump clear it.
      if (y - playerHeight >= e.y || y <= eTop) continue;
      if (x + half <= eLeft || x - half >= eRight) continue;
      // Push out along whichever side is nearer, so you slide off rather than
      // teleporting across.
      const outLeft = eLeft - (x + half);
      const outRight = eRight - (x - half);
      x += Math.abs(outLeft) < Math.abs(outRight) ? outLeft : outRight;
      if (x < half) x = half;
      // The chamber is built PAST `worldEnd`, so clamping to it here threw the
      // player nine hundred units west the instant they touched the boss — out
      // of the room, through the end wall, and back into the fire. Every "end
      // of the world" number in this file has had to learn about the chamber;
      // this was the fifth and it was the worst, because touching the boss is
      // the one thing the fight is made of.
      const shoved = roomAt(x);
      const far = shoved ? shoved.x1 - half : worldEnd - half;
      if (x > far) x = far;
    }
  }

  // ------------------------------------------------------- levers and doors
  // PRD FR-3. The whole anti-walkthrough guarantee lives in these thirty lines:
  // a door cannot be opened from the side that would save you the walk, and the
  // only thing that opens it sits past the ground it skips. Foreknowledge of
  // where a shortcut is confers nothing (FR-3.5) because knowing is not the
  // gate — having walked there is.
  let openShortcuts = state.openShortcuts;
  let leversFlicked = state.leversFlicked;
  let chests = state.chests;
  let carried = state.carried;

  // Swimming counts as standing, for the purpose of using things.
  //
  // `onGround` is here so that a lever cannot be flicked out of a jump — it is
  // a deliberate act, not something you do in passing. But the water's lever is
  // on the seabed under three hundred units of sea, and down there you are
  // never grounded, so the rule quietly made one of the four shortcuts in the
  // game impossible to open. Treading water in front of something is exactly as
  // deliberate as standing in front of it.
  const steady = onGround || stance === "swimming";

  /** Set by an escape shaft, read by the extraction rule far below. */
  let escaped = false;

  if (has(justPressed, Intent.Interact) && !isBusy(prev) && steady) {
    // A chest takes the press before a fixture does. The layout keeps the two
    // apart so the tie cannot actually happen — but the order still has to be
    // decided here, because "whichever the loop reached first" is not something
    // two builds replaying the same log are obliged to agree on.
    // Reach is a box, not a radius. Chests now stand on ledges and in alcoves,
    // and a horizontal-only test would let the player open one from directly
    // underneath — which would make every climb in the environment optional.
    const reached = chests.findIndex(
      (c) =>
        !c.opened &&
        // Sealed while the Warden lives. It is the boss's chest and the boss
        // is the lock — walking round it and pressing E would make the fight
        // optional, which is the one thing a mini-boss must not be.
        !c.locked &&
        Math.abs(x - c.x) <= interactReach &&
        Math.abs(y - c.y) <= CHEST_REACH_Y,
    );
    if (reached >= 0) {
      const chest = chests[reached];
      chests = chests.map((c, i) =>
        i === reached ? { ...c, opened: true } : c,
      );
      carried = {
        gems: carried.gems.map((held, i) =>
          i === chest.loot.grade - 1 ? held + chest.loot.gems : held,
        ),
        gold: carried.gold + chest.loot.gold,
        legendaries: carried.legendaries + (chest.loot.legendary ? 1 : 0),
      };
      events.push({
        type: "chestOpened",
        chest: chest.id,
        x: chest.x,
        // The chest's OWN height, not the floor line.
        //
        // These were the same number for as long as every chest stood on the
        // ground. They stopped being the same when chests started standing on
        // ledges and seabeds, and since the view draws the payout forty-six
        // above whatever it is given, a chest four hundred units up had its
        // readout appear near the floor — below the chest, at the bottom of the
        // screen, where it read as belonging to something else entirely.
        y: chest.y,
        grade: chest.loot.grade,
        gems: chest.loot.gems,
        gold: chest.loot.gold,
        legendary: chest.loot.legendary,
      });
    }
  }

  if (
    has(justPressed, Intent.Interact) &&
    !isBusy(prev) &&
    steady &&
    chests === state.chests
  ) {
    for (const s of shortcuts) {
      // The lever. Reaching it at all means the ground was walked.
      if (
        Math.abs(x - s.leverX) <= interactReach &&
        !openShortcuts.includes(s.id)
      ) {
        // FR-3.6: exactly one lever per shortcut, flicked exactly once ever.
        openShortcuts = [...openShortcuts, s.id];
        leversFlicked = [...leversFlicked, s.id];
        events.push({
          type: "leverFlicked",
          shortcut: s.id,
          x: s.leverX,
          y: FLOOR,
        });
        break;
      }

      // Neither of environment 1's shortcuts is a door. The chute is entered by
      // walking into the open ground above it and the vent by walking into the
      // column; leaving either in the door loop as well would put a free
      // teleport on both of them and make the ride and the flight decorations.
      // Neither of the two that are not doors. The chute is entered by walking
      // into the open ground above it and the geyser chain by standing on a
      // vent; leaving either in the door loop would put a free teleport on top
      // of the thing that makes it interesting.
      // None of the three that are not doors. The chute and the burrow are
      // entered by walking into the open ground; the chain is stood on; the
      // high road is a ledge you are thrown onto. Leaving any of them in the
      // door loop would put a free teleport on top of the thing that makes it
      // interesting.
      if (s.id === chuteId || s.id === geyserId || s.id === burrowId) continue;
      if (s.id === highRoadId) continue;

      // The door. Inert unless this account has already earned it (FR-3.5) —
      // and then passable both ways, because the ground was bought once and a
      // player running for the mouth has as much right to it as one running in.
      if (!openShortcuts.includes(s.id)) continue;
      const atNear = Math.abs(x - s.fromX) <= interactReach;
      const atFar = Math.abs(x - s.toX) <= interactReach;
      if (!atNear && !atFar) continue;
      const destination = atNear ? s.toX : s.fromX;
      events.push({
        type: "shortcutUsed",
        shortcut: s.id,
        fromX: x,
        toX: destination,
      });
      x = destination;
      break;
    }

    // An escape shaft. Pressed, not walked into.
    //
    // The mouth banks you for walking out of it and that is right — it is the
    // edge of the world and you have to go there on purpose. A shaft is in the
    // middle of the floor you are fighting on, and a way home that triggers on
    // contact would end runs by accident, which is the single worst thing a
    // way home could do.
    const shaft = escapeAt(x);
    if (shaft !== null) {
      escaped = true;
      events.push({ type: "escaped", x: shaft, y });
    }

    // The way out of the chamber, which only exists once the room is quiet.
    //
    // It banks the run exactly like a shaft does — the same `escaped` flag and
    // the same rule — so beating the thing at the bottom ends with walking out
    // of the far side carrying everything, rather than with the long trudge
    // back through the fire that the near door leaves you.
    if (
      inChamber(x) &&
      Math.abs(x - CHAMBER.outX) <= interactReach &&
      !state.enemies.some((e) => isLock(e.kind) && e.phase !== "dead")
    ) {
      escaped = true;
      events.push({ type: "escaped", x: CHAMBER.outX, y });
    }

    // The tutorial's way home, which is the last thing the hall teaches: that
    // what you are carrying is only yours if you walk out with it. Same flag
    // and same rule as every other exit — the lesson would be worthless if the
    // door here worked differently from the doors it is teaching you about.
    // Either door, at ANY step. It used to be the far door only, and only once
    // the last lesson was passed — which meant a player who could not do the
    // wall jump was locked in a room with no way out of it but the browser's
    // back button. Every station here is a wall by design, so the way out has
    // to be unconditional or the design is a trap.
    if (state.tutorial) {
      for (const door of [TUT.backX, TUT.doorX]) {
        if (Math.abs(x - door) > interactReach) continue;
        escaped = true;
        events.push({ type: "escaped", x: door, y });
      }
    }

    // The chamber door.
    //
    // Outside the shortcut loop because it is not a shortcut: it costs no lever
    // and skips no ground, and putting it in that list would have made it the
    // fifth thing the time budget is solved against. It is a door onto a room,
    // and it works from both sides — a room with a door that only opens one way
    // is a cell.
    if (Math.abs(x - CHAMBER.doorX) <= interactReach) {
      x = CHAMBER.insideX;
      events.push({ type: "chamberEntered", x, y });
    } else if (
      inChamber(x) &&
      Math.abs(x - CHAMBER.backX) <= interactReach &&
      // Shut while it lives. BOTH doors are.
      //
      // This is the one place the game breaks its own rule that retreating is
      // always available (FR-4.2), and it is a deliberate exception rather than
      // an oversight: every other lock in the dungeon stands on ground you need
      // and can be walked away from, and this one is a room you chose to open a
      // door and step into. Having done that, the way out is through.
      //
      // The cost of the rule is real and worth naming: a player who walks in on
      // one bar loses the run's loot there. The door is drawn shut, the prompt
      // says so from outside, and it is the only door in the game that does.
      !state.enemies.some((e) => isLock(e.kind) && e.phase !== "dead")
    ) {
      x = CHAMBER.doorX;
      events.push({ type: "chamberLeft", x, y });
    }
  }

  // Into the chute, if its lever has been flicked and the ground is open.
  // Walked into rather than pressed: the hatch IS open, and a hole in the floor
  // does not ask permission.
  let riding: number | null = prev.riding;
  let ridingWhich: "chute" | "burrow" | null = prev.ridingWhich;
  for (const [id, which] of [
    [chuteId, "chute"],
    [burrowId, "burrow"],
  ] as const) {
    const hole = shortcutById.get(id);
    if (
      hole &&
      openShortcuts.includes(id) &&
      onGround &&
      Math.abs(x - hole.fromX) <= interactReach
    ) {
      riding = 0;
      ridingWhich = which;
      events.push({ type: "chuteEntered", x: hole.fromX, y: FLOOR });
    }
  }

  const player: Player = {
    x,
    y,
    vx,
    vy,
    facing,
    stance,
    breath: prev.breath,
    dashTicks,
    dashCooldown,
    riding,
    ridingWhich,
    wallDir,
    wallCoyote,
    wallLaunch,
    running,
    hp,
    action,
    struck: prev.struck,
    burning: prev.burning,
    poisoned: prev.poisoned,
    nextAttack,
    comboWindow,
  };

  // ---------------------------------------------------------------- enemies
  // Crossing the mouth starts the run. Everything downstream keys off this.
  const entered = state.entered || x >= ROOM.entranceX;
  const crossed = entered && !state.entered;
  if (crossed) events.push({ type: "entered" });
  const enteredTick = crossed ? state.tick : state.enteredTick;

  // Nothing hunts you outside. The dungeon is what is dangerous, not the game.
  let enemies = entered
    ? state.enemies.map((e) =>
        stepEnemy(
          { ...e, parriedThisTick: false },
          player,
          WARDEN_POST,
          state.tick,
        ),
      )
    : state.enemies;

  // Riders ride. Their own step gave them the archer's mind — the draw, the
  // tell, the aimed shot — and this takes their legs back off them: position is
  // written from the host every tick, before anything reads it.
  //
  // Nothing ordinary comes into the room.
  //
  // The arena is cleared when the roster is built, but a goblin two set pieces
  // back can still wake up and walk in halfway through — and being hit from
  // behind while reading a boss's one attack is not the fight anybody designed.
  if (arena) {
    enemies = enemies.map((e) => {
      if (e.phase === "dead" || isLock(e.kind) || e.shoulder !== null) return e;
      const size = enemySize(e.kind);
      const half = size.width / 2;
      if (e.x + half > arena.left && e.x < arena.boss.x)
        return { ...e, x: arena.left - half };
      if (e.x - half < arena.right && e.x > arena.boss.x)
        return { ...e, x: arena.right + half };
      return e;
    });
  }

  // Done here rather than inside `stepEnemy` because a rider needs to know
  // where its host ended up THIS tick, and a map cannot see its own output.
  const host = enemies.find((e) => e.kind === "enemy.warden");
  if (host) {
    enemies = enemies.map((e) =>
      e.shoulder === null || e.phase === "dead"
        ? e
        : {
            ...e,
            x: host.x + e.shoulder * WARDEN.shoulderX,
            y: host.phase === "dead" ? host.y : host.y - WARDEN.shoulderY,
            vy: 0,
          },
    );
  }

  // Player's swing lands — ONCE per enemy per swing.
  //
  // The hitbox is live for several ticks so that an enemy walking into it
  // mid-swing still gets caught. That window is the feature; applying the
  // damage on every tick of it was the bug.
  let swungAt: readonly number[] =
    player.action.elapsed === 0 ? [] : prev.struck;
  const swing = playerHitbox(player, stats.attackReach, stats.smashRadius);
  if (swing) {
    const damage =
      (player.action.kind === "smash"
        ? stats.smashDamage
        : player.action.kind === "stun"
          ? stats.stunDamage
          : stats.attackDamage) *
      // Etched blade. Doubles what the sword and the guard-breaker do, and
      // nothing else — a parry riposte is the parry's payoff, not the potion's.
      (buffs.venom > 0 ? 2 : 1);
    const alreadyHit = new Set(swungAt);
    const hitting: number[] = [];
    enemies = enemies.map((e, index) => {
      if (e.phase === "dead" || !overlaps(swing, enemyBox(e))) return e;
      if (alreadyHit.has(index)) return e;
      hitting.push(index);

      // Caught.
      //
      // The Revenant parries half of what you throw, and it costs you the swing
      // and nothing else — its guard does not riposte. Yours does, because a
      // parry has to pay for a 0.3s window you might miss; this one has no
      // window and no risk, so charging you damage for it would be charging
      // twice for the same coin.
      //
      // The stun goes through. That is the whole answer to this fight: its
      // guard is a wall and your guard-breaker is the door, and the one verb it
      // was not given is the one that opens it.
      if (revenantGuards(e, state.tick, player.action.kind === "stun")) {
        events.push({ type: "guardHeld", x: e.x, y: e.y - 40 });
        // `attackKind` is deliberately left alone. Setting it made the phase
        // machine read the wrong recovery length for whatever it had been in
        // the middle of, and made the view draw the guard as an interrupted
        // attack — a block is not an attack and does not belong in that field.
        return { ...e, guardTicks: REV.guardTicks };
      }

      const nextHp = e.hp - damage;
      events.push({
        type: "enemyHit",
        damage,
        x: e.x,
        y: e.y - GOBLIN.height / 2,
      });
      if (nextHp <= 0) {
        events.push({ type: "enemyDied", x: e.x, y: e.y });
        return { ...e, hp: 0, phase: "dead" as const, phaseTicks: 0 };
      }
      // The stun attack's payoff is the opening, not the damage (FR-5.6).
      const staggered = player.action.kind === "stun";
      return staggered
        ? { ...e, hp: nextHp, phase: "staggered" as const, phaseTicks: 0 }
        : { ...e, hp: nextHp };
    });
    if (hitting.length > 0) swungAt = [...swungAt, ...hitting];
  }

  // Enemy swings land — or get parried.
  const pBox = playerBox(player);
  const parrying = isParrying(player);

  /**
   * Whether anything was parried this tick.
   *
   * A block costs its whole window plus a punish tail up front, and getting it
   * RIGHT used to cost the same as getting it wrong — you caught a swing and
   * then stood there unable to do anything for the next forty ticks, which in a
   * fight with two things attacking you meant the reward for reading correctly
   * was being hit by the other one. A clean parry now clears the tail entirely,
   * so it can be followed straight into another one or into a swing of your own.
   *
   * The window itself is untouched. Mistiming still costs exactly what it did.
   */
  let parriedSomething = false;

  // ----------------------------------------------------------------- bees
  //
  // Resolved here rather than with the swings, because a swing is a box that
  // exists for one frame and a bee is a body travelling for a second. The
  // general path only ever looks at the first frame of `striking`, which for a
  // bee is the moment it launches — four hundred units away from anybody.
  //
  // Contact ends it whatever the contact was: blocked, or landed. It has one
  // question and it does not get to ask twice.
  enemies = enemies.map((e) => {
    if (e.kind !== "enemy.bee" || e.phase !== "striking") return e;
    if (!overlaps(enemyBox(e), pBox)) return e;

    if (parrying) {
      events.push({ type: "parry", x: e.x, y: e.y });
      events.push({ type: "enemyDied", x: e.x, y: e.y });
      parriedSomething = true;
      return {
        ...e,
        hp: 0,
        phase: "dead" as const,
        phaseTicks: 0,
        parriedThisTick: true,
      };
    }

    wound(BEE.damage);
    events.push({ type: "playerHit", damage: BEE.damage });
    events.push({ type: "enemyDied", x: e.x, y: e.y });
    return { ...e, hp: 0, phase: "dead" as const, phaseTicks: 0 };
  });

  // ------------------------------------------------------------- flame jets
  //
  // Resolved before the swings and separately from them, because a jet is not
  // a swing: it is on for two seconds and it bites on an interval for as long
  // as you are standing in it. Everything below assumes one hit on one frame,
  // which is the wrong shape for this entirely.
  //
  // Not parryable. There is no moment to catch — the whole point of the enemy
  // is that the answer is your feet, not your timing, and a block that turned
  // two seconds of fire off would delete the one enemy built to punish standing
  // still. The cooldown is what it gives you instead.
  for (const e of enemies) {
    if (e.kind !== "enemy.flamer" || e.phase !== "striking") continue;
    const nose = e.x + e.facing * (FLAMER.width / 2);
    const jet = {
      left: e.facing === 1 ? nose : nose - FLAMER.reach,
      right: e.facing === 1 ? nose + FLAMER.reach : nose,
      top: e.y - FLAMER.jetHeight,
      bottom: e.y,
    };
    events.push({
      type: "flameJet",
      x: nose,
      y: e.y,
      facing: e.facing,
      length: FLAMER.reach,
    });
    if (!overlaps(jet, pBox)) continue;
    // Phase-locked to the burn rather than to the world clock, so the first
    // bite lands the moment you walk into it instead of whenever the global
    // interval next comes round.
    if (e.phaseTicks % FLAMER.damageInterval !== 0) continue;
    wound(FLAMER.damage);
    events.push({ type: "playerHit", damage: FLAMER.damage });
    ignite();
  }

  // -------------------------------------------------------------- eruptions
  //
  // Spawned on the frame the Kiln commits, then living their own lives. The
  // boss is already recovering by the time the far column comes up, which is
  // deliberate: the tell to read is the FLOOR, not the monster.
  let eruptions = state.eruptions.map((r) => ({ ...r, ticks: r.ticks + 1 }));
  for (const e of enemies) {
    if (e.kind !== "enemy.kiln") continue;
    if (e.phase !== "striking" || e.phaseTicks !== 0) continue;
    if (e.attackKind !== "slam") continue;
    const columns =
      KILN.eruptColumns +
      (e.hp <= KILN.maxHp * KILN.enrageAt ? KILN.enrageColumns : 0);
    // Aimed, then marching away.
    //
    // The row used to start at a fixed offset from the boss and step outward on
    // a grid, which meant whether it hit you was a question of where you
    // happened to be standing relative to a hundred-and-four-unit lattice you
    // could not see: two columns straddled the player and the whole attack
    // whiffed without either of you doing anything. Now the first one opens
    // under your feet and the rest walk off behind it, so there is always
    // exactly one to answer and the answer is always the same — be in the air.
    const from = Math.max(
      Math.abs(player.x - e.x),
      KILN.reach + KILN.eruptSpacing / 2,
    );
    for (let n = 0; n < columns; n++) {
      const x = e.x + e.facing * (from + KILN.eruptSpacing * n);
      // Negative, so the row marches outward instead of arriving at once.
      eruptions = [...eruptions, { x, ticks: -n * KILN.eruptStagger }];
      events.push({ type: "eruptionCalled", x });
    }
  }
  // Resolve, then forget the spent ones.
  {
    const pBoxNow = playerBox(player);
    const alive: Eruption[] = [];
    for (const r of eruptions) {
      const box = eruptionAt(r);
      if (box.spent) continue;
      alive.push(r);
      if (!box.live) continue;
      if (r.ticks === KILN.eruptTell)
        events.push({ type: "eruptionFired", x: r.x });
      // Once per column, on the frame it comes up. A column that bit every
      // frame of its window would be unjumpable rather than hard.
      if (r.ticks !== KILN.eruptTell) continue;
      if (!overlaps(box, pBoxNow)) continue;
      wound(KILN.damage);
      events.push({ type: "playerHit", damage: KILN.damage });
      ignite();
    }
    eruptions = alive;
  }

  // ------------------------------------------------------------- the heat
  //
  // Not an attack and not answerable: standing in front of this boss sets you
  // alight, whatever either of you is doing. It is the whole reason the fight
  // is different from the Warden's — there is no trading, only approaching.
  for (const e of enemies) {
    if (e.kind !== "enemy.kiln" || e.phase === "dead") continue;
    if (Math.abs(player.x - e.x) > kilnAura(e)) continue;
    if (state.tick % KILN.auraInterval !== 0) continue;
    ignite();
  }

  // ----------------------------------------------------------------- arrows
  // Spawned the tick an archer reaches `striking`, so the arrow leaves the bow
  // on the frame the draw finishes rather than a tick either side of it.
  let arrows = state.arrows;
  let nextArrowId = state.nextArrowId;
  for (const e of enemies) {
    if (e.phase !== "striking" || e.phaseTicks !== 0) continue;
    // The Revenant shoots only when it means to. It has the player's whole verb
    // set, so `shoot` alone would have it throwing fire every time it swung —
    // what decides it here is the same thing that decided it there: which of
    // its two attacks this is.
    const throwing = e.kind === "enemy.revenant" && e.attackKind === "fireball";
    if (!throwing && !e.verbs.shoot) continue;
    if (e.kind === "enemy.revenant" && !throwing) continue;
    // Every shooter goes through here. The only thing that differs is what
    // comes out and how fast, so the aiming — which is the fiddly part — is
    // written once. What a parry DOES to it is decided where the parry is.
    const fire = e.kind === "enemy.phoenix" || throwing;
    const size = enemySize(e.kind);
    const from = e.y - size.height * 0.62;
    const originX = e.x + e.facing * (size.width / 2 + 6);
    // Aimed at the chest, not fired along the floor. An archer standing on a
    // ledge used to shoot horizontally over the player's head, which made the
    // best firing position in the environment the safest place to stand.
    //
    // `Math.sqrt` is deliberate and allowed: IEEE 754 specifies it exactly, so
    // unlike the transcendentals it cannot disagree across devices.
    const aimX = player.x - originX;
    const aimY = player.y - BODY.height * 0.55 - from;
    const reach = Math.max(Math.sqrt(aimX * aimX + aimY * aimY), 0.001);
    const speed = throwing
      ? REV.fireSpeed
      : fire
        ? PHOENIX.ballSpeed
        : ARCHER.arrowSpeed;
    arrows = [
      ...arrows,
      {
        id: nextArrowId++,
        kind: fire ? ("fireball" as const) : ("arrow" as const),
        x: originX,
        y: from,
        vx: (aimX / reach) * speed,
        vy: (aimY / reach) * speed,
        returned: false,
        life: fire ? PHOENIX.ballLife : ARCHER.arrowLife,
      },
    ];
    events.push({ type: "arrowLoosed", x: e.x, y: from, facing: e.facing });
  }

  // Fly, then resolve. An arrow belongs to whichever side it will hurt next,
  // so a parry flips one field rather than threading a special case through
  // the collision.
  /**
   * What a returned projectile hit, and for how much.
   *
   * A map rather than a set because the two projectiles are no longer worth the
   * same: a reflected arrow is a riposte, and a reflected fireball is the
   * phoenix's own fire arriving back at it.
   */
  const struck = new Map<number, number>();
  arrows = arrows.flatMap((a) => {
    const x = a.x + a.vx;
    const y = a.y + a.vy;
    const life = a.life - 1;
    // Out of the world. The chamber is built PAST the end of it, so the bound
    // has to know that or the boss's own fireballs are deleted on the frame it
    // throws them — it threw seven, none arrived, and the fight looked like a
    // boss with an attack that does nothing.
    const shotRoom = roomAt(x);
    const edge = shotRoom ? shotRoom.x1 + 80 : builtEnd;
    if (life <= 0 || x < 0 || x > edge) return [];
    // Into the rock and gone.
    //
    // Arrows had no terrain collision at all, which nobody noticed while the
    // only archers stood on flat ground shooting along it. They shoot DOWN from
    // ledges now, so a miss carried on through the floor and out the bottom of
    // the world — and worse, an arrow loosed across a tower arrived on the far
    // side of it, which reads as an archer shooting you through a wall.
    // ...and into a LEDGE, which `insideSolid` would have let it through. That
    // function skips one-way platforms because a body has to be able to jump up
    // through them; a fireball does not, and five of the eight raised surfaces
    // in the fire environment are one-way — so the phoenix was shooting down
    // through the ledge you were sheltering under.
    if (blocksShot(x, y, a.y)) {
      events.push({ type: "arrowStruck", x, y });
      return [];
    }
    const box = { left: x - 9, right: x + 9, top: y - 5, bottom: y + 5 };

    if (!a.returned) {
      if (overlaps(box, pBox)) {
        // PRD FR-5.7: the parry reflects arrows. This is what the block is FOR
        // — a goblin teaches the timing, and this is what the timing buys.
        if (parrying) {
          // PRD FR-5.7 — the parry turns a shot around, and it now does that to
          // a fireball too.
          //
          // It used to break one instead: the blade shattered it and nothing
          // came back, on the theory that a fireball is burning air. That made
          // the parry a thing that only ever saved you in the fire, never paid
          // you — and the phoenix, which is a flier you cannot reach, became a
          // monster with no answer but leaving. Sending it back gives the fight
          // an ending, and it is an ending you have to earn on a 0.3s window.
          events.push({
            type: a.kind === "fireball" ? "fireballReturned" : "arrowReturned",
            x,
            y,
          });
          parriedSomething = true;
          // Straight back the way it came, faster. Reversing both components
          // rather than only the horizontal is what sends it back UP at an
          // archer that shot down from a ledge.
          const speed = Math.max(Math.sqrt(a.vx * a.vx + a.vy * a.vy), 0.001);
          return [
            {
              ...a,
              x,
              y,
              life,
              returned: true,
              vx: (-a.vx / speed) * ARCHER.arrowReturnSpeed,
              vy: (-a.vy / speed) * ARCHER.arrowReturnSpeed,
            },
          ];
        }
        const bite = a.kind === "fireball" ? PHOENIX.damage : ARCHER.damage;
        wound(bite);
        events.push({ type: "playerHit", damage: bite });
        if (a.kind === "fireball") ignite();
        return [];
      }
      return [{ ...a, x, y, life }];
    }

    // Returned: it hunts whatever fired it, and anything else in the way.
    for (const e of enemies) {
      if (e.phase === "dead" || struck.has(e.x)) continue;
      if (!overlaps(box, enemyBox(e))) continue;
      // A phoenix dies to its own fireball. Not "takes heavy damage" — dies.
      // The bird is 20 health and a flier, so a returned shot worth a riposte
      // would mean parrying four of them perfectly to kill one thing, and a
      // reward that far away from the moment that earned it is not read as a
      // reward at all.
      const lethal = a.kind === "fireball" && e.kind === "enemy.phoenix";
      // A returned fireball is worth a great deal against the Revenant and it
      // is not lethal: it has ten bars, and a boss that dies to one good parry
      // is a boss with one question. Five ripostes' worth — enough that
      // catching its fire is the fastest way to end the fight, and far from
      // enough to be the only way.
      const home = a.kind === "fireball" && e.kind === "enemy.revenant";
      struck.set(
        e.x,
        lethal ? Infinity : home ? ARCHER.riposte * 5 : ARCHER.riposte,
      );
      return [];
    }
    return [{ ...a, x, y, life }];
  });

  // Apply what the returned arrows hit. Done here rather than inside the flat
  // map so the enemy list is rewritten once.
  if (struck.size > 0) {
    enemies = enemies.map((e) => {
      const bite = struck.get(e.x);
      if (e.phase === "dead" || bite === undefined) return e;
      const nextHp = bite === Infinity ? 0 : e.hp - bite;
      events.push({
        type: "enemyHit",
        damage: bite === Infinity ? e.hp : bite,
        x: e.x,
        y: e.y - 40,
      });
      if (nextHp <= 0) {
        events.push({ type: "enemyDied", x: e.x, y: e.y });
        return { ...e, hp: 0, phase: "dead" as const, phaseTicks: 0 };
      }
      return { ...e, hp: nextHp, phase: "staggered" as const, phaseTicks: 0 };
    });
  }

  enemies = enemies.map((e) => {
    if (e.phase !== "striking" || e.phaseTicks !== 0) return e;

    // The goblin's swing covers its full height — it is a wild lunge, not a
    // measured cut, and a taller player should not be able to duck it for free.
    const size = enemySize(e.kind);
    // Off the table each one is sized from, so a new monster never inherits a
    // goblin's arm by omission.
    const reachOf: Partial<Record<Enemy["kind"], number>> = {
      "enemy.warden": WARDEN.reach,
      "enemy.kiln": KILN.reach,
      "enemy.hollow": HOLLOW.reach,
      "enemy.shark": SHARK.reach,
      "enemy.crab": CRAB.reach,
      "enemy.lizard": LIZARD.reach,
      "enemy.revenant": REV.reach,
      // The Revenant was missing from this table, so it swung with a GOBLIN's
      // arm — while `stepRevenant` decided to swing at its OWN reach, which is
      // half again as long. Every blow it threw from inside the gap between the
      // two connected with nothing, so getting close enough that it would not
      // throw fire meant standing in front of a boss hacking at empty air. This
      // is exactly the omission the comment above warns about.
    };
    const reach = reachOf[e.kind] ?? GOBLIN.reach;
    const eSwing = swingBox(e.x, e.y, e.facing, reach, size.height);
    if (!overlaps(eSwing, pBox)) return e;

    if (parrying) {
      // PRD FR-5.8: a parried melee attack damages its attacker.
      events.push({ type: "parry", x: e.x, y: e.y - size.height / 2 });
      parriedSomething = true;
      const nextHp = e.hp - stats.riposteDamage;
      if (nextHp <= 0) {
        events.push({ type: "enemyDied", x: e.x, y: e.y });
        return {
          ...e,
          hp: 0,
          phase: "dead" as const,
          phaseTicks: 0,
          parriedThisTick: true,
        };
      }
      // A blocked bee is a dead bee. It has one question and this is the good
      // answer to it; leaving it alive to ask again would make the answer worse
      // than the question.
      if (e.kind === "enemy.bee") {
        events.push({ type: "enemyDied", x: e.x, y: e.y });
        return {
          ...e,
          hp: 0,
          phase: "dead" as const,
          phaseTicks: 0,
          parriedThisTick: true,
        };
      }
      return {
        ...e,
        hp: nextHp,
        phase: "staggered" as const,
        phaseTicks: 0,
        parriedThisTick: true,
      };
    }

    const damageOf: Partial<Record<Enemy["kind"], number>> = {
      "enemy.warden": WARDEN.damage,
      "enemy.kiln": KILN.damage,
      "enemy.hollow": HOLLOW.damage,
      "enemy.shark": SHARK.damage,
      "enemy.crab": CRAB.damage,
      "enemy.lizard": LIZARD.damage,
      "enemy.bee": BEE.damage,
    };
    const damage = damageOf[e.kind] ?? GOBLIN.damage;
    wound(damage);
    events.push({ type: "playerHit", damage });
    // Everything the Kiln does is on fire, including its hands.
    if (e.kind === "enemy.kiln") ignite();
    // And a lizard's bite is the poison, not the damage.
    if (e.kind === "enemy.lizard") envenom();
    // A bee that lands has done its whole job and is finished.
    if (e.kind === "enemy.bee") {
      return { ...e, hp: 0, phase: "dead" as const, phaseTicks: 0 };
    }
    return e;
  });

  // ----------------------------------------------------------------- drops
  //
  // One pass over everything that died THIS tick, rather than a payout at each
  // of the places something can die. There are four of those — the sword, a
  // reflected arrow, a parry riposte, and a hazard — and a fifth will be added
  // eventually. Paying here means the fifth cannot forget to.
  //
  // Index-aligned against the previous tick's array, which every map above
  // preserves: an enemy is only paid out on the transition into `dead`, so a
  // corpse lying there does not pay again every frame.
  for (let i = 0; i < enemies.length; i++) {
    const now = enemies[i];
    const was = state.enemies[i];
    if (!was || was.phase === "dead" || now.phase !== "dead") continue;
    const { gems, gold } = now.drop;
    if (gems === 0 && gold === 0) continue;

    const grade = gradeFor(environmentAt(now.x));
    carried = {
      gems: carried.gems.map((held, g) =>
        g === grade - 1 ? held + gems : held,
      ),
      gold: carried.gold + gold,
      legendaries: carried.legendaries,
    };
    events.push({
      type: "lootDropped",
      x: now.x,
      y: now.y,
      grade,
      gems,
      gold,
    });
  }

  // ------------------------------------------------------------------ traps
  // PRD FR-18.5. The plate arms when it is stood on and fires half a second
  // later, which is the whole of the mechanic: the answer is to be somewhere
  // else by then, and the tell is what makes that answerable.
  const traps = state.traps.map((t): typeof t => {
    const fixture = TRAPS_BY_ID.get(t.id);
    if (!fixture) return t;
    const ticks = t.ticks + 1;
    const standingOn =
      Math.abs(player.x - fixture.x) <= fixture.halfWidth + BODY.width / 2 &&
      Math.abs(player.y - fixture.top) < 6;

    switch (t.phase) {
      case "telegraphing":
        if (ticks < TRAP.tellLeadTime) return { ...t, ticks };
        events.push({
          type: "trapFired",
          trap: t.id,
          x: fixture.x,
          y: fixture.top,
        });
        return { ...t, phase: "firing", ticks: 0 };
      case "firing":
        return ticks >= TRAP.active
          ? { ...t, phase: "resetting", ticks: 0 }
          : { ...t, ticks };
      case "resetting":
        return ticks >= TRAP.reset
          ? { ...t, phase: "idle", ticks: 0 }
          : { ...t, ticks };
      default:
        // Committed once armed. Stepping back off does not disarm it — a trap
        // you can cancel is one you never have to read.
        return standingOn
          ? { ...t, phase: "telegraphing", ticks: 0 }
          : { ...t, ticks };
    }
  });

  for (const t of traps) {
    if (t.phase !== "firing") continue;
    const fixture = TRAPS_BY_ID.get(t.id);
    if (!fixture) continue;
    // Live for the first tick only, so standing in the blades costs one hit
    // rather than one per tick.
    if (t.ticks !== 0) continue;
    const caught =
      Math.abs(player.x - fixture.x) <= fixture.halfWidth + BODY.width / 2 &&
      player.y > fixture.top - TRAP.reach &&
      player.y <= fixture.top + 8;
    if (caught) hp = springTrap(hp);
  }

  // Swinging blades, ceiling crushers and sliding saws. Their positions are a
  // pure function of the tick, so there is nothing to step here — only the
  // question of whether the player is standing where one of them is.
  //
  // Rate-limited: a hazard that bit every tick would fire sixty times a second
  // while a saw swept through, and stop being something to time.
  if (state.tick % TRAP.hazardInterval === 0) {
    const pBoxNow = playerBox(player);
    for (const h of terrain.hazards) {
      const box = hazardAt(h, state.tick);
      if (!box.armed) continue;
      if (!overlaps(box, pBoxNow)) continue;
      hp = springTrap(hp);
      // A curtain of lava is fire; a saw is not.
      if (h.kind === "flow") ignite();
      break;
    }
  }

  // The traps do not care whose they are. A goblin that walks into a blade or
  // falls onto the spikes dies outright — no health, no stagger.
  //
  // That turns every hazard into a weapon as well as an obstacle, which is the
  // best thing about it: the answer to a crowd becomes leading them over the
  // plate rather than out-swinging them, and the terrain stops being purely a
  // tax on the player.
  enemies = enemies.map((e) => {
    if (e.phase === "dead") return e;
    const box = enemyBox(e);
    let caught = onSpikes(e.x, e.y, GOBLIN_WIDTH);
    if (!caught) {
      for (const h of terrain.hazards) {
        const hb = hazardAt(h, state.tick);
        if (hb.armed && overlaps(hb, box)) {
          caught = true;
          break;
        }
      }
    }
    if (!caught) {
      for (const t of traps) {
        if (t.phase !== "firing" || t.ticks !== 0) continue;
        const fixture = TRAPS_BY_ID.get(t.id);
        if (!fixture) continue;
        if (
          Math.abs(e.x - fixture.x) <= fixture.halfWidth + GOBLIN.width / 2 &&
          e.y > fixture.top - TRAP.reach &&
          e.y <= fixture.top + 8
        ) {
          caught = true;
          break;
        }
      }
    }
    if (!caught) return e;
    events.push({ type: "enemyDied", x: e.x, y: e.y });
    return { ...e, hp: 0, phase: "dead" as const, phaseTicks: 0 };
  });

  // ------------------------------------------------------------------ pits
  //
  // Falling in one is not a slow bleed any more. You go down to your last bar
  // and you are put back on the ground you fell from, in one go.
  //
  // It used to take a fifth of a bar every twenty ticks, which made a pit a
  // COUNTDOWN: the real cost was the seconds spent climbing out with the air
  // running, and a player who fell in late simply lost the run to arithmetic
  // they could not see. One hard cost you can read off the health bar is a
  // better trade, and it means the answer to a pit is "do not fall in" rather
  // than "fall in early".
  //
  // The wall jump is not what this takes away. That was always aimed at the
  // parkour environment; the shaft here is a thing to cross.
  //
  // ONCE per fall, not once per tick.
  //
  // This charged every frame the player was over spikes, which was invisible
  // for as long as the charge was "everything above your last bar" — you were
  // thrown clear on the same tick, so there was never a second one. Padded
  // soles made the charge small, so a player survived the first tick, and if
  // the rescue could not find ground they sat in the pit being billed sixty
  // times a second while the throw-back fought the fall for the position of
  // their feet. What that looked like was a player facing back and forth very
  // fast, sinking slowly, and dying to a pit they had already survived.
  if (
    onSpikes(player.x, player.y, BODY.width) &&
    !onSpikes(prev.x, prev.y, BODY.width)
  ) {
    const floor = trapped(hp, bar);
    // Padded soles buy back a fraction of what the pit would have taken. At
    // full price it is everything above one bar; maxed it is a scratch.
    const cost = (hp - floor) * stats.pitCostScale;
    const after = Math.max(hp - cost, floor);
    if (after < hp) events.push({ type: "playerHit", damage: hp - after });
    hp = after;
    // Lava counts, iron spikes do not. It is the one place the two kinds of pit
    // are told apart, and it costs nothing that they share everything else.
    if (inLava(player.x, player.y, BODY.width)) ignite();
    if (inPoison(player.x, player.y, BODY.width)) envenom();
    thrownTo = safeGroundBefore(prev.x, prev.facing, BODY.width, BODY.height);
    if (thrownTo) events.push({ type: "thrownBack", x: prev.x, y: prev.y });
  }

  // ---------------------------------------------------------------- outcome
  // PRD FR-1.3: air reaching zero is transformation, not death. Different in
  // kind, and checked first because it is the run's own clock running out.
  // PRD FR-17: the timer is the air in the mask, so it only runs while the
  // mask is being used. Standing outside costs nothing.
  // A Second Breath is added to BOTH the clock and the capacity, so the dial
  // still reads as a fraction of a full tank rather than sweeping past twelve.
  // Burning down. Floored at one bar for the reason in `tuning.fire`: fire is
  // pressure, and pressure that finishes a run you had already survived is a
  // coin toss rather than a difficulty.
  if (burning > 0) {
    const floor = Math.min(hp, bar);
    const perTick = (FIRE.burnDamage * stats.burnScale) / FIRE.burnTicks;
    wound(perTick, floor);
    burning -= 1;
  }
  if (poisoned > 0) {
    // Same floor, same reason: there is no answer to it but waiting, and a
    // thing with no answer must not be what ends a run.
    const floor = Math.min(hp, bar);
    wound((POISON.damage * stats.venomScale) / POISON.ticks, floor);
    poisoned -= 1;
  }

  // Under the surface costs double. This is a game about a tank of air, and the
  // water is the only place in it where being somewhere is more expensive than
  // being somewhere else — which is the entire reason a dive is a decision.
  const under = entered && submerged(player.x, player.y, BODY.height);

  // ---------------------------------------------------------------- breath
  //
  // Five bubbles over the player's head, one gone a second, and when the last
  // one goes you start drowning.
  //
  // Separate from the tank on purpose, and it is worth being clear about why
  // there are two clocks rather than one. The tank is the RUN's clock: abstract,
  // long, and spent on decisions made minutes apart. Breath is the ROOM's:
  // concrete, five seconds long, and spent on the decision in front of you. A
  // player who only had the tank would treat a dive as slightly more expensive
  // walking, which is what the water played like before this — the double air
  // cost is real and completely invisible in the moment.
  //
  // Counted in ticks and divided back into bubbles by the view, rather than
  // stored as a count of five, so the view can pop one smoothly and the sim
  // never has to think about it.
  const breathMax = SWIM.bubbles * SWIM.bubbleTicks;
  let breath = under
    ? prev.breath - 1
    : // A gulp, not a lung-load. Coming up refills four times as fast as going
      // down empties, so surfacing is a beat rather than an errand.
      Math.min(breathMax, prev.breath + SWIM.refill);
  if (breath < -breathMax) breath = -breathMax;
  if (breath <= 0 && under) {
    // Drowning. It takes the last bar too — unlike the burn and the poison,
    // which both floor at one.
    //
    // Those two are things done TO you and there is no answer but waiting, so
    // letting them finish a run would be a coin toss. This is the opposite:
    // there is always an answer, it is up all the way to the surface, and you
    // have five seconds of warning with a counter over your own head. A drowning
    // that cannot kill you is not a reason to go up.
    wound(bar * SWIM.drownPerTick);
    events.push({ type: "drowning", x, y });
  }

  const spend = entered && state.air > 0 ? 1 + (under ? SWIM.underAir : 0) : 0;
  const air = Math.max(0, state.air - spend) + airBonus;
  const airCapacity = state.airCapacity + airBonus;
  const deepestX = entered ? Math.max(state.deepestX, x) : state.deepestX;

  // FR-2.3 — a player always knows which environment they are in and when they
  // have crossed into the next. The sim's job is to say so; the view's job is
  // to make it legible. Derived from position (ARCH AD-22) so the two can never
  // disagree, and it moves both ways: a shortcut used backwards is a crossing.
  const environment = entered ? environmentAt(x) : state.environment;
  if (environment !== state.environment) {
    events.push({
      type: "environmentChanged",
      from: state.environment,
      to: environment,
    });
  }

  // The Warden holds the far door. While it lives, the exit at the end of the
  // environment is not an exit — and its chest stays shut.
  //
  // The MOUTH is deliberately still open. A boss that sealed both ways out
  // would not be a fight, it would be a countdown: a player who arrives with
  // eight seconds of air has to be able to turn round and bank what they are
  // carrying, and choosing to do that instead of fighting is the same decision
  // the whole game is made of.
  /** Whether a given boss is still standing. */
  const bossAlive = (kind: Enemy["kind"]) =>
    enemies.some((e) => e.kind === kind && e.phase !== "dead");

  // Each sealed chest answers to its OWN boss. Unlocking every locked chest the
  // moment the first boss fell handed the player the Kiln's chest from two
  // environments away, before they had met the thing guarding it.
  chests = chests.map((c) =>
    c.locked && c.lockedBy && !bossAlive(c.lockedBy)
      ? { ...c, locked: false }
      : c,
  );

  // Extraction. PRD FR-4.2 — through ANY exit, not just the one you came in by.
  //
  // Back out through the mouth, or up one of the ten shafts. There is no third
  // door: the far exit is gone, and with it the rule that a boss standing on it
  // held it shut. The mouth is always open and so is every shaft — FR-4.2 wants
  // retreating to be a decision you can always make, so a boss is never a trap.
  const extracted =
    entered &&
    // Up a shaft, or back out of the mouth. FR-4.2 — any exit banks the whole
    // run, and a shaft is an exit.
    //
    // There used to be a third: a lit door at the far end of the fire, thirty
    // metres past the chamber. It is gone. It did exactly what the shaft at the
    // end of the fire does, sat immediately after the one door in the game that
    // is meant to be noticed, and read as the more inviting of the two — so the
    // last thing a player saw before the boss room was a brighter door telling
    // them to leave.
    (escaped ||
      // The chamber is excluded: it lives past the end of the world, so without
      // this it reads as "very far right" and banks the run the instant you
      // step through the door.
      (!inChamber(x) && x <= ROOM.entranceX - 10));

  // Developer mode. Both ways of losing are switched off — health AND air,
  // because there are two of them and "cannot die" that still suffocates you
  // after two minutes is not a debug mode, it is a longer timer.
  //
  // Held at FULL rather than at a sliver: a bar that sits at one for the whole
  // run reads as "about to die" every time you glance at it, which is the exact
  // opposite of what the flag is telling you.
  if (state.god) hp = stats.maxHp;
  // Restoration, applied last so it beats whatever landed on the same tick.
  // A potion drunk at one bar that then lost that bar to a goblin swing in the
  // same frame would be the worst possible moment to discover the ordering.
  if (healTo > 0) hp = Math.max(hp, healTo);
  // Never negative. Dead is dead, and a stored -2 is a number that leaks into
  // every readout that has to remember to clamp it — the HUD already did.
  if (hp < 0) hp = 0;

  // Assembled here rather than inline in the return, because the tutorial has
  // to read it.
  //
  // It used to be given `{ ...state.player, x, y }` — LAST tick's player with
  // this tick's position pasted on — which is fine for the stations that ask
  // "where are you" and silently wrong for every station that asks "what did
  // you just do". The backstep never registered: its whole signature is a
  // stance that lasts nine ticks, and the stance being read was always the one
  // from before the move.
  const nextPlayer: Player = {
    ...player,
    hp,
    running: player.running && hp >= player.hp,
    struck: swungAt,
    burning,
    poisoned,
    breath,
    // Spread in here rather than assigned above, because the player object is
    // assembled long before a parry is resolved.
    ...(parriedSomething ? { action: { ...player.action, lockout: 0 } } : {}),
    ...(thrownTo ? { x: thrownTo.x, y: thrownTo.y, vx: 0, vy: 0 } : {}),
  };

  const outcome: SimState["outcome"] =
    entered && air === 0 && !state.god
      ? "transformed"
      : hp <= 0
        ? "died"
        : extracted
          ? "extracted"
          : "running";

  return {
    tick: state.tick + 1,
    // Stamped once, the tick it goes down, and never revised. `??` rather than
    // a plain assignment so a second look at a corpse cannot move the time.
    felledTick:
      state.felledTick ??
      (enemies.some((e) => e.kind === "enemy.revenant" && e.phase === "dead")
        ? state.tick
        : null),
    // Advanced last, so a lesson that asks "is the goblin dead" is reading the
    // enemies as they are at the END of the tick rather than as they were at
    // the start of it. Off by one tick is invisible everywhere else in here and
    // very visible in a prompt that lingers for a frame after you have won.
    tutorial: state.tutorial
      ? stepTutorial(state.tutorial, { ...state, enemies, chests }, nextPlayer)
      : null,
    // Carried, never recomputed. Both are properties of the RUN, set when it
    // was created, and the reducer has no business changing either.
    god: state.god,
    loadout: state.loadout,
    potions,
    buffs,
    // Stamped once, on the tick the run stops being winnable.
    endedTick: state.endedTick ?? (outcome === "running" ? null : state.tick),
    air,
    airCapacity,
    // Enemy damage is resolved after the body moved, so the sprint is cleared
    // here rather than above: taking a hit breaks stride like everything else.
    //
    // The throw-back is spread in HERE rather than onto the `x` and `y` locals.
    // `player` is assembled several hundred lines earlier, so assigning to those
    // after the fact is dead code — which is exactly what the first version of
    // this was, and the test caught it by reporting the player thrown FORWARD
    // into the trap they had just triggered.
    player: nextPlayer,
    enemies,
    // Nothing here is banked. What happens to it is decided by `outcome`:
    // walking out keeps all of it (FR-4.2), and both fail states lose all of
    // it (FR-21.1). The sim's job is only to say what was carried and how the
    // run ended — a run that ends is not resumed, so it never has to zero it.
    chests,
    traps,
    arrows,
    eruptions,
    inArena: arena !== null,
    nextArrowId,
    carried,
    entered,
    enteredTick,
    deepestX,
    environment,
    openShortcuts,
    leversFlicked,
    outcome,
    previousIntents: intents,
    events,
  };
}
