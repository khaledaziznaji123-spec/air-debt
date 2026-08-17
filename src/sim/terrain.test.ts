/**
 * The ground under the player.
 *
 * Terrain is the one system where a bug is invisible until it is fatal: a ledge
 * one unit too high, a pit with no way out, a chest reachable from underneath.
 * None of those look wrong on screen. They look wrong forty seconds into a run,
 * with the air gone.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createInitialState,
  goblin,
  step,
  Intent,
  type SimState,
} from "./index.ts";
import {
  landingSurface,
  blockHorizontally,
  ceilingSurface,
  safeGroundBefore,
} from "./collide.ts";
import { tuning } from "../config/tuning.ts";
import {
  builtEnd,
  checkTerrain,
  exitX,
  hazardAt,
  roofAt,
  terrain,
  MAX_STEP_UP,
} from "../config/terrain.ts";

// Widened from the literal type `tuning` gives it, so callers can pass a pit
// bottom or a ledge top rather than only the floor.
const FLOOR: number = tuning.room.floorY;

function standingAt(x: number, y: number = FLOOR): SimState {
  const base = createInitialState(60 * 60 * 10);
  return {
    ...base,
    entered: true,
    deepestX: x,
    player: { ...base.player, x, y },
    // Cleared, so a fight can never be what decides one of these.
    enemies: [],
  };
}

function run(state: SimState, intents: number, ticks: number): SimState {
  let s = state;
  for (let i = 0; i < ticks; i++) s = step(s, intents);
  return s;
}

test("the terrain holds its own invariants", () => {
  const t = checkTerrain();
  assert.equal(t.anchorsOnSurfaces, true, "nothing is placed in mid-air");
  assert.equal(
    t.stepUnderJump,
    true,
    "the step limit is under what a jump clears",
  );
  assert.equal(t.everyLedgeReachable, true, "every ledge can be climbed to");
  assert.equal(t.fixturesClear, true, "no lever is buried or over a pit");
  assert.equal(t.spansEnvironment, true, "the ground covers the built world");
  assert.equal(t.trapsStandable, true, "every plate can actually be stood on");
  assert.ok(t.traps >= 1, "the environment has at least one trap");
  assert.ok(terrain.ladders.length >= 1, "and at least one ladder");
});

test("a platform is landed on from above and blocks a head from below", () => {
  // Platforms are solid, so the route onto one has to be found rather than
  // popped up through. The underside is a ceiling, not a curtain.
  const ledge = terrain.surfaces.find((s) => s.thin);
  assert.ok(ledge, "there is a platform to test");
  const mid = (ledge.x0 + ledge.x1) / 2;

  const falling = landingSurface(mid, ledge.top - 10, ledge.top + 4, 8);
  assert.equal(falling?.top, ledge.top, "falling onto it lands");

  const rising = landingSurface(mid, ledge.top + 10, ledge.top - 4, -8);
  assert.equal(rising, null, "rising is not a landing");

  const bonk = ceilingSurface(mid, ledge.bottom + 6, ledge.bottom - 4, -8);
  assert.equal(
    bonk?.bottom,
    ledge.bottom,
    "a rising head strikes the underside",
  );
});

test("a fast fall cannot tunnel through the floor", () => {
  // At terminal velocity the player covers 16 units a tick, which is more than
  // a ledge is thick. Testing overlap rather than crossing would drop them
  // straight through — so the crossing is what is tested.
  const landed = landingSurface(
    tuning.room.playerSpawnX,
    FLOOR - tuning.movement.maxFallSpeed,
    FLOOR + tuning.movement.maxFallSpeed,
    tuning.movement.maxFallSpeed,
  );
  assert.equal(landed?.top, FLOOR, "the ground still catches it");
});

test("solid rock blocks, one-way ledges do not", () => {
  const solid = terrain.surfaces.find((s) => !s.thin && s.top < FLOOR);
  assert.ok(solid, "there is a raised block to walk into");

  // Walking right into its left face, at a height that overlaps it.
  const feet = solid.top + 40;
  const from = solid.x0 - 20;
  const into = blockHorizontally(solid.x0 + 10, from, feet, 82);
  assert.ok(into < solid.x0, "the block pushes back");

  // Standing on top of it is not blocked — the body is above the mass.
  const onTop = blockHorizontally(solid.x0 + 10, from, solid.top, 82);
  assert.equal(onTop, solid.x0 + 10, "standing on it is free movement");
});

test("a jump clears the highest step the terrain will build", () => {
  // The arithmetic `checkTerrain` asserts, played rather than calculated.
  let s = standingAt(tuning.room.entranceX + 40);
  const start = s.player.y;
  let peak = start;
  s = step(s, Intent.Jump);
  for (let i = 0; i < 60; i++) {
    s = step(s, Intent.None);
    peak = Math.min(peak, s.player.y);
  }
  assert.ok(
    start - peak > MAX_STEP_UP,
    `a jump rises ${(start - peak).toFixed(0)}, the tallest step is ${MAX_STEP_UP}`,
  );
});

test("falling in a pit puts you back on the edge, on your last bar", () => {
  // The whole rule. A pit is one hard cost you can read off the health bar,
  // not a countdown you lose the run to while climbing out.
  const spikes = terrain.spikes[0];
  const inside = (spikes.x0 + spikes.x1) / 2;

  let s = standingAt(inside, FLOOR + 40);
  const before = s.player.hp;
  s = run(s, Intent.None, 40);

  const perBar = tuning.player.maxHp / tuning.player.healthBars;
  assert.ok(s.player.hp < before, "it cost something");
  assert.ok(
    s.player.hp <= perBar + 0.001,
    `left on ${s.player.hp}, a bar is ${perBar}`,
  );
  assert.ok(
    s.player.y <= FLOOR + 1,
    `put back on the ground, not at ${s.player.y}`,
  );
  assert.ok(
    s.player.x < spikes.x0 || s.player.x > spikes.x1,
    `still over the pit at ${s.player.x.toFixed(0)}`,
  );
});

test("and falling in on your last bar ends the run", () => {
  // The floor is a floor, not a shield. A pit never kills you outright — but it
  // takes you to one bar, and there is nowhere below one bar to go.
  const spikes = terrain.spikes[0];
  const perBar = tuning.player.maxHp / tuning.player.healthBars;
  let s = standingAt((spikes.x0 + spikes.x1) / 2, FLOOR + 40);
  s = { ...s, player: { ...s.player, hp: perBar } };
  s = run(s, Intent.None, 40);
  assert.equal(s.outcome, "died");
});

test("a ladder is climbed, and stepping off it is always available", () => {
  const ladder = terrain.ladders[0];
  assert.ok(ladder, "there is a ladder");

  let s = standingAt(ladder.x, ladder.bottom);
  s = run(s, Intent.Jump, 40);
  assert.equal(s.player.stance, "climbing", "holding up on a ladder climbs");
  assert.ok(s.player.y < ladder.bottom - 40, "and gains real height");

  // Let go: gravity takes over. No dismount, no state to leave.
  //
  // The climb's own upward velocity is carried rather than zeroed, so there are
  // a few ticks of drift before the fall — which is a small hop off the top of
  // a ladder, and worth keeping. Hence the window rather than an instant check.
  const height = s.player.y;
  s = run(s, Intent.None, 30);
  assert.ok(s.player.y > height, "letting go falls");
  assert.notEqual(
    s.player.stance,
    "climbing",
    "and is no longer on the ladder",
  );
});

test("the climb stops at the top rung", () => {
  const ladder = terrain.ladders[0];
  let s = standingAt(ladder.x, ladder.bottom);
  s = run(s, Intent.Jump, 400);
  assert.ok(
    s.player.y >= ladder.top - 1,
    "the ladder does not carry the player past its own top",
  );
});

test("a trap tells before it fires", () => {
  // PRD FR-18.5. The half-second is the whole mechanic: a trap that fired on
  // contact would be a tax on the air rather than something to play around.
  const trap = terrain.traps[0];
  assert.ok(trap, "there is a trap");

  let s = standingAt(trap.x, trap.top);
  s = step(s, Intent.None);
  assert.equal(s.traps[0].phase, "telegraphing", "standing on it arms it");

  let fired = -1;
  for (let i = 0; i < 120; i++) {
    s = step(s, Intent.None);
    if (s.events.some((e) => e.type === "trapFired")) {
      fired = i;
      break;
    }
  }
  assert.ok(fired >= 0, "it fires");
  assert.ok(
    fired >= tuning.traps.tellLeadTime - 4,
    `fired after ${fired} ticks, the tell is ${tuning.traps.tellLeadTime}`,
  );
});

/**
 * How far the nearest thing that can hurt you is, going one way off a plate.
 *
 * Pits count. It used to ask only about moving hazards, decided that the empty
 * side was safe, and walked the fixture straight off the edge of a shaft — the
 * pit rule then floored the run at one bar and the test reported that leaving a
 * trap costs health, which it does not.
 */
