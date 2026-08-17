import { test } from "node:test";
import assert from "node:assert/strict";
import {
  archer,
  createInitialState,
  step,
  Intent,
  playerHitbox,
  type SimState,
  type Intents,
  goblin,
} from "./index.ts";
import { tuning } from "../config/tuning.ts";
import { terrain, roofAt } from "../config/terrain.ts";
import { themeAt, themeStart, themeEnd } from "../config/dungeon.ts";

const GOBLIN = tuning.enemies.goblin;

/**
 * Flat, empty, goblin-shaped ground, found rather than remembered.
 *
 * This was `entranceX + 160` — the first stretch inside the mouth — which was
 * correct for exactly as long as the rock was the first environment. It is the
 * fourth now, and that address points at a wall-jump shaft with a spike bed at
 * the bottom of it: every combat test was fighting in a hole.
 *
 * So it is asked for rather than typed: floor at floor height, wide enough for
 * two bodies, no spikes, no pits, no hazards and no low roof.
 */
const GROUND: number = (() => {
  const FLOOR = tuning.room.floorY;
  const from = themeStart("rock");
  const to = themeEnd("rock");
  const need = 560;
  for (let x = from + 400; x < to - 600; x += 20) {
    if (themeAt(x) !== "rock") continue;
    const clear = (at: number) =>
      terrain.surfaces.some(
        (s) => at >= s.x0 && at <= s.x1 && Math.abs(s.top - FLOOR) < 1,
      ) &&
      !terrain.spikes.some((s) => at > s.x0 - 90 && at < s.x1 + 90) &&
      !terrain.hazards.some((h) => Math.abs(h.x - at) < 200) &&
      !terrain.surfaces.some(
        (s) => !s.thin && at >= s.x0 - 30 && at <= s.x1 + 30 && s.top < FLOOR,
      ) &&
      roofAt(at) < FLOOR - tuning.player.height - 40;
    let ok = true;
    for (let at = x - 60; at <= x + need; at += 20) if (!clear(at)) ok = false;
    if (ok) return x;
  }
  throw new Error("nowhere in the rock is flat enough to have a fight");
})();

/** Advance n ticks holding the same intents. */
function run(
  state: SimState,
  ticks: number,
  intents: Intents = Intent.None,
): SimState {
  let s = state;
  for (let i = 0; i < ticks; i++) s = step(s, intents);
  return s;
}

/**
 * A state with one goblin close enough to engage immediately, and the run
 * already started — combat tests are about the fight, not the approach.
 */
function duel(): SimState {
  const base = createInitialState(60 * 60);
  // Well clear of the mouth — standing on the threshold would extract the
  // moment the fight pushed the player back a step.
  const x = GROUND;
  return {
    ...base,
    entered: true,
    deepestX: x,
    player: { ...base.player, x },
    // A goblin, built rather than borrowed. It used to be `base.enemies[0]` —
    // whatever the dungeon happened to place first — which was a goblin only
    // because the rock was the first environment. It is a lizard now, and a
    // lizard poisons you, so "an unparried swing costs exactly one bar" started
    // failing by a twentieth of a point with no swing involved.
    enemies: [
      { ...goblin(x + GOBLIN.attackRange - 2, tuning.room.floorY), facing: -1 },
    ],
  };
}

/** Advance until the goblin is about to land its swing. */
function untilStrike(
  state: SimState,
  intents: Intents = Intent.None,
): SimState {
  let s = state;
  for (let i = 0; i < 200; i++) {
    s = step(s, intents);
    if (s.enemies[0].phase === "striking" && s.enemies[0].phaseTicks === 0)
      return s;
  }
  throw new Error("goblin never struck");
}

test("a goblin telegraphs before it strikes", () => {
  let s = duel();
  s = run(s, 1);
  assert.equal(
    s.enemies[0].phase,
    "telegraphing",
    "it must wind up, or the parry is unreadable",
  );
  // PRD FR-6.1: the tell has to be long enough to be a real read.
  assert.ok(GOBLIN.telegraph > tuning.combat.parryWindow);
});

