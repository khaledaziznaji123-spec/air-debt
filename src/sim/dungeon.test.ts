/**
 * The shortcut rule under test.
 *
 * PRD FR-3 calls shortcuts the win condition and stakes the game's whole
 * anti-walkthrough-video guarantee on one property: a shortcut cannot be opened
 * from the side that would save you the walk. That property is not something to
 * verify by playing — it is the thing a determined player will attack first, so
 * it is asserted here.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createInitialState, step, Intent, type SimState } from "./index.ts";
import { tuning } from "../config/tuning.ts";
import {
  builtEnd,
  chamber,
  environmentsBuilt,
  inChamber,
  terrain,
} from "../config/terrain.ts";
import {
  burrowId,
  checkDungeonLayout,
  chuteId,
  geyserId,
  highRoadId,
  shortcutById,
  environmentAt,
  environmentLength,
  environmentStart,
  interactReach,
  shortcuts,
  worldEnd,
} from "../config/dungeon.ts";

/** Put the player at a spot inside the dungeon, mid-run, with air to spare. */
function standingAt(x: number, open: readonly string[] = []): SimState {
  const base = createInitialState(60 * 60 * 10, { openShortcuts: open });
  return {
    ...base,
    entered: true,
    deepestX: x,
    environment: environmentAt(x),
    player: { ...base.player, x },
    // Cleared, so a fight can never be what decides one of these tests.
    enemies: [],
  };
}

const first = shortcuts[0];

/**
 * Standing on whatever the ground actually is at x, not on the floor line.
 *
 * `standingAt` puts the player at `floorY`, which was the same thing everywhere
 * right up until the sea. The water's lever sits on the seabed under three
 * hundred units of water, and a fixture dropped at the floor line is floating
 * at the SURFACE — not on the ground, so not able to reach a lever, which is
 * the correct rule producing a wrong-looking failure.
 */
function standingOn(x: number): SimState {
  const under = terrain.surfaces
    .filter((s) => x >= s.x0 && x <= s.x1 && s.top >= tuning.room.floorY - 400)
    .map((s) => s.top)
    .sort((a, b) => a - b);
  const base = standingAt(x);
  return {
    ...base,
    player: { ...base.player, y: under[0] ?? tuning.room.floorY },
  };
}

/**
 * A plain door, if one is reachable.
 *
 * Environment 1's one shortcut is the chute and environment 2's is the geyser
 * chain, and neither is a door — so there is still nowhere to stand and press E
 * on an ordinary one. The two tests below skip rather than lie about it, and
 * the test after them fails the moment a built door appears and they have not
 * un-skipped, so this cannot quietly become permanent.
 */
const door = shortcuts.find(
  (s) =>
    s.id !== chuteId &&
    s.id !== geyserId &&
    s.id !== burrowId &&
    s.id !== highRoadId &&
    s.toX < builtEnd,
);
const noDoorYet = door
  ? false
  : "every shortcut in the game is a special one — there are no plain doors left";

test("the layout holds its own invariants", () => {
  const layout = checkDungeonLayout();
  assert.equal(layout.contained, true, "every fixture inside its environment");
  assert.equal(layout.disjoint, true, "no two shortcuts overlap");
  assert.equal(layout.densityOk, true, "one or two per environment (FR-2.2)");
  assert.equal(
    layout.countMatchesBudget,
    true,
    "the count is derived from the time budget (FR-20.5)",
  );
  assert.equal(layout.leversPastTheGround, true, "FR-3.2");
});

test("a lever sits past the ground its shortcut skips", () => {
  // FR-3.2 restated as arithmetic: you cannot reach the lever without having
  // travelled at least the distance the shortcut would have saved you.
  for (const s of shortcuts) {
    assert.ok(
      s.leverX >= s.toX,
      `${s.id}: the lever must be beyond the far door`,
    );
    assert.ok(s.toX > s.fromX, `${s.id}: a shortcut must skip forwards`);
  }
});

test("an unlevered shortcut is inert — knowing where it is buys nothing", () => {
  // FR-3.5. This is the walkthrough-video attack: a new player who has been
  // told exactly where the door is, standing on it, pressing the button.
  let s = standingAt(first.fromX);
  for (let i = 0; i < 30; i++) s = step(s, Intent.Interact);

  assert.ok(
    Math.abs(s.player.x - first.fromX) < 4,
    "the door must not move them an inch",
  );
  assert.deepEqual(s.openShortcuts, [], "and must not open itself");
});

