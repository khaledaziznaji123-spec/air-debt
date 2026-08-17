/**
 * What the shop actually sells.
 *
 * Eleven of the twelve items were priced long before anything honoured them,
 * so the risk here is not that an effect is wrong — it is that an effect is
 * MISSING and the shelf goes on quietly taking gems for nothing. The first test
 * is the one that matters: every live item has to do something.
 *
 * The other theme is determinism. A loadout changes damage, reach and health,
 * so it has to travel inside `SimState` — a run replayed without it would
 * produce a different fight from the same seed and the same inputs.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createInitialState,
  EMPTY_LOADOUT,
  potionsFor,
  statsFor,
  step,
  Intent,
  SHOP,
  priceOf,
  type Loadout,
  type SimState,
} from "./index.ts";
import { environmentAt } from "../config/dungeon.ts";
import { tuning } from "../config/tuning.ts";
import { terrain } from "../config/terrain.ts";

const FLOOR: number = tuning.room.floorY;

function withItems(...ids: string[]): Loadout {
  return {
    ...EMPTY_LOADOUT,
    levels: Object.fromEntries(ids.map((id) => [id, 1])),
  };
}

/** A specific level of one thing, for the ladder tests. */
function atLevel(id: string, level: number): Loadout {
  return { ...EMPTY_LOADOUT, levels: { [id]: level } };
}

/** Mid-run, inside the dungeon, nothing hunting, with a given loadout. */
function inside(loadout: Loadout, x = 2000): SimState {
  const base = createInitialState(60 * 60 * 10, { loadout });
  return {
    ...base,
    entered: true,
    deepestX: x,
    player: { ...base.player, x, y: FLOOR },
    enemies: [],
  };
}

test("every live item does something", () => {
  // The whole point of the pass. A priced shelf with no effect behind it is a
  // button that takes gems and returns nothing, which is worse than an empty
  // shelf because it looks like it worked.
  for (const item of SHOP) {
    if (!item.live) continue;
    const does =
      item.effect !== undefined ||
      item.potion !== undefined ||
      item.skin !== undefined ||
      item.pet !== undefined ||
      item.id === "gear.tank"; // the tank is spent as starting air
    assert.ok(does, `${item.id} is on sale and does nothing`);
  }
});

test("nothing is on sale that cannot be bought", () => {
  // The other direction. Everything is live now, so a `live: false` left behind
  // would be a shelf item silently unreachable.
  const dead = SHOP.filter((i) => !i.live).map((i) => i.id);
  assert.deepEqual(dead, [], `still not wired up: ${dead.join(", ")}`);
});

test("an empty loadout is exactly the tuning table", () => {
  const s = statsFor(EMPTY_LOADOUT);
  assert.equal(s.attackDamage, tuning.player.attackDamage);
  assert.equal(s.attackReach, tuning.player.attackReach);
  assert.equal(s.riposteDamage, tuning.parry.riposteDamage);
  assert.equal(s.healthBars, tuning.player.healthBars);
  assert.equal(s.maxHp, tuning.player.maxHp);
  assert.equal(s.wallSlideSpeed, tuning.movement.wallSlideSpeed);
});

test("the honed edge climbs to a one-swing goblin kill", () => {
  // It is a ladder now, so the claim on the card is about the TOP of it: one
  // level is a nudge, three is a goblin that dies to a single swing.
  const one = statsFor(atLevel("weapon.honed", 1)).attackDamage;
  const three = statsFor(atLevel("weapon.honed", 3)).attackDamage;
  const bare = statsFor(EMPTY_LOADOUT).attackDamage;

  assert.ok(one > bare, "the first level does something");
  assert.ok(three > one, "and the third does more");
  assert.ok(
    three >= tuning.enemies.goblin.maxHp,
    `maxed at ${three} against a goblin's ${tuning.enemies.goblin.maxHp}`,
  );
  assert.ok(
    bare < tuning.enemies.goblin.maxHp,
    "and it takes two without it, or the item is selling nothing",
  );
});

test("and it does it in play, not just in arithmetic", () => {
  function killTicks(loadout: Loadout) {
    const base = createInitialState(60 * 60 * 10, { loadout });
    const goblin = base.enemies.find((e) => e.kind === "enemy.goblin")!;
    let s: SimState = {
      ...base,
      entered: true,
      deepestX: goblin.x,
      player: { ...base.player, x: goblin.x - 34, y: goblin.y, facing: 1 },
      enemies: [
        {
          ...goblin,
          phase: "idle",
          verbs: { ...goblin.verbs, move: false, attack: false },
        },
      ],
    };
    for (let i = 0; i < 400; i++) {
      s = step(s, i % 30 < 6 ? Intent.Attack : Intent.None);
      if (s.enemies[0].phase === "dead") return i;
    }
    return Infinity;
  }
  const bare = killTicks(EMPTY_LOADOUT);
  const maxed = killTicks(atLevel("weapon.honed", 3));
  assert.ok(maxed < bare, `${maxed} ticks against ${bare}`);
});

