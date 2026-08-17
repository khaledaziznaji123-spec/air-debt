/**
 * The tutorial hall.
 *
 * One test, and it is the only one that matters: can the hall actually be
 * finished. Every station is geometry that blocks a player who has not learnt
 * its verb — the gap is wider than a stride, the lintel lower than a crouch,
 * the pool roofed in the middle — so a bot that knows the verbs has to get
 * through and a bot missing one has to get stuck. That makes this a test of the
 * TEACHING rather than of the code: if a station stops gating, this still
 * passes, so the second test checks each gate individually.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createInitialState, step, Intent, type SimState } from "./index.ts";
import {
  builtEnd,
  chamber,
  roomAt,
  tutorial as TUT,
} from "../config/terrain.ts";

/** A bot that knows every verb, driven by whichever lesson it is on. */
function run(skip?: string): { reached: string; state: SimState; ticks: number } {
  let s: SimState = createInitialState(60 * 60 * 20, { tutorial: true });
  let last = s.tutorial!.step;
  let changed = 0;
  for (let i = 0; i < 60 * 300; i++) {
    const t = s.tutorial!;
    const p = s.player;
    let it: number = Intent.Right;
    // Anything alive standing in the way gets hit, whatever lesson we are on.
    // Enemy bodies block the player, and the stun station's goblin SURVIVES its
    // lesson by design — a stun staggers, it does not kill — so it stands in
    // the corridor afterwards. A player would swing at it without thinking;
    // a bot that only walks stands there forever, which is not the hall's
    // fault and should not read as the hall's fault.
    const target =
      t.step === "fight"
        ? TUT.goblinX
        : t.step === "stun"
          ? TUT.stunX
          : t.step === "smash"
            ? TUT.smashX
            : null;
    const inTheWay = s.enemies.find(
      (e) =>
        e.phase !== "dead" &&
        e.kind === "enemy.goblin" &&
        Math.abs(e.x - p.x) < 62 &&
        (target === null || Math.abs(e.x - target) > 280),
    );
    if (inTheWay) {
      s = step(s, i % 12 < 3 ? Intent.Attack : Intent.None);
      if (s.tutorial!.step !== last) {
        last = s.tutorial!.step;
        changed = i;
      }
      continue;
    }
    switch (t.step) {
      case "walk":
        break;
      case "jump":
        if (skip !== "jump" && p.x > TUT.gap.x0 - 46) it |= Intent.Jump;
        break;
      case "slide":
        if (skip !== "slide" && p.x > TUT.lintel.x0 - 90 && i % 20 < 2)
          it |= Intent.Slide;
        break;
      // Standing still and tapping the slide key. Holding a direction here is
      // the difference between the two moves, so the bot must genuinely let go.
      case "back":
        // Tapped, not held. Both moves on this key are edge-triggered, so a bot
        // that leans on it presses once and then never again — which is also
        // exactly what a player does when they hold the key and conclude the
        // move is broken.
        it = skip === "back" ? Intent.None : i % 20 < 2 ? Intent.Slide : Intent.None;
        break;
      case "wall": {
        // Walk in, fall to the bottom, then jump and kick off a face. The kick
        // does not need the direction still held — only that a wall was there
        // within the last six ticks — but holding into it is what makes the
        // cling happen in the first place.
        const inSlot = p.x > TUT.slot.x0 - 10 && p.x < TUT.slot.x1 + 10;
        if (!inSlot) break;
        if (skip === "wall") break;
        it = Intent.Right | (p.stance === "grounded" || p.vy > 0 ? Intent.Jump : 0);
        break;
      }
      case "fight":
      case "stun":
      case "smash": {
        const near = t.step === "fight" ? TUT.goblinX : t.step === "stun" ? TUT.stunX : TUT.smashX;
        const g = s.enemies.find(
          (e) =>
            e.kind === "enemy.goblin" &&
            e.phase !== "dead" &&
            Math.abs(e.x - near) < 280,
        );
        if (!g) break;
        const d = g.x - p.x;
        if (t.step === "smash") {
          // Get above it and drop. The ledge is there to fall off; from the
          // floor a plain jump is enough of a drop for the dive to be a dive.
          if (skip === "smash") { it = Intent.Right; break; }
          it =
            Math.abs(d) > 40
              ? d > 0
                ? Intent.Right
                : Intent.Left
              : p.stance === "grounded"
                ? Intent.Jump
                : p.vy < 0
                  ? Intent.None
                  : Intent.Crouch;
          break;
        }
        if (Math.abs(d) > 56) {
          it = d > 0 ? Intent.Right : Intent.Left;
          break;
        }
        if (skip === t.step) { it = Intent.None; break; }
        it =
          t.step === "fight"
            ? i % 12 < 3
              ? Intent.Attack
              : Intent.None
            : i % 16 < 3
              ? Intent.Stun
              : Intent.None;
        break;
      }
      case "parry": {
        const a = s.enemies.find(
          (e) => e.kind === "enemy.archer" && e.phase !== "dead",
        );
        if (!a) break;
        const shot = s.arrows.find(
          (r) => !r.returned && Math.abs(r.x - p.x) < 60,
        );
        it =
          shot && skip !== "parry"
            ? Intent.Block
            : Math.abs(a.x - p.x) > 320
              ? Intent.Right
              : Intent.None;
        break;
      }
      case "dive": {
        // Down for the plug, up once past it. Holding down the whole way is how
        // you end the swim pinned to the bed unable to climb the far bank.
        const under = p.x > TUT.pool.x0 - 40 && p.x < TUT.plug.x1 + 60;
        if (skip === "dive") it = Intent.Right | Intent.Jump;
        else it = Intent.Right | (under ? Intent.Crouch : Intent.Jump);
        break;
      }
      case "loot":
        it = p.x < TUT.chestX - 30 ? Intent.Right : Intent.Interact;
        break;
      default:
        break;
    }
    s = step(s, it);
    if (s.tutorial!.step !== last) {
      last = s.tutorial!.step;
      changed = i;
    }
    // Nothing in here should take forty seconds. If it has, it is stuck.
    if (i - changed > 60 * 40) return { reached: last, state: s, ticks: i };
    if (last === "leave") return { reached: last, state: s, ticks: i };
  }
  return { reached: last, state: s, ticks: 60 * 300 };
}