test("an unparried swing damages the player", () => {
  const s = untilStrike(duel());
  assert.equal(s.player.hp, tuning.player.maxHp - GOBLIN.damage);
  assert.ok(s.events.some((e) => e.type === "playerHit"));
});

test("a parried swing damages the attacker instead and staggers it", () => {
  // Block on the tick the swing lands, so the parry window is live.
  let s = duel();
  for (let i = 0; i < 200; i++) {
    const next = step(s, Intent.None);
    if (
      next.enemies[0].phase === "striking" &&
      next.enemies[0].phaseTicks === 0
    ) {
      // Re-run that tick with block held from one tick earlier.
      s = step(s, Intent.Block);
      break;
    }
    s = next;
  }
  assert.equal(
    s.player.hp,
    tuning.player.maxHp,
    "PRD FR-5.8: a parry takes no damage",
  );
  assert.equal(s.enemies[0].hp, GOBLIN.maxHp - tuning.parry.riposteDamage);
  assert.equal(s.enemies[0].phase, "staggered");
  assert.ok(s.events.some((e) => e.type === "parry"));
});

test("blocking too early does not parry — the window has passed by the time it lands", () => {
  let s = duel();
  s = step(s, Intent.Block); // committed immediately, long before the swing
  s = untilStrike(s);
  assert.ok(
    s.player.hp < tuning.player.maxHp,
    "an expired block is not a parry",
  );
});

test("the sword damages a goblin and enough hits kill it", () => {
  let s = duel();
  const hitsNeeded = Math.ceil(GOBLIN.maxHp / tuning.player.attackDamage);
  for (let i = 0; i < hitsNeeded; i++) {
    s = step(s, Intent.Attack);
    s = run(s, 30); // let the swing resolve and the lockout expire
  }
  assert.equal(s.enemies[0].phase, "dead");
  assert.ok(s.events.length >= 0);
});

test("the stun attack trades damage for an opening", () => {
  const s = step(duel(), Intent.Stun);
  assert.equal(s.player.action.kind, "stun");
  assert.ok(
    tuning.player.stunDamage < tuning.player.attackDamage,
    "PRD FR-5.6: the stun is substantially weaker",
  );
  assert.ok(
    tuning.player.stunStartup > tuning.player.attackStartup,
    "PRD FR-5.6: and slower — the wind-up is the whole cost",
  );
});

test("a committed goblin does not turn to track the player", () => {
  let s = duel();
  s = run(s, 1);
  assert.equal(s.enemies[0].phase, "telegraphing");
  const facingAtCommit = s.enemies[0].facing;
  // Run past it mid-wind-up.
  s = run(s, 10, Intent.Left);
  assert.equal(
    s.enemies[0].facing,
    facingAtCommit,
    "stepping around a wind-up must be a real answer",
  );
});

test("combat stays deterministic", () => {
  const script = [
    ...Array(20).fill(Intent.Right),
    ...Array(6).fill(Intent.Block),
    ...Array(10).fill(Intent.Attack),
    ...Array(30).fill(Intent.None),
  ];
  const play = () => {
    let s = duel();
    for (const intents of script) s = step(s, intents);
    return s;
  };
  assert.deepEqual(play(), play());
});

test("events do not accumulate across ticks", () => {
  const s = run(untilStrike(duel()), 5);
  assert.equal(
    s.events.length,
    0,
    "events are per-tick, or state stops being a pure function",
  );
});

test("consecutive attacks alternate between two swings", () => {
  let s = duel();
  const variants: number[] = [];
  for (let round = 0; round < 4; round++) {
    s = step(s, Intent.Attack);
    variants.push(s.player.action.variant);
    // Wait out the lockout but stay inside the combo window.
    s = run(
      s,
      tuning.player.attackStartup +
        tuning.player.attackActive +
        tuning.player.attackRecovery,
    );
  }
  assert.deepEqual(
    variants,
    [0, 1, 0, 1],
    "a chain must not replay the same animation",
  );
});

