/**
 * The Kiln — environment 2's mini-boss.
 *
 * The Warden is a fight you have with your hands and the right place to stand
 * is directly in front of it. This one is a fight you have with your feet: the
 * front of it is on fire, so there is no trading, only approaching. What is
 * asserted here is that the heat is real, that its two attacks are still
 * answered in opposite ways, that the floor is what tells you the eruption is
 * coming, and that the exit behind it is genuinely shut.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createInitialState,
  goblin,
  kiln,
  kilnPost,
  step,
  Intent,
  type SimState,
  type Enemy,
} from "./index.ts";
import { bossArena, eruptionAt, kilnAura, isLock } from "./step.ts";
import { tuning } from "../config/tuning.ts";
import { exitX } from "../config/terrain.ts";

/**
 * Dormant while `tuning.miniBosses` is off.
 *
 * The Kiln is not placed in the world at the moment — the game has one boss now,
 * at the bottom. Every test below still describes it correctly and every one of
 * them would pass again the moment the flag goes back, so they skip rather than
 * being deleted: a deleted test is a behaviour nobody is watching any more.
 */
const MINI_BOSSES_OFF: false | string = tuning.miniBosses
  ? false
  : "mini-bosses are turned off (tuning.miniBosses)";

const K = tuning.enemies.kiln;
const FLOOR: number = tuning.room.floorY;
const BAR = tuning.player.maxHp / tuning.player.healthBars;

function arena(atX: number, levels: Record<string, number> = {}): SimState {
  const base = createInitialState(60 * 60 * 20, {
    loadout: { levels, skin: null, pet: null },
  });
  return {
    ...base,
    entered: true,
    deepestX: kilnPost,
    player: { ...base.player, x: atX, y: FLOOR, facing: 1 },
    enemies: [kiln(kilnPost, FLOOR)],
  };
}

const boss = (s: SimState): Enemy => s.enemies[0];

// -------------------------------------------------------------- the place

test(
  "it stands in front of the way out of the fire",
  { skip: MINI_BOSSES_OFF },
  () => {
    const s = createInitialState();
    const placed = s.enemies.filter((e) => e.kind === "enemy.kiln");
    assert.equal(placed.length, 1, "one of them, and only one");
    assert.equal(placed[0].x, kilnPost, "not jittered — it is geometry");
    assert.ok(placed[0].x < exitX, "and in front of the door it is holding");
  },
);

test(
  "the same post is used by both modules that need it",
  { skip: MINI_BOSSES_OFF },
  () => {
    // `step.ts` writes the expression a second time because `index` imports it
    // and the arrow cannot point back. This is what keeps the two equal.
    assert.equal(kilnPost, exitX - 210);
  },
);

test(
  "its chest answers to it, and not to the other boss",
  { skip: MINI_BOSSES_OFF },
  () => {
    // One lock used to open every sealed chest in the world. Killing the Warden
    // at the end of the rock handed the player this chest from two environments
    // away, before they had met the thing standing over it.
    const s = createInitialState();
    const mine = s.chests.find((c) => c.id === "chest.kiln");
    assert.ok(mine, "it has one");
    assert.equal(mine!.locked, true);
    assert.equal(mine!.lockedBy, "enemy.kiln");

    const other = s.chests.find((c) => c.id === "chest.warden");
    assert.equal(
      other!.lockedBy,
      "enemy.warden",
      "and the Warden keeps its own",
    );
  },
);

test("it is a lock, like the other one", { skip: MINI_BOSSES_OFF }, () => {
  assert.equal(isLock("enemy.kiln"), true);
  assert.equal(isLock("enemy.warden"), true);
  assert.equal(isLock("enemy.goblin"), false, "and ordinary bodies are not");
});

// --------------------------------------------------------------- the heat

test(
  "standing in its heat sets you alight; standing outside does not",
  { skip: MINI_BOSSES_OFF },
  () => {
    // The whole design. There is no answer to this and it is not an attack — it
    // is the reason the front of this boss is not a place you can live.
    function stand(gap: number) {
      let s = arena(kilnPost - gap);
      let lit = 0;
      for (let i = 0; i < K.auraInterval * 3; i++) {
        // Held still and doing nothing, so what is measured is the heat alone.
        s = { ...s, enemies: [{ ...boss(s), phase: "idle", phaseTicks: 0 }] };
        s = step(s, Intent.None);
        lit += s.events.filter((e) => e.type === "caughtFire").length;
      }
      return lit;
    }

    assert.ok(stand(60) > 0, "inside the ring, you burn");
    assert.equal(stand(K.auraRadius + 90), 0, "outside it, you do not");
  },
);

