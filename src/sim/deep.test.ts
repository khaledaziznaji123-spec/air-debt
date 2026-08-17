/**
 * Environments 3, 4 and 5, and the one boss at the bottom.
 *
 * Three places with three different ideas about what the ground is for, so what
 * is asserted here is mostly that each one is actually ITSELF: that the water
 * makes you swim and costs air, that the parkour is genuinely empty of
 * monsters, and that the poison leaves something on you the way the fire does.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bee,
  createInitialState,
  crab,
  hollowPost,
  lizard,
  shark,
  step,
  Intent,
  type Enemy,
  type SimState,
} from "./index.ts";
import { isBusy, isLock, underneath } from "./step.ts";
import { waterAt, submerged, blocksShot } from "./collide.ts";
import { tuning } from "../config/tuning.ts";
import {
  builtEnd,
  chamber,
  drownedPassage,
  cenoteShafts,
  environmentsBuilt,
  escapes,
  highRoad,
  inChamber,
  shoreX,
  terrain,
} from "../config/terrain.ts";
import {
  environmentAt,
  environmentStart,
  shortcuts,
  THEMES,
  themeAt,
  themeEnd,
  themeStart,
} from "../config/dungeon.ts";

const FLOOR: number = tuning.room.floorY;
const BAR = tuning.player.maxHp / tuning.player.healthBars;

/**
 * Dormant while the final boss has nowhere to stand.
 *
 * The Hollow is finished — the fight, the two attacks, the walls, the chest —
 * and unplaced, because a boss on open floor at the end of a corridor is a
 * monster with a big health bar rather than an event. These tests come back
 * with its chamber.
 */
const NO_BOSS: false | string = tuning.finalBoss
  ? false
  : "the final boss is unplaced until it has a chamber (tuning.finalBoss)";

/**
 * Dormant while the Hollow is not the boss.
 *
 * It was, it worked, and it was replaced — the chamber holds a Revenant now:
 * somebody who came this far before you, with your verb set and your tells. The
 * Hollow's fight is still here and still correct, and these tests come back
 * with it if it is ever put back in a room of its own.
 */
const NOT_THE_HOLLOW = "the Hollow is not the boss any more — see the Revenant";

/**
 * Open water: a body deep enough to swim in, and an x inside it with nothing
 * overhead.
 *
 * Derived, because the reef piece puts a slab across the middle of its pool on
 * purpose — that is what makes diving compulsory there — and a test that swims
 * up into it is testing the slab.
 */
function openWater() {
  for (const w of terrain.water) {
    if (w.floor - w.surface < 180) continue;
    for (let x = w.x0 + 40; x < w.x1 - 40; x += 20) {
      const lid = terrain.surfaces.some(
        (s) =>
          x >= s.x0 - 20 &&
          x <= s.x1 + 20 &&
          s.bottom > w.surface - 40 &&
          s.top < w.floor,
      );
      if (!lid) return { w, x };
    }
  }
  throw new Error("no open water anywhere");
}

/** Flat, dry, empty floor in a given environment. */
function clearFloorIn(environment: number): number {
  for (let x = 1500; x < builtEnd - 600; x += 20) {
    if (environmentAt(x) !== environment) continue;
    const flat = terrain.surfaces.some(
      (s) => x >= s.x0 && x <= s.x1 && Math.abs(s.top - FLOOR) < 1,
    );
    const nasty = terrain.spikes.some((s) => x > s.x0 - 160 && x < s.x1 + 160);
    const wet = terrain.water.some((w) => x > w.x0 - 160 && x < w.x1 + 160);
    const busy = terrain.hazards.some((h) => Math.abs(h.x - x) < 300);
    const blocked = terrain.surfaces.some(
      (s) =>
        x >= s.x0 - 60 &&
        x <= s.x1 + 60 &&
        s.top < FLOOR - 4 &&
        s.bottom > FLOOR - tuning.player.height,
    );
    if (flat && !nasty && !wet && !busy && !blocked) return x;
  }
  throw new Error(`nowhere clear in environment ${environment + 1}`);
}

function at(x: number, y: number, enemies: Enemy[] = []): SimState {
  const base = createInitialState(60 * 60 * 20);
  return {
    ...base,
    entered: true,
    deepestX: x,
    environment: environmentAt(x),
    player: { ...base.player, x, y },
    enemies,
  };
}

// ----------------------------------------------------------------- the world

test("all five environments are built", () => {
  assert.equal(environmentsBuilt, 5);
  for (let e = 0; e < 5; e++) {
    const here = terrain.surfaces.filter((s) => environmentAt(s.x0) === e);
    assert.ok(
      here.length > 10,
      `environment ${e + 1} has almost nothing in it`,
    );
  }
});

test("there is one boss, and it is in its chamber", { skip: NO_BOSS }, () => {
  // It stood on open floor at the end of the last corridor, which made it a
  // monster with a large health bar rather than an event. It is in the room
  // now, and the room is the whole point: you go through a door to reach it.
  const s = createInitialState();
  const bosses = s.enemies.filter((e) => isLock(e.kind));
  assert.equal(bosses.length, 1, "one, not one per environment");
  assert.equal(bosses[0].kind, "enemy.revenant");
  assert.ok(inChamber(bosses[0].x), "and it is inside the chamber");
  // Clear of both walls, so the arena is the room rather than a corner of it.
  assert.ok(bosses[0].x > chamber.x0 + 200);
  assert.ok(bosses[0].x < chamber.x1 - 200);
});

test(
  "it is bulky, and shadow enough to leave the floor",
  { skip: NOT_THE_HOLLOW },
  () => {
    // Bulk is not decoration in a 2D fight: it decides how much of the room is
    // unsafe and whether backing off is a plan or a wish.
    const H = tuning.enemies.hollow;
    const P = tuning.player;
    assert.ok(
      H.width * H.height > P.width * P.height * 4,
      "the boss must dwarf the player",
    );
    assert.ok(H.speed < tuning.movement.walkSpeed / 2, "and be slow with it");

    // And the third verb — the one that makes it a shadow rather than a big
    // goblin. Under the floor it is not in the room: nothing can hit it and it
    // cannot hit anything.
    const base = createInitialState(60 * 60 * 20);
    const boss = base.enemies.find((e) => e.kind === "enemy.revenant")!;
    const sunk: Enemy = {
      ...boss,
      attackKind: "sink",
      phase: "striking",
      phaseTicks: 2,
    };
    assert.equal(underneath(sunk), true);
    assert.equal(underneath({ ...sunk, attackKind: "swing" }), false);
  },
);

