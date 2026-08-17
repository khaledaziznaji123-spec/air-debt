import { test } from "node:test";
import assert from "node:assert/strict";
import { createInitialState, step, replay, Intent } from "./index.ts";
import { createRng, deriveSeed } from "./rng.ts";
import type { InputRecord, Intents } from "./intents.ts";
import { tuning } from "../config/tuning.ts";
import { worldEnd } from "../config/dungeon.ts";
import type { SimState } from "./types.ts";

/**
 * A run already underway: entered, and standing INSIDE. Marking a state
 * entered while it sits at the spawn would extract on the very next tick,
 * because walking back out of the mouth is what ends a run.
 */
function started(airTicks?: number): SimState {
  const base = createInitialState(airTicks);
  return {
    ...base,
    entered: true,
    player: { ...base.player, x: tuning.room.entranceX + 120 },
    deepestX: tuning.room.entranceX + 120,
  };
}

/**
 * These guard ARCH AD-1, AD-4 and AD-7. If any of them fail, replay validation
 * (PRD FR-15.7) is silently broken and the failure mode is confiscating loot
 * from honest players — so they are worth more than their line count.
 */

function scriptedLog(): InputRecord[] {
  return [
    { tick: 0, intents: Intent.Right },
    { tick: 12, intents: Intent.Right | Intent.Jump },
    { tick: 20, intents: Intent.Right },
    { tick: 34, intents: Intent.Attack },
    { tick: 48, intents: Intent.Left },
    { tick: 60, intents: Intent.Left | Intent.Slide },
    { tick: 75, intents: Intent.Block },
    { tick: 90, intents: Intent.None },
  ];
}

test("the same input log always produces the same final state", () => {
  const a = replay(scriptedLog());
  const b = replay(scriptedLog());
  assert.deepEqual(a, b);
});

/** Every tick's position, so a divergence that later washes out is still seen. */
function trajectory(log: InputRecord[]): string {
  const byTick = new Map(log.map((r) => [r.tick, r.intents]));
  let state = createInitialState();
  const points: string[] = [];
  for (let t = 0; t <= log[log.length - 1].tick; t++) {
    state = step(state, byTick.get(t) ?? Intent.None);
    points.push(`${state.player.x},${state.player.y}`);
  }
  return points.join("|");
}

test("a diverging input changes the trajectory", () => {
  // Compared over the whole run rather than at the end: removing a jump alters
  // the path but the player lands back on the floor, so final states can
  // legitimately converge. Replay validation compares runs, not endpoints.
  const base = scriptedLog();
  const altered = base.map((r) =>
    r.tick === 12 ? { ...r, intents: Intent.Right } : r,
  );
  assert.notEqual(
    trajectory(base),
    trajectory(altered),
    "replay must be sensitive to its inputs",
  );
});

test("identical logs produce identical trajectories, not just identical endpoints", () => {
  assert.equal(trajectory(scriptedLog()), trajectory(scriptedLog()));
});

test("step does not mutate the state it is given", () => {
  const before = createInitialState();
  const snapshot = structuredClone(before);
  step(before, Intent.Right | Intent.Jump);
  assert.deepEqual(
    before,
    snapshot,
    "ARCH AD-1: the reducer returns new state, it does not mutate",
  );
});

test("air drains one tick per tick, and reaching zero transforms rather than kills", () => {
  let state = started(5);
  for (let i = 0; i < 5; i++) state = step(state, Intent.None);
  assert.equal(state.air, 0);
  assert.equal(
    state.outcome,
    "transformed",
    "PRD FR-1.3: running out of air is not a death",
  );
});

test("a finished run is a fixed point", () => {
  let state = started(1);
  state = step(state, Intent.None);
  assert.equal(state.outcome, "transformed");
  const after = step(state, Intent.Right | Intent.Jump);
  assert.equal(
    after.player.x,
    state.player.x,
    "a transformed player does not keep moving",
  );
  assert.equal(after.outcome, "transformed");
});

test("the player cannot leave the world", () => {
  // Deliberately NOT entered: walking back out of the mouth would end the run
  // before the left-hand wall was ever reached.
  let state = createInitialState(6000);
  for (let i = 0; i < 2000; i++) state = step(state, Intent.Left);
  assert.ok(state.player.x >= tuning.player.width / 2, "the left wall holds");
  assert.ok(state.player.x <= worldEnd - tuning.player.width / 2);
  // The far wall is fifty thousand units away, so reaching it from here would
  // outlast any tank. It gets its own test in dungeon.test.ts, from close up.
});

