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
    /**
     * A longer tank, for looking at the environment.
     *
     * NOT a design value. `base` is 30 because the entire time budget, the
     * shortcut count and the tank curve are solved against 30 — changing it
     * breaks `checkTimeBudget`, which is exactly what it is there for and how
     * this was caught. So the override lives beside it instead, the shell reads
     * it, and every invariant still runs against the real number.
     *
     * Set to null to play the game as designed.
     */
    testingOverride: s(120) as number | null,
    /** FR-19.2 — each air tank upgrade adds this much. */
    perUpgrade: s(30),
    /** FR-19.3 — hard ceiling. 30s + 10 × 30s. */
    max: s(330),
    /** FR-19 — number of purchasable upgrade tiers. */
    upgradeTiers: 10,
    /**
     * What a Second Breath is worth.
     *
     * A third of the base tank, and deliberately not more: a potion that
     * doubled the run would make the tank upgrades pointless, and the tank is
     * the thing the whole time budget is solved against.
     */
    breathTicks: s(10),
  },

  /**
   * Catching fire.
   *
   * Anything in environment 2 that burns you sets you alight, and being alight
   * costs half a bar on top of whatever lit you. It is the fire's signature the
   * way the goblin's telegraph is the rock's: nothing there hits once.
   *
   * The burn cannot take your last bar — same floor the pressure plates have,
   * for the same reason. Fire that finished you off after you had already
   * survived the thing that started it would make every hit in the environment
   * a coin toss about how much health you happened to be on, and the answer to
   * a burn (there isn't one; you wait) is not the kind of thing that should be
   * allowed to end a run.
   */
  fire: {
    /** How long it burns for, and what the whole burn costs. */
    burnTicks: s(2.2),
    burnDamage: 10,
    /**
     * How long a draught of fireproofing lasts.
     *
     * Thirty seconds is most of a base tank, so this is not a thing you drink
     * on the way in — it is a thing you drink at the mouth of the fire, and the
     * decision is which half of the environment to spend it on.
     */
    proofTicks: s(30),
  },

  /**
   * Swimming. Environment 3.
   *
   * Water is not slower walking; it is a different set of rules. Gravity mostly
   * goes away, you can move UP under your own power, and the ceiling of the
   * pool is a real boundary you have to break to breathe.
   *
   * `underAir` is the interesting one. This is a game about a tank of air, and
   * water is the only place where being somewhere costs more of it than being
   * somewhere else. That is the whole reason to make diving a decision rather
   * than a swim.
   */
  swim: {
    /** Sink speed with no input. Slow — this is not falling. */
    sink: 1.1,
    /** Under your own power, up and down. */
    stroke: 3.4,
    /** Sideways. Slower than running, which is what makes water a cost. */
    kick: 3.6,
    /**
     * How hard you come out when you break the surface with up held.
     *
     * Ten, up from seven. Seven was measured against the waterline and that was
     * the wrong reference: the kick fires while your feet are still twenty-five
     * units under, so most of it is spent getting the body out and only
     * fourteen units of it were left over. Fourteen units clears nothing — the
     * sandbar's first step is thirty-six above the surface, so every shelf in
     * the sea was visible and unreachable.
     *
     * At ten you land on that first step and jump the rest, which is the shape
     * this was always meant to have: the sea gives you the water's edge and you
     * climb the last of it yourself.
     */
    breach: 10.2,
    /** How much of your speed the water takes off you as you enter it. */
    entryDrag: 0.42,
    /** Air spent per tick under the surface, on top of the ordinary one. */
    underAir: 1,

    /**
     * Breath: five bubbles over the player's head, one gone every second.
     *
     * The tank on the player's back is the run's clock and it is abstract — a
     * number at the top of the screen that you learn to read. This is the other
     * kind of pressure and it is deliberately the opposite of abstract: five
     * things, over your own head, and you can count them without looking away
     * from the shark.
     *
     * Five seconds is short on purpose. It is not "how long can you hold your
     * breath", it is "how far is the next surface" — long enough to cross under
     * a reef and come up, not long enough to explore down there. The whole
     * environment is built around a route that keeps touching the surface, and
     * this is the thing that says so.
     */
    bubbles: 5,
    /** How long one bubble lasts. */
    bubbleTicks: s(1),
    /**
     * Damage per tick once they are all gone, as a fraction of a bar.
     *
     * Drowning bites steadily rather than all at once, so the moment you break
     * the surface is a moment you SURVIVED rather than a moment you were told
     * about after the fact. A bar every two seconds: bad enough to run from,
     * slow enough to run from successfully.
     */
    drownPerTick: 1 / s(2),
    /**
     * How fast they come back at the surface.
     *
     * Faster than they go — four times — because a breath is one gulp and
     * having to bob on the surface for five seconds between dives would make
     * the whole environment a waiting room.
     */
    refill: 4,
  },

  /**
   * Poison. Environment 5.
   *
   * Mechanically the burn with a different face on it — the same tick-down, the
   * same floor at one bar, the same refusal to stack — because a player who has
   * learned what being on fire costs should not have to learn a second set of
   * numbers to know what being poisoned costs. What differs is where it comes
   * from and what it looks like.
   */
  poison: {
    ticks: s(3.4),
    damage: 10,
  },

  /** PRD FR-19, FR-20 — the time budget the whole design is solved against. */
  /**
   * Whether the environments have mini-bosses standing on their exits.
   *
   * Off. The game had one at the end of the rock and one at the end of the
   * fire, and with five environments that becomes a boss every ninety seconds
   * — which makes a boss the ordinary case rather than the event. There is one
   * fight now, at the bottom, and everything before it is the walk down.
   *
   * The Warden and the Kiln are not deleted, only unplaced: they are two of the
   * most thoroughly tested things in the game and this is an experiment. Set
   * this back to true and both come back exactly as they were.
   */
  miniBosses: false,

  /**
   * Whether the final boss is placed.
   *
   * Off, and for a better reason than the mini-bosses: it has nowhere to be.
   * The Hollow is currently standing on open floor at the end of environment 5,
   * and a boss that is simply the last thing in a corridor is a monster with a
   * big health bar. It comes back when it has a chamber built for it — a room
   * you go INTO, that reads as somewhere else the moment you arrive.
   *
   * Everything about it is finished and tested: the fight, the two attacks, the
   * walls, the chest. This is one line, and it is the room that is missing.
   */
  finalBoss: true,

  budget: {
    /** FR-19.1 — traversing one environment at AVERAGE play (FR-19.5). */
    environmentTraverse: s(60),
    /** FR-20.1 — one mini-boss, on top of the traverse (FR-20.4). */
    miniBoss: s(10),
    /** FR-20.2 — the final boss. */
    finalBoss: s(60),
    /** FR-2.1 — number of environments. */
    environmentCount: 5,
    /**
     * FR-20.6 — working value; total savings must stay within FR-20.5.
     *
     * Twenty-two seconds, up from thirteen, because there are four of them
     * now instead of seven — one in every environment except the parkour.
     *
     * The two numbers are not independent and never were. The dungeon is 410
     * seconds unaided against a 330-second maxed tank, so the shortcuts have to
     * find 80 seconds between them or the game cannot be finished by anyone.
     * Four times thirteen is 52, which leaves a maxed player 28 seconds short
     * of the exit — not "hard", impossible. Four times twenty-two is 88, which
     * lands at 322 with eight to spare, and still leaves the last tank upgrade
     * worth buying (`topUpgradeMatters`).
     *
     * It is also better as a thing to play. One shortcut per environment that
     * skips a third of it is an event; seven that skip a fifth each are
     * bookkeeping.
     */
    shortcutSaving: s(22),
    shortcutCount: 4,
  },

  /** PRD FR-18.5 — how long before a trap fires that its tell appears. */
  traps: {
    tellLeadTime: s(0.5),
    /** How long the blades stay out. */
    active: s(0.35),
    /** Before it can arm again. Long enough to walk back over deliberately. */
    reset: s(1.4),
    /**
     * A trap does not deal damage. It takes everything down to the last bar.
     *
     * Whatever health you walked in with, you walk out of a trap on one bar —
     * and if you were already on one, it kills you. That makes a trap the only
     * thing in the game whose cost does not depend on how well the run has gone
     * so far, which is exactly the right shape for something that is READ
     * rather than fought: reading it is worth the same to everybody.
     *
     * `damage` is unused for traps and hazards now, and kept only because the
     * spikes below still bleed normally.
     */
    leavesOnLastBar: true,
    /** How high the blades reach above the plate. */
    reach: 46,
    /**
     * A swinging blade, a falling block, or a saw.
     *
     * Heavier than a goblin's 12, because unlike a goblin these cannot be
     * fought — only read and timed. The answer is always to be somewhere else,
     * so the cost of being in the wrong place has to be worth the reading.
     */
    /**
     * A PIT is not a bleed. Falling in takes you to your last bar and puts you
     * back on the ground you fell from, in one go — the same floor a pressure
     * plate applies, plus the throw-back.
     *
     * It used to take a fifth of a bar every twenty ticks, which made a pit a
     * countdown rather than a cost: the real price was the seconds spent
     * climbing out with the air running, and a player who fell in late lost the
     * run to arithmetic they could not see.
     *
     * `hazardInterval` is what remains of that: how often a MOVING hazard can
     * catch the same player, so a saw sweeping through does not fire sixty
     * times a second.
     */
    hazardInterval: 20,
  },

  /**
   * Movement. World units per tick, so nothing here needs a delta.
   * One world unit is one pixel at the reference resolution; the renderer
   * owns any scaling from there (ARCH AD-16).
   */
  movement: {
    /** Horizontal speed from a standing start. The default gait. */
    walkSpeed: 4.3,
    /**
     * Sprint speed. Only reachable by holding the direction through the end of
     * a slide, so the fast gait has to be committed to rather than held down.
     * Every metre run instead of walked is air saved, which is what makes the
     * slide worth learning beyond the i-frames.
     */
    runSpeed: 8.2,
    /** Upward impulse applied on the jump tick. Tall enough to clear a goblin
     *  and to give the smash-down a real drop to fall through. */
    jumpImpulse: 14.2,
    /** Downward acceleration per tick. */
    gravity: 0.55,
    /** Terminal fall speed, so a long drop stays predictable. */
    maxFallSpeed: 16,
    /**
     * Wall grab and wall jump (FR-5.x, movement).
     *
     * The rule: airborne, pressed into a wall, and you catch it. You do not
     * stop — you keep going down, at `wallSlideSpeed` instead of terminal — and
     * jumping from there throws you UP and AWAY. Chain those and a shaft is
     * climbable.
     *
     * `wallJumpPush` is the number that decides whether this is a mechanic or a
     * cheat. Too small and you never leave the wall, so a single wall becomes an
     * infinite ladder and the level's vertical limits mean nothing. Big enough
     * and every re-grab costs you air time and a deliberate hold back into the
     * wall — which is what makes a chain of them feel earned.
     */
    wallSlideSpeed: 2.3,
    wallJumpImpulse: 13.4,
    wallJumpPush: 7.6,
    /**
     * How far from the face a hand still finds it. Wider than the body, because
     * the horizontal pass has already stopped the player flush against the wall
     * and an overlap test would be testing for what collision just removed.
     */
    wallGrabReach: 7,
    /**
     * Coyote time on the wall: how long after letting go the jump still counts
     * as a wall jump. Without it, releasing the direction a frame before
     * pressing jump — which is what fingers actually do — silently spends the
     * input on nothing.
     */
    wallCoyote: s(0.1),
    /** How long the push off a wall holds before steering comes back. */
    wallLaunchTicks: s(0.15),
    /**
     * Slide: forward burst speed and how long it lasts (FR-5.2).
     *
     * The order matters and it is now walk (4.3) < slide (6.8) < sprint (8.2).
     * It used to be slide-fastest, which made the sprint the slower reward for
     * having done the harder thing. This way the slide is the door and the
     * sprint is what is behind it.
     */
    slideSpeed: 6.8,
    slideDuration: s(0.42),
    /**
     * And a wait before the next one.
     *
     * Without it the slide is simply a faster gait — chain them and you cross
     * the dungeon at 6.8 while never being a standing target. The cooldown is
     * what keeps it a decision: it is the escape, and an escape you can spend
     * every half-second is not one.
     *
     * The backstep is NOT gated by this. It is the same button and a different
     * move: a small defensive hop, not a way to cover ground.
     *
     * A full second, so a slide is roughly one in every two and a half of its
     * own lengths — spent, then waited for.
     */
    slideCooldown: s(1.0),
    /**
     * How tall the body is mid-slide, as a fraction of standing.
     *
     * Lower than a crouch, because a slide is the player at full stretch rather
     * than squatting — and because it is what gets under a low lintel. That
     * gives the dodge its third reason to exist: i-frames, the sprint it feeds,
     * and now geometry that cannot be walked through at all.
     */
    slideHeightScale: 0.4,
    /** Backstep: the standing / mid-attack variant of the same button. */
    backstepSpeed: 5.0,
    backstepDuration: s(0.15),
    /** Crouch shrinks the hurtbox; height multiplier applied while held. */
    crouchHeightScale: 0.55,
    /** Crouch-walking is possible but slow — the trade for a smaller profile. */
    crouchSpeedScale: 0.45,
    /**
     * The chute — the one shortcut that is a ride rather than a door.
     *
     * Fast enough that it is unmistakably faster than running it, and it ends
     * with a launch: the exit throws the player up, which both sells the drop
     * and puts them somewhere they have to land from rather than simply
     * arriving. `chuteSag` is how far below the floor the run dips.
     */
    chuteSpeed: 17,
    chuteSag: 190,
    chuteLaunch: 15.5,

    /**
     * The vent. The second shortcut is a column of rising air rather than a
     * hole or a door.
     *
     * `radius` is the half-width of the column at its base — generous, because
     * missing a shortcut you have already paid a lever for is not a skill test.
     * `ceiling` is how high above the floor the lane runs, and it is squeezed
     * from both sides: the tallest thing built under the span stands 146, and
     * the lowest point of the roof over it leaves room for feet no higher than
     * 248. This sits between them with clearance either way. The first attempt
     * put it at 300 and the player spent the flight being shoved back down by
     * a ceiling they could not see. `push` is the tailwind, and it is what
     * makes the vent faster than the ground it flies over rather than safer.
     */
    updraftRadius: 130,
    updraftCeiling: 226,
    updraftRise: 6.2,
    updraftPush: 4.4,
    /**
     * How much of your own horizontal speed survives inside the column.
     *
     * The column blows UP; the lane blows along. Carrying the tailwind down
     * into the column sent a rising player sideways into the ledge at 6330
     * before they had cleared it, which read as the vent dropping them.
     */
    updraftDrift: 0.5,
    /** How far below the lane the wind still catches you. */
    updraftCatch: 34,
    /**
     * The geyser chain. `radius` is how much of the floor over a vent counts as
     * standing on it, `launch` is the throw, and `reach` is what the two of them
     * come out to horizontally — the vents are spaced by it, so the arc off one
     * lands on the next. Change either of the first two and the spacing has to
     * be recomputed; `checkGeyserChain` fails the build if it is not.
     */
    geyserLaunch: 16.4,
    geyserRadius: 92,
    /**
     * The horizontal speed a throw imparts, which the arc is SET to rather than
     * added to.
     *
     * The first version added a push to whatever the player was already doing,
     * and the chain immediately stopped chaining: a walking player covered two
     * hundred and sixty units off a vent and a running one covered five hundred,
     * so no spacing could be right for both. A jet of steam does not care how
     * fast you were jogging when you stepped onto it.
     */
    geyserThrow: 11.2,
    /**
     * Ticks between one vent blowing and the next, which must be the flight
     * time of the arc or the chain is a chain of near misses.
     * `checkGeyserChain` is what keeps the two numbers married.
     */
    geyserStagger: 60,
    geyserPeriod: 240,
    /** How long a vent is actually throwing. */
    geyserBlow: 24,

    /** Descent while crouching in the lane, which is how you bail out early. */
    updraftSink: 3.4,
    /** How far off a ladder's centre still counts as being on it. */
    ladderReach: 22,
    /** Climbing speed. Slower than walking — height costs air (PRD FR-17). */
    climbSpeed: 3.2,
  },

  /** The playfield. */
  room: {
    /**
     * The reference VIEWPORT width — how much of the dungeon is on screen at
     * once, not how big the dungeon is. The world's extent comes from
     * `dungeon.ts`, which derives it from the time budget.
     */
    width: 1280,
    /**
     * The standing floor.
     *
     * Raised from 560: at the old height the ground was a 160-pixel strip along
     * the bottom of a 720 view, so all the rock detail, the crystals and the
     * moss were crammed into a band you could barely see. The tunnel keeps its
     * height because the roof moved with it — see `CEILING_Y` in `terrain.ts`.
     */
    floorY: 470,
    playerSpawnX: 120,
    /**
     * The cave mouth. Everything left of it is outside: no air drain, nothing
     * hunting you. Crossing it starts the run — which is what makes stepping
     * in a decision rather than a loading screen (PRD FR-17).
     */
    entranceX: 430,
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
    /**
     * Health is read in BARS, not in a number.
     *
     * FIVE, at twenty points each, and everything that hurts is priced against
     * the bar rather than against the number:
     *
     *   archer arrow   a full bar
     *   Warden         a full bar
     *   goblin swing   half a bar
     *   trap           whatever you had, down to one bar (see `traps`)
     *
     * So the question a player actually asks mid-fight — how many more of those
     * can I take — stays countable. It is ten goblin hits or five arrows, which
     * is a real margin: at three bars a goblin took a third of the run and two
     * mistakes in a row ended it.
     *
     * 100 rather than 90 because five bars divide it evenly AND halve evenly. A
     * half-bar that lands on 15 of a 30-point bar works; one that lands on
     * 13.33 does not, and ambiguity is the one thing bars exist to prevent.
     */
    healthBars: 5,
    /**
     * Sword damage per connecting hit.
     *
     * Ten, against a goblin's twenty and an archer's ten: two swings and one
     * swing. Deliberately small and round — the enemy health pool is now stated
     * in HITS rather than in points, and that only stays true if the hit is a
     * number that divides them.
     */
    attackDamage: 10,
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
    smashDamage: 10,
    /** Downward speed forced once the smash commits. */
    smashFallSpeed: 22,
    /** Half-width of the impact, centred on the player. Hits both sides. */
    smashRadius: 52,
    /** Frames the impact stays live after landing. */
    smashActive: s(0.12),
    /** Recovery once it lands. Long — this is a committal move. */
    smashRecovery: s(0.42),
    /** The stun attack: weak, slow, and the only guard-breaker (FR-5.6). */
    stunDamage: 5,
    stunStartup: s(0.3),
    stunActive: s(0.1),
    /**
     * A lunging pommel drive, so it out-reaches everything else the player has
     * — further than the sword (56) and well past a goblin's swing (40).
     *
     * That reach is what pays for the rest of it. The move costs three times
     * the sword's startup and returns a quarter of its damage, so if it also
     * had to be thrown from inside the guard it was breaking, there was never
     * a moment worth spending it in.
     */
    stunReach: 58,
    /** Recovery after the drive, whether or not it connected. */
    stunRecovery: s(0.23),
  },

  /**
   * Enemies. PRD FR-7: an enemy is defined by which of the player's verbs it
   * has, not by inflated numbers. The goblin is the floor of that scale —
   * it moves and it attacks, and that is all.
   */
  enemies: {
    /**
     * How close the player must be before an enemy wakes up and starts
     * hunting. The dungeon is tens of thousands of units long; without this,
     * every monster in it would begin walking toward the mouth on tick one and
     * arrive as a single crowd. Wider than a half-screen so an enemy is already
     * moving by the time the player can see it.
     */
    activationRange: 900,
    /**
     * The corrupt archer. PRD FR-7.2: difficulty is verb BREADTH, and this is
     * the second verb set — it keeps its distance and shoots, where the goblin
     * closes and swings.
     *
     * It is the reason the parry reflects (FR-5.7). A goblin teaches you to
     * time a block; an archer is what that timing is FOR, because its arrow
     * comes back and kills the thing that fired it.
     */
    /**
     * The Warden. Environment 1's mini-boss — it stands on the exit.
     *
     * FR-7.2 says difficulty is VERB BREADTH, not a health bar, and this is the
     * first thing in the game with more verbs than the player has answers ready
     * for. It has three, and they are deliberately answered in three different
     * ways:
     *
     *   swing  a high, slow, telegraphed cut     — PARRY it
     *   slam   both fists into the floor, wide   — JUMP it, it cannot be parried
     *   riders two archers on its shoulders      — close, climb, or reflect
     *
     * The swing and the slam are chosen by DISTANCE, not at random, so the
     * player picks which one they get by where they stand. That is the whole
     * fight: standing in its face is a parry test, standing back is a jump
     * test, and neither is safe while the shoulders are still shooting.
     *
     * `budget.miniBoss` allows ten seconds. Sixty health against a ten-damage
     * sword is six clean hits, which is what a player who is actually answering
     * it lands in the window — not what a player standing still and mashing
     * does.
     */
    warden: {
      width: 84,
      height: 132,
      maxHp: 60,
      /** Slow. It does not need to catch you; you need to get past it. */
      speed: 0.85,
      /**
       * How far it will step from its post. It is a door, not a hunter — chase
       * it far enough and it goes back to standing on the exit, which is the
       * one thing it actually has to do.
       */
      leash: 320,
      /** The high cut. Long tell, because a parry has to be readable. */
      /**
       * Long. This is the only attack it has now, so the fight is one read
       * repeated, and a read you have a full second to make is a read a player
       * can actually learn rather than one they eventually get lucky on.
       */
      telegraph: s(1.05),
      active: s(0.16),
      recovery: s(0.62),
      reach: 88,
      /** A full bar, for both the swing and the slam. */
      damage: 20,
      /**
       * The slam: shorter tell, wider box, low to the ground, both sides.
       *
       * Shorter because it is not the parry test — it is the jump test, and a
       * jump is a cheaper input than a parry. Both sides because backing off is
       * not supposed to be the universal answer to a boss.
       */
      slamTelegraph: s(0.55),
      slamActive: s(0.2),
      slamRecovery: s(0.75),
      slamReach: 210,
      /** Half the width of the room its walls shut you into. */
      arena: 280,
      /** How close you have to get before they come down. */
      arenaTrigger: 310,
      /** How high off the floor the shockwave reaches. Jumpable, by design. */
      slamHeight: 38,
      /** Beyond this it closes rather than attacking. */
      engage: 260,
      /** Where the riders sit, measured from the warden's own feet. */
      shoulderX: 40,
      shoulderY: 130,
    },

    /**
     * ENVIRONMENT 2, not built yet. The numbers are settled; the AI is not.
     *
     * Recorded here rather than in a note because these were decided in the
     * same breath as the environment-1 rebalance, and a decision that lives in
     * a chat log is a decision that gets made twice.
     *
     * The PHOENIX is structurally an archer — it keeps its distance and throws
     * an aimed fireball. One difference, and it is the interesting one: a
     * fireball can be PARRIED but does not fly back. The parry still saves you,
     * so reading it is still the answer, but it is not a free kill the way a
     * reflected arrow is. That keeps the reflected arrow special.
     */
    /**
     * The Hollow. The bottom of the dungeon, and the only boss left.
     *
     * With the mini-bosses gone it carries what all of them were carrying, so
     * it is deliberately the sum of the two that were removed: the Warden's one
     * readable attack, the Kiln's insistence that position is the fight, and a
     * second half that is not the first half with a shorter bar.
     */
    /**
     * The Revenant. The bottom of the dungeon, and the only thing down there
     * that is not a monster.
     *
     * Somebody who came this far before you. It is built out of the PLAYER's
     * numbers rather than a monster's — the same size, the same walk, the same
     * swing — because the whole idea is that you are fighting your own kit, and
     * a version of you that was thirty per cent bigger would just be a goblin
     * in a costume.
     *
     * Three things make it a boss rather than a duel with a mirror:
     *
     *   health   Ten bars against your five. It does not hit harder, it lasts
     *            longer, and lasting longer is what makes a fight a fight.
     *   fire     Where you have a stun it has a fireball. That is the one
     *            substitution, and it is the reason you cannot simply play the
     *            match-up you already know.
     *   guard    It parries. Not always — half the time — so attacking is a
     *            gamble rather than a wall, and the answer is the one verb it
     *            does not have.
     */
    revenant: {
      /** The player's own frame, exactly. It is a person, not a monster. */
      width: 30,
      height: 82,
      /**
       * Seven and a half bars to your five. Long, not hard.
       *
       * Down a quarter from ten. Ten was a fight you won by not making a
       * mistake for a very long time, and the interesting part of it — reading
       * which of its two attacks is coming, and breaking a guard that catches
       * half of what you throw — was all present in the first thirty seconds.
       * The rest was repetition.
       */
      maxHp: 150,
      /** Your walk exactly. It closes the way you would. */
      speed: 4.3,
      /** Your swing, and it costs what yours costs. */
      damage: 20,
      telegraph: s(0.42),
      active: s(0.14),
      recovery: s(0.42),
      reach: 62,

      /**
       * The fireball, in place of your stun.
       *
       * Slower and bigger than a phoenix's — it is thrown by someone with arms
       * rather than dropped by something with wings — and it is parryable and
       * it DOES come back, exactly like the phoenix's does. The fight teaches
       * nothing new; it asks whether you learned the fire.
       */
      fireTelegraph: s(0.62),
      fireRecovery: s(0.5),
      fireRange: 620,
      /**
       * And how far away it has to be before it bothers.
       *
       * It PREFERS the sword — everything about the way it moves says so — and
       * fire is what it does when you have put real ground between you. Set at
       * two reaches it threw thirteen times and swung none in twenty-five
       * seconds, which is a turret; set here it closes, dives, swings, and
       * throws when you actually run.
       *
       * And it has to sit inside the ARENA, which is what the first attempt at
       * this number missed. The walls are four hundred and thirty out, and the
       * Revenant matches your walking speed exactly — so a threshold at three
       * hundred and forty was ground the player could almost never make, and it
       * threw nothing at all across four separate measurements.
       */
      fireFrom: 190,
      fireSpeed: 6.2,
      /**
       * How often it throws, in ticks between attempts.
       *
       * It used to throw whenever you were in range, which is to say always —
       * so it stood on one spot for the whole fight and never took a step. That
       * is not a duel with somebody carrying your kit, it is a turret. It
       * throws on a beat now and spends the rest of the time closing, which is
       * what YOU would do with a ranged attack and a sword.
       */
      fireEvery: s(2.4),

      /**
       * The chance it parries, per attack, as a fraction.
       *
       * Half. Not a wall and not a formality: two swings in three land at least
       * one, so pressing is viable and mindless pressing is not.
       *
       * Its parry does NOT hurt you. Yours ripostes because a parry has to pay
       * for the risk of a 0.3s window; this one has no window and no risk — it
       * is a coin — so paying it damage as well would be charging you twice for
       * the same coin flip. What it costs you is the swing.
       */
      guardChance: 0.5,
      /** How long the guard holds once it goes up. */
      guardTicks: s(0.34),

      /**
       * It jumps and it slides, and both are answers to the same problem: you
       * are running away.
       *
       * Everything else in the game closes at a walk or does not close at all,
       * so the way to survive any of it is to back off — which against a boss
       * with your own kit ought to be exactly as unavailable as it is when a
       * player does it to you. The slide is how it covers the gap you just
       * made, and the jump is how it gets over the thing you put between you.
       */
      slideSpeed: 9.2,
      slideTicks: s(0.36),
      /**
       * The band it dives across: far enough that walking would take a while,
       * close enough that a dive lands you somewhere useful.
       */
      slideRange: 190,
      slideFrom: 110,
      /** And how long before it will do it again — this is not a dash spam. */
      slideEvery: s(1.8),
      jumpImpulse: 12.4,
      /** It jumps if you are this far above it. */
      jumpOver: 70,

      /** Below this it stops waiting between attacks. */
      enrageAt: 0.45,
      gold: 12,
      arena: 430,
      arenaTrigger: 470,
    },

    hollow: {
      /**
       * Bulky, and the numbers are most of what makes it so.
       *
       * A hundred and ten by a hundred and fifty was a large goblin. This is
       * two hundred and ten wide and two hundred and seventy tall — nearly five
       * times the player's area — and it moves at a third of a walk. Bulk in a
       * 2D fight is not decoration: it decides how much of the room is unsafe,
       * how far a sweep reaches, and whether backing off is a plan or a wish.
       */
      width: 210,
      height: 270,
      /** Twenty clean swings, or twelve with the legendary blade. */
      maxHp: 200,
      /** A third of a walk. You are never running away from it, only around it. */
      speed: 1.4,
      damage: 20,

      /** Close: a sweep. Parry it. */
      telegraph: s(1.0),
      active: s(0.18),
      recovery: s(0.6),
      reach: 168,

      /** Far: a wave along the floor. Jump it; the parry is no use. */
      waveTelegraph: s(0.85),
      waveRecovery: s(0.8),
      waveRange: 620,
      waveSpeed: 6.4,
      waveHeight: 46,
      waveLife: s(2.2),

      /**
       * The third verb, and the one that makes it a shadow rather than a big
       * goblin: it goes flat, travels along the floor as a patch of dark, and
       * rises somewhere else.
       *
       * Every part of it is readable. The sink is slow enough to see. The patch
       * is drawn on the floor and moves at a speed you can outwalk. Where it
       * stops is where it rises, so the answer is always "be somewhere else",
       * and being somewhere else is a thing the room is big enough to allow.
       *
       * And it is how you WIN: it comes up slowly, and for that second and a
       * half it cannot act. That window is the fight's only free damage, and it
       * is earned by having read the patch rather than by out-trading a boss.
       */
      sinkTicks: s(0.7),
      /** How long it travels under the floor. */
      slideTicks: s(1.1),
      /** How fast the patch crosses the ground. Outwalkable, deliberately. */
      slideSpeed: 5.2,
      /** Coming up. Helpless for all of it. */
      riseTicks: s(1.5),
      /** How often it reaches for the sink, in ticks between attempts. */
      sinkEvery: s(6),

      /** Below this it stops choosing and alternates. */
      enrageAt: 0.5,
      gold: 8,
      /**
       * The chamber is nine hundred wide and the fight owns all of it. The
       * arena walls are the room's own walls now rather than a box drawn around
       * a boss standing in a corridor.
       */
      arena: 430,
      arenaTrigger: 470,
    },

    /**
     * The shark. Environment 3, and the only thing in the game that is faster
     * than the player in its own element.
     *
     * It cannot leave the water and it does not try. What makes it frightening
     * is that it circles: it runs past, turns, and comes again, so the answer
     * is to be out of the water rather than to win a fight in it.
     */
    shark: {
      width: 96,
      height: 44,
      maxHp: 30,
      /** Faster than a swimming player, slower than a running one. */
      speed: 4.3,
      /** How far out it will chase before turning back. */
      leash: 520,
      telegraph: s(0.55),
      recovery: s(0.9),
      reach: 74,
      damage: 20,
    },

    /**
     * The crab. Environment 3's land half.
     *
     * Something has to hold the beach, or the environment is "avoid the water"
     * and nothing else. Slow, armoured from the front, and answered by getting
     * behind it — which is what the slide is for.
     */
    crab: {
      width: 56,
      height: 46,
      maxHp: 20,
      speed: 0.9,
      telegraph: s(0.85),
      active: s(0.2),
      recovery: s(0.6),
      reach: 60,
      damage: 10,
    },

    /**
     * The lizard. Environment 5.
     *
     * An ordinary melee enemy whose bite leaves poison on you. The damage is
     * small; the point is the three seconds afterwards.
     */
    lizard: {
      width: 60,
      height: 52,
      maxHp: 20,
      speed: 1.3,
      telegraph: s(0.7),
      active: s(0.18),
      recovery: s(0.5),
      reach: 62,
      damage: 10,
    },

    /**
     * The bee. Environment 5, and the sharpest thing in the game.
     *
     * Two bars if it lands, which is more than anything else does — and it dies
     * to a block, to a hit, or to landing the sting. So it is a question with
     * exactly one good answer and a very expensive wrong one, and it only ever
     * gets asked once per bee.
     */
    bee: {
      width: 34,
      height: 30,
      maxHp: 1,
      /** Fast, and in a straight line once committed. */
      speed: 5.6,
      /** It hovers, picks a line, and dives along it. */
      telegraph: s(0.75),
      /** How high above the ground it waits. */
      hover: 120,
      bob: 16,
      bobPeriod: 92,
      range: 420,
      /** Two bars. Blocked, it dies instead. */
      damage: 40,
    },

    /**
     * The Kiln. Environment 2's mini-boss, and the exit it stands on.
     *
     * The Warden is a fight you have with your hands: two attacks, opposite
     * answers, and the right place to stand is directly in front of it. This
     * one is a fight you have with your feet, and it is built out of the fire's
     * own rules rather than out of bigger numbers.
     *
     * The heat is the whole design. Standing inside `auraRadius` sets you
     * alight on a timer whatever it is doing, so the front of it is not a place
     * you can live — every exchange is an approach, a swing and a withdrawal.
     * That makes the Cinder scale and the Quench draught matter more here than
     * anywhere else in the game, which is the correct place for the two items
     * the environment sells to finally pay off.
     *
     * Then the two attacks, in the Warden's tradition of opposite answers:
     *
     *   close  a burning rake     — parry it
     *   back   the floor erupts   — jump it; the parry is no use at all
     *
     * And one thing the Warden does not have: it changes at half health. The
     * aura widens and the eruption grows a column, so the second half of the
     * fight is not the first half with a shorter bar.
     */
    kiln: {
      width: 96,
      height: 140,
      /** Eight clean swings at base damage, against the Warden's six. */
      maxHp: 80,
      speed: 0.7,
      leash: 340,
      /** How close it lets you get before it stops shuffling forward. */
      engage: 300,
      /** A full bar, like the Warden. Everything it does also sets you alight. */
      damage: 20,

      /** The rake: close, parryable, the answer the player already knows. */
      telegraph: s(0.95),
      active: s(0.18),
      recovery: s(0.55),
      reach: 104,

      /** The eruption: ranged, unparryable, answered by being in the air. */
      eruptTelegraph: s(0.8),
      eruptRecovery: s(0.85),
      eruptRange: 460,
      /** Columns marching away from it, and how far apart they land. */
      eruptColumns: 3,
      eruptSpacing: 104,
      /** Ticks between one column going up and the next. */
      eruptStagger: 9,
      /** Cracks glow for this long before a column comes up. */
      eruptTell: s(0.42),
      eruptLive: s(0.3),
      eruptHeight: 132,
      eruptWidth: 34,

      /** The heat. Being this close catches you alight every `auraInterval`. */
      auraRadius: 124,
      auraInterval: s(1.35),

      /** Below this share of its health it opens up. */
      enrageAt: 0.5,
      enrageAura: 1.35,
      enrageColumns: 1,

      /** What it is worth. The Warden pays two. */
      gold: 4,

      /** Half the width of the room its walls shut you into. */
      arena: 300,
      /** How close you have to get before they come down. */
      arenaTrigger: 330,
    },
    /**
     * The phoenix. Environment 2's archer, and the reason a parry is worth
     * less in the fire than it was in the rock.
     *
     * It hovers rather than stands, which is the whole of its difference in
     * position terms: there is no ledge to knock it off and no ground to chase
     * it onto, so the answer is either to close the distance or to leave.
     */
    phoenix: {
      width: 40,
      height: 88,
      maxHp: 20,
      /** A full bar, like an arrow. */
      damage: 20,
      /** Parryable — but the fireball dissipates rather than returning. */
      reflectable: false,
      /** Drifts rather than walks. Slower than a player, so it can be left. */
      speed: 1.0,
      /**
       * How high above the ground under it the phoenix rides, and the bob it
       * rides with. The bob is a `wave`, not a sine — this is the simulation,
       * and the transcendentals are banned here for the usual reason.
       */
      hover: 148,
      bob: 20,
      bobPeriod: 168,
      /** Long enough to walk out of the line of, which is the answer to it. */
      telegraph: s(0.9),
      recovery: s(0.75),
      range: 460,
      /** Backs off inside this, like the archer. It is not a brawler. */
      keepAway: 200,
      verticalReach: 320,
      ballSpeed: 5.8,
      ballLife: s(3.2),
    },
    /**
     * The FLAMETHROWER. The first enemy in the game that deals CONTINUOUS
     * damage rather than discrete hits, which is what makes it a different
     * fight: there is no single moment to read, only a window to be somewhere
     * else in.
     *
     * Two seconds of fire, then one second it cannot attack at all. That gap is
     * the whole encounter — it is the goblin's recovery, stretched out and made
     * the point.
     */
    /**
     * The flamethrower. Environment 2's pressure.
     *
     * The goblin asks you to read one swing. This asks you to read a WINDOW: it
     * burns for two seconds and then cannot do anything at all for one, so the
     * fight is about being somewhere else for the two and somewhere useful for
     * the one. Damage lands on an interval rather than on a frame, so standing
     * in the jet costs by the moment rather than by the hit.
     */
    flamethrower: {
      width: 38,
      height: 86,
      maxHp: 20,
      /** Closes on you rather than keeping range. */
      speed: 1.4,
      /** How long the beam stays on, and the gap after it. */
      burnTicks: s(2),
      cooldownTicks: s(1),
      /** Reach of the jet, and how high off the ground it covers. */
      reach: 150,
      jetHeight: 60,
      /** The wind-up before the jet lights. Short — this one wants to crowd. */
      telegraph: s(0.35),
      /** Stops closing once it is near enough to burn. */
      engage: 320,
      /**
       * Half a bar per bite, on the same interval as the spikes. Standing in
       * the beam for its full two seconds is lethal; clipping the edge of it is
       * a mistake you can walk away from.
       */
      damage: 10,
      damageInterval: 20,
    },

    archer: {
      width: 32,
      height: 84,
      /**
       * One sword hit exactly, where a goblin's twenty takes two — so closing
       * the distance IS the answer to an archer, and the moment you reach one
       * the exchange is already over.
       *
       * It has to be that way round: an archer that took two hits would punish
       * you for doing the one thing its whole design asks of you.
       */
      maxHp: 10,
      /** Backs away rather than closing. Slower than the player can walk. */
      speed: 0.9,
      /** How far out it will shoot from. */
      range: 620,
      /** And how close before it retreats instead of drawing. */
      keepAway: 300,
      /**
       * How far above or below the player it will still shoot at.
       *
       * Generous, because arrows are AIMED: an archer on a ledge shooting down
       * at the floor is the whole reason the raised ground is dangerous. The
       * first version gated this at the archer's own height, which meant the
       * one position that made the enemy interesting was also the one position
       * from which it refused to fire.
       */
      verticalReach: 260,
      /** The draw. Long, and the whole point — the tell has to cross a room. */
      telegraph: s(0.95),
      /** Recovery after loosing, whether or not it connected. */
      recovery: s(0.9),
      /** Arrow speed and how long one lives before falling out of the world. */
      arrowSpeed: 7.4,
      arrowLife: s(3),
      /** Reflected arrows fly back faster. The punish should feel like one. */
      arrowReturnSpeed: 11,
      /**
       * A full bar — twice a goblin's swing.
       *
       * The archer is the ranged threat and the goblin is the cheap one, so the
       * archer has to be the one that actually costs something. Five arrows and
       * the run is over.
       */
      damage: 20,
      /**
       * And what a reflected one does to whatever it hits.
       *
       * Comfortably over an archer's ten and over a goblin's twenty: a parried
       * arrow kills whatever it comes back to. That is the payoff the parry is
       * for, and scaling it down with everything else would have quietly turned
       * the game's best moment into a scratch.
       */
      riposte: 24,
    },

    goblin: {
      // Hurtbox. Bigger than the player's 30x82 — it should loom, not scale
      // down. The 48x96 sprite still overhangs: ears and cleaver are not
      // hittable, the body is.
      width: 34,
      height: 86,
      /** Two sword hits. The unit the whole environment is counted in. */
      maxHp: 20,
      speed: 1.15,
      /**
       * Half a bar. The only thing in the game that does a half — everything
       * else is a whole one — and that is what makes a goblin the cheap threat:
       * ten of them to kill you, so being surrounded is dangerous and being hit
       * once is not.
       */
      damage: 10,
      /** How close before it commits to a swing. */
      attackRange: 46,
      /** Wind-up. This is the window the player is reading (FR-18.5 in spirit). */
      telegraph: s(0.45),
      /** Hitbox live time. */
      active: s(0.1),
      /** Recovery after the swing, whether or not it connected. */
      recovery: s(0.5),
      /** Reach of its swing. Exactly one health bar (see `healthBars`). */
      reach: 40,
      /**
       * Jumping. PRD FR-7.1 makes an enemy a subset of the player's verbs, and
       * this is the verb that stops a ledge being immunity — a goblin without
       * it stands under the player swinging at air.
       *
       * Weaker than the player's 14.2, so height is still an ADVANTAGE: a
       * goblin can follow you up one step, not chase you up a tower.
       */
      jumpImpulse: 13.2,
      /** How far above it the player must be before it bothers. */
      jumpTrigger: 34,
      /** And how close, horizontally. It will not leap across a room. */
      jumpReach: 240,
      /**
       * How much faster it steers while airborne.
       *
       * At its walking 1.15 a tick a goblin covered 47 units over a whole jump,
       * so it would leave the ground, travel almost nowhere, and land back where
       * it started — which is what "they jump but just stand there" looks like.
       * A leap has to actually go somewhere.
       */
      airControl: 3.4,
    },
  },

  /** What a parry does back. PRD FR-5.8. */
  parry: {
    /** Damage reflected into a melee attacker. */
    riposteDamage: 5,
    /** How long the attacker is staggered after being parried. */
    staggerTicks: s(0.6),
  },

  /**
   * PRD "Loot and the Extraction Decision" — what a run is actually for.
   *
   * The air timer has no opposing force without this. Every number here exists
   * to make one question hard: go one more room, or leave with what you have.
   */
  loot: {
    /** Gem grades. One nominal band per environment (Loot sources). */
    grades: 5,
    /**
     * What each grade is called and what colour it reads as. Grade 1 is the
     * emerald — the only one the game currently hands out, and the one the
     * pickup readout shows.
     */
    gemNames: ["emerald", "sapphire", "amethyst", "topaz", "diamond"],
    /**
     * What each grade LOOKS like, matching `prop-loot.png` frame for frame.
     *
     * Here rather than in the renderer because the shop needs it too, and a
     * player must never be shown a green stone in one place and a blue one in
     * another for the same grade. "Grade 3" is a number in the code; on screen
     * it is only ever a violet marquise called an amethyst.
     */
    gemColours: [0x3fe08a, 0x5f9bf0, 0xb37aea, 0xffb25c, 0xe2f4ff],
    /**
     * Chests in environment 0, and how many more each environment deeper adds.
     * Density rises with distance — one of the three things depth actually buys.
     */
    chestBase: 4,
    chestPerEnvironment: 2,
    /**
     * What a chest is worth, as four outcomes with fixed odds.
     *
     * The same table in every environment. What changes with depth is the GRADE
     * of the stone, not the chance of a good roll — environment 3 pays
     * amethysts where environment 1 pays emeralds — so depth is still what
     * pays, and it pays in a currency the shallow ground cannot supply at all.
     * That is a cleaner statement of FR-10 than the old distance-weighted band
     * roll, which spread five grades over every chest everywhere and made the
     * grade you got mostly noise.
     *
     * The four must sum to 1. `checkLootTable` asserts it.
     */
    chestOdds: {
      /** Nothing much. Still worth opening — a chest never pays zero. */
      trash: 0.15,
      normal: 0.5,
      /** A good one. */
      better: 0.3,
      /** Gold rather than gems, and the only outcome that pays in it. */
      legendary: 0.05,
    },
    /** Gems, by outcome. Inclusive ranges. */
    chestGems: {
      trash: [1, 2],
      normal: [3, 5],
      better: [5, 8],
    },
    /** What a legendary pays instead of stones. */
    legendaryGold: 5,
    /**
     * A chest that cost a climb, a jump across a pit, or finding a ladder at
     * all comes out ONE TIER BETTER than it rolled: trash becomes normal,
     * normal becomes better.
     *
     * Better does NOT become legendary, and that is the whole rule. Terrain
     * pays skill, and skill is allowed to buy a reliably good chest — it is not
     * allowed to buy the jackpot, or every legendary in the game would come
     * from the same handful of alcoves and the 5% would be a fiction.
     *
     * Legendary is reachable only by rolling it, from any chest, anywhere.
     */
    hiddenPromotesOneTier: true,
    /**
     * What a monster is worth: a 30% chance of one stone of the environment's
     * grade. Rolled when the dungeon is laid out, not when the thing dies —
     * the reducer has no randomness of its own (ARCH AD-1), and a server
     * replaying the seed has to know what every kill was worth before the
     * client claims it.
     */
    killDropChance: 0.3,
    killDropGems: 1,
    /** And what the mini-boss pays, which is not a roll. */
    bossGold: 2,
  },

  /** How long the timed potions last. */
  potions: {
    hasteTicks: s(8),
    venomTicks: s(10),
    /**
     * Milk. Thirty seconds proof against both fire and poison.
     *
     * The same thirty the fireproofing draught had, kept deliberately: the
     * number was tuned against how long a stretch of the fire takes to cross,
     * and covering poison as well does not make that stretch shorter.
     */
    milkTicks: s(30),
    /**
     * The shield. Seven seconds where nothing at all gets through.
     *
     * Short, and it has to be. Everything else on the potion shelf softens
     * something; this one switches the game off, and the only thing keeping
     * that honest is that seven seconds is barely one fight. Long enough to
     * walk through a curtain of lava, cross a room of archers, or survive the
     * mistake that was about to end the run — not long enough to do two of
     * those.
     */
    shieldTicks: s(7),
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