test(
  "it goes under, travels, and comes up helpless",
  { skip: NOT_THE_HOLLOW },
  () => {
    // The rise is the fight's only free damage, and it is earned by having read
    // where the patch was going rather than by out-trading two hundred health.
    const base = createInitialState(60 * 60 * 20);
    const boss = base.enemies.find((e) => e.kind === "enemy.revenant")!;
    let s: SimState = {
      ...base,
      entered: true,
      deepestX: boss.x,
      // Close enough to be worth sinking at, far enough not to be swept.
      player: { ...base.player, x: boss.x - 400, y: FLOOR },
      enemies: [boss],
    };

    let sank = false;
    let travelled = 0;
    let helpless = 0;
    const startedAt = boss.x;
    for (let i = 0; i < 60 * 12; i++) {
      s = step(s, Intent.None);
      const e = s.enemies[0];
      if (e.attackKind !== "sink") continue;
      sank = true;
      if (e.phase === "striking") travelled = Math.abs(e.x - startedAt);
      if (e.phase === "recovering") helpless++;
    }
    assert.ok(sank, "it never went under");
    assert.ok(
      travelled > 60,
      `it only travelled ${Math.round(travelled)} units`,
    );
    assert.ok(helpless > 30, `only ${helpless} ticks of rise to punish`);
  },
);

test("the mini-bosses are unplaced rather than deleted", () => {
  // The experiment is reversible: the flag is the only thing keeping them out,
  // and the code that runs them is still here and still tested.
  assert.equal(tuning.miniBosses, false);
  const s = createInitialState();
  assert.equal(
    s.enemies.some((e) => e.kind === "enemy.warden"),
    false,
  );
  assert.equal(
    s.enemies.some((e) => e.kind === "enemy.kiln"),
    false,
  );
});

// ----------------------------------------------------------------- the water

test("environment 3 has water, and it deepens as you go", () => {
  const pools = terrain.water.filter((w) => themeAt(w.x0) === "water");
  assert.ok(pools.length >= 4, `only ${pools.length} bodies of water`);

  // A beach that becomes an ocean: the far half is deeper than the near half.
  const sorted = [...pools].sort((a, b) => a.x0 - b.x0);
  const depth = (w: (typeof pools)[number]) => w.floor - w.surface;
  const early = depth(sorted[0]);
  const late = depth(sorted[sorted.length - 1]);
  assert.ok(late > early, `it ends at ${late} deep and starts at ${early}`);
});

test("chest-deep is swimming; ankle-deep is not", () => {
  // The one decision that separates a beach from a wall of water: measured at
  // the chest, so a puddle does not take the controls away.
  const { w, x: mid } = openWater();
  assert.ok(waterAt(mid, w.surface + 100), "under the surface is swimming");
  assert.equal(waterAt(mid, w.surface - 60), null, "well above it is not");
});

test("in the water and off the bed is swimming, not falling", () => {
  // The stance is what every drawing of the player reads to decide which way up
  // the body goes. Before this it said "airborne" down there, and the swimmer
  // was drawn marching along the seabed.
  const { w, x: mid } = openWater();
  let s = at(mid, w.surface + 140);
  s = step(s, Intent.None);
  assert.equal(s.player.stance, "swimming");

  // And wading is not. Standing on the bed with your head out is walking, and
  // has to keep looking like walking — otherwise the whole beach swims.
  const shallow = terrain.water.find((v) => v.floor - v.surface < 60);
  if (shallow) {
    let d = at((shallow.x0 + shallow.x1) / 2, shallow.floor);
    for (let i = 0; i < 6; i++) d = step(d, Intent.Right);
    assert.notEqual(d.player.stance, "swimming", "the shallows are walked");
  }
});

test("you can swim up, which is the thing you cannot do anywhere else", () => {
  const { w, x: mid } = openWater();
  let s = at(mid, w.surface + 140);
  const start = s.player.y;
  for (let i = 0; i < 40; i++) s = step(s, Intent.Jump);
  assert.ok(
    s.player.y < start - 40,
    `only rose to ${s.player.y} from ${start}`,
  );
});

test("and being under costs air, which is the point of a dive", () => {
  const { w, x: mid } = openWater();

  const under = (() => {
    let s = at(mid, w.surface + 150);
    const a0 = s.air;
    for (let i = 0; i < 60; i++) s = step(s, Intent.None);
    return a0 - s.air;
  })();

  const dry = (() => {
    let s = at(1500, FLOOR);
    const a0 = s.air;
    for (let i = 0; i < 60; i++) s = step(s, Intent.None);
    return a0 - s.air;
  })();

  assert.ok(under > dry, `under spent ${under}, dry spent ${dry}`);
  assert.ok(submerged(mid, w.surface + 150), "the fixture really is under");
});

test("a shark is quick, and stays in its water", () => {
  const { w, x: mid } = openWater();
  const fish = shark(mid + 120, w.surface + (w.floor - w.surface) * 0.6);
  let s = at(mid, w.surface + 120, [fish]);
  for (let i = 0; i < 200; i++) s = step(s, Intent.None);

  const it = s.enemies[0];
  assert.ok(it.y > w.surface, "it never left the water");
  assert.ok(it.y < w.floor + 40, "and never went through the bottom of it");
  assert.ok(
    tuning.enemies.shark.speed > tuning.swim.kick,
    "faster than you are",
  );
});

// --------------------------------------------------------------- the parkour

test("environment 4 has no monsters at all", () => {
  // Not few. None — the level is the enemy, and one goblin in a wall-jump shaft
  // would make the whole environment about something else.
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const { enemies } = createInitialState(undefined, { seed });
    const here = enemies.filter((e) => themeAt(e.x) === "parkour");
    assert.deepEqual(
      here.map((e) => `${e.kind}@${Math.round(e.x)}`),
      [],
      `seed ${seed} put something in the parkour`,
    );
  }
});