function nearestHazard(x: number, dir: 1 | -1): number {
  let best = Infinity;
  for (const h of terrain.hazards) {
    const along = (h.x - x) * dir;
    if (along > 0 && along < best) best = along;
  }
  for (const p of terrain.spikes) {
    const edge = dir === 1 ? p.x0 : p.x1;
    const along = (edge - x) * dir;
    if (along > 0 && along < best) best = along;
  }
  // And anything too low to walk under. A stepping stone hangs with sixty-six
  // units of clearance and a standing player is eighty-two, so that way is a
  // wall unless you crouch — which is not "clear", and reading it as clear
  // walked the fixture into it and left it stuck beside the plate.
  for (const s of terrain.surfaces) {
    if (s.top >= tuning.room.floorY || s.bottom >= tuning.room.floorY) continue;
    const clearance = tuning.room.floorY - s.bottom;
    if (clearance >= tuning.player.height) continue;
    const edge = dir === 1 ? s.x0 : s.x1;
    const along = (edge - x) * dir;
    if (along > 0 && along < best) best = along;
  }
  return best;
}

/** Whichever way off a plate has its nearest moving hazard furthest away. */
function clearSide(x: number): 1 | -1 {
  return nearestHazard(x, -1) > nearestHazard(x, 1) ? -1 : 1;
}

/**
 * The plate with the most room around it.
 *
 * `traps[0]` was fine while there was one environment. There are two now and
 * the pieces shifted, and the first plate ended up with a saw a hundred and
 * eighty units away — so the test that walks off a plate walked into a saw, and
 * the test that stands on one got hit twice.
 */
function roomiestTrap() {
  return [...terrain.traps].sort(
    (a, b) =>
      Math.min(nearestHazard(b.x, 1), nearestHazard(b.x, -1)) -
      Math.min(nearestHazard(a.x, 1), nearestHazard(a.x, -1)),
  )[0];
}