test("the longer blade climbs out of a goblin's range", () => {
  const bare = statsFor(EMPTY_LOADOUT).attackReach;
  const one = statsFor(atLevel("weapon.long", 1)).attackReach;
  const three = statsFor(atLevel("weapon.long", 3)).attackReach;
  assert.ok(one > bare && three > one, "every level is longer");
  assert.ok(
    three > tuning.enemies.goblin.reach + 40,
    `maxed at ${three} against a goblin's ${tuning.enemies.goblin.reach}`,
  );
});

test("the riposte plate climbs to a parry that kills", () => {
  const bare = statsFor(EMPTY_LOADOUT).riposteDamage;
  const three = statsFor(atLevel("weapon.counter", 3)).riposteDamage;
  assert.ok(three > bare * 2, "meaningfully more, not a rounding error");
  assert.ok(
    three >= tuning.enemies.archer.maxHp,
    "a read now kills the thing that was reading you",
  );
});

test("every ladder actually climbs, and stops", () => {
  // The property that makes an upgrade an upgrade. Written over the whole
  // catalogue rather than per item, so a new one cannot be added with a flat
  // effect and go unnoticed.
  for (const item of SHOP) {
    const tiers = item.tiers ?? 1;
    if (tiers < 2 || !item.effect) continue;

    const low = statsFor(atLevel(item.id, 1));
    const high = statsFor(atLevel(item.id, tiers));
    assert.notDeepEqual(
      low,
      high,
      `${item.id} has ${tiers} levels that all do the same thing`,
    );

    // And the price ladder: every level costs more, and the top is the top.
    let last = 0;
    for (let n = 0; n < tiers; n++) {
      const cost = priceOf(item, n);
      assert.ok(cost, `${item.id} level ${n + 1} has no price`);
      const total = cost.gems.reduce((a, b) => a + b, 0) + cost.gold;
      assert.ok(
        total >= last,
        `${item.id} level ${n + 1} is cheaper than level ${n}`,
      );
      last = total;
    }
    assert.equal(
      priceOf(item, tiers),
      null,
      `${item.id} can be bought past its last level`,
    );
  }
});

test("the rib plate adds a whole bar and leaves the bar size alone", () => {
  // The reason `healthBars` is the stat rather than `maxHp`: everything that
  // hurts is priced in bars, so stretching the bar would silently reprice the
  // entire game.
  const bare = statsFor(EMPTY_LOADOUT);
  const armed = statsFor(withItems("gear.plate"));
  assert.equal(armed.healthBars, bare.healthBars + 1);
  assert.equal(armed.perBar, bare.perBar, "a bar is still a bar");
  assert.equal(armed.maxHp, bare.maxHp + bare.perBar);
  // And the run actually starts on it.
  assert.equal(
    createInitialState(600, { loadout: withItems("gear.plate") }).player.hp,
    armed.maxHp,
  );
});

test("gripped boots slow the wall slide, then stop it", () => {
  const bare = statsFor(EMPTY_LOADOUT).wallSlideSpeed;
  const one = statsFor(atLevel("gear.boots", 1)).wallSlideSpeed;
  const two = statsFor(atLevel("gear.boots", 2)).wallSlideSpeed;
  assert.ok(one < bare && one > 0, `level 1 slows it to ${one}`);
  assert.equal(two, 0, "and level 2 stops it dead, as the card says");

  // Played, not just derived. Against the tower at 4220 rather than a pit
  // wall: falling into a pit now throws you straight back out of it, so a pit
  // is the one place a wall slide cannot be measured.
  /**
   * A wall to kick off, found rather than remembered.
   *
   * This was the number 4220 for a long time, which was the face of a tower in
   * environment 1 — until the environment gained a second shortcut, the pieces
   * shifted, and the number pointed at open air. A wall is a tall solid thing
   * with floor in front of it, and that is a thing the terrain can be asked.
   */
  const TOWER_FACE = (() => {
    for (const s of terrain.surfaces) {
      if (s.thin) continue;
      // Tall enough to still be a wall at head height, and in the rock — the
      // environment these tests are written about.
      if (s.top > tuning.room.floorY - 170) continue;
      if (s.bottom < tuning.room.floorY) continue;
      // Any environment. It used to insist on the rock, which is where the
      // wall jump was first built — but the parkour is now made almost entirely
      // of walls, and that is a better place to test one.
      void environmentAt;
      if (s.x1 - s.x0 < 24) continue;
      const floorAt = (x: number) =>
        terrain.surfaces.some(
          (f) =>
            x >= f.x0 && x <= f.x1 && Math.abs(f.top - tuning.room.floorY) < 1,
        );
      // Either face will do, so long as there is somewhere to stand beside it.
      if (floorAt(s.x0 - 60)) return s.x0;
    }
    throw new Error("no wall to kick off anywhere");
  })();
  const wall = TOWER_FACE - tuning.player.width / 2 - 1;
  function fallTo(loadout: Loadout) {
    let s = inside(loadout, wall);
    s = { ...s, player: { ...s.player, y: 300, vy: 1, stance: "airborne" } };
    for (let i = 0; i < 40; i++) s = step(s, Intent.Right);
    return s.player.y;
  }
  const slid = fallTo(EMPTY_LOADOUT);
  const gripped = fallTo(atLevel("gear.boots", 2));
  assert.ok(
    gripped < slid,
    `held at ${gripped.toFixed(0)}, slid to ${slid.toFixed(0)}`,
  );
});

