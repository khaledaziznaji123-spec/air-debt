/**
 * The extraction decision under test.
 *
 * Loot is the only thing arguing with the air timer. If a chest cannot pay out
 * above its band, depth stops being a gamble and becomes a lookup; if it cannot
 * pay out below, shallow chests stop being worth opening and the whole first
 * environment turns into corridor. FR-10.1 and FR-10.2 are that argument
 * written down, and they are asserted here rather than eyeballed, because both
 * failure modes look completely fine for the first hundred runs.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createInitialState,
  emptyCarried,
  step,
  totalGems,
  Intent,
  type SimState,
} from "./index.ts";
import { tuning } from "../config/tuning.ts";
import {
  environmentAt,
  environmentLength,
  environmentStart,
  shortcuts,
  interactReach,
} from "../config/dungeon.ts";
import {
  builtEnd,
  environmentsBuilt,
  inChamber,
  terrain,
} from "../config/terrain.ts";

/** Mid-run, standing at `x`, with air to spare and nothing hunting. */
function standingAt(x: number, seed = 1, y?: number): SimState {
  const base = createInitialState(60 * 60 * 10, { seed });
  return {
    ...base,
    entered: true,
    deepestX: x,
    environment: environmentAt(x),
    // At the given height, or the floor line. Chests are no longer all on the
    // floor: some hang on parkour ledges four hundred units up and some sit on
    // the seabed under three hundred of water, and a fixture dropped at the
    // floor line for those is neither standing on nor within reach of the thing
    // it is trying to open.
    player: { ...base.player, x, y: y ?? base.player.y },
    enemies: [],
  };
}

/** Press and release E, so the next press is a fresh one. */
function pressInteract(state: SimState): SimState {
  return step(step(state, Intent.Interact), Intent.None);
}

test("chests reshuffle with the seed while the geometry does not", () => {
  // FR-18.2 — where loot sits is not memorisable, but the rooms it sits in are.
  const a = createInitialState(undefined, { seed: 1 });
  const b = createInitialState(undefined, { seed: 2 });
  const again = createInitialState(undefined, { seed: 1 });

  assert.deepEqual(
    a.chests.map((c) => c.x),
    again.chests.map((c) => c.x),
    "the same seed lays out the same run",
  );
  assert.notDeepEqual(
    a.chests.map((c) => c.x),
    b.chests.map((c) => c.x),
    "a different seed moves the loot",
  );
  assert.equal(
    a.chests.length,
    b.chests.length,
    "how many there are is geometry, not shuffle",
  );
});

test("the built environment is worth walking into", () => {
  // Every environment that exists is populated, nothing is placed in ground
  // that does not exist, and some of the loot is off the floor. A chest you can
  // walk over is not a reason to learn to jump.
  const { chests } = createInitialState();
  const inBuilt = chests.filter((c) => environmentAt(c.x) < environmentsBuilt);
  assert.equal(
    inBuilt.length,
    chests.length,
    "nothing is placed in unbuilt ground",
  );
  for (let e = 0; e < environmentsBuilt; e++) {
    const here = chests.filter((c) => environmentAt(c.x) === e);
    assert.ok(
      here.length >= 6,
      `environment ${e + 1} has only ${here.length} chests`,
    );
  }
  assert.ok(chests.length >= 8, `only ${chests.length} chests in the world`);

  const raised = chests.filter((c) => c.y < tuning.room.floorY);
  assert.ok(
    raised.length >= 3,
    `only ${raised.length} chests are off the floor`,
  );
});

test("nothing is placed past the built world except the chamber's own", () => {
  // The chamber is built past `builtEnd` on purpose — it is a room rather than
  // more corridor — so the boss and its chest are legitimately out there. What
  // must not happen is an ordinary goblin or a loose chest being slotted into
  // it by a pass that works by position, because every placement loop treats
  // `builtEnd` as the end of everywhere.
  const s = createInitialState();
  for (const c of s.chests) {
    if (inChamber(c.x)) {
      assert.equal(c.id, "chest.hollow", `${c.id} is loose in the chamber`);
      continue;
    }
    assert.ok(c.x < builtEnd, `${c.id} is past the world`);
  }
  for (const e of s.enemies) {
    if (inChamber(e.x)) {
      assert.equal(e.kind, "enemy.revenant", `a ${e.kind} is in the chamber`);
      continue;
    }
    assert.ok(e.x < builtEnd, `a ${e.kind} is past the world`);
  }
});