test("the beach has something standing on it", () => {
  // Or environment 3 is "stay out of the water" and nothing else.
  const s = createInitialState();
  const crabs = s.enemies.filter((e) => e.kind === "enemy.crab");
  assert.ok(crabs.length >= 3, `only ${crabs.length} on the sand`);
  for (const c of crabs) assert.equal(environmentAt(c.x), 2, "and only there");
  // The factory is what the roster uses, so it is worth one assertion of its
  // own that a hand-made one comes out the same shape.
  const made = crab(1000, FLOOR);
  assert.equal(made.hp, tuning.enemies.crab.maxHp);
  assert.equal(made.verbs.shoot, false, "it closes rather than shoots");
});

test("but it is full of ways to fall", () => {
  const pits = terrain.spikes.filter((p) => themeAt(p.x0) === "parkour");
  assert.ok(pits.length >= 4, `only ${pits.length} pits in the parkour`);
});

// ---------------------------------------------------------------- the poison

test("a lizard's bite leaves poison on you", () => {
  const x = clearFloorIn(4);
  let s = at(x, FLOOR, [{ ...lizard(x + 60, FLOOR), phase: "idle" }]);
  let poisonedOnce = false;
  for (let i = 0; i < 300 && !poisonedOnce; i++) {
    s = step(s, Intent.None);
    poisonedOnce = s.events.some((e) => e.type === "poisoned");
  }
  assert.ok(poisonedOnce, "it bit, and the bite did something");
  assert.ok(s.player.poisoned > 0, "and it is still working");
});

test("poison costs what fire costs, and cannot take your last bar", () => {
  // Deliberately the same numbers as the burn: a player who has learned what
  // being on fire costs should not have to learn a second set.
  const dry = clearFloorIn(4);
  let s = at(dry, FLOOR);
  s = { ...s, player: { ...s.player, poisoned: tuning.poison.ticks } };
  const before = s.player.hp;
  for (let i = 0; i < tuning.poison.ticks + 30; i++) s = step(s, Intent.None);
  assert.ok(
    Math.abs(before - s.player.hp - tuning.poison.damage) < 0.001,
    `it took ${before - s.player.hp}, not ${tuning.poison.damage}`,
  );

  let last = at(dry, FLOOR);
  last = {
    ...last,
    player: { ...last.player, hp: BAR, poisoned: tuning.poison.ticks },
  };
  for (let i = 0; i < tuning.poison.ticks + 30; i++)
    last = step(last, Intent.None);
  assert.equal(last.player.hp, BAR, "held at one bar");
  assert.equal(last.outcome, "running");
});

test("a bee takes two bars if it lands, and dies doing it", () => {
  const x = clearFloorIn(4);
  const stinger = {
    ...bee(x + 220, FLOOR - tuning.enemies.bee.hover),
    phase: "idle" as const,
  };
  let s = at(x, FLOOR, [stinger]);
  let hit = 0;
  for (let i = 0; i < 300; i++) {
    s = step(s, Intent.None);
    hit += s.events
      .filter((e) => e.type === "playerHit")
      .reduce((n, e) => n + (e as { damage: number }).damage, 0);
  }
  assert.equal(hit, tuning.enemies.bee.damage, "two bars, once");
  assert.equal(hit / BAR, 2, "and two bars is what that number means");
  assert.equal(s.enemies[0].phase, "dead", "it does not get to ask twice");
});

test("and a blocked bee dies instead of stinging", () => {
  const x = clearFloorIn(4);
  const stinger = {
    ...bee(x + 220, FLOOR - tuning.enemies.bee.hover),
    phase: "idle" as const,
  };
  let s = at(x, FLOOR, [stinger]);
  // Blocked as it arrives, not mashed. A block costs its window plus a punish
  // tail, so pressing every other tick spends most of the fight inside the
  // lockout — which is the state the bee then flies through. That is correct
  // behaviour and a bad test.
  let held = false;
  for (let i = 0; i < 300 && s.enemies[0].phase !== "dead"; i++) {
    const it = s.enemies[0];
    const close = Math.abs(it.x - s.player.x) < 130 && it.phase === "striking";
    const press: boolean = close && !held;
    held = press;
    s = step(s, press ? Intent.Block : Intent.None);
  }
  assert.equal(s.enemies[0].phase, "dead", "the block killed it");
  assert.equal(s.player.hp, tuning.player.maxHp, "and cost nothing");
});

// ------------------------------------------------------------------ the boss

test("you can slide through it — the door is what holds you", { skip: NO_BOSS }, () => {
  // A slide passes through every body in the game, and for a long time the
  // bosses were the exception: one stood on the way out, and the whole
  // environment behind it was reachable by holding slide at the right moment
  // and never fighting at all.
  //
  // That is not this fight. The Revenant stands in a room you opened a door and
  // walked into, and the ROOM is the lock — so going through it costs nothing
  // but positioning and buys the one thing a mirror match ought to have: you
  // can get behind somebody who fights the way you do.
  const base = createInitialState(60 * 60 * 20);
  let s: SimState = {
    ...base,
    entered: true,
    deepestX: hollowPost,
    player: { ...base.player, x: hollowPost - 240, y: FLOOR, facing: 1 },
    enemies: base.enemies.filter((e) => e.kind === "enemy.revenant"),
  };
  assert.equal(s.enemies.length, 1, "the fixture has the boss in it");

  let through = false;
  for (let i = 0; i < 600 && !through; i++) {
    s = step(s, Intent.Right | (i % 40 === 0 ? Intent.Slide : Intent.None));
    if (s.player.x > s.enemies[0].x + tuning.enemies.revenant.width) {
      through = true;
    }
  }
  assert.ok(through, "a slide could not get past it");
});

