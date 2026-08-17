/**
 * Simulation state.
 *
 * ARCH AD-1: the core is a pure reducer, so this is the whole world. If it
 * isn't in here, the sim doesn't know about it — no hidden module-level
 * variables, no reaching out to a clock or a store.
 */

import type { Intents } from "./intents.ts";
import type { Loadout } from "../config/shop.ts";

/** What the player's body is doing. Drives which rules apply this tick. */
export type PlayerStance =
  | "grounded"
  | "airborne"
  | "crouching"
  | "sliding"
  | "backstepping"
  | "climbing"
  /** Airborne, pressed into a wall, and sliding down it slowly. */
  | "clinging"
  /**
   * In water, off the bottom, under your own power.
   *
   * Its own stance rather than a flag on `airborne`, because it is the one
   * state where the body is not upright — everything that draws the player has
   * to know, and a boolean somewhere else is a thing each of them can forget.
   * Wading counts as walking: your feet are on the bed and your head is out.
   */
  | "swimming";

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
  /**
   * Ticks until another SLIDE is allowed. The backstep ignores it — same
   * button, different move.
   */
  dashCooldown: number;
  /**
   * How far along the chute the player is, 0..1, or null when not riding it.
   *
   * A ride is a state the player is IN rather than a thing done to them: they
   * have no control until it ends, which is what makes a chute different from
   * the doors and is why it cannot be modelled as a teleport.
   */
  riding: number | null;
  /**
   * Which hole the ride belongs to, or null.
   *
   * Two shortcuts are rides — the rock's chute and the poison's burrow — and
   * they run the same code. Without this the reducer looked up the chute's
   * coordinates whichever one you had gone down, so entering the burrow rode
   * you along a stretch of the rock thirty thousand units away.
   */
  ridingWhich: "chute" | "burrow" | null;
  /**
   * The wall within reach, as the side it is on: 1 for a wall to the right,
   * -1 to the left, 0 for open air. Held for `wallCoyote` ticks after contact
   * is lost, which is what makes the jump forgiving.
   */
  wallDir: -1 | 0 | 1;
  /** Ticks a wall jump is still legal for. Refreshed by touching a wall. */
  wallCoyote: number;
  /**
   * Ticks of committed travel away from a wall just kicked off.
   *
   * Steering is suppressed for these. Without it the player's held direction —
   * which is INTO the wall, because that is what the grab requires — cancels
   * the push on the very next tick and puts them straight back on the face they
   * just left. The wall jump would go nowhere and read as a stuck jump.
   */
  wallLaunch: number;
  /**
   * Sprinting. Entered only by still holding the slide's direction as the
   * slide ends, so the fast gait is carried momentum rather than a button —
   * and lost the moment the player steers, crouches, or commits to an action.
   */
  running: boolean;
  hp: number;
  action: ActionState;
  /**
   * Enemies already struck by the CURRENT action, by their index in
   * `SimState.enemies`.
   *
   * A swing's hitbox is live for several ticks, and without this the damage
   * loop ran once per tick — so one swing landed six times. Every enemy health
   * number in the game was quietly being divided by six: the Warden's sixty
   * survived exactly one swing of a ten-damage sword, and a goblin's "two
   * hits" was two TICKS of a single swing.
   *
   * Indices rather than ids because enemies have no ids and the array is
   * mapped rather than filtered, so an index is stable for the whole run.
   * Cleared on the first tick of every new action.
   */
  struck: readonly number[];
  /**
   * Ticks of being on fire left, or 0.
   *
   * In the player rather than beside it because it changes the outcome of a
   * run, and everything that does has to travel in `SimState` or a replay
   * cannot reproduce it (ARCH AD-7).
   */
  burning: number;
  /** Ticks of poison left, or 0. The burn's twin — see `tuning.poison`. */
  poisoned: number;
  /**
   * Breath left underwater, in ticks, counting DOWN from `bubbles × bubbleTicks`.
   *
   * In the player for the same reason `burning` is: it changes how a run ends,
   * and anything that does has to travel in `SimState` or a replay cannot
   * reproduce it (ARCH AD-7). The view divides it back into bubbles.
   */
  breath: number;
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
  /** Can follow the player onto a ledge. Without it, height is immunity. */
  jump: boolean;
  /** Shoots rather than swings, and keeps its distance to do it. */
  shoot: boolean;
  /**
   * Drives both fists into the floor. Wide, low, both sides, and NOT
   * parryable — the answer is to be in the air, which is the one answer the
   * parry cannot give.
   */
  slam: boolean;
};