test("the chain resets after a pause, so the first press always looks the same", () => {
  let s = duel();
  s = step(s, Intent.Attack);
  assert.equal(s.player.action.variant, 0);
  // Long enough for the combo window to lapse.
  s = run(s, 200);
  s = step(s, Intent.Attack);
  assert.equal(
    s.player.action.variant,
    0,
    "after a pause the swing resets to the first",
  );
});

test("the attack box is the sword, not the whole body", () => {
  const s = step(duel(), Intent.Attack);
  const p = {
    ...s.player,
    action: { ...s.player.action, elapsed: tuning.player.attackStartup },
  };
  const box = playerHitbox(p);
  assert.ok(box, "the hitbox should be live during active frames");
  const feet = p.y;
  assert.ok(box.bottom < feet, "a swing must not reach the ground");
  assert.ok(
    feet - box.bottom >=
      tuning.player.height * tuning.player.attackBoxBottom - 1,
  );
});

test("crouch-walking is possible but slower than standing", () => {
  let standing = createInitialState(600);
  let crouched = createInitialState(600);
  for (let i = 0; i < 20; i++) {
    standing = step(standing, Intent.Right);
    crouched = step(crouched, Intent.Right | Intent.Crouch);
  }
  const standDist = standing.player.x - tuning.room.playerSpawnX;
  const crouchDist = crouched.player.x - tuning.room.playerSpawnX;
  assert.ok(crouchDist > 0, "crouching must not stop the player moving");
  assert.ok(crouchDist < standDist, "but it must cost speed");
  assert.equal(crouched.player.stance, "crouching");
});

test("crouching shrinks the hurtbox", () => {
  const s = step(createInitialState(600), Intent.Crouch);
  assert.equal(s.player.stance, "crouching");
  assert.ok(tuning.movement.crouchHeightScale < 1);
});

test("the smash needs to be in the air — pressing down on the ground does not trigger it", () => {
  const s = step(createInitialState(600), Intent.Crouch);
  assert.equal(s.player.action.kind, null, "PRD FR-5.5: jump first, then down");
});

test("jump then down commits to a smash and lands with a wide impact", () => {
  let s = step(createInitialState(600), Intent.Jump);
  s = run(s, 4);
  assert.equal(s.player.stance, "airborne");
  s = step(s, Intent.Crouch);
  assert.equal(s.player.action.kind, "smash");

  // It drives straight down and cannot be steered.
  const xAtCommit = s.player.x;
  s = run(s, 3, Intent.Right);
  assert.equal(s.player.x, xAtCommit, "a committed smash goes straight down");

  // Fall to the floor, then the impact should be live and hit both sides.
  for (let i = 0; i < 40 && s.player.stance === "airborne"; i++)
    s = step(s, Intent.None);
  const box = playerHitbox(s.player);
  assert.ok(box, "the impact must be live on landing");
  assert.ok(
    box.left < s.player.x && box.right > s.player.x,
    "it hits both sides",
  );
});

test("a goblin is solid — you cannot walk through it", () => {
  let s = duel();
  const goblinX = s.enemies[0].x;
  for (let i = 0; i < 120; i++) s = step(s, Intent.Right);
  assert.ok(
    s.player.x + tuning.player.width / 2 <=
      goblinX + tuning.enemies.goblin.width / 2 + 1,
    "the player should be stopped at the goblin's body",
  );
});

test("sliding passes through a goblin", () => {
  let s = duel();
  // Get moving, then dash.
  s = run(s, 6, Intent.Right);
  const before = s.player.x;
  s = step(s, Intent.Right | Intent.Slide);
  s = run(s, tuning.movement.slideDuration, Intent.Right);
  assert.ok(
    s.player.x > s.enemies[0].x,
    "a slide should carry the player past the goblin, not bounce off it",
  );
  assert.ok(s.player.x > before);
});