test("and the room shuts behind you until it falls", { skip: NO_BOSS }, () => {
  // The one place the game breaks its own rule that retreating is always
  // available (FR-4.2). Deliberate: every other lock in the dungeon stands on
  // ground you need and can be walked away from; this is a room you chose to
  // open a door and step into, and having done that the way out is through.
  const base = createInitialState(60 * 60 * 20);
  const boss = base.enemies.find((e) => e.kind === "enemy.revenant")!;

  // Alive: standing on the near door and pressing does nothing.
  let shut: SimState = {
    ...base,
    entered: true,
    deepestX: chamber.backX,
    player: { ...base.player, x: chamber.backX, y: FLOOR },
    enemies: [boss],
  };
  shut = step(shut, Intent.None);
  shut = step(shut, Intent.Interact);
  assert.ok(inChamber(shut.player.x), "it let the player out mid-fight");
  assert.equal(
    shut.events.some((e) => e.type === "chamberLeft"),
    false,
  );

  // Down: it opens, and so does the far one.
  let open: SimState = {
    ...base,
    entered: true,
    deepestX: chamber.backX,
    player: { ...base.player, x: chamber.backX, y: FLOOR },
    enemies: [{ ...boss, hp: 0, phase: "dead" as const }],
  };
  open = step(open, Intent.None);
  open = step(open, Intent.Interact);
  assert.ok(!inChamber(open.player.x), "the way back stayed shut after it died");
});

test("everything the boss swings at, it can reach", { skip: NO_BOSS }, () => {
  // The two ranges have to be the same number, and they were not.
  //
  // `stepRevenant` decides to swing inside its OWN reach; the strike resolves
  // through a table of reaches keyed by enemy kind, and the Revenant was
  // missing from it, so it fell through to the goblin's — an arm half again
  // shorter. Every blow thrown from inside the gap between the two connected
  // with nothing. In play that is the worst kind of bug, because it looks like
  // the boss is broken rather than like the boss is missing: get close enough
  // that it stops throwing fire and it just hacks at empty air forever, never
  // taking the step that would let it land anything.
  //
  // So this walks the player in from outside the fire band to point blank and
  // asserts the pair agree at every distance: if it commits to a swing here,
  // the swing has to be able to hit.
  const base = createInitialState(60 * 60 * 20);
  const boss = base.enemies.find((e) => e.kind === "enemy.revenant")!;
  const REV = tuning.enemies.revenant;

  let swings = 0;
  let missed = 0;
  for (let gap = 20; gap <= REV.fireFrom + 40; gap += 2) {
    let s: SimState = {
      ...base,
      entered: true,
      player: { ...base.player, x: boss.x - gap, y: FLOOR },
      enemies: [{ ...boss, facing: -1 as const, phase: "idle" as const, phaseTicks: 0 }],
    };
    // One tick to decide, then run the wind-up out and see what lands.
    s = step(s, Intent.None);
    const e = s.enemies[0];
    if (e.attackKind !== "swing" || e.phase !== "telegraphing") continue;
    swings++;
    let hit = false;
    for (let i = 0; i < REV.telegraph + REV.active + 4 && !hit; i++) {
      s = step(s, Intent.None);
      hit = s.events.some((ev) => ev.type === "playerHit");
    }
    if (!hit) missed++;
  }

  assert.ok(swings > 0, "it never chose to swing at all");
  assert.equal(
    missed,
    0,
    `it committed to ${swings} swings and ${missed} of them could not reach`,
  );
});

test("its chest is sealed until it falls", { skip: NO_BOSS }, () => {
  const s = createInitialState();
  const chest = s.chests.find((c) => c.id === "chest.hollow");
  assert.ok(chest, "there is one");
  assert.equal(chest!.locked, true);
  assert.equal(chest!.lockedBy, "enemy.revenant");
});

test("the boss holds nothing you need", { skip: NO_BOSS }, () => {
  // It used to stand on the far exit and hold it shut, which made it a toll on
  // the way out. There is no far exit any more and there are ten shafts, so it
  // holds nothing — it is in a room you choose to walk into, and choosing not
  // to is always available.
  //
  // That is deliberate and it is what FR-4.2 asks for: retreating has to be a
  // decision you can always make, so a boss is never a trap.
  const base = createInitialState(60 * 60 * 20);
  const boss = base.enemies.find((e) => e.kind === "enemy.revenant")!;
  const shaft = escapes[escapes.length - 1];
  let s: SimState = {
    ...base,
    entered: true,
    deepestX: shaft,
    player: { ...base.player, x: shaft, y: FLOOR },
    enemies: [boss],
  };
  s = step(s, Intent.None);
  s = step(s, Intent.Interact);
  assert.equal(s.outcome, "extracted", "the shaft works with the boss alive");
});

test("its chest is sealed until it falls", { skip: NO_BOSS }, () => {
  const base = createInitialState(60 * 60 * 20);
  const chest = base.chests.find((c) => c.id === "chest.hollow");
  assert.ok(chest, "the boss has a chest");
  assert.equal(chest.locked, true, "and it starts shut");
  assert.equal(chest.lockedBy, "enemy.revenant");
  assert.ok(inChamber(chest.x), "in the chamber with it");

  // Alive: shut. Standing right on it and pressing does nothing.
  let s: SimState = {
    ...base,
    entered: true,
    deepestX: chest.x,
    player: { ...base.player, x: chest.x, y: chest.y },
    enemies: base.enemies.filter((e) => e.kind === "enemy.revenant"),
  };
  s = step(s, Intent.Interact);
  assert.equal(
    s.chests.find((c) => c.id === "chest.hollow")?.opened,
    false,
    "it opened with the boss standing over it",
  );

  // Down: open.
  let after: SimState = {
    ...base,
    entered: true,
    deepestX: chest.x,
    player: { ...base.player, x: chest.x, y: chest.y },
    enemies: base.enemies
      .filter((e) => e.kind === "enemy.revenant")
      .map((e) => ({ ...e, hp: 0, phase: "dead" as const })),
  };
  after = step(after, Intent.None);
  after = step(after, Intent.Interact);
  assert.equal(
    after.chests.find((c) => c.id === "chest.hollow")?.opened,
    true,
    "and stayed shut after it fell",
  );
});

test("the world still stops at the far wall", () => {
  let s = at(builtEnd - 500, FLOOR);
  for (let i = 0; i < 400; i++) s = step(s, Intent.Right);
  assert.ok(s.player.x <= builtEnd, "the wall holds");
  assert.ok(s.player.y <= FLOOR + 400, "and the ground does not run out");
});

// ------------------------------------------------------------------ breath