test("potions are carried, one of each owned", () => {
  assert.deepEqual(potionsFor(EMPTY_LOADOUT), []);
  const all = withItems("potion.restoration", "potion.breath", "potion.ward");
  assert.deepEqual(potionsFor(all).sort(), ["breath", "restoration", "ward"]);
  assert.deepEqual(
    createInitialState(600, { loadout: all }).potions.slice().sort(),
    ["breath", "restoration", "ward"],
  );
});

test("restoration heals to full, once", () => {
  let s = inside(withItems("potion.restoration"));
  const full = s.player.hp;
  s = { ...s, player: { ...s.player, hp: 10 } };

  s = step(s, Intent.Restoration);
  assert.equal(s.player.hp, full, "back to full");
  assert.deepEqual(s.potions, [], "and it is gone");
  assert.ok(s.events.some((e) => e.type === "potionUsed"));

  // A second press does nothing at all.
  s = { ...s, player: { ...s.player, hp: 10 } };
  s = step(s, Intent.None);
  s = step(s, Intent.Restoration);
  assert.equal(s.player.hp, 10, "there is no second one");
});

test("a second breath buys time on the clock and on the dial", () => {
  let s = inside(withItems("potion.breath"));
  s = { ...s, air: 120, airCapacity: 600 };
  const before = s.air;

  s = step(s, Intent.Breath);
  assert.ok(
    s.air > before,
    `air went from ${before} to ${s.air} — the whole item is that it goes up`,
  );
  assert.equal(
    s.airCapacity,
    600 + tuning.air.breathTicks,
    "the capacity moves with it, or the dial sweeps past a full revolution",
  );
  assert.deepEqual(s.potions, []);
});

test("the spike ward spends itself on a trap, and only once", () => {
  // A pressure plate, not the standing spikes. Spikes are deliberately NOT a
  // trap — no tell, no floor, they just bleed you — and the ward is about the
  // thing that takes a run to its last bar in one go.
  const plate = terrain.traps[0];
  assert.ok(plate, "the environment has a trap to stand on");

  function standOnIt(loadout: Loadout) {
    let s = inside(loadout, plate.x);
    s = { ...s, player: { ...s.player, y: plate.top } };
    // Long enough for the plate to arm, tell, and fire.
    for (
      let i = 0;
      i < tuning.traps.reset + tuning.traps.tellLeadTime + 40;
      i++
    ) {
      s = step(s, Intent.None);
    }
    return s;
  }

  const bare = standOnIt(EMPTY_LOADOUT);
  const warded = standOnIt(withItems("potion.ward"));
  const perBar = tuning.player.maxHp / tuning.player.healthBars;

  assert.ok(
    bare.player.hp <= perBar + 0.001,
    `an unwarded trap takes you to the last bar — got ${bare.player.hp}`,
  );
  assert.ok(
    warded.player.hp > bare.player.hp,
    `warded ${warded.player.hp} against bare ${bare.player.hp}`,
  );
  assert.deepEqual(warded.potions, [], "and it was spent doing it");
  assert.ok(
    warded.events.length >= 0 && warded.player.hp < tuning.player.maxHp,
    "it stops the floor, not the hit — a free trap would beat reading the tell",
  );
});

test("a cosmetic changes nothing the simulation can see", () => {
  // The promise on the shelf — "no advantage, that is the point" — as a test.
  // Armour and pets both: a pet is drawn entirely by the view and the reducer
  // does not know it exists, but owning one still must not move a number.
  const plain = statsFor(EMPTY_LOADOUT);
  for (const item of SHOP) {
    if (!item.skin && !item.pet) continue;
    assert.deepEqual(
      statsFor(withItems(item.id)),
      plain,
      `${item.id} is not free`,
    );
    assert.deepEqual(potionsFor(withItems(item.id)), []);
  }
});

test("the loadout travels with the run, so a replay reproduces the fight", () => {
  const loadout = withItems("weapon.honed", "gear.plate");
  let s = createInitialState(600, { loadout });
  assert.deepEqual(s.loadout, loadout);
  for (let i = 0; i < 120; i++) s = step(s, Intent.Right);
  assert.deepEqual(s.loadout, loadout, "and the reducer never drops it");
});

test("two items touching the same stat add up", () => {
  // Deltas, not overrides. If they overwrote, the second one bought would
  // silently cancel the first and the player would never be told.
  const both = statsFor({
    ...EMPTY_LOADOUT,
    levels: { "weapon.honed": 1, "weapon.long": 1 },
  });
  const honed = statsFor(withItems("weapon.honed"));
  const long = statsFor(withItems("weapon.long"));
  const bare = statsFor(EMPTY_LOADOUT);
  assert.equal(both.attackDamage, honed.attackDamage);
  assert.equal(both.attackReach, long.attackReach);
  assert.ok(
    both.attackDamage > bare.attackDamage &&
      both.attackReach > bare.attackReach,
  );
});