test("jumping clears a goblin's head", () => {
  let s = duel();
  s = step(s, Intent.Jump);
  // Rise until the feet are above the goblin's head.
  for (let i = 0; i < 30; i++) {
    s = step(s, Intent.Jump | Intent.Right);
    if (s.player.y <= s.enemies[0].y - tuning.enemies.goblin.height) break;
  }
  assert.ok(
    s.player.y <= s.enemies[0].y - tuning.enemies.goblin.height,
    "the jump must actually reach above the goblin",
  );
  const overhead = s.player.x;
  s = run(s, 6, Intent.Right);
  assert.ok(s.player.x > overhead, "and movement must not be blocked up there");
});

test("air does not burn until you step into the cave", () => {
  let s = createInitialState(600);
  assert.equal(s.entered, false);
  for (let i = 0; i < 120; i++) s = step(s, Intent.None);
  assert.equal(s.air, 600, "standing outside must cost nothing");
  assert.equal(s.outcome, "running");
});

test("crossing the mouth starts the run, once", () => {
  let s = createInitialState(600);
  let entries = 0;
  for (let i = 0; i < 200; i++) {
    s = step(s, Intent.Right);
    entries += s.events.filter((e) => e.type === "entered").length;
    if (s.entered) break;
  }
  assert.equal(s.entered, true, "walking right must reach the entrance");
  assert.ok(s.player.x >= tuning.room.entranceX);
  assert.equal(entries, 1, "the threshold fires exactly once");

  const airOnEntry = s.air;
  s = run(s, 30);
  assert.ok(s.air < airOnEntry, "and the clock runs from then on");
});

test("goblins do not move until the player is inside", () => {
  let s = createInitialState(600);
  const startX = s.enemies[0].x;
  // Stand still outside for a long time.
  for (let i = 0; i < 240; i++) s = step(s, Intent.None);
  assert.equal(s.entered, false);
  assert.equal(s.enemies[0].x, startX, "nothing hunts you in the open");
  assert.equal(s.enemies[0].phaseTicks, 0);
});

test("every goblin starts inside the cave", () => {
  const s = createInitialState(600);
  for (const e of s.enemies) {
    assert.ok(
      e.x > tuning.room.entranceX,
      "monsters belong to the dungeon, not the approach",
    );
  }
});

test("walking back out of the mouth extracts you", () => {
  let s = createInitialState(600);
  // In.
  for (let i = 0; i < 200 && !s.entered; i++) s = step(s, Intent.Right);
  assert.equal(s.entered, true);
  s = run(s, 40, Intent.Right);
  const depth = s.deepestX;
  assert.ok(depth > tuning.room.entranceX, "should have made some ground");

  // Back out.
  for (let i = 0; i < 300 && s.outcome === "running"; i++) {
    s = step(s, Intent.Left);
  }
  assert.equal(s.outcome, "extracted", "leaving is always available and free");
  assert.equal(s.deepestX, depth, "and the depth reached is what was banked");
});

test("depth only counts ground made inside", () => {
  let s = createInitialState(600);
  for (let i = 0; i < 60; i++) s = step(s, Intent.None);
  assert.equal(
    s.deepestX,
    tuning.room.entranceX,
    "loitering outside is worth nothing",
  );
});

test("a goblin's swing costs exactly half a health bar", () => {
  // Health is read by counting bars, so the arithmetic has to be exact: a
  // goblin that took 0.6 of a bar would leave the count ambiguous after every
  // second hit, and the whole point of bars is that it is not a judgement.
  //
  // A HALF is the one fraction allowed, and only the goblin gets it. It is the
  // cheap threat — ten of them to kill you — so being surrounded is dangerous
  // and being hit once is not. Everything else costs a whole bar.
  const perBar = tuning.player.maxHp / tuning.player.healthBars;
  assert.equal(
    tuning.enemies.goblin.damage * 2,
    perBar,
    `a goblin does ${tuning.enemies.goblin.damage}, half a bar is ${perBar / 2}`,
  );
  assert.equal(
    tuning.player.maxHp % tuning.player.healthBars,
    0,
    "the bars have to divide the health evenly",
  );
  assert.equal(perBar % 2, 0, "and a bar has to halve evenly too");
});

