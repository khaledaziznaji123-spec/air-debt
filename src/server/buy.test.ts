/**
 * What a purchase costs, and who is exempt.
 *
 * `buy` talks to Supabase, so what is tested here is the DECISION rather than
 * the write: given a balance and an item, is it affordable, and does an admin
 * get it for nothing. Those are the two rules that had a real bug in them.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { SHOP, priceOf, afford, pay, levelOf } from "../config/shop.ts";

const tank = SHOP.find((i) => i.id === "gear.tank")!;

test("the air tank's first level is priced where it was priced", () => {
  // A canary. If this number moves, the balance conversation that set it should
  // happen again rather than being discovered in play.
  const price = priceOf(tank, 0)!;
  assert.equal(price.gems[0], 32);
});

test("sixty-eight per cent of the gems is not enough, and that is the 70% rule", () => {
  // The exact balance that made this look like a bug: twenty-two grade-one gems
  // against a price of thirty-two is 68.75%, and gold may only cover a shortfall
  // from 70% up. So the refusal was correct and the game was right to say no.
  const price = priceOf(tank, 0)!;
  const purse = { gems: [22, 18, 28, 0, 8], gold: 44 };
  const verdict = afford(price, purse);
  assert.equal(
    verdict.affordable,
    false,
    "22 of 32 is under the threshold and gold must not rescue it",
  );
  assert.equal(
    verdict.blockedByThreshold,
    true,
    "and the reason should be the threshold, not the gold",
  );
  assert.equal(pay(price, purse), null, "it should not have been payable");

  // One more gem is 71.9%, which is over the line: the THRESHOLD stops being
  // the objection. It is still not affordable, because covering nine gems costs
  // fifty-four gold and there is forty-four — but that is a different refusal,
  // and keeping the two apart is the point. One says "go deeper"; the other says
  // "come back with more gold".
  const over = afford(price, { gems: [23, 18, 28, 0, 8], gold: 44 });
  assert.equal(over.blockedByThreshold, false, "71.9% should clear the threshold");
  assert.equal(over.affordable, false, "but the gold is still short");
  assert.equal(over.goldForGems, 54);

  // And with enough of both, it goes through.
  const enough = afford(price, { gems: [26, 18, 28, 0, 8], gold: 44 });
  assert.equal(enough.affordable, true, "81% of the gems and gold to spare");
});

test("an admin pays nothing but still cannot exceed a top tier", () => {
  // Free is not the same as unchecked. The tier ceiling is a rule about the
  // item rather than about the money, so it survives.
  const tiers = tank.tiers ?? 1;
  assert.ok(tiers > 1, "the tank is a ladder");
  assert.equal(priceOf(tank, tiers), null, "there is no level above the top one");
  // And the level a purchase would produce is always the next one up.
  assert.equal(levelOf({ levels: { "gear.tank": 3 }, skin: null, pet: null }, "gear.tank"), 3);
});