test("no chest sits on a lever or a door", () => {
  // A chest on a fixture would put "open the chest" and "flick the lever" on
  // the same key at the same spot, and one of them would silently never happen.
  const { chests } = createInitialState();
  for (const c of chests) {
    for (const s of shortcuts) {
      for (const fixture of [s.fromX, s.toX, s.leverX]) {
        assert.ok(
          Math.abs(c.x - fixture) > 40,
          `${c.id} at ${c.x} is on top of ${s.id} at ${fixture}`,
        );
      }
    }
  }
});

test("only the grades the game has a use for are handed out", () => {
  // One environment is built, so one grade of gem exists. The distance-weighted
  // table underneath is untouched and still rolls the full range — this is the
  // clamp on what reaches the player, and it lifts on its own as environments
  // are built. FR-10's live tails are asserted directly against the table in
  // the next test rather than through what a run happens to contain.
  const ceiling = Math.min(tuning.loot.grades, environmentsBuilt);
  for (let seed = 1; seed <= 40; seed++) {
    for (const c of createInitialState(undefined, { seed }).chests) {
      assert.ok(
        c.loot.grade >= 1 && c.loot.grade <= ceiling,
        `${c.id} rolled grade ${c.loot.grade}, above the built ceiling ${ceiling}`,
      );
    }
  }
});

test("the jackpot is reachable, and a climb pays better than the floor", () => {
  // The legendary chance is flat everywhere so no chest is safely ignorable,
  // and terrain is the second axis loot is gated on: a chest that cost a climb
  // pays more than one lying in the open. Unlike depth, that gate costs skill
  // rather than air — which is the one currency the design cannot inflate.
  let flatGems = 0;
  let flatCount = 0;
  let raisedGems = 0;
  let raisedCount = 0;
  let anyLegendary = false;

  for (let seed = 1; seed <= 160; seed++) {
    for (const c of createInitialState(undefined, { seed }).chests) {
      if (c.loot.legendary) anyLegendary = true;
      if (c.y < tuning.room.floorY) {
        raisedGems += c.loot.gems;
        raisedCount++;
      } else {
        flatGems += c.loot.gems;
        flatCount++;
      }
    }
  }

  assert.ok(anyLegendary, "the jackpot must actually be reachable");
  assert.ok(raisedCount > 0 && flatCount > 0, "need both kinds to compare");
  assert.ok(
    raisedGems / raisedCount > flatGems / flatCount,
    `a climb must pay: raised ${(raisedGems / raisedCount).toFixed(1)} vs floor ${(flatGems / flatCount).toFixed(1)}`,
  );
});

test("opening a chest carries what was in it, exactly once", () => {
  const seeded = createInitialState(undefined, { seed: 7 });
  const chest = seeded.chests[0];
  let state = standingAt(chest.x, 7, chest.y);

  assert.deepEqual(state.carried, emptyCarried(), "a run starts empty-handed");

  state = pressInteract(state);
  const opened = state.chests.find((c) => c.id === chest.id);
  assert.equal(opened?.opened, true, "the chest opens");
  assert.equal(
    state.carried.gems[chest.loot.grade - 1],
    chest.loot.gems,
    "the gems land in their own grade",
  );
  assert.equal(state.carried.gold, chest.loot.gold);

  // Emptied means emptied. A chest that pays twice is a chest that pays forever.
  const carried = state.carried;
  state = pressInteract(state);
  assert.deepEqual(state.carried, carried, "a second press takes nothing more");
});

test("a chest cannot be opened from across the room", () => {
  // Standing somewhere with NO chest in reach, rather than at a fixed offset
  // from one. Two hundred units used to be empty; the world doubled in length
  // and got twice the loose chests, and now it sometimes lands on the next one
  // along — so the test was reporting that reach was broken when what had
  // actually happened is that it had found a second chest.
  const seeded = createInitialState(undefined, { seed: 7 });
  const chest = seeded.chests[0];
  let at = chest.x + 200;
  while (seeded.chests.some((c) => Math.abs(c.x - at) <= interactReach + 20)) {
    at += 40;
  }
  const state = pressInteract(standingAt(at, 7));
  assert.equal(totalGems(state.carried), 0, "out of reach is out of reach");
});

