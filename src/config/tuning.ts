/**
 * Tuning table — every number the game's feel depends on, in one place.
 *
 * PRD NFR-1.1 requires these to be changeable without shipping a new build, so
 * this module is the local default only. At runtime the values are expected to
 * come from the server, with this table as the fallback and as the schema.
 *
 * All durations are in SIMULATION TICKS, never milliseconds (PRD NFR-2.2).
 * Wall-clock seconds vary with frame rate and device; ticks do not.
 */

/** Fixed simulation rate. The sim advances in whole ticks or not at all. */
export const TICK_HZ = 60;

/** Seconds → ticks. Only for authoring readability; never used at runtime. */
const s = (seconds: number) => Math.round(seconds * TICK_HZ);

export const tuning = {
  /** PRD FR-5 — combat timing. Provisional; the relationships must survive tuning. */
  combat: {
    /** FR-5.7 — a block landed inside this window parries. */
    parryWindow: s(0.3),
    /** FR-5.9 — mistimed block: no movement or dodge for this long afterwards. */
    mistimePunish: s(0.4),
    /** FR-5.6 — how long a stunned enemy cannot act. */
    stunDuration: s(1.0),
  },

  /** PRD FR-17, FR-19 — the oxygen budget. */
  air: {
    /** FR-17.1 — starting air with no upgrades. */
    base: s(30),
    /** FR-19.2 — each air tank upgrade adds this much. */
    perUpgrade: s(30),
    /** FR-19.3 — hard ceiling. 30s + 10 × 30s. */
    max: s(330),
    /** FR-19 — number of purchasable upgrade tiers. */
    upgradeTiers: 10,
  },

  /** PRD FR-19, FR-20 — the time budget the whole design is solved against. */
  budget: {
    /** FR-19.1 — traversing one environment at AVERAGE play (FR-19.5). */
    environmentTraverse: s(60),
    /** FR-20.1 — one mini-boss, on top of the traverse (FR-20.4). */
    miniBoss: s(10),
    /** FR-20.2 — the final boss. */
    finalBoss: s(60),
    /** FR-2.1 — number of environments. */
    environmentCount: 5,
    /** FR-20.6 — working value; total savings must stay within FR-20.5. */
    shortcutSaving: s(13),
    shortcutCount: 7,
  },

  /** PRD FR-18.5 — how long before a trap fires that its tell appears. */
  traps: {
    tellLeadTime: s(0.5),
  },

  /** PRD FR-13.2a/13.2b — the anti-pay-to-win guarantee. */
  economy: {
    /** Gold is spendable only at or above this fraction of the required gems, per grade. */
    goldShortfallThreshold: 0.7,
  },
} as const;

/**
 * The design invariant from PRD FR-20, checked rather than trusted.
 *
 * A maxed tank must be INSUFFICIENT to win by walking (that is what makes
 * shortcuts the win condition), and total shortcut savings must be large enough
 * to close the gap but small enough that the last tank upgrade still matters.
 */
export function checkTimeBudget(t: typeof tuning = tuning) {
  const { environmentTraverse, miniBoss, finalBoss, environmentCount, shortcutSaving, shortcutCount } = t.budget;

  const perEnvironment = environmentTraverse + miniBoss;
  const reachBoss = perEnvironment * environmentCount;
  const unaided = reachBoss + finalBoss;
  const savings = shortcutSaving * shortcutCount;
  const oneUpgradeShort = t.air.max - t.air.perUpgrade;

  return {
    unaided,
    maxTank: t.air.max,
    savings,
    /** FR-20: walking the whole dungeon on a full tank must still lose. */
    shortcutsAreRequired: unaided > t.air.max,
    /** FR-20.5 lower wall: with every shortcut, a maxed player must be able to win. */
    winnable: unaided - savings <= t.air.max,
    /** FR-20.5 upper wall: the final upgrade must not be dead progression. */
    topUpgradeMatters: unaided - savings > oneUpgradeShort,
  };
}