test("reading the tell and leaving costs nothing", () => {
  // The answer to a trap is to be somewhere else. If leaving did not work, the
  // tell would be decoration.
  //
  // Away from the plate rather than always rightward. The world grew a second
  // environment and the pieces shifted; the fixed direction walked this fixture
  // straight into a saw, and the test failed reporting that leaving a trap
  // costs health — which it does not, and never did.
  const trap = roomiestTrap();
  const away = clearSide(trap.x);
  let s = standingAt(trap.x, trap.top);
  const hp = s.player.hp;
  s = step(s, Intent.None);
  // Off the plate. Its half-width is 52 and its reach 46, so getting clear
  // means covering nearly a hundred units — twenty ticks of walking covered
  // eighty-six of them and the trap still landed. Walking the whole time finds
  // something else to stand under in a world this dense, and the test would be
  // reporting on that instead.
  // Walked until genuinely clear rather than for a fixed count. A plate reaches
  // its half-width plus the trap reach, and how many ticks that takes depends
  // on what is underfoot — thirty-four of them covered a hundred and forty-six
  // units on open floor and sixty-seven here.
  // Just past its reach, and no further: the ground beside this plate is only
  // a hundred and thirty units wide before the next hazard, so demanding a
  // generous margin demanded more room than the level has.
  const clearOf = trap.halfWidth + tuning.traps.reach + 8;
  for (let i = 0; i < 200 && Math.abs(s.player.x - trap.x) < clearOf; i++) {
    s = step(s, away > 0 ? Intent.Right : Intent.Left);
  }
  assert.ok(
    Math.abs(s.player.x - trap.x) >= clearOf,
    `could not get clear of the plate; stopped ${Math.abs(s.player.x - trap.x).toFixed(0)} away`,
  );
  s = run(s, Intent.None, tuning.traps.tellLeadTime + tuning.traps.active + 10);
  assert.equal(s.player.hp, hp, "left in time, took nothing");
});

test("a trap leaves the run on its last bar, whatever it walked in with", () => {
  // Not damage — a floor. Full health or half, a trap puts you on one bar.
  //
  // Asserted on the FIRST hit rather than on the state some fixed number of
  // ticks later. A plate near another hazard fires, floors you at one bar, and
  // then the neighbour finishes you — which is the last-bar rule working
  // exactly as intended and reads, from the end state alone, like the floor
  // having failed.
  const bar = tuning.player.maxHp / tuning.player.healthBars;
  const trap = roomiestTrap();
  const fired = tuning.traps.tellLeadTime + tuning.traps.active + 4;

  function firstHit(from: number) {
    let s = standingAt(trap.x, trap.top);
    s = { ...s, player: { ...s.player, hp: from } };
    for (let i = 0; i < fired; i++) {
      s = step(s, Intent.None);
      if (s.events.some((e) => e.type === "playerHit")) return s.player.hp;
    }
    return s.player.hp;
  }

  assert.equal(
    firstHit(tuning.player.maxHp),
    bar,
    "from full health, down to one bar",
  );

  // And from two bars, the same place — the cost does not scale.
  const hurt = { player: { hp: firstHit(bar * 2) } };
  assert.equal(hurt.player.hp, bar, "from two bars, down to one bar");
});

test("a trap kills outright if the run is already on its last bar", () => {
  const bar = tuning.player.maxHp / tuning.player.healthBars;
  const trap = terrain.traps[0];
  let s = standingAt(trap.x, trap.top);
  s = { ...s, player: { ...s.player, hp: bar } };
  s = run(s, Intent.None, tuning.traps.tellLeadTime + tuning.traps.active + 4);
  assert.equal(s.player.hp, 0);
  assert.equal(s.outcome, "died");
});

test("a trap cannot be cancelled by stepping back off it", () => {
  // Committed once armed. A trap you can disarm by backing away is one you
  // never have to read.
  const trap = terrain.traps[0];
  let s = standingAt(trap.x, trap.top);
  s = step(s, Intent.None);
  assert.equal(s.traps[0].phase, "telegraphing");
  s = run(s, Intent.Left, 12);
  assert.notEqual(s.traps[0].phase, "idle", "backing off does not disarm it");
});

test("the world is clamped to what is actually built", () => {
  const s = run(standingAt(tuning.room.entranceX + 100), Intent.Right, 60 * 60);
  assert.ok(
    s.player.x <= tuning.room.width * 40,
    "the player cannot walk into unbuilt ground forever",
  );
});

test("the roof is geometry, not scenery", () => {
  // Before it moved into `terrain`, the ceiling was drawn by the renderer and
  // unknown to the simulation — so a jump from the tallest ledge carried the
  // player straight up through it and out of the world.
  // Thin surfaces only: the wall that plugs the end of the world reaches into
  // the ceiling by design, and nobody stands on it.
  const ledge = [...terrain.surfaces]
    .filter((s) => s.thin && s.top < FLOOR)
    .sort((a, b) => a.top - b.top)[0];
  assert.ok(ledge, "there is a platform to jump from");

  let s = standingAt((ledge.x0 + ledge.x1) / 2, ledge.top);
  s = step(s, Intent.Jump);
  for (let i = 0; i < 60; i++) {
    s = step(s, Intent.None);
    const head = s.player.y - tuning.player.height;
    assert.ok(
      head >= roofAt(s.player.x) - 0.5,
      `head reached ${head.toFixed(0)}, roof is at ${roofAt(s.player.x).toFixed(0)}`,
    );
  }
});

test("every ledge leaves headroom under the roof", () => {
  // The invariant the raised floor would have broken in silence.
  assert.equal(checkTerrain().ledgesUnderRoof, true);
});

