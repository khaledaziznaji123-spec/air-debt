/**
 * Seeded PRNG for the simulation.
 *
 * `Math.random()` is unseedable and V8-implementation-specific, so it can never
 * appear inside the sim (PRD NFR-2). Every random decision in a run — encounter
 * placement, chest contents, trap positions, the run modifier — derives from a
 * single SERVER-ISSUED seed (PRD FR-15.1), which is what makes a run
 * reproducible from its seed plus its input log.
 *
 * mulberry32: 32-bit state, fast, and identical across engines because it uses
 * only integer ops and a single float divide.
 */

export type Rng = {
  /** Next float in [0, 1). */
  next(): number;
  /** Next integer in [0, max). */
  int(max: number): number;
  /** Current state — snapshot this to fork or resume deterministically. */
  state(): number;
};

export function createRng(seed: number): Rng {
  let a = seed >>> 0;

  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    int: (max: number) => Math.floor(next() * max),
    state: () => a,
  };
}

/**
 * Derive an independent stream from a base seed.
 *
 * Use one stream per concern (encounters, chests, traps) so that changing how
 * many chests a run rolls does not shift every subsequent trap position. Without
 * this, tuning one system silently invalidates stored replays of every other.
 */
export function deriveSeed(baseSeed: number, streamId: number): number {
  return (Math.imul(baseSeed ^ streamId, 0x9e3779b1) >>> 0) || 1;
}