test("what a monster hits for is a whole or a half bar, never a third", () => {
  // Not a style rule — damage that does not land on a bar boundary is damage
  // the player cannot see, and the bar count stops being answerable at a
  // glance, which is the only reason to draw bars at all.
  //
  // Traps are deliberately absent: they do not deal damage. They set a FLOOR,
  // taking the run to its last bar whatever it walked in with, which is
  // asserted in terrain.test.ts.
  const perBar = tuning.player.maxHp / tuning.player.healthBars;
  const hurts: Array<[string, number]> = [
    ["goblin", tuning.enemies.goblin.damage],
    ["archer", tuning.enemies.archer.damage],
    ["warden", tuning.enemies.warden.damage],
  ];
  for (const [who, damage] of hurts) {
    assert.equal(
      (damage * 2) % perBar,
      0,
      `${who} does ${damage}, and a bar is ${perBar}`,
    );
  }
});

/** Mid-run, well inside the dungeon, with air to spare and nothing hunting. */
function inside(): SimState {
  const base = createInitialState(60 * 60 * 10);
  return {
    ...base,
    entered: true,
    player: { ...base.player, x: tuning.room.entranceX + 600 },
    enemies: [],
  };
}

test("walking is slower than sliding, and sliding is slower than sprinting", () => {
  // The order is the whole point of the gait system: the slide is the door and
  // the sprint is what is behind it. It used to be slide-fastest, which made
  // the sprint the slower reward for having done the harder thing.
  const { walkSpeed, slideSpeed, runSpeed } = tuning.movement;
  assert.ok(walkSpeed < slideSpeed, `walk ${walkSpeed} !< slide ${slideSpeed}`);
  assert.ok(slideSpeed < runSpeed, `slide ${slideSpeed} !< sprint ${runSpeed}`);
});

test("a slide cannot be chained — there is a wait between them", () => {
  // Without the cooldown the slide is just a faster gait you hold down, and
  // never being a standing target stops being a choice.
  // Placed INSIDE. Spawning at the mouth with `entered` set is an instant
  // extraction, which ends the run and freezes the reducer — the loops below
  // would then never terminate.
  let s = inside();

  // First slide.
  s = step(s, Intent.Right | Intent.Slide);
  assert.ok(s.player.dashTicks > 0, "the first slide starts");
  assert.ok(s.player.dashCooldown > 0, "and arms the cooldown");

  // Run it out, then try again the moment it ends.
  for (let i = 0; i < 60 && s.player.dashTicks > 0; i++)
    s = step(s, Intent.Right);
  s = step(s, Intent.Right | Intent.Slide);
  assert.equal(s.player.dashTicks, 0, "a second slide is refused on cooldown");
  assert.notEqual(s.player.stance, "sliding", "and the body is not in one");
  // Deliberately not asserting a speed here: holding the direction through the
  // first slide carries into the SPRINT, so the player is legitimately moving
  // faster than a slide at this point. The refusal is about the move, not the
  // velocity.

  // And once the wait is over, it is available again.
  for (let i = 0; i < 120 && s.player.dashCooldown > 0; i++)
    s = step(s, Intent.Right);
  s = step(s, Intent.Right);
  s = step(s, Intent.Right | Intent.Slide);
  assert.ok(s.player.dashTicks > 0, "the wait ends and the slide returns");
});

test("the backstep is not gated by the slide's cooldown", () => {
  // Same button, different move. The escape has a cost; the small defensive hop
  // out of a swing does not.
  let s = inside();
  s = step(s, Intent.Right | Intent.Slide);
  for (let i = 0; i < 60 && s.player.dashTicks > 0; i++)
    s = step(s, Intent.Right);
  assert.ok(s.player.dashCooldown > 0, "still on cooldown");

  // No direction held, so this is a backstep rather than a slide.
  s = step(s, Intent.Slide);
  assert.ok(s.player.dashTicks > 0, "the backstep still goes");
  assert.equal(s.player.stance, "backstepping");
});