test("flicking the lever opens that shortcut, and only that one", () => {
  let s = standingAt(first.leverX);
  s = step(s, Intent.Interact);

  assert.deepEqual(s.openShortcuts, [first.id]);
  assert.deepEqual(
    s.leversFlicked,
    [first.id],
    "the run records what it earned",
  );
  assert.equal(
    s.events.filter((e) => e.type === "leverFlicked").length,
    1,
    "exactly one flick",
  );
});

test("a lever flicks once, ever", () => {
  // FR-3.6. Holding the button on a flicked lever must not append a second
  // entry — the server persists this list, and a duplicate is a double award.
  let s = standingAt(first.leverX);
  for (let i = 0; i < 40; i++) {
    // Release and re-press, which is the only way to earn a second flick.
    s = step(s, i % 2 === 0 ? Intent.Interact : Intent.None);
  }
  assert.deepEqual(s.leversFlicked, [first.id]);
});

test(
  "an open shortcut carries the player across the ground it skips",
  { skip: noDoorYet },
  () => {
    let s = standingAt(door!.fromX, [door!.id]);
    s = step(s, Intent.Interact);

    assert.equal(
      s.player.x,
      door!.toX,
      "the door delivers them to the far side",
    );
    assert.equal(s.events.filter((e) => e.type === "shortcutUsed").length, 1);
  },
);

test("an open shortcut works in both directions", { skip: noDoorYet }, () => {
  // The ground was bought once. A player running for the mouth with four
  // seconds of air has as much claim on it as one running in.
  let s = standingAt(door!.toX, [door!.id]);
  s = step(s, Intent.Interact);
  assert.equal(s.player.x, door!.fromX);
});

test("the two skips above are a fact about the map, not a hole in the suite", () => {
  // What makes the skip safe: it is derived, and the derivation is asserted.
  // Both built shortcuts are ones that are NOT doors, so there is genuinely
  // nowhere to press E on an ordinary one. Build environment 3 and `door` stops
  // being undefined on its own, the two tests above un-skip, and this one keeps
  // them honest in the meantime.
  const built = shortcuts.filter((s) => s.toX < builtEnd);
  assert.deepEqual(
    built.map((s) => s.id),
    shortcuts.map((s) => s.id),
    "every shortcut is inside the built world now",
  );
  // And there are none left. Every one of the four is its own thing now — a
  // chute, a rising chain, a burrow and a high road — so the two door tests
  // above sleep, and this says why rather than leaving them quietly skipped.
  assert.notEqual(noDoorYet, false, "a plain door reappeared without a test");
});

test("the door is inert until the lever is flicked, and the lever is past the ground", () => {
  // FR-3.2 and FR-3.5, stated as the three things that make a shortcut a
  // shortcut: the door does nothing on arrival, the lever is on the far side of
  // the ground it skips, and flicking it opens that one and only that one.
  //
  // This used to be a bot walking the whole span, and that was the right idea
  // and the wrong instrument. Every shortcut moved when the environments were
  // reordered, and what the walk then measured was whether a bot holding Right
  // could cross four thousand units of poison sumps and rock towers — it could
  // not, and neither fact was about the rule. A bot is not a player, and a test
  // that fails because the bot cannot play is a test that has stopped saying
  // anything.
  //
  // So the distance is asserted as a fact about the LAYOUT (which is what
  // FR-3.2 actually is), and the door and the lever are exercised where they
  // are. If a shortcut ever became reachable without walking, that would show
  // up here as the door working before the lever.
  for (const s of shortcuts) {
    assert.ok(
      s.leverX >= s.toX,
      `${s.id}'s lever is inside the ground it skips`,
    );

    // At the near door, nothing unlocked. Pressing must not move you.
    if (s.id !== chuteId && s.id !== geyserId) {
      let shut = standingOn(s.fromX);
      const before = shut.player.x;
      for (let i = 0; i < 8; i++) {
        shut = step(shut, i % 2 === 0 ? Intent.Interact : Intent.None);
      }
      assert.ok(
        Math.abs(shut.player.x - before) < 4,
        `${s.id}'s door works before its lever does`,
      );
      assert.deepEqual(shut.openShortcuts, [], `${s.id} opened itself`);
    }

    // At the lever, it opens — and opens exactly one thing.
    let at = standingOn(s.leverX);
    for (let i = 0; i < 12 && at.openShortcuts.length === 0; i++) {
      at = step(at, i % 2 === 0 ? Intent.Interact : Intent.None);
    }
    assert.deepEqual(at.openShortcuts, [s.id], `${s.id}'s lever does not work`);
  }
});