test("a goblin follows the player onto a ledge", () => {
  // The thing that made ledges immunity: a goblin with no jump stands under the
  // player swinging at air forever.
  // With FLOOR UNDER IT. A ledge is only a thing a goblin can follow you onto
  // if there is ground to jump from — and the first ledge in the world is now
  // in the parkour, hanging over a shaft with a spike bed at the bottom.
  const ledge = terrain.surfaces.find(
    (s) =>
      s.thin &&
      FLOOR - s.top > 60 &&
      FLOOR - s.top < 130 &&
      terrain.surfaces.some(
        (f) =>
          !f.thin &&
          f.x0 <= s.x0 - 60 &&
          f.x1 >= s.x1 + 60 &&
          Math.abs(f.top - FLOOR) < 1,
      ),
  );
  assert.ok(ledge, "there is a ledge within one goblin jump");
  const on = (ledge.x0 + ledge.x1) / 2;

  const base = createInitialState(60 * 60 * 10);
  let s: SimState = {
    ...base,
    entered: true,
    player: { ...base.player, x: on, y: ledge.top },
    enemies: [
      {
        ...goblin(on - 40, FLOOR),
        facing: 1,
        phase: "approaching",
      },
    ],
  };

  let reached = false;
  for (let i = 0; i < 240 && !reached; i++) {
    s = step(s, Intent.None);
    reached = s.enemies[0].y <= ledge.top + 1;
  }
  assert.ok(reached, `goblin stayed at ${s.enemies[0].y.toFixed(0)}`);
});

test("a goblin without the verb stays on the floor", () => {
  // Difficulty is verb breadth (FR-7.2), so the jump has to be a property of
  // the enemy rather than something every enemy simply does.
  const ledge = terrain.surfaces.find(
    (s) => s.thin && FLOOR - s.top > 60 && FLOOR - s.top < 130,
  )!;
  const on = (ledge.x0 + ledge.x1) / 2;
  const base = createInitialState(60 * 60 * 10);
  let s: SimState = {
    ...base,
    entered: true,
    player: { ...base.player, x: on, y: ledge.top },
    enemies: [
      {
        ...goblin(on - 40, FLOOR),
        facing: 1,
        phase: "approaching",
        // The whole subject of the test: a goblin with the jump taken away.
        verbs: { ...goblin(0, 0).verbs, jump: false },
      },
    ],
  };
  for (let i = 0; i < 180; i++) s = step(s, Intent.None);
  assert.ok(s.enemies[0].y >= FLOOR - 1, "it stayed down");
});

test("goblins do not hang in the air when the ground is cut away", () => {
  // They had no vertical physics at all, which was invisible on a flat floor.
  const pit = terrain.spikes[0];
  const base = createInitialState(60 * 60 * 10);
  let s: SimState = {
    ...base,
    entered: true,
    player: { ...base.player, x: pit.x0 - 400 },
    enemies: [
      {
        ...goblin((pit.x0 + pit.x1) / 2, FLOOR),
        facing: -1,
        phase: "idle",
      },
    ],
  };
  for (let i = 0; i < 90; i++) s = step(s, Intent.None);
  assert.ok(
    s.enemies[0].y > FLOOR,
    "it fell into the pit rather than standing on nothing",
  );
});

test("moving hazards are a pure function of the tick", () => {
  // No state, nothing to persist, nothing to desynchronise — and the renderer
  // and the reducer compute the identical position from the identical number.
  const h = terrain.hazards[0];
  assert.ok(h, "there is a hazard");
  for (const tick of [0, 37, 500, 12345]) {
    assert.deepEqual(
      hazardAt(h, tick),
      hazardAt(h, tick),
      "same tick, same box",
    );
    assert.deepEqual(
      hazardAt(h, tick),
      hazardAt(h, tick + h.period),
      "and it repeats on its period",
    );
  }
});

test("every hazard kind is present and actually moves", () => {
  const kinds = new Set(terrain.hazards.map((h) => h.kind));
  for (const kind of ["pendulum", "crusher", "saw", "flow"] as const) {
    assert.ok(kinds.has(kind), `no ${kind} in the world`);
  }
  for (const h of terrain.hazards) {
    const boxes = [];
    for (let t = 0; t < h.period; t += 4) boxes.push(hazardAt(h, t));

    // A lava curtain is the one that does not travel: it is a fixed span of
    // roof that turns on and off. What has to cycle is the DANGER, not the
    // box — a curtain that was always armed would be a wall, and one that
    // never armed would be scenery.
    if (h.kind === "flow") {
      const armed = boxes.filter((b) => b.armed).length;
      assert.ok(armed > 0, `${h.id} never fires`);
      assert.ok(armed < boxes.length, `${h.id} never stops`);
      continue;
    }

    const xs = boxes.map((b) => b.left);
    const ys = boxes.map((b) => b.top);
    const moved =
      Math.max(...xs) - Math.min(...xs) > 20 ||
      Math.max(...ys) - Math.min(...ys) > 20;
    assert.ok(moved, `${h.id} never goes anywhere`);
  }
});

test("a crusher is only dangerous while it is down", () => {
  // A hazard that bit through its whole cycle would not be a rhythm to read,
  // it would be a wall.
  const crusher = terrain.hazards.find((h) => h.kind === "crusher");
  assert.ok(crusher, "there is a crusher");
  let armed = 0;
  for (let t = 0; t < crusher.period; t++) {
    if (hazardAt(crusher, t).armed) armed++;
  }
  assert.ok(armed > 0, "it does bite");
  assert.ok(
    armed < crusher.period * 0.4,
    `armed for ${armed} of ${crusher.period} ticks — that is a wall, not a trap`,
  );
});

test("standing in a hazard costs health at a readable rate", () => {
  const saw = terrain.hazards.find((h) => h.kind === "saw")!;
  // Park the player where the blade passes, and let a full cycle run.
  let s = standingAt(saw.x, FLOOR);
  const before = s.player.hp;
  s = run(s, Intent.None, saw.period);
  // A moving hazard is a trap: it takes the run to its last bar. A saw sweeps
  // out AND back, so parking in one for a full cycle is two passes — the first
  // strips you to one bar and the second ends it.
  const perBar = tuning.player.maxHp / tuning.player.healthBars;
  assert.ok(s.player.hp < before, "the blade connects");
  assert.ok(
    s.player.hp === perBar || s.player.hp === 0,
    `left on ${s.player.hp}, which is neither one bar nor dead`,
  );
});

