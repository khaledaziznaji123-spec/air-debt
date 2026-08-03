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
  | "grounded"
  | "airborne"
  | "crouching"
  | "sliding"
  | "backstepping";

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
  outcome: RunOutcome;
  /** The intents held last tick, so the reducer can detect presses. */
  previousIntents: Intents;
};