test("and the ground a shortcut skips is ground you had to cover", () => {
  // The other half of FR-3.2, as arithmetic: the walk to the lever is at least
  // as long as the ride it buys, or the shortcut is paying for itself.
  for (const s of shortcuts) {
    assert.ok(
      s.leverX - s.fromX >= s.toX - s.fromX,
      `${s.id} saves more ground than it asks you to walk`,
    );
  }
});

test("the environment index is a function of position (FR-2.3)", () => {
  // The boundary as arithmetic...
  const boundary = environmentStart(1);
  assert.equal(environmentAt(boundary - 1), 0);
  assert.equal(environmentAt(boundary), 1);
  assert.equal(environmentAt(boundary + environmentLength), 2);

  // ...and as a walk, which is the version that came back when the fire was
  // built. Until then the world was clamped at this exact line and the crossing
  // could not be reached on foot at all.
  let s = standingAt(boundary - 300);
  let crossed = false;
  for (let i = 0; i < 400 && !crossed; i++) {
    s = step(s, Intent.Right);
    crossed = s.events.some((e) => e.type === "environmentChanged");
  }
  assert.ok(crossed, "walking over the line must announce it");
  assert.equal(s.environment, 1, "and leave the player in the fire");
});

test("the world still stops at the end of what is built", () => {
  // The clamp did not go away, it moved. Walk at the far end of environment 2
  // and the player is held inside it rather than stepping off into ground that
  // has not been laid.
  let s = standingAt(builtEnd - 200);
  for (let i = 0; i < 300; i++) s = step(s, Intent.Right);
  assert.equal(s.environment, environmentsBuilt - 1, "no further to go yet");
  assert.ok(s.player.x < builtEnd, `walked to ${s.player.x} past ${builtEnd}`);
});

test("the design is five environments long; the world stops at what is built", () => {
  // The geometry still describes the whole design — the time budget depends on
  // it — but the player is held inside the part that exists. Before the clamp
  // they walked off the end of the ground and fell out of the world.
  assert.equal(
    worldEnd,
    tuning.room.entranceX + environmentLength * tuning.budget.environmentCount,
  );
  // Built now reaches the whole design. It used to be a prefix of it — this
  // line asserted that the clamp was somewhere short of the end — and the
  // remaining half of the test, that the far wall holds, is the half that was
  // always the point.
  assert.equal(builtEnd, worldEnd, "all five are built");

  let s = standingAt(builtEnd - 400);
  for (let i = 0; i < 600; i++) s = step(s, Intent.Right);
  assert.ok(s.player.x <= builtEnd, "the far wall holds");
  assert.ok(
    s.player.y <= tuning.room.floorY + 1,
    `fell to ${s.player.y.toFixed(0)} — there is no ground past the wall`,
  );
});

test("every lever and door is standable ground, not inside a monster", () => {
  const s = createInitialState(600);
  for (const shortcut of shortcuts) {
    for (const fixture of [shortcut.fromX, shortcut.toX, shortcut.leverX]) {
      for (const e of s.enemies) {
        assert.ok(
          Math.abs(e.x - fixture) > interactReach,
          `a goblin is standing on ${shortcut.id} at ${fixture}`,
        );
      }
    }
  }
});

test("encounters reshuffle with the seed while the geometry does not", () => {
  // The PRD's reshuffle rule: enemies move between runs, the rooms and the
  // shortcut doors never do.
  const a = createInitialState(600, { seed: 1 });
  const b = createInitialState(600, { seed: 2 });
  const again = createInitialState(600, { seed: 1 });

  assert.notDeepEqual(
    a.enemies.map((e) => e.x),
    b.enemies.map((e) => e.x),
    "a different seed must lay the dungeon out differently",
  );
  assert.deepEqual(
    a.enemies.map((e) => e.x),
    again.enemies.map((e) => e.x),
    "the same seed must be reproducible — this is what replay rests on",
  );
});

test("distant monsters stay asleep", () => {
  // Fifty thousand units of dungeon: without an activation range every goblin
  // in it walks to the mouth on tick one and arrives as one crowd.
  let s = standingAt(environmentStart(0) + 200);
  s = { ...s, enemies: createInitialState(600).enemies };
  const far = s.enemies.filter(
    (e) => Math.abs(e.x - s.player.x) > tuning.enemies.activationRange,
  );
  assert.ok(far.length > 0, "the fixture needs some distant goblins to matter");
  const before = far.map((e) => e.x);

  for (let i = 0; i < 120; i++) s = step(s, Intent.None);

  const after = s.enemies
    .filter((e) => Math.abs(e.x - before[0]) < 1 || before.includes(e.x))
    .map((e) => e.x);
  assert.deepEqual(
    after.slice(0, before.length),
    before,
    "monsters out of range must not have moved",
  );
});

