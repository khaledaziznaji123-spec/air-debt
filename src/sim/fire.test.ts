/**
 * Environment 2 — the fire.
 *
 * What is asserted here is the handful of things that make it a different place
 * rather than environment 1 in red: that the ground itself is lethal, that the
 * parry stops paying, that there is an enemy you cannot out-trade, and that both
 * of its shortcuts are sealed until they are earned and worth taking once they
 * are.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createInitialState,
  step,
  Intent,
  flamer,
  phoenix,
  type SimState,
  type Enemy,
} from "./index.ts";
import { tuning } from "../config/tuning.ts";
import {
  builtEnd,
  checkGeyserChain,
  environmentsBuilt,
  gateX,
  geyserVents,
  terrain,
  highRoad,
} from "../config/terrain.ts";
import {
  environmentAt,
  geyserId,
  shortcutById,
  themeAt,
  themeStart,
  themeEnd,
  highRoadId,
} from "../config/dungeon.ts";

const FLOOR: number = tuning.room.floorY;
const BAR = tuning.player.maxHp / tuning.player.healthBars;
const PH = tuning.enemies.phoenix;
const FL = tuning.enemies.flamethrower;

function at(
  x: number,
  y: number,
  open: readonly string[] = [],
  enemies: Enemy[] = [],
): SimState {
  const base = createInitialState(60 * 60 * 20, { openShortcuts: open });
  return {
    ...base,
    entered: true,
    deepestX: x,
    environment: environmentAt(x),
    player: { ...base.player, x, y },
    enemies,
  };
}

/**
 * Somewhere in the fire flat enough to stage a fight on.
 *
 * Derived, not written down. The first version of these tests picked a round
 * number and it worked, right up until the shortcut placements moved and the
 * pieces shifted under it: the fixture ended up standing in a lava pool with a
 * pendulum overhead, and every fight test failed reporting that the phoenix
 * never shot — when what had happened is that the player fell in the lava
 * before it could.
 */
function clearGround(): number {
  const wide = 380;
  let runFrom: number | null = null;
  for (let x = themeStart("fire") + 800; x < themeEnd("fire") - 800; x += 20) {
    const flat = terrain.surfaces.some(
      (s) => x >= s.x0 && x <= s.x1 && Math.abs(s.top - FLOOR) < 1,
    );
    // And nothing STANDING on that floor. Checking only that the ground is at
    // floor height found a stretch with a basalt pillar in the middle of it:
    // the fixture spawned inside the rock, was shoved sixty units clear, and
    // the flamethrower it was supposed to be fighting stopped dead against the
    // same pillar a hundred and fifty units short of its own reach.
    const blocked = terrain.surfaces.some(
      (s) =>
        x >= s.x0 - 60 &&
        x <= s.x1 + 60 &&
        s.top < FLOOR - 4 &&
        s.bottom > FLOOR - tuning.player.height,
    );
    const lava = terrain.spikes.some((s) => x > s.x0 - 160 && x < s.x1 + 160);
    const hazard = terrain.hazards.some((h) => Math.abs(h.x - x) < 320);
    // Vents are not excluded. They are inert until their lever is flicked and
    // none of these fixtures flicks it, so a mouth in the floor is just floor.
    if (!flat || blocked || lava || hazard) {
      runFrom = null;
      continue;
    }
    if (runFrom === null) runFrom = x;
    if (x - runFrom >= wide) return runFrom;
  }
  throw new Error("the fire has nowhere flat to stand");
}

const GROUND = clearGround();

// ---------------------------------------------------------------- the place

test("the fire exists, and it is the second of five", () => {
  // It used to be the last thing built and it used to be behind the Warden.
  // Neither is true now: there are five environments and one boss, at the
  // bottom.
  assert.equal(environmentsBuilt, 5);
  // The gate is the seam after the FIRST environment, whatever that is. It was
  // the end of the rock when the rock was first; the rock is fourth now.
  assert.equal(
    environmentAt(gateX),
    0,
    "the gate closes the first environment",
  );
  assert.ok(builtEnd > gateX + 30000, "and there is a great deal past it");
});