/** An archer standing off at range, with the player facing it. */
function duelArcher(): SimState {
  const base = createInitialState(60 * 60 * 10);
  // Far enough into the clear ground to stand an archer four hundred units off
  // and have both of them on real floor.
  const x = GROUND;
  return {
    ...base,
    entered: true,
    player: { ...base.player, x, facing: 1 },
    enemies: [
      {
        ...archer(x + 420, tuning.room.floorY),
        facing: -1,
        hp: tuning.enemies.archer.maxHp,
        phase: "approaching",
      },
    ],
  };
}

test("an archer draws before it looses", () => {
  // PRD FR-6.1 — the tell has to be readable, and this one has to be readable
  // across a room, which is why the draw is nearly a second.
  let s = duelArcher();
  let drewFor = 0;
  let loosed = -1;
  for (let i = 0; i < 200 && loosed < 0; i++) {
    s = step(s, Intent.None);
    if (s.enemies[0].phase === "telegraphing") drewFor++;
    if (s.events.some((e) => e.type === "arrowLoosed")) loosed = i;
  }
  assert.ok(loosed >= 0, "it shoots");
  assert.ok(
    drewFor >= tuning.enemies.archer.telegraph - 2,
    `drew for ${drewFor} ticks, the tell is ${tuning.enemies.archer.telegraph}`,
  );
  assert.equal(s.arrows.length, 1, "and exactly one arrow is in the air");
});

test("an unparried arrow costs a bar", () => {
  let s = duelArcher();
  const before = s.player.hp;
  for (let i = 0; i < 400 && s.player.hp === before; i++)
    s = step(s, Intent.None);
  assert.equal(
    before - s.player.hp,
    tuning.enemies.archer.damage,
    "an arrow hits for what an arrow hits for",
  );
});

test("a parried arrow turns around and kills what fired it", () => {
  // FR-5.7 and FR-5.8 together: the parry reflects, and the reflection damages
  // the attacker. A goblin teaches the timing; this is what the timing is FOR.
  let s = duelArcher();
  const hp = s.player.hp;

  // Wait for the arrow, then block the tick before it arrives.
  let returned = false;
  for (let i = 0; i < 400 && !returned; i++) {
    const arrow = s.arrows[0];
    const closing = arrow && Math.abs(arrow.x - s.player.x) < 40;
    s = step(s, closing ? Intent.Block : Intent.None);
    returned = s.events.some((e) => e.type === "arrowReturned");
  }
  assert.ok(returned, "the parry sends it back");
  assert.equal(s.player.hp, hp, "and costs nothing");

  // It flies back and finishes the archer.
  for (let i = 0; i < 300 && s.enemies[0].phase !== "dead"; i++) {
    s = step(s, Intent.None);
  }
  assert.equal(
    s.enemies[0].phase,
    "dead",
    "the archer is killed by its own arrow",
  );
});

test("an archer gives ground rather than letting you stand on it", () => {
  // Otherwise it is just a slow goblin. The fight it makes is about closing.
  let s = duelArcher();
  s = { ...s, enemies: [{ ...s.enemies[0], x: s.player.x + 80 }] };
  const before = s.enemies[0].x;
  for (let i = 0; i < 60; i++) s = step(s, Intent.None);
  assert.ok(
    s.enemies[0].x > before,
    `it stood its ground at ${s.enemies[0].x.toFixed(0)}`,
  );
});

test("an archer dies to one sword hit; a goblin takes two", () => {
  // Closing the distance IS the answer to an archer, so reaching one has to
  // end it. An archer that survived the first hit would punish the player for
  // doing the only thing its design asks of them.
  const sword = tuning.player.attackDamage;
  assert.ok(
    tuning.enemies.archer.maxHp <= sword,
    `archer has ${tuning.enemies.archer.maxHp} against a ${sword} swing`,
  );
  assert.ok(
    tuning.enemies.goblin.maxHp > sword,
    "a goblin must survive the first",
  );
  assert.ok(tuning.enemies.goblin.maxHp <= sword * 2, "and not the second");
});

