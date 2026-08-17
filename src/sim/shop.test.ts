/**
 * The shop's pricing rule.
 *
 * PRD FR-13.2a/13.2b is the anti-pay-to-win guarantee, and it is the one thing
 * on this screen that a player would attack first: if gold can quietly stand in
 * for gems, then grinding the shallow ground buys everything and depth — which
 * the entire loot table is built to reward — stops mattering.
 *
 * So the rule is asserted rather than eyeballed: gold covers a shortfall only
 * once 70% of the required gems are already held, AT THAT GRADE.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CATEGORIES,
  SHOP,
  afford,
  pay,
  priceOf,
  statsFor,
  type Price,
  type Purse,
} from "../config/shop.ts";
import { tuning } from "../config/tuning.ts";

const GRADES = tuning.loot.grades;

function purse(gems: number[], gold: number): Purse {
  const g = new Array(GRADES).fill(0);
  gems.forEach((n, i) => (g[i] = n));
  return { gems: g, gold };
}

function price(gems: number[], gold = 0): Price {
  const g = new Array(GRADES).fill(0);
  gems.forEach((n, i) => (g[i] = n));
  return { gems: g, gold };
}

test("the catalogue covers all four shelves and nothing is free", () => {
  for (const c of CATEGORIES) {
    const stock = SHOP.filter((i) => i.category === c.key);
    assert.ok(stock.length >= 3, `${c.key} has ${stock.length} items`);
  }
  for (const item of SHOP) {
    const total = item.price.gems.reduce((a, b) => a + b, 0) + item.price.gold;
    // One item has no price and must not have one: it is earned off the boss.
    // Asserted as "exactly one", so a second free thing cannot appear by
    // somebody forgetting to fill in a price.
    if (item.earned !== undefined) {
      assert.equal(total, 0, `${item.id} is earned and still has a price`);
      continue;
    }
    assert.ok(total > 0, `${item.id} costs nothing`);
    assert.equal(
      item.price.gems.length,
      GRADES,
      `${item.id} prices a number of grades the game does not have`,
    );
  }
});

test("gems alone buy a thing, and spending it takes them", () => {
  const p = price([10]);
  const before = purse([10], 0);
  assert.equal(afford(p, before).affordable, true);

  const after = pay(p, before);
  assert.ok(after);
  assert.equal(after.gems[0], 0, "the gems are gone");
  assert.equal(after.gold, 0, "and no gold was touched");
});

test("gold cannot buy what gems have not nearly paid for (FR-13.2a)", () => {
  // The attack: a mountain of gold and almost none of the right stones.
  const p = price([10]);
  const rich = purse([2], 100000);
  const check = afford(p, rich);

  assert.equal(check.affordable, false, "money must not be a second route");
  assert.equal(check.blockedByThreshold, true, "and it must say why");
  assert.equal(pay(p, rich), null, "and the purse must be untouched");
});

test("but it covers the last stretch once the gems are nearly there", () => {
  // FR-13.2b: at or above 70%, gold is allowed to close the gap. This is the
  // boundary itself — 7 of 10 is exactly the line, and it must be inside it.
  const p = price([10]);
  const nearly = afford(p, purse([7], 100000));
  assert.equal(nearly.blockedByThreshold, false, "70% is on the right side");
  assert.equal(nearly.affordable, true);
  assert.ok(nearly.goldForGems > 0, "and it costs gold to do");

  const under = afford(p, purse([6], 100000));
  assert.equal(under.blockedByThreshold, true, "60% is not");
});

test("the threshold is per grade, not on the total", () => {
  // The substitution the rule exists to prevent: a heap of grade-1 emeralds
  // satisfying a grade-3 price because the totals happen to add up.
  const p = price([0, 0, 10]);
  const wrongStones = purse([500, 500, 0], 100000);

  assert.equal(
    afford(p, wrongStones).blockedByThreshold,
    true,
    "shallow gems must not stand in for deep ones, however many there are",
  );
});

test("a shortfall is paid for in gold, and the gold actually leaves", () => {
  const p = price([10]);
  const before = purse([8], 500);
  const check = afford(p, before);
  const after = pay(p, before);

  assert.ok(after);
  assert.equal(after.gems[0], 0, "every gem held towards it is spent");
  assert.equal(
    after.gold,
    500 - check.goldForGems,
    "and the gold that covered the rest",
  );
});

test("deep gems cost more gold to substitute than shallow ones", () => {
  // Otherwise the threshold is the only thing holding the line, and a player
  // one gem short of a grade-5 pays the same as one short of a grade-1.
  const shallow = afford(price([10]), purse([9], 100000)).goldForGems;
  const deep = afford(
    price([0, 0, 0, 0, 10]),
    purse([0, 0, 0, 0, 9], 100000),
  ).goldForGems;
  assert.ok(deep > shallow * 4, `${deep} against ${shallow}`);
});

test("an empty purse buys nothing at all", () => {
  const broke = purse([], 0);
  for (const item of SHOP) {
    // Except the one that was never for sale. It has no price because a price
    // would say "this is worth eleven diamonds", and what it is actually worth
    // is that you went down there and beat the thing wearing it — so it is
    // gated on `beaten` rather than on the purse, and `afford` never sees it.
    if (item.earned !== undefined) continue;
    assert.equal(
      afford(item.price, broke).affordable,
      false,
      `${item.id} was free to someone with nothing`,
    );
  }
});

test("the air tank is priced inside two runs, and stays buyable to the top", () => {
  // It is the first thing anybody will try to buy, and priced past a session it
  // reads as a wall rather than a goal.
  //
  // TWO runs, not one. The tank's first tier is thirty-two now, against roughly
  // seventeen from the chests a thirty-second tank can reach and come back
  // from — measured, not assumed: the first twenty-five hundred units of the
  // parkour hold about nineteen emeralds across three and a half chests.
  //
  // Two is the right number for the thing the whole economy is pointed at. One
  // makes the first upgrade automatic and removes the only decision a new
  // player has; three would make it a grind before they have learned anything.
  const tank = SHOP.find((i) => i.id === "gear.tank");
  assert.ok(tank, "the tank is on the shelf");
  assert.equal(tank.live, true, "and it is the one that works");
  assert.equal(
    tank.tiers,
    tuning.air.upgradeTiers,
    "FR-19.3 — ten and no more",
  );

  const chestsPerRun = tuning.loot.chestBase;
  // The average chest, weighted by the odds. Legendary pays gold, not stones,
  // so it contributes nothing to a gem price.
  const o = tuning.loot.chestOdds;
  const mid = ([a, b]: readonly [number, number]) => (a + b) / 2;
  const gemsPerChest =
    o.trash * mid(tuning.loot.chestGems.trash) +
    o.normal * mid(tuning.loot.chestGems.normal) +
    o.better * mid(tuning.loot.chestGems.better);
  const oneGoodRun = chestsPerRun * gemsPerChest;
  assert.ok(
    tank.price.gems[0] <= oneGoodRun * 2,
    `${tank.price.gems[0]} against roughly ${oneGoodRun} a run brings back`,
  );

  // And the top of the ladder must still be reachable. Every other ladder in
  // the shop asks for the fire at its last level; the tank asks for very little
  // and only from the seventh, because the tank is the one thing a player has
  // to be able to keep buying — gate it hard and the answer to "I cannot get
  // deep enough" becomes "you cannot get deep enough".
  const top = priceOf(tank, (tank.tiers ?? 1) - 1)!;
  assert.ok(tank.deep, "the tank asks for deep stones at the top");
  assert.ok(tank.deep.from >= 6, "and not before the seventh tier");
  assert.ok(
    top.gems[4] <= 10,
    `${top.gems[4]} diamonds for the last tank is a wall`,
  );
});

test("every ladder asks for the deep stones to finish it", () => {
  // The last level of anything is endgame, and it should cost what the endgame
  // holds. Before this, every ladder in the shop was payable start to finish
  // with the stones of the first two environments — `priceOf` scales the
  // level-one price uniformly, so a grade that starts at zero stays at zero
  // however high the ladder climbs.
  for (const item of SHOP) {
    const tiers = item.tiers ?? 1;
    if (tiers < 2) continue;
    const top = priceOf(item, tiers - 1)!;
    assert.ok(
      top.gems[3] > 0 && top.gems[4] > 0,
      `${item.id} tops out without ever asking for the fire`,
    );
    // And the FIRST level must not. A ladder whose bottom rung needs the last
    // environment is not a ladder.
    const first = priceOf(item, 0)!;
    assert.equal(first.gems[4] ?? 0, 0, `${item.id} needs diamonds to start`);
  }
});

// -------------------------------------------------------- the legendaries

test("the legendary plate halves everything that hits you, and stops there", () => {
  const bare = statsFor({ levels: {}, skin: null, pet: null });
  const plated = statsFor({
    levels: { "gear.aegis": 1 },
    skin: null,
    pet: null,
  });
  assert.equal(bare.damageScale, 1);
  assert.equal(plated.damageScale, 0.5);

  // One tier, and it has to stay one tier. Two of these multiply to a quarter
  // and three to an eighth, and at an eighth the health bar has stopped being
  // something the player plays around.
  const aegis = SHOP.find((i) => i.id === "gear.aegis")!;
  assert.equal(aegis.tiers ?? 1, 1, "the plate must not be a ladder");

  // And nothing stacks its way to immunity, whatever else is bought.
  const everything = statsFor({
    levels: Object.fromEntries(SHOP.map((i) => [i.id, i.tiers ?? 1])),
    skin: null,
    pet: null,
  });
  assert.ok(everything.damageScale >= 0.3, "nothing buys immunity");
});

test("the legendary blade lifts every attack, not one of them", () => {
  // Half again, across the whole verb set. That is a large number and it is
  // meant to be: it costs stones from all five environments, which is roughly
  // ten complete clears, and a reward that far away has to change how the game
  // plays rather than shave a tick off a kill.
  const bare = statsFor({ levels: {}, skin: null, pet: null });
  const armed = statsFor({
    levels: { "weapon.igris": 1 },
    skin: null,
    pet: null,
  });

  // All four verbs, because that is the whole difference between this and the
  // rest of the weapons shelf — those sell one at a time.
  for (const stat of [
    "attackDamage",
    "riposteDamage",
    "stunDamage",
    "smashDamage",
  ] as const) {
    assert.ok(
      armed[stat] > bare[stat],
      `${stat} did not move: ${bare[stat]} -> ${armed[stat]}`,
    );
    assert.equal(
      armed[stat],
      Math.round(bare[stat] * 1.5),
      `${stat} is not half again`,
    );
  }
});

test("milk replaces the fire draught and covers poison too", () => {
  assert.equal(
    SHOP.find((i) => i.id === "potion.fireproof"),
    undefined,
    "the Quench draught is gone",
  );
  const milk = SHOP.find((i) => i.id === "potion.milk");
  assert.ok(milk, "and milk is on the shelf");
  assert.equal(milk.potion, "milk");
  assert.equal(milk.live, true);
});

test("the poison weave is the burn scale's twin, and bottoms out at nothing", () => {
  const worn = statsFor({
    levels: { "gear.antivenom": 3 },
    skin: null,
    pet: null,
  });
  assert.equal(worn.venomScale, 0, "three levels is immunity, like the scale");
  const one = statsFor({
    levels: { "gear.antivenom": 1 },
    skin: null,
    pet: null,
  });
  assert.equal(one.venomScale, 0.5, "and one level is half");
});

test("both legendaries are priced out of the shallow environments (FR-10)", () => {
  // Depth is what pays, and these are the clearest statement of it on any
  // shelf: no amount of grinding the first three environments buys either.
  for (const id of ["gear.aegis", "weapon.igris"]) {
    const item = SHOP.find((i) => i.id === id)!;
    const deep = item.price.gems.slice(3).reduce((a, b) => a + b, 0);
    assert.ok(deep > 0, `${id} can be bought with shallow stones alone`);
  }
});

test("exactly one thing in the shop cannot be bought at any price", () => {
  const earned = SHOP.filter((i) => i.earned !== undefined);
  assert.equal(earned.length, 1, "the earned reward should be singular");
  assert.equal(earned[0].id, "skin.revenant");
  assert.equal(earned[0].earned, "revenant");
  // It is a cosmetic, and that is deliberate: an earned STAT would mean the
  // hardest fight in the game also gates power, and a player who cannot beat it
  // would be locked out twice.
  assert.equal(earned[0].category, "cosmetics");
  assert.equal(earned[0].effect, undefined);
});

test("every item on the shelves has its own picture", () => {
  // `items.png` is indexed by position in `SHOP` — the shop draws frame N for
  // item N — so the sheet and the list have to be the same length and in the
  // same order. Nothing enforces that but this.
  //
  // It has drifted twice. Removing a potion left the sheet a frame long, and
  // adding the earned skin left it a frame short — and the symptom both times
  // was the shop showing a cave moth where a potion should be, which reads as
  // the whole page being broken rather than as one number being out.
  const sheet = readFileSync("public/art/items.png");
  // PNG width is a big-endian 32-bit integer at byte 16 of the IHDR chunk.
  const width = sheet.readUInt32BE(16);
  assert.equal(
    width / 32,
    SHOP.length,
    `items.png holds ${width / 32} icons for ${SHOP.length} items`,
  );
});
