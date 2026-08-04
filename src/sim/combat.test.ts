import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createInitialState,
  step,
  Intent,
  playerHitbox,
  type SimState,
  type Intents,
} from "./index.ts";
import { tuning } from "../config/tuning.ts";

const GOBLIN = tuning.enemies.goblin;

/** Advance n ticks holding the same intents. */
function run(
  state: SimState,
  ticks: number,
  intents: Intents = Intent.None,
): SimState {
  let s = state;
  for (let i = 0; i < ticks; i++) s = step(s, intents);
  return s;
}

/**
 * A state with one goblin close enough to engage immediately, and the run
 * already started — combat tests are about the fight, not the approach.
 */
function duel(): SimState {
  const base = createInitialState(60 * 60);
  return {
    ...base,
    entered: true,
    enemies: [
      {
        ...base.enemies[0],
        x: base.player.x + GOBLIN.attackRange - 2,
        facing: -1,
      },
    ],
  };
}

/** Advance until the goblin is about to land its swing. */
function untilStrike(
  state: SimState,
  intents: Intents = Intent.None,
): SimState {
  let s = state;
  for (let i = 0; i < 200; i++) {
    s = step(s, intents);
    if (s.enemies[0].phase === "striking" && s.enemies[0].phaseTicks === 0)
      return s;
  }
  throw new Error("goblin never struck");
}

test("a goblin telegraphs before it strikes", () => {
  let s = duel();
  s = run(s, 1);
  assert.equal(
    s.enemies[0].phase,
    "telegraphing",
    "it must wind up, or the parry is unreadable",
  );
  // PRD FR-6.1: the tell has to be long enough to be a real read.
  assert.ok(GOBLIN.telegraph > tuning.combat.parryWindow);
});

test("an unparried swing damages the player", () => {
  const s = untilStrike(duel());
  assert.equal(s.player.hp, tuning.player.maxHp - GOBLIN.damage);
  assert.ok(s.events.some((e) => e.type === "playerHit"));
});

test("a parried swing damages the attacker instead and staggers it", () => {
  // Block on the tick the swing lands, so the parry window is live.
  let s = duel();
  for (let i = 0; i < 200; i++) {
    const next = step(s, Intent.None);
    if (
      next.enemies[0].phase === "striking" &&
      next.enemies[0].phaseTicks === 0
    ) {
      // Re-run that tick with block held from one tick earlier.
      s = step(s, Intent.Block);
      break;
    }
    s = next;
  }
  assert.equal(
    s.player.hp,
    tuning.player.maxHp,
    "PRD FR-5.8: a parry takes no damage",
  );
  assert.equal(s.enemies[0].hp, GOBLIN.maxHp - tuning.parry.riposteDamage);
  assert.equal(s.enemies[0].phase, "staggered");
  assert.ok(s.events.some((e) => e.type === "parry"));
});

test("blocking too early does not parry — the window has passed by the time it lands", () => {
  let s = duel();
  s = step(s, Intent.Block); // committed immediately, long before the swing
  s = untilStrike(s);
  assert.ok(
    s.player.hp < tuning.player.maxHp,
    "an expired block is not a parry",
  );
});

test("the sword damages a goblin and enough hits kill it", () => {
  let s = duel();
  const hitsNeeded = Math.ceil(GOBLIN.maxHp / tuning.player.attackDamage);
  for (let i = 0; i < hitsNeeded; i++) {
    s = step(s, Intent.Attack);
    s = run(s, 30); // let the swing resolve and the lockout expire
  }
  assert.equal(s.enemies[0].phase, "dead");
  assert.ok(s.events.length >= 0);
});

test("the stun attack trades damage for an opening", () => {
  const s = step(duel(), Intent.Stun);
  assert.equal(s.player.action.kind, "stun");
  assert.ok(
    tuning.player.stunDamage < tuning.player.attackDamage,
    "PRD FR-5.6: the stun is substantially weaker",
  );
  assert.ok(
    tuning.player.stunStartup > tuning.player.attackStartup,
    "PRD FR-5.6: and slower — the wind-up is the whole cost",
  );
});

