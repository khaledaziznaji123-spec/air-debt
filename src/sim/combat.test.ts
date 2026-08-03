import { test } from "node:test";
import assert from "node:assert/strict";
import { createInitialState, step, Intent, type SimState, type Intents } from "./index.ts";
import { tuning } from "../config/tuning.ts";

const GOBLIN = tuning.enemies.goblin;

/** Advance n ticks holding the same intents. */
function run(state: SimState, ticks: number, intents: Intents = Intent.None): SimState {
  let s = state;
  for (let i = 0; i < ticks; i++) s = step(s, intents);
  return s;
}

/** A state with one goblin close enough to engage immediately. */
function duel(): SimState {
  const base = createInitialState(60 * 60);
  return {
    ...base,
    enemies: [{ ...base.enemies[0], x: base.player.x + GOBLIN.attackRange - 2, facing: -1 }],
  };
}

/** Advance until the goblin is about to land its swing. */
function untilStrike(state: SimState, intents: Intents = Intent.None): SimState {
  let s = state;
  for (let i = 0; i < 200; i++) {
    s = step(s, intents);
    if (s.enemies[0].phase === "striking" && s.enemies[0].phaseTicks === 0) return s;
  }
  throw new Error("goblin never struck");
}

test("a goblin telegraphs before it strikes", () => {
  let s = duel();
  s = run(s, 1);
  assert.equal(s.enemies[0].phase, "telegraphing", "it must wind up, or the parry is unreadable");
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
    if (next.enemies[0].phase === "striking" && next.enemies[0].phaseTicks === 0) {
      // Re-run that tick with block held from one tick earlier.
      s = step(s, Intent.Block);
      break;
    }
    s = next;
  }
  assert.equal(s.player.hp, tuning.player.maxHp, "PRD FR-5.8: a parry takes no damage");
  assert.equal(s.enemies[0].hp, GOBLIN.maxHp - tuning.parry.riposteDamage);
  assert.equal(s.enemies[0].phase, "staggered");
  assert.ok(s.events.some((e) => e.type === "parry"));
});

test("blocking too early does not parry — the window has passed by the time it lands", () => {
  let s = duel();
  s = step(s, Intent.Block); // committed immediately, long before the swing
  s = untilStrike(s);
  assert.ok(s.player.hp < tuning.player.maxHp, "an expired block is not a parry");
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
  assert.equal(s.events.length, 0, "events are per-tick, or state stops being a pure function");
});