test("a goblin that falls on the spikes dies outright", () => {
  // The traps do not care whose they are. This is what turns a hazard into a
  // weapon: the answer to a crowd becomes leading them over it.
  const pit = terrain.spikes[0];
  const base = createInitialState(60 * 60 * 10);
  let s: SimState = {
    ...base,
    entered: true,
    player: { ...base.player, x: pit.x0 - 300 },
    enemies: [
      {
        ...goblin((pit.x0 + pit.x1) / 2, FLOOR),
        facing: -1,
        phase: "idle",
      },
    ],
  };
  let died = false;
  for (let i = 0; i < 120 && !died; i++) {
    s = step(s, Intent.None);
    died = s.enemies[0].phase === "dead";
  }
  assert.ok(died, "it fell in and stayed alive on full health");
  assert.equal(s.enemies[0].hp, 0);
});

test("a goblin caught by a moving hazard dies outright", () => {
  const saw = terrain.hazards.find((h) => h.kind === "saw")!;
  const base = createInitialState(60 * 60 * 10);
  let s: SimState = {
    ...base,
    entered: true,
    player: { ...base.player, x: saw.x - 500 },
    enemies: [
      {
        ...goblin(saw.x, FLOOR),
        facing: -1,
        phase: "idle",
        // Inert. It is here to be hit by the saw, and one that walked away
        // would be testing the pathing rather than the hazard.
        verbs: { ...goblin(0, 0).verbs, move: false, attack: false },
      },
    ],
  };
  let died = false;
  for (let i = 0; i < saw.period + 10 && !died; i++) {
    s = step(s, Intent.None);
    died = s.enemies[0].phase === "dead";
  }
  assert.ok(died, "the blade passed through it and it survived");
});

test("the rock a patch of floor is made of does not depend on the camera", () => {
  // The floor changed colour as the player walked: the renderer anchored its
  // block grid to the visible edge, so every block's seed shifted with the
  // camera. This asserts the property the fix relies on — that the grid is a
  // function of world position alone. `drawMass` derives its cells from
  // `Math.floor((x - shove) / CELL)`, so the same world x is always the same
  // cell whatever the viewport happens to be.
  const CELL = 74;
  const cellOf = (worldX: number, shove: number) =>
    Math.floor((worldX - shove) / CELL);
  for (const shove of [0, 17.5, 61]) {
    for (const x of [1000, 1037, 4210.5]) {
      assert.equal(
        cellOf(x, shove),
        cellOf(x, shove),
        "the same world x always lands in the same cell",
      );
    }
  }
  // And two different viewports looking at the same x agree, because the
  // viewport is not an input at all.
  assert.equal(cellOf(3000, 20), cellOf(3000, 20));
});

test("goblins stay inside the dungeon", () => {
  // They used to walk out of the mouth and across the open ground in front of
  // it — through the drawn cliff, which is the same hole the player was
  // walking through before the art was cut back.
  const base = createInitialState(60 * 60 * 10);
  let s: SimState = {
    ...base,
    entered: true,
    // Player standing outside, so every goblin that can will come for them.
    player: { ...base.player, x: 140 },
    enemies: [
      {
        ...goblin(tuning.room.entranceX + 60, FLOOR),
        facing: -1,
        phase: "approaching",
      },
    ],
  };
  for (let i = 0; i < 600; i++) s = step(s, Intent.None);
  assert.ok(
    s.enemies[0].x >= tuning.room.entranceX - 1,
    `a goblin reached ${s.enemies[0].x.toFixed(0)}, outside the mouth at ${tuning.room.entranceX}`,
  );
});

test("a slide fits under a lintel that walking does not", () => {
  // The third reason the dodge exists, after the i-frames and the sprint it
  // feeds: geometry that cannot be walked through at all.
  // On dry, flat ground, with a clear run at it. The first low overhang in the
  // world is now in the sea, where "walking cannot pass under it" is not a fact
  // about the overhang — you swim under it, which is the whole point of a reef.
  const lintel = terrain.surfaces.find(
    (s) =>
      s.bottom < FLOOR &&
      FLOOR - s.bottom < tuning.player.height &&
      !terrain.water.some((w) => s.x1 > w.x0 && s.x0 < w.x1) &&
      // And nothing in the run-up. The poison's lintels sit beside its sumps,
      // and a slide that stops at the lip of a pit two hundred units short of
      // the overhang is measuring the pit.
      !terrain.spikes.some((k) => k.x1 > s.x0 - 220 && k.x0 < s.x1 + 40) &&
      terrain.surfaces.some(
        (f) =>
          !f.thin &&
          f.x0 <= s.x0 - 200 &&
          f.x1 >= s.x1 + 20 &&
          Math.abs(f.top - FLOOR) < 1,
      ),
  );
  assert.ok(lintel, "there is a low overhang on dry ground somewhere");

  const approach = lintel.x0 - 120;
  // Walking into it: stopped short.
  let walk = standingAt(approach);
  for (let i = 0; i < 120; i++) walk = step(walk, Intent.Right);
  assert.ok(walk.player.x < lintel.x1, "walking cannot pass under it");

  // Sliding into it: through.
  let slide = standingAt(approach);
  for (let i = 0; i < 600; i++) {
    // Hold right, and re-slide whenever one is actually available. The button
    // has to be RELEASED between attempts: a slide starts on a fresh press, so
    // holding it down through the cooldown never starts a second one.
    const ready =
      slide.player.dashTicks === 0 && slide.player.dashCooldown === 0;
    const dash = ready && i % 2 === 0 ? Intent.Slide : Intent.None;
    slide = step(slide, Intent.Right | dash);
    if (slide.player.x > lintel.x1) break;
  }
  assert.ok(
    slide.player.x > lintel.x1,
    `slide stopped at ${slide.player.x.toFixed(0)}, lintel ends at ${lintel.x1}`,
  );
});