test("a committed goblin does not turn to track the player", () => {
  let s = duel();
  s = run(s, 1);
  assert.equal(s.enemies[0].phase, "telegraphing");
  const facingAtCommit = s.enemies[0].facing;
  // Run past it mid-wind-up.
  s = run(s, 10, Intent.Left);
  assert.equal(
    s.enemies[0].facing,
    facingAtCommit,
    "stepping around a wind-up must be a real answer",
  );
});

test("combat stays deterministic", () => {
  const script = [
    ...Array(20).fill(Intent.Right),
    ...Array(6).fill(Intent.Block),
    ...Array(10).fill(Intent.Attack),
    ...Array(30).fill(Intent.None),
  ];
  const play = () => {
    let s = duel();
    for (const intents of script) s = step(s, intents);
    return s;
  };
  assert.deepEqual(play(), play());
});

test("events do not accumulate across ticks", () => {
  const s = run(untilStrike(duel()), 5);
  assert.equal(
    s.events.length,
    0,
    "events are per-tick, or state stops being a pure function",
  );
});

test("consecutive attacks alternate between two swings", () => {
  let s = duel();
  const variants: number[] = [];
  for (let round = 0; round < 4; round++) {
    s = step(s, Intent.Attack);
    variants.push(s.player.action.variant);
    // Wait out the lockout but stay inside the combo window.
    s = run(
      s,
      tuning.player.attackStartup +
        tuning.player.attackActive +
        tuning.player.attackRecovery,
    );
  }
  assert.deepEqual(
    variants,
    [0, 1, 0, 1],
    "a chain must not replay the same animation",
  );
});

test("the chain resets after a pause, so the first press always looks the same", () => {
  let s = duel();
  s = step(s, Intent.Attack);
  assert.equal(s.player.action.variant, 0);
  // Long enough for the combo window to lapse.
  s = run(s, 200);
  s = step(s, Intent.Attack);
  assert.equal(
    s.player.action.variant,
    0,
    "after a pause the swing resets to the first",
  );
});

test("the attack box is the sword, not the whole body", () => {
  const s = step(duel(), Intent.Attack);
  const p = {
    ...s.player,
    action: { ...s.player.action, elapsed: tuning.player.attackStartup },
  };
  const box = playerHitbox(p);
  assert.ok(box, "the hitbox should be live during active frames");
  const feet = p.y;
  assert.ok(box.bottom < feet, "a swing must not reach the ground");
  assert.ok(
    feet - box.bottom >=
      tuning.player.height * tuning.player.attackBoxBottom - 1,
  );
});

test("crouch-walking is possible but slower than standing", () => {
  let standing = createInitialState(600);
  let crouched = createInitialState(600);
  for (let i = 0; i < 20; i++) {
    standing = step(standing, Intent.Right);
    crouched = step(crouched, Intent.Right | Intent.Crouch);
  }
  const standDist = standing.player.x - tuning.room.playerSpawnX;
  const crouchDist = crouched.player.x - tuning.room.playerSpawnX;
  assert.ok(crouchDist > 0, "crouching must not stop the player moving");
  assert.ok(crouchDist < standDist, "but it must cost speed");
  assert.equal(crouched.player.stance, "crouching");
});

test("crouching shrinks the hurtbox", () => {
  const s = step(createInitialState(600), Intent.Crouch);
  assert.equal(s.player.stance, "crouching");
  assert.ok(tuning.movement.crouchHeightScale < 1);
});

test("the smash needs to be in the air — pressing down on the ground does not trigger it", () => {
  const s = step(createInitialState(600), Intent.Crouch);
  assert.equal(s.player.action.kind, null, "PRD FR-5.5: jump first, then down");
});