export type EnemyKind =
  | "enemy.goblin"
  | "enemy.archer"
  | "enemy.warden"
  /** Environment 2. Hovers, and throws fire that cannot be sent back. */
  | "enemy.phoenix"
  /** Environment 2. Closes, and burns in bursts it cannot interrupt. */
  | "enemy.flamer"
  /** Environment 2's mini-boss. Stands on the exit and cooks the ground. */
  | "enemy.kiln"
  /** Environment 3. Lives in the water and is faster than you in it. */
  | "enemy.shark"
  /** Environment 3. Holds the beach, and is armoured from the front. */
  | "enemy.crab"
  /** Environment 5. Bites, and the bite leaves poison. */
  | "enemy.lizard"
  /** Environment 5. One dive, two bars, and it dies either way. */
  | "enemy.bee"
  /** The bottom of the dungeon. */
  | "enemy.hollow"
  /**
   * The bottom of the dungeon, and the only thing down there that is not a
   * monster.
   *
   * Somebody who came this far before you and did not come back. It has your
   * verb set almost exactly — it walks, jumps, swings, slides and PARRIES — and
   * the one substitution is the whole fight: where you have a stun, it has a
   * fireball.
   *
   * That makes it the only enemy in the game whose tells you already know,
   * because you have been performing them since the first goblin. What you have
   * to learn is not a new animation, it is what it feels like to be on the
   * other side of your own kit.
   */
  | "enemy.revenant";

export type Enemy = {
  /** Content slug — the join key everywhere (ARCH conventions). */
  kind: EnemyKind;
  x: number;
  y: number;
  /** Vertical speed. Enemies fall and jump on the same terrain the player does. */
  vy: number;
  /**
   * Horizontal speed, for the things that commit to a line.
   *
   * Almost everything walks by writing `x` directly and has no use for this.
   * The bee does: it locks a heading at the moment it dives and must not steer
   * afterwards, so the heading has to be somewhere it can be remembered.
   */
  vx: number;
  facing: 1 | -1;
  hp: number;
  phase: EnemyPhase;
  /** Ticks elapsed in the current phase. */
  phaseTicks: number;
  verbs: EnemyVerbs;
  /** Set for one tick when this enemy's swing is parried, so the view can flash. */
  parriedThisTick: boolean;
  /**
   * Which of the Warden's shoulders this enemy is strapped to, or null for
   * anything standing on its own feet.
   *
   * A rider keeps the archer's whole mind — it draws, it looses, it can be shot
   * with its own reflected arrow — and gives up only its legs: its position is
   * written from its host every tick. That is why it is a field on the ordinary
   * enemy rather than a new kind. It IS an archer; it is just somewhere it
   * could not have walked to.
   */
  shoulder: -1 | 1 | null;
  /**
   * Which attack is committed, for anything with more than one.
   *
   * The Warden's two are answered in opposite ways — parry the swing, jump the
   * slam — so the phase alone is not enough to know what is about to happen.
   * The renderer reads this to draw the right tell, and the tell is the fight.
   */
  /**
   * "sink" is the Hollow's third verb and the only one that is not an attack:
   * it goes flat, travels under the floor and comes up somewhere else. The
   * phase machine carries it the same way it carries the other two — telegraph
   * is the sinking, strike is the travelling, recover is the rise — so nothing
   * else in the reducer had to learn a new shape.
   */
  attackKind: "swing" | "slam" | "sink" | "fireball";
  /**
   * Ticks the revenant is committed to its current guard, or 0.
   *
   * Its own field because a block is not an attack and does not fit the attack
   * phases: it goes up in response to something the PLAYER did, holds, and then
   * has to come down whether or not anything hit it.
   */
  guardTicks?: number;
  /**
   * What this one drops when it dies: gems of the environment's grade, and
   * gold.
   *
   * Rolled when the dungeon is laid out, exactly like a chest's contents and
   * for exactly the same two reasons. The reducer has no randomness of its own
   * (ARCH AD-1), so a coin flip at the moment of death would have nowhere to
   * come from — and a server regenerating the run from its seed has to know
   * what every kill in it was worth before the client claims anything.
   */
  drop: { gems: number; gold: number };
};