test("five bubbles, one a second, and then the water takes it out of you", () => {
  // The water's second clock. The tank is the run's and it is abstract; this is
  // the room's, it is five seconds long, and it is drawn over the player's head.
  const { w, x: mid } = openWater();
  const per = tuning.swim.bubbleTicks;
  let s = at(mid, w.surface + 150);

  // Down there, it runs out at one bubble a second.
  const full = s.player.breath;
  assert.equal(full, tuning.swim.bubbles * per, "it starts full");
  for (let i = 0; i < per * tuning.swim.bubbles; i++) s = step(s, Intent.None);
  assert.ok(
    s.player.breath <= 0,
    `still ${s.player.breath} left after five seconds`,
  );

  // And then it bites — steadily, so surfacing late is survivable and staying
  // is not.
  const before = s.player.hp;
  for (let i = 0; i < 60; i++) s = step(s, Intent.None);
  const lost = before - s.player.hp;
  assert.ok(lost > 0, "drowning has to actually hurt");
  assert.ok(
    s.events.some((e) => e.type === "drowning"),
    "and say so, every tick it is happening",
  );
  // A bar every two seconds — enough to run from, and enough to punish not
  // running. Checked as a range so retuning the number does not silently make
  // it either a scratch or a guillotine.
  const bars = lost / BAR;
  assert.ok(bars > 0.3 && bars < 1.2, `${bars.toFixed(2)} bars a second`);
});

test("it takes the last bar, unlike the burn and the poison", () => {
  // Those two floor at one bar because there is no answer to them but waiting.
  // This one has an answer — up — and it is one button, with five seconds of
  // warning. A drowning that cannot kill you is not a reason to surface.
  const { w, x: mid } = openWater();
  let s = at(mid, w.surface + 150);
  s = { ...s, player: { ...s.player, hp: BAR * 0.6 } };
  for (
    let i = 0;
    i < tuning.swim.bubbleTicks * tuning.swim.bubbles + 200;
    i++
  ) {
    s = step(s, Intent.None);
  }
  assert.equal(s.player.hp, 0, "the water finishes the job");
});

test("surfacing refills it, and floating does not sink you", () => {
  const { w, x: mid } = openWater();
  let s = at(mid, w.surface + 150);
  for (let i = 0; i < tuning.swim.bubbleTicks * 3; i++)
    s = step(s, Intent.None);
  const spent = s.player.breath;

  // Up to the top and hold there. Nothing held vertically: floating at the
  // surface has to be a stable place to be, or swimming forward across the sea
  // quietly drowns you for holding one direction.
  for (let i = 0; i < 120; i++) s = step(s, Intent.Jump);
  for (let i = 0; i < 90; i++) s = step(s, Intent.Right);
  assert.ok(s.player.breath > spent, "a gulp of air is a gulp of air");
  assert.ok(
    !submerged(s.player.x, s.player.y, tuning.player.height),
    "and swimming along the top keeps your head out of it",
  );
});

test("a shark holds its lane, and turns rather than following the bed", () => {
  // It used to be clamped into its water body every tick, and the seabed
  // slopes — so it rose to meet a player above it and dropped away below one.
  // What that read as was a thing that hunts in two dimensions, in the one
  // place where you are slow in both.
  const shark = createInitialState(600, { seed: 3 }).enemies.find(
    (e) => e.kind === "enemy.shark",
  );
  assert.ok(shark, "there are sharks in the sea");

  const base = createInitialState(60 * 60 * 10);
  let s: SimState = {
    ...base,
    entered: true,
    // Right on top of it, so it is awake and driving the whole time.
    player: { ...base.player, x: shark.x + 200, y: shark.y },
    enemies: [{ ...shark, phase: "approaching" }],
  };
  const lane = shark.y;
  for (let i = 0; i < 400; i++) {
    s = step(s, i % 120 < 60 ? Intent.Right : Intent.Left);
    assert.equal(s.enemies[0].y, lane, `it left its lane on tick ${i}`);
  }
});

test("the environments run parkour, poison, water, rock, fire", () => {
  // The order is a difficulty ramp and it is the player's, not the build's:
  // nothing in the parkour fights back, so it goes first; the fire is the
  // hardest thing here, so it goes last.
  //
  // Asserted as a list rather than left implicit, because everything that used
  // to hardcode "environment 2 is the fire" now asks `themeAt` instead — and a
  // silent reorder would move every monster, every hazard and every roof height
  // without a single test noticing.
  assert.deepEqual([...THEMES], ["parkour", "poison", "water", "rock", "fire"]);
  for (const [i, theme] of THEMES.entries()) {
    assert.equal(themeAt(environmentStart(i) + 100), theme);
    assert.equal(themeAt(environmentStart(i + 1) - 100), theme);
  }
});

test("the beach comes before the sea, and both are the water", () => {
  // "A beach that becomes an ocean" — so the dry part and the wet part are the
  // same environment, and the shore is a place inside it rather than its edge.
  assert.equal(themeAt(themeStart("water") + 100), "water");
  assert.ok(shoreX() > themeStart("water"), "there is dry beach to arrive on");
  assert.ok(shoreX() < themeEnd("water") - 2000, "and far more sea than beach");

  // Nothing wet before the shore except the tide pools, which are ankle deep.
  for (const w of terrain.water) {
    if (w.x1 > shoreX()) continue;
    if (w.x0 < themeStart("water")) continue;
    assert.ok(
      w.floor - w.surface < 80,
      `a ${Math.round(w.floor - w.surface)}-deep pool on the dry beach`,
    );
  }
});

test("bees live in the poison and nowhere else", () => {
  // Their span used to run to the end of the WORLD, which was very nearly right
  // while the poison was the last environment and completely wrong the moment
  // it became the second — twelve bees were being spread across the water, the
  // rock and the fire, three places whose identity is that they have none.
  for (let seed = 1; seed <= 40; seed++) {
    for (const e of createInitialState(600, { seed }).enemies) {
      if (e.kind !== "enemy.bee") continue;
      assert.equal(themeAt(e.x), "poison", `a bee at ${Math.round(e.x)}`);
    }
  }
  // And there are some, which is the other half: a rule that excludes them
  // everywhere passes this trivially.
  const hive = createInitialState(600, { seed: 1 }).enemies.filter(
    (e) => e.kind === "enemy.bee",
  );
  assert.ok(hive.length >= 6, `only ${hive.length} bees in the whole poison`);
});

