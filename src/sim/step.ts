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
import { Intent, has, pressed, type Intents } from "./intents.ts";
import type {
  ActionState,
  Enemy,
  Player,
  SimEvent,
  SimState,
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

export type Box = { left: number; right: number; top: number; bottom: number };

function overlaps(a: Box, b: Box): boolean {
  return (
    a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
  );
}

function playerBox(p: Player): Box {
  const h =
    p.stance === "crouching"
      ? BODY.height * MOVE.crouchHeightScale
      : BODY.height;
  return {
    left: p.x - BODY.width / 2,
    right: p.x + BODY.width / 2,
    top: p.y - h,
    bottom: p.y,
  };
}

function enemyBox(e: Enemy): Box {
  return {
    left: e.x - GOBLIN.width / 2,
    right: e.x + GOBLIN.width / 2,
    top: e.y - GOBLIN.height,
    bottom: e.y,
  };
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

function isBusy(p: Player): boolean {
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
export function playerHitbox(p: Player): Box | null {
  if (p.action.kind === "attack") {
    const t = p.action.elapsed;
    if (t < BODY.attackStartup || t >= BODY.attackStartup + BODY.attackActive)
      return null;
    return swingBox(
      p.x,
      p.y,
      p.facing,
      BODY.attackReach,
      BODY.height * BODY.attackBoxTop,
      BODY.height * BODY.attackBoxBottom,
    );
  }
  if (p.action.kind === "smash") {
    // Only live for a moment after touchdown, and it hits BOTH sides — the one
    // attack that answers being surrounded (PRD FR-5.5).
    if (p.action.elapsed >= BODY.smashActive) return null;
    return {
      left: p.x - BODY.smashRadius,
      right: p.x + BODY.smashRadius,
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
function stepEnemy(e: Enemy, player: Player): Enemy {
  if (e.phase === "dead") return e;

  const ticks = e.phaseTicks + 1;
  const dx = player.x - e.x;
  const distance = Math.abs(dx);
  const facing: 1 | -1 = dx >= 0 ? 1 : -1;

  switch (e.phase) {
    case "staggered":
      return ticks >= PARRY.staggerTicks
        ? { ...e, phase: "approaching", phaseTicks: 0, parriedThisTick: false }
        : { ...e, phaseTicks: ticks, parriedThisTick: false };

    case "recovering":
      return ticks >= GOBLIN.recovery
        ? { ...e, phase: "approaching", phaseTicks: 0 }
        : { ...e, phaseTicks: ticks };

    case "striking":
      return ticks >= GOBLIN.active
        ? { ...e, phase: "recovering", phaseTicks: 0 }
        : { ...e, phaseTicks: ticks };

    case "telegraphing":
      // Committed. It will not turn to follow you — stepping around a wind-up
      // is a real answer, which is what makes the tell worth reading.
      return ticks >= GOBLIN.telegraph
        ? { ...e, phase: "striking", phaseTicks: 0 }
        : { ...e, phaseTicks: ticks };

    case "idle":
    case "approaching":
    default: {
      if (!e.verbs.attack || !e.verbs.move)
        return { ...e, phaseTicks: ticks, facing };
      if (distance <= GOBLIN.attackRange) {
        return { ...e, phase: "telegraphing", phaseTicks: 0, facing };
      }
      const x = e.x + facing * GOBLIN.speed;
      return { ...e, x, facing, phase: "approaching", phaseTicks: ticks };
    }
  }
}

export function step(state: SimState, intents: Intents): SimState {
  if (state.outcome !== "running") {
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

  // ---------------------------------------------------------------- player
  let vx = prev.vx;
  let vy = prev.vy;
  let x = prev.x;
  let y = prev.y;
  let facing = prev.facing;
  let hp = prev.hp;
  let dashTicks = prev.dashTicks > 0 ? prev.dashTicks - 1 : 0;
  let action = stepAction(prev.action);

  const grounded = y >= FLOOR;

  if (dashTicks === 0) {
    if (has(intents, Intent.Right) && !has(intents, Intent.Left)) facing = 1;
    else if (has(intents, Intent.Left) && !has(intents, Intent.Right))
      facing = -1;
  }

  // Slide / backstep — context-sensitive (FR-5.2), and cancels a swing (FR-5.10).
  if (has(justPressed, Intent.Slide) && dashTicks === 0) {
    const moving = has(intents, Intent.Left) !== has(intents, Intent.Right);
    const attacking = action.kind === "attack";
    if (moving && !attacking) {
      dashTicks = MOVE.slideDuration;
      vx = facing * MOVE.slideSpeed;
    } else {
      dashTicks = MOVE.backstepDuration;
      vx = -facing * MOVE.backstepSpeed;
    }
    action = { kind: null, elapsed: 0, lockout: 0, variant: action.variant };
  }

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
      lockout: BODY.stunStartup + BODY.stunActive + 14,
      variant: 0,
    };
  }

  // PRD FR-5.5 — jump, then press crouch to drive the blade into the floor.
  // Only available in the air, which is what makes it a deliberate setup
  // rather than a button to mash.
  const airborne = y < FLOOR;
  if (has(justPressed, Intent.Crouch) && airborne && action.kind === null) {
    action = { kind: "smash", elapsed: 0, lockout: 999, variant: 0 };
  }
  const smashing = action.kind === "smash";

  if (dashTicks === 0 && !smashing) {
    const left = has(intents, Intent.Left);
    const right = has(intents, Intent.Right);
    const speed =
      has(intents, Intent.Crouch) && !airborne
        ? MOVE.runSpeed * MOVE.crouchSpeedScale
        : MOVE.runSpeed;
    vx = left === right ? 0 : right ? speed : -speed;
  } else if (smashing) {
    vx = 0; // committed straight down
  }

  if (has(justPressed, Intent.Jump) && grounded && !isBusy(prev)) {
    vy = -MOVE.jumpImpulse;
  }
  vy = smashing
    ? BODY.smashFallSpeed
    : Math.min(vy + MOVE.gravity, MOVE.maxFallSpeed);

  x = x + vx;
  y = y + vy;

  const landed = y >= FLOOR;
  if (landed) {
    y = FLOOR;
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
  const half = BODY.width / 2;
  if (x < half) x = half;
  if (x > ROOM.width - half) x = ROOM.width - half;

  const onGround = y >= FLOOR;
  const stance: Player["stance"] =
    dashTicks > 0
      ? vx * facing > 0
        ? "sliding"
        : "backstepping"
      : !onGround
        ? "airborne"
        : has(intents, Intent.Crouch)
          ? "crouching"
          : "grounded";

  // Bodies are solid: you cannot walk through a goblin. Two ways past, and
  // both fall out of the geometry rather than being special-cased —
  //   SLIDE: a dash passes through, so it is an escape as well as a dodge
  //   JUMP:  clear its head and the boxes never overlap in the first place
  if (stance !== "sliding" && stance !== "backstepping") {
    const playerHeight =
      stance === "crouching"
        ? BODY.height * MOVE.crouchHeightScale
        : BODY.height;
    for (const e of state.enemies) {
      if (e.phase === "dead") continue;
      const eLeft = e.x - GOBLIN.width / 2;
      const eRight = e.x + GOBLIN.width / 2;
      const eTop = e.y - GOBLIN.height;
      // No vertical overlap means no collision — this is what lets a jump clear it.
      if (y - playerHeight >= e.y || y <= eTop) continue;
      if (x + half <= eLeft || x - half >= eRight) continue;
      // Push out along whichever side is nearer, so you slide off rather than
      // teleporting across.
      const outLeft = eLeft - (x + half);
      const outRight = eRight - (x - half);
      x += Math.abs(outLeft) < Math.abs(outRight) ? outLeft : outRight;
      if (x < half) x = half;
      if (x > ROOM.width - half) x = ROOM.width - half;
    }
  }

  const player: Player = {
    x,
    y,
    vx,
    vy,
    facing,
    stance,
    dashTicks,
    hp,
    action,
    nextAttack,
    comboWindow,
  };

  // ---------------------------------------------------------------- enemies
  let enemies = state.enemies.map((e) =>
    stepEnemy({ ...e, parriedThisTick: false }, player),
  );

  // Player's swing lands.
  const swing = playerHitbox(player);
  if (swing) {
    const damage =
      player.action.kind === "stun" ? BODY.stunDamage : BODY.attackDamage;
    enemies = enemies.map((e) => {
      if (e.phase === "dead" || !overlaps(swing, enemyBox(e))) return e;
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
  }

  // Enemy swings land — or get parried.
  const pBox = playerBox(player);
  const parrying = isParrying(player);
  enemies = enemies.map((e) => {
    if (e.phase !== "striking" || e.phaseTicks !== 0) return e;
    // The goblin's swing covers its full height — it is a wild lunge, not a
    // measured cut, and a taller player should not be able to duck it for free.
    const eSwing = swingBox(e.x, e.y, e.facing, GOBLIN.reach, GOBLIN.height);
    if (!overlaps(eSwing, pBox)) return e;

    if (parrying) {
      // PRD FR-5.8: a parried melee attack damages its attacker.
      events.push({ type: "parry", x: e.x, y: e.y - GOBLIN.height / 2 });
      const nextHp = e.hp - PARRY.riposteDamage;
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
      return {
        ...e,
        hp: nextHp,
        phase: "staggered" as const,
        phaseTicks: 0,
        parriedThisTick: true,
      };
    }

    hp -= GOBLIN.damage;
    events.push({ type: "playerHit", damage: GOBLIN.damage });
    return e;
  });

  // ---------------------------------------------------------------- outcome
  // PRD FR-1.3: air reaching zero is transformation, not death. Different in
  // kind, and checked first because it is the run's own clock running out.
  const air = state.air > 0 ? state.air - 1 : 0;
  const outcome: SimState["outcome"] =
    air === 0 ? "transformed" : hp <= 0 ? "died" : "running";

  return {
    tick: state.tick + 1,
    air,
    airCapacity: state.airCapacity,
    player: { ...player, hp },
    enemies,
    outcome,
    previousIntents: intents,
    events,
  };
}