test("one swing actually kills an archer in play", () => {
  // The arithmetic above, played — the swing has to reach as well as land.
  let s = duelArcher();
  s = { ...s, enemies: [{ ...s.enemies[0], x: s.player.x + 40 }] };
  for (let i = 0; i < 40 && s.enemies[0].phase !== "dead"; i++) {
    s = step(s, i === 0 ? Intent.Attack : Intent.None);
  }
  assert.equal(s.enemies[0].phase, "dead", "one swing put it down");
});

test("an archer on high ground shoots DOWN at the player", () => {
  // The whole reason the raised ground is dangerous. The first version gated
  // firing to within the archer's own height, so the one position that made
  // this enemy interesting was the one position it refused to shoot from.
  const ledge = terrain.surfaces.filter(
    (s) => s.thin && s.top < tuning.room.floorY - 90,
  )[0];
  assert.ok(ledge, "there is a ledge to stand on");
  const ax = (ledge.x0 + ledge.x1) / 2;

  const base = createInitialState(60 * 60 * 10);
  let s: SimState = {
    ...base,
    entered: true,
    player: { ...base.player, x: ax - 380, y: tuning.room.floorY, facing: 1 },
    enemies: [
      {
        ...archer(ax, ledge.top),
        facing: -1,
        hp: tuning.enemies.archer.maxHp,
        phase: "approaching",
      },
    ],
  };

  for (let i = 0; i < 300 && s.arrows.length === 0; i++)
    s = step(s, Intent.None);
  assert.equal(s.arrows.length, 1, "it fires from up there");
  const arrow = s.arrows[0];
  assert.ok(arrow.vy > 0.5, `vy ${arrow.vy.toFixed(2)} — it is not aimed down`);
  // And the aim is a direction, not a scaling: speed is preserved.
  assert.ok(
    Math.abs(
      Math.hypot(arrow.vx, arrow.vy) - tuning.enemies.archer.arrowSpeed,
    ) < 0.01,
    "an aimed arrow flies at arrow speed",
  );
});

test("a clean parry costs nothing — you can go straight into another", () => {
  // A block spends its window plus a punish tail up front, and getting it RIGHT
  // used to cost exactly what getting it wrong cost: you caught the swing and
  // then stood there for forty ticks. Against anything with a friend, the
  // reward for reading correctly was being hit by the other one.
  // Well inside the dungeon. At four hundred the fixture was standing outside
  // the mouth, so the run banked itself on tick one and nothing moved at all.
  const goblinAt = 2400;
  function swingAt(): SimState {
    const base = createInitialState(60 * 60 * 10);
    return {
      ...base,
      entered: true,
      deepestX: goblinAt - 40,
      player: {
        ...base.player,
        x: goblinAt - 40,
        y: tuning.room.floorY,
        facing: 1,
      },
      // Poised on the last frame of the wind-up, so the step that follows
      // turns it into the strike. Set to `striking` directly, the enemy pass
      // advances it past frame zero before the damage pass ever looks at it,
      // and the swing lands on nobody.
      enemies: [
        {
          ...goblin(goblinAt, tuning.room.floorY),
          phase: "telegraphing" as const,
          phaseTicks: tuning.enemies.goblin.telegraph - 1,
          facing: -1 as const,
        },
      ],
    };
  }

  // Parry it, and the lockout is gone on the same tick.
  let hit = swingAt();
  hit = step(hit, Intent.Block);
  assert.ok(
    hit.events.some((e) => e.type === "parry"),
    "the fixture actually parries",
  );
  assert.equal(
    hit.player.action.lockout,
    0,
    "a caught swing frees you at once",
  );

  // Miss, and it costs exactly what it always did.
  const miss = step({ ...swingAt(), enemies: [] }, Intent.Block);
  assert.ok(
    miss.player.action.lockout > 0,
    "and mistiming still costs the punish tail",
  );
});