test("its floor is lava, and lava is a pit", () => {
  // The rule that makes the fire the fire. No new way to be hurt was added for
  // it: a pool goes through the same code an iron spike pit does, so falling in
  // puts you back on the edge on your last bar and nothing had to learn a new
  // kind of hazard to make that true.
  const pools = terrain.spikes.filter((s) => s.lava);
  assert.ok(pools.length >= 4, `only ${pools.length} pools in the fire`);
  for (const p of pools) {
    assert.equal(themeAt(p.x0), "fire", "and all of them are in the fire");
  }

  const pool = pools[0];
  let s = at((pool.x0 + pool.x1) / 2, FLOOR, []);
  s = { ...s, player: { ...s.player, y: FLOOR + 40, vy: 4 } };
  let thrown = false;
  for (let i = 0; i < 200 && !thrown; i++) {
    s = step(s, Intent.None);
    thrown = s.events.some((e) => e.type === "thrownBack");
  }
  assert.ok(thrown, "it put the player back out");
  assert.ok(
    s.player.hp <= BAR + 0.001,
    `left on ${s.player.hp}, a bar is ${BAR}`,
  );
});

test("lava also comes down, and it comes down on a rhythm", () => {
  // The curtains. One or two pouring at a time, which is the thing that makes
  // them a gap to walk through rather than a wall.
  const flows = terrain.hazards.filter((h) => h.kind === "flow");
  assert.ok(flows.length >= 4, `only ${flows.length} curtains`);

  // No pair of neighbours shares a phase, or a piece would be one wide curtain.
  for (let i = 1; i < flows.length; i++) {
    if (Math.abs(flows[i].x - flows[i - 1].x) > 400) continue;
    const a =
      ((flows[i].offset % flows[i].period) + flows[i].period) % flows[i].period;
    const b =
      ((flows[i - 1].offset % flows[i - 1].period) + flows[i - 1].period) %
      flows[i - 1].period;
    assert.notEqual(a, b, `${flows[i].id} pours in step with its neighbour`);
  }
});

// -------------------------------------------------------------- the phoenix

test("a fireball costs a bar, and a parried one goes back and kills the bird", () => {
  // The phoenix's whole answer, and the reason the parry is worth learning in
  // the fire at all.
  //
  // It used to break instead: the blade shattered the fireball and nothing came
  // back. That made a flier you cannot reach into a monster with no answer but
  // walking away, so the block saved you and never paid you. Now the shot goes
  // home, and one perfectly timed parry ends the fight.
  function fight(parry: boolean) {
    let s = at(GROUND, FLOOR, [], [phoenix(GROUND + 280, FLOOR - PH.hover)]);
    let returned = 0;
    let shots = 0;
    for (let i = 0; i < 600; i++) {
      const incoming = s.arrows.some((a) => Math.abs(a.x - s.player.x) < 70);
      s = step(s, parry && incoming ? Intent.Block : Intent.None);
      shots += s.events.filter((e) => e.type === "arrowLoosed").length;
      returned += s.events.filter((e) => e.type === "fireballReturned").length;
    }
    const bird = s.enemies.find((e) => e.kind === "enemy.phoenix");
    return {
      shots,
      returned,
      dead: bird?.phase === "dead",
      lost: (100 - s.player.hp) / BAR,
    };
  }

  const bare = fight(false);
  assert.ok(bare.shots >= 3, `it only got ${bare.shots} shots away`);
  // A bar for the hit, and then it sets you alight on top of that — so the
  // total is more than one bar a fireball and the hit itself is still one.
  assert.ok(
    bare.lost > bare.shots,
    `${bare.lost} bars for ${bare.shots} fireballs — where is the burn?`,
  );
  assert.ok(
    bare.lost < bare.shots * 2,
    `${bare.lost} bars for ${bare.shots} fireballs is more than a bar and a burn`,
  );
  assert.equal(bare.dead, false, "and left alone it is fine");

  const blocked = fight(true);
  assert.ok(blocked.returned > 0, "the parry turns them around");
  assert.equal(blocked.dead, true, "and its own fire is what kills it");
  assert.equal(blocked.lost, 0, "and a fireball you catch does not light you");
});

