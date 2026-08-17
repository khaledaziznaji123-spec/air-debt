/**
 * The Warden — environment 1's mini-boss.
 *
 * It is the first thing in the game that is a LOCK rather than an obstacle, and
 * a lock has exactly two ways to be wrong: it does not hold, or it cannot be
 * opened. Both are asserted here, along with the thing that makes it a fight
 * worth having — that its two attacks are answered in opposite ways, and that
 * the riders can be dealt with by more than one route.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createInitialState,
  step,
  Intent,
  wardenPost,
  goblin,
  type SimState,
} from "./index.ts";
import { tuning } from "../config/tuning.ts";
import { exitX, gateX, terrain } from "../config/terrain.ts";

/**
 * Dormant while `tuning.miniBosses` is off.
 *
 * The Warden is not placed in the world at the moment — the game has one boss now,
 * at the bottom. Every test below still describes it correctly and every one of
 * them would pass again the moment the flag goes back, so they skip rather than
 * being deleted: a deleted test is a behaviour nobody is watching any more.
 */
const MINI_BOSSES_OFF: false | string = tuning.miniBosses
  ? false
  : "mini-bosses are turned off (tuning.miniBosses)";

const W = tuning.enemies.warden;
const FLOOR: number = tuning.room.floorY;

function atTheDoor(fromX: number): SimState {
  const base = createInitialState(60 * 60 * 10);
  return {
    ...base,
    entered: true,
    deepestX: fromX,
    player: { ...base.player, x: fromX, y: FLOOR, facing: 1 },
    // Everything except the bosses and the Warden's riders, so a stray goblin
    // can never be what decides one of these. The Kiln is kept because the far
    // exit is ITS door now — filtered out, every test that walks into the exit
    // extracts, which is the door being open rather than the lock working.
    enemies: base.enemies.filter(
      (e) =>
        e.kind === "enemy.warden" ||
        e.kind === "enemy.kiln" ||
        e.shoulder !== null,
    ),
  };
}

const boss = (s: SimState) => s.enemies.find((e) => e.kind === "enemy.warden")!;
const riders = (s: SimState) => s.enemies.filter((e) => e.shoulder !== null);

test(
  "the Warden and its two riders are placed on the exit",
  { skip: MINI_BOSSES_OFF },
  () => {
    const s = createInitialState(600);
    const w = s.enemies.filter((e) => e.kind === "enemy.warden");
    assert.equal(w.length, 1, "exactly one");
    assert.ok(
      Math.abs(w[0].x - wardenPost) < 1,
      "standing at its post, not jittered by the seed — it is geometry",
    );
    assert.ok(w[0].x < gateX, "and in front of the door it is holding");

    const r = s.enemies.filter((e) => e.shoulder !== null);
    assert.equal(r.length, 2, "one on each shoulder");
    assert.deepEqual(
      r.map((e) => e.shoulder).sort(),
      [-1, 1],
      "and not both on the same one",
    );
    for (const rider of r) {
      assert.ok(rider.verbs.shoot, "a rider is still an archer");
      assert.ok(rider.y < w[0].y - 80, "and is up on the shoulder");
    }
  },
);

test(
  "the same post is used by both modules that need it",
  { skip: MINI_BOSSES_OFF },
  () => {
    // `step.ts` cannot import it from `index.ts` — index imports step — so the
    // expression is written twice. This is the assertion that keeps them equal.
    //
    // Against the GATE, not the exit. They were the same number until environment
    // 2 was built and the exit moved to the far end of the fire; the Warden did
    // not move with it, because what it guards is the way onward.
    assert.equal(wardenPost, gateX - 190);
    assert.ok(gateX < exitX, "the gate is not the exit any more");
  },
);

