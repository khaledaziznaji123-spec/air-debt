/**
 * The simulation's public surface.
 *
 * ARCH AD-5: `render` and `app` import from here. This module imports only
 * `config` and the standard library — never the other way around.
 * ARCH AD-7: everything reachable from here runs unmodified in the browser and
 * in a Node route handler.
 */

import { tuning } from "../config/tuning.ts";
import { Intent, type Intents, type InputRecord } from "./intents.ts";
import { step } from "./step.ts";
import type { SimState } from "./types.ts";

export { Intent, has, add, remove, pressed } from "./intents.ts";
export type { Intents, InputRecord, IntentFlag } from "./intents.ts";
export { createRng, deriveSeed, type Rng } from "./rng.ts";
export { step, isParrying, playerHitbox, type Box } from "./step.ts";
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
} from "./types.ts";

/**
 * A fresh run.
 *
 * @param airTicks starting air. Defaults to the base tank (PRD FR-17.1);
 *   the real value comes from the player's upgrades, resolved server-side.
 */
/** A goblin: the floor of the verb scale — it moves and it attacks (FR-7.1). */
function goblin(x: number): SimState["enemies"][number] {
  return {
    kind: "enemy.goblin",
    x,
    y: tuning.room.floorY,
    facing: -1,
    hp: tuning.enemies.goblin.maxHp,
    phase: "approaching",
    phaseTicks: 0,
    verbs: { move: true, attack: true, slide: false, block: false },
    parriedThisTick: false,
  };
}

export function createInitialState(
  airTicks: number = tuning.air.base,
): SimState {
  return {
    tick: 0,
    air: airTicks,
    airCapacity: airTicks,
    // Close enough that the first exchange happens within a couple of seconds —
    // at a 30-second base tank, walking to the fight is most of the run.
    enemies: [goblin(560), goblin(920)],
    events: [],
    player: {
      x: tuning.room.playerSpawnX,
      y: tuning.room.floorY,
      vx: 0,
      vy: 0,
      facing: 1,
      stance: "grounded",
      dashTicks: 0,
      hp: tuning.player.maxHp,
      action: { kind: null, elapsed: 0, lockout: 0, variant: 0 },
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
): SimState {
  let state = createInitialState(airTicks);
  if (log.length === 0) return state;

  const byTick = new Map<number, Intents>();
  for (const record of log) byTick.set(record.tick, record.intents);

  const lastTick = log[log.length - 1].tick;
  for (let t = 0; t <= lastTick; t++) {
    state = step(state, byTick.get(t) ?? Intent.None);
  }
  return state;
}
