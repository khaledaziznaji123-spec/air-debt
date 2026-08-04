import { test } from "node:test";
import assert from "node:assert/strict";
import { createInitialState, step, replay, Intent } from "./index.ts";
import { createRng, deriveSeed } from "./rng.ts";
import type { InputRecord } from "./intents.ts";
import { tuning } from "../config/tuning.ts";

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
  let state = createInitialState(5);
  for (let i = 0; i < 5; i++) state = step(state, Intent.None);
  assert.equal(state.air, 0);
  assert.equal(
    state.outcome,
    "transformed",
    "PRD FR-1.3: running out of air is not a death",
  );
});

test("a finished run is a fixed point", () => {
  let state = createInitialState(1);
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

test("the player cannot leave the room", () => {
  let state = createInitialState(6000);
  for (let i = 0; i < 2000; i++) state = step(state, Intent.Left);
  assert.ok(state.player.x >= tuning.player.width / 2);
  for (let i = 0; i < 4000; i++) state = step(state, Intent.Right);
  assert.ok(state.player.x <= tuning.room.width - tuning.player.width / 2);
});

test("a mistimed block costs more than the parry window it was aiming for", () => {
  let state = createInitialState(600);
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
  let state = createInitialState(600);
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