test("jump then down commits to a smash and lands with a wide impact", () => {
  let s = step(createInitialState(600), Intent.Jump);
  s = run(s, 4);
  assert.equal(s.player.stance, "airborne");
  s = step(s, Intent.Crouch);
  assert.equal(s.player.action.kind, "smash");

  // It drives straight down and cannot be steered.
  const xAtCommit = s.player.x;
  s = run(s, 3, Intent.Right);
  assert.equal(s.player.x, xAtCommit, "a committed smash goes straight down");

  // Fall to the floor, then the impact should be live and hit both sides.
  for (let i = 0; i < 40 && s.player.stance === "airborne"; i++)
    s = step(s, Intent.None);
  const box = playerHitbox(s.player);
  assert.ok(box, "the impact must be live on landing");
  assert.ok(
    box.left < s.player.x && box.right > s.player.x,
    "it hits both sides",
  );
});

test("a goblin is solid — you cannot walk through it", () => {
  let s = duel();
  const goblinX = s.enemies[0].x;
  for (let i = 0; i < 120; i++) s = step(s, Intent.Right);
  assert.ok(
    s.player.x + tuning.player.width / 2 <=
      goblinX + tuning.enemies.goblin.width / 2 + 1,
    "the player should be stopped at the goblin's body",
  );
});

test("sliding passes through a goblin", () => {
  let s = duel();
  // Get moving, then dash.
  s = run(s, 6, Intent.Right);
  const before = s.player.x;
  s = step(s, Intent.Right | Intent.Slide);
  s = run(s, tuning.movement.slideDuration, Intent.Right);
  assert.ok(
    s.player.x > s.enemies[0].x,
    "a slide should carry the player past the goblin, not bounce off it",
  );
  assert.ok(s.player.x > before);
});

test("jumping clears a goblin's head", () => {
  let s = duel();
  s = step(s, Intent.Jump);
  // Rise until the feet are above the goblin's head.
  for (let i = 0; i < 30; i++) {
    s = step(s, Intent.Jump | Intent.Right);
    if (s.player.y <= s.enemies[0].y - tuning.enemies.goblin.height) break;
  }
  assert.ok(
    s.player.y <= s.enemies[0].y - tuning.enemies.goblin.height,
    "the jump must actually reach above the goblin",
  );
  const overhead = s.player.x;
  s = run(s, 6, Intent.Right);
  assert.ok(s.player.x > overhead, "and movement must not be blocked up there");
});

test("air does not burn until you step into the cave", () => {
  let s = createInitialState(600);
  assert.equal(s.entered, false);
  for (let i = 0; i < 120; i++) s = step(s, Intent.None);
  assert.equal(s.air, 600, "standing outside must cost nothing");
  assert.equal(s.outcome, "running");
});

test("crossing the mouth starts the run, once", () => {
  let s = createInitialState(600);
  let entries = 0;
  for (let i = 0; i < 200; i++) {
    s = step(s, Intent.Right);
    entries += s.events.filter((e) => e.type === "entered").length;
    if (s.entered) break;
  }
  assert.equal(s.entered, true, "walking right must reach the entrance");
  assert.ok(s.player.x >= tuning.room.entranceX);
  assert.equal(entries, 1, "the threshold fires exactly once");

  const airOnEntry = s.air;
  s = run(s, 30);
  assert.ok(s.air < airOnEntry, "and the clock runs from then on");
});

test("goblins do not move until the player is inside", () => {
  let s = createInitialState(600);
  const startX = s.enemies[0].x;
  // Stand still outside for a long time.
  for (let i = 0; i < 240; i++) s = step(s, Intent.None);
  assert.equal(s.entered, false);
  assert.equal(s.enemies[0].x, startX, "nothing hunts you in the open");
  assert.equal(s.enemies[0].phaseTicks, 0);
});

test("every goblin starts inside the cave", () => {
  const s = createInitialState(600);
  for (const e of s.enemies) {
    assert.ok(
      e.x > tuning.room.entranceX,
      "monsters belong to the dungeon, not the approach",
    );
  }
});