test(
  "and camping in its face loses the fight",
  { skip: MINI_BOSSES_OFF },
  () => {
    // The failure mode, asserted rather than assumed: a player who fights this
    // like they fought the Warden — walk up, stand there, trade — dies.
    let s = arena(kilnPost - 240);
    let t = 0;
    while (t < 60 * 40 && s.outcome === "running" && boss(s).phase !== "dead") {
      const gap = Math.abs(s.player.x - boss(s).x);
      s = step(s, gap > K.reach - 20 ? Intent.Right : Intent.Attack);
      t++;
    }
    assert.equal(s.outcome, "died", "standing in it is not survivable");
    assert.ok(boss(s).hp > K.maxHp * 0.5, `it got the boss to ${boss(s).hp}`);
  },
);

test(
  "the heat widens when it opens up at half health",
  { skip: MINI_BOSSES_OFF },
  () => {
    const fresh = kiln(kilnPost, FLOOR);
    const hurt = { ...fresh, hp: K.maxHp * K.enrageAt };
    assert.equal(kilnAura(fresh), K.auraRadius);
    assert.ok(kilnAura(hurt) > kilnAura(fresh), "and the ring grows with it");
  },
);

// ------------------------------------------------------------ the attacks

test(
  "the rake is parryable and the eruption is not",
  { skip: MINI_BOSSES_OFF },
  () => {
    // The Warden's rule, kept: two attacks, opposite answers, so the block cannot
    // be the answer to everything.
    let close = arena(kilnPost - K.reach + 20);
    close = {
      ...close,
      enemies: [{ ...boss(close), phase: "idle", phaseTicks: 0, facing: -1 }],
    };
    // Tapped, not held. The parry is the first few frames of a block, so holding
    // the button is a guard and not a parry — the press has to be fresh.
    let parries = 0;
    let held = false;
    for (let i = 0; i < 400; i++) {
      const b = boss(close);
      const landing =
        b.attackKind === "swing" &&
        b.phase === "telegraphing" &&
        b.phaseTicks >= K.telegraph - 3;
      const press: boolean = landing && !held;
      held = press;
      close = step(close, press ? Intent.Block : Intent.None);
      parries += close.events.filter((e) => e.type === "parry").length;
    }
    assert.ok(parries > 0, "the rake can be caught");

    // And the eruption, from out at range, cannot be — blocking through a whole
    // eruption still costs health.
    let far = arena(kilnPost - 260);
    far = { ...far, enemies: [{ ...boss(far), phase: "idle", phaseTicks: 0 }] };
    let blocked = 0;
    let hurt = 0;
    const before = far.player.hp;
    for (let i = 0; i < 400; i++) {
      // Tapped every other frame, so a parry window is open almost constantly.
      far = step(far, i % 2 === 0 ? Intent.Block : Intent.None);
      blocked += far.events.filter((e) => e.type === "parry").length;
      hurt += far.events.filter((e) => e.type === "playerHit").length;
    }
    assert.equal(blocked, 0, "there is nothing to parry out there");
    assert.ok(
      hurt > 0 && far.player.hp < before,
      "and the floor does not care",
    );
  },
);

test(
  "the eruption marches outward instead of arriving all at once",
  { skip: MINI_BOSSES_OFF },
  () => {
    // The columns are staggered so the row travels away from the boss. All at
    // once would be a wall; in sequence it is something to move through.
    let s = arena(kilnPost - 300);
    s = { ...s, enemies: [{ ...boss(s), phase: "idle", phaseTicks: 0 }] };
    for (let i = 0; i < 200 && s.eruptions.length === 0; i++)
      s = step(s, Intent.None);
    assert.ok(s.eruptions.length >= K.eruptColumns, "it called a row of them");

    const ordered = [...s.eruptions].sort((a, b) => b.ticks - a.ticks);
    for (let i = 1; i < ordered.length; i++) {
      assert.ok(
        ordered[i - 1].ticks > ordered[i].ticks,
        "each column is behind the one before it",
      );
      assert.ok(
        Math.abs(ordered[i].x - ordered[i - 1].x) >= K.eruptSpacing - 1,
        "and lands further out",
      );
    }
  },
);

test(
  "a column tells before it fires, and only bites on the way up",
  { skip: MINI_BOSSES_OFF },
  () => {
    // The tell is on the FLOOR, not on the boss — the boss is already recovering
    // by the time the far column arrives, so reading the monster is reading the
    // wrong thing. And it bites once: a column that hurt every frame of its
    // window would be unjumpable rather than hard.
    const column = { x: 1000, ticks: 0 };
    assert.equal(eruptionAt(column).tell, true, "cracks first");
    assert.equal(eruptionAt(column).live, false);
    assert.equal(eruptionAt({ ...column, ticks: K.eruptTell }).live, true);
    assert.ok(
      eruptionAt({ ...column, ticks: K.eruptTell }).top < FLOOR,
      "and rises",
    );
    assert.equal(
      eruptionAt({ ...column, ticks: K.eruptTell + K.eruptLive }).spent,
      true,
      "then it is gone",
    );
    assert.ok(
      K.eruptTell > 20,
      `only ${K.eruptTell} ticks of warning is not a warning`,
    );
  },
);

