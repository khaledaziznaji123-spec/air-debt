import { test } from "node:test";
import assert from "node:assert/strict";
import { tuning, checkTimeBudget, TICK_HZ } from "./tuning.ts";

/**
 * The time budget from PRD FR-19/FR-20 is load-bearing: it is what makes
 * shortcuts the win condition rather than a convenience. These assertions exist
 * so that a future tuning change cannot quietly break the design without
 * failing the build.
 */

test("a maxed air tank alone cannot win — shortcuts are required", () => {
  const b = checkTimeBudget();
  assert.equal(b.shortcutsAreRequired, true, "walking the whole dungeon on a full tank must still lose");
});

test("with full shortcut coverage, a maxed player can win", () => {
  const b = checkTimeBudget();
  assert.equal(b.winnable, true, "total shortcut savings must close the gap to the max tank");
});

test("the final air tank upgrade is not dead progression", () => {
  const b = checkTimeBudget();
  assert.equal(b.topUpgradeMatters, true, "a winning run must cost more than a one-upgrade-short tank");
});

test("the air curve reaches its ceiling in exactly the stated number of upgrades", () => {
  const { base, perUpgrade, max, upgradeTiers } = tuning.air;
  assert.equal(base + perUpgrade * upgradeTiers, max);
});

test("the parry window is shorter than the punish for missing it", () => {
  const { parryWindow, mistimePunish } = tuning.combat;
  assert.ok(
    mistimePunish > parryWindow,
    "PRD FR-5.9: guessing must cost more than reading, or panic stops compounding",
  );
});

test("all durations are whole ticks", () => {
  const durations = [
    ...Object.values(tuning.combat),
    ...Object.values(tuning.traps),
    tuning.air.base,
    tuning.air.perUpgrade,
    tuning.air.max,
    tuning.budget.environmentTraverse,
    tuning.budget.miniBoss,
    tuning.budget.finalBoss,
    tuning.budget.shortcutSaving,
  ];
  for (const d of durations) {
    assert.equal(Number.isInteger(d), true, `${d} is not a whole tick at ${TICK_HZ}Hz`);
  }
});