test("the tutorial can be finished", () => {
  const { reached, state, ticks } = run();
  assert.equal(reached, "leave", `it got stuck on "${reached}"`);
  // And it paid, because the last thing it teaches is what the gems are for.
  assert.ok(
    state.carried.gems[0] > 0,
    "it reached the end carrying nothing to spend",
  );
  // A sanity bound rather than a target: a bot playing perfectly should be
  // through in well under a minute, and anything near the cap means a station
  // is being passed by waiting rather than by doing.
  assert.ok(ticks < 60 * 90, `took ${Math.round(ticks / 60)}s`);
});

test("every station is a wall to someone who has not learnt it", () => {
  // The point of the hall. A station a player can wander past teaches nothing,
  // and it is the easy thing to break — widen a gap, raise a lintel, and the
  // lesson quietly becomes scenery while every other test still passes.
  for (const [verb, stops] of [
    ["jump", "jump"],
    ["slide", "slide"],
    ["back", "back"],
    ["wall", "wall"],
    ["fight", "fight"],
    ["stun", "stun"],
    ["smash", "smash"],
    ["parry", "parry"],
    ["dive", "dive"],
  ] as const) {
    const { reached } = run(verb);
    assert.equal(
      reached,
      stops,
      `a player who never used ${verb} got past the ${stops} station`,
    );
  }
});

test("it is god mode, so nothing in the hall can end the run", () => {
  // A tutorial that kills you teaches you to stop playing.
  const s = createInitialState(60 * 60 * 20, { tutorial: true });
  assert.equal(s.god, true);
  assert.equal(s.tutorial?.step, "walk");
  assert.ok(s.player.x > TUT.x0 && s.player.x < TUT.x1, "it spawns in the hall");
});

test("a real run has no tutorial state at all", () => {
  // Null rather than a step nobody is on, so nothing downstream has to ask
  // whether the tutorial it can see is the one being played.
  const s = createInitialState();
  assert.equal(s.tutorial, null);
  assert.equal(step(s, Intent.None).tutorial, null);
});

test("the hall is a room the world knows about", () => {
  // Both rooms past the end of the world answer to one function, and the reason
  // is written on the scar tissue: "clamp to the end of the world" was written
  // out longhand in six places, each hardcoding the chamber by name, and every
  // single one had to be found by watching something get silently dragged four
  // hundred units west. The camera was the sixth — without it the boss fight
  // happened entirely off the right edge of the screen.
  //
  // So the hall gets checked the same way. If `roomAt` stops knowing about it,
  // the tutorial plays somewhere the player cannot see.
  assert.deepEqual(roomAt(TUT.spawnX), { x0: TUT.x0, x1: TUT.x1 });
  assert.deepEqual(roomAt(TUT.doorX), { x0: TUT.x0, x1: TUT.x1 });
  assert.deepEqual(roomAt(chamber.insideX), { x0: chamber.x0, x1: chamber.x1 });
  // And the dungeon proper is not a room, or every clamp in the game changes.
  assert.equal(roomAt(builtEnd - 500), null);
  // The two do not overlap: the hall starts well past where the chamber ends.
  assert.ok(TUT.x0 > chamber.x1 + 400, "the hall crowds the boss chamber");
});

test("the hall can always be walked out of", () => {
  // FR-4.2, applied to the tutorial: retreating has to be a decision you can
  // always make. Every station in here is a wall to somebody who has not learnt
  // its verb, which is the design — and the failure mode of that design is a
  // player beaten by the wall jump sealed in a room forever.
  //
  // So the door behind the spawn works on the FIRST step, before a single
  // lesson has been passed. If this ever needs a step to be reached, the hall
  // is a trap again.
  let s: SimState = createInitialState(60 * 60 * 20, { tutorial: true });
  s = { ...s, player: { ...s.player, x: TUT.backX } };
  s = step(s, Intent.None);
  assert.equal(s.tutorial?.step, "walk", "it has not passed anything yet");
  s = step(s, Intent.Interact);
  assert.equal(s.outcome, "extracted", "the door behind the spawn did nothing");

  // And the far door, likewise, without having finished.
  let mid: SimState = createInitialState(60 * 60 * 20, { tutorial: true });
  mid = {
    ...mid,
    tutorial: { step: "wall", ticks: 0, justPassed: false },
    player: { ...mid.player, x: TUT.doorX },
  };
  mid = step(mid, Intent.None);
  mid = step(mid, Intent.Interact);
  assert.equal(mid.outcome, "extracted", "the far door needed the last lesson");
});