test("the water's lever can be flicked from the water", () => {
  // Levers need `onGround` so they cannot be hit out of a jump — flicking one
  // is a deliberate act. But the water's lever sits on the seabed, and down
  // there you are never grounded, so that rule made one of the four shortcuts
  // in the game impossible to open.
  const wet = shortcuts.find((s) => themeAt(s.leverX) === "water");
  assert.ok(wet, "the water has a shortcut");

  const base = createInitialState(60 * 60 * 10);
  const bed = terrain.surfaces
    .filter(
      (s) =>
        wet.leverX >= s.x0 &&
        wet.leverX <= s.x1 &&
        s.top >= tuning.room.floorY - 400,
    )
    .map((s) => s.top)
    .sort((a, b) => a - b)[0];
  let s: SimState = {
    ...base,
    entered: true,
    enemies: [],
    player: { ...base.player, x: wet.leverX, y: bed ?? tuning.room.floorY },
  };
  for (let i = 0; i < 12 && s.openShortcuts.length === 0; i++) {
    s = step(s, i % 2 === 0 ? Intent.Interact : Intent.None);
  }
  assert.deepEqual(s.openShortcuts, [wet.id], "it would not flick");
});

test("an arrow stops in the rock instead of going through it", () => {
  // Nobody noticed while archers stood on flat ground shooting along it. They
  // shoot DOWN from ledges, so a miss carried on through the floor and out of
  // the world — and a shot across a tower arrived on the far side of it, which
  // reads as being shot through a wall.
  const wall = terrain.surfaces.find(
    (s) => !s.thin && s.top < tuning.room.floorY - 120 && s.x1 - s.x0 > 40,
  );
  assert.ok(wall, "there is something solid to shoot at");

  const base = createInitialState(60 * 60 * 10);
  let s: SimState = {
    ...base,
    entered: true,
    enemies: [],
    player: { ...base.player, x: wall.x0 - 400 },
    arrows: [
      {
        id: 1,
        x: wall.x0 - 120,
        y: wall.top + 40,
        vx: 9,
        vy: 0,
        kind: "arrow",
        returned: false,
        life: 240,
      },
    ],
  };
  let struck = false;
  for (let i = 0; i < 60 && !struck; i++) {
    s = step(s, Intent.None);
    struck = s.events.some((e) => e.type === "arrowStruck");
  }
  assert.ok(struck, "it buried itself");
  assert.equal(s.arrows.length, 0, "and stopped existing");
});

test("no three chests stand in a row", () => {
  // `CHEST_APART` is a rule about PAIRS, and three chests each a hundred and
  // forty apart satisfies it completely while reading as a shelf of treasure.
  for (let seed = 1; seed <= 40; seed++) {
    const xs = createInitialState(600, { seed })
      .chests.map((c) => c.x)
      .sort((a, b) => a - b);
    for (let i = 2; i < xs.length; i++) {
      assert.ok(
        xs[i] - xs[i - 2] >= 600,
        `three chests inside ${Math.round(xs[i] - xs[i - 2])} units at ${Math.round(xs[i - 2])}`,
      );
    }
  }
});

test("every environment has a way home in the middle and at the end", () => {
  // Two per environment, and each one banks the run where you stand. Without
  // them the middle of the water was a forty-second walk from anywhere safe,
  // which is not tension — the decision to go deep had already been made and
  // the walk back was the price of having made it.
  for (const theme of THEMES) {
    const mine = escapes.filter((e) => themeAt(e) === theme);
    assert.equal(mine.length, 2, `the ${theme} has ${mine.length} shafts`);
  }

  const base = createInitialState(60 * 60 * 10);
  for (const at of escapes) {
    const ground = terrain.surfaces
      .filter(
        (s) => at >= s.x0 && at <= s.x1 && s.top >= tuning.room.floorY - 200,
      )
      .map((s) => s.top)
      .sort((a, b) => a - b)[0];
    let s: SimState = {
      ...base,
      entered: true,
      enemies: [],
      carried: { gems: [3, 0, 0, 0, 0], gold: 2, legendaries: 0 },
      player: { ...base.player, x: at, y: ground ?? tuning.room.floorY },
    };
    s = step(s, Intent.None);
    s = step(s, Intent.Interact);
    assert.equal(s.outcome, "extracted", `the shaft at ${at} does nothing`);
    // And banks what you were carrying, untaxed — same as any other exit.
    assert.equal(s.carried.gems[0], 3);
  }
});

test("a shaft is not walked into by accident", () => {
  // A way home that triggers on contact ends runs by accident, and the run it
  // ends is the good one. Standing on it does nothing at all.
  const base = createInitialState(60 * 60 * 10);
  let s: SimState = {
    ...base,
    entered: true,
    enemies: [],
    player: { ...base.player, x: escapes[0] },
  };
  for (let i = 0; i < 60; i++) s = step(s, Intent.None);
  assert.equal(s.outcome, "running", "it grabbed a passer-by");
});

// -------------------------------------------------------------- the Revenant

/** The boss, alone, at a given distance. */
function duelRevenant(gap: number): SimState {
  const base = createInitialState(60 * 60 * 30);
  const boss = base.enemies.find((e) => e.kind === "enemy.revenant")!;
  return {
    ...base,
    entered: true,
    deepestX: boss.x,
    player: { ...base.player, x: boss.x - gap, y: FLOOR, facing: 1 },
    enemies: [{ ...boss, phase: "idle" as const }],
  };
}

test("it is a person, not a monster", { skip: NO_BOSS }, () => {
  // The whole idea is that the thing at the bottom came down here with your
  // kit. A version of it that was half again your size would just be a goblin
  // in a costume — so it is your frame exactly, and it walks at your speed.
  const R = tuning.enemies.revenant;
  assert.equal(R.width, tuning.player.width);
  assert.equal(R.height, tuning.player.height);
  assert.equal(R.speed, tuning.movement.walkSpeed);
  // What makes it a boss is that it LASTS. Ten bars to your five.
  assert.ok(
    R.maxHp >= tuning.player.maxHp * 1.4,
    "a boss has to outlast you, not out-hit you",
  );
  // A bar a swing, which is what everything else that hits hard does. Stated
  // against the bar rather than against your sword: what the player counts is
  // bars, and "two of my swings" is arithmetic nobody does mid-fight.
  assert.equal(
    R.damage,
    tuning.player.maxHp / tuning.player.healthBars,
    "a swing has to cost exactly one bar",
  );
});