test("the phoenix keeps its altitude instead of finding a ledge", () => {
  // It walked itself into the roof once. `groundUnder` returns the nearest
  // surface, so a phoenix climbing past a ledge measured from the LEDGE,
  // decided it was too low, and climbed again.
  let s = at(GROUND, FLOOR, [], [phoenix(GROUND + 280, FLOOR - PH.hover)]);
  for (let i = 0; i < 600; i++) s = step(s, Intent.None);
  const y = s.enemies[0].y;
  assert.ok(
    Math.abs(y - (FLOOR - PH.hover)) <= PH.bob + 8,
    `it drifted to ${Math.round(y)}; it should hover near ${FLOOR - PH.hover}`,
  );
});

// ------------------------------------------------------------- the flamer

test("the flamethrower burns for two seconds and then cannot touch you for one", () => {
  // The window, which is the whole enemy. It is the first thing in the game
  // that cannot be answered on a frame — you are not reading a swing, you are
  // waiting out a burn — and the cooldown has to be real or there is nothing
  // to wait for.
  let s = at(GROUND, FLOOR, [], [flamer(GROUND + 240, FLOOR)]);
  const phases: string[] = [];
  for (let i = 0; i < 400; i++) {
    s = step(s, Intent.None);
    phases.push(s.enemies[0].phase);
  }
  // Measured as complete runs rather than as totals. Totalling over a fixed
  // window counts whichever half the window happens to end inside twice, which
  // made a correct 2:1 read as 204:60.
  const runs = new Map<string, number[]>();
  let n = 1;
  for (let i = 1; i < phases.length; i++) {
    if (phases[i] === phases[i - 1]) {
      n++;
      continue;
    }
    if (!runs.has(phases[i - 1])) runs.set(phases[i - 1], []);
    runs.get(phases[i - 1])!.push(n);
    n = 1;
  }
  const burn = runs.get("striking") ?? [];
  const cool = runs.get("recovering") ?? [];
  assert.ok(
    burn.length > 0 && cool.length > 0,
    "it has both halves of its cycle",
  );
  assert.equal(burn[0], FL.burnTicks, "it burns for two seconds");
  assert.equal(cool[0], FL.cooldownTicks, "and is helpless for one");

  // And during the cooldown it is genuinely harmless — no jet, no swing.
  let s2 = at(GROUND, FLOOR, [], [flamer(GROUND + 240, FLOOR)]);
  let hitWhileCooling = 0;
  for (let i = 0; i < 400; i++) {
    const wasCooling = s2.enemies[0].phase === "recovering";
    s2 = step(s2, Intent.None);
    if (wasCooling && s2.events.some((e) => e.type === "playerHit"))
      hitWhileCooling++;
  }
  assert.equal(hitWhileCooling, 0, "the cooldown is an opening, not a pause");
});

test("standing in the jet costs half a bar at a time, not a bar a frame", () => {
  let s = at(GROUND + 150, FLOOR, [], [flamer(GROUND + 240, FLOOR)]);
  let hits = 0;
  let bitten = 0;
  for (let i = 0; i < 200; i++) {
    s = step(s, Intent.None);
    for (const e of s.events) {
      if (e.type !== "playerHit") continue;
      hits++;
      bitten += e.damage;
    }
  }
  assert.ok(hits > 0, "it burns whoever stands in it");
  // Measured off the events rather than off the health, because the health is
  // now also going down to the burn the jet started.
  assert.equal(bitten / hits, FL.damage, "half a bar a bite");
  assert.ok(hits < 200 / 4, `${hits} bites in 200 ticks is per-frame damage`);
});

// ---------------------------------------------------------------- the burn

