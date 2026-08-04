/**
 * Simulation state.
 *
 * ARCH AD-1: the core is a pure reducer, so this is the whole world. If it
 * isn't in here, the sim doesn't know about it — no hidden module-level
 * variables, no reaching out to a clock or a store.
 */

import type { Intents } from "./intents.ts";

/** What the player's body is doing. Drives which rules apply this tick. */
export type PlayerStance =
  "grounded" | "airborne" | "crouching" | "sliding" | "backstepping";

/**
 * An action with startup / active / recovery phases, authored in ticks.
 * See addendum.md — this is how every attack, block and dodge is expressed.
 */
export type ActionState = {
  /** Which action, or null when the player is free to act. */
  kind: "attack" | "block" | "stun" | "bow" | "smash" | null;
  /** Ticks elapsed since the action began. */
  elapsed: number;
  /** Ticks until the player can act again. Zero means free. */
  lockout: number;
  /**
   * Which swing this is. Consecutive attacks alternate 0, 1, 0, 1 so the
   * player sees two different animations rather than the same one repeating.
   */
  variant: 0 | 1;
};

export type Player = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Which way the player is looking. Drives attacks and the slide direction. */
  facing: 1 | -1;
  stance: PlayerStance;
  /** Ticks remaining in the current slide or backstep. */
  dashTicks: number;
  hp: number;
  action: ActionState;
  /** Which swing the next attack will use. */
  nextAttack: 0 | 1;
  /** Ticks since the last swing ended. The chain resets once this runs out. */
  comboWindow: number;
};

/**
 * What an enemy is doing. PRD FR-7.1: an enemy is a subset of the player's
 * verbs, so these states are deliberately the same shape as the player's.
 */
export type EnemyPhase =
  | "idle"
  | "approaching"
  | "telegraphing"
  | "striking"
  | "recovering"
  | "staggered"
  | "dead";

/** Which of the player's verbs this enemy has. Difficulty is breadth (FR-7.2). */
export type EnemyVerbs = {
  move: boolean;
  attack: boolean;
  slide: boolean;
  block: boolean;
};

export type Enemy = {
  /** Content slug — the join key everywhere (ARCH conventions). */
  kind: "enemy.goblin";
  x: number;
  y: number;
  facing: 1 | -1;
  hp: number;
  phase: EnemyPhase;
  /** Ticks elapsed in the current phase. */
  phaseTicks: number;
  verbs: EnemyVerbs;
  /** Set for one tick when this enemy's swing is parried, so the view can flash. */
  parriedThisTick: boolean;
};

/** How a run ended. PRD fail states — death and transformation differ in kind. */
export type RunOutcome = "running" | "died" | "transformed" | "extracted";

export type SimState = {
  /** Ticks elapsed since the run began. The sim's only notion of time. */
  tick: number;
  /** Air remaining, in ticks. PRD FR-17 — this is the run timer. */
  air: number;
  /** Air the run started with, for HUD proportions. */
  airCapacity: number;
  player: Player;
  enemies: readonly Enemy[];
  /**
   * False until the player crosses the cave mouth. Outside, air does not drain
   * and nothing moves — the clock is the dungeon's, not the game's.
   */
  entered: boolean;
  /**
   * Furthest x reached inside. Loot scales with distance (PRD Loot sources),
   * so this is what a run is ultimately worth.
   */
  deepestX: number;
  outcome: RunOutcome;
  /** The intents held last tick, so the reducer can detect presses. */
  previousIntents: Intents;
  /**
   * Things that happened this tick, for the view to react to. Cleared every
   * tick — never accumulated, so state stays a pure function of the inputs.
   */
  events: readonly SimEvent[];
};

export type SimEvent =
  | { type: "entered" }
  | { type: "parry"; x: number; y: number }
  | { type: "playerHit"; damage: number }
  | { type: "enemyHit"; damage: number; x: number; y: number }
  | { type: "enemyDied"; x: number; y: number };