/**
 * An arrow in flight.
 *
 * Owned by whoever it will hurt next rather than by whoever fired it: a parried
 * arrow does not change direction so much as change SIDES, and modelling it
 * that way means the reflection is one field rather than a special case
 * threaded through the collision (PRD FR-5.8 — a parry damages the attacker).
 */
/**
 * What a projectile IS, which decides what a parry does to it.
 *
 * An arrow is a thing with a point on it: parry it and it goes back the way it
 * came, and FR-5.7 makes that the whole reward for learning the timing. A
 * fireball is not a thing, it is a lump of burning air — parrying it puts the
 * blade between you and it and it comes apart. Both are stopped by the same
 * input; only one of them becomes yours.
 */
export type ProjectileKind = "arrow" | "fireball";

/**
 * One column of the Kiln's eruption.
 *
 * `ticks` counts up and starts NEGATIVE for every column after the first, which
 * is how the row marches outward from the boss rather than arriving all at
 * once: a column does nothing until its own clock reaches zero, then cracks,
 * then comes up.
 */
export type Eruption = {
  x: number;
  ticks: number;
};

export type Arrow = {
  id: number;
  x: number;
  y: number;
  vx: number;
  kind: ProjectileKind;
  /** Aimed, so an arrow from a ledge comes DOWN at you rather than over you. */
  vy: number;
  /** True once parried: it hunts enemies now, and no longer the player. */
  returned: boolean;
  /** Ticks left before it falls out of the world. */
  life: number;
};

/**
 * What one chest holds, rolled when the dungeon is laid out rather than when
 * the lid comes up.
 *
 * Two reasons, and both are load-bearing. The reducer has no randomness of its
 * own (ARCH AD-1), so a roll at open time would have nowhere to come from. And
 * a server regenerating the run from its seed knows what every chest in it held
 * before the client claims anything — which is what makes the whole economy
 * server-authoritative rather than merely server-recorded (FR-15).
 */
/** The four things a chest can roll, worst to best. */
export type LootTier = "trash" | "normal" | "better" | "legendary";

export type ChestLoot = {
  /**
   * Which of the four it came out as, AFTER any promotion for being hard to
   * reach.
   *
   * Stored rather than inferred from the gem count, because the counts overlap:
   * normal pays 3-5 and better pays 5-8, so a five-gem chest could be either
   * and nothing downstream could tell them apart. Keeping the tier means the
   * outcome stays legible — to the UI, to a test, and to a server checking what
   * a client claims it found.
   */
  tier: LootTier;
  /** Gem grade, 1-based. Set by the environment (FR-10). */
  grade: number;
  gems: number;
  gold: number;
  legendary: boolean;
};

export type Chest = {
  /** Content slug — the join key everywhere (ARCH conventions). */
  id: string;
  x: number;
  /** The surface it stands on. Not always the floor — some are up a climb. */
  y: number;
  loot: ChestLoot;
  opened: boolean;
  /**
   * Sealed until something else happens. Only the Warden's chest uses it: the
   * boss is the lock, and the chest is what the lock is on.
   *
   * A flag rather than spawning the chest on death, because contents are rolled
   * from the run seed when the dungeon is laid out (see `ChestLoot`) — a chest
   * that appeared mid-run would have nothing to roll from, and a server
   * replaying the seed could not know what was in it.
   */
  locked: boolean;
  /**
   * Which boss holds the key, for a chest that starts locked.
   *
   * There are two bosses now and one lock would be the wrong shape: killing the
   * Warden at the end of the rock used to open every sealed chest in the world,
   * including the one behind a boss two environments further in that the player
   * had not met yet.
   */
  lockedBy?: EnemyKind;
};