test("a mistimed block costs more than the parry window it was aiming for", () => {
  let state = started(600);
  state = step(state, Intent.Block);
  const { parryWindow, mistimePunish } = tuning.combat;
  assert.equal(state.player.action.kind, "block");
  assert.equal(
    state.player.action.lockout,
    parryWindow + mistimePunish,
    "PRD FR-5.9: the commitment spans the window plus the punish",
  );
});

test("slide cancels a committed attack", () => {
  let state = started(600);
  state = step(state, Intent.Attack);
  assert.equal(state.player.action.kind, "attack");
  state = step(state, Intent.Attack | Intent.Slide);
  assert.equal(
    state.player.action.kind,
    null,
    "PRD FR-5.10: slide interrupts the swing",
  );
  assert.ok(state.player.dashTicks > 0);
});

/** Slide, then hold the same direction until the dash runs out. */
function slideInto(state: SimState, dir: Intents): SimState {
  state = step(state, dir | Intent.Slide);
  for (let i = 0; i <= tuning.movement.slideDuration; i++) {
    state = step(state, dir);
  }
  return state;
}

test("holding the direction through a slide carries into a sprint", () => {
  let state = started(600);
  assert.equal(state.player.running, false, "a run never starts from standing");

  state = slideInto(state, Intent.Right);
  assert.equal(state.player.running, true);
  assert.equal(
    Math.abs(state.player.vx),
    tuning.movement.runSpeed,
    "the sprint is faster than the walk it replaces",
  );

  // And it holds for as long as the direction does.
  for (let i = 0; i < 60; i++) state = step(state, Intent.Right);
  assert.equal(state.player.running, true);
});

test("a sprint is lost by letting go, steering, or committing", () => {
  const sprinting = slideInto(started(600), Intent.Right);
  assert.equal(sprinting.player.running, true);

  assert.equal(
    step(sprinting, Intent.None).player.running,
    false,
    "releasing the direction drops back to a walk",
  );
  assert.equal(
    step(sprinting, Intent.Left).player.running,
    false,
    "steering the other way sheds the momentum",
  );
  assert.equal(
    step(sprinting, Intent.Right | Intent.Crouch).player.running,
    false,
    "you cannot sprint while crouched",
  );
  assert.equal(
    step(sprinting, Intent.Right | Intent.Attack).player.running,
    false,
    "committing to a swing breaks stride",
  );
});

test("a backstep never becomes a sprint", () => {
  // Slide with no direction held is the backstep variant — it travels the
  // opposite way to facing, so there is no forward momentum to inherit.
  let state = started(600);
  state = step(state, Intent.Slide);
  assert.equal(state.player.stance, "backstepping");
  for (let i = 0; i <= tuning.movement.backstepDuration; i++) {
    state = step(state, Intent.Right);
  }
  assert.equal(state.player.running, false);
});

test("seeded rng is reproducible and stream-independent", () => {
  const a = createRng(12345);
  const b = createRng(12345);
  const first = Array.from({ length: 50 }, () => a.next());
  const second = Array.from({ length: 50 }, () => b.next());
  assert.deepEqual(first, second);

  // ARCH AD-4: drawing more from one stream must not shift another.
  const chests = createRng(deriveSeed(999, 1));
  const traps = createRng(deriveSeed(999, 2));
  const trapsBefore = Array.from({ length: 10 }, () => traps.next());
  for (let i = 0; i < 500; i++) chests.next();
  const trapsAgain = createRng(deriveSeed(999, 2));
  assert.deepEqual(
    Array.from({ length: 10 }, () => trapsAgain.next()),
    trapsBefore,
    "consuming one stream must not perturb another",
  );
});

test("rng stays in range across a long draw", () => {
  const rng = createRng(7);
  for (let i = 0; i < 10_000; i++) {
    const v = rng.next();
    assert.ok(v >= 0 && v < 1, `out of range: ${v}`);
  }
  for (let i = 0; i < 1_000; i++) {
    const v = rng.int(6);
    assert.ok(Number.isInteger(v) && v >= 0 && v < 6);
  }
});
