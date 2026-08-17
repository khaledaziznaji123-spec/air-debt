/**
 * Developer mode.
 *
 * There are exactly two ways to lose a run — the health runs out, or the air
 * does — and a debug flag that only switches off one of them is not a debug
 * mode, it is a longer timer. Both are asserted, and so is the thing that keeps
 * the flag honest: it travels IN the state, so a run made with it on is
 * self-identifying and a server can refuse to credit it.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createInitialState, step, Intent, type SimState } from "./index.ts";
import { tuning } from "../config/tuning.ts";
import { terrain } from "../config/terrain.ts";
import { phraseMeans, ADMIN_ON, ADMIN_OFF } from "../app/admin.ts";

const FLOOR: number = tuning.room.floorY;

function inside(x: number, y: number, god: boolean): SimState {
  const base = createInitialState(60 * 60, { god });
  return {
    ...base,
    entered: true,
    deepestX: x,
    player: { ...base.player, x, y },
    enemies: [],
  };
}

test("off by default — the flag has to be asked for", () => {
  assert.equal(createInitialState(600).god, false);
});

test("it is recorded in the state, so a run carries its own asterisk", () => {
  // The whole reason the flag lives in `SimState` rather than beside it. A
  // server replaying this run from its seed can see it was a test.
  let s = createInitialState(600, { god: true });
  assert.equal(s.god, true);
  for (let i = 0; i < 200; i++) s = step(s, Intent.Right);
  assert.equal(s.god, true, "and the reducer never drops it");
});

test("damage does not kill", () => {
  // Falling in a pit on your last bar, which is the one thing in the game that
  // is unconditionally fatal to an ordinary player.
  const pit = terrain.spikes.reduce((a, b) => (b.top > a.top ? b : a));
  const at = (pit.x0 + pit.x1) / 2;
  const perBar = tuning.player.maxHp / tuning.player.healthBars;

  let mortal = inside(at, FLOOR, false);
  mortal = { ...mortal, player: { ...mortal.player, hp: perBar, vy: 4 } };
  for (let i = 0; i < 200; i++) mortal = step(mortal, Intent.None);
  assert.equal(mortal.outcome, "died", "the fixture is genuinely lethal");

  let god = inside(at, FLOOR, true);
  god = { ...god, player: { ...god.player, hp: perBar, vy: 4 } };
  for (let i = 0; i < 200; i++) god = step(god, Intent.None);
  assert.equal(god.outcome, "running", "and it does nothing to an admin");
  assert.equal(
    god.player.hp,
    tuning.player.maxHp,
    "held at full, not a sliver",
  );
});

test("and neither does the air", () => {
  // The other way to lose. Running out is `transformed`, which is death with a
  // different name on it.
  let mortal: SimState = { ...inside(2000, FLOOR, false), air: 2 };
  for (let i = 0; i < 30; i++) mortal = step(mortal, Intent.None);
  assert.equal(mortal.outcome, "transformed", "the fixture genuinely expires");

  let god: SimState = { ...inside(2000, FLOOR, true), air: 2 };
  for (let i = 0; i < 300; i++) god = step(god, Intent.None);
  assert.equal(god.air, 0, "the clock still runs — the mode is not a pause");
  assert.equal(god.outcome, "running", "it just cannot end the run");
});

test("everything else still behaves", () => {
  // A debug mode that also changed the game would be no use for looking at the
  // game. Enemies still act, chests still open, the ground is still the ground.
  const a = createInitialState(600, { god: true });
  const b = createInitialState(600, { god: false });
  assert.deepEqual(
    a.enemies.map((e) => [e.kind, Math.round(e.x)]),
    b.enemies.map((e) => [e.kind, Math.round(e.x)]),
    "the same seed lays out the same dungeon either way",
  );
  assert.deepEqual(
    a.chests.map((c) => c.loot),
    b.chests.map((c) => c.loot),
    "and rolls the same loot",
  );
});

test("extraction still works, so a god run can still be finished", () => {
  let s = inside(tuning.room.entranceX - 20, FLOOR, true);
  s = step(s, Intent.None);
  assert.equal(s.outcome, "extracted");
});

test("the off phrase is not swallowed by the on phrase", () => {
  // ADMIN_OFF has ADMIN_ON as a prefix. Tested the wrong way round, "anayemene2"
  // matches as an ON and the mode can never be switched off again.
  assert.equal(phraseMeans(ADMIN_ON), true);
  assert.equal(phraseMeans(ADMIN_OFF), false);
  assert.ok(ADMIN_OFF.startsWith(ADMIN_ON), "which is why the order matters");

  assert.equal(phraseMeans("  AnAyEmEnE  "), true, "trimmed and case-folded");
  assert.equal(phraseMeans("anayemene3"), null, "and nothing else is either");
  assert.equal(phraseMeans(""), null);
});