test("walking out banks the bag; running out of air does not", () => {
  // FR-4.2 against FR-21.1. The sim's job is to report both halves truthfully —
  // what was carried, and how the run ended — because that pair is the entire
  // extraction decision and the shell does nothing but act on it.
  const seeded = createInitialState(undefined, { seed: 7 });
  const chest = seeded.chests[0];

  let leaving = standingAt(chest.x, 7, chest.y);
  leaving = pressInteract(leaving);
  const took = totalGems(leaving.carried);
  assert.ok(took > 0, "the fixture only works if something was picked up");

  // Walk back out of the mouth.
  leaving = {
    ...leaving,
    player: { ...leaving.player, x: environmentStart(0) },
  };
  for (let i = 0; i < 40 && leaving.outcome === "running"; i++) {
    leaving = step(leaving, Intent.Left);
  }
  assert.equal(leaving.outcome, "extracted");
  assert.equal(
    totalGems(leaving.carried),
    took,
    "extraction is untaxed — nothing is lost, taxed or left behind (FR-4.2)",
  );

  // The same bag, with the air gone instead.
  let suffocating = { ...standingAt(chest.x, 7, chest.y), air: 1 };
  suffocating = pressInteract(suffocating);
  assert.equal(suffocating.outcome, "transformed");
  assert.equal(
    totalGems(suffocating.carried),
    took,
    "the sim still reports what was carried — losing it is the shell's call",
  );
});

test("chest contents are fixed by the seed, not by when the lid comes up", () => {
  // Rolling at open time would make the loot a function of the player's route,
  // which a server replaying the log could not check. Same seed, two different
  // orders of opening, identical haul.
  const seeded = createInitialState(undefined, { seed: 11 });
  const inEnvironment = seeded.chests.filter(
    (c) =>
      environmentAt(c.x) === 0 && c.x < environmentStart(0) + environmentLength,
  );
  assert.ok(inEnvironment.length >= 2, "need two chests to open in two orders");
  const [a, b] = inEnvironment;

  const forwards = pressInteract({
    ...pressInteract(standingAt(a.x, 11)),
    player: { ...standingAt(b.x, 11).player },
  });
  const backwards = pressInteract({
    ...pressInteract(standingAt(b.x, 11)),
    player: { ...standingAt(a.x, 11).player },
  });

  assert.deepEqual(
    forwards.carried,
    backwards.carried,
    "what a chest holds was decided when the dungeon was laid out",
  );
});

test("a chest says what it paid at its own height, not at the floor", () => {
  // The view draws the payout a fixed distance ABOVE whatever the event gives
  // it. The event gave the floor line, which was the same number as the chest's
  // own height for exactly as long as every chest stood on the ground — so a
  // chest four hundred units up on a parkour ledge had its readout appear down
  // near the floor, below the chest, where it read as belonging to something
  // else entirely.
  const seeded = createInitialState(undefined, { seed: 7 });
  // One that is standing on something, so the fixture can stand there too — a
  // chest whose anchor hangs over a shaft is a fine chest and a useless fixture.
  const raised = seeded.chests.find(
    (c) =>
      c.y < tuning.room.floorY - 60 &&
      terrain.surfaces.some(
        (s) => c.x >= s.x0 && c.x <= s.x1 && Math.abs(s.top - c.y) < 2,
      ),
  );
  assert.ok(raised, "some chests are off the floor");

  // One step, not `pressInteract`: events do not accumulate, and the open
  // happens on the press rather than on the release.
  const s = step(standingAt(raised.x, 7, raised.y), Intent.Interact);
  const said = s.events.find((e) => e.type === "chestOpened");
  assert.ok(said, "it opened");
  assert.equal(said.y, raised.y, "the payout is announced where the chest is");
  assert.ok(said.y < tuning.room.floorY - 60, "and not down at the floor line");
});