test(
  "it has your verbs, and a fireball where your stun is",
  { skip: NO_BOSS },
  () => {
    const boss = createInitialState().enemies.find(
      (e) => e.kind === "enemy.revenant",
    )!;
    assert.equal(boss.verbs.block, true, "it parries — that is the fight");
    assert.equal(boss.verbs.jump, true);
    assert.equal(boss.verbs.slide, true);
    assert.equal(boss.verbs.shoot, true, "and it throws fire");

    // Close it swings; far it throws. Deterministic on distance, so where you
    // stand is you choosing which of its two attacks to be tested on.
    let near = duelRevenant(40);
    for (let i = 0; i < 40 && near.enemies[0].phase === "idle"; i++) {
      near = step(near, Intent.None);
    }
    assert.equal(near.enemies[0].attackKind, "swing");

    let far = duelRevenant(400);
    for (let i = 0; i < 60 && far.enemies[0].attackKind !== "fireball"; i++) {
      far = step(far, Intent.None);
    }
    assert.equal(far.enemies[0].attackKind, "fireball", "it never threw");
  },
);

test(
  "its fireball is real, and comes back if you catch it",
  { skip: NO_BOSS },
  () => {
    let s = duelRevenant(400);
    let thrown = 0;
    for (let i = 0; i < 60 * 8; i++) {
      s = step(s, Intent.None);
      thrown += s.events.filter((e) => e.type === "arrowLoosed").length;
    }
    assert.ok(thrown > 0, "it never threw anything");
    assert.ok(s.player.hp < tuning.player.maxHp, "and the fire lands");

    // Parried, it goes home — worth a great deal and not lethal. A boss with ten
    // bars that dies to one good parry is a boss with one question.
    let caught = duelRevenant(400);
    const full = caught.enemies[0].hp;
    for (let i = 0; i < 60 * 12; i++) {
      const incoming = caught.arrows.some(
        (a) => !a.returned && Math.abs(a.x - caught.player.x) < 70,
      );
      caught = step(caught, incoming ? Intent.Block : Intent.None);
    }
    assert.ok(
      caught.enemies[0].hp < full,
      "catching its own fire has to hurt it",
    );
  },
);

test(
  "it parries about half of what you throw, and never a stun",
  { skip: NO_BOSS },
  () => {
    // Half is the number that makes attacking a gamble rather than a wall: two
    // swings in three land at least one.
    function press(stun: boolean) {
      let s = duelRevenant(50);
      let held = 0;
      let landed = 0;
      for (let i = 0; i < 60 * 40; i++) {
        const swing = i % 22 < 2;
        s = step(s, swing ? (stun ? Intent.Stun : Intent.Attack) : Intent.None);
        held += s.events.filter((e) => e.type === "guardHeld").length;
        landed += s.events.filter((e) => e.type === "enemyHit").length;
      }
      return { held, landed };
    }

    const sword = press(false);
    assert.ok(sword.held > 0, "it never guarded");
    assert.ok(sword.landed > 0, "it guarded everything");
    const caughtShare = sword.held / (sword.held + sword.landed);
    assert.ok(
      caughtShare > 0.2 && caughtShare < 0.8,
      `it caught ${(caughtShare * 100).toFixed(0)}% — that is not a coin`,
    );

    // And the guard-breaker goes through, every time. That is the answer to the
    // fight and the reason it is beatable: its guard is the wall and your stun is
    // the door, and the one verb it was not given is the one that opens it.
    const breaker = press(true);
    assert.equal(breaker.held, 0, "a stun was caught, and must never be");
    assert.ok(breaker.landed > 0, "and the stun has to land");
  },
);

test(
  "its guard costs you the swing and nothing else",
  { skip: NO_BOSS },
  () => {
    // Your parry ripostes because it pays for a 0.3s window you might miss. Its
    // guard has no window and no risk — it is a coin — so charging you damage as
    // well would be charging twice for the same coin.
    let s = duelRevenant(50);
    let caught = 0;
    let hurtWhileCaught = 0;
    for (let i = 0; i < 60 * 30; i++) {
      const before = s.player.hp;
      s = step(s, i % 22 < 2 ? Intent.Attack : Intent.None);
      const held = s.events.some((e) => e.type === "guardHeld");
      if (!held) continue;
      caught++;
      if (s.player.hp < before) hurtWhileCaught++;
    }
    assert.ok(caught > 0, "the fixture needs it to guard at least once");
    assert.equal(hurtWhileCaught, 0, "its guard hurt the player");
  },
);

test("the fight is winnable, and the stun is how", { skip: NO_BOSS }, () => {
  // A bot that only presses the guard-breaker beats it. Not because that is how
  // anybody should play, but because it proves the answer exists — a boss whose
  // guard cannot be broken is a wall with a health bar.
  let s = duelRevenant(50);
  let held = false;
  for (let i = 0; i < 60 * 90 && s.enemies[0].phase !== "dead"; i++) {
    const ready = !isBusy(s.player);
    const press: boolean = ready && !held;
    held = press;
    s = step(s, press ? Intent.Stun : Intent.None);
    // Not a damage race: the bot heals rather than dying, because what is being
    // measured is whether the guard can be broken at all.
    if (s.player.hp < tuning.player.maxHp) {
      s = { ...s, player: { ...s.player, hp: tuning.player.maxHp } };
    }
  }
  assert.equal(s.enemies[0].phase, "dead", "the stun could not finish it");
});

// --------------------------------------------------------- the drowned passage

test("the sea cannot be swum over the top of", () => {
  // The whole environment was skippable: it is a long stretch of open water
  // with a surface you can swim along the entire way, so the diving — the reef,
  // the trench, the reason any of it exists — was optional scenery. Five
  // bubbles of breath cost nothing if you never go under.
  const p = drownedPassage();
  const F = tuning.room.floorY;

  // There is no route along the waterline. Every stretch of the passage either
  // has rock at head height or is a chamber, and the chambers do not join up.
  let sealed = 0;
  for (let x = p.x0; x < p.x1; x += 40) {
    const roofed = terrain.surfaces.some(
      (s) =>
        !s.thin &&
        x >= s.x0 &&
        x <= s.x1 &&
        s.bottom > F - tuning.player.height &&
        s.top < F,
    );
    if (roofed) sealed++;
  }
  assert.ok(
    sealed > (p.x1 - p.x0) / 40 / 2,
    `only ${sealed} of the passage is roofed — it can still be swum over`,
  );
});

