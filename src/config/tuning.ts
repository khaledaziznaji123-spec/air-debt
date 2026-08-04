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

  /**
   * Movement. World units per tick, so nothing here needs a delta.
   * One world unit is one pixel at the reference resolution; the renderer
   * owns any scaling from there (ARCH AD-16).
   */
  movement: {
    /** Horizontal run speed. */
    runSpeed: 3.2,
    /** Upward impulse applied on the jump tick. */
    jumpImpulse: 11.5,
    /** Downward acceleration per tick. */
    gravity: 0.55,
    /** Terminal fall speed, so a long drop stays predictable. */
    maxFallSpeed: 16,
    /** Slide: forward burst speed and how long it lasts (FR-5.2). */
    slideSpeed: 6.4,
    slideDuration: s(0.25),
    /** Backstep: the standing / mid-attack variant of the same button. */
    backstepSpeed: 5.0,
    backstepDuration: s(0.15),
    /** Crouch shrinks the hurtbox; height multiplier applied while held. */
    crouchHeightScale: 0.55,
    /** Crouch-walking is possible but slow — the trade for a smaller profile. */
    crouchSpeedScale: 0.45,
  },

  /** The playfield for the first slice — a single flat room. */
  room: {
    width: 1280,
    floorY: 560,
    playerSpawnX: 200,
  },

  /**
   * Player body, in world units. This is the HURTBOX, not the sprite — the art
   * is 48x96 and deliberately overhangs, so hair and swinging arms never take
   * a hit (see addendum).
   */
  player: {
    width: 30,
    height: 82,
    maxHp: 100,
    /** Sword damage per connecting hit. */
    attackDamage: 34,
    /** Reach ahead of the player's facing edge — matches the blade's extension. */
    attackReach: 56,
    /**
     * The attack box is the SWORD, not the body: a horizontal band at the
     * height the blade sweeps, given as fractions of player height measured up
     * from the feet. Swinging at someone's ankles should not connect.
     */
    attackBoxTop: 0.78,
    attackBoxBottom: 0.28,
    /** Ticks into the swing before the hitbox goes live (startup). */
    attackStartup: s(0.1),
    /** How long the hitbox stays live. */
    attackActive: s(0.1),
    /** Recovery after the swing. Long enough for the three-frame arc to read. */
    attackRecovery: s(0.24),
    /** Grace after a swing in which the next press continues the chain. */
    comboWindow: s(0.45),
    /**
     * Smash-down (PRD FR-5.5): jump, then press crouch. The blade goes
     * overhead and is driven into the floor on landing. Heavy, committal, and
     * the only attack that hits a group.
     */
    smashDamage: 42,
    /** Downward speed forced once the smash commits. */
    smashFallSpeed: 22,
    /** Half-width of the impact, centred on the player. Hits both sides. */
    smashRadius: 52,
    /** Frames the impact stays live after landing. */
    smashActive: s(0.12),
    /** Recovery once it lands. Long — this is a committal move. */
    smashRecovery: s(0.42),
    /** The stun attack: weak, slow, and the only guard-breaker (FR-5.6). */
    stunDamage: 8,
    stunStartup: s(0.3),
    stunActive: s(0.1),
    stunReach: 34,
  },

  /**
   * Enemies. PRD FR-7: an enemy is defined by which of the player's verbs it
   * has, not by inflated numbers. The goblin is the floor of that scale —
   * it moves and it attacks, and that is all.
   */
  enemies: {
    goblin: {
      // Hurtbox. Bigger than the player's 30x82 — it should loom, not scale
      // down. The 48x96 sprite still overhangs: ears and cleaver are not
      // hittable, the body is.
      width: 34,
      height: 86,
      maxHp: 60,
      speed: 1.15,
      damage: 12,
      /** How close before it commits to a swing. */
      attackRange: 46,
      /** Wind-up. This is the window the player is reading (FR-18.5 in spirit). */
      telegraph: s(0.45),
      /** Hitbox live time. */
      active: s(0.1),
      /** Recovery after the swing, whether or not it connected. */
      recovery: s(0.5),
      /** Reach of its swing. */
      reach: 40,
    },
  },

  /** What a parry does back. PRD FR-5.8. */
  parry: {
    /** Damage reflected into a melee attacker. */
    riposteDamage: 18,
    /** How long the attacker is staggered after being parried. */
    staggerTicks: s(0.6),
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
  const {
    environmentTraverse,
    miniBoss,
    finalBoss,
    environmentCount,
    shortcutSaving,
    shortcutCount,
  } = t.budget;

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