test(
  "the exit belongs to whichever boss is standing on it",
  { skip: MINI_BOSSES_OFF },
  () => {
    // It was this one, when environment 1 was the world. It is the Kiln now: the
    // exit moved to the far end of the fire and the Warden stayed on the gate,
    // so the thing that has to be dead before the far door opens is the thing
    // actually standing in front of it.
    let s = atTheDoor(exitX + 20);
    s = step(s, Intent.None);
    assert.equal(s.outcome, "running", "the door is shut");

    const holder = s.enemies.find((e) => e.kind === "enemy.kiln");
    assert.ok(holder, "and the fire's boss is what is holding it");
    assert.notEqual(holder!.phase, "dead");

    // Killing the WARDEN, two environments back, must not open it.
    let wrong = atTheDoor(exitX + 20);
    wrong = {
      ...wrong,
      enemies: wrong.enemies.map((e) =>
        e.kind === "enemy.warden" ? { ...e, hp: 0, phase: "dead" as const } : e,
      ),
    };
    wrong = step(wrong, Intent.None);
    assert.equal(wrong.outcome, "running", "the wrong boss opens nothing");
  },
);

test(
  "and it opens the moment that boss dies",
  { skip: MINI_BOSSES_OFF },
  () => {
    let s = atTheDoor(exitX + 20);
    s = {
      ...s,
      enemies: s.enemies.map((e) =>
        e.kind === "enemy.kiln" ? { ...e, hp: 0, phase: "dead" as const } : e,
      ),
    };
    s = step(s, Intent.None);
    assert.equal(s.outcome, "extracted", "the door opens with it");
  },
);

test(
  "the mouth is never sealed, so the boss is a choice and not a countdown",
  { skip: MINI_BOSSES_OFF },
  () => {
    // A player who arrives with eight seconds of air has to be able to turn round
    // and bank what they are carrying. If both ways out were shut, meeting the
    // Warden late would simply be death, and the whole extraction decision — the
    // thing the air timer exists to argue with — would stop applying at the end
    // of the environment.
    let s = atTheDoor(tuning.room.entranceX - 20);
    s = step(s, Intent.None);
    assert.equal(s.outcome, "extracted", "back out through the mouth, always");
  },
);

test(
  "its chest is sealed until it is dead, then opens",
  { skip: MINI_BOSSES_OFF },
  () => {
    const chestOf = (s: SimState) =>
      s.chests.find((c) => c.id === "chest.warden")!;
    const fresh = createInitialState(600);
    assert.ok(chestOf(fresh).locked, "shut to begin with");

    // Standing on it and pressing the button does nothing at all.
    let s = atTheDoor(chestOf(fresh).x);
    s = { ...s, player: { ...s.player, y: chestOf(fresh).y } };
    for (let i = 0; i < 20; i++)
      s = step(s, i % 2 ? Intent.None : Intent.Interact);
    assert.equal(chestOf(s).opened, false, "the boss is the lock");

    // Kill it, and the same press works.
    s = {
      ...s,
      enemies: s.enemies.map((e) =>
        e.kind === "enemy.warden" ? { ...e, hp: 0, phase: "dead" as const } : e,
      ),
    };
    s = step(s, Intent.None);
    assert.equal(chestOf(s).locked, false, "dying unlocks it");
    for (let i = 0; i < 20 && !chestOf(s).opened; i++) {
      s = step(s, i % 2 ? Intent.None : Intent.Interact);
    }
    assert.equal(chestOf(s).opened, true, "and then it opens");
  },
);

test(
  "it has one attack, and one answer to it",
  { skip: MINI_BOSSES_OFF },
  () => {
    // It used to have two — a cut up close and a slam from range, answered in
    // opposite ways. The slam is gone. The two archers on its shoulders are the
    // ranged half of this fight and always were; giving the body a ranged attack
    // as well meant the player was reading three things at once and the one they
    // were supposed to be learning — the parry — was the one they had least time
    // for.
    //
    // So: whatever the distance, when it commits it commits to the same thing,
    // and that thing can be caught.
    for (const gap of [W.reach - 20, 160, 240]) {
      let s = atTheDoor(wardenPost - gap);
      for (let i = 0; i < 200 && boss(s).phase !== "telegraphing"; i++) {
        s = step(s, Intent.None);
      }
      if (boss(s).phase !== "telegraphing") continue;
      assert.equal(
        boss(s).attackKind,
        "swing",
        `at ${gap} it should still cut`,
      );
    }
  },
);

