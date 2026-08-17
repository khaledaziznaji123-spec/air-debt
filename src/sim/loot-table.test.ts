/**
 * What a chest is worth, and what a kill is worth.
 *
 * The table is four outcomes with fixed odds, identical in every environment.
 * What changes with depth is the GRADE of the stone, not the chance of a good
 * roll — so these tests are mostly about the two properties that are easy to
 * break by accident: the odds actually being the odds, and the promotion rule
 * for hard-to-reach chests not quietly minting legendaries.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createInitialState,
  gradeFor,
  step,
  Intent,
  type SimState,
} from "./index.ts";
import { isLock } from "./step.ts";
import { environmentAt } from "../config/dungeon.ts";
import { tuning } from "../config/tuning.ts";
import { environmentsBuilt, terrain } from "../config/terrain.ts";

/**
 * Which chests were rolled as hard-to-reach.
 *
 * Read off the terrain's own anchors rather than guessed from the id. Not every
 * set-piece chest is hidden — the yard puts one in the open and the shelf puts
 * one on a block you can walk onto — and assuming otherwise made the first
 * version of the promotion test measure a population that was half floor
 * chests, then report the promotion rule as broken.
 */
const HIDDEN_IDS = new Set(
  terrain.chestAnchors.flatMap((a, i) =>
    a.hidden ? [`chest.set.${i + 1}`] : [],
  ),
);
HIDDEN_IDS.add("chest.warden");

const L = tuning.loot;

test("the four outcomes are a probability distribution", () => {
  const o = L.chestOdds;
  const total = o.trash + o.normal + o.better + o.legendary;
  assert.ok(
    Math.abs(total - 1) < 1e-9,
    `the odds sum to ${total}, which is not a table`,
  );
  for (const [name, p] of Object.entries(o)) {
    assert.ok(p > 0 && p < 1, `${name} at ${p} is not a chance, it is a rule`);
  }
});

test("the tiers are ordered — a better roll is never worth less", () => {
  const [tLow, tHigh] = L.chestGems.trash;
  const [nLow, nHigh] = L.chestGems.normal;
  const [bLow, bHigh] = L.chestGems.better;
  assert.ok(tLow <= tHigh && nLow <= nHigh && bLow <= bHigh, "ranges ascend");
  assert.ok(nLow > tHigh, "a normal beats the best trash");
  assert.ok(bLow >= nHigh, "and a better is never worse than a normal");
  assert.ok(tLow >= 1, "even the worst chest pays something");
});

/**
 * Every chest the game will actually lay out, across many seeds. The odds are
 * a claim about a population, so the population is what gets measured.
 */
function sample(seeds: number) {
  const out = { trash: 0, normal: 0, better: 0, legendary: 0, total: 0 };
  for (let seed = 1; seed <= seeds; seed++) {
    for (const c of createInitialState(600, { seed }).chests) {
      // Floor chests only. Promotion rewrites the tier of a hidden one AFTER
      // the roll, so including them measures the promotion rule rather than
      // the table — which is what the next test is for.
      if (HIDDEN_IDS.has(c.id)) continue;
      out.total++;
      out[c.loot.tier]++;
    }
  }
  return out;
}

test("chests come out roughly on the advertised odds", () => {
  // Loose bounds on purpose. This is a check that the table is wired up the way
  // it reads — not a test of the RNG, which has its own.
  const n = sample(120);
  assert.ok(n.total > 700, `only ${n.total} floor chests sampled`);

  const seen = (k: keyof typeof L.chestOdds) =>
    (k === "trash"
      ? n.trash
      : k === "normal"
        ? n.normal
        : k === "better"
          ? n.better
          : n.legendary) / n.total;

  for (const key of ["trash", "normal", "better", "legendary"] as const) {
    const want = L.chestOdds[key];
    const got = seen(key);
    assert.ok(
      Math.abs(got - want) < 0.08,
      `${key}: wanted about ${want}, saw ${got.toFixed(3)}`,
    );
  }
});

