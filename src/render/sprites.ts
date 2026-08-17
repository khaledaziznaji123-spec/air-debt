/**
 * Art loading. ARCH AD-16: the core never names an asset — it deals in entity
 * and animation identifiers, and this module is the only place those become
 * files. Swapping every sprite must never require touching `src/sim`.
 *
 * Everything here is optional by design. A missing file is not an error: the
 * renderer falls back to its placeholder shapes, so the game stays playable
 * while the art is still being drawn.
 */

import { Assets, Rectangle, Texture } from "pixi.js";

export type SpriteKey =
  | "player.idle"
  | "player.walk"
  | "player.run"
  | "player.attack.a"
  | "player.attack.b"
  | "player.block"
  | "player.hurt"
  | "player.crouch"
  | "player.crouchWalk"
  | "player.slide"
  | "player.wall"
  | "player.swim"
  | "player.backstep"
  | "player.smash"
  | "player.stun"
  | "player.death"
  | "player.transform"
  | "enemy.goblin.idle"
  | "enemy.goblin.walk"
  | "enemy.goblin.windup"
  | "enemy.goblin.strike"
  | "enemy.goblin.stagger"
  | "enemy.archer.idle"
  | "enemy.archer.walk"
  | "enemy.archer.draw"
  | "enemy.archer.loose"
  | "enemy.phoenix.hover"
  | "enemy.phoenix.charge"
  | "enemy.phoenix.throw"
  | "enemy.phoenix.stagger"
  | "enemy.flamer.idle"
  | "enemy.flamer.walk"
  | "enemy.flamer.wind"
  | "enemy.flamer.burn"
  | "enemy.flamer.stagger"
  | "enemy.kiln.idle"
  | "enemy.kiln.rakeWindup"
  | "enemy.kiln.rake"
  | "enemy.kiln.eruptWindup"
  | "enemy.kiln.erupt"
  | "enemy.kiln.stagger"
  | "enemy.shark.swim"
  | "enemy.shark.bite"
  | "enemy.crab.idle"
  | "enemy.crab.walk"
  | "enemy.crab.wind"
  | "enemy.crab.strike"
  | "enemy.crab.stagger"
  | "enemy.lizard.idle"
  | "enemy.lizard.walk"
  | "enemy.lizard.wind"
  | "enemy.lizard.strike"
  | "enemy.lizard.stagger"
  | "enemy.bee.hover"
  | "enemy.bee.wind"
  | "enemy.bee.dive"
  | "enemy.hollow.idle"
  | "enemy.hollow.sweepWindup"
  | "enemy.hollow.sweep"
  | "enemy.hollow.waveWindup"
  | "enemy.hollow.wave"
  | "enemy.hollow.stagger"
  | "enemy.hollow.sink"
  | "enemy.hollow.under"
  | "enemy.hollow.rise"
  | "enemy.warden.idle"
  | "enemy.warden.windup"
  | "enemy.warden.strike"
  | "enemy.warden.slamWindup"
  | "enemy.warden.slam"
  | "enemy.warden.stagger"
  | "prop.chest"
  | "prop.loot"
  | "cave.entrance"
  | "skin.crimson.idle"
  | "skin.crimson.walk"
  | "skin.crimson.run"
  | "skin.crimson.attack.a"
  | "skin.crimson.attack.b"
  | "skin.crimson.block"
  | "skin.crimson.hurt"
  | "skin.crimson.crouch"
  | "skin.crimson.crouchWalk"
  | "skin.crimson.slide"
  | "skin.crimson.wall"
  | "skin.crimson.swim"
  | "skin.crimson.backstep"
  | "skin.crimson.smash"
  | "skin.crimson.stun"
  | "skin.pale.idle"
  | "skin.pale.walk"
  | "skin.pale.run"
  | "skin.pale.attack.a"
  | "skin.pale.attack.b"
  | "skin.pale.block"
  | "skin.pale.hurt"
  | "skin.pale.crouch"
  | "skin.pale.crouchWalk"
  | "skin.pale.slide"
  | "skin.pale.wall"
  | "skin.pale.swim"
  | "skin.pale.backstep"
  | "skin.pale.smash"
  | "skin.pale.stun"
  | "skin.void.idle"
  | "skin.void.walk"
  | "skin.void.run"
  | "skin.void.attack.a"
  | "skin.void.attack.b"
  | "skin.void.block"
  | "skin.void.hurt"
  | "skin.void.crouch"
  | "skin.void.crouchWalk"
  | "skin.void.slide"
  | "skin.void.wall"
  | "skin.void.swim"
  | "skin.void.backstep"
  | "skin.void.smash"
  | "skin.void.stun"
  | "skin.leviathan.idle"
  | "skin.leviathan.walk"
  | "skin.leviathan.run"
  | "skin.leviathan.attack.a"
  | "skin.leviathan.attack.b"
  | "skin.leviathan.block"
  | "skin.leviathan.hurt"
  | "skin.leviathan.crouch"
  | "skin.leviathan.crouchWalk"
  | "skin.leviathan.slide"
  | "skin.leviathan.wall"
  | "skin.leviathan.swim"
  | "skin.leviathan.backstep"
  | "skin.leviathan.smash"
  | "skin.leviathan.stun"
  | "skin.revenant.idle"
  | "skin.revenant.walk"
  | "skin.revenant.run"
  | "skin.revenant.attack.a"
  | "skin.revenant.attack.b"
  | "skin.revenant.block"
  | "skin.revenant.hurt"
  | "skin.revenant.crouch"
  | "skin.revenant.crouchWalk"
  | "skin.revenant.slide"
  | "skin.revenant.swim"
  | "skin.revenant.wall"
  | "skin.revenant.backstep"
  | "skin.revenant.smash"
  | "skin.revenant.stun"
  | "skin.revenant.throw"
  | "skin.revenant.death"
  | "pet.moth.idle"
  | "pet.moth.walk"
  | "pet.moth.jump"
  | "pet.pup.idle"
  | "pet.pup.walk"
  | "pet.pup.jump"
  | "pet.rat.idle"
  | "pet.rat.walk"
  | "pet.rat.jump";