test("the chute is a ride, not a door", () => {
  // Flicking its lever opens the ground; walking into the hole starts the run.
  // It is not stepped through, and there is no button.
  const chute = shortcutById.get(chuteId)!;
  let s = standingAt(chute.fromX, [chute.id]);

  s = step(s, Intent.None);
  assert.notEqual(
    s.player.riding,
    null,
    "walking onto the open hatch drops you in",
  );
  assert.ok(
    s.events.some((e) => e.type === "chuteEntered"),
    "and says so",
  );
});

test("the chute is sealed until its lever is flicked", () => {
  // FR-3.5 — knowing the hole is there confers nothing.
  const chute = shortcutById.get(chuteId)!;
  let s = standingAt(chute.fromX);
  for (let i = 0; i < 30; i++) s = step(s, Intent.Interact);
  assert.equal(s.player.riding, null, "the ground is still ground");
  assert.ok(Math.abs(s.player.x - chute.fromX) < 4, "and it moves nobody");
});

test("the chute carries the player the whole way and launches them", () => {
  const chute = shortcutById.get(chuteId)!;
  let s = standingAt(chute.fromX, [chute.id]);

  let launched = false;
  let dipped = false;
  let ticks = 0;
  for (; ticks < 600 && !launched; ticks++) {
    s = step(s, Intent.None);
    if (s.player.riding !== null && s.player.y > tuning.room.floorY + 40) {
      dipped = true;
    }
    launched = s.events.some((e) => e.type === "chuteLaunched");
  }

  assert.ok(launched, "it spits you out");
  assert.ok(dipped, "and dips below the floor on the way");
  assert.equal(s.player.riding, null, "the ride is over");
  assert.ok(s.player.x >= chute.toX - 1, "at the far end");
  assert.ok(s.player.vy < 0, `thrown upward, not dropped (vy ${s.player.vy})`);

  // Faster than running it, which is the entire reason to want it.
  const onFoot = (chute.toX - chute.fromX) / tuning.movement.runSpeed;
  assert.ok(
    ticks < onFoot,
    `the ride took ${ticks} ticks, running takes ${onFoot.toFixed(0)}`,
  );
});

test("the chute cannot be steered", () => {
  // A ride is a state you are IN. Handing control back mid-run would make it a
  // fast corridor, and the launch at the end would arrive as a surprise.
  const chute = shortcutById.get(chuteId)!;
  let s = standingAt(chute.fromX, [chute.id]);
  s = step(s, Intent.None);
  assert.notEqual(s.player.riding, null);

  const held = step(s, Intent.Left | Intent.Jump | Intent.Attack);
  assert.ok(held.player.x > s.player.x, "still going forwards");
  assert.equal(
    held.player.action.kind,
    null,
    "and cannot swing on the way down",
  );
});

test("monsters go where the terrain is not", () => {
  // Monsters and terrain ask the player the same question, and they used to be
  // dealt out independently: a set piece with a pit, a crusher and two ledges
  // got the same guard as four hundred units of bare corridor. So the busy
  // ground was unfair and the empty ground was a walk.
  const near = 300;
  const clutter = (x: number) => {
    let score = 0;
    for (const s of terrain.surfaces) {
      if (s.top >= tuning.room.floorY - 4) continue;
      if (s.x1 < x - near || s.x0 > x + near) continue;
      score += s.thin ? 0.5 : 0.8;
    }
    for (const h of terrain.hazards)
      if (Math.abs(h.x - x) <= near) score += 1.2;
    for (const p of terrain.spikes)
      if (!(p.x1 < x - near || p.x0 > x + near)) score += 1.4;
    for (const l of terrain.ladders)
      if (Math.abs(l.x - x) <= near) score += 0.6;
    return Math.min(1, score / 4);
  };

  // Averaged over several seeds: this is a weighting, not a guarantee, and one
  // seed can always deal an awkward hand.
  let openPop = 0;
  let openN = 0;
  let busyPop = 0;
  let busyN = 0;
  for (const seed of [1, 2, 3, 4, 5]) {
    const { enemies } = createInitialState(undefined, { seed });
    const ordinary = enemies.filter(
      (e) =>
        e.shoulder === null &&
        e.kind !== "enemy.warden" &&
        e.kind !== "enemy.kiln",
    );
    for (let x = 1500; x < builtEnd - 400; x += 200) {
      const here = ordinary.filter((e) => Math.abs(e.x - x) < 200).length;
      const c = clutter(x);
      if (c < 0.35) {
        openPop += here;
        openN++;
      } else if (c > 0.7) {
        busyPop += here;
        busyN++;
      }
    }
  }

  assert.ok(openN > 10 && busyN > 10, "the world has both kinds of ground");
  const open = openPop / openN;
  const busy = busyPop / busyN;
  assert.ok(
    open > busy * 1.2,
    `open ground carries ${open.toFixed(2)} against busy ground's ${busy.toFixed(2)}`,
  );
});