/**
 * What the run is carrying.
 *
 * Wagered, not banked. Walking out through the mouth keeps all of it (FR-4.2);
 * dying or running out of air loses all of it (FR-21.1). That asymmetry is the
 * extraction decision, and it is the only thing the air timer is arguing with.
 */
export type Carried = {
  /** Gems held, indexed by grade - 1. */
  gems: readonly number[];
  gold: number;
  /** Legendary rolls this run. Counted apart because it is the run's story. */
  legendaries: number;
};

/**
 * A trap's cycle. PRD FR-18.5 — it shows its tell, then it fires.
 *
 * Deliberately the same shape as an enemy's phases, because it is the same
 * thing: a wind-up the player is reading, and an answer that has to be given
 * before it lands. A trap that skipped `telegraphing` would be a tax on the
 * air, not a thing to play around.
 */
export type TrapPhase = "idle" | "telegraphing" | "firing" | "resetting";

export type TrapState = {
  /** Content slug — the join key back to the fixed layout. */
  id: string;
  phase: TrapPhase;
  /** Ticks elapsed in the current phase. */
  ticks: number;
};

/** How a run ended. PRD fail states — death and transformation differ in kind. */
export type RunOutcome = "running" | "died" | "transformed" | "extracted";

/**
 * Which lesson the tutorial is on.
 *
 * Ordered, and each one names the verb its station is built around. `done` is
 * the end: the hall is finished and the way home is open.
 */
export type TutorialStep =
  | "walk"
  | "jump"
  | "slide"
  | "back"
  | "wall"
  | "fight"
  | "stun"
  | "smash"
  | "parry"
  | "dive"
  | "loot"
  | "shop"
  | "leave"
  | "done";

/**
 * The tutorial's progress, IN the simulation state.
 *
 * Not beside it, and not in React, for the same reason `god` is in here: the
 * reducer decides when a lesson is passed, and a step counter living anywhere
 * else would make the reducer a liar. It also means the whole tutorial is
 * replayable and testable by exactly the machinery every other rule uses — a
 * bot can be handed intents and the assertion is simply which step it reached.
 */
export type Tutorial = {
  step: TutorialStep;
  /** Ticks spent on this step. Prompts that nag only appear after a while. */
  ticks: number;
  /** Set for one tick when a lesson is passed, so the view can react. */
  justPassed: boolean;
};

