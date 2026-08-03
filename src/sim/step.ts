/**
 * The reducer. ARCH AD-1.
 *
 * step(state, intents, ...) -> state. No I/O, no clock, no randomness sourced
 * here. Everything it needs arrives as an argument, and it returns a new state
 * rather than mutating the one it was given.
 */

import { tuning } from "../config/tuning.ts";
import { Intent, has, pressed, type Intents } from "./intents.ts";
import type { ActionState, Player, SimState } from "./types.ts";

const { movement: MOVE, room: ROOM, player: BODY, combat: COMBAT } = tuning;

/** The floor line for the player's feet. */
const FLOOR = ROOM.floorY;

function stepAction(action: ActionState): ActionState {
  if (action.kind === null && action.lockout === 0) return action;
  const lockout = action.lockout > 0 ? action.lockout - 1 : 0;
  // The action ends when its lockout expires.
  if (lockout === 0) return { kind: null, elapsed: 0, lockout: 0 };
  return { kind: action.kind, elapsed: action.elapsed + 1, lockout };
}

/** True while the player is committed and cannot start something new. */
function isBusy(p: Player): boolean {
  return p.action.lockout > 0 || p.dashTicks > 0;
}

function applyHorizontal(p: Player, intents: Intents): number {
  // A dash overrides steering entirely — commitment is the point (FR-5.2).
  if (p.dashTicks > 0) return p.vx;

  const left = has(intents, Intent.Left);
  const right = has(intents, Intent.Right);
  if (left === right) return 0; // neither, or both: no drift
  return right ? MOVE.runSpeed : -MOVE.runSpeed;
}

export function step(state: SimState, intents: Intents): SimState {
  // A finished run is a fixed point: stepping it again changes nothing.
  if (state.outcome !== "running") {
    return { ...state, tick: state.tick + 1, previousIntents: intents };
  }

  const justPressed = pressed(intents, state.previousIntents);
  const prev = state.player;

  let vx = prev.vx;
  let vy = prev.vy;
  let x = prev.x;
  let y = prev.y;
  let facing = prev.facing;
  let dashTicks = prev.dashTicks > 0 ? prev.dashTicks - 1 : 0;
  let action = stepAction(prev.action);

  const grounded = y >= FLOOR;

  // --- facing -------------------------------------------------------------
  if (dashTicks === 0) {
    if (has(intents, Intent.Right) && !has(intents, Intent.Left)) facing = 1;
    else if (has(intents, Intent.Left) && !has(intents, Intent.Right)) facing = -1;
  }

  // --- slide / backstep (FR-5.2) ------------------------------------------
  // Context-sensitive: forward while moving, a large step back while standing
  // still or mid-attack.
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
    // FR-5.10: slide cancels a committed attack.
    action = { kind: null, elapsed: 0, lockout: 0 };
  }

  // --- block / parry (FR-5.7, FR-5.9) -------------------------------------
  // The whole window is committed up front: a correct read parries, a wrong one
  // costs more than simply taking the hit. That asymmetry is the design.
  if (has(justPressed, Intent.Block) && !isBusy(prev)) {
    action = {
      kind: "block",
      elapsed: 0,
      lockout: COMBAT.parryWindow + COMBAT.mistimePunish,
    };
  }

  // --- attacks ------------------------------------------------------------
  if (has(justPressed, Intent.Attack) && !isBusy(prev)) {
    action = { kind: "attack", elapsed: 0, lockout: 18 };
  } else if (has(justPressed, Intent.Stun) && !isBusy(prev)) {
    // Slow on purpose (FR-5.6) — the wind-up is the whole cost of the move.
    action = { kind: "stun", elapsed: 0, lockout: 40 };
  }

  // --- horizontal ---------------------------------------------------------
  vx = applyHorizontal({ ...prev, dashTicks }, intents);

  // --- jump and gravity ---------------------------------------------------
  if (has(justPressed, Intent.Jump) && grounded && !isBusy(prev)) {
    vy = -MOVE.jumpImpulse;
  }
  vy = Math.min(vy + MOVE.gravity, MOVE.maxFallSpeed);

  x = x + vx;
  y = y + vy;

  // --- collision ----------------------------------------------------------
  if (y >= FLOOR) {
    y = FLOOR;
    vy = 0;
  }
  const half = BODY.width / 2;
  if (x < half) x = half;
  if (x > ROOM.width - half) x = ROOM.width - half;

  // --- stance -------------------------------------------------------------
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

  // --- air ----------------------------------------------------------------
  // PRD FR-1.3: reaching zero is transformation, not death. Different in kind.
  const air = state.air > 0 ? state.air - 1 : 0;
  const outcome: SimState["outcome"] =
    air === 0 ? "transformed" : prev.hp <= 0 ? "died" : "running";

  return {
    tick: state.tick + 1,
    air,
    airCapacity: state.airCapacity,
    player: { x, y, vx, vy, facing, stance, dashTicks, hp: prev.hp, action },
    outcome,
    previousIntents: intents,
  };
}