test("it is long, and there is air in it", () => {
  const p = drownedPassage();
  const F = tuning.room.floorY;
  assert.ok(p.x1 - p.x0 > 1200, "a short tunnel is not a passage");

  // Where the roof is clear of the waterline there is air. Grouped into
  // chambers, and there have to be several — one lungful end to end would make
  // it a wall rather than a route.
  const rooms: [number, number][] = [];
  for (let x = p.x0; x < p.x1; x += 20) {
    const w = terrain.water.find((v) => x >= v.x0 && x <= v.x1);
    if (w && w.surface > F) continue;
    const last = rooms[rooms.length - 1];
    if (last && x - last[1] <= 40) last[1] = x;
    else rooms.push([x, x]);
  }
  // Two, deliberately. This used to demand three or more, back when the
  // passage ran three thousand units and the whole environment was cave — at
  // that length the air had to be frequent or it was a wall. The passage is a
  // gate now rather than a biome, so what matters is not how many places there
  // are to breathe but that no leg between them is longer than a lungful, which
  // is the assertion below.
  assert.ok(rooms.length >= 2, `only ${rooms.length} places to breathe`);

  // And no flooded leg longer than one lungful of swimming, with room to spare
  // for reading where you are going.
  const kick = tuning.swim.kick;
  const lung = tuning.swim.bubbles * tuning.swim.bubbleTicks * kick;
  for (let i = 1; i < rooms.length; i++) {
    const leg = rooms[i][0] - rooms[i - 1][1];
    assert.ok(
      leg < lung * 0.75,
      `a ${Math.round(leg)}-unit leg against a ${Math.round(lung)}-unit lungful`,
    );
  }
});

test("nothing can shoot up through the fire shortcut", () => {
  // What the lever buys. The road is thin so it reads as a road rather than a
  // roof — you can drop off it and see the ground under it — and a thin slab
  // deliberately lets shots through from below, which is the same rule your own
  // jump plays by. The phoenixes in the fire environment fly UNDER it, so that
  // rule had them firing straight up through the deck at anyone walking it.
  //
  // A shortcut you can be shot on is not a shortcut, so this one is thin to a
  // body and solid to a fireball.
  const road = highRoad();
  assert.ok(road, "the fire environment has a high road");
  const mid = (road!.x0 + road!.x1) / 2;
  // Up through the deck from below, and down onto it from above. Both stop.
  assert.equal(
    blocksShot(mid, road!.top - 6, road!.top + 6),
    true,
    "a shot from below went up through the road",
  );
  assert.equal(
    blocksShot(mid, road!.top + 6, road!.top - 6),
    true,
    "a shot from above went down through the road",
  );
});

test("the rock cannot be swum over, only under", () => {
  // The requirement the passage exists to serve. The sea was skippable — open
  // water with a surface you could swim the whole length of, which made every
  // dive optional and the breath meter decorative — and the fix is one rock too
  // tall to get over rather than a biome of ceiling.
  //
  // So: a swimmer who holds Right and Jump, which is the exact input that used
  // to cross the entire environment, has to STOP at it. If this ever passes by
  // accident the diving is optional again and nothing else in the water
  // environment matters.
  const p = drownedPassage();
  const base = createInitialState(60 * 60 * 20);
  let s: SimState = {
    ...base,
    entered: true,
    enemies: [],
    player: { ...base.player, x: p.x0 - 700, y: FLOOR },
  };
  for (let i = 0; i < 60 * 30; i++) s = step(s, Intent.Right | Intent.Jump);
  assert.ok(
    s.player.x < p.x0,
    `swam over the rock to ${Math.round(s.player.x)}; it starts at ${Math.round(p.x0)}`,
  );
});

test("and it can be crossed on one set of lungs at a time", () => {
  // The measurement that matters: a diver who swims east and uses the cenotes
  // gets through alive. If this fails the environment has a wall in the middle
  // of it rather than a passage.
  //
  // The bot rises only INSIDE a shaft and dives straight back out once it is
  // full, because that is the system's actual rhythm — the roof is solid
  // everywhere else, so swimming up between shafts is swimming into rock, and a
  // bot that surfaces whenever it feels short of air just grinds along the
  // ceiling until it drowns.
  const p = drownedPassage();
  const shafts = cenoteShafts();
  const lung = tuning.swim.bubbles * tuning.swim.bubbleTicks;
  const base = createInitialState(60 * 60 * 20);
  let s: SimState = {
    ...base,
    entered: true,
    enemies: [],
    player: { ...base.player, x: p.x0 - 420, y: FLOOR },
  };
  let drowned = 0;
  let lowest = lung;
  for (let i = 0; i < 60 * 120 && s.player.x < p.x1 + 200; i++) {
    // Approach on the surface, dive at the rock. The open sea either side of
    // the passage is sea again — reef, trench, shelves — and a bot that dives
    // the moment it has air spends the approach dragging along the bottom of
    // it and arrives at the mouth with nothing left, which measures the reef
    // rather than the passage.
    const approaching = s.player.x < p.x0 - 220;
    const full = s.player.breath >= lung;
    const underShaft = shafts.some((c) => Math.abs(c - s.player.x) < 130);
    const gasping = s.player.breath < tuning.swim.bubbleTicks * 1.5;
    const up = approaching || (!full && underShaft) || gasping;
    s = step(s, Intent.Right | (up ? Intent.Jump : Intent.Crouch));
    lowest = Math.min(lowest, s.player.breath);
    drowned += s.events.filter((e) => e.type === "drowning").length;
  }
  assert.ok(
    s.player.x >= p.x1 + 200,
    `stopped at ${Math.round(s.player.x)}, passage ends at ${Math.round(p.x1)}`,
  );
  assert.equal(s.outcome, "running", "it drowned on the way through");
  assert.equal(
    drowned,
    0,
    `and it should not even have started drowning (lowest breath ${lowest})`,
  );
});