test("anything that burns you sets you alight, and being alight costs", () => {
  // The fire's signature: nothing in this environment hits once.
  const sources: Array<[string, () => SimState]> = [
    [
      "a fireball",
      () => at(GROUND, FLOOR, [], [phoenix(GROUND + 280, FLOOR - PH.hover)]),
    ],
    [
      "a flame jet",
      () => at(GROUND + 150, FLOOR, [], [flamer(GROUND + 240, FLOOR)]),
    ],
  ];

  for (const [what, make] of sources) {
    let s = make();
    let lit = 0;
    let peak = 0;
    for (let i = 0; i < 400; i++) {
      s = step(s, Intent.None);
      lit += s.events.filter((e) => e.type === "caughtFire").length;
      peak = Math.max(peak, s.player.burning);
    }
    assert.ok(lit > 0, `${what} did not set the player alight`);
    // One less than the full duration: the tick it catches on is also the
    // first tick it burns for, so the highest value ever observed from outside
    // is already one down. The burn still runs its full length.
    assert.equal(peak, tuning.fire.burnTicks - 1, `${what} lit a short burn`);
  }
});

test("a burn costs half a bar and then stops", () => {
  // On its own, away from whatever started it, so what is measured is the burn.
  let s = at(GROUND, FLOOR, []);
  s = { ...s, player: { ...s.player, burning: tuning.fire.burnTicks } };
  const before = s.player.hp;
  for (let i = 0; i < tuning.fire.burnTicks + 30; i++) s = step(s, Intent.None);
  assert.ok(
    Math.abs(before - s.player.hp - tuning.fire.burnDamage) < 0.001,
    `the burn took ${before - s.player.hp}, not ${tuning.fire.burnDamage}`,
  );
  assert.equal(s.player.burning, 0, "and it goes out");
});

test("but it never takes your last bar", () => {
  // Same floor the pressure plates have. There is no answer to a burn — you
  // wait — so it must not be the thing that ends a run.
  let s = at(GROUND, FLOOR, []);
  s = {
    ...s,
    player: { ...s.player, hp: BAR, burning: tuning.fire.burnTicks },
  };
  for (let i = 0; i < tuning.fire.burnTicks + 30; i++) s = step(s, Intent.None);
  assert.equal(s.player.hp, BAR, "held at one bar");
  assert.equal(s.outcome, "running", "and the run is still going");
});

test("it refreshes rather than stacking", () => {
  // Standing in a jet for two seconds is already being punished by the jet.
  let s = at(GROUND, FLOOR, []);
  s = { ...s, player: { ...s.player, burning: 4 } };
  s = step(s, Intent.None);
  s = { ...s, player: { ...s.player, burning: tuning.fire.burnTicks } };
  const before = s.player.hp;
  for (let i = 0; i < tuning.fire.burnTicks + 30; i++) s = step(s, Intent.None);
  const took = before - s.player.hp;
  assert.ok(
    took <= tuning.fire.burnDamage + 0.001,
    `a refreshed burn took ${took}, more than one burn's worth`,
  );
});

// --------------------------------------------------------- the geyser chain

test("the geyser chain's spacing and timing agree", () => {
  // Two numbers that have to match and neither of which looks wrong alone.
  const chain = checkGeyserChain();
  assert.equal(chain.sequenced, true, "you land while the next one is blowing");
  assert.equal(
    chain.onTarget,
    true,
    "and you land on it rather than beside it",
  );
  assert.equal(chain.insideSpan, true, "and the chain fits its own shortcut");
});

/**
 * Long enough to cross the span the hard way, with slack.
 *
 * Derived rather than the flat 900 it used to be. The chain lives in the sea
 * now and a shortcut skips twenty-two seconds rather than thirteen, so the
 * fallback route is most of four thousand units of swimming — 900 ticks was not
 * a measurement of failure, it was a measurement of the cap.
 */
const PATIENCE = (() => {
  const g = shortcutById.get(geyserId)!;
  return Math.ceil((g.toX - g.fromX) / tuning.swim.kick) + 300;
})();