test("and the swing can be parried", { skip: MINI_BOSSES_OFF }, () => {
  let s = atTheDoor(wardenPost - W.reach + 20);
  s = {
    ...s,
    enemies: s.enemies.map((e) =>
      e.shoulder === null ? e : { ...e, phase: "dead" as const },
    ),
  };

  // Tapped rather than held: the parry is the opening frames of a block, so a
  // held button is a guard and not a parry.
  let parries = 0;
  let held = false;
  for (let i = 0; i < 400; i++) {
    const b = boss(s);
    const landing =
      b.phase === "telegraphing" && b.phaseTicks >= W.telegraph - 3;
    const press: boolean = landing && !held;
    held = press;
    s = step(s, press ? Intent.Block : Intent.None);
    parries += s.events.filter((e) => e.type === "parry").length;
  }
  assert.ok(parries > 0, "its one attack is answerable");
});

test("its wind-up is long enough to read", { skip: MINI_BOSSES_OFF }, () => {
  // The fight is one read repeated now, so the read has to be a fair one. Under
  // about a second it stops being a decision and becomes a reflex test.
  assert.ok(
    W.telegraph >= 60,
    `${W.telegraph} ticks of wind-up is not enough to see`,
  );
});

test(
  "the riders ride — they are carried, not walking alongside",
  { skip: MINI_BOSSES_OFF },
  () => {
    let s = atTheDoor(wardenPost - 300);
    for (let i = 0; i < 120; i++) s = step(s, Intent.None);

    const w = boss(s);
    for (const r of riders(s)) {
      assert.ok(
        Math.abs(r.x - (w.x + (r.shoulder ?? 0) * W.shoulderX)) < 1,
        "pinned horizontally to the host",
      );
      assert.ok(
        Math.abs(r.y - (w.y - W.shoulderY)) < 1,
        "and vertically — a rider has no legs of its own",
      );
    }
  },
);

test(
  "a rider dies to one hit, like any archer",
  { skip: MINI_BOSSES_OFF },
  () => {
    // It is an archer. Being carried does not make it tougher — the boss's health
    // is the boss's, and FR-7.2 says difficulty is verbs rather than padding.
    const s = createInitialState(600);
    for (const r of s.enemies.filter((e) => e.shoulder !== null)) {
      assert.ok(
        r.hp <= tuning.player.attackDamage,
        `a rider on ${r.hp} hp survives a sword hit`,
      );
    }
  },
);

test(
  "it leashes to its post rather than chasing you home",
  { skip: MINI_BOSSES_OFF },
  () => {
    // A door does not follow you. Without the leash the boss walks the whole
    // environment after a fleeing player and stops being a door at all.
    let s = atTheDoor(wardenPost - 2000);
    for (let i = 0; i < 60 * 20; i++) s = step(s, Intent.None);
    assert.ok(
      Math.abs(boss(s).x - wardenPost) <= W.leash + 1,
      `wandered to ${boss(s).x.toFixed(0)}, post is ${wardenPost}`,
    );
  },
);

test(
  "it can be killed inside the time the budget allows for it",
  { skip: MINI_BOSSES_OFF },
  () => {
    // FR-20.1 gives the mini-boss ten seconds on top of the traverse. A boss that
    // takes thirty is not hard, it is a different game — it has eaten a third of
    // a maxed tank and the whole budget stops adding up.
    //
    // Modelled as clean hits rather than as played input: this is a question
    // about the health pool, not about whether the harness can dodge.
    const perSwing = tuning.player.attackDamage;
    const swingTotal =
      tuning.player.attackStartup +
      tuning.player.attackActive +
      tuning.player.attackRecovery;
    const hitsNeeded = Math.ceil(W.maxHp / perSwing);
    const ticks = hitsNeeded * swingTotal;

    assert.ok(
      ticks <= tuning.budget.miniBoss,
      `${hitsNeeded} hits is ${ticks} ticks against a budget of ${tuning.budget.miniBoss}`,
    );
  },
);