export type SimState = {
  /** Ticks elapsed since the run began. The sim's only notion of time. */
  tick: number;
  /**
   * The tick the Revenant fell, or null if it is still standing.
   *
   * Stamped rather than derived, because "when" cannot be recovered afterwards:
   * a dead enemy carries no time of death, and by the end of the run the only
   * thing the state remembers is that it is dead. The speed board is the
   * difference between this and `enteredTick`, so if it is not written down at
   * the moment it happens the score does not exist.
   */
  felledTick: number | null;
  /**
   * The tutorial's progress, or null on a real run.
   *
   * Null rather than a `tutorial: false` flag plus a step, because "which
   * lesson am I on" is meaningless outside the hall and a nullable field says
   * so at the type level.
   */
  tutorial: Tutorial | null;
  /** Air remaining, in ticks. PRD FR-17 — this is the run timer. */
  air: number;
  /** Air the run started with, for HUD proportions. */
  airCapacity: number;
  player: Player;
  enemies: readonly Enemy[];
  /** Where the loot is this run. Reshuffled with the seed (FR-18.2). */
  chests: readonly Chest[];
  /** Every trap's state. The geometry is fixed; only this moves. */
  traps: readonly TrapState[];
  /**
   * Columns of lava the Kiln has driven up out of the floor.
   *
   * In the state rather than derived from the boss's phase because they outlive
   * the swing that made them: the boss is already recovering while the third
   * column is still coming up, and a player who reads only the boss is reading
   * the wrong thing.
   */
  eruptions: readonly Eruption[];
  /**
   * Whether the player is currently shut in with a boss.
   *
   * Carried rather than recomputed because the walls latch: they come down when
   * you approach and stay down while you are in the room, so "am I inside one"
   * depends on whether you were inside one a tick ago.
   */
  inArena: boolean;
  /** Arrows in flight, from either side. */
  arrows: readonly Arrow[];
  /** Next arrow id. Counted rather than random, so a replay matches. */
  nextArrowId: number;
  /** What has been picked up and not yet banked. */
  carried: Carried;
  /**
   * Developer mode: the run cannot end badly.
   *
   * IN the state, not beside it, and that is deliberate. Death is decided by
   * the reducer, so a flag that changed the outcome from outside would make the
   * reducer a liar — the same inputs and seed would produce different runs
   * depending on something the state never recorded, and every replay guarantee
   * in ARCH AD-1 would quietly stop holding.
   *
   * Recorded here instead, so a god-mode run is still perfectly deterministic
   * and is also self-identifying. When the server lands (FR-15), this is the
   * field it checks before crediting anything: a run with it set is a test, and
   * a test must never be bankable.
   */
  god: boolean;
  /**
   * What the player brought down with them: items owned, and the potions still
   * unspent.
   *
   * In the state for the same reason `god` is. Stats derived outside the
   * reducer would mean the same seed and the same inputs produced different
   * fights depending on something the run never recorded.
   */
  loadout: Loadout;
  /**
   * Potions carried into this run and not yet used. Consumed by id, so a
   * player who spent their Restoration cannot drink a second one.
   */
  potions: readonly string[];
  /**
   * Timed effects, in ticks remaining.
   *
   * In the state rather than in a closure because they outlive the tick that
   * started them, and a replay has to reproduce exactly when they ran out.
   */
  buffs: {
    haste: number;
    venom: number;
    /**
     * Ticks of milk left. Neither fire nor poison can take hold while it runs.
     *
     * It replaced a fireproofing draught that did half of this. Two consumables
     * for two status effects with identical arithmetic was two things to buy,
     * two buttons to remember and one decision — which one is this environment
     * going to be? — that the player already knew the answer to before they
     * walked in.
     */
    milk: number;
    /**
     * Ticks of shield left. NOTHING gets through while it runs.
     *
     * Not a reduction. A shield that let a little through would be a percentage
     * with a dramatic name, and the whole value of this one is that it makes a
     * seven-second window where the answer to every question is "walk through
     * it" — which is worth a great deal exactly once per run.
     */
    shield: number;
  };
  /**
   * False until the player crosses the cave mouth. Outside, air does not drain
   * and nothing moves — the clock is the dungeon's, not the game's.
   */
  entered: boolean;
  /**
   * The tick the mouth was crossed on, or null while still outside.
   *
   * Kept in the sim rather than the view because the crossing has a length —
   * the daylight takes a moment to close up behind you — and the renderer is
   * not allowed a clock of its own (ARCH AD-5). Derived from state, so a
   * replay draws that half-second exactly as it was played.
   */
  enteredTick: number | null;
  /**
   * The tick the run ended on, or null while it is still going.
   *
   * Here for the same reason `enteredTick` is: dying has a LENGTH, and the
   * renderer is not allowed a clock of its own (ARCH AD-5). A replay of a run
   * that ended plays the same collapse it played the first time.
   */
  endedTick: number | null;
  /**
   * Furthest x reached inside. Loot scales with distance (PRD Loot sources),
   * so this is what a run is ultimately worth.
   */
  deepestX: number;
  /**
   * Which of the five environments the player is in, zero-based.
   *
   * ARCH AD-22: progress is reported as `(environment_index, ticks_elapsed)`,
   * and this is that index. It is derived from position rather than stored
   * independently, so it can never disagree with where the player actually is.
   */
  environment: number;
  /**
   * Shortcuts the account has already levered, so they are open from the first
   * tick of this run (PRD FR-3.3). Server-resolved at run start — a client that
   * adds an id here is claiming ground it never walked, which is exactly what
   * FR-3.5 forbids, so the server never reads this back as truth.
   */
  openShortcuts: readonly string[];
  /**
   * Levers flicked during THIS run. The server persists these at run end; until
   * then they are the run's own record of what it earned.
   */
  leversFlicked: readonly string[];
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
  /** A trap fired. Whether it connected is a separate `playerHit`. */
  | { type: "trapFired"; trap: string; x: number; y: number }
  /** An archer loosed. */
  | { type: "arrowLoosed"; x: number; y: number; facing: 1 | -1 }
  /** The floor has been told to open here. */
  | { type: "eruptionCalled"; x: number }
  /** And it has. */
  | { type: "eruptionFired"; x: number }
  /** Went into water. */
  | { type: "splashed"; x: number; y: number }
  /** The Revenant caught a blow. It costs you the swing and nothing else. */
  | { type: "guardHeld"; x: number; y: number }
  /** Thrown up onto the fire's high road. */
  | { type: "liftRode"; x: number; y: number }
  /** The shield went up. Seven seconds of nothing getting through. */
  | { type: "shieldRaised"; x: number; y: number }
  /** And it just ate something. Fired per blow, so the view can flare per hit. */
  | { type: "shieldHeld"; x: number; y: number }
  /** Up an escape shaft, banking the run where you stood. */
  | { type: "escaped"; x: number; y: number }
  /** An arrow buried itself in the rock. */
  | { type: "arrowStruck"; x: number; y: number }
  /** The last bubble is gone and the water is taking it out of you. */
  | { type: "drowning"; x: number; y: number }
  /** Through the door at the end of the fire, into the boss chamber. */
  | { type: "chamberEntered"; x: number; y: number }
  /** And back out of it. */
  | { type: "chamberLeft"; x: number; y: number }
  /** Poisoned. Fired once, on the tick it takes hold. */
  | { type: "poisoned"; x: number; y: number }
  /** Caught fire. Fired once, on the tick it takes hold. */
  | { type: "caughtFire"; x: number; y: number }
  /** A fireball was parried. Stopped, not stolen. */
  /**
   * A fireball sent back the way it came.
   *
   * Its own event rather than reusing `arrowReturned`, because the two do not
   * mean the same thing any more: a returned arrow is a riposte and a returned
   * fireball is the end of a phoenix. The view has to be able to tell them
   * apart to sell the difference.
   */
  | { type: "fireballReturned"; x: number; y: number }
  /** A jet of flame is on, and where it reaches. */
  | { type: "flameJet"; x: number; y: number; facing: 1 | -1; length: number }
  /** An arrow was parried and sent back. The best thing that can happen. */
  | { type: "arrowReturned"; x: number; y: number }
  | { type: "enemyHit"; damage: number; x: number; y: number }
  | { type: "enemyDied"; x: number; y: number }
  /** Crossed into a new environment. FR-2.3 — boundaries are legible in play. */
  | { type: "environmentChanged"; from: number; to: number }
  /** A lever was flicked. This shortcut is open from now on, forever (FR-3.3). */
  | { type: "leverFlicked"; shortcut: string; x: number; y: number }
  /** A chest was opened. Carries what was in it, so the view can say so. */
  | {
      type: "chestOpened";
      chest: string;
      x: number;
      y: number;
      grade: number;
      gems: number;
      gold: number;
      legendary: boolean;
    }
  /** Stepped through an open shortcut door. */
  | { type: "shortcutUsed"; shortcut: string; fromX: number; toX: number }
  /** Thrown by a geyser in the chain. */
  | { type: "geyserThrew"; x: number; y: number; vent: number }
  /** Dropped into the chute. */
  | { type: "chuteEntered"; x: number; y: number }
  /** Something died and left something behind. */
  | {
      type: "lootDropped";
      x: number;
      y: number;
      grade: number;
      gems: number;
      gold: number;
    }
  /** And thrown out of the far end of it. */
  | { type: "chuteLaunched"; x: number; y: number }
  /** A trap threw the player clear of it. `x`/`y` is where they were. */
  | { type: "thrownBack"; x: number; y: number }
  /** A potion was spent. `kind` is which. */
  | { type: "potionUsed"; kind: string; x: number; y: number }
  /** Kicked off a wall. `dir` is the way the player was thrown. */
  | { type: "wallJumped"; x: number; y: number; dir: number };