test("ridden, it beats the ground it flies over; shut, it does nothing", () => {
  const g = shortcutById.get(geyserId)!;

  function ride(open: readonly string[], startTick: number) {
    let s: SimState = { ...at(geyserVents[0], FLOOR, open), tick: startTick };
    let t = 0;
    let throws = 0;
    while (t < PATIENCE && s.player.x < g.toX) {
      s = step(s, Intent.Right);
      throws += s.events.filter((e) => e.type === "geyserThrew").length;
      t++;
    }
    return { t, throws, made: s.player.x >= g.toX };
  }

  const shut = ride([], 0);
  assert.equal(shut.throws, 0, "an unflicked chain is just floor");

  const best = ride([geyserId], 0);
  assert.equal(best.throws, geyserVents.length, "a clean ride uses every vent");
  assert.ok(
    best.made && best.t < shut.t / 2,
    `${best.t} ticks against ${shut.t}`,
  );
});

test("and mistiming it costs time rather than the run", () => {
  // The one shortcut you can fail. Failing has to drop you onto the ordinary
  // ground route with your health intact, or it is a trap with a lever on it.
  const g = shortcutById.get(geyserId)!;
  for (const start of [0, 37, 60, 111, 150, 199]) {
    let s: SimState = { ...at(geyserVents[0], FLOOR, [geyserId]), tick: start };
    let t = 0;
    while (t < PATIENCE && s.player.x < g.toX) {
      // Forward, and up whenever the breath is running out. That is what a
      // player who missed a column does: they surface and swim the rest. A bot
      // that only ever holds Right drowns on the bottom, which measures the bot
      // rather than the shortcut.
      const gasping = s.player.breath < tuning.swim.bubbleTicks * 2;
      s = step(s, Intent.Right | (gasping ? Intent.Jump : 0));
      t++;
    }
    assert.ok(s.player.x >= g.toX, `entering at ${start} never got across`);
    assert.equal(s.outcome, "running", `entering at ${start} ended the run`);
    assert.equal(s.player.hp, tuning.player.maxHp, `entering at ${start} hurt`);
  }
});

// -------------------------------------------------------- being fireproof

test("the quench draught stops fire taking hold, but not fire hurting", () => {
  // Exactly what it says on the shelf: you still take the hit, you just do not
  // go up with it. A potion that stopped the damage too would be a better Iron
  // skin rather than a different item.
  function fight(withPotion: boolean) {
    let s = at(GROUND, FLOOR, [], [phoenix(GROUND + 280, FLOOR - PH.hover)]);
    if (withPotion) s = { ...s, potions: ["milk"] };
    let lit = 0;
    let hits = 0;
    for (let i = 0; i < 500; i++) {
      s = step(s, i === 0 && withPotion ? Intent.Milk : Intent.None);
      lit += s.events.filter((e) => e.type === "caughtFire").length;
      hits += s.events.filter((e) => e.type === "playerHit").length;
    }
    return { lit, hits, lost: 100 - s.player.hp, left: s.buffs.milk };
  }

  const bare = fight(false);
  const proofed = fight(true);

  assert.ok(bare.lit > 0, "the fixture does set an unprotected player alight");
  assert.equal(proofed.lit, 0, "and never sets a protected one alight");
  assert.equal(proofed.hits, bare.hits, "the fireballs still land");
  assert.ok(proofed.lost < bare.lost, "they just cost less without the burn");
});

test("and it runs out", () => {
  // Thirty seconds, not the rest of the run. It is the only reason the armour
  // is worth buying.
  let s = at(GROUND, FLOOR, []);
  s = { ...s, potions: ["milk"] };
  s = step(s, Intent.Milk);
  // The full duration, not one less: buffs tick down at the top of a tick and
  // are drunk further down it, so the first tick of a draught is not spent. The
  // burn is the other way round, which is why the two read differently.
  assert.equal(s.buffs.milk, tuning.fire.proofTicks, "thirty seconds");
  assert.deepEqual(s.potions, [], "and the flask is spent");

  for (let i = 0; i < tuning.fire.proofTicks + 5; i++) s = step(s, Intent.None);
  assert.equal(s.buffs.milk, 0, "then it is gone");
});