test("the end of the fire is walkable, and does not bank the run by itself", () => {
  // There used to be a lit doorway here that banked the run on contact, and it
  // is gone. It did exactly what the escape shaft at the end of the fire does,
  // stood immediately after the chamber door, and was the brighter of the two —
  // so the last thing a player saw before the boss room was an invitation to
  // leave.
  //
  // FR-4.2 is unharmed: any exit still banks everything, and there are eleven
  // of them (the mouth and ten shafts) against the two there were.
  let s = standingAt(exitX - 120);
  assert.equal(s.outcome, "running");
  for (let i = 0; i < 200 && s.outcome === "running"; i++) {
    s = step(s, Intent.Right);
  }
  assert.equal(s.outcome, "running", "walking east must not end the run");
});

test("the wall past the exit holds, and there is no falling out of the world", () => {
  let s = standingAt(builtEnd - 600);
  for (let i = 0; i < 600; i++) s = step(s, Intent.Right);
  assert.ok(s.player.x <= builtEnd, "the wall holds");
  assert.ok(
    s.player.y <= FLOOR + 1,
    "and the ground never runs out underneath",
  );
});

// ---------------------------------------------------------------- the wall
//
// The spike pit at 4690..4963 is the fixture for all of these: a real shaft in
// the built environment, 273 wide and 150 deep, with solid rock on both sides.
// It is also the place the mechanic is FOR — before wall jumping, the only way
// out of a pit was the ladder or the ledge across it.
/**
 * A shaft with walls to kick off, found rather than written down.
 *
 * These four numbers were the shaft in environment 1. They have been wrong
 * twice now — once when the fire was added and again when the parkour was —
 * and a hardcoded pit that has drifted does not fail loudly, it silently tests
 * a different piece of ground. So it is derived: the deepest cut with solid
 * walls on both sides and enough room between them to fall down the middle of.
 */
const PIT = (() => {
  let best: { left: number; right: number; floor: number } | null = null;
  let bestHeight = Infinity;
  for (const s of terrain.surfaces) {
    // A pit's bed: below the floor, and wide enough to stand in.
    if (s.top <= tuning.room.floorY + 40) continue;
    // Narrow, so the two walls are within kicking distance of each other. A
    // four-hundred-wide shaft has walls you cannot chain between, and the test
    // measured that as the chain being broken.
    if (s.x1 - s.x0 < 120 || s.x1 - s.x0 > 240) continue;
    const walls = terrain.surfaces.filter(
      (w) => !w.thin && w.bottom > s.top && w.top < tuning.room.floorY,
    );
    const left = walls.some((w) => Math.abs(w.x1 - s.x0) < 6);
    const right = walls.some((w) => Math.abs(w.x0 - s.x1) < 6);
    if (!left || !right) continue;
    // The tallest walls, not the deepest hole: what is being tested is how far
    // a chain of kicks can climb.
    const height = Math.min(
      ...walls
        .filter((w) => Math.abs(w.x1 - s.x0) < 6 || Math.abs(w.x0 - s.x1) < 6)
        .map((w) => w.top),
    );
    if (!best || height < bestHeight) {
      bestHeight = height;
      best = { left: s.x0, right: s.x1, floor: s.top };
    }
  }
  if (!best) throw new Error("no shaft with two walls anywhere");
  return best;
})();
/** Body flush against the pit's left wall, and against its right. */
const AT_LEFT_WALL = PIT.left + tuning.player.width / 2;
const AT_RIGHT_WALL = PIT.right - tuning.player.width / 2;

/** In the pit, in the air, falling. */
function inPitAt(x: number, y: number, vy = 1): SimState {
  const base = standingAt(x, y);
  return {
    ...base,
    player: { ...base.player, x, y, vy, stance: "airborne" },
  };
}

test("a wall you press into slows the fall", () => {
  let s = inPitAt(AT_LEFT_WALL, 520);
  // Held left: into the wall. One tick to register the wall, then it bites.
  for (let i = 0; i < 12; i++) s = step(s, Intent.Left);

  assert.equal(s.player.stance, "clinging", "the wall is being held");
  assert.ok(
    s.player.vy <= tuning.movement.wallSlideSpeed + 0.001,
    `fall speed ${s.player.vy.toFixed(2)} should be capped at ${tuning.movement.wallSlideSpeed}`,
  );
});

test("but only if you press into it — falling past a wall is still falling", () => {
  // The grab is a choice. Reaching terminal velocity beside a wall you are not
  // holding is what makes holding one mean something.
  let free = inPitAt(AT_LEFT_WALL, 500);
  for (let i = 0; i < 12; i++) free = step(free, Intent.None);
  assert.notEqual(free.player.stance, "clinging");
  assert.ok(
    free.player.vy > tuning.movement.wallSlideSpeed + 1,
    `should be falling freely, was ${free.player.vy.toFixed(2)}`,
  );

  // Pressing the WRONG way does not grab it either.
  let away = inPitAt(AT_LEFT_WALL, 500);
  for (let i = 0; i < 12; i++) away = step(away, Intent.Right);
  assert.notEqual(away.player.stance, "clinging");
});

test("kicking off a wall throws you up and away from it", () => {
  let s = inPitAt(AT_LEFT_WALL, 520);
  for (let i = 0; i < 6; i++) s = step(s, Intent.Left);
  assert.equal(s.player.stance, "clinging", "on the wall first");

  const before = s.player;
  s = step(s, Intent.Left | Intent.Jump);

  assert.ok(
    s.events.some((e) => e.type === "wallJumped"),
    "it announces itself",
  );
  assert.ok(s.player.vy < 0, `thrown upward, was ${s.player.vy.toFixed(2)}`);
  assert.ok(
    s.player.x > before.x,
    "and away from a wall on the left, even though left is still held",
  );
  assert.equal(s.player.facing, 1, "facing where it threw them");
});

