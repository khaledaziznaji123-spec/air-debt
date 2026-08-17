/**
 * What a finished run is worth, for the leaderboards.
 *
 * IN THE SIM, deliberately, and that is the whole reason the boards can be
 * trusted. The server does not take a score from the browser and sanity-check
 * it — it replays the submitted input log through the same reducer and calls
 * these same functions on the result. So there is exactly one definition of
 * "richest" and one of "fastest", and the client and the server cannot disagree
 * about either. To cheat you have to forge an input log that genuinely produces
 * the score, and that is not a cheat, that is a run.
 *
 * It only works while these stay pure functions of `SimState`: no clock, no
 * config the server might hold a different copy of, no randomness. See ARCH
 * AD-1 and AD-7.
 */
import type { SimState } from "./types.ts";

/** The two things a run can be ranked on. */
export type Board = "riches" | "speed";

export const BOARDS: readonly Board[] = ["riches", "speed"];

/**
 * The ceiling a boss-kill time is measured against.
 *
 * Twenty minutes: far longer than any real clear, so nothing is ever clipped to
 * zero. A constant rather than "the slowest run so far", because a relative
 * ceiling would silently rescore every row on the board the moment somebody
 * submitted a slow one.
 */
export const SPEED_CEILING = 60 * 60 * 20;

/**
 * What the bag is worth.
 *
 * Weighted by grade, so the board rewards going deep rather than farming the
 * entrance: a grade-five gem is worth five grade-ones. That is the same shape
 * as "depth pays" everywhere else in the game (FR-10). Gold counts at one, and
 * a legendary is worth a great deal because there is no other way to get one.
 */
export function bagValue(carried: SimState["carried"]): number {
  const gems = carried.gems.reduce((sum, n, i) => sum + n * (i + 1) * 10, 0);
  return gems + carried.gold + carried.legendaries * 500;
}

/**
 * The run's score on a board, or null if it never qualified for that board.
 *
 * Null rather than zero, and the difference matters: a zero is a bad score and
 * belongs on the board, a null is a run that must not appear on it at all.
 *
 * HIGHER IS BETTER ON BOTH BOARDS. Speed is naturally lower-is-better, and
 * carrying that difference around would mean every sort, every personal-best
 * check and every SQL `order by` had to know which board it was looking at —
 * four places to get it backwards. A time is stored as the ticks SAVED against
 * the ceiling instead, so the whole system only ever sorts one way.
 */
export function scoreOf(state: SimState, board: Board): number | null {
  // Never the tutorial, and never a god-mode run. Both live in the state itself
  // rather than alongside it precisely so this check is possible — a flag the
  // reducer never recorded could not be confirmed by a replay.
  if (state.tutorial !== null || state.god) return null;

  if (board === "riches") {
    // Banked, not carried. The extraction decision IS the game: a run that
    // reached the bottom and drowned on the way home scores nothing here,
    // because that is exactly what it earned the player (FR-21.1).
    if (state.outcome !== "extracted") return null;
    return bagValue(state.carried);
  }

  // Speed: entered, and the Revenant down. Walking out afterwards is not
  // required — the kill is the achievement, and the game already takes that
  // position elsewhere: a player who kills it and then drowns on the way home
  // has still killed it.
  if (state.felledTick === null || state.enteredTick === null) return null;
  const ticks = state.felledTick - state.enteredTick;
  if (ticks <= 0) return null;
  // Clamped at zero rather than left negative, so an absurdly slow run cannot
  // sort below a legitimate one by going round the back.
  return Math.max(0, SPEED_CEILING - ticks);
}

/** A stored speed score, back as the time it stands for. In ticks. */
export function ticksFromSpeed(value: number): number {
  return SPEED_CEILING - value;
}

/** Every board this run qualifies for, with its score on each. */
export function scoresOf(state: SimState): { board: Board; value: number }[] {
  const out: { board: Board; value: number }[] = [];
  for (const board of BOARDS) {
    const value = scoreOf(state, board);
    if (value !== null) out.push({ board, value });
  }
  return out;
}