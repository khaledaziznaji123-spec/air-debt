/**
 * What a ranked run is made of.
 *
 * The mode exists so a leaderboard measures play rather than hours, which only
 * holds if the equipment really is identical for everybody — so the interesting
 * assertions here are about what is levelled up and, more importantly, what is
 * deliberately left alone.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { SHOP, levelOf, rankedLoadout, EMPTY_LOADOUT } from "./shop.ts";
import { allShortcutIds } from "./dungeon.ts";
import { shortcuts } from "./dungeon.ts";

test("every weapon and every piece of gear comes out at full tier", () => {
  const fresh = rankedLoadout(EMPTY_LOADOUT);
  for (const item of SHOP) {
    if (!item.id.startsWith("weapon.") && !item.id.startsWith("gear.")) continue;
    assert.equal(
      levelOf(fresh, item.id),
      item.tiers ?? 1,
      `${item.id} was not maxed`,
    );
  }
});

test("nobody carries a potion into a ranked run", () => {
  // Not maxed and not left as owned: removed. A player who has bought a
  // restoration would otherwise start with a bar of health more than one who has
  // not, and the board would be measuring the shop again in a smaller way.
  const owned = {
    levels: {
      "potion.restoration": 1,
      "potion.shield": 1,
      "potion.milk": 1,
      "weapon.honed": 1,
    },
    skin: "skin.void",
    pet: "pet.moth",
  };
  const r = rankedLoadout(owned);
  for (const item of SHOP) {
    if (!item.potion) continue;
    assert.equal(levelOf(r, item.id), 0, `${item.id} came into a ranked run`);
  }
  // Cosmetics are untouched — they change nothing the simulation can see.
  assert.equal(r.skin, "skin.void", "ranked changed the skin");
  assert.equal(r.pet, "pet.moth", "ranked changed the pet");
});

test("two accounts play ranked with identical potions: none", () => {
  const a = rankedLoadout({ levels: { "potion.shield": 1 }, skin: null, pet: null });
  const b = rankedLoadout(EMPTY_LOADOUT);
  for (const item of SHOP) {
    if (!item.potion) continue;
    assert.equal(levelOf(a, item.id), levelOf(b, item.id));
  }
});

test("an empty account and a rich one play ranked on the same gear", () => {
  // The whole point, in one assertion. If this ever fails the board is measuring
  // the shop again.
  const poor = rankedLoadout(EMPTY_LOADOUT);
  const rich = rankedLoadout({
    levels: Object.fromEntries(SHOP.map((i) => [i.id, i.tiers ?? 1])),
    skin: null,
    pet: null,
  });
  for (const item of SHOP) {
    if (!item.id.startsWith("weapon.") && !item.id.startsWith("gear.")) continue;
    assert.equal(
      levelOf(poor, item.id),
      levelOf(rich, item.id),
      `${item.id} differs between a new account and a maxed one`,
    );
  }
});

test("ranked opens every shortcut there is", () => {
  const open = allShortcutIds();
  assert.equal(open.length, shortcuts.length);
  for (const s of shortcuts) {
    assert.ok(open.includes(s.id), `${s.id} was not opened`);
  }
});