test(
  "one swing is one hit, however long the blade is live",
  { skip: MINI_BOSSES_OFF },
  () => {
    // The bug this pins: a swing's hitbox stays live for several ticks so that an
    // enemy walking into it mid-swing is still caught, and the damage loop used
    // to run once per tick. One swing landed six times, which divided every
    // health number in the game by six — the Warden's sixty died to a single
    // swing of a ten-damage sword, and a goblin's "two hits" was two TICKS of one.
    let s = atTheDoor(wardenPost - W.reach + 10);
    s = {
      ...s,
      player: { ...s.player, facing: 1 },
      enemies: s.enemies.map((e) =>
        e.kind === "enemy.warden"
          ? { ...e, phase: "idle" as const }
          : { ...e, phase: "dead" as const },
      ),
    };

    const full = boss(s).hp;
    // One press, then held nothing: a single complete swing.
    s = step(s, Intent.Attack);
    for (let i = 0; i < 30; i++) s = step(s, Intent.None);

    const lost = full - boss(s).hp;
    assert.equal(
      lost,
      tuning.player.attackDamage,
      `one swing took ${lost} off a ${full} boss; the sword does ${tuning.player.attackDamage}`,
    );
    assert.notEqual(boss(s).phase, "dead", "and it is very much still there");
  },
);

test(
  "and it takes the whole health pool to put down",
  { skip: MINI_BOSSES_OFF },
  () => {
    // Stated as swings rather than as ticks, which is how the shop prices it.
    const swings = Math.ceil(W.maxHp / tuning.player.attackDamage);
    assert.equal(
      swings,
      6,
      `${swings} swings — the budget was written for six`,
    );
  },
);

test("you cannot slide under it", { skip: MINI_BOSSES_OFF }, () => {
  // A dash passes through every other body in the game — that is what makes
  // the slide an escape as well as a dodge, and it is right for a crowd. It was
  // also a way to skip the boss entirely: hold slide at the right moment and
  // the whole of environment 2 opened up without a swing being thrown.
  //
  // The Warden is a LOCK. Everything else stays permeable.
  let s = atTheDoor(wardenPost - 240);
  s = {
    ...s,
    player: { ...s.player, facing: 1 },
    enemies: s.enemies.map((e) =>
      e.kind === "enemy.warden" || e.shoulder !== null
        ? { ...e, phase: "idle" as const }
        : { ...e, phase: "dead" as const },
    ),
  };

  // Run at it and slide, over and over, for long enough to have crossed it
  // several times if it were permeable.
  for (let i = 0; i < 600; i++) {
    const slide = i % 40 === 0 ? Intent.Slide : Intent.None;
    s = step(s, Intent.Right | slide);
  }

  const boss = s.enemies.find((e) => e.kind === "enemy.warden")!;
  assert.notEqual(boss.phase, "dead", "the fixture never killed it");
  assert.ok(
    s.player.x < boss.x + W.width / 2,
    `slid past the boss to ${s.player.x.toFixed(0)}; it stands at ${boss.x}`,
  );
});

test(
  "and a goblin can still be slid through",
  { skip: MINI_BOSSES_OFF },
  () => {
    // The exception is the boss and nothing else. If sliding stopped working on
    // ordinary bodies, the answer to being surrounded would have quietly gone.
    // On flat floor with nothing on it, found rather than guessed: a fixed offset
    // from the boss lands wherever the pieces happen to be that week, and the
    // last one put the fixture against a wall where nothing could move at all.
    const past = (() => {
      for (let x = wardenPost - 1600; x < wardenPost - 300; x += 20) {
        const clear = [0, 60, 120, 180, 240].every((d) => {
          const at = x + d;
          const floor = terrain.surfaces.some(
            (s2) => at >= s2.x0 && at <= s2.x1 && Math.abs(s2.top - FLOOR) < 1,
          );
          const blocked = terrain.surfaces.some(
            (s2) =>
              at >= s2.x0 - 40 &&
              at <= s2.x1 + 40 &&
              s2.top < FLOOR - 4 &&
              s2.bottom > FLOOR - tuning.player.height,
          );
          return floor && !blocked;
        });
        if (clear) return x;
      }
      throw new Error("nowhere flat in front of the gate");
    })();

    let s = atTheDoor(past);
    s = {
      ...s,
      player: { ...s.player, x: past },
      enemies: [{ ...goblin(past + 90, tuning.room.floorY), phase: "idle" }],
    };
    for (let i = 0; i < 200; i++) {
      s = step(s, Intent.Right | (i % 40 === 0 ? Intent.Slide : Intent.None));
    }
    assert.ok(
      s.player.x > past + 160,
      `a slide should get past a goblin; stopped at ${s.player.x.toFixed(0)}`,
    );
  },
);