test("a legendary pays gold and no stones", () => {
  for (let seed = 1; seed <= 60; seed++) {
    for (const c of createInitialState(600, { seed }).chests) {
      if (!c.loot.legendary) continue;
      assert.equal(c.loot.gems, 0, "a legendary is gold");
      assert.equal(c.loot.gold, L.legendaryGold);
    }
  }
});

test("and everything else pays stones and no gold", () => {
  for (let seed = 1; seed <= 60; seed++) {
    for (const c of createInitialState(600, { seed }).chests) {
      if (c.loot.legendary) continue;
      assert.equal(c.loot.gold, 0, "only the jackpot pays gold");
      assert.ok(c.loot.gems >= L.chestGems.trash[0], "and never nothing");
      assert.ok(
        c.loot.gems <= L.chestGems.better[1],
        "or more than the top tier",
      );
    }
  }
});

test("a hard-to-reach chest is one tier better, and never legendary", () => {
  // The rule that keeps terrain honest. Skill buys a reliably good chest; it
  // does not buy the jackpot, or every legendary in the game comes out of the
  // same handful of alcoves and the 5% stops being true.
  //
  // Measured as: the hidden population must never contain the trash tier at
  // all — trash is promoted to normal — and must not run hotter on legendaries
  // than the floor population does.
  //
  // Read off `loot.tier`, not off the gem count. The counts overlap at five, so
  // a five-gem chest is either a good normal or a poor better and no amount of
  // arithmetic can say which.
  let hiddenTrash = 0;
  let hiddenLegendary = 0;
  let hidden = 0;
  let floorLegendary = 0;
  let floor = 0;

  for (let seed = 1; seed <= 120; seed++) {
    const s = createInitialState(600, { seed });
    for (const c of s.chests) {
      if (HIDDEN_IDS.has(c.id)) {
        hidden++;
        if (c.loot.tier === "legendary") hiddenLegendary++;
        else if (c.loot.tier === "trash") hiddenTrash++;
      } else {
        floor++;
        if (c.loot.tier === "legendary") floorLegendary++;
      }
    }
  }

  assert.ok(hidden > 200 && floor > 200, `${hidden} hidden, ${floor} floor`);
  assert.equal(hiddenTrash, 0, "a climb is never rewarded with the worst tier");

  const hiddenRate = hiddenLegendary / hidden;
  const floorRate = floorLegendary / floor;
  assert.ok(
    Math.abs(hiddenRate - floorRate) < 0.05,
    `legendaries: ${hiddenRate.toFixed(3)} hidden against ${floorRate.toFixed(3)} on the floor — ` +
      "promotion must not be a second route to the jackpot",
  );
});

test("grade tracks depth, clamped to what is built", () => {
  assert.equal(gradeFor(0), 1, "environment 1 pays emeralds");
  // Only one environment exists, so the clamp is what is being seen here. It
  // lifts on its own as more are built.
  assert.equal(gradeFor(4), Math.min(5, environmentsBuilt));
  for (const c of createInitialState(600).chests) {
    assert.ok(c.loot.grade >= 1 && c.loot.grade <= L.grades);
    assert.ok(
      c.loot.grade <= environmentsBuilt,
      "no grade the shop cannot use",
    );
  }
});

test("monsters carry their drop from the start, rolled not flipped", () => {
  // The reducer has no randomness (ARCH AD-1), so a kill cannot roll for a
  // reward at the moment it happens. It has to already be decided.
  const s = createInitialState(600);
  const ordinary = s.enemies.filter((e) => e.kind !== "enemy.warden");
  const paying = ordinary.filter((e) => e.drop.gems > 0);

  assert.ok(ordinary.length > 10, "enough monsters to say anything about");
  assert.ok(paying.length > 0, "some of them pay");
  assert.ok(paying.length < ordinary.length, "and some of them do not");
  for (const e of paying) {
    assert.equal(e.drop.gems, L.killDropGems);
    assert.equal(e.drop.gold, 0, "a monster pays stones, not coin");
  }

  // The same seed decides the same thing, every time.
  const again = createInitialState(600);
  assert.deepEqual(
    again.enemies.map((e) => e.drop),
    s.enemies.map((e) => e.drop),
  );
});