test("cinder scale softens the burn, and its last level stops it", () => {
  // The overlap with the draught is deliberate and so is the shape of it: the
  // armour is partial for two levels and total at the third, so the consumable
  // is what you use until the permanent thing catches up with it.
  function burnWith(levels: Record<string, number>) {
    const base = createInitialState(60 * 60 * 10, {
      loadout: { levels, skin: null, pet: null },
    });
    let s: SimState = {
      ...base,
      entered: true,
      deepestX: GROUND,
      player: {
        ...base.player,
        x: GROUND,
        y: FLOOR,
        burning: tuning.fire.burnTicks,
      },
      enemies: [],
    };
    const before = s.player.hp;
    for (let i = 0; i < tuning.fire.burnTicks + 20; i++)
      s = step(s, Intent.None);
    return before - s.player.hp;
  }

  const bare = burnWith({});
  const one = burnWith({ "gear.scale": 1 });
  const maxed = burnWith({ "gear.scale": 3 });

  assert.ok(
    Math.abs(bare - tuning.fire.burnDamage) < 0.001,
    "unarmoured, full",
  );
  assert.ok(one < bare && one > 0, `one level took ${one} against ${bare}`);
  assert.equal(maxed, 0, "and the last level is immunity");
});

test("maxed scale means fire never takes hold at all", () => {
  // Not "a burn that does nothing". A burn you cannot feel would still light
  // the player up on screen, which would be the animation lying about the
  // state — so at zero the ignition is refused outright.
  const base = createInitialState(60 * 60 * 10, {
    loadout: { levels: { "gear.scale": 3 }, skin: null, pet: null },
  });
  let s: SimState = {
    ...base,
    entered: true,
    deepestX: GROUND,
    player: { ...base.player, x: GROUND, y: FLOOR },
    enemies: [phoenix(GROUND + 280, FLOOR - PH.hover)],
  };
  let lit = 0;
  for (let i = 0; i < 500; i++) {
    s = step(s, Intent.None);
    lit += s.events.filter((e) => e.type === "caughtFire").length;
  }
  assert.equal(lit, 0, "nothing ever caught");
  assert.equal(s.player.burning, 0);
});

// ------------------------------------------------------------- the ward

test("the ward stops everything, including the things that ignore health", () => {
  // "Protects him from all damage" has to mean all of it. A ward that stopped
  // a goblin and not a spike pit is a ward nobody would trust at the moment
  // they needed one.
  const phoenixAt = GROUND + 280;

  function run(withWard: boolean) {
    let s = at(GROUND, FLOOR, [], [phoenix(phoenixAt, FLOOR - PH.hover)]);
    if (withWard) s = { ...s, potions: ["shield"] };
    let held = 0;
    for (let i = 0; i < 420; i++) {
      s = step(s, i === 0 && withWard ? Intent.Shield : Intent.None);
      held += s.events.filter((e) => e.type === "shieldHeld").length;
    }
    return { lost: (100 - s.player.hp) / BAR, held, lit: s.player.burning > 0 };
  }

  const bare = run(false);
  assert.ok(bare.lost > 0, "the fixture only works if it gets hit");

  const warded = run(true);
  assert.ok(warded.held > 0, "and the ward actually ate something");
  // Seven seconds is not the whole four hundred and twenty ticks, so some
  // damage after it lapses is expected — what must be true is that the ward
  // bought most of it.
  assert.ok(
    warded.lost < bare.lost / 2,
    `warded lost ${warded.lost.toFixed(1)} bars against ${bare.lost.toFixed(1)}`,
  );
});

test("nothing gets through while it is up, not even a little", () => {
  // Not a reduction. A shield that let a little through would be a percentage
  // with a dramatic name.
  let s = at(GROUND, FLOOR, [], [phoenix(GROUND + 280, FLOOR - PH.hover)]);
  s = { ...s, potions: ["shield"] };
  s = step(s, Intent.Shield);
  const full = s.player.hp;
  for (let i = 0; i < tuning.potions.shieldTicks - 2; i++) {
    s = step(s, Intent.None);
    assert.equal(s.player.hp, full, `something got through on tick ${i}`);
  }
});