type SpriteDef = {
  path: string;
  /** Size of ONE frame. A strip is frames laid left to right at this width. */
  width: number;
  height: number;
  frames: number;
  /** Ticks each frame is held. Ignored for single-frame sprites. */
  ticksPerFrame?: number;
};

/**
 * The manifest is the contract with whoever is drawing. Frame sizes match the
 * world units in `tuning.ts` 1:1, so nothing needs scaling.
 */
export const SPRITE_MANIFEST: Record<SpriteKey, SpriteDef> = {
  "player.idle": {
    path: "/art/player-idle.png",
    width: 48,
    height: 96,
    frames: 4,
    ticksPerFrame: 14,
  },
  "player.walk": {
    path: "/art/player-walk.png",
    width: 48,
    height: 96,
    frames: 12,
    ticksPerFrame: 4,
  },
  // Fewer frames held for less time: a sprint's cadence is faster than a
  // walk's, and matching the two would undo the pose work.
  "player.run": {
    path: "/art/player-run.png",
    width: 48,
    height: 96,
    frames: 8,
    ticksPerFrame: 3,
  },
  // Two swings, alternating, so a chain never replays the same animation.
  //
  // Eighty-eight columns, like the slide's eighty: a swung arm plus the sword
  // on the end of it is nearly twice as wide as a standing body, and at 48 the
  // blade was cropped by its own frame — which forced every pose to keep the
  // hand tucked in near the shoulder.
  "player.attack.a": {
    path: "/art/player-attack-a.png",
    width: 88,
    height: 96,
    frames: 6,
  },
  "player.attack.b": {
    path: "/art/player-attack-b.png",
    width: 88,
    height: 96,
    frames: 6,
  },
  "player.block": {
    path: "/art/player-block.png",
    width: 48,
    height: 96,
    frames: 2,
  },
  "player.hurt": {
    path: "/art/player-hurt.png",
    width: 48,
    height: 96,
    frames: 1,
  },
  "player.crouch": {
    path: "/art/player-crouch.png",
    width: 48,
    height: 96,
    frames: 2,
    ticksPerFrame: 18,
  },
  "player.crouchWalk": {
    path: "/art/player-crouch-walk.png",
    width: 48,
    height: 96,
    frames: 6,
    ticksPerFrame: 8,
  },
  // Eighty columns wide, not forty-eight. A lying body does not fit the
  // standing frame — two earlier attempts compressed one into it, which is
  // exactly why it read as squashed rather than as prone.
  "player.slide": {
    path: "/art/player-slide.png",
    width: 80,
    height: 96,
    frames: 4,
  },
  // Clinging to a wall. The face is on the RIGHT of the frame; the renderer
  // flips it for a wall on the other side, the same way it flips for facing.
  "player.wall": {
    path: "/art/player-wall.png",
    width: 48,
    height: 96,
    frames: 2,
  },
  // Swimming. Eighty columns like the slide, and for the same reason: a
  // horizontal body does not fit the standing frame. Six frames is one whole
  // stroke — fewer and the arm teleports over the head.
  "player.swim": {
    path: "/art/player-swim.png",
    width: 80,
    height: 96,
    frames: 6,
    ticksPerFrame: 6,
  },
  "player.smash": {
    path: "/art/player-smash.png",
    width: 48,
    height: 96,
    frames: 4,
  },
  // The guard-breaker. Two frames of wind-up, because its startup is three
  // times the sword's and a tell that long has to look like one throughout.
  "player.stun": {
    path: "/art/player-stun.png",
    width: 48,
    height: 96,
    frames: 5,
  },
  // Killed: stagger, knee, and down. The last frame is held, because the body
  // is the marker for where the run ended.
  "player.death": {
    path: "/art/player-death.png",
    width: 48,
    height: 96,
    frames: 6,
  },
  // The air ran out. Not a death — a becoming, which is the game's premise, so
  // it ends on a goblin rather than on a corpse.
  "player.transform": {
    path: "/art/player-transform.png",
    width: 48,
    height: 96,
    frames: 7,
  },
  "enemy.goblin.idle": {
    path: "/art/goblin-idle.png",
    width: 48,
    height: 96,
    frames: 2,
    ticksPerFrame: 16,
  },
  "enemy.goblin.walk": {
    path: "/art/goblin-walk.png",
    width: 48,
    height: 96,
    frames: 6,
    ticksPerFrame: 7,
  },
  "enemy.goblin.windup": {
    path: "/art/goblin-windup.png",
    width: 48,
    height: 96,
    frames: 2,
  },
  "enemy.goblin.strike": {
    path: "/art/goblin-strike.png",
    width: 48,
    height: 96,
    frames: 2,
  },
  "enemy.goblin.stagger": {
    path: "/art/goblin-stagger.png",
    width: 48,
    height: 96,
    frames: 1,
  },
  // The corrupt archer. Same stock as the goblin and a different silhouette:
  // upright, holding a bow at arm's length. The draw is three frames because
  // its tell has to survive the distance it shoots from.
  "enemy.archer.idle": {
    path: "/art/archer-idle.png",
    width: 48,
    height: 96,
    frames: 2,
    ticksPerFrame: 18,
  },
  "enemy.archer.walk": {
    path: "/art/archer-walk.png",
    width: 48,
    height: 96,
    frames: 6,
    ticksPerFrame: 8,
  },
  "enemy.archer.draw": {
    path: "/art/archer-draw.png",
    width: 48,
    height: 96,
    frames: 3,
  },
  "enemy.archer.loose": {
    path: "/art/archer-loose.png",
    width: 48,
    height: 96,
    frames: 2,
  },
  // The phoenix. 72 x 96 against a 40 x 88 hurtbox — the extra thirty units are
  // wingspan, and none of it is hittable. A bird whose wings fitted inside its
  // own hurtbox would read as a dart.
  "enemy.phoenix.hover": {
    path: "/art/phoenix-hover.png",
    width: 72,
    height: 96,
    frames: 4,
    ticksPerFrame: 9,
  },
  "enemy.phoenix.charge": {
    path: "/art/phoenix-charge.png",
    width: 72,
    height: 96,
    frames: 2,
  },
  "enemy.phoenix.throw": {
    path: "/art/phoenix-throw.png",
    width: 72,
    height: 96,
    frames: 2,
  },
  "enemy.phoenix.stagger": {
    path: "/art/phoenix-stagger.png",
    width: 72,
    height: 96,
    frames: 1,
  },
  // The flamethrower. Narrow and top-heavy, so it reads as coming at you even
  // standing still — the opposite silhouette to the phoenix on purpose, because
  // the two are answered in opposite ways and have to be told apart instantly.
  "enemy.flamer.idle": {
    path: "/art/flamer-idle.png",
    width: 56,
    height: 96,
    frames: 2,
    ticksPerFrame: 20,
  },
  "enemy.flamer.walk": {
    path: "/art/flamer-walk.png",
    width: 56,
    height: 96,
    frames: 6,
    ticksPerFrame: 7,
  },
  "enemy.flamer.wind": {
    path: "/art/flamer-wind.png",
    width: 56,
    height: 96,
    frames: 2,
  },
  "enemy.flamer.burn": {
    path: "/art/flamer-burn.png",
    width: 56,
    height: 96,
    frames: 4,
    ticksPerFrame: 5,
  },
  "enemy.flamer.stagger": {
    path: "/art/flamer-stagger.png",
    width: 56,
    height: 96,
    frames: 1,
  },
  // The Kiln. 176 x 200 against a 96 x 140 hurtbox — the overhang is arms, the
  // vent hood and the heat off it, none of which is hittable.
  //
  // Its two wind-ups are separate sheets for the same reason the Warden's are,
  // and the shapes are deliberately opposite: the rake is high and horizontal,
  // the eruption is low and vertical. They are answered in opposite ways, so
  // telling them apart has to be possible from the pose alone.
  "enemy.kiln.idle": {
    path: "/art/kiln-idle.png",
    width: 176,
    height: 200,
    frames: 4,
    ticksPerFrame: 13,
  },
  "enemy.kiln.rakeWindup": {
    path: "/art/kiln-rake-windup.png",
    width: 176,
    height: 200,
    frames: 3,
  },
  "enemy.kiln.rake": {
    path: "/art/kiln-rake.png",
    width: 176,
    height: 200,
    frames: 2,
  },
  "enemy.kiln.eruptWindup": {
    path: "/art/kiln-erupt-windup.png",
    width: 176,
    height: 200,
    frames: 3,
  },
  "enemy.kiln.erupt": {
    path: "/art/kiln-erupt.png",
    width: 176,
    height: 200,
    frames: 2,
  },
  "enemy.kiln.stagger": {
    path: "/art/kiln-stagger.png",
    width: 176,
    height: 200,
    frames: 1,
  },
  // Environments 3 and 5, and the boss at the bottom. Each is drawn to one
  // silhouette rule so the five are told apart before they arrive: the shark is
  // a horizontal wedge, the crab is wide and low, the lizard is long with its
  // head thrust out, the bee is the only small thing, and the Hollow is the
  // only quiet one.
  "enemy.shark.swim": {
    path: "/art/shark-swim.png",
    width: 128,
    height: 64,
    frames: 4,
    ticksPerFrame: 8,
  },
  "enemy.shark.bite": {
    path: "/art/shark-bite.png",
    width: 128,
    height: 64,
    frames: 2,
  },
  "enemy.crab.idle": {
    path: "/art/crab-idle.png",
    width: 80,
    height: 64,
    frames: 2,
    ticksPerFrame: 22,
  },
  "enemy.crab.walk": {
    path: "/art/crab-walk.png",
    width: 80,
    height: 64,
    frames: 4,
    ticksPerFrame: 10,
  },
  "enemy.crab.wind": {
    path: "/art/crab-wind.png",
    width: 80,
    height: 64,
    frames: 2,
  },
  "enemy.crab.strike": {
    path: "/art/crab-strike.png",
    width: 80,
    height: 64,
    frames: 2,
  },
  "enemy.crab.stagger": {
    path: "/art/crab-stagger.png",
    width: 80,
    height: 64,
    frames: 1,
  },
  "enemy.lizard.idle": {
    path: "/art/lizard-idle.png",
    width: 72,
    height: 56,
    frames: 2,
    ticksPerFrame: 18,
  },
  "enemy.lizard.walk": {
    path: "/art/lizard-walk.png",
    width: 72,
    height: 56,
    frames: 4,
    ticksPerFrame: 7,
  },
  "enemy.lizard.wind": {
    path: "/art/lizard-wind.png",
    width: 72,
    height: 56,
    frames: 2,
  },
  "enemy.lizard.strike": {
    path: "/art/lizard-strike.png",
    width: 72,
    height: 56,
    frames: 2,
  },
  "enemy.lizard.stagger": {
    path: "/art/lizard-stagger.png",
    width: 72,
    height: 56,
    frames: 1,
  },
  "enemy.bee.hover": {
    path: "/art/bee-hover.png",
    width: 48,
    height: 40,
    frames: 4,
    ticksPerFrame: 4,
  },
  "enemy.bee.wind": {
    path: "/art/bee-wind.png",
    width: 48,
    height: 40,
    frames: 2,
  },
  "enemy.bee.dive": {
    path: "/art/bee-dive.png",
    width: 48,
    height: 40,
    frames: 2,
    ticksPerFrame: 5,
  },
  "enemy.hollow.idle": {
    path: "/art/hollow-idle.png",
    width: 320,
    height: 360,
    frames: 10,
    ticksPerFrame: 5,
  },
  "enemy.hollow.sweepWindup": {
    path: "/art/hollow-sweep-windup.png",
    width: 320,
    height: 360,
    frames: 8,
  },
  "enemy.hollow.sweep": {
    path: "/art/hollow-sweep.png",
    width: 320,
    height: 360,
    frames: 7,
  },
  "enemy.hollow.waveWindup": {
    path: "/art/hollow-wave-windup.png",
    width: 320,
    height: 360,
    frames: 8,
  },
  "enemy.hollow.wave": {
    path: "/art/hollow-wave.png",
    width: 320,
    height: 360,
    frames: 7,
  },
  "enemy.hollow.stagger": {
    path: "/art/hollow-stagger.png",
    width: 320,
    height: 360,
    frames: 4,
    ticksPerFrame: 6,
  },
  // The three sink frames. `under` is the one with no body in it at all — the
  // player has to be able to see that there is nothing there to hit, or they
  // conclude their sword is broken.
  "enemy.hollow.sink": {
    path: "/art/hollow-sink.png",
    width: 320,
    height: 360,
    frames: 6,
  },
  "enemy.hollow.under": {
    path: "/art/hollow-under.png",
    width: 320,
    height: 360,
    frames: 6,
    ticksPerFrame: 4,
  },
  "enemy.hollow.rise": {
    path: "/art/hollow-rise.png",
    width: 320,
    height: 360,
    frames: 8,
  },
  // The Warden. 160 x 176 against a 84 x 132 hurtbox — the widest frame in the
  // game, because a raised fist and two shoulder platforms all have to fit
  // somewhere and none of them are hittable.
  //
  // The two wind-ups are separate sheets on purpose. They are answered in
  // opposite ways — parry the swing, jump the slam — so telling them apart is
  // the fight, and sharing frames between them would make that a coin toss.
  "enemy.warden.idle": {
    path: "/art/warden-idle.png",
    width: 160,
    height: 176,
    frames: 2,
    ticksPerFrame: 26,
  },
  "enemy.warden.windup": {
    path: "/art/warden-windup.png",
    width: 160,
    height: 176,
    frames: 2,
  },
  "enemy.warden.strike": {
    path: "/art/warden-strike.png",
    width: 160,
    height: 176,
    frames: 2,
  },
  "enemy.warden.slamWindup": {
    path: "/art/warden-slam-windup.png",
    width: 160,
    height: 176,
    frames: 2,
  },
  "enemy.warden.slam": {
    path: "/art/warden-slam.png",
    width: 160,
    height: 176,
    frames: 2,
  },
  "enemy.warden.stagger": {
    path: "/art/warden-stagger.png",
    width: 160,
    height: 176,
    frames: 1,
  },
  // Frames 0-4 are the five gem grades in ascending order — emerald, sapphire,
  // amethyst, topaz, diamond — and frame 5 is a gold coin. The grade IS the
  // frame index, which is what lets the HUD and the chest payout draw the right
  // stone without a lookup table.
  "prop.loot": {
    path: "/art/prop-loot.png",
    width: 20,
    height: 20,
    frames: 6,
  },
  // Closed, open and empty, open and paying out. Frame 2 is the moment the lid
  // comes up; it settles to frame 1 once the payout has been read.
  "prop.chest": {
    path: "/art/prop-chest.png",
    width: 48,
    height: 40,
    frames: 3,
  },

  // ------------------------------------------------------------- cosmetics
  //
  // A skin is a WHOLE FAMILY, generated from the same poses with a different
  // palette and a heavier silhouette — pauldrons, a crested helm, a greatsword.
  // The first attempt was a multiply tint over these very sheets, which cost
  // nothing and looked like it: the same man, slightly the wrong colour.
  //
  // Death and the transformation are deliberately NOT re-skinned. They belong
  // to the person rather than the armour, and the transformation ends on a
  // goblin whatever you were wearing.
  "skin.crimson.idle": {
    path: "/art/knight-crimson-idle.png",
    width: 48,
    height: 96,
    frames: 4,
    ticksPerFrame: 14,
  },
  "skin.crimson.walk": {
    path: "/art/knight-crimson-walk.png",
    width: 48,
    height: 96,
    frames: 12,
    ticksPerFrame: 4,
  },
  "skin.crimson.run": {
    path: "/art/knight-crimson-run.png",
    width: 48,
    height: 96,
    frames: 8,
    ticksPerFrame: 3,
  },
  "skin.crimson.attack.a": {
    path: "/art/knight-crimson-attack-a.png",
    width: 88,
    height: 96,
    frames: 6,
  },
  "skin.crimson.attack.b": {
    path: "/art/knight-crimson-attack-b.png",
    width: 88,
    height: 96,
    frames: 6,
  },
  "skin.crimson.block": {
    path: "/art/knight-crimson-block.png",
    width: 48,
    height: 96,
    frames: 2,
  },
  "skin.crimson.hurt": {
    path: "/art/knight-crimson-hurt.png",
    width: 48,
    height: 96,
    frames: 1,
  },
  "skin.crimson.crouch": {
    path: "/art/knight-crimson-crouch.png",
    width: 48,
    height: 96,
    frames: 2,
    ticksPerFrame: 18,
  },
  "skin.crimson.crouchWalk": {
    path: "/art/knight-crimson-crouch-walk.png",
    width: 48,
    height: 96,
    frames: 6,
    ticksPerFrame: 8,
  },
  "skin.crimson.slide": {
    path: "/art/knight-crimson-slide.png",
    width: 80,
    height: 96,
    frames: 4,
  },
  "skin.crimson.wall": {
    path: "/art/knight-crimson-wall.png",
    width: 48,
    height: 96,
    frames: 2,
  },
  "skin.crimson.swim": {
    path: "/art/knight-crimson-swim.png",
    width: 80,
    height: 96,
    frames: 6,
    ticksPerFrame: 6,
  },
  "skin.crimson.backstep": {
    path: "/art/knight-crimson-backstep.png",
    width: 48,
    height: 96,
    frames: 3,
  },
  "skin.crimson.smash": {
    path: "/art/knight-crimson-smash.png",
    width: 48,
    height: 96,
    frames: 4,
  },
  "skin.crimson.stun": {
    path: "/art/knight-crimson-stun.png",
    width: 48,
    height: 96,
    frames: 5,
  },
  "skin.pale.idle": {
    path: "/art/knight-pale-idle.png",
    width: 48,
    height: 96,
    frames: 4,
    ticksPerFrame: 14,
  },
  "skin.pale.walk": {
    path: "/art/knight-pale-walk.png",
    width: 48,
    height: 96,
    frames: 12,
    ticksPerFrame: 4,
  },
  "skin.pale.run": {
    path: "/art/knight-pale-run.png",
    width: 48,
    height: 96,
    frames: 8,
    ticksPerFrame: 3,
  },
  "skin.pale.attack.a": {
    path: "/art/knight-pale-attack-a.png",
    width: 88,
    height: 96,
    frames: 6,
  },
  "skin.pale.attack.b": {
    path: "/art/knight-pale-attack-b.png",
    width: 88,
    height: 96,
    frames: 6,
  },
  "skin.pale.block": {
    path: "/art/knight-pale-block.png",
    width: 48,
    height: 96,
    frames: 2,
  },
  "skin.pale.hurt": {
    path: "/art/knight-pale-hurt.png",
    width: 48,
    height: 96,
    frames: 1,
  },
  "skin.pale.crouch": {
    path: "/art/knight-pale-crouch.png",
    width: 48,
    height: 96,
    frames: 2,
    ticksPerFrame: 18,
  },
  "skin.pale.crouchWalk": {
    path: "/art/knight-pale-crouch-walk.png",
    width: 48,
    height: 96,
    frames: 6,
    ticksPerFrame: 8,
  },
  "skin.pale.slide": {
    path: "/art/knight-pale-slide.png",
    width: 80,
    height: 96,
    frames: 4,
  },
  "skin.pale.wall": {
    path: "/art/knight-pale-wall.png",
    width: 48,
    height: 96,
    frames: 2,
  },
  "skin.pale.swim": {
    path: "/art/knight-pale-swim.png",
    width: 80,
    height: 96,
    frames: 6,
    ticksPerFrame: 6,
  },
  "skin.pale.backstep": {
    path: "/art/knight-pale-backstep.png",
    width: 48,
    height: 96,
    frames: 3,
  },
  "skin.pale.smash": {
    path: "/art/knight-pale-smash.png",
    width: 48,
    height: 96,
    frames: 4,
  },
  "skin.pale.stun": {
    path: "/art/knight-pale-stun.png",
    width: 48,
    height: 96,
    frames: 5,
  },
  "skin.void.idle": {
    path: "/art/void-shroud-idle.png",
    width: 48,
    height: 96,
    frames: 4,
    ticksPerFrame: 14,
  },
  "skin.void.walk": {
    path: "/art/void-shroud-walk.png",
    width: 48,
    height: 96,
    frames: 12,
    ticksPerFrame: 4,
  },
  "skin.void.run": {
    path: "/art/void-shroud-run.png",
    width: 48,
    height: 96,
    frames: 8,
    ticksPerFrame: 3,
  },
  "skin.void.attack.a": {
    path: "/art/void-shroud-attack-a.png",
    width: 88,
    height: 96,
    frames: 6,
  },
  "skin.void.attack.b": {
    path: "/art/void-shroud-attack-b.png",
    width: 88,
    height: 96,
    frames: 6,
  },
  "skin.void.block": {
    path: "/art/void-shroud-block.png",
    width: 48,
    height: 96,
    frames: 2,
  },
  "skin.void.hurt": {
    path: "/art/void-shroud-hurt.png",
    width: 48,
    height: 96,
    frames: 1,
  },
  "skin.void.crouch": {
    path: "/art/void-shroud-crouch.png",
    width: 48,
    height: 96,
    frames: 2,
    ticksPerFrame: 18,
  },
  "skin.void.crouchWalk": {
    path: "/art/void-shroud-crouch-walk.png",
    width: 48,
    height: 96,
    frames: 6,
    ticksPerFrame: 8,
  },
  "skin.void.slide": {
    path: "/art/void-shroud-slide.png",
    width: 80,
    height: 96,
    frames: 4,
  },
  "skin.void.wall": {
    path: "/art/void-shroud-wall.png",
    width: 48,
    height: 96,
    frames: 2,
  },
  "skin.void.swim": {
    path: "/art/void-shroud-swim.png",
    width: 80,
    height: 96,
    frames: 6,
    ticksPerFrame: 6,
  },
  "skin.void.backstep": {
    path: "/art/void-shroud-backstep.png",
    width: 48,
    height: 96,
    frames: 3,
  },
  "skin.void.smash": {
    path: "/art/void-shroud-smash.png",
    width: 48,
    height: 96,
    frames: 4,
  },
  "skin.void.stun": {
    path: "/art/void-shroud-stun.png",
    width: 48,
    height: 96,
    frames: 5,
  },
  "skin.leviathan.idle": {
    path: "/art/deep-leviathan-idle.png",
    width: 48,
    height: 96,
    frames: 4,
    ticksPerFrame: 14,
  },
  "skin.leviathan.walk": {
    path: "/art/deep-leviathan-walk.png",
    width: 48,
    height: 96,
    frames: 12,
    ticksPerFrame: 4,
  },
  "skin.leviathan.run": {
    path: "/art/deep-leviathan-run.png",
    width: 48,
    height: 96,
    frames: 8,
    ticksPerFrame: 3,
  },
  "skin.leviathan.attack.a": {
    path: "/art/deep-leviathan-attack-a.png",
    width: 88,
    height: 96,
    frames: 6,
  },
  "skin.leviathan.attack.b": {
    path: "/art/deep-leviathan-attack-b.png",
    width: 88,
    height: 96,
    frames: 6,
  },
  "skin.leviathan.block": {
    path: "/art/deep-leviathan-block.png",
    width: 48,
    height: 96,
    frames: 2,
  },
  "skin.leviathan.hurt": {
    path: "/art/deep-leviathan-hurt.png",
    width: 48,
    height: 96,
    frames: 1,
  },
  "skin.leviathan.crouch": {
    path: "/art/deep-leviathan-crouch.png",
    width: 48,
    height: 96,
    frames: 2,
    ticksPerFrame: 18,
  },
  "skin.leviathan.crouchWalk": {
    path: "/art/deep-leviathan-crouch-walk.png",
    width: 48,
    height: 96,
    frames: 6,
    ticksPerFrame: 8,
  },
  "skin.leviathan.slide": {
    path: "/art/deep-leviathan-slide.png",
    width: 80,
    height: 96,
    frames: 4,
  },
  "skin.leviathan.wall": {
    path: "/art/deep-leviathan-wall.png",
    width: 48,
    height: 96,
    frames: 2,
  },
  "skin.leviathan.swim": {
    path: "/art/deep-leviathan-swim.png",
    width: 80,
    height: 96,
    frames: 6,
    ticksPerFrame: 6,
  },
  "skin.leviathan.backstep": {
    path: "/art/deep-leviathan-backstep.png",
    width: 48,
    height: 96,
    frames: 3,
  },
  "skin.leviathan.smash": {
    path: "/art/deep-leviathan-smash.png",
    width: 48,
    height: 96,
    frames: 4,
  },
  "skin.leviathan.stun": {
    path: "/art/deep-leviathan-stun.png",
    width: 48,
    height: 96,
    frames: 5,
  },
  // The Revenant's sheets, which are also the skin you take off it.
  //
  // One set serves both: the boss IS a player, so the enemy renderer and the
  // cosmetic shelf want exactly the same frames. Registering them twice under
  // two names would be two things to keep in step for no gain.
  "skin.revenant.idle": {
    path: "/art/revenant-idle.png",
    width: 48,
    height: 96,
    frames: 4,
  },
  "skin.revenant.walk": {
    path: "/art/revenant-walk.png",
    width: 48,
    height: 96,
    frames: 12,
  },
  "skin.revenant.run": {
    path: "/art/revenant-run.png",
    width: 48,
    height: 96,
    frames: 8,
  },
  "skin.revenant.attack.a": {
    path: "/art/revenant-attack-a.png",
    width: 48,
    height: 96,
    frames: 6,
  },
  "skin.revenant.attack.b": {
    path: "/art/revenant-attack-b.png",
    width: 48,
    height: 96,
    frames: 6,
  },
  "skin.revenant.block": {
    path: "/art/revenant-block.png",
    width: 48,
    height: 96,
    frames: 2,
  },
  "skin.revenant.hurt": {
    path: "/art/revenant-hurt.png",
    width: 48,
    height: 96,
    frames: 1,
  },
  "skin.revenant.crouch": {
    path: "/art/revenant-crouch.png",
    width: 48,
    height: 96,
    frames: 2,
  },
  "skin.revenant.crouchWalk": {
    path: "/art/revenant-crouch-walk.png",
    width: 48,
    height: 96,
    frames: 6,
  },
  "skin.revenant.slide": {
    path: "/art/revenant-slide.png",
    width: 80,
    height: 96,
    frames: 4,
  },
  "skin.revenant.swim": {
    path: "/art/revenant-swim.png",
    width: 80,
    height: 96,
    frames: 6,
    ticksPerFrame: 6,
  },
  "skin.revenant.wall": {
    path: "/art/revenant-wall.png",
    width: 48,
    height: 96,
    frames: 2,
  },
  "skin.revenant.backstep": {
    path: "/art/revenant-backstep.png",
    width: 48,
    height: 96,
    frames: 3,
  },
  "skin.revenant.smash": {
    path: "/art/revenant-smash.png",
    width: 48,
    height: 96,
    frames: 4,
  },
  "skin.revenant.stun": {
    path: "/art/revenant-stun.png",
    width: 48,
    height: 96,
    frames: 5,
  },
  // The throw, which is what it has where the player has a stun. Drawn as a
  // throw rather than borrowed from the smash: a smash says "something is about
  // to happen at my feet" and a ranged tell has to say the opposite.
  "skin.revenant.throw": {
    path: "/art/revenant-throw.png",
    width: 48,
    height: 96,
    frames: 5,
  },
  // And its own death, in its own colours. Every other skin shares the
  // scavenger's corpse, which is right for a cosmetic and wrong for the one
  // character who dies on screen in front of somebody watching it.
  "skin.revenant.death": {
    path: "/art/revenant-death.png",
    width: 48,
    height: 96,
    frames: 6,
  },
  "pet.moth.idle": {
    path: "/art/pet-moth-idle.png",
    width: 32,
    height: 32,
    frames: 2,
    ticksPerFrame: 22,
  },
  "pet.moth.walk": {
    path: "/art/pet-moth-walk.png",
    width: 32,
    height: 32,
    frames: 4,
    ticksPerFrame: 6,
  },
  "pet.moth.jump": {
    path: "/art/pet-moth-jump.png",
    width: 32,
    height: 32,
    frames: 1,
  },
  "pet.pup.idle": {
    path: "/art/pet-pup-idle.png",
    width: 32,
    height: 32,
    frames: 2,
    ticksPerFrame: 22,
  },
  "pet.pup.walk": {
    path: "/art/pet-pup-walk.png",
    width: 32,
    height: 32,
    frames: 4,
    ticksPerFrame: 6,
  },
  "pet.pup.jump": {
    path: "/art/pet-pup-jump.png",
    width: 32,
    height: 32,
    frames: 1,
  },
  "pet.rat.idle": {
    path: "/art/pet-rat-idle.png",
    width: 32,
    height: 32,
    frames: 2,
    ticksPerFrame: 22,
  },
  "pet.rat.walk": {
    path: "/art/pet-rat-walk.png",
    width: 32,
    height: 32,
    frames: 4,
    ticksPerFrame: 6,
  },
  "pet.rat.jump": {
    path: "/art/pet-rat-jump.png",
    width: 32,
    height: 32,
    frames: 1,
  },

  // The drawing, doubled, with its threshold cropped — and nothing else done to
  // it. Every cut and fade this used to carry left a straight edge the drawing
  // never had. See art-src/extend-cave.py.
  "cave.entrance": {
    path: "/art/cave-entrance.png",
    width: 766,
    height: 516,
    frames: 1,
  },
  // The step back. Its own animation, because a backstep and a slide are
  // different moves and reading them as the same one costs a player the
  // difference between a dodge and an escape.
  "player.backstep": {
    path: "/art/player-backstep.png",
    width: 48,
    height: 96,
    frames: 3,
  },
};