// ----------------------------------------------------------- the chamber

test("the chamber door leads somewhere, and it is not the way out", () => {
  // FR-4.2 says any exit banks the run, and the chamber lives PAST the built
  // end of the world — so without a rule of its own, stepping through the door
  // would read as "very far right" and bank the run on the spot.
  let s = standingOn(chamber.doorX);
  s = step(s, Intent.None);
  s = step(s, Intent.Interact);

  assert.ok(
    s.events.some((e) => e.type === "chamberEntered"),
    "the door opens",
  );
  assert.ok(inChamber(s.player.x), "and puts you inside");
  assert.equal(s.outcome, "running", "and does not end the run");
});

test("it is a room: walled both ends, and the door works from inside", () => {
  let s = standingOn(chamber.doorX);
  s = step(s, Intent.None);
  s = step(s, Intent.Interact);

  // Both walls, hammered — walked, jumped and slid at. A room you can get out
  // of the back of is a corridor, and the chamber is built past the end of the
  // world, so a player who got through a wall would be standing in nothing.
  for (const dir of [Intent.Right, Intent.Left]) {
    for (let i = 0; i < 400; i++) {
      const move = i % 11 === 0 ? Intent.Jump : i % 7 === 0 ? Intent.Slide : 0;
      s = step(s, dir | move);
      assert.ok(inChamber(s.player.x), `left the room at tick ${i}`);
      assert.ok(
        s.player.x > chamber.x0 && s.player.x < chamber.x1,
        `phased through a wall to ${Math.round(s.player.x)}`,
      );
    }
  }
  assert.equal(s.outcome, "running");

  // And back. The way in is the way out — a room with a one-way door is a cell.
  //
  // Further than it used to walk: arriving no longer puts you standing on the
  // way back. It used to land you thirty units from it against a reach of
  // eighty-six, so one press in and the next press threw you straight out
  // again — which from the player's side is a boss room that ejects you.
  for (let i = 0; i < 600; i++) s = step(s, Intent.Left);
  s = step(s, Intent.None);
  s = step(s, Intent.Interact);
  assert.ok(
    s.events.some((e) => e.type === "chamberLeft"),
    "the door works from the inside",
  );
  assert.ok(!inChamber(s.player.x), "and puts you back in the fire");
});

test("only the boss and its chest are in the chamber", () => {
  // The room shipped empty and the boss moved in. What must still not happen is
  // an ordinary monster or a loose chest getting slotted out there by a pass
  // that works by position — the chamber is past `builtEnd`, which every
  // placement loop treats as the end of everywhere.
  const s = createInitialState(600, { seed: 4 });
  for (const e of s.enemies) {
    if (!inChamber(e.x)) continue;
    assert.equal(e.kind, "enemy.revenant", `a ${e.kind} is in the chamber`);
  }
  for (const c of s.chests) {
    if (!inChamber(c.x)) continue;
    assert.equal(c.id, "chest.hollow", `${c.id} is loose in the chamber`);
  }
});

test("no two shortcuts are the same kind of thing", () => {
  // Four shortcuts, four verbs. A door teleports, a chute rides, a chain throws
  // and a high road appears — and the poison's burrow charges a status effect
  // for the privilege.
  //
  // This matters more than it sounds. A shortcut is permanent progress you earn
  // once (FR-3), so it is the most memorable thing in an environment, and four
  // identical doors would make the four environments feel like one place with
  // different wallpaper.
  const special = new Set([chuteId, geyserId, burrowId, highRoadId]);
  assert.equal(special.size, 4, "two of them are the same shortcut");
  for (const s of shortcuts) {
    assert.ok(special.has(s.id), `${s.id} is still a plain door`);
  }
  // And one per environment, so no environment gets two of anything.
  const homes = new Set(shortcuts.map((s) => s.environment));
  assert.equal(homes.size, shortcuts.length, "two shortcuts share a home");
});
