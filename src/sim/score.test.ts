/**
 * Scoring, and the property the whole leaderboard rests on.
 *
 * The server never receives a score. It receives an input log, replays it, and
 * scores the result itself — so the thing that has to be true is that a replay
 * of a run produces the SAME score as the run did. If that ever stops holding,
 * every honest player is rejected as a cheat and the boards fill up with
 * whoever happens to be running the version the server agrees with.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createInitialState,
  replay,
  step,
  Intent,
  type InputRecord,
  type SimState,
} from "./index.ts";
import { bagValue, scoreOf, scoresOf, SPEED_CEILING } from "./score.ts";

/** Play a run from a scripted set of intents, keeping the log as we go. */
function play(
  intents: (s: SimState, i: number) => number,
  ticks = 60 * 60,
  options = {},
): { state: SimState; log: InputRecord[] } {
  let s = createInitialState(60 * 60 * 10, options);
  const log: InputRecord[] = [];
  for (let i = 0; i < ticks && s.outcome === "running"; i++) {
    const held = intents(s, i);
    // The client records a tick only when what is held CHANGES, and the replay
    // fills the gaps with "same as before" — so the test has to record the same
    // way or it is not testing the same thing the server will be handed.
    if (log.length === 0 || log[log.length - 1].intents !== held) {
      log.push({ tick: i, intents: held });
    }
    s = step(s, held);
  }
  return { state: s, log };
}

test("a replay of a run scores exactly what the run scored", () => {
  // The load-bearing property. Walk in, grab what is near the mouth, walk out.
  const { state, log } = play((s, i) =>
    i < 900
      ? Intent.Right | (i % 40 < 4 ? Intent.Interact : 0)
      : Intent.Left | (i % 40 < 4 ? Intent.Interact : 0),
  );

  const again = replay(log, 60 * 60 * 10);
  assert.equal(again.tick >= state.tick - 1, true, "the replay ran the run");
  for (const board of ["riches", "speed"] as const) {
    assert.equal(
      scoreOf(again, board),
      scoreOf(state, board),
      `the ${board} board disagreed with itself`,
    );
  }
});

test("a replay against the wrong starting air is a different run", () => {
  // Which is why the server writes the tank down before the run rather than
  // believing it afterwards. This is the check working, not failing.
  const { state, log } = play((s, i) => (i < 600 ? Intent.Right : Intent.Left));
  const wrong = replay(log, 60 * 30);
  assert.notDeepEqual(
    { air: wrong.air, x: Math.round(wrong.player.x) },
    { air: state.air, x: Math.round(state.player.x) },
    "a shorter tank produced an identical run",
  );
});

test("only a banked run counts towards riches", () => {
  // FR-21.1: death and transformation cost the same thing, and it is the loot.
  // The board has to agree with that or it rewards exactly what the game
  // punishes.
  const base = createInitialState(60 * 60 * 10);
  const rich = {
    ...base,
    carried: { gems: [4, 2, 0, 0, 0], gold: 7, legendaries: 0 },
  };
  assert.equal(scoreOf({ ...rich, outcome: "extracted" }, "riches"), 87);
  assert.equal(scoreOf({ ...rich, outcome: "died" }, "riches"), null);
  assert.equal(scoreOf({ ...rich, outcome: "transformed" }, "riches"), null);
  assert.equal(scoreOf({ ...rich, outcome: "running" }, "riches"), null);
});

test("gems are worth more the deeper they came from", () => {
  // The board should reward going down rather than farming the entrance, which
  // is the same thing FR-10 asks of the loot tables.
  const shallow = bagValue({ gems: [5, 0, 0, 0, 0], gold: 0, legendaries: 0 });
  const deep = bagValue({ gems: [0, 0, 0, 0, 5], gold: 0, legendaries: 0 });
  assert.equal(deep, shallow * 5);
});

test("the speed board stores time saved, so higher is better on both", () => {
  // One sort direction for the whole system. Every `order by`, every personal
  // best and every "is this better" would otherwise have to know which board it
  // was looking at, which is four places to get backwards.
  const base = createInitialState(60 * 60 * 10);
  const fast = { ...base, enteredTick: 100, felledTick: 100 + 60 * 120 };
  const slow = { ...base, enteredTick: 100, felledTick: 100 + 60 * 300 };
  const a = scoreOf(fast, "speed");
  const b = scoreOf(slow, "speed");
  assert.ok(a !== null && b !== null);
  assert.ok(a! > b!, "the faster kill did not score higher");
  assert.equal(a, SPEED_CEILING - 60 * 120);
});

test("a boss that never fell scores nothing on speed", () => {
  const base = createInitialState(60 * 60 * 10);
  assert.equal(scoreOf({ ...base, enteredTick: 10 }, "speed"), null);
  // And one that fell before the run started is not a run either.
  assert.equal(
    scoreOf({ ...base, enteredTick: 500, felledTick: 100 }, "speed"),
    null,
  );
});

test("the tutorial is worth nothing, but an invincible run can rank", () => {
  // Two different decisions that used to be one.
  //
  // The hall scores nothing because it is a fixed room with a fixed payout — a
  // score from it is meaningless. A god run DOES score, because the accounts
  // that can make one are named in the database by hand and the board labels
  // their rows. That is the part that makes it honest rather than the part that
  // makes it fair: such a run is easier than any real one and will out-score it,
  // and the answer is to say so on the row rather than to hide it.
  const banked = {
    ...createInitialState(60 * 60 * 10),
    outcome: "extracted" as const,
    carried: { gems: [9, 9, 9, 9, 9], gold: 900, legendaries: 2 },
    enteredTick: 0,
    felledTick: 600,
  };
  assert.ok(scoresOf(banked).length === 2, "an honest run scores on both");
  assert.deepEqual(
    scoresOf({ ...banked, god: true }),
    scoresOf(banked),
    "an invincible run should rank the same as any other — labelled, not barred",
  );
  assert.deepEqual(
    scoresOf({
      ...banked,
      tutorial: { step: "done" as const, ticks: 0, justPassed: false },
    }),
    [],
  );
});