export class SpriteSet {
  private frames = new Map<SpriteKey, Texture[]>();
  private warnings: string[] = [];

  get loaded(): ReadonlySet<SpriteKey> {
    return new Set(this.frames.keys());
  }

  get issues(): readonly string[] {
    return this.warnings;
  }

  has(key: SpriteKey): boolean {
    return this.frames.has(key);
  }

  /** One frame of an animation. `index` wraps, so callers need not clamp. */
  frame(key: SpriteKey, index = 0): Texture | null {
    const list = this.frames.get(key);
    if (!list || list.length === 0) return null;
    return list[((index % list.length) + list.length) % list.length];
  }

  /** Frame for a free-running animation at the given tick. */
  frameAtTick(key: SpriteKey, tick: number): Texture | null {
    const def = SPRITE_MANIFEST[key];
    const per = def.ticksPerFrame ?? 6;
    return this.frame(key, Math.floor(tick / per));
  }

  /** Frame for a one-shot animation, mapped across its whole duration. */
  frameOverProgress(key: SpriteKey, progress: number): Texture | null {
    const list = this.frames.get(key);
    if (!list || list.length === 0) return null;
    const i = Math.floor(Math.min(Math.max(progress, 0), 0.999) * list.length);
    return list[i];
  }

  static async load(): Promise<SpriteSet> {
    const set = new SpriteSet();

    await Promise.all(
      (Object.keys(SPRITE_MANIFEST) as SpriteKey[]).map(async (key) => {
        const def = SPRITE_MANIFEST[key];
        try {
          // A 404 returns HTML, which Pixi rejects — so a missing file lands
          // here rather than producing a broken texture.
          const sheet = await Assets.load<Texture>(def.path);
          if (!sheet) return;

          // Pixel art must not be smoothed, or a 32px sprite scaled to any
          // non-integer size turns to mush.
          sheet.source.scaleMode = "nearest";

          const expectedWidth = def.width * def.frames;
          if (sheet.width !== expectedWidth || sheet.height !== def.height) {
            set.warnings.push(
              `${def.path} is ${sheet.width}x${sheet.height}, expected ${expectedWidth}x${def.height}`,
            );
          }

          // Slice the strip. One frame still goes through this path, so there
          // is only one code path to get wrong.
          const usable = Math.max(
            1,
            Math.min(def.frames, Math.floor(sheet.width / def.width)),
          );
          const textures: Texture[] = [];
          for (let i = 0; i < usable; i++) {
            textures.push(
              new Texture({
                source: sheet.source,
                frame: new Rectangle(i * def.width, 0, def.width, def.height),
              }),
            );
          }
          set.frames.set(key, textures);
        } catch {
          // Absent art is the normal state until it is drawn. Not an error.
        }
      }),
    );

    return set;
  }
}