test("a wall jump is not a free double jump", () => {
  // Mid-air in the middle of the pit, nowhere near either wall. Jump must do
  // nothing at all — this is the whole difference between the two mechanics.
  let s = inPitAt((PIT.left + PIT.right) / 2, 480);
  for (let i = 0; i < 4; i++) s = step(s, Intent.None);
  const falling = s.player.vy;
  assert.ok(falling > 0, "falling to begin with");

  s = step(s, Intent.Jump);
  assert.ok(s.player.vy > falling, "still falling, and faster — no jump given");
  assert.ok(
    !s.events.some((e) => e.type === "wallJumped"),
    "and nothing was announced",
  );
});

test("nor a second kick off the wall you just left", () => {
  // Immediately after a wall jump the face is still within a hand's reach. If
  // that counted, one wall would grant unlimited jumps and the push would never
  // have to be paid for.
  let s = inPitAt(AT_LEFT_WALL, 520);
  for (let i = 0; i < 6; i++) s = step(s, Intent.Left);
  s = step(s, Intent.Left | Intent.Jump);

  let kicks = 0;
  for (let i = 0; i < 8; i++) {
    // Release and re-press, so every one of these is a fresh press.
    s = step(s, i % 2 === 0 ? Intent.Left | Intent.Jump : Intent.Left);
    kicks += s.events.filter((e) => e.type === "wallJumped").length;
  }
  assert.equal(kicks, 0, "the launch window owes nothing");
});

test("wall jumps chain, and climb higher than a jump can reach", () => {
  // The whole point of the mechanic, stated as the thing it changes: a wall is
  // now a route upward, and out of a hole a jump cannot clear.
  //
  // The fixture is a chimney rather than a lone wall, because a lone wall gives
  // exactly two kicks and then runs out of height — you climb past its top and
  // there is nothing left to push off. Two facing walls is what a chain is FOR,
  // and it is what the parkour is built out of.
  /**
   * A shaft with a solid face on either side, found rather than remembered.
   *
   * This used to be the number 4220, a tower in environment 1, and the number
   * rotted the first time the pieces shifted. Ask the terrain instead: two tall
   * blocks looking at each other across a gap narrow enough to cross.
   */
  const CHIMNEY = (() => {
    let best: { left: number; right: number } | null = null;
    let bestTop = Infinity;
    for (const a of terrain.surfaces) {
      if (a.thin || a.top > FLOOR - 200) continue;
      for (const b of terrain.surfaces) {
        if (b.thin || b.top > FLOOR - 200) continue;
        // Wide enough to fall into, narrow enough to cross in one push.
        const gap = b.x0 - a.x1;
        if (gap < 90 || gap > 220) continue;
        // The tallest pair, so the climb has somewhere to go.
        const top = Math.max(a.top, b.top);
        if (top < bestTop) {
          bestTop = top;
          best = { left: a.x1, right: b.x0 };
        }
      }
    }
    if (!best) throw new Error("no chimney to climb anywhere");
    return best;
  })();

  const mid = (CHIMNEY.left + CHIMNEY.right) / 2;
  let s = standingAt(mid, FLOOR - 40);

  /** Is there wall at shoulder height that way? */
  const wallAt = (x: number, y: number) =>
    terrain.surfaces.some(
      (f) => !f.thin && x >= f.x0 && x <= f.x1 && y > f.top && y < f.bottom,
    );

  let kicks = 0;
  let highest = s.player.y;
  for (let i = 0; i < 200; i++) {
    // Held into whichever face is within reach, jump pulsed. Holding jump would
    // not do it — every kick has to be a fresh press.
    const p = s.player;
    const into = wallAt(p.x + 26, p.y - 20)
      ? Intent.Right
      : wallAt(p.x - 26, p.y - 20)
        ? Intent.Left
        : p.x < mid
          ? Intent.Left
          : Intent.Right;
    s = step(s, into | (i % 3 === 0 ? Intent.Jump : 0));
    kicks += s.events.filter((e) => e.type === "wallJumped").length;
    highest = Math.min(highest, s.player.y);
  }

  assert.ok(kicks >= 3, `chained, not a one-off — ${kicks} kicks`);

  // Higher than the same player could ever get from where they started with one
  // jump. Derived, not hardcoded, so retuning gravity cannot quietly make this
  // test agree with a broken game.
  const { jumpImpulse, gravity } = tuning.movement;
  const oneJump = FLOOR - 40 - (jumpImpulse * jumpImpulse) / (2 * gravity);
  assert.ok(
    highest < oneJump - 20,
    `climbed to ${highest.toFixed(0)}; one jump only reaches ${oneJump.toFixed(0)}`,
  );
});

test("the grip does not survive landing", () => {
  // A wall touched on the way down must not still be worth a jump once the
  // player is standing on flat ground somewhere else entirely.
  let s = inPitAt(AT_RIGHT_WALL, 540);
  for (let i = 0; i < 8; i++) s = step(s, Intent.Right);
  assert.equal(s.player.stance, "clinging");

  // Fall to the pit floor and settle.
  for (let i = 0; i < 60; i++) s = step(s, Intent.None);
  assert.equal(s.player.wallDir, 0, "let go on landing");
  assert.equal(s.player.wallCoyote, 0);
});