test("milk stops fire AND poison taking hold", () => {
  // One thing, both effects. Two draughts for two status effects with identical
  // arithmetic was two buttons for a question the environment had already
  // answered before you walked into it.
  let s = at(GROUND, FLOOR, [], [phoenix(GROUND + 280, FLOOR - PH.hover)]);
  s = { ...s, potions: ["milk"] };
  s = step(s, Intent.Milk);
  assert.ok(s.buffs.milk > 0, "it was drunk");

  let lit = 0;
  let sick = 0;
  for (let i = 0; i < tuning.potions.milkTicks - 4; i++) {
    s = step(s, Intent.None);
    lit += s.events.filter((e) => e.type === "caughtFire").length;
    sick += s.events.filter((e) => e.type === "poisoned").length;
    // Poison, pressed on it directly rather than hoping to meet a lizard.
    if (i === 30) s = { ...s, player: { ...s.player, poisoned: 0 } };
  }
  assert.equal(lit, 0, "fire took hold anyway");
  assert.equal(sick, 0, "poison took hold anyway");
  // And it still HURTS — the potion stops the status, not the hit.
  assert.ok(s.player.hp < tuning.player.maxHp, "the fireballs still landed");
});

// ------------------------------------------------- the fire's high road

test("the high road is visible from below and unreachable without the lever", () => {
  // FR-3.1 — a shortcut has to be legible from the near side while being
  // unopenable from it. This is the most legible one in the game: you can see
  // the road you are not allowed on, the whole way along.
  const road = highRoad();
  assert.ok(road, "the fire has a high road");
  assert.ok(
    road.top < FLOOR - 200,
    `it is only ${Math.round(FLOOR - road.top)} up — a step, not a road`,
  );
  // It exists as terrain from the first run. The lever arms the lift, it does
  // not build the road.
  assert.ok(
    terrain.surfaces.some(
      (s) => Math.abs(s.top - road.top) < 2 && s.x1 - s.x0 > 2000,
    ),
    "the road is not laid",
  );

  // Shut, the lift does nothing, and no amount of jumping at the near end gets
  // a foot onto it. Asserted as "never STOOD on it" rather than as a height:
  // the interesting failure is not how close you got, it is whether the lever
  // can be skipped.
  let shut = at(road.x0 - 90, FLOOR, []);
  for (let i = 0; i < 400; i++) {
    shut = step(shut, Intent.Right | (i % 12 === 0 ? Intent.Jump : 0));
    const onIt: boolean =
      Math.abs(shut.player.y - road.top) < 3 &&
      shut.player.x > road.x0 &&
      shut.player.x < road.x1;
    assert.equal(onIt, false, `stood on the road at tick ${i} with no lever`);
  }
});

test("flicked, the lift puts you on it, and the road crosses the span", () => {
  const road = highRoad()!;
  const s0 = shortcutById.get(highRoadId)!;
  let s = at(road.x0 - 90, FLOOR, [highRoadId]);
  let landed = -1;
  // Stops at the far end of the span rather than running the clock out. Past
  // it the bot is holding Right through the rest of the fire with no combat,
  // and what happens to it there says nothing about the road.
  for (let i = 0; i < 60 * 20 && s.player.x < s0.toX; i++) {
    s = step(s, Intent.Right);
    if (landed < 0 && Math.abs(s.player.y - road.top) < 3) landed = i;
  }
  assert.ok(landed >= 0, "the lift never got you up there");
  assert.ok(
    s.player.x >= s0.toX,
    `walked the road to ${Math.round(s.player.x)}, span ends at ${s0.toX}`,
  );
  assert.equal(s.outcome, "running", "and crossing it is not a way to die");
  assert.equal(s.player.hp, tuning.player.maxHp, "or a way to get hurt");
});