test(
  "it can be beaten by someone who respects the heat",
  { skip: MINI_BOSSES_OFF },
  () => {
    // The other half of the camping test. If the answer to the aura were "there
    // isn't one", the fight would be a wall rather than a lesson.
    let s = arena(kilnPost - 220);
    let t = 0;
    while (
      t < 60 * 120 &&
      s.outcome === "running" &&
      boss(s).phase !== "dead"
    ) {
      const b = boss(s);
      const gap = Math.abs(s.player.x - b.x);
      const grounded = s.player.y >= FLOOR - 1;
      const under = s.eruptions.some(
        (r) => Math.abs(r.x - s.player.x) < 34 && r.ticks >= K.eruptTell - 10,
      );
      const open = b.phase === "recovering" || b.phase === "staggered";

      let intent: number = Intent.None;
      if (under && grounded) intent = Intent.Jump;
      else if (open && gap <= K.reach - 10) intent = Intent.Attack;
      else if (open) intent = b.x > s.player.x ? Intent.Right : Intent.Left;
      else if (gap < kilnAura(b) + 30)
        intent = b.x > s.player.x ? Intent.Left : Intent.Right;

      s = step(s, intent);
      t++;
    }
    assert.equal(boss(s).phase, "dead", `it survived on ${boss(s).hp}`);
    assert.equal(s.outcome, "running", "and the player is still standing");
    assert.ok(
      100 - s.player.hp <= BAR * 3,
      `it cost ${(100 - s.player.hp) / BAR} bars, which is not a mini-boss`,
    );
  },
);

// ------------------------------------------------------------- the arena

test("getting close shuts you in with it", { skip: MINI_BOSSES_OFF }, () => {
  // A boss fight was being decided by the corridor it happened in: back out of
  // range and plink, or let it drift into a pool two set pieces away. The walls
  // make the fight the fight.
  let s = arena(kilnPost - K.arenaTrigger + 20);
  for (let i = 0; i < 30; i++) s = step(s, Intent.None);
  assert.equal(s.inArena, true, "the walls came down");

  // Now run for the exit, hard, for long enough to have crossed the room twice.
  for (let i = 0; i < 400; i++) s = step(s, Intent.Left);
  assert.ok(
    s.player.x >= kilnPost - K.arena - 1,
    `walked out to ${s.player.x.toFixed(0)}; the wall is at ${kilnPost - K.arena}`,
  );
  assert.equal(s.inArena, true, "and it is still shut");
});

test(
  "but they are not there before you commit",
  { skip: MINI_BOSSES_OFF },
  () => {
    // A wall that only appeared when you tried to leave would be a trap. This one
    // is visible from outside and walking in is a decision.
    let s = arena(kilnPost - K.arenaTrigger - 400);
    s = step(s, Intent.None);
    assert.equal(s.inArena, false, "no room until you approach");
    assert.equal(bossArena(s.enemies, s.player.x, s.inArena), null);
  },
);

test("and they open again once it is dead", { skip: MINI_BOSSES_OFF }, () => {
  let s = arena(kilnPost - 200);
  for (let i = 0; i < 20; i++) s = step(s, Intent.None);
  assert.equal(s.inArena, true);
  s = { ...s, enemies: [{ ...boss(s), hp: 0, phase: "dead" }] };
  s = step(s, Intent.None);
  assert.equal(s.inArena, false, "a dead boss holds nothing");
  for (let i = 0; i < 200; i++) s = step(s, Intent.Left);
  assert.ok(s.player.x < kilnPost - K.arena, "and you can leave");
});

test(
  "nothing ordinary gets in while you are in there",
  { skip: MINI_BOSSES_OFF },
  () => {
    // Being hit from behind by a goblin while reading a boss's one attack is not
    // the fight anybody designed.
    let s = arena(kilnPost - 200);
    s = {
      ...s,
      enemies: [
        ...s.enemies,
        { ...goblin(kilnPost - 240, FLOOR), phase: "idle" },
      ],
    };
    for (let i = 0; i < 240; i++) s = step(s, Intent.None);

    const intruder = s.enemies.find((e) => e.kind === "enemy.goblin")!;
    assert.ok(
      intruder.x <= kilnPost - K.arena,
      `a goblin got in as far as ${intruder.x.toFixed(0)}`,
    );
  },
);