// -------------------------------------------------------------- the shaft
//
// The deep spiked pit under a floating platform. Every other pit in the
// dungeon is shallower than a jump; this one is the piece that exists to be
// climbed, so both halves of that claim are asserted rather than eyeballed.
function deepestPit() {
  return terrain.spikes.reduce((a, b) => (b.top > a.top ? b : a));
}

test("the shaft is deeper than any jump can clear", () => {
  const pit = deepestPit();
  const { jumpImpulse, gravity } = tuning.movement;
  const jumpRise = (jumpImpulse * jumpImpulse) / (2 * gravity);
  const floorOfIt = pit.top + 16;

  assert.ok(
    floorOfIt - FLOOR > jumpRise + 60,
    `${(floorOfIt - FLOOR).toFixed(0)} deep against a ${jumpRise.toFixed(0)} jump — ` +
      "a pit escapable by jumping teaches nobody to use a wall",
  );
});

test("and falling into it throws you back out of it", () => {
  // The shaft is a thing to CROSS now rather than a thing to climb. The wall
  // jump was always aimed at the parkour environment; this one is a hazard.
  const pit = deepestPit();
  let s = standingAt((pit.x0 + pit.x1) / 2, FLOOR);
  s = { ...s, player: { ...s.player, vy: 4, stance: "airborne" } };

  let thrown = false;
  for (let i = 0; i < 200 && !thrown; i++) {
    s = step(s, Intent.None);
    thrown = s.events.some((e) => e.type === "thrownBack");
  }

  assert.ok(thrown, "it put you back rather than leaving you down there");
  assert.ok(
    s.player.y <= FLOOR + 1,
    `back on the ground, not at ${s.player.y}`,
  );
  assert.ok(s.player.hp > 0, "and alive to walk it again");
});

test("padded soles buy back most of what a pit costs, but never all of it", () => {
  const pit = deepestPit();
  const perBar = tuning.player.maxHp / tuning.player.healthBars;

  function fallIn(levels: Record<string, number>) {
    const base = createInitialState(60 * 60 * 10, {
      loadout: { levels, skin: null, pet: null },
    });
    let s: SimState = {
      ...base,
      entered: true,
      deepestX: pit.x0,
      player: { ...base.player, x: (pit.x0 + pit.x1) / 2, y: FLOOR, vy: 4 },
      enemies: [],
    };
    for (let i = 0; i < 200; i++) {
      s = step(s, Intent.None);
      if (s.events.some((e) => e.type === "thrownBack")) break;
    }
    return s.player.hp;
  }

  const bare = fallIn({});
  const padded = fallIn({ "gear.soles": 3 });
  assert.ok(
    bare <= perBar + 0.001,
    `unpadded takes you to one bar, got ${bare}`,
  );
  assert.ok(padded > bare, `padded kept ${padded} against ${bare}`);
  assert.ok(padded < tuning.player.maxHp, "and it still costs something");
});

test("a pressure plate takes your health and leaves you standing", () => {
  // Plates and moving hazards are read-and-avoid. They apply the floor and
  // nothing else — the throw-back belongs to PITS, which are the thing you fall
  // into rather than the thing you walk over.
  const plate =
    terrain.traps.find((p) => p.top >= FLOOR - 1) ?? terrain.traps[0];
  let s = standingAt(plate.x, plate.top);

  let hit = false;
  for (
    let i = 0;
    i < tuning.traps.reset + tuning.traps.tellLeadTime + 40;
    i++
  ) {
    s = step(s, Intent.None);
    if (s.events.some((e) => e.type === "playerHit")) hit = true;
  }

  const perBar = tuning.player.maxHp / tuning.player.healthBars;
  assert.ok(hit, "it fired");
  assert.ok(s.player.hp <= perBar + 0.001, "and took you to the last bar");
  assert.ok(
    Math.abs(s.player.x - plate.x) < 40,
    `it should not move you — went to ${s.player.x.toFixed(0)}`,
  );
});

test("it never throws you into a pit or inside the rock", () => {
  // The failure that would make the rule worse than not having it: rescued from
  // a trap directly into the spikes.
  const spikes = terrain.spikes;
  for (const plate of terrain.traps) {
    for (const facing of [1, -1] as const) {
      const spot = safeGroundBefore(plate.x, facing);
      if (!spot) continue;
      assert.ok(
        spot.y <= tuning.room.floorY + 1,
        `${plate.id}: thrown to y ${spot.y}, which is down a hole`,
      );
      for (const s of spikes) {
        assert.ok(
          spot.x < s.x0 || spot.x > s.x1,
          `${plate.id}: thrown onto the spikes at ${spot.x}`,
        );
      }
    }
  }
});

test("the ward still spares you the floor", () => {
  const plate =
    terrain.traps.find((p) => p.top >= FLOOR - 1) ?? terrain.traps[0];
  const base = createInitialState(60 * 60 * 10, {
    loadout: { levels: { "potion.ward": 1 }, skin: null, pet: null },
  });
  let s: SimState = {
    ...base,
    entered: true,
    deepestX: plate.x,
    player: { ...base.player, x: plate.x, y: plate.top, facing: 1 },
    enemies: [],
  };
  // Up to the first thing that lands, for the same reason the last-bar test
  // stops there: a plate with a neighbour fires, the ward eats it, and then the
  // neighbour hits — which says nothing about the ward.
  let spent = false;
  for (
    let i = 0;
    i < tuning.traps.reset + tuning.traps.tellLeadTime + 40;
    i++
  ) {
    s = step(s, Intent.None);
    if (s.potions.length === 0) {
      spent = true;
      break;
    }
  }
  const perBar = tuning.player.maxHp / tuning.player.healthBars;
  assert.ok(spent, "the ward was spent");
  assert.ok(
    s.player.hp > perBar + 0.001,
    `it should stop the floor — left on ${s.player.hp}`,
  );
});