test("the drop rate is about what it says", () => {
  let paying = 0;
  let total = 0;
  for (let seed = 1; seed <= 120; seed++) {
    for (const e of createInitialState(600, { seed }).enemies) {
      // Bosses do not roll, and neither does a bee: it is one question that
      // dies whichever way you answer it, so paying for one would be paying for
      // standing still. Counting them dragged the measured rate down to 0.23.
      if (isLock(e.kind) || e.kind === "enemy.bee") continue;
      total++;
      if (e.drop.gems > 0) paying++;
    }
  }
  const rate = paying / total;
  assert.ok(
    Math.abs(rate - L.killDropChance) < 0.05,
    `wanted about ${L.killDropChance}, saw ${rate.toFixed(3)} over ${total} monsters`,
  );
});

test(
  "a boss pays gold, and does not roll for it",
  {
    skip:
      tuning.miniBosses || tuning.finalBoss
        ? false
        : "no boss is placed at the moment",
  },
  () => {
    // Whichever boss is actually standing in the world. The Warden was the only
    // one when this was written; the mini-bosses are switched off now and the
    // Hollow is what is left, so the test asks the world rather than a name.
    for (let seed = 1; seed <= 20; seed++) {
      const boss = createInitialState(600, { seed }).enemies.find((e) =>
        isLock(e.kind),
      );
      assert.ok(boss, "there is a boss somewhere");
      assert.ok(boss!.drop.gold > 0, "every time, not sometimes");
      assert.equal(boss!.drop.gems, 0, "a boss pays coin, not stones");
    }
  },
);

test("killing something actually pays it into the bag, once", () => {
  // With a real sword, so the kill is quick. Standing next to a goblin for four
  // seconds swinging a bare blade got the PLAYER killed, and a run that has
  // ended pays nothing into anything — which read as the drop being broken.
  const base = createInitialState(60 * 60 * 10, {
    loadout: { levels: { "weapon.honed": 3 }, skin: null, pet: null },
  });
  // Something that pays AND can be stood next to and hit. A shark is in water
  // the fixture has no way to be in, and a bee dies to its own dive before a
  // sword ever reaches it — neither is a test of the payout.
  // On clear ground, too. The first goblin in the world stands beside a
  // pressure plate, and four seconds of standing still next to one is a floor
  // to your last bar followed by whatever else is nearby.
  const quiet = (x: number) =>
    !terrain.traps.some((tr) => Math.abs(tr.x - x) < 220) &&
    !terrain.hazards.some((h) => Math.abs(h.x - x) < 260) &&
    !terrain.spikes.some((s) => x > s.x0 - 200 && x < s.x1 + 200);
  const payer = base.enemies.find(
    (e) =>
      quiet(e.x) &&
      e.drop.gems > 0 &&
      (e.kind === "enemy.goblin" ||
        e.kind === "enemy.crab" ||
        e.kind === "enemy.lizard" ||
        e.kind === "enemy.flamer"),
  )!;
  assert.ok(payer, "the fixture needs a monster that pays");

  let s: SimState = {
    ...base,
    entered: true,
    deepestX: payer.x,
    player: { ...base.player, x: payer.x - 40, y: payer.y, facing: 1 as const },
    enemies: [{ ...payer, phase: "approaching" as const }],
  };

  let paid = 0;
  for (let i = 0; i < 240; i++) {
    s = step(s, i % 20 < 6 ? Intent.Attack : Intent.None);
    paid += s.events.filter((e) => e.type === "lootDropped").length;
  }
  assert.equal(s.outcome, "running", "and the player survived to be paid");

  assert.equal(s.enemies[0].phase, "dead", "it died");
  assert.equal(
    paid,
    1,
    "and paid out exactly once, not every tick it lies there",
  );

  // The grade of wherever the payer actually STANDS. It used to be `gradeFor(0)`
  // — correct only while the first monster that pays was guaranteed to be in the
  // first environment, which stopped being true the moment the parkour (which
  // has no monsters at all) moved to the front.
  const grade = gradeFor(environmentAt(payer.x));
  assert.equal(
    s.carried.gems[grade - 1],
    payer.drop.gems,
    "into the right grade's pile",
  );
});
