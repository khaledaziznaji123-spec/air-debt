/**
 * PixiJS view layer. ARCH AD-5, NFR-5.3.
 *
 * Reads simulation state and draws it. Owns no state that matters, decides
 * nothing, and never advances time. Everything here is disposable — swapping
 * the art (PRD NFR-3.1) should never require touching `src/sim`.
 *
 * Interpolation lives here on purpose: the sim runs at a fixed 60 ticks while
 * the display may run faster, and smoothing between the last two states is a
 * rendering concern that must never feed back into the core.
 */

import {
  Application,
  Container,
  Graphics,
  Sprite,
  Text,
  TextStyle,
} from "pixi.js";
import { tuning } from "../config/tuning.ts";
import { bossArena, eruptionAt, isLock, kilnAura } from "../sim/step.ts";
import {
  burrowId,
  chuteId,
  geyserId,
  highRoadId,
  dungeonStart,
  environmentStart,
  themeAt,
  themeEnd,
  themeStart,
  interactReach,
  shortcuts,
  worldEnd,
} from "../config/dungeon.ts";
import {
  CEILING_Y,
  builtEnd,
  chamber,
  escapeAt,
  inChamber,
  roomAt,
  tutorial as tutorialGeom,
  escapes,
  exitX,
  highRoad,
  geyserVents,
  hazardAt,
  roofAt,
  terrain,
  cenoteShafts,
  caveMouths,
} from "../config/terrain.ts";
import { groundUnder } from "../sim/collide.ts";
import {
  enemySize,
  playerHitbox,
  statsFor,
  SHOP,
  type SimState,
} from "../sim/index.ts";
import { SPRITE_MANIFEST, SpriteSet, type SpriteKey } from "./sprites.ts";

/** Counted, not written down — a hardcoded total goes stale the first time a
 *  sprite is added and then quietly reports 17/16. */
const SPRITE_COUNT = Object.keys(SPRITE_MANIFEST).length;
import { Particles } from "./particles.ts";

/** How much of the dungeon is on screen at once. */
const VIEW_W = tuning.room.width;
const VIEW_H = 720;

/** The vent's geometry, which the art has to agree with exactly. */
const MOVE_VENT = tuning.movement;

const COLOR = {
  sky: 0x0b0e14,
  floor: 0x0b0e14,
  player: 0xe8edf5,
  playerBlocking: 0x4ecdc4,
  playerAttacking: 0xf4a259,
  playerDashing: 0x8a94a6,
  air: 0x4ecdc4,
  airLow: 0xe56b6f,
  hud: 0xe8edf5,
  enemy: 0x7d8794,
  enemyTelegraph: 0xf4a259,
  enemyStriking: 0xe56b6f,
  enemyStaggered: 0x4ecdc4,
  parryFlash: 0xffffff,
  swing: 0xf4a259,
  /**
   * The guard-breaker. Cold and white against the sword's warm gold, because
   * the two must never be mistaken for each other mid-fight — one of them is
   * the answer to a raised guard and the other is not.
   */
  stunCore: 0xffffff,
  stunCharge: 0xa9d4ff,
  playerStunning: 0x9ecbff,
  groundOutside: 0x2b3242,
  groundOutsideLip: 0x3d4759,
  groundLip: 0x1a2029,
  rubble: 0x39445a,
  rubbleOutside: 0x4a5468,
  crack: 0x141a24,
  /** Floor detail: strata, damp, grit and the odd thing left behind. */
  floorDeep: 0x090b10,
  strata: 0x11161e,
  damp: 0x24384a,
  moss: 0x2c4536,
  grit: 0x2c3444,
  boneShard: 0x8d8f7e,
  rock: 0x1a212c,
  rockLip: 0x2f3947,
  caveDark: 0x070a0f,
  doorFrame: 0x39445a,
  doorSealed: 0x0e131b,
  doorOpen: 0x4ecdc4,
  lever: 0xf4a259,
  boundary: 0x4a5468,
  /**
   * The cave's own palette, lifted from the mouth's artwork so the inside and
   * the entrance read as one place. The old ground was a single desaturated
   * blue-grey, which is why it looked like a platform rather than rock.
   */
  rockDeep: 0x08060c,
  rockBase: 0x100d17,
  rockMid: 0x1c1620,
  rockLit: 0x2b1d1c,
  rockHot: 0x3d2617,
  caveMoss: 0x1e2d17,
  /** The only thing down here that makes its own light. */
  crystal: 0x4ecdc4,
  crystalCore: 0xcffff8,
  /** Cast from a crystal onto the rock around it. */
  crystalGlow: 0x1d5c5c,
  // The fire. One four-value ramp shared with the monsters' sprites, so a
  // phoenix over a pool is lit by the same palette the pool is.
  // Environment 3. Cold, and light enough that the surface reads as a line
  // rather than as the top of a dark hole.
  // The beach, and the seabed under the whole of it — one material, so the
  // shore and the shallows and the deep are visibly the same ground getting
  // wetter rather than three different places.
  sandLit: 0x8a7a5c,
  sand: 0x5c5038,
  sandMid: 0x3e3626,
  sandDeep: 0x1c1810,
  sea: 0x2f6f88,
  seaDeep: 0x143b4d,
  seaLit: 0x9fe0ef,
  foam: 0xdff4fb,
  // Environment 5.
  bile: 0x86b32e,
  bileLit: 0xcff06a,
  bileDeep: 0x33500f,
  quench: 0x1b3a4a,
  quenchLit: 0x4e8fa8,
  lava: 0xff7a24,
  lavaHot: 0xffd06a,
  lavaDeep: 0x8e2408,
  lavaCrust: 0x3a2320,
  emberSmoke: 0x2a1c1a,
  spike: 0x4a525c,
  spikeTip: 0x6f7a86,
  ladderRail: 0x3a2412,
  ladderRung: 0x50341d,
  trapPlate: 0x272d35,
  trapTell: 0xf4a259,
  trapBlade: 0xd8e2ec,
  chest: 0x5a4632,
  chestLid: 0x74593d,
  chestBrass: 0xc89a3e,
  /** An emptied chest. Still drawn — it is the map of where you have been. */
  chestSpent: 0x2a2f3a,
  gem: 0x7fd8f5,
  legendary: 0xffd479,
} as const;

/**
 * The gem grades, in order, matching `prop-loot.png` frame for frame and
 * `tuning.loot.gemNames` name for name — emerald, sapphire, amethyst, topaz,
 * diamond. Index IS the frame index, so a grade never has to be translated
 * into an icon anywhere. Shared with the shop, which shows the same stones.
 */
const GEM_COLOUR = tuning.loot.gemColours;
/**
 * The cosmetics, as multiply tints over the ordinary player sprite.
 *
 * A tint rather than three more sprite sheets. Fifteen animations at 48x96
 * apiece, recoloured three ways, is four hundred frames to regenerate every
 * time a pose changes — and a cosmetic is not allowed to cost that, because
 * nothing about it affects the game.
 */
const POTION_TINT: Record<string, number> = {
  restoration: 0xe8556d,
  breath: 0x5fd9cf,
  haste: 0x9be86a,
  venom: 0xb37aea,
  ward: 0xf2a03c,
  milk: 0xf3ece0,
  shield: 0xbfe9ff,
};

/** The gold coin sits after the gems on the same sheet. */
const COIN_FRAME = GEM_COLOUR.length;

/** The last ten seconds, when the vignette starts closing in (PRD FR-1.2). */
const VIGNETTE_TICKS = 10 * 60;

/** The whole stun, startup to the end of recovery. */
const STUN_TOTAL =
  tuning.player.stunStartup +
  tuning.player.stunActive +
  tuning.player.stunRecovery;

/**
 * How long the mouth takes to change hands when it is crossed.
 *
 * The threshold is the run's one irreversible decision, so it gets a moment
 * rather than a frame: the dark ahead lifts as the daylight behind closes, and
 * for half a second both are on screen at once. A hard cut reads as a level
 * loading; this reads as a door shutting.
 */
const THRESHOLD_FADE = 42;

/** How long a prompt takes to come up or go down, in seconds. */
const PROMPT_FADE = 0.22;

/**
 * What the mouth's own art comes down to once you are through it.
 *
 * The only light in the scene is daylight, and daylight is behind you now — so
 * the rock the mouth is cut into cannot still be lit. Left bright it sits as a
 * band of colour between the player and the point where the tunnel roof takes
 * over, which is the one place the eye is drawn precisely when it should be
 * looking ahead.
 *
 * Not black: the mouth has to stay findable as a shape, because it is the way
 * out and an extraction is worth the whole run.
 */
const CAVE_TINT_INSIDE = 0x161b24;

/** Channel-wise blend, for tints that have to move with the crossing. */
function mixColour(from: number, to: number, t: number): number {
  const at = (shift: number) => {
    const a = (from >> shift) & 255;
    const b = (to >> shift) & 255;
    return Math.round(a + (b - a) * t) << shift;
  };
  return at(16) | at(8) | at(0);
}

export class Renderer {
  private app: Application;
  private world = new Container();
  private playerGfx = new Graphics();
  private enemyGfx = new Graphics();
  private fxGfx = new Graphics();
  /**
   * The lamp's light, on its own layer UNDER the world's furniture.
   *
   * Over the top it is a torch beam painted across the art — it lights nothing
   * and hides whatever it crosses. Under it, the same cone reads as light
   * falling on the ground, which is the thing being sold.
   */
  private lampGfx = new Graphics();
  /** 0..1 as a boss's walls come up out of the floor. */
  private arenaRaised = 0;
  private floorGfx = new Graphics();
  private caveGfx = new Graphics();
  private ceilingGfx = new Graphics();
  private spillGfx = new Graphics();
  private hazardGfx = new Graphics();
  private fixtureGfx = new Graphics();
  private darkGfx = new Graphics();
  private vignette = new Graphics();
  /** The dial. Replaced the draining horizontal bar. */
  private clockGfx = new Graphics();
  /** The map, to scale, with an arrow on it. */
  private depthGfx = new Graphics();
  /** Potions carried, and whether they are still there. */
  private potionGfx = new Graphics();
  private healthBar = new Graphics();
  private airText: Text;
  private debugText: Text;
  private promptText: Text;
  private depthText: Text;
  /**
   * "EMPTY", in the middle of the boss chamber.
   *
   * The room ships without the boss in it, and a big dark room with nothing in
   * it is indistinguishable from a bug. This says which one it is, and it comes
   * out the day something stands there.
   */
  private chamberNote: Text;
  /**
   * The run's takings, top right: gold on its own line, and under it one cell
   * per gem grade in ascending order, left to right.
   *
   * Built lazily on the first frame the art is available, because the icons are
   * sprites and the sheet loads after the renderer does.
   */
  private tally = new Container();
  private tallyGfx = new Graphics();
  private goldText: Text | null = null;
  private goldIcon: Sprite | null = null;
  private gemCells: { icon: Sprite | null; text: Text }[] = [];
  private debug = false;
  /**
   * How long each environment took, in ticks, as they are crossed.
   *
   * For tuning the air ceiling against real play rather than against an
   * estimate. `tuning.budget.environmentTraverse` is a guess at how long one
   * environment takes to cross, and the whole time budget is solved from it —
   * so if the guess is wrong, the ceiling derived from it is wrong too, and
   * there was previously no way to find out except by feel.
   *
   * View only. The simulation neither knows nor cares that this is being
   * counted.
   */
  private splits: number[] = [];
  private splitFrom = 0;
  private lastEnv = -1;
  private art: SpriteSet;
  /** One sprite per enemy, reused across ticks rather than rebuilt. */
  private enemySprites: Sprite[] = [];
  private playerSprite: Sprite | null = null;
  /** The pet, and where it has got to. View-only — see `drawPet`. */
  private petSprite: Sprite | null = null;
  private pet = { x: 0, y: 0, vy: 0, hop: 0, step: 0 };
  private petSettled = false;
  private caveSprite: Sprite | null = null;
  /** One sprite per chest, kept across ticks rather than rebuilt. */
  private chestSprites = new Map<string, Sprite>();
  /** The tick each chest was first seen open, so the payout frame can expire. */
  private openedAt = new Map<string, number>();
  /**
   * Floating "what you just got" readouts. View-only and wall-clock driven:
   * they are a notification, not part of the run, and a replay that paused
   * mid-rise should not have one frozen over a chest.
   */
  private pickups: Array<{
    x: number;
    y: number;
    age: number;
    label: Text;
    icon: Sprite | null;
  }> = [];
  private particles = new Particles();
  private lastDrawMs = 0;
  /** Seconds since the last frame. View-only, for things that ease rather than tick. */
  private frameDt = 0;
  /** The line the prompt currently reads, and how far up it is (0..1). */
  private promptShown: { text: string; colour: number; pulse: boolean } | null =
    null;
  private promptFade = 0;
  /**
   * Left edge of the visible window, in world units.
   *
   * The dungeon is roughly fifty thousand units long and the viewport is 1280,
   * so everything drawn in world space is clipped to this window by hand. A
   * Graphics call per rock across the whole dungeon would be forty times the
   * work for one screen's worth of pixels.
   */
  private cameraX = 0;
  /**
   * How far the lamp is currently leading the camera, eased toward its target.
   *
   * A view value with no equivalent in the simulation, which is the whole point
   * of the item being a view item — see `sightAhead`.
   */
  private lampLead = 0;
  /**
   * Where the Revenant was last frame, so "is it walking" can be answered.
   *
   * The simulation does not say — an enemy has phases, not a gait — and the
   * difference between standing and walking is the whole reason its approach
   * reads as a person closing on you rather than a sprite sliding.
   */
  private revenantWasAt = 0;
  /** The tick it went down on, so its death can play out once and hold. */
  private revenantDiedAt: number | null = null;
  /**
   * Which swing the Revenant is on, flipped at the start of each one.
   *
   * The player alternates two attack animations for exactly this reason: two
   * identical swings in a row read as the game repeating itself rather than as
   * a fighter throwing twice. It matters more here than anywhere — this is the
   * one enemy the player will stand in front of for a minute at a time.
   */
  private revenantSwing: 0 | 1 = 0;
  private revenantWasPhase = "";
  /** Zero everywhere except down a shaft. See the note in `draw`. */
  private cameraY = 0;

  private constructor(app: Application, art: SpriteSet) {
    this.app = app;
    this.art = art;

    const hudStyle = new TextStyle({
      fontFamily: "ui-monospace, Menlo, Consolas, monospace",
      fontSize: 28,
      fontWeight: "700",
      fill: COLOR.hud,
    });
    this.airText = new Text({ text: "", style: hudStyle });
    this.airText.anchor.set(0.5, 0);

    this.promptText = new Text({
      text: "",
      style: new TextStyle({
        fontFamily: "ui-monospace, Menlo, Consolas, monospace",
        fontSize: 15,
        fontWeight: "700",
        fill: COLOR.air,
        letterSpacing: 2,
      }),
    });
    this.promptText.anchor.set(0.5, 0);


    this.tally.addChild(this.tallyGfx);
    this.tally.visible = false;

    this.depthText = new Text({
      text: "",
      style: new TextStyle({
        fontFamily: "ui-monospace, Menlo, Consolas, monospace",
        fontSize: 12,
        fontWeight: "700",
        fill: 0x8a94a6,
        letterSpacing: 2,
      }),
    });
    // Left-aligned off the end of the bar, so the bar itself stays centred as
    // the figure grows from 0m to five digits.
    this.depthText.anchor.set(0, 0);

    this.chamberNote = new Text({
      text: "",
      style: new TextStyle({
        fontFamily: "ui-monospace, Menlo, Consolas, monospace",
        fontSize: 26,
        fontWeight: "700",
        fill: 0x3b4557,
        letterSpacing: 12,
      }),
    });
    this.chamberNote.anchor.set(0.5, 0.5);
    this.world.addChild(this.chamberNote);

    this.debugText = new Text({
      text: "",
      style: new TextStyle({
        fontFamily: "ui-monospace, Menlo, Consolas, monospace",
        fontSize: 13,
        fill: 0x8a94a6,
      }),
    });

    this.world.addChild(
      this.caveGfx,
      // Behind the mouth's own art, so the crown reads in front of the tunnel
      // roof rather than the roof being laid across it.
      this.ceilingGfx,
      this.floorGfx,
      this.lampGfx,
      this.hazardGfx,
      this.spillGfx,
      this.fixtureGfx,
      this.enemyGfx,
      this.playerGfx,
      this.fxGfx,
      this.particles.gfx,
      this.darkGfx,
    );
    this.app.stage.addChild(
      this.world,
      this.vignette,
      this.clockGfx,
      this.depthGfx,
      this.potionGfx,
      this.healthBar,
      this.airText,
      this.promptText,
      this.depthText,
      this.tally,
      this.debugText,
    );
  }

  static async create(canvas: HTMLCanvasElement): Promise<Renderer> {
    const app = new Application();
    await app.init({
      canvas,
      width: VIEW_W,
      height: 720,
      background: COLOR.sky,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(globalThis.devicePixelRatio ?? 1, 2),
    });
    // `autoDensity` pins an explicit pixel size onto the canvas. Put it back to
    // filling its box: the view is a fixed 1280x720 of dungeon that should
    // scale to whatever space it is given, not overflow a narrower window.
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    // Art is optional — a missing file falls back to placeholder shapes, so
    // the game stays playable while it is still being drawn (ARCH AD-16).
    const art = await SpriteSet.load();
    return new Renderer(app, art);
  }

  /** Where the view starts, so sound can tell what is within earshot. */
  cameraLeft(): number {
    return this.cameraX;
  }

  setDebug(on: boolean): void {
    this.debug = on;
    this.debugText.visible = on;
  }

  /**
   * Damp the full-screen colour flashes.
   *
   * Damped rather than removed. The flash marks a real event — a potion taken, a
   * legendary found — and deleting it outright would take away information; a
   * fifth of the strength still reads as "something happened" without filling
   * the screen. A player who needs this needs it because the screen filling is
   * the problem, not because the event is.
   */
  setReduceFlashes(on: boolean): void {
    this.flashScale = on ? 0.2 : 1;
  }

  /**
   * @param state the newest simulation state
   * @param alpha how far between the previous tick and this one we are, 0..1
   */
  draw(state: SimState, previous: SimState, alpha: number): void {
    const p = state.player;
    const prev = previous.player;

    // Interpolate for smoothness. A teleport (respawn, Passage) would smear, so
    // snap when the gap is larger than any single tick could produce.
    const jumped = Math.abs(p.x - prev.x) > 64 || Math.abs(p.y - prev.y) > 64;
    const x = jumped ? p.x : prev.x + (p.x - prev.x) * alpha;
    const y = jumped ? p.y : prev.y + (p.y - prev.y) * alpha;

    const now = performance.now();
    const dt =
      this.lastDrawMs === 0
        ? 0
        : Math.min((now - this.lastDrawMs) / 1000, 0.05);
    this.lastDrawMs = now;
    this.frameDt = dt;
    this.spawnParticles(state);
    this.particles.update(dt);
    this.particles.draw();
    this.stepPickups(dt);

    // Camera. The player sits slightly back from centre so more of what is
    // ahead is visible than what has already been survived — a run is about
    // what is coming, and the air does not allow looking back.
    //
    // The lamp buys more of that, in the direction you are FACING. Eased rather
    // than snapped: a camera that jumped ninety units every time the player
    // turned round would be worse than not having the item, and a run is full
    // of turning round.
    /**
     * The camera lead is CAPPED, while the light itself is not.
     *
     * The lantern was moving two things at once: it lengthened the cone, and it
     * pushed the camera the same distance forward. At three levels that is seven
     * hundred and twenty units of push against a player who sits five hundred and
     * thirty-eight from the edge, so the view arrived somewhere the player was
     * not — reported as "the game focuses on the light and you cannot see the
     * character", which is exactly what it did.
     *
     * The two were always redundant. What this game limits vision with is the
     * gloom, and what the lantern buys is a cone that cuts through it — that is
     * the item, and it still grows at full rate with every level. The camera
     * only ever needed to lean far enough that the lit ground is on screen, and
     * past that it was taking the player off it.
     *
     * So: the cone keeps its whole reach, the lean stops at a comfortable
     * distance, and the upgrade is felt as more ground lit rather than as being
     * shoved out of frame.
     */
    const LEAD_CAP = 200;
    // Forward too, for the same reason and to keep the two in agreement: a lean
    // that flipped while the cone did not would put the light behind the view.
    const lamp = Math.min(statsFor(state.loadout).sightAhead, LEAD_CAP);
    this.lampLead +=
      (lamp - this.lampLead) * Math.min(1, this.frameDt * 3.2);
    let target = x - VIEW_W * 0.42 + this.lampLead;

    /**
     * THE PLAYER STAYS ON SCREEN. Always, whatever the lamp is doing.
     *
     * A maxed lantern leads seven hundred and twenty units, and the player
     * normally sits five hundred and thirty-eight from the left edge — so
     * facing right the camera ran a hundred and eighty-two units PAST them and
     * the player was off the left edge of a screen that was following them.
     * Reported from a ranked run, which is where it had to show up first:
     * ranked hands out every piece of gear at full tier, so it is the only mode
     * where anybody had three lantern levels at once.
     *
     * The lead is worth having — it is the whole item, and seeing further ahead
     * in the parkour is a different game. So it is kept and then bounded: the
     * body may be led toward an edge but never past this margin of one, which
     * means the lamp does as much as it can without ever costing you sight of
     * yourself.
     */
    // A backstop rather than the mechanism. With the lead capped above, nothing
    // should reach this — it is here so that a future item, or a tuning change
    // somebody makes at midnight, cannot put the player off the screen again.
    const MARGIN = 260;
    const screenX = x - target;
    if (screenX < MARGIN) target = x - MARGIN;
    if (screenX > VIEW_W - MARGIN) target = x - (VIEW_W - MARGIN);
    // The chamber is built past the end of the world, so the camera has to be
    // allowed out there too. Without this the view stopped at `worldEnd` and
    // the boss fight happened entirely off the right-hand edge of the screen —
    // a room you walk into and cannot see.
    // Both rooms, not just the chamber. The tutorial hall is built past the end
    // of the world for the same reason and would have failed the same way: the
    // whole tutorial playing off the right-hand edge of the screen.
    const room = roomAt(x);
    const far = room ? room.x1 + 80 : worldEnd;
    const maxX = Math.max(0, far - VIEW_W);
    this.cameraX = Math.round(Math.min(Math.max(target, 0), maxX));
    this.world.x = -this.cameraX;

    // Vertically the camera does nothing at all until the player leaves the
    // bottom of the frame, and then it follows.
    //
    // It had no vertical axis before, which was invisible while the deepest
    // hole in the world was 150 units: the floor sits at 470 in a 720-tall view,
    // so there were 250 units of visible cellar and nothing went past them. The
    // shaft is 420 deep. Without this the player simply leaves the screen and
    // climbs back up out of sight.
    //
    // A dead zone rather than a centred follow, because a camera that tracks
    // height everywhere would drift on every jump and turn flat ground into a
    // moving shot. On the floor this term is exactly zero.
    const drop = Math.max(0, y - (VIEW_H - 150));
    const ease = Math.min(1, this.frameDt * 7);
    this.cameraY += (drop - this.cameraY) * ease;
    if (Math.abs(this.cameraY - drop) < 0.4) this.cameraY = drop;
    this.world.y = -Math.round(this.cameraY);

    this.drawCave(state);
    this.drawCeiling();
    this.drawTerrain(state.tick, state);
    this.drawHazards(state);
    this.drawArena(state);
    this.drawSpill(state);
    this.drawFixtures(state);
    this.drawEnemies(state);
    this.drawPlayer(state, x, y);
    this.drawPet(state, x, y, dt);
    // After `drawFx`, not before: that pass owns the same Graphics and clears
    // it on entry, so a burn drawn first was wiped every single frame.
    this.drawFx(state);
    this.drawLamp(state, x, y);
    this.drawBurning(state, x, y);
    this.drawDarkness(state);
    this.drawAir(state);
    this.drawHealth(state);
    this.drawVignette(state);

    if (this.debug) {
      // Below the health bar and the gem counter, both of which live in this
      // corner and are not debug-only.
      this.debugText.position.set(12, 66);
      const stats = statsFor(state.loadout);
      // Splits, recorded as the player crosses. Reset when a run restarts.
      if (state.tick < this.splitFrom) {
        this.splits = [];
        this.splitFrom = 0;
        this.lastEnv = -1;
      }
      if (state.entered && state.environment !== this.lastEnv) {
        if (this.lastEnv >= 0) this.splits.push(state.tick - this.splitFrom);
        this.splitFrom = state.tick;
        this.lastEnv = state.environment;
      }
      const here = state.entered ? state.tick - this.splitFrom : 0;
      const secs = (ticks: number) => (ticks / 60).toFixed(1) + "s";

      this.debugText.text = [
        `tick     ${state.tick}`,
        `air      ${state.air} (${(state.air / 60).toFixed(1)}s)`,
        `pos      ${p.x.toFixed(1)}, ${p.y.toFixed(1)}`,
        `vel      ${p.vx.toFixed(2)}, ${p.vy.toFixed(2)}`,
        `stance   ${p.stance}${p.running ? " (sprint)" : ""}`,
        `facing   ${p.facing > 0 ? "right" : "left"}`,
        `action   ${p.action.kind ?? "-"} (lockout ${p.action.lockout})`,
        `outcome  ${state.outcome}`,
        `env      ${state.environment + 1}/${tuning.budget.environmentCount}`,
        // What each environment actually cost, against what the budget assumes
        // one costs. The pair is the point: the difference between them is how
        // wrong the air ceiling is.
        `splits   ${this.splits.map(secs).join("  ") || "-"}${this.splits.length ? "  |" : ""} here ${secs(here)}`,
        `budget   ${secs(tuning.budget.environmentTraverse)} assumed per environment`,
        `elapsed  ${secs(this.splits.reduce((a, b) => a + b, 0) + here)} since entering`,
        `open     ${state.openShortcuts.length}/${shortcuts.length} shortcuts`,
        `flicked  ${state.leversFlicked.join(", ") || "-"}`,
        `enemies  ${state.enemies.filter((e) => e.phase !== "dead").length} alive`,
        `chests   ${state.chests.filter((c) => c.opened).length}/${state.chests.length} opened`,
        `carried  ${state.carried.gems.map((n, i) => `g${i + 1}:${n}`).join(" ")}`,
        `         ${state.carried.gold} gold, ${state.carried.legendaries} legendary`,
        // The loadout, because "I bought it and nothing happened" is otherwise
        // unanswerable from the screen: you cannot tell a purchase that did not
        // take from an effect that is not wired up.
        `owned    ${
          Object.entries(state.loadout.levels)
            .filter(([, n]) => n > 0)
            .map(([id, n]) => `${id.split(".")[1]}:${n}`)
            .join(" ") || "-"
        }`,
        `         skin ${state.loadout.skin ?? "-"}`,
        `potions  ${state.potions.length ? state.potions.join(" ") : "-"}`,
        `stats    dmg ${stats.attackDamage} reach ${stats.attackReach} riposte ${stats.riposteDamage}`,
        `         ${stats.healthBars} bars of ${stats.perBar}, wallslide ${stats.wallSlideSpeed}`,
        "",
        `art      ${this.art.loaded.size}/${SPRITE_COUNT} loaded`,
        ...this.art.issues.map((w) => `  ! ${w}`),
      ].join("\n");
    }
  }

  /**
   * Turn this tick's simulation events into particles. Events are per-tick and
   * cleared by the sim, so each one spawns exactly once.
   */
  private spawnParticles(state: SimState): void {
    const p = state.player;
    for (const event of state.events) {
      switch (event.type) {
        case "parry":
          this.particles.parry(event.x, event.y, p.facing);
          break;
        case "enemyHit":
          if (p.action.kind === "stun")
            this.particles.concussion(event.x, event.y, p.facing);
          else this.particles.hit(event.x, event.y, p.facing);
          break;
        case "playerHit":
          this.particles.hit(
            p.x,
            p.y - tuning.player.height * 0.6,
            p.facing > 0 ? -1 : 1,
            10,
          );
          break;
        case "enemyDied":
          this.particles.impact(event.x, event.y, 24);
          break;
        case "lootDropped":
          // The same floating readout a chest gets. A kill that pays and one
          // that does not have to look different at the moment it happens —
          // a thirty-percent chance nobody can see is a thirty-percent chance
          // nobody believes in.
          this.particles.loot(event.x, event.y - 20, event.gems, false);
          if (event.gems > 0) {
            this.addPickup(
              event.x,
              event.y - 54,
              event.grade - 1,
              `+${event.gems}`,
              GEM_COLOUR[event.grade - 1] ?? COLOR.gem,
            );
          }
          if (event.gold > 0) {
            this.addPickup(
              event.x,
              event.y - 54,
              COIN_FRAME,
              `+${event.gold}`,
              COLOR.legendary,
            );
          }
          break;
        case "potionUsed":
          this.particles.parry(
            event.x,
            event.y - tuning.player.height * 0.5,
            p.facing,
          );
          this.flashScreen(POTION_TINT[event.kind] ?? COLOR.hud, 0.22);
          break;
        case "shieldHeld":
          // A flare per blow, at the point of contact rather than on the
          // player. The whole value of the ward is watching things fail to
          // land, and a shield that ate a fireball in silence would read as
          // the fireball having missed.
          this.particles.parry(
            event.x,
            event.y - tuning.player.height * 0.5,
            p.facing,
          );
          break;
        case "wallJumped":
          // Grit off the face, thrown the way the boots pushed — which is the
          // opposite of the way the player is now travelling. Without it the
          // kick is silent and reads as a mid-air double jump.
          this.particles.dust(
            event.x - event.dir * (tuning.player.width / 2),
            event.y - tuning.player.height * 0.35,
            event.dir > 0 ? -1 : 1,
          );
          break;
        case "chestOpened":
          this.particles.loot(
            event.x,
            event.y - 18,
            event.gems,
            event.legendary,
          );
          // Say what came out and how much of it. A number on the HUD that
          // silently ticks up does not tell you which chest was worth opening.
          //
          // `grade - 1`, both times. Grade is 1-based everywhere it is spoken
          // about — grade 1 is the emerald — and the sprite sheet is 0-based,
          // so passing it straight through drew the NEXT stone up: an emerald
          // chest paid out a sapphire, on the readout only, while the bag
          // correctly filled with emeralds.
          this.addPickup(
            event.x,
            event.y - 46,
            event.grade - 1,
            `+${event.gems}`,
            GEM_COLOUR[event.grade - 1] ?? COLOR.gem,
          );
          if (event.gold > 0) {
            this.addPickup(
              event.x,
              event.y - 46,
              COIN_FRAME,
              `+${event.gold}`,
              COLOR.legendary,
            );
          }
          break;
      }
    }

    // The smash impact is a state, not an event: fire it on the first live tick.
    if (
      p.action.kind === "smash" &&
      p.action.elapsed === 0 &&
      p.stance !== "airborne"
    ) {
      this.particles.impact(p.x, p.y, tuning.player.smashRadius);
    }
    // A slide kicks up motes the whole way along.
    if (p.dashTicks > 0 && p.stance === "sliding") {
      this.particles.dust(p.x, p.y, p.facing);
    }
  }

  /**
   * Stable pseudo-random from an integer. Used to scatter ground detail
   * without storing any of it — the same x always produces the same rock, so
   * the floor never shimmers between frames.
   */
  private static noise(i: number): number {
    let t = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
    t ^= t >>> 13;
    t = Math.imul(t, 0xc2b2ae35);
    return ((t ^ (t >>> 16)) >>> 0) / 4294967296;
  }

  /** One detail feature every this many world units of floor. */
  private static readonly DETAIL_CELL = 44;
  /** Width of one chip along the floor's top edge. */
  private static readonly LIP_STEP = 14;

  /**
   * The rock the player stands on, and everything set into it.
   *
   * Replaces the flat strip this used to be. Two things changed and both
   * mattered: the ground is no longer one continuous line, so it has to be
   * drawn from the terrain rather than assumed; and it was a single desaturated
   * blue-grey, which is why it read as a platform rather than as a cave. The
   * palette here is the mouth's own, so the inside and the entrance are visibly
   * the same rock.
   */
  private drawTerrain(tick: number, state: SimState): void {
    const left = this.cameraX;
    const right = left + VIEW_W;
    const g = this.floorGfx;
    g.clear();

    // Split at the sand's edges before painting.
    //
    // The base floor is ONE surface running the length of the world, so asking
    // "is this surface in the water environment" of the thing it is drawn from
    // answers no for every part of it, including the parts that are. The beach
    // came out the same rock as everywhere else, which is exactly the failure
    // the sand palette exists to fix.
    //
    // So the seams cut the drawing rather than the geometry: collision still
    // sees one floor, and the painter sees three pieces of it.
    const seams = [themeStart("water"), themeEnd("water")];
    for (const s of terrain.surfaces) {
      if (s.x1 < left || s.x0 > right) continue;
      if (s.thin) {
        this.drawLedge(g, s, left, right);
        continue;
      }
      let from = s.x0;
      for (const cut of seams) {
        if (cut > from && cut < s.x1) {
          this.drawMass(g, { ...s, x0: from, x1: cut }, left, right);
          from = cut;
        }
      }
      this.drawMass(g, { ...s, x0: from }, left, right);
    }

    // Rock over the sea's rectangles, THEN the water over the rock — so the
    // boulders are seen through it and take its colour with depth, which is
    // most of what makes a seabed look like it is underwater rather than like a
    // beach with a blue filter.
    this.drawSeaRock(left, right);

    // The two rocks that close the sea, and light down the cenotes — both over
    // the rock and under the water, so the sea tints them.
    this.drawCaveRock(left, right);
    this.drawCenotes(left, right, state.tick);

    // After the ground it fills and before the hazards standing in it.
    this.drawWater(state, left, right);

    for (const p of terrain.spikes) {
      if (p.x1 < left || p.x0 > right) continue;
      this.drawSpikes(g, p, tick);
    }
  }

  /**
   * Solid rock — the ground, and the blocks raised out of it.
   *
   * Detail is keyed to a cell of WORLD rather than spread across the viewport,
   * so a given patch of ground looks the same however the player arrived at it,
   * and the density does not change with how much is on screen.
   */
  private drawMass(
    g: Graphics,
    s: (typeof terrain.surfaces)[number],
    left: number,
    right: number,
  ): void {
    const x0 = Math.max(s.x0, left);
    const x1 = Math.min(s.x1, right);
    const w = x1 - x0;
    if (w <= 0) return;
    const depth = s.bottom - s.top;

    // Outside is paler, cooler and dustier; the cave is warm rock. The seam sits
    // on the entrance, so the ground itself says which side of the threshold you
    // are standing on — which matters most in the second before you commit.
    const inside = s.x1 > dungeonStart;
    // Sand, the whole length of the water environment.
    //
    // The beach used to be rock with a bit of water on it, which is not a
    // beach — a shore reads as a shore because of what it is MADE of, and no
    // amount of gently sloping stone gets there. Running it the full length of
    // the environment rather than stopping at the waterline is the other half:
    // the seabed is the beach continuing underwater, and drawing the two in
    // different materials would put a hard line exactly where the design wants
    // the player to not notice one.
    const beach = themeAt((s.x0 + s.x1) / 2) === "water";
    const deep = beach
      ? COLOR.sandDeep
      : inside
        ? COLOR.rockDeep
        : COLOR.floorDeep;
    const base = beach
      ? COLOR.sand
      : inside
        ? COLOR.rockBase
        : COLOR.groundOutside;
    const mid = beach ? COLOR.sandMid : inside ? COLOR.rockMid : COLOR.strata;
    const lit = beach ? COLOR.sandLit : inside ? COLOR.rockLit : COLOR.grit;

    g.rect(x0, s.top, w, depth).fill(deep);

    // Strata, so the mass has thickness rather than being a slab of one tone.
    for (const [at, tone, alpha] of [
      [0.16, mid, 0.5],
      [0.34, base, 0.55],
      [0.62, base, 0.3],
    ] as const) {
      g.rect(x0, s.top + depth * at, w, 3).fill({ color: tone, alpha });
    }

    // Courses of blocks under the lip, laid continuously rather than scattered.
    // The first draft dropped one rectangle per cell, and against the dark fill
    // they read as boxes floating in a hole — rock has no gaps in it, and the
    // gaps were the whole problem.
    const band = Math.min(depth, 128);
    g.rect(x0, s.top, w, band).fill(base);

    // Sand does not have courses in it.
    //
    // Running the masonry pass in sand colours produced a wall of sandstone
    // blocks, which is a building — and a beach made of a building is worse
    // than a beach made of rock, because now it is wrong on purpose. So the
    // sand gets its own treatment and returns before the stonework: soft
    // horizontal bedding, grains near the top, and it darkens fast with depth
    // because loose sand is lit only at its surface.
    if (beach) {
      // Bedding, and it fades out fast. Twenty-six even bands read as a
      // deckchair; what sand actually looks like in section is a lit crust and
      // then dark, so the falloff is squared.
      for (let i = 0; i < 14; i++) {
        const f = i / 14;
        const y = s.top + f * band;
        const n = Renderer.noise(Math.round(y) * 17 + 3);
        g.rect(x0, y, w, band / 14 + 1).fill({
          color: n > 0.68 ? mid : base,
          alpha: (1 - f) * (1 - f) * 0.55,
        });
      }
      // And below the crust it is simply dark. Sand is lit at its surface and
      // nowhere else.
      g.rect(x0, s.top + band, w, depth - band).fill(deep);
      // Damp line where the sand goes under: darker below, bright right at the
      // top edge.
      g.rect(x0, s.top, w, 4).fill({ color: lit, alpha: 0.5 });
      g.rect(x0, s.top + 4, w, 3).fill({ color: mid, alpha: 0.35 });
      // Grains and shell fragments, on the same world cell as everything else
      // so a patch of beach is the same patch however you arrived at it.
      const GRAIN = 26;
      for (let c = Math.floor(x0 / GRAIN); c <= Math.ceil(x1 / GRAIN); c++) {
        const n = Renderer.noise(c * 331 + 17);
        if (n < 0.55) continue;
        const gx = c * GRAIN + Renderer.noise(c + 88) * GRAIN;
        if (gx < x0 || gx > x1) continue;
        const gy = s.top + 6 + Renderer.noise(c + 404) * (band * 0.7);
        g.rect(gx, gy, 2 + n * 3, 2).fill({
          color: n > 0.88 ? lit : deep,
          alpha: 0.3,
        });
      }
      return;
    }

    // Courses of blocks under the lip.
    //
    // Indexed off a FIXED WORLD GRID, not off the visible edge. The first
    // version started each course at `max(s.x0, left)` — the camera — so every
    // block boundary and every colour seed shifted as the player walked, and
    // the whole floor changed colour underfoot. World-anchored, a given patch
    // of rock is the same rock however you arrived at it.
    const CELL = 74;
    let cy = s.top + 6;
    for (let row = 0; cy - s.top < band; row++) {
      const courseH = 17 + Renderer.noise(row * 313 + 2) * 16;
      const ch = Math.min(courseH - 3, band - (cy - s.top));
      if (ch <= 2) break;
      const shove = Renderer.noise(row * 91 + 7) * CELL;
      const fade = 1 - (cy - s.top) / (band * 1.4);

      for (
        let c = Math.floor((x0 - shove) / CELL);
        c <= Math.ceil((x1 - shove) / CELL);
        c++
      ) {
        const bx = c * CELL + shove;
        const seed = c * 9176 + row * 613;
        const bw = 24 + Renderer.noise(seed) * (CELL - 26);
        const cut = Math.max(bx, x0);
        const cw = Math.min(bx + bw, x1) - cut;
        if (cw <= 1) continue;
        const tone = Renderer.noise(seed + 5);
        // Eroded, not cut. Old rock has no square corners left: the blocks are
        // inset unevenly top and bottom so the courses read as bedding planes
        // worn back rather than as masonry someone laid.
        const wearTop = Renderer.noise(seed + 11) * 4;
        const wearBot = Renderer.noise(seed + 19) * 5;
        g.rect(cut, cy + wearTop, cw, Math.max(ch - wearTop - wearBot, 2)).fill(
          {
            color: tone > 0.9 ? lit : tone > 0.66 ? mid : deep,
            alpha: 0.26 + fade * 0.34,
          },
        );
        if (tone > 0.86) {
          g.rect(cut, cy, cw, 2).fill({
            color: inside ? COLOR.rockHot : COLOR.grit,
            alpha: 0.12 * fade,
          });
        }
        g.rect(cut, cy + ch - 1, cw, 1).fill({
          color: COLOR.crack,
          alpha: 0.55,
        });
      }
      cy += courseH;
      if (row > 12) break;
    }

    // The lit lip. Light comes from above, so the top edge is the bright one —
    // the ceiling's underside is drawn dark for the same reason, inverted.
    const step = Renderer.LIP_STEP;
    for (let c = Math.floor(x0 / step); c <= Math.ceil(x1 / step); c++) {
      const x = c * step;
      if (x + step < x0 || x > x1) continue;
      const n = Renderer.noise(c + 5501);
      const h = 3 + Math.round(n * 4);
      const cut = Math.max(x, x0);
      const cw = Math.min(x + step, x1) - cut;
      if (cw <= 0) continue;
      g.rect(cut, s.top, cw, h).fill(inside ? mid : COLOR.groundOutsideLip);
      g.rect(cut, s.top, cw, 2).fill({
        color: inside ? (n > 0.6 ? COLOR.rockLit : COLOR.rockHot) : COLOR.grit,
        alpha: 0.5,
      });
      // Moss on the lip, inside only — nothing grows in the open here.
      if (inside && x > dungeonStart && n > 0.72) {
        g.rect(cut, s.top - 2, cw * 0.7, 3).fill({
          color: COLOR.caveMoss,
          alpha: 0.55,
        });
      }
      if (n > 0.9) {
        g.rect(cut + cw * 0.3, s.top, cw * 0.4, h + 3).fill({
          color: COLOR.crack,
          alpha: 0.7,
        });
      }
    }

    // Flowstone: pale mineral run-off down the face, where water has been
    // finding the same crack for a very long time. The single strongest signal
    // that a cave is OLD rather than freshly dug.
    if (inside) {
      const drip = Renderer.DETAIL_CELL * 3;
      for (let c = Math.floor(x0 / drip); c <= Math.ceil(x1 / drip); c++) {
        const n = Renderer.noise(c + 2211);
        if (n < 0.5) continue;
        const dx = c * drip + Renderer.noise(c + 12) * drip;
        if (dx < x0 || dx > x1) continue;
        const len = 22 + n * 58;
        const wide = 5 + Renderer.noise(c + 31) * 9;
        for (let i = 0; i < 4; i++) {
          const f = i / 4;
          g.rect(
            dx - wide * (1 - f) * 0.5,
            s.top,
            wide * (1 - f),
            len * (1 - f * 0.4),
          ).fill({
            color: COLOR.rockLit,
            alpha: 0.1,
          });
        }
      }

      // Stalagmites standing on the lip, answering the stalactites above.
      const spike = Renderer.DETAIL_CELL * 2;
      for (let c = Math.floor(x0 / spike); c <= Math.ceil(x1 / spike); c++) {
        const n = Renderer.noise(c + 6543);
        if (n < 0.62) continue;
        const sx = c * spike + Renderer.noise(c + 9) * spike;
        if (sx < x0 || sx > x1) continue;
        const h = 12 + n * 26;
        const half = 4 + n * 4;
        g.moveTo(sx - half, s.top + 2)
          .lineTo(sx, s.top - h)
          .lineTo(sx + half, s.top + 2)
          .fill(COLOR.rockMid);
        g.moveTo(sx - half, s.top + 2)
          .lineTo(sx, s.top - h)
          .lineTo(sx - half * 0.3, s.top + 2)
          .fill({ color: COLOR.rockLit, alpha: 0.5 });
      }
    }

    // Crystals. The one thing down here that makes its own light, and the
    // reason the cave has a colour at all rather than only a value.
    const vein = Renderer.DETAIL_CELL * 4;
    for (let c = Math.floor(x0 / vein); c <= Math.ceil(x1 / vein); c++) {
      const n = Renderer.noise(c + 9311);
      if (n < 0.45) continue;
      const cx = c * vein + Renderer.noise(c + 66) * vein;
      if (cx < x0 || cx > x1 || cx < dungeonStart) continue;
      const cy = s.top + 16 + Renderer.noise(c + 404) * 60;
      const r = 3 + n * 5;
      g.circle(cx, cy, r * 5).fill({ color: COLOR.crystalGlow, alpha: 0.16 });
      g.circle(cx, cy, r * 2.6).fill({ color: COLOR.crystal, alpha: 0.1 });
      g.moveTo(cx, cy - r * 1.7)
        .lineTo(cx + r * 0.7, cy)
        .lineTo(cx, cy + r * 1.2)
        .lineTo(cx - r * 0.7, cy)
        .fill({ color: COLOR.crystal, alpha: 0.75 });
      g.moveTo(cx, cy - r * 1.4)
        .lineTo(cx + r * 0.25, cy)
        .lineTo(cx, cy + r * 0.8)
        .fill({ color: COLOR.crystalCore, alpha: 0.8 });
    }
  }

  /** A one-way ledge. Thin, lit on top, and dark underneath so it reads as a lip. */
  private drawLedge(
    g: Graphics,
    s: (typeof terrain.surfaces)[number],
    left: number,
    right: number,
  ): void {
    const x0 = Math.max(s.x0, left);
    const x1 = Math.min(s.x1, right);
    const w = x1 - x0;
    if (w <= 0) return;
    const h = s.bottom - s.top;

    // Supports first, behind the slab. A platform with nothing under it reads
    // as a game object; brackets and a post read as something someone built —
    // and they cost nothing, because they are never collided with.
    // Spaced along the WHOLE platform, not the visible part of it.
    //
    // These used to divide up `x0..x1` after clipping to the viewport, so as a
    // platform slid off the edge of the screen its posts slid along underneath
    // it — furniture rearranging itself because the camera moved. Same class of
    // bug as the floor changing colour underfoot, and the same fix: world
    // coordinates are the only ones a thing's position may depend on.
    const span = s.x1 - s.x0;
    const posts = Math.max(1, Math.round(span / 150));
    for (let i = 0; i < posts; i++) {
      const px = s.x0 + (span * (i + 0.5)) / posts;
      if (px < left - 60 || px > right + 60) continue;
      const foot = groundUnder(px, s.top + 40);
      if (foot > s.top + 20 && foot < s.top + 400) {
        const drop = foot - s.bottom + 2;
        // Timber, not rock. The first version was drawn in the wall's own dark
        // tones at low alpha, against a wall of the same tones, in a cave that
        // had just been dimmed — so it was invisible, which is the whole reason
        // for having it. Wood reads against stone at any brightness.
        g.rect(px - 7, s.bottom - 2, 14, drop).fill(COLOR.ladderRail);
        g.rect(px - 7, s.bottom - 2, 3, drop).fill(COLOR.ladderRung);
        g.rect(px + 4, s.bottom - 2, 3, drop).fill({
          color: COLOR.crack,
          alpha: 0.8,
        });
        // Banding down the post, so it reads as built rather than as a bar.
        for (let by = s.bottom + 12; by < foot - 6; by += 34) {
          g.rect(px - 9, by, 18, 4).fill(COLOR.ladderRung);
          g.rect(px - 9, by, 18, 1).fill({ color: 0xffffff, alpha: 0.12 });
        }
        // Angled braces up into the slab.
        for (const side of [-1, 1]) {
          g.moveTo(px + side * 30, s.bottom + 1)
            .lineTo(px + side * 5, s.bottom + 1)
            .lineTo(px + side * 5, s.bottom + 28)
            .fill(COLOR.ladderRail);
          g.moveTo(px + side * 30, s.bottom + 1)
            .lineTo(px + side * 22, s.bottom + 1)
            .lineTo(px + side * 5, s.bottom + 20)
            .lineTo(px + side * 5, s.bottom + 28)
            .fill({ color: COLOR.ladderRung, alpha: 0.55 });
        }
        // A footing where it meets the ground.
        g.rect(px - 12, foot - 6, 24, 6).fill(COLOR.ladderRail);
        g.rect(px - 12, foot - 6, 24, 2).fill(COLOR.ladderRung);
      }
    }

    g.rect(x0, s.top, w, h).fill(COLOR.rockBase);
    g.rect(x0, s.top, w, 3).fill(COLOR.rockLit);
    g.rect(x0, s.top, w, 1).fill({ color: COLOR.rockHot, alpha: 0.55 });
    // The underside takes no light, and the shadow is what makes it read as
    // something you could be standing under rather than a stripe.
    g.rect(x0, s.bottom - 4, w, 4).fill({ color: COLOR.crack, alpha: 0.8 });

    const step = Renderer.LIP_STEP;
    for (let c = Math.floor(x0 / step); c <= Math.ceil(x1 / step); c++) {
      const x = c * step;
      if (x < x0 || x + step > x1) continue;
      const n = Renderer.noise(c + 313);
      if (n > 0.66) {
        g.rect(x, s.top - 2, step * 0.6, 3).fill({
          color: COLOR.caveMoss,
          alpha: 0.5,
        });
      }
      if (n < 0.2) {
        g.rect(x, s.top + 4, step * 0.5, h - 6).fill({
          color: COLOR.rockDeep,
          alpha: 0.6,
        });
      }
    }
  }

  /** Standing spikes. No tell — the pit is the tell. */
  private drawSpikes(
    g: Graphics,
    p: (typeof terrain.spikes)[number],
    tick: number,
  ): void {
    if (p.lava) {
      this.drawLava(g, p, tick);
      return;
    }
    if (p.poison) {
      this.drawPoison(g, p, tick);
      return;
    }
    const spacing = 17;
    g.rect(p.x0, p.top + 12, p.x1 - p.x0, 10).fill({
      color: COLOR.rockDeep,
      alpha: 0.9,
    });
    for (let x = p.x0; x < p.x1 - 6; x += spacing) {
      const n = Renderer.noise(Math.round(x) + 808);
      const h = 20 + n * 12;
      g.moveTo(x, p.top + 16)
        .lineTo(x + spacing * 0.5, p.top + 16 - h)
        .lineTo(x + spacing - 2, p.top + 16)
        .fill(COLOR.spike);
      g.moveTo(x + spacing * 0.5, p.top + 16 - h)
        .lineTo(x + spacing * 0.62, p.top + 16 - h * 0.45)
        .lineTo(x + spacing * 0.38, p.top + 16 - h * 0.45)
        .fill({ color: COLOR.spikeTip, alpha: 0.85 });
    }
  }

  /**
   * A pool of lava, which is a pit with a different face on it.
   *
   * The simulation treats it as spikes, deliberately — it is the same rule and
   * the same code — so everything that makes it read as molten rather than as
   * red spikes has to happen here. Three things do it: a crust of cooled skin
   * broken into plates, the glow coming up THROUGH the cracks between them
   * rather than off the surface, and a slow drift so the plates are never quite
   * where they were.
   */
  private drawLava(
    g: Graphics,
    p: (typeof terrain.spikes)[number],
    tick: number,
  ): void {
    const top = p.top + 10;
    const w = p.x1 - p.x0;

    // The melt itself, brightest at the surface.
    g.rect(p.x0, top, w, 46).fill(COLOR.lavaDeep);
    g.rect(p.x0, top, w, 14).fill(COLOR.lava);
    g.rect(p.x0, top, w, 4).fill({ color: COLOR.lavaHot, alpha: 0.85 });

    // Plates of cooled crust drifting across it. The gaps between them are
    // where the light is, which is what makes the surface read as a skin over
    // something rather than as a painted band.
    for (let i = 0; i < Math.ceil(w / 46); i++) {
      const n = Renderer.noise(Math.round(p.x0) + i * 71);
      const drift = ((tick * (0.18 + n * 0.22) + i * 37) % (w + 90)) - 45;
      const x = p.x0 + drift;
      const plate = 24 + n * 22;
      if (x + plate < p.x0 || x > p.x1) continue;
      const a = Math.max(x, p.x0);
      const b = Math.min(x + plate, p.x1);
      if (b <= a) continue;
      g.rect(a, top + 1, b - a, 9).fill({ color: COLOR.lavaCrust, alpha: 0.9 });
      g.rect(a, top + 1, b - a, 2).fill({ color: COLOR.lavaHot, alpha: 0.22 });
    }

    // And the light it throws on the lip either side, so the pool lights the
    // room instead of sitting in it.
    g.rect(p.x0 - 6, top - 12, w + 12, 12).fill({
      color: COLOR.lavaHot,
      alpha: 0.1,
    });
  }

  /**
   * A sump of poison. The lava pool's twin, and drawn as its opposite.
   *
   * Lava is lit from inside and moves; this is flat, still and slightly wrong —
   * a skin with things under it rather than a fire with a crust. The rule is
   * identical (fall in, you are put back on your last bar) and looking identical
   * would have been the mistake: the player has to know which one left the
   * poison on them.
   */
  private drawPoison(
    g: Graphics,
    p: (typeof terrain.spikes)[number],
    tick: number,
  ): void {
    const top = p.top + 10;
    const w = p.x1 - p.x0;
    g.rect(p.x0, top, w, 42).fill(COLOR.bileDeep);
    g.rect(p.x0, top, w, 12).fill(COLOR.bile);
    g.rect(p.x0, top, w, 3).fill({ color: COLOR.bileLit, alpha: 0.7 });

    // Bubbles, rising and bursting. Slow — the surface is thick.
    for (let i = 0; i < Math.ceil(w / 40); i++) {
      const seed = Renderer.noise(Math.round(p.x0) + i * 47);
      const at = (tick * (0.2 + seed * 0.25) + i * 60) % 140;
      if (at > 100) continue;
      const x = p.x0 + 12 + i * 40 + seed * 16;
      if (x > p.x1 - 8) continue;
      const r = 1.5 + (at / 100) * 4;
      g.circle(x, top + 8 - (at / 100) * 5, r).fill({
        color: COLOR.bileLit,
        alpha: 0.5 - (at / 100) * 0.35,
      });
    }
    // And the light it throws up, which is what makes it look wrong rather
    // than merely green.
    g.rect(p.x0 - 6, top - 10, w + 12, 10).fill({
      color: COLOR.bile,
      alpha: 0.08,
    });
  }

  /**
   * The water.
   *
   * Drawn as a body with a LINE on top rather than as a blue rectangle,
   * because the surface is a real boundary in the simulation — it is where
   * breathing stops — and the player has to be able to see exactly where it is
   * while swimming under it.
   */
  /**
   * Rock, over the sea's rectangles.
   *
   * The water environment is built out of boxes — a stepped seabed, a slab, a
   * tunnel with a flat lid — because that is what collision wants, and it read
   * exactly like that: squares. This does not touch any of it. It draws ROCK on
   * top: boulders along every lip, clumps hanging off every ceiling, weed and
   * silt where the two meet.
   *
   * Decoration only, and deliberately so. The moment an outcrop is a surface it
   * is a thing that can catch a player, block a shortcut, or fail a reachability
   * check — and the whole point of this pass is that it can be as ragged as it
   * likes because nothing depends on it.
   *
   * Everything is keyed to a fixed WORLD cell rather than to the viewport, so a
   * given stretch of seabed is the same seabed however you arrived at it and
   * whichever way you are facing.
   */
  /**
   * Daylight down the cenotes.
   *
   * The system is five shafts and three thousand units of rock, and the shafts
   * are the only air, the only landmarks and the only way to know how far along
   * you are. Underwater they are the difference between a route and a corridor
   * — so they are drawn as light rather than as a gap in the ceiling, because a
   * gap is something you notice when you are already under it and a beam is
   * something you steer toward from a long way off.
   *
   * Drawn under the water so the water tints it, which is the whole look: a
   * shaft of green going down into the dark and dust turning over inside it.
   */
  private drawCenotes(left: number, right: number, tick: number): void {
    const g = this.floorGfx;
    const F = tuning.room.floorY;

    for (const at of cenoteShafts()) {
      if (at < left - 400 || at > right + 400) continue;

      // The column, widening as it falls — light spreads through water, and a
      // parallel-sided beam reads as a solid object.
      const top = F - 260;
      const drop = 300;
      const halfTop = 46;
      const halfBottom = 132;
      for (let k = 0; k < 3; k++) {
        const f = 1 - k / 3;
        g.poly([
          at - halfTop * f,
          top,
          at + halfTop * f,
          top,
          at + halfBottom * f,
          top + drop,
          at - halfBottom * f,
          top + drop,
        ]).fill({ color: 0xbfe6c8, alpha: 0.05 + k * 0.03 });
      }

      // The opening itself, brightest where it meets the waterline.
      g.ellipse(at, F, halfTop * 1.4, 16).fill({
        color: 0xdff5e4,
        alpha: 0.22,
      });

      // Dust and silt turning over in the beam. Keyed to the tick so it drifts,
      // and to the shaft's own x so no two columns carry the same motes.
      for (let i = 0; i < 14; i++) {
        const n = Renderer.noise(Math.round(at / 7) + i * 31);
        const m = Renderer.noise(Math.round(at / 11) + i * 57 + 3);
        // Falls slowly, wraps, and sways — the sway is what makes it water
        // rather than snow.
        const fall = ((tick * (0.22 + n * 0.5) + m * drop) % drop);
        const y = top + fall;
        const spread = halfTop + (halfBottom - halfTop) * (fall / drop);
        const sway = Math.sin((tick * 0.02 + i) % (Math.PI * 2)) * 9;
        const x = at + (m - 0.5) * 2 * spread * 0.8 + sway;
        g.circle(x, y, 1 + n * 1.8).fill({
          color: 0xeafff0,
          alpha: 0.5 * (1 - fall / drop),
        });
      }
    }
  }

  /**
   * The two rocks that close the sea.
   *
   * They are rectangles in the simulation and have to be — a swimmer's
   * collision against a lumpy silhouette is a swimmer catching on things that
   * are not there. So the rectangle stays and this draws a rock over it: a
   * stack of overlapping slabs that lean, a broken crown, and a skirt of
   * boulders where it meets the seabed.
   *
   * Everything is keyed to the rock's own x, so it is the same rock every time
   * you come back to it and the same rock whichever way you swim up to it.
   */
  private drawCaveRock(left: number, right: number): void {
    const g = this.floorGfx;
    const F = tuning.room.floorY;

    for (const m of caveMouths()) {
      if (m.x1 < left - 200 || m.x0 > right + 200) continue;
      const w = m.x1 - m.x0;
      const cx = (m.x0 + m.x1) / 2;
      const key = Math.round(m.x0);

      // The mass, as slabs stacked up the face. Each is wider than the box and
      // offset, so the outline never runs straight for more than one slab —
      // which is the whole difference between a rock and a wall.
      const SLABS = 9;
      for (let i = 0; i < SLABS; i++) {
        const f = i / SLABS;
        const n = Renderer.noise(key + i * 37);
        const m2 = Renderer.noise(key + i * 53 + 11);
        const y0 = m.top + (m.bottom - m.top) * f;
        const y1 = m.top + (m.bottom - m.top) * ((i + 1.15) / SLABS);
        // Wider at the base, and leaning by a different amount each course.
        const flare = 1 + f * 0.55;
        const lean = (n - 0.5) * w * 0.42;
        const half = (w / 2) * flare;
        g.poly([
          cx - half + lean,
          y0,
          cx + half + lean * 0.4,
          y0,
          cx + half * (0.86 + m2 * 0.3),
          y1,
          cx - half * (0.9 + n * 0.25),
          y1,
        ]).fill(i % 3 === 0 ? COLOR.sandDeep : i % 3 === 1 ? COLOR.sandMid : COLOR.sand);
        // A lit edge down the seaward side of every other course, so the mass
        // has a direction to its light instead of being a flat shape.
        if (i % 2 === 0) {
          g.poly([
            cx - half + lean,
            y0,
            cx - half * 0.72 + lean,
            y0,
            cx - half * 0.78,
            y1,
            cx - half * (0.9 + n * 0.25),
            y1,
          ]).fill({ color: COLOR.sandLit, alpha: 0.28 });
        }
      }

      // A broken crown, well clear of any jump — the thing you read from a
      // distance and understand you are not getting over.
      for (let i = 0; i < 5; i++) {
        const n = Renderer.noise(key + i * 91 + 7);
        const px = m.x0 + (w / 5) * (i + 0.5) + (n - 0.5) * 16;
        const h = 18 + n * 40;
        g.poly([
          px - 14,
          m.top + 10,
          px + 14,
          m.top + 10,
          px + (n - 0.5) * 12,
          m.top - h,
        ]).fill(COLOR.sandMid);
      }

      // And a skirt of boulders where it stands on the bottom, which is what
      // stops the base reading as a cut-off line.
      for (let i = 0; i < 7; i++) {
        const n = Renderer.noise(key + i * 17 + 61);
        const m2 = Renderer.noise(key + i * 29 + 5);
        const side = i % 2 === 0 ? -1 : 1;
        const bx = cx + side * (w * 0.4 + m2 * w * 0.7);
        const r = 10 + n * 22;
        g.circle(bx, m.bottom - r * 0.3, r).fill(COLOR.sandDeep);
        g.circle(bx - r * 0.3, m.bottom - r * 0.6, r * 0.5).fill({
          color: COLOR.sandLit,
          alpha: 0.32,
        });
      }

      // Weed along the waterline, so the rock is wet where the sea meets it.
      for (let i = 0; i < 10; i++) {
        const n = Renderer.noise(key + i * 13 + 200);
        const wx = m.x0 - 12 + (w + 24) * (i / 9);
        g.moveTo(wx, F + 6)
          .lineTo(wx + (n - 0.5) * 12, F + 6 - (10 + n * 22))
          .stroke({ color: 0x2f6b4a, width: 2, alpha: 0.5 });
      }
    }
  }

  private drawSeaRock(left: number, right: number): void {
    const g = this.floorGfx;
    const F = tuning.room.floorY;

    for (const s of terrain.surfaces) {
      if (s.thin) continue;
      if (s.x1 < left - 120 || s.x0 > right + 120) continue;
      if (themeAt((s.x0 + s.x1) / 2) !== "water") continue;

      const x0 = Math.max(s.x0, left - 120);
      const x1 = Math.min(s.x1, right + 120);
      if (x1 - x0 <= 0) continue;

      // Which way is this face pointing? A surface whose top is below the
      // waterline is a bed and gets boulders standing ON it; one whose bottom
      // is above the floor line is a lid and gets clumps hanging UNDER it.
      const isBed = s.top > F - 40;
      const lip = isBed ? s.top : s.bottom;

      // Boulders, and the first version of this was a bead necklace: one disc
      // per cell, all the same size, all sitting on the same line. Rock is not
      // periodic. Three things fix it and all three are needed —
      //
      //   SIZE     a wide range, and the big ones are rare
      //   PLACE    jittered along the lip AND across it, so no two share a line
      //   SKIP     over half the cells hold nothing, which is what turns a row
      //            into a scatter
      const CELL = 26;
      const dir = isBed ? -1 : 1;
      for (let c = Math.floor(x0 / CELL); c <= Math.ceil(x1 / CELL); c++) {
        const n = Renderer.noise(c * 7 + 13);
        const m = Renderer.noise(c * 31 + 5);
        const q = Renderer.noise(c * 53 + 29);
        if (q < 0.45) continue;
        const bx = c * CELL + m * CELL * 1.6;
        if (bx < x0 - 30 || bx > x1 + 30) continue;

        // Squared so small stones are common and boulders are rare, which is
        // what a beach and a seabed both actually look like.
        const r = 5 + n * n * 26;
        // Sunk into the lip by a varying amount, so the tops do not line up.
        const sink = 0.2 + q * 0.5;
        const by = lip + dir * (r * (1 - sink));

        // Two or three overlapping lumps rather than a disc. The offsets are
        // per-stone, so no two boulders are the same shape.
        g.circle(bx, by, r).fill(COLOR.sandDeep);
        g.circle(bx + (m - 0.5) * r * 0.8, by + dir * r * 0.3, r * 0.78).fill(
          n > 0.5 ? COLOR.sandMid : COLOR.sandDeep,
        );
        if (r > 12) {
          g.circle(bx - (q - 0.5) * r, by + dir * r * 0.15, r * 0.5).fill(
            COLOR.sandMid,
          );
        }
        // One lit facet, small, on the side the light comes from — enough to
        // say "round" and not enough to say "bubble".
        g.circle(bx - r * 0.34, by + dir * r * 0.34, r * 0.26).fill({
          color: COLOR.sand,
          alpha: 0.55,
        });

        // Silt gathered at its foot, and weed off the top of the bigger ones.
        if (isBed) {
          g.ellipse(bx, lip + 3, r * 1.5, 5).fill({
            color: COLOR.sandDeep,
            alpha: 0.5,
          });
          if (n > 0.72) {
            for (let w = 0; w < 3; w++) {
              const wx = bx - 8 + w * 8;
              const h = 16 + Renderer.noise(c * 91 + w) * 26;
              g.moveTo(wx, lip - r * 0.5)
                .lineTo(wx + (m - 0.5) * 10, lip - r * 0.5 - h)
                .stroke({
                  color: 0x2f6b4a,
                  width: 2 + (w % 2),
                  alpha: 0.55,
                });
            }
          }
        } else if (n > 0.5) {
          // Off a lid: a spur pointing down, so the tunnel roof has a texture
          // rather than being a line.
          const h = 10 + n * 26;
          g.moveTo(bx - r * 0.45, lip)
            .lineTo(bx + r * 0.45, lip)
            .lineTo(bx + (m - 0.5) * 8, lip + h)
            .fill(COLOR.sandDeep);
          g.moveTo(bx - r * 0.45, lip)
            .lineTo(bx - r * 0.1, lip)
            .lineTo(bx + (m - 0.5) * 8, lip + h)
            .fill({ color: COLOR.sandMid, alpha: 0.7 });
        }
      }

      // And a broken edge along the lip itself, so the straight line the
      // collision needs is never the line the eye sees.
      const STEP = 9;
      for (let x = x0; x < x1; x += STEP) {
        const n = Renderer.noise(Math.round(x / STEP) + 401);
        const m = Renderer.noise(Math.round(x / STEP) + 907);
        // Two courses at different scales, so the edge is broken rather than
        // serrated — one row of even teeth is as regular as the flat line it
        // replaced.
        const h = 2 + n * 7 + (m > 0.7 ? 6 : 0);
        g.rect(x, isBed ? lip - h : lip, STEP + 1, h).fill(
          n > 0.62 ? COLOR.sandMid : COLOR.sandDeep,
        );
      }
    }
  }

  private drawWater(state: SimState, left: number, right: number): void {
    const g = this.floorGfx;
    for (const w of terrain.water) {
      if (w.x1 < left - 100 || w.x0 > right + 100) continue;
      const width = w.x1 - w.x0;
      const depth = w.floor - w.surface;

      // The body, darkening with depth so the bottom of a trench reads as far
      // away rather than as more of the same.
      g.rect(w.x0, w.surface, width, depth).fill({
        color: COLOR.sea,
        alpha: 0.42,
      });
      g.rect(w.x0, w.surface + depth * 0.45, width, depth * 0.55).fill({
        color: COLOR.seaDeep,
        alpha: 0.4,
      });

      // The surface: a bright line, and a second one riding it so it moves.
      g.rect(w.x0, w.surface - 1, width, 3).fill({
        color: COLOR.seaLit,
        alpha: 0.55,
      });
      for (let i = 0; i < Math.ceil(width / 26); i++) {
        const seed = Renderer.noise(Math.round(w.x0) + i * 31);
        const drift = (state.tick * (0.5 + seed) + i * 26) % (width + 40);
        const x = w.x0 + drift - 20;
        if (x < w.x0 || x > w.x1 - 10) continue;
        g.rect(
          x,
          w.surface - 2 + Math.sin((state.tick + i * 20) / 14) * 1.5,
          12,
          2,
        ).fill({
          color: COLOR.foam,
          alpha: 0.35,
        });
      }

      // Light coming down through it, which is most of what says "water".
      for (let i = 0; i < Math.ceil(width / 90); i++) {
        const seed = Renderer.noise(Math.round(w.x0) + i * 71);
        const x =
          w.x0 + 30 + i * 90 + Math.sin((state.tick + i * 40) / 60) * 12;
        if (x > w.x1 - 10) continue;
        g.moveTo(x, w.surface)
          .lineTo(x + 16 + seed * 10, w.floor)
          .lineTo(x + 26 + seed * 10, w.floor)
          .lineTo(x + 8, w.surface)
          .fill({ color: COLOR.seaLit, alpha: 0.05 + seed * 0.04 });
      }
    }
  }

  /**
   * The chamber door, and the room behind it.
   *
   * The door is at the end of the fire and has to read as different from every
   * other door in the game — the shortcut doors are hewn stone with a lamp, and
   * a player who reads this as one more of those will walk past the only new
   * place in the run. So it is twice the size, black inside, and framed rather
   * than cut: something built, at the end of a dungeon that is otherwise dug.
   *
   * There is nothing in the room yet, on purpose. What is drawn is the ROOM —
   * the floor, the walls, the height of it — because the point of shipping it
   * empty is to look at the space before anything stands in it.
   */
  private drawChamber(
    g: Graphics,
    left: number,
    right: number,
    floorY: number,
    tick: number,
    /** Whether the room is quiet. The far door is sealed until it is. */
    clear: boolean,
  ): void {
    // The door, in the fire.
    const d = chamber.doorX;
    if (d >= left - 260 && d <= right + 260) {
      const w = 62;
      const h = 250;
      const top = floorY - h;
      // The frame: two pillars and a lintel, in cut stone rather than rock.
      g.rect(d - w - 16, top - 26, w * 2 + 32, 26).fill(COLOR.rockMid);
      g.rect(d - w - 16, top - 26, w * 2 + 32, 4).fill(COLOR.lava);
      g.rect(d - w - 16, top, 16, h).fill(COLOR.rockMid);
      g.rect(d + w, top, 16, h).fill(COLOR.rockMid);
      // And the dark inside it, which is the whole invitation.
      g.rect(d - w, top, w * 2, h).fill(0x05070b);
      for (let i = 0; i < 5; i++) {
        const f = i / 5;
        g.rect(
          d - w + w * f,
          top + h * f * 0.18,
          w * 2 * (1 - f),
          h * (1 - f * 0.18),
        ).fill({ color: COLOR.lava, alpha: 0.03 + f * 0.02 });
      }
      // Two lamps, breathing out of step, so the door is alive at a distance.
      for (const side of [-1, 1]) {
        const bx = d + side * (w + 8);
        const glow = 0.5 + 0.5 * Math.sin(tick / 26 + (side > 0 ? 1.7 : 0));
        g.circle(bx, top + 44, 7).fill({
          color: COLOR.lavaHot,
          alpha: 0.35 + glow * 0.4,
        });
        g.circle(bx, top + 44, 3).fill(COLOR.lavaHot);
      }
    }

    // The room itself.
    if (chamber.x1 < left - 200 || chamber.x0 > right + 200) return;
    const { x0, x1, roof } = chamber;

    // Everything either side of it goes black.
    //
    // The chamber is built past the end of the world and the camera has to be
    // let out there to show it, which means the last two hundred units of the
    // fire — floor, gems, a lava pool — sit in the left of frame during the
    // boss fight. Two rooms on screen at once is one room too many: the whole
    // point of a chamber is that when you are in it, there is nothing else.
    // Clamped to non-negative widths.
    //
    // The camera goes INSIDE the room, so `left` passes `x0 - 60` and the left
    // curtain's width goes negative — and a negative-width rect does not draw
    // nothing, it draws backwards, straight across the room and over whatever
    // is standing in it. What that looked like was the boss vanishing for a
    // frame and coming back, over and over, as the camera drifted.
    const leftW = Math.max(0, x0 - 60 - (left - 40));
    if (leftW > 0) g.rect(left - 40, 0, leftW, VIEW_H).fill(0x05060a);
    const rightW = Math.max(0, right + 40 - (x1 + 60));
    if (rightW > 0) g.rect(x1 + 60, 0, rightW, VIEW_H).fill(0x05060a);
    g.rect(x0 - 60, roof, x1 - x0 + 120, floorY - roof).fill(0x0a0c12);
    // Floor, walls and lid, so the box is legible as stone rather than as a
    // hole in the background.
    // All the way down, not sixty deep. The fire's own floor is still drawn
    // under here — the chamber is a room laid over the far end of the world —
    // and sixty units of stone left a strip of the corridor showing beneath it.
    g.rect(x0 - 60, floorY, x1 - x0 + 120, VIEW_H - floorY).fill(COLOR.rockMid);
    g.rect(x0 - 60, floorY, x1 - x0 + 120, 5).fill(COLOR.rock);
    g.rect(x0 - 60, roof, 60, floorY - roof).fill(COLOR.rockMid);
    g.rect(x1, roof, 60, floorY - roof).fill(COLOR.rockMid);
    g.rect(x0 - 60, roof - 60, x1 - x0 + 120, 60).fill(COLOR.rockMid);
    g.rect(x0 - 60, roof, x1 - x0 + 120, 5).fill(COLOR.rock);

    // Pillars down both walls. The room is empty and it has to not read as a
    // corridor with the lights off — regular vertical structure at a known
    // spacing is the cheapest thing that says "built".
    for (let i = 0; i <= 4; i++) {
      const px = x0 + 60 + i * ((x1 - x0 - 120) / 4);
      g.rect(px - 13, roof + 40, 26, floorY - roof - 40).fill({
        color: COLOR.rockDeep,
        alpha: 0.85,
      });
      g.rect(px - 17, floorY - 26, 34, 26).fill(COLOR.rockMid);
      g.rect(px - 17, roof + 40, 34, 18).fill(COLOR.rockMid);
      const glow = 0.5 + 0.5 * Math.sin(tick / 34 + i * 1.3);
      g.circle(px, roof + 96, 9).fill({
        color: COLOR.lava,
        alpha: 0.1 + glow * 0.12,
      });
      g.circle(px, roof + 96, 3.4).fill({
        color: COLOR.lavaHot,
        alpha: 0.5 + glow * 0.4,
      });
    }

    // The way OUT, at the far end. Sealed while the boss stands — drawn as a
    // slab with a seam down it — and open daylight once it is down, which is
    // the only bright thing in the room and is meant to be seen from across it.
    const o = chamber.outX;
    if (clear) {
      const w = 44;
      const h = 190;
      const top = floorY - h;
      g.rect(o - w, top, w * 2, h).fill(0x000000);
      for (let i = 0; i < 8; i++) {
        const f = i / 8;
        g.rect(
          o - w + w * f,
          top + h * f * 0.28,
          w * 2 * (1 - f),
          h * (1 - f * 0.28),
        ).fill({ color: COLOR.air, alpha: 0.07 + f * 0.08 });
      }
      g.rect(o - w - 10, top - 12, w * 2 + 20, 12).fill(COLOR.rockMid);
      g.rect(o - w - 10, top - 12, w * 2 + 20, 3).fill({
        color: COLOR.air,
        alpha: 0.8,
      });
      // Daylight on the floor in front of it, the same cue the mouth uses.
      for (let i = 0; i < 12; i++) {
        const f = i / 12;
        g.rect(o - 70 + 140 * f, floorY - 5, 140 / 12 + 1, 6).fill({
          color: COLOR.air,
          alpha: 0.18 * (1 - Math.abs(f - 0.5) * 2),
        });
      }
    } else {
      const w = 44;
      const h = 190;
      const top = floorY - h;
      g.rect(o - w, top, w * 2, h).fill(COLOR.rockMid);
      g.rect(o - w, top, w * 2, 4).fill(COLOR.rock);
      g.rect(o - 3, top + 10, 6, h - 20).fill(COLOR.rockDeep);
      for (let i = 0; i < 4; i++) {
        g.rect(o - w + 6, top + 24 + i * 44, w * 2 - 12, 5).fill(
          COLOR.rockDeep,
        );
      }
    }

    // The way back, marked on the inside of the near wall — and barred while
    // the boss stands, because it is.
    const b = chamber.backX;
    g.rect(b - 34, floorY - 150, 68, 150).fill(0x05070b);
    g.rect(b - 40, floorY - 162, 80, 14).fill(COLOR.rockMid);
    g.rect(b - 40, floorY - 162, 80, 3).fill(clear ? COLOR.lava : COLOR.rock);
    if (!clear) {
      for (let i = 0; i < 4; i++) {
        g.rect(b - 30, floorY - 140 + i * 36, 60, 9).fill(COLOR.rockMid);
        g.rect(b - 30, floorY - 140 + i * 36, 60, 2).fill(COLOR.rock);
      }
    }

    // Empty, and saying so. Better than a player deciding the room is broken.
    this.chamberNote.text = "EMPTY";
    this.chamberNote.position.set((x0 + x1) / 2, roof + 150);
  }

  /**
   * An escape shaft: a hole in the roof with a rope down it.
   *
   * It has to read as a WAY OUT from across a room and it must not read as a
   * door — the shortcut doors are the thing you spend a lever on and these are
   * free, and a player who confuses the two will walk past a lever thinking
   * they already have it. So: no frame, no lamp, nothing built. A ragged hole,
   * daylight coming down it in the same cold colour the mouth spills, and a
   * rope. Everything else in the dungeon is lit from below by fire.
   */
  private drawEscape(
    g: Graphics,
    at: number,
    floorY: number,
    tick: number,
  ): void {
    const roof = roofAt(at);
    const w = 34;

    // The hole, and the light falling out of it. Drawn as a cone rather than a
    // column so it reads as coming from a long way up.
    for (let i = 0; i < 8; i++) {
      const f = i / 8;
      const spread = w * (0.5 + f * 1.7);
      g.rect(
        at - spread,
        roof + (floorY - roof) * f,
        spread * 2,
        (floorY - roof) / 8 + 1,
      ).fill({
        color: COLOR.air,
        alpha: 0.055 * (1 - f * 0.75),
      });
    }
    g.rect(at - w, roof - 10, w * 2, 16).fill(0x000000);
    g.rect(at - w, roof - 10, w * 2, 5).fill({ color: COLOR.air, alpha: 0.5 });
    // Ragged lip, so it is a hole rather than a hatch.
    for (let i = -3; i <= 3; i++) {
      const n = Renderer.noise(Math.round(at) + i * 37);
      g.rect(at + i * 11 - 5, roof + 4, 10, 3 + n * 7).fill(COLOR.rockMid);
    }

    // The rope, hanging to just above head height and swaying.
    const sway = Math.sin(tick / 40) * 4;
    for (let i = 0; i < 14; i++) {
      const f = i / 14;
      const y = roof + 6 + f * (floorY - roof - 30);
      g.rect(at - 2 + sway * f * f, y, 4, (floorY - roof - 30) / 14 + 1).fill({
        color: i % 2 === 0 ? COLOR.ladderRung : COLOR.rockMid,
      });
    }
    // A knot at the bottom, which is what says "grab this".
    g.circle(at + sway, floorY - 24, 6).fill(COLOR.ladderRung);

    // And a scuff on the floor under it, so the spot is findable when the light
    // is behind something.
    g.rect(at - 26, floorY - 4, 52, 4).fill({ color: COLOR.air, alpha: 0.18 });
  }

  /**
   * The burrow's mouth: a hole torn in the base of a sump.
   *
   * Drawn as the chute's opposite. The chute is cut rock with a lip — something
   * that was made. This is a wound in the ground with roots across it and
   * something dripping out, because what it goes through is the inside of the
   * poison, and because the player has to be able to guess before they use it
   * that it is going to cost them.
   */
  private drawBurrow(
    g: Graphics,
    at: number,
    floorY: number,
    open: boolean,
    tick: number,
  ): void {
    const w = 54;
    // Shut it is a scar in the floor; open it is a hole.
    if (!open) {
      g.rect(at - w, floorY - 8, w * 2, 12).fill(COLOR.bileDeep);
      g.rect(at - w, floorY - 8, w * 2, 3).fill({
        color: COLOR.bile,
        alpha: 0.35,
      });
      for (let i = -3; i <= 3; i++) {
        g.rect(at + i * 15 - 3, floorY - 14, 6, 8).fill(COLOR.rockMid);
      }
      return;
    }

    g.ellipse(at, floorY - 4, w, 22).fill(0x000000);
    g.ellipse(at, floorY - 10, w - 6, 16).fill(COLOR.bileDeep);
    // A rim of wet earth, thickest at the near side.
    g.ellipse(at, floorY - 2, w + 8, 24).stroke({
      color: COLOR.rockMid,
      width: 5,
    });
    g.ellipse(at, floorY - 6, w, 20).stroke({
      color: COLOR.bile,
      width: 2,
      alpha: 0.55,
    });
    // Roots across the mouth, so it reads as gone through rather than dug.
    for (let i = 0; i < 5; i++) {
      const n = Renderer.noise(Math.round(at) + i * 37);
      const rx = at - w + 12 + i * 22;
      g.moveTo(rx, floorY - 22)
        .lineTo(rx + (n - 0.5) * 16, floorY + 2)
        .stroke({ color: COLOR.rockMid, width: 2 + n * 3, alpha: 0.8 });
    }
    // And it breathes: a slow bloom of gas out of the hole, which is the whole
    // warning that this one charges you.
    for (let i = 0; i < 7; i++) {
      const n = Renderer.noise(Math.round(at) + i * 53);
      const f = ((tick * (0.2 + n * 0.3) + i * 40) % 120) / 120;
      g.circle(at + (n - 0.5) * w * 1.2, floorY - 16 - f * 60, 3 + f * 9).fill({
        color: COLOR.bile,
        alpha: 0.16 * (1 - f),
      });
    }
  }

  /**
   * The high road's lift: a vent at the near end of the road.
   *
   * Deliberately not the rising chain's column — that one is a rhythm of four
   * and this is one throw — so it is drawn as a chimney in the rock with heat
   * coming off it, and the road it serves is right there above it. Shut, the
   * chimney is cold and capped, which is a thing you can read from below and be
   * annoyed by, which is what FR-3.1 is for.
   */
  private drawLift(
    g: Graphics,
    at: number,
    floorY: number,
    open: boolean,
    tick: number,
  ): void {
    const w = 30;
    // The chimney itself.
    g.rect(at - w, floorY - 46, w * 2, 46).fill(COLOR.rockMid);
    g.rect(at - w, floorY - 46, w * 2, 6).fill(COLOR.rock);
    g.rect(at - w + 6, floorY - 40, w * 2 - 12, 40).fill(0x070509);

    if (!open) {
      // Capped: a plate of cold iron over the mouth.
      g.rect(at - w - 6, floorY - 54, w * 2 + 12, 12).fill(COLOR.rockMid);
      g.rect(at - w - 6, floorY - 54, w * 2 + 12, 3).fill(COLOR.rock);
      for (const side of [-1, 1]) {
        g.circle(at + side * (w - 4), floorY - 48, 4).fill(COLOR.rockDeep);
      }
      return;
    }

    // Open: a column of heat standing in it, reaching for the road.
    for (let i = 0; i < 14; i++) {
      const f = i / 14;
      const n = Renderer.noise(Math.round(at) + i * 29 + Math.floor(tick / 4));
      const spread = w * (0.7 + f * 0.9) + n * 8;
      g.rect(at - spread, floorY - 46 - f * 210, spread * 2, 210 / 14 + 1).fill(
        { color: COLOR.lava, alpha: 0.16 * (1 - f * 0.7) },
      );
    }
    for (let i = 0; i < 9; i++) {
      const n = Renderer.noise(Math.round(at) + i * 71);
      const f = ((tick * (0.5 + n) + i * 30) % 200) / 200;
      g.circle(at + (n - 0.5) * w * 1.6, floorY - 40 - f * 220, 2 + n * 4).fill(
        { color: COLOR.lavaHot, alpha: 0.7 * (1 - f) },
      );
    }
  }

  /** Ladders and pressure plates. Everything the terrain does that moves. */
  private drawHazards(state: SimState): void {
    const left = this.cameraX;
    const right = left + VIEW_W;
    const g = this.hazardGfx;
    g.clear();

    for (const l of terrain.ladders) {
      if (l.x < left - 40 || l.x > right + 40) continue;
      const rail = 5;
      for (const side of [-1, 1]) {
        g.rect(l.x + side * 11 - rail / 2, l.top, rail, l.bottom - l.top).fill(
          COLOR.ladderRail,
        );
      }
      for (let y = l.top + 8; y < l.bottom; y += 20) {
        g.rect(l.x - 13, y, 26, 4).fill(COLOR.ladderRung);
        g.rect(l.x - 13, y, 26, 1).fill({ color: 0xffffff, alpha: 0.18 });
      }
    }

    // The moving hazards. Their positions come from the same pure function the
    // reducer uses, so what is drawn is exactly what bites — there is no second
    // copy of the motion to drift out of step.
    for (const h of terrain.hazards) {
      if (h.x < left - 400 || h.x > right + 400) continue;
      const box = hazardAt(h, state.tick);
      const cx = (box.left + box.right) / 2;
      const cy = (box.top + box.bottom) / 2;

      if (h.kind === "pendulum") {
        // The arm, from its ceiling mount down to the blade.
        g.moveTo(h.x, h.y)
          .lineTo(cx, cy)
          .stroke({ width: 7, color: COLOR.ladderRail });
        g.moveTo(h.x, h.y)
          .lineTo(cx, cy)
          .stroke({ width: 2, color: COLOR.chestBrass, alpha: 0.5 });
        g.circle(h.x, h.y, 11).fill(COLOR.trapPlate);
        g.circle(h.x, h.y, 5).fill(COLOR.chestBrass);

        // A wedge of blades on the end, widest across the swing.
        g.moveTo(box.left, cy - 6)
          .lineTo(box.right, cy - 6)
          .lineTo(cx, box.bottom)
          .fill(COLOR.spike);
        g.moveTo(box.left + 6, cy - 6)
          .lineTo(box.left + 14, cy - 6)
          .lineTo(cx - 4, box.bottom - 6)
          .fill({ color: COLOR.spikeTip, alpha: 0.9 });
        g.rect(box.left - 4, box.top, box.right - box.left + 8, 14).fill(
          COLOR.ladderRung,
        );
      } else if (h.kind === "flow") {
        // Lava out of the roof: a fixed box that turns on and off rather than
        // something that travels, so what has to be drawn is the STATE, and the
        // tell has to be as loud as the danger — a curtain that appeared without
        // warning would be an ambush rather than a rhythm.
        const live = box.armed;
        const w = box.right - box.left;

        // Coming. The lip fills and starts to run before it pours.
        if (!live) {
          const warn = 0.28;
          const to = 0.42;
          if (box.phase >= warn && box.phase < to) {
            const f = (box.phase - warn) / (to - warn);
            g.rect(box.left, box.top, w, 5 + f * 7).fill({
              color: COLOR.lava,
              alpha: 0.35 + f * 0.4,
            });
            // Drips, running ahead of the pour.
            for (let n = 0; n < Math.ceil(w / 30); n++) {
              const j = Renderer.noise(Math.round(h.x) + n * 53);
              const dx = box.left + 8 + n * 30 + j * 12;
              if (dx > box.right - 4) continue;
              const fall = f * f * (box.bottom - box.top) * 0.55;
              g.rect(dx, box.top + 6, 3, 4 + fall).fill({
                color: COLOR.lavaHot,
                alpha: 0.25 + f * 0.5,
              });
            }
          }
          // The scar it leaves the rest of the time, so the place it happens is
          // readable when nothing at all is happening.
          g.rect(box.left, box.top, w, 4).fill({
            color: COLOR.lavaCrust,
            alpha: 0.85,
          });
          continue;
        }

        // Pouring. Broad, bright, and moving — the streaks scroll so it reads
        // as falling rather than as a painted rectangle.
        g.rect(box.left, box.top, w, box.bottom - box.top).fill({
          color: COLOR.lavaDeep,
          alpha: 0.75,
        });
        for (let n = 0; n < Math.ceil(w / 12); n++) {
          const j = Renderer.noise(Math.round(h.x) + n * 17);
          const x = box.left + n * 12 + j * 6;
          if (x > box.right - 3) continue;
          const run =
            (state.tick * (5 + j * 6) + n * 40) % (box.bottom - box.top);
          g.rect(x, box.top + run * 0.2, 4, (box.bottom - box.top) * 0.5).fill({
            color: j > 0.5 ? COLOR.lavaHot : COLOR.lava,
            alpha: 0.55,
          });
        }
        // A pool of light where it lands.
        g.rect(box.left - 8, box.bottom - 6, w + 16, 10).fill({
          color: COLOR.lavaHot,
          alpha: 0.3,
        });
      } else if (h.kind === "crusher") {
        // The shaft it rides on, so the block is clearly attached to the roof.
        g.rect(h.x - 7, h.y, 14, box.top - h.y).fill(COLOR.ladderRail);
        // The tell: it shudders and glows before it drops (FR-18.5 in spirit —
        // the same contract as the pressure plate, on a fixed cycle).
        if (box.phase >= 0.55 && box.phase < 0.72) {
          const f = (box.phase - 0.55) / 0.17;
          g.rect(h.x - h.size, box.top - 4, h.size * 2, 4).fill({
            color: COLOR.trapTell,
            alpha: 0.35 + f * 0.55,
          });
          g.rect(h.x - h.size, box.top, h.size * 2, box.bottom - box.top).fill({
            color: COLOR.trapTell,
            alpha: 0.06 + f * 0.12,
          });
        }
        g.rect(h.x - h.size, box.top, h.size * 2, 40).fill(COLOR.rockMid);
        g.rect(h.x - h.size, box.top, h.size * 2, 4).fill(COLOR.rockLit);
        for (let i = -2; i <= 2; i++) {
          const bx = h.x + i * 17;
          g.moveTo(bx - 7, box.top + 38)
            .lineTo(bx + 7, box.top + 38)
            .lineTo(bx, box.bottom + 10)
            .fill(COLOR.spike);
        }
      } else {
        // Saw. The track first, then the blade riding it.
        g.rect(h.x - h.span / 2, h.y - 5, h.span, 5).fill({
          color: COLOR.trapPlate,
          alpha: 0.8,
        });
        const r = h.size;
        g.circle(cx, cy, r).fill(COLOR.spike);
        g.circle(cx, cy, r * 0.42).fill(COLOR.trapPlate);
        g.circle(cx, cy, r * 0.16).fill(COLOR.chestBrass);
        // Teeth, stepped by the tick so the blade reads as spinning rather
        // than sliding. Twelve of them, advanced one position every two ticks.
        const spin = Math.floor(state.tick / 2) % 12;
        for (let i = 0; i < 12; i++) {
          const a = ((i + spin / 12) / 12) * Math.PI * 2;
          const tx = cx + Math.cos(a) * r;
          const ty = cy + Math.sin(a) * r;
          g.circle(tx, ty, 4.5).fill(COLOR.spikeTip);
        }
      }
    }

    for (const t of state.traps) {
      const fixture = terrain.traps.find((f) => f.id === t.id);
      if (!fixture || fixture.x < left - 80 || fixture.x > right + 80) continue;
      const { x, halfWidth: hw, top } = fixture;

      g.rect(x - hw, top, hw * 2, 5).fill(COLOR.trapPlate);
      g.rect(x - hw, top, hw * 2, 1).fill({ color: 0xffffff, alpha: 0.15 });
      // Slots the blades come out of, so the plate says what it is before it
      // has ever fired.
      for (let i = -2; i <= 2; i++) {
        g.rect(x + i * 16 - 2, top + 1, 4, 3).fill({
          color: COLOR.crack,
          alpha: 0.9,
        });
      }

      if (t.phase === "telegraphing") {
        // FR-18.5 — the tell fills as the half-second runs out, so the read is
        // "how much time is left", not "something is happening".
        const f = Math.min(t.ticks / tuning.traps.tellLeadTime, 1);
        g.rect(x - hw, top - 2, hw * 2 * f, 3).fill({
          color: COLOR.trapTell,
          alpha: 0.9,
        });
        g.rect(x - hw, top - 26, hw * 2, 26).fill({
          color: COLOR.trapTell,
          alpha: 0.05 + f * 0.13,
        });
      }

      if (t.phase === "firing") {
        const out = Math.min(t.ticks / 3, 1);
        const reach = tuning.traps.reach * out;
        for (let i = -2; i <= 2; i++) {
          const bx = x + i * 16;
          g.moveTo(bx - 4, top)
            .lineTo(bx, top - reach)
            .lineTo(bx + 4, top)
            .fill(COLOR.trapBlade);
        }
        g.rect(x - hw, top - reach, hw * 2, reach).fill({
          color: COLOR.trapBlade,
          alpha: 0.08,
        });
      }
    }
  }

  /**
   * The daylight that gets in, lying on the ground just inside the mouth.
   *
   * This is the exit marker, and it is deliberately not a line: the way out
   * has to be findable when the air is running out and the vignette is closing,
   * but a drawn marker on the threshold reads as UI and breaks the one rule
   * the mouth is built on — that it is a place rather than a screen boundary.
   *
   * Light on the floor answers both. It is the same daylight the run started
   * in, it can only be coming from one direction, and it is the last of it.
   */
  private drawSpill(state: SimState): void {
    const { floorY, entranceX } = tuning.room;
    const g = this.spillGfx;
    g.clear();

    const t = this.crossing(state);
    if (t <= 0.01) return;

    // Reaches only a little way in. Daylight that carried further would be a
    // lit room, and the whole point is that there is exactly one of these.
    const reach = 150;
    const bands = 16;
    for (let i = 0; i < bands; i++) {
      const f = i / bands;
      const falloff = (1 - f) * (1 - f);
      g.rect(entranceX + reach * f, floorY, reach / bands + 1, 7).fill({
        color: COLOR.air,
        alpha: 0.17 * falloff * t,
      });
      // A dimmer wash further down the floor's face, so the light sits ON the
      // ground rather than being a stripe drawn along its edge.
      g.rect(entranceX + reach * f, floorY + 7, reach / bands + 1, 22).fill({
        color: COLOR.air,
        alpha: 0.06 * falloff * t,
      });
    }
  }

  /**
   * The roof. Everything above the tunnel is rock, and it is drawn with the
   * floor's own vocabulary — strata for thickness, a chipped lip, detail keyed
   * to a cell of world rather than spread across the whole dungeon — because
   * floor and ceiling are the same stone seen from opposite sides.
   */
  private drawCeiling(): void {
    const left = this.cameraX;
    const right = left + VIEW_W;
    const g = this.ceilingGfx;
    g.clear();

    // Outside is open sky. The roof begins where the dungeon does.
    const from = Math.max(dungeonStart, left);
    if (right <= from) return;

    const step = Renderer.LIP_STEP;
    const first = Math.floor(from / step);
    const last = Math.ceil(right / step);

    for (let c = first; c <= last; c++) {
      const x = c * step;
      if (x + step < from) continue;
      const h = roofAt(x);
      g.rect(x, 0, step + 1, h).fill(COLOR.floor);
      // Nothing lights the underside — the sky is on the far side of it — so
      // here it is the DARK edge that reads. The floor's lip is the same rock
      // seen from the side that gets the light, and drawing both bright is
      // what makes a cave look like a corridor with a strip light in it.
      g.rect(x, h - 4, step + 1, 4).fill({ color: COLOR.crack, alpha: 0.85 });
      const n = Renderer.noise(c + 5501);
      if (n > 0.86) {
        g.rect(x + step * 0.25, h - 6, step * 0.5, 6).fill({
          color: COLOR.crack,
          alpha: 0.9,
        });
      }
    }

    // Cloudy patches of older rock. Without them the roof is one unbroken
    // rectangle across the top of the screen, and an unbroken rectangle up
    // there stops reading as stone and starts reading as UI.
    const patch = Renderer.DETAIL_CELL * 1.5;
    for (let c = Math.floor(from / patch); c <= Math.ceil(right / patch); c++) {
      const n = Renderer.noise(c + 3307);
      const px = c * patch + Renderer.noise(c + 611) * patch * 0.6;
      if (px < from) continue;
      const pw = patch * (0.5 + n * 0.8);
      const py = Renderer.noise(c + 902) * CEILING_Y * 0.7;
      const ph = 14 + Renderer.noise(c + 45) * 46;
      const colour = n > 0.5 ? COLOR.floorDeep : COLOR.strata;
      // Stacked bands of unequal width rather than one rectangle. A single
      // translucent rect keeps its corners however low the alpha goes, and a
      // corner is the one thing rock never has.
      for (let b = 0; b < 3; b++) {
        const t = b / 3;
        const inset = pw * 0.18 * Renderer.noise(c + b * 77);
        g.rect(px + inset, py + ph * t, pw - inset * 2, ph / 3 + 1).fill({
          color: colour,
          alpha: 0.3,
        });
      }
    }

    // Strata and a wash toward the top, so the roof has thickness and recedes
    // rather than being one flat slab hanging over the level.
    const width = right - from;
    for (const [at, alpha] of [
      [0.3, 0.5],
      [0.62, 0.34],
    ] as const) {
      g.rect(from, CEILING_Y * (1 - at), width, 2).fill({
        color: COLOR.strata,
        alpha,
      });
    }
    g.rect(from, 0, width, CEILING_Y * 0.5).fill({
      color: COLOR.floorDeep,
      alpha: 0.5,
    });

    // Stalactites, on the same cell as the floor's rubble so the two read as
    // one cave rather than two decorated surfaces.
    const cell = Renderer.DETAIL_CELL;
    for (let c = Math.floor(from / cell); c <= Math.ceil(right / cell); c++) {
      const n = Renderer.noise(c + 771);
      if (n < 0.42) continue;
      const x = c * cell + Renderer.noise(c + 4410) * cell;
      if (x < from) continue;
      const h = roofAt(x);
      const n2 = Renderer.noise(c + 88);
      const halfWidth = 3 + n2 * 6;
      // Kept clear of the jump apex. A spike the player passes through is
      // worse than no spike.
      const tip = Math.min(h + 10 + n2 * 44, 268);

      g.moveTo(x - halfWidth, h - 2)
        .lineTo(x + halfWidth, h - 2)
        .lineTo(x, tip)
        .fill(COLOR.floor);
      // Light from the upper left, as everywhere else.
      g.moveTo(x - halfWidth, h - 2)
        .lineTo(x - halfWidth * 0.2, h - 2)
        .lineTo(x, tip)
        .fill({ color: COLOR.grit, alpha: 0.28 });

      if (n > 0.82) {
        // Damp gathering at the tip, which is where it would.
        g.circle(x, tip - 2, 2).fill({ color: COLOR.damp, alpha: 0.5 });
      }
    }
  }

  /**
   * The cave mouth. If the art is present it carries the entrance and the
   * drawn rock only fills the wall beside and above it; without art the
   * procedural version stands in (ARCH AD-16 — a missing file is never fatal).
   */
  private drawCave(state: SimState): void {
    const { floorY, entranceX } = tuning.room;
    const left = this.cameraX;
    const right = left + VIEW_W;
    const g = this.caveGfx;
    g.clear();

    // The interior is black regardless: it is what the darkness pass covers.
    const interior = Math.max(entranceX, left);
    if (right > interior) {
      g.rect(interior, 0, right - interior, floorY).fill(COLOR.caveDark);
    }

    const art = this.art.frame("cave.entrance");
    if (art) {
      if (!this.caveSprite) {
        this.caveSprite = new Sprite(art);
        this.caveSprite.anchor.set(0.5, 1);
        // Behind the player, in front of the interior fill and the tunnel
        // roof. Placed relative to the ceiling rather than at a fixed index —
        // the floor tile inserts itself at 0 when its art exists, and a
        // hardcoded index would quietly mean something else the day it does.
        this.world.addChildAt(
          this.caveSprite,
          this.world.getChildIndex(this.ceilingGfx) + 1,
        );
      }
      // Placed by its OPENING, not by its edge. The drawn void starts 82
      // pixels into the sprite, and it is the void that has to line up with
      // the threshold — a fraction of the width would have to be re-derived
      // every time the crop changed, and silently drifts when it is not.
      const w = art.width;
      const VOID_LEFT = 282;
      this.caveSprite.position.set(
        entranceX - 9 - VOID_LEFT + w / 2,
        floorY + 6,
      );
      // The light goes out of the mouth as you cross it, on the same curve the
      // dark behind you closes on.
      this.caveSprite.tint = mixColour(
        0xffffff,
        CAVE_TINT_INSIDE,
        this.crossing(state),
      );
      // Rock either side of the art, so the wall reads as continuous.
      const past = Math.max(entranceX + w * 0.6, left);
      if (right > past)
        g.rect(past, 0, right - past, floorY).fill(COLOR.caveDark);
      return;
    }

    g.rect(entranceX - 30, 0, 30, floorY).fill(COLOR.rock);
    for (let i = 0; i < 34; i++) {
      const n = Renderer.noise(i + 300);
      const y = (i / 34) * floorY;
      const bite = 6 + n * 22;
      g.moveTo(entranceX, y)
        .lineTo(entranceX + bite, y + floorY / 34 / 2)
        .lineTo(entranceX, y + floorY / 34)
        .fill(COLOR.rock);
    }
    g.rect(entranceX - 32, 0, 3, floorY).fill(COLOR.rockLip);

    // Stalagmites, one per cell across the visible ground — same reasoning as
    // the floor detail: density that does not depend on how long the dungeon is.
    const cell = Renderer.DETAIL_CELL * 3;
    const from = Math.max(entranceX + 24, left);
    for (let c = Math.floor(from / cell); c <= Math.ceil(right / cell); c++) {
      const x = c * cell + Renderer.noise(c + 1200) * cell;
      if (x < entranceX + 24) continue;
      const rise = 10 + Renderer.noise(c + 1500) * 30;
      g.moveTo(x - 7, floorY)
        .lineTo(x, floorY - rise)
        .lineTo(x + 7, floorY)
        .fill(COLOR.rock);
    }
  }

  /**
   * What you cannot see. The mouth is a boundary of vision, not just geometry:
   * from outside the dungeon is black, and once you are in, the daylight
   * behind you closes up. You are never able to see both at once, which is
   * what makes stepping through feel like a commitment.
   */
  /**
   * How far through the crossing we are: 0 still outside, 1 fully committed.
   *
   * Everything the threshold changes hands on is driven from this one value —
   * the two walls of dark, and the light on the mouth itself — so they can
   * never drift out of step with each other.
   */
  private crossing(state: SimState): number {
    if (state.enteredTick === null) return 0;
    const t = Math.min((state.tick - state.enteredTick) / THRESHOLD_FADE, 1);
    return t * t * (3 - 2 * t);
  }

  private drawDarkness(state: SimState): void {
    const { entranceX } = tuning.room;
    const g = this.darkGfx;
    g.clear();

    // Both walls are drawn during the overlap, one lifting as the other closes,
    // so for those forty-odd ticks the mouth is genuinely half-lit instead of
    // switching owner between two frames.
    const t = this.crossing(state);

    if (t < 1) this.drawGloom(g, entranceX, 1, 90, 0.97 * (1 - t));
    if (t > 0) this.drawGloom(g, entranceX, -1, 70, 0.92 * t);
  }

  /**
   * One wall of dark, running away from the mouth in `direction`, with a
   * graded lip so the edge reads as gloom rather than as a drawn rectangle.
   *
   * @param depth how far the grade takes to reach full black
   * @param strength peak opacity — the handle the crossing fades on
   */
  private drawGloom(
    g: Graphics,
    entranceX: number,
    direction: 1 | -1,
    depth: number,
    strength: number,
  ): void {
    if (strength <= 0.004) return;
    const left = this.cameraX;
    const right = left + VIEW_W;
    // Enough bands that the grade does not read as stripes at the moment it is
    // half-transparent, which is exactly when banding would be visible.
    const bands = 24;

    const edge = entranceX + direction * depth;
    if (direction > 0 ? right > edge : left < edge) {
      const from = direction > 0 ? edge : left;
      const width = direction > 0 ? right - edge : edge - left;
      g.rect(from, 0, width, VIEW_H).fill({ color: 0x000000, alpha: strength });
    }

    const step = depth / bands;
    for (let i = 0; i < bands; i++) {
      const f = i / bands;
      const at =
        direction > 0 ? entranceX + depth * f : entranceX - depth * f - step;
      g.rect(at, 0, step + 1, VIEW_H).fill({
        color: 0x000000,
        alpha: strength * f * f,
      });
    }
  }

  /**
   * Shortcut doors, their levers, and the seams between environments.
   *
   * PRD FR-3.1 requires a shortcut to be "visible and legible from the near
   * side" while being unopenable from it — so a sealed door must be drawn
   * clearly enough to be recognised and frustrating, not hidden. Seeing it is
   * the point: it tells the player there is time to be saved here and that the
   * only way to claim it is to walk on.
   */
  private drawFixtures(state: SimState): void {
    const { floorY } = tuning.room;
    const left = this.cameraX - 90;
    const right = this.cameraX + VIEW_W + 90;
    const g = this.fixtureGfx;
    g.clear();

    // FR-2.3 — environment boundaries are legible in play. A pair of hewn
    // pillars, so crossing one is a thing you see rather than a number that
    // changes on a readout.
    for (let i = 1; i < tuning.budget.environmentCount; i++) {
      const x = environmentStart(i);
      if (x < left || x > right) continue;
      for (const side of [-1, 1]) {
        const px = x + side * 78;
        g.rect(px - 11, floorY - 190, 22, 190).fill(COLOR.rock);
        g.rect(px - 11, floorY - 190, 3, 190).fill({
          color: COLOR.boundary,
          alpha: 0.6,
        });
        g.rect(px - 16, floorY - 198, 32, 10).fill(COLOR.rock);
      }
      g.rect(x - 94, floorY - 206, 188, 12).fill(COLOR.rock);
      g.rect(x - 94, floorY - 206, 188, 2).fill({
        color: COLOR.boundary,
        alpha: 0.5,
      });
      // Notches counting the environment, so the marker names itself.
      for (let n = 0; n <= i; n++) {
        g.rect(x - 4 - i * 7 + n * 14, floorY - 176, 5, 14).fill({
          color: COLOR.boundary,
          alpha: 0.85,
        });
      }
    }

    for (const s of shortcuts) {
      const open = state.openShortcuts.includes(s.id);
      if (s.id === chuteId) {
        this.drawChute(g, s, open, left, right, floorY);
        if (s.leverX >= left && s.leverX <= right)
          this.drawLever(g, s.leverX, floorY, open, state.tick);
        continue;
      }
      if (s.id === geyserId) {
        this.drawGeysers(g, open, left, right, floorY, state.tick);
        if (s.leverX >= left && s.leverX <= right)
          this.drawLever(g, s.leverX, floorY, open, state.tick);
        continue;
      }
      // The burrow and the lift.
      //
      // Both existed in the simulation for a build with no drawing of their
      // own, so both fell through to `drawDoor` — and a shortcut that behaves
      // like a burrow and looks like a door IS a door as far as the player is
      // concerned. Four shortcuts, four things to look at.
      if (s.id === burrowId) {
        if (s.fromX >= left - 120 && s.fromX <= right + 120)
          this.drawBurrow(g, s.fromX, floorY, open, state.tick);
        if (s.toX >= left - 120 && s.toX <= right + 120)
          this.drawBurrow(g, s.toX, floorY, open, state.tick);
        if (s.leverX >= left && s.leverX <= right)
          this.drawLever(g, s.leverX, floorY, open, state.tick);
        continue;
      }
      if (s.id === highRoadId) {
        const road = highRoad();
        if (road && road.x0 - 90 >= left - 140 && road.x0 - 90 <= right + 140)
          this.drawLift(g, road.x0 - 90, floorY, open, state.tick);
        if (s.leverX >= left && s.leverX <= right)
          this.drawLever(g, s.leverX, floorY, open, state.tick);
        continue;
      }
      if (s.fromX >= left && s.fromX <= right)
        this.drawDoor(g, s.fromX, floorY, open);
      if (s.toX >= left && s.toX <= right)
        this.drawDoor(g, s.toX, floorY, open);
      if (s.leverX >= left && s.leverX <= right)
        this.drawLever(g, s.leverX, floorY, open, state.tick);
    }

    // The high road's supports, drawn and not collided.
    //
    // They were surfaces once, and standable ones — a ladder straight onto a
    // shortcut whose lever had never been touched. They exist to be looked at
    // from below, so that is all they do now.
    const road = highRoad();
    if (road && road.x1 > left - 200 && road.x0 < right + 200) {
      for (let x = road.x0 + 120; x < road.x1 - 60; x += 420) {
        if (x < left - 60 || x > right + 60) continue;
        g.rect(x - 12, road.top + 20, 24, floorY - road.top - 20).fill(
          COLOR.rockMid,
        );
        g.rect(x - 12, road.top + 20, 5, floorY - road.top - 20).fill(
          COLOR.rock,
        );
        // A brace where it meets the road, so it reads as built rather than as
        // a pole someone left there.
        g.rect(x - 30, road.top + 20, 60, 10).fill(COLOR.rockMid);
      }
      // And a lit rim along the road's underside, which is the only thing that
      // separates a dark ledge from the dark above the lava.
      g.rect(road.x0, road.top + 24, road.x1 - road.x0, 4).fill({
        color: COLOR.lava,
        alpha: 0.22,
      });
    }

    for (const e of escapes) {
      if (e < left - 120 || e > right + 120) continue;
      this.drawEscape(g, e, floorY, state.tick);
    }

    // The tutorial's two ways out, drawn as the shafts they behave like.
    //
    // There were none. The door at the end was a coordinate and a prompt with
    // nothing on screen at the place it named, and the one behind the spawn did
    // not exist at all — so a player who could not beat a station was sealed in
    // a room with nothing to walk towards.
    if (state.tutorial) {
      for (const at of [tutorialGeom.backX, tutorialGeom.doorX]) {
        if (at < left - 120 || at > right + 120) continue;
        this.drawEscape(g, at, floorY, state.tick);
      }
    }

    this.drawChamber(
      g,
      left,
      right,
      floorY,
      state.tick,
      !state.enemies.some((e) => isLock(e.kind) && e.phase !== "dead"),
    );

    // There was a far exit here — a lit doorway thirty metres past the chamber
    // — and it is gone along with the rule behind it. It did what the escape
    // shaft at the end of the fire does, stood immediately after the one door
    // in the game that is meant to be noticed, and was the brighter of the two:
    // the last thing a player saw before the boss room was an invitation to
    // leave. Banking at the end of the fire is the shaft's job now.

    for (const c of state.chests) {
      if (c.x < left || c.x > right) continue;
      this.drawChest(g, c, state.tick);
    }
  }

  /**
   * A chest. Every unopened one is drawn IDENTICALLY, and that is the whole
   * point: FR-10.2 keeps both tails live at all times, so a chest that
   * advertised what it held would turn the gamble into an errand. Whether this
   * one was worth the air it cost is only knowable afterwards.
   */
  private drawChest(
    g: Graphics,
    chest: SimState["chests"][number],
    tick: number,
  ): void {
    const { x, opened } = chest;
    const floorY = chest.y;

    if (this.art.has("prop.chest")) {
      let sprite = this.chestSprites.get(chest.id);
      if (!sprite) {
        sprite = new Sprite();
        sprite.anchor.set(0.5, 1);
        this.world.addChildAt(
          sprite,
          this.world.getChildIndex(this.fixtureGfx) + 1,
        );
        this.chestSprites.set(chest.id, sprite);
      }
      // Frame 2 for the first second after the lid comes up, then 1. The payout
      // is a moment, not a state to stand next to.
      const frame = !opened
        ? 0
        : tick - (this.openedAt.get(chest.id) ?? tick) < 60
          ? 2
          : 1;
      if (opened && !this.openedAt.has(chest.id)) {
        this.openedAt.set(chest.id, tick);
      }
      sprite.texture = this.art.frame("prop.chest", frame)!;
      sprite.position.set(x, floorY + 2);
      sprite.visible = true;
      if (!opened) {
        // The same slow breath the drawn version had: findable in a dark
        // tunnel, and identical on every chest so it never says what is inside.
        g.rect(x - 17, floorY - 34, 34, 1).fill({
          color: COLOR.lever,
          alpha: 0.22 + 0.14 * Math.sin(tick / 22),
        });
      }
      return;
    }

    const w = 30;
    const h = 21;
    const top = floorY - h;

    if (opened) {
      g.rect(x - w / 2, top + 7, w, h - 7).fill(COLOR.chestSpent);
      g.rect(x - w / 2, top + 7, w, 2).fill({
        color: COLOR.crack,
        alpha: 0.8,
      });
      // The lid, fallen back off the far side.
      g.rect(x - w / 2 - 4, top + 2, w + 8, 5).fill(COLOR.chestSpent);
      g.rect(x - w / 2 - 4, top + 2, w + 8, 1).fill({
        color: COLOR.boundary,
        alpha: 0.4,
      });
      return;
    }

    g.rect(x - w / 2, top, w, h).fill(COLOR.chest);
    g.rect(x - w / 2, top, w, 8).fill(COLOR.chestLid);
    g.rect(x - w / 2, top, w, 1).fill({ color: 0xffffff, alpha: 0.14 });
    g.rect(x - w / 2, top + h - 2, w, 2).fill({
      color: COLOR.crack,
      alpha: 0.6,
    });
    // Bands and a clasp, so it reads as a container rather than a crate.
    for (const dx of [-9, 9]) {
      g.rect(x + dx - 1, top, 3, h).fill({ color: COLOR.crack, alpha: 0.35 });
    }
    g.rect(x - 3, top + 6, 6, 7).fill(COLOR.chestBrass);
    g.rect(x - 3, top + 6, 6, 1).fill({ color: 0xffffff, alpha: 0.3 });

    // A slow breath along the lid. Enough to be findable in a dark tunnel at a
    // glance, and identical on every chest — it says "here", never "worth it".
    g.rect(x - w / 2 - 1, top - 2, w + 2, 1).fill({
      color: COLOR.lever,
      alpha: 0.22 + 0.14 * Math.sin(tick / 22),
    });
  }

  /**
   * The geyser chain's mouths, and a plume out of whichever one is blowing.
   *
   * The plume comes off the same arithmetic `geyserAt` throws the player with,
   * so what is drawn is exactly what lifts you — there is no second copy of the
   * timing to drift out of step with the first.
   */
  private drawGeysers(
    g: Graphics,
    open: boolean,
    left: number,
    right: number,
    floorY: number,
    tick: number,
  ): void {
    const M = tuning.movement;
    for (const [n, vent] of geyserVents.entries()) {
      if (vent < left - 200 || vent > right + 200) continue;
      const r = M.geyserRadius;

      // The mouth: a ring of cracked, raised rock. Always there — the vents
      // blow whether or not anybody has flicked the lever, and being able to
      // see where they are before you can use them is the point of FR-3.1.
      g.rect(vent - r, floorY - 6, r * 2, 10).fill(COLOR.lavaCrust);
      for (let k = -r; k < r; k += 16) {
        g.moveTo(vent + k, floorY - 4)
          .lineTo(vent + k + 8, floorY - 14)
          .lineTo(vent + k + 16, floorY - 4)
          .fill(COLOR.rockMid);
      }
      g.rect(vent - r + 10, floorY - 8, r * 2 - 20, 4).fill({
        color: COLOR.lava,
        alpha: open ? 0.55 : 0.2,
      });

      if (!open) continue;

      const f =
        (((tick - n * M.geyserStagger) % M.geyserPeriod) + M.geyserPeriod) %
        M.geyserPeriod;
      // The plume, and a shorter warning puff just before it.
      if (f < M.geyserBlow) {
        const p = f / M.geyserBlow;
        const h = 300 * Math.min(p * 3, 1) * (1 - p * 0.35);
        for (let k = 0; k < 16; k++) {
          const j = Renderer.noise(n * 31 + k * 13);
          const wob = (j - 0.5) * r * 1.1;
          g.rect(vent + wob - 4, floorY - h * (k / 16) - 8, 8, h / 12).fill({
            color: k < 5 ? COLOR.lavaHot : COLOR.lava,
            alpha: 0.7 - (k / 16) * 0.45,
          });
        }
        g.rect(vent - r, floorY - 12, r * 2, 12).fill({
          color: COLOR.lavaHot,
          alpha: 0.4 * (1 - p),
        });
      } else if (f > M.geyserPeriod - 26) {
        const p = (f - (M.geyserPeriod - 26)) / 26;
        g.rect(vent - r * 0.5, floorY - 10 - p * 14, r, 10 + p * 14).fill({
          color: COLOR.lava,
          alpha: 0.15 + p * 0.35,
        });
      }
    }
  }

  /**
   * The chute: a hatch in the ground and the run of smooth rock beneath it.
   *
   * Drawn sealed until its lever is flicked, because FR-3.1 wants a shortcut
   * legible and frustrating from the near side — you should be able to SEE the
   * hole you are not allowed down yet, and know there is a faster way under
   * your feet that you have not earned.
   */
  private drawChute(
    g: Graphics,
    s: (typeof shortcuts)[number],
    open: boolean,
    left: number,
    right: number,
    floorY: number,
  ): void {
    const span = s.toX - s.fromX;

    // The run itself, below the floor. Only drawn once open: sealed, it is
    // rock, and there is nothing down there to see.
    if (open) {
      const steps = 40;
      for (let i = 0; i < steps; i++) {
        const a = i / steps;
        const b = (i + 1) / steps;
        const ax = s.fromX + span * a;
        const bx = s.fromX + span * b;
        if (bx < left - 200 || ax > right + 200) continue;
        const sag = (u: number) =>
          floorY + tuning.movement.chuteSag * (1 - (u * 2 - 1) * (u * 2 - 1));
        // The bed, and a lit lip along it so the curve reads.
        g.moveTo(ax, sag(a) - 30)
          .lineTo(bx, sag(b) - 30)
          .lineTo(bx, sag(b) + 16)
          .lineTo(ax, sag(a) + 16)
          .fill({ color: COLOR.rockDeep, alpha: 0.95 });
        g.moveTo(ax, sag(a) + 12)
          .lineTo(bx, sag(b) + 12)
          .stroke({ width: 4, color: COLOR.crystal, alpha: 0.22 });
        g.moveTo(ax, sag(a) - 28)
          .lineTo(bx, sag(b) - 28)
          .stroke({ width: 2, color: COLOR.rockLit, alpha: 0.35 });
      }
    }

    // The hatch, in the ground at the near end.
    if (s.fromX >= left - 120 && s.fromX <= right + 120) {
      const w = 46;
      if (open) {
        g.rect(s.fromX - w, floorY - 4, w * 2, 26).fill(COLOR.rockDeep);
        // Teeth of broken floor around the rim, and a cold glow out of it.
        for (let i = -w; i < w; i += 12) {
          g.moveTo(s.fromX + i, floorY)
            .lineTo(s.fromX + i + 6, floorY + 9)
            .lineTo(s.fromX + i + 12, floorY)
            .fill(COLOR.rockMid);
        }
        g.rect(s.fromX - w, floorY - 2, w * 2, 3).fill({
          color: COLOR.crystal,
          alpha: 0.5,
        });
      } else {
        // Sealed: a plate set into the floor, visibly a way down and visibly shut.
        g.rect(s.fromX - w, floorY - 5, w * 2, 8).fill(COLOR.trapPlate);
        g.rect(s.fromX - w, floorY - 5, w * 2, 2).fill({
          color: COLOR.boundary,
          alpha: 0.6,
        });
        for (let i = -w + 8; i < w - 6; i += 16) {
          g.rect(s.fromX + i, floorY - 4, 3, 6).fill({
            color: COLOR.crack,
            alpha: 0.9,
          });
        }
      }
    }

    // And the exit, where it throws you out.
    if (s.toX >= left - 120 && s.toX <= right + 120 && open) {
      g.moveTo(s.toX - 30, floorY + 20)
        .lineTo(s.toX + 26, floorY - 26)
        .lineTo(s.toX + 40, floorY - 10)
        .lineTo(s.toX - 16, floorY + 30)
        .fill(COLOR.rockDeep);
      g.moveTo(s.toX + 26, floorY - 26)
        .lineTo(s.toX + 40, floorY - 10)
        .stroke({ width: 3, color: COLOR.crystal, alpha: 0.4 });
    }
  }

  /** One end of a shortcut. Sealed until its lever has been flicked. */
  private drawDoor(
    g: Graphics,
    x: number,
    floorY: number,
    open: boolean,
  ): void {
    const w = 40;
    const h = 150;
    const top = floorY - h;

    // The recess behind the frame.
    g.rect(x - w, top, w * 2, h).fill(COLOR.doorSealed);

    if (open) {
      // Light from the other side, banded so it reads as depth rather than a
      // flat teal rectangle.
      for (let i = 0; i < 6; i++) {
        const t = i / 6;
        g.rect(
          x - w + w * t,
          top + h * t * 0.35,
          w * 2 * (1 - t),
          h * (1 - t * 0.35),
        ).fill({
          color: COLOR.doorOpen,
          alpha: 0.05 + t * 0.06,
        });
      }
    } else {
      // Barred. Three heavy stones across the opening — legible from the near
      // side (FR-3.1), and unmistakably not a thing you can push through.
      for (let i = 0; i < 3; i++) {
        const by = top + 26 + i * 44;
        g.rect(x - w + 4, by, w * 2 - 8, 16).fill(COLOR.doorFrame);
        g.rect(x - w + 4, by, w * 2 - 8, 3).fill({
          color: COLOR.boundary,
          alpha: 0.7,
        });
      }
    }

    // The frame, drawn last so it sits over both states.
    g.rect(x - w - 8, top - 10, 10, h + 10).fill(COLOR.rock);
    g.rect(x + w - 2, top - 10, 10, h + 10).fill(COLOR.rock);
    g.rect(x - w - 8, top - 10, w * 2 + 16, 10).fill(COLOR.rock);
    g.rect(x - w - 8, top - 10, w * 2 + 16, 2).fill({
      color: open ? COLOR.doorOpen : COLOR.boundary,
      alpha: open ? 0.8 : 0.5,
    });
  }

  /**
   * The lever. PRD FR-3.2 puts it past the ground its shortcut skips, so
   * reaching one is always proof the walk was made — which is the whole reason
   * a walkthrough video cannot hand a player permanent progress.
   */
  private drawLever(
    g: Graphics,
    x: number,
    floorY: number,
    flicked: boolean,
    tick: number,
  ): void {
    const colour = flicked ? COLOR.doorOpen : COLOR.lever;

    g.rect(x - 16, floorY - 12, 32, 12).fill(COLOR.rock);
    g.rect(x - 16, floorY - 12, 32, 2).fill({
      color: COLOR.boundary,
      alpha: 0.6,
    });
    g.rect(x - 4, floorY - 58, 8, 48).fill(COLOR.doorFrame);

    // The handle swings from back-and-up to forward-and-down when flicked, so
    // the state is readable at a glance from across the room.
    const tipX = x + (flicked ? 26 : -22);
    const tipY = floorY - (flicked ? 34 : 74);
    g.moveTo(x, floorY - 54)
      .lineTo(tipX, tipY)
      .stroke({ width: 7, color: colour, alpha: 0.95 });
    g.circle(tipX, tipY, 7).fill(colour);

    if (!flicked) {
      // A slow pulse, because an unflicked lever is the most valuable thing in
      // the dungeon and the player has seconds to notice it.
      const pulse = 0.25 + 0.2 * Math.sin(tick / 18);
      g.circle(tipX, tipY, 15).fill({ color: colour, alpha: pulse });
    }
  }

  /**
   * Which frame a goblin shows, derived entirely from its simulation phase.
   * The wind-up pose gets used for the whole commitment rather than only the
   * telegraph, because that is the thing the player is reading.
   */
  /** Which frame an archer shows. Its draw is the read, so it gets the space. */
  private archerFrame(e: SimState["enemies"][number], tick: number) {
    switch (e.phase) {
      case "telegraphing":
        return this.art.frameOverProgress(
          "enemy.archer.draw",
          e.phaseTicks / tuning.enemies.archer.telegraph,
        );
      case "striking":
      case "recovering":
        return this.art.frameOverProgress(
          "enemy.archer.loose",
          e.phaseTicks / tuning.enemies.archer.recovery,
        );
      case "staggered":
        return this.art.frame("enemy.goblin.stagger");
      case "approaching":
        return this.art.frameAtTick("enemy.archer.walk", tick);
      default:
        return this.art.frameAtTick("enemy.archer.idle", tick);
    }
  }

  /**
   * Which frame the Warden shows.
   *
   * The two wind-ups are the whole reason this is a separate function: the
   * player is reading ONE arm up versus TWO, and the answer to each is the
   * opposite of the other. Drawing them from the same sheet would make the
   * fight a guess.
   */
  private wardenFrame(e: SimState["enemies"][number]) {
    const W = tuning.enemies.warden;
    const slam = e.attackKind === "slam";
    switch (e.phase) {
      case "telegraphing":
        return this.art.frameOverProgress(
          slam ? "enemy.warden.slamWindup" : "enemy.warden.windup",
          e.phaseTicks / (slam ? W.slamTelegraph : W.telegraph),
        );
      case "striking":
      case "recovering":
        return this.art.frameOverProgress(
          slam ? "enemy.warden.slam" : "enemy.warden.strike",
          e.phaseTicks / (slam ? W.slamRecovery : W.recovery),
        );
      case "staggered":
        return this.art.frame("enemy.warden.stagger");
      default:
        return this.art.frameAtTick("enemy.warden.idle", 0);
    }
  }

  /**
   * Which frame a phoenix shows. Its charge is the read — the ball gathers in
   * front of the beak before it throws — so that gets its own two frames and
   * the whole telegraph to play over.
   */
  private phoenixFrame(e: SimState["enemies"][number], tick: number) {
    const P = tuning.enemies.phoenix;
    switch (e.phase) {
      case "telegraphing":
        return this.art.frameOverProgress(
          "enemy.phoenix.charge",
          e.phaseTicks / P.telegraph,
        );
      case "striking":
      case "recovering":
        return this.art.frameOverProgress(
          "enemy.phoenix.throw",
          e.phaseTicks / P.recovery,
        );
      case "staggered":
        return this.art.frame("enemy.phoenix.stagger");
      default:
        // Always beating, even asleep. A hovering thing that held still would
        // read as a dead sprite pinned to the sky.
        return this.art.frameAtTick("enemy.phoenix.hover", tick);
    }
  }

  /**
   * Which frame a flamethrower shows.
   *
   * The cooldown is the important one. It is the opening the whole enemy is
   * built around, so it gets the stagger pose rather than the idle: the player
   * has to be able to see, across a room, that this is the second where it
   * cannot do anything.
   */
  private flamerFrame(
    e: SimState["enemies"][number],
    tick: number,
    index: number,
  ) {
    const F = tuning.enemies.flamethrower;
    switch (e.phase) {
      case "telegraphing":
        return this.art.frameOverProgress(
          "enemy.flamer.wind",
          e.phaseTicks / F.telegraph,
        );
      case "striking":
        return this.art.frameAtTick("enemy.flamer.burn", tick);
      case "recovering":
        return this.art.frame("enemy.flamer.stagger");
      case "staggered":
        return this.art.frame("enemy.flamer.stagger");
      case "approaching":
        return this.art.frameAtTick("enemy.flamer.walk", tick + index * 11);
      default:
        return this.art.frameAtTick("enemy.flamer.idle", tick + index * 17);
    }
  }

  /**
   * Which frame the Kiln shows. Same rule as the Warden: the two wind-ups come
   * off different sheets, because the player is reading which one it is and
   * getting it wrong costs a bar and a burn.
   */
  private kilnFrame(e: SimState["enemies"][number], tick: number) {
    const K = tuning.enemies.kiln;
    const erupting = e.attackKind === "slam";
    switch (e.phase) {
      case "telegraphing":
        return this.art.frameOverProgress(
          erupting ? "enemy.kiln.eruptWindup" : "enemy.kiln.rakeWindup",
          e.phaseTicks / (erupting ? K.eruptTelegraph : K.telegraph),
        );
      case "striking":
      case "recovering":
        return this.art.frameOverProgress(
          erupting ? "enemy.kiln.erupt" : "enemy.kiln.rake",
          e.phaseTicks / (erupting ? K.eruptRecovery : K.recovery),
        );
      case "staggered":
        return this.art.frame("enemy.kiln.stagger");
      default:
        return this.art.frameAtTick("enemy.kiln.idle", tick);
    }
  }

  /** Which frame the water's hunter shows. Two poses; it only does two things. */
  private sharkFrame(e: SimState["enemies"][number], tick: number) {
    switch (e.phase) {
      case "telegraphing":
      case "striking":
      case "recovering":
        return this.art.frameOverProgress(
          "enemy.shark.bite",
          e.phaseTicks / tuning.enemies.shark.recovery,
        );
      default:
        return this.art.frameAtTick("enemy.shark.swim", tick);
    }
  }

  private crabFrame(
    e: SimState["enemies"][number],
    tick: number,
    index: number,
  ) {
    const C = tuning.enemies.crab;
    switch (e.phase) {
      case "telegraphing":
        return this.art.frameOverProgress(
          "enemy.crab.wind",
          e.phaseTicks / C.telegraph,
        );
      case "striking":
        return this.art.frameOverProgress(
          "enemy.crab.strike",
          e.phaseTicks / C.active,
        );
      case "staggered":
        return this.art.frame("enemy.crab.stagger");
      case "approaching":
        return this.art.frameAtTick("enemy.crab.walk", tick + index * 9);
      default:
        return this.art.frameAtTick("enemy.crab.idle", tick + index * 15);
    }
  }

  private lizardFrame(
    e: SimState["enemies"][number],
    tick: number,
    index: number,
  ) {
    const L = tuning.enemies.lizard;
    switch (e.phase) {
      case "telegraphing":
        return this.art.frameOverProgress(
          "enemy.lizard.wind",
          e.phaseTicks / L.telegraph,
        );
      case "striking":
        return this.art.frameOverProgress(
          "enemy.lizard.strike",
          e.phaseTicks / L.active,
        );
      case "staggered":
        return this.art.frame("enemy.lizard.stagger");
      case "approaching":
        return this.art.frameAtTick("enemy.lizard.walk", tick + index * 11);
      default:
        return this.art.frameAtTick("enemy.lizard.idle", tick + index * 19);
    }
  }

  private beeFrame(e: SimState["enemies"][number], tick: number) {
    switch (e.phase) {
      case "telegraphing":
        return this.art.frameOverProgress(
          "enemy.bee.wind",
          e.phaseTicks / tuning.enemies.bee.telegraph,
        );
      case "striking":
        return this.art.frameAtTick("enemy.bee.dive", tick);
      default:
        return this.art.frameAtTick("enemy.bee.hover", tick);
    }
  }

  /**
   * Which frame the Revenant shows.
   *
   * Straight off the player's own sheets, because it IS a player — that is the
   * whole idea, and drawing it any other way would throw away the one thing
   * that makes the fight land. Every animation here is one the player has
   * performed themselves a hundred times, which means its tells need no
   * teaching: you are reading your own wind-up coming back at you.
   *
   * The one substitution is the same one the fight makes. Where the player's
   * stun would be, it throws — so a `fireball` telegraph borrows the smash
   * sheet, which is the only pose in the set with both arms committed and
   * nothing in front of the body.
   */
  private revenantFrame(e: SimState["enemies"][number], tick: number) {
    const R = tuning.enemies.revenant;
    const throwing = e.attackKind === "fireball";

    // Down. Its own corpse, in its own colours, held on the last frame — a body
    // that keeps collapsing is a body nobody believes, and this is the one the
    // player will be standing over.
    if (e.phase === "dead") {
      if (this.revenantDiedAt === null) this.revenantDiedAt = tick;
      const since = tick - this.revenantDiedAt;
      return this.art.frame(
        "skin.revenant.death",
        Math.min(Math.floor(since / 8), 5),
      );
    }

    // Guarding, and it is checked BEFORE the phase machine rather than inside
    // its idle branch.
    //
    // A guard can go up while the Revenant is recovering from something, and
    // the phase is still "recovering" while it does — so the switch below drew
    // an attack frame over a block, which is why catching a swing looked like
    // the animation glitching rather than like a parry. It also used frame 1,
    // the punish tail, when what is wanted is frame 0: the guard actually up.
    if ((e.guardTicks ?? 0) > 0) {
      return this.art.frame("skin.revenant.block", 0);
    }

    // A new wind-up: swap swings.
    if (
      e.phase === "telegraphing" &&
      this.revenantWasPhase !== "telegraphing"
    ) {
      this.revenantSwing = this.revenantSwing === 0 ? 1 : 0;
    }
    this.revenantWasPhase = e.phase;
    const cut =
      this.revenantSwing === 0
        ? ("skin.revenant.attack.a" as const)
        : ("skin.revenant.attack.b" as const);

    switch (e.phase) {
      case "telegraphing":
        // The wind-up runs over the FIRST half of its sheet and the strike over
        // the second, so the two read as one motion rather than as two poses
        // that happen to follow each other.
        return this.art.frameOverProgress(
          throwing ? "skin.revenant.throw" : cut,
          throwing
            ? (e.phaseTicks / R.fireTelegraph) * 0.55
            : (e.phaseTicks / R.telegraph) * 0.45,
        );
      case "striking":
      case "recovering": {
        const total = throwing ? R.fireRecovery : R.recovery;
        return this.art.frameOverProgress(
          throwing ? "skin.revenant.throw" : cut,
          (throwing ? 0.6 : 0.55) +
            Math.min(e.phaseTicks / total, 1) * (throwing ? 0.4 : 0.45),
        );
      }
      case "staggered":
        return this.art.frame("skin.revenant.hurt", 0);
      default: // between them is most of what makes it read as a person coming for
      // you rather than a sprite sliding along the floor.
      {
        // is far — the same two gaits the player has, and the difference
        // Walking, running or standing. It closes at a walk and RUNS when it
        const moved = Math.abs(e.x - this.revenantWasAt);
        if (moved > 2.6) {
          return this.art.frameAtTick("skin.revenant.run", tick);
        }
        return moved > 0.4
          ? this.art.frameAtTick("skin.revenant.walk", tick)
          : this.art.frameAtTick("skin.revenant.idle", tick);
      }
    }
  }

  /**
   * Which frame the Hollow shows. Its two wind-ups come off different sheets,
   * for the reason every boss's do: the player is reading which one it is, and
   * getting it wrong costs a bar.
   */
  private hollowFrame(e: SimState["enemies"][number], tick: number) {
    const H = tuning.enemies.hollow;
    // The sink owns all three of its phases, so it is checked before them
    // rather than inside each. Telegraph is going under, strike is travelling,
    // recover is coming up — and the middle one has no body in it.
    if (e.attackKind === "sink") {
      switch (e.phase) {
        case "telegraphing":
          return this.art.frameOverProgress(
            "enemy.hollow.sink",
            e.phaseTicks / H.sinkTicks,
          );
        case "striking":
          return this.art.frameAtTick("enemy.hollow.under", tick);
        case "recovering":
          return this.art.frameOverProgress(
            "enemy.hollow.rise",
            e.phaseTicks / H.riseTicks,
          );
      }
    }
    const wave = e.attackKind === "slam";
    switch (e.phase) {
      case "telegraphing":
        return this.art.frameOverProgress(
          wave ? "enemy.hollow.waveWindup" : "enemy.hollow.sweepWindup",
          e.phaseTicks / (wave ? H.waveTelegraph : H.telegraph),
        );
      case "striking":
      case "recovering":
        return this.art.frameOverProgress(
          wave ? "enemy.hollow.wave" : "enemy.hollow.sweep",
          e.phaseTicks / (wave ? H.waveRecovery : H.recovery),
        );
      case "staggered":
        return this.art.frame("enemy.hollow.stagger");
      default:
        return this.art.frameAtTick("enemy.hollow.idle", tick);
    }
  }

  private goblinFrame(
    e: SimState["enemies"][number],
    tick: number,
    index: number,
  ) {
    switch (e.phase) {
      case "telegraphing":
        return this.art.frameOverProgress(
          "enemy.goblin.windup",
          e.phaseTicks / tuning.enemies.goblin.telegraph,
        );
      case "striking":
        return this.art.frameOverProgress(
          "enemy.goblin.strike",
          e.phaseTicks / tuning.enemies.goblin.active,
        );
      case "staggered":
        return this.art.frame("enemy.goblin.stagger");
      case "approaching":
        // Offset per enemy so a group does not march in lockstep.
        return this.art.frameAtTick("enemy.goblin.walk", tick + index * 13);
      default:
        return this.art.frameAtTick("enemy.goblin.idle", tick + index * 21);
    }
  }

  /**
   * The jet, drawn from the events the reducer emitted rather than from the
   * enemy's phase.
   *
   * It matters that this comes off `flameJet` and not off the sprite: the sprite
   * only knows the nozzle is lit, and the box that actually burns you is a
   * hundred and fifty units long. Drawing it from the same event that carries
   * the reach means what you see and what hurts are one number.
   */
  private drawFlames(state: SimState): void {
    const g = this.enemyGfx;
    for (const e of state.events) {
      if (e.type !== "flameJet") continue;
      const F = tuning.enemies.flamethrower;
      const dir = e.facing;
      const steps = 13;
      for (let k = 0; k < steps; k++) {
        const f = k / steps;
        const x = e.x + dir * f * e.length;
        // Widening as it goes, the way a jet does, and ragged at the far end.
        const spread = 6 + f * (F.jetHeight * 0.62);
        const j = Renderer.noise(Math.round(x) + state.tick * 3 + k * 41);
        const wob = (j - 0.5) * 10 * f;
        g.rect(
          x - (e.length / steps) * 0.6,
          e.y - F.jetHeight * 0.5 - spread * 0.5 + wob,
          (e.length / steps) * 1.25,
          spread,
        ).fill({
          // White-hot at the nozzle, orange in the body, smoke at the tip.
          color:
            f < 0.18 ? COLOR.lavaHot : f < 0.7 ? COLOR.lava : COLOR.lavaDeep,
          alpha: f < 0.18 ? 0.9 : 0.72 - f * 0.35,
        });
      }
    }
  }

  /**
   * The walls a boss shuts you in with.
   *
   * Drawn from `bossArena`, the same function the collision uses, so the slab
   * you can see is exactly the slab you cannot walk through. They rise out of
   * the floor over a few frames rather than appearing, because a wall that
   * blinks into place reads as a bug and a wall that comes UP reads as the room
   * deciding something.
   */
  private drawArena(state: SimState): void {
    const arena = bossArena(state.enemies, state.player.x, state.inArena);
    if (!arena) {
      this.arenaRaised = 0;
      return;
    }
    this.arenaRaised = Math.min(1, this.arenaRaised + 0.06);

    const g = this.hazardGfx;
    const floorY = tuning.room.floorY;
    const full = 260;
    const h = full * this.arenaRaised;
    const fire = arena.boss.kind === "enemy.kiln";

    for (const at of [arena.left, arena.right]) {
      const w = 26;
      const x = at - (at === arena.left ? w : 0);
      g.rect(x, floorY - h, w, h).fill(COLOR.rockDeep);
      g.rect(x, floorY - h, w, 6).fill(COLOR.rockMid);
      // Courses, so it reads as built rather than as a bar.
      for (let y = floorY - h + 12; y < floorY; y += 22) {
        g.rect(x + 3, y, w - 6, 3).fill({ color: COLOR.rock, alpha: 0.5 });
      }
      // A seam of light down the inside face, in the colour of whatever is
      // holding the door — cold for the Warden, molten for the Kiln.
      const inner = at === arena.left ? x + w - 3 : x;
      g.rect(inner, floorY - h, 3, h).fill({
        color: fire ? COLOR.lava : COLOR.crystal,
        alpha: 0.35,
      });
      if (fire) {
        for (let k = 0; k < 6; k++) {
          const seed = Renderer.noise(Math.round(at) + k * 41 + state.tick);
          g.rect(inner - 1, floorY - h + seed * h, 5, 10).fill({
            color: COLOR.lavaHot,
            alpha: 0.3 * this.arenaRaised,
          });
        }
      }
      // Dust at the foot of it while it is still coming up.
      if (this.arenaRaised < 1) {
        g.rect(x - 8, floorY - 8, w + 16, 10).fill({
          color: COLOR.rockMid,
          alpha: 0.5 * (1 - this.arenaRaised),
        });
      }
    }
  }

  /**
   * The Kiln's heat, and the columns it drives up out of the floor.
   *
   * Both are drawn from the same functions the reducer resolves them with —
   * `kilnAura` and `eruptionAt` — so the ring you can see is exactly the ring
   * that sets you alight and the column you can see is exactly the one that
   * hits you. On a boss whose whole difficulty is spacing, a view that
   * disagreed with the simulation by ten units would be the entire fight.
   */
  private drawKiln(state: SimState): void {
    const g = this.enemyGfx;
    const floorY = tuning.room.floorY;

    for (const e of state.enemies) {
      if (e.kind !== "enemy.kiln" || e.phase === "dead") continue;
      const r = kilnAura(e);
      // The heat, as a band on the floor rather than a circle in the air: what
      // the player needs to know is where they can STAND, and a ring drawn
      // around the body reads as a shield instead of as a no-go strip.
      const pulse = 0.5 + 0.5 * Math.sin(state.tick / 9);
      for (let i = 3; i >= 1; i--) {
        const span = r * (i / 3);
        g.rect(e.x - span, floorY - 6 - i * 2, span * 2, 6 + i * 2).fill({
          color: i === 1 ? COLOR.lavaHot : COLOR.lava,
          alpha: (0.05 + i * 0.03) * (0.7 + pulse * 0.3),
        });
      }
      // Its edge, marked, because "how close is too close" is the question the
      // whole fight asks and a soft gradient does not answer it.
      for (const side of [-1, 1]) {
        g.rect(e.x + side * r - 2, floorY - 22, 4, 22).fill({
          color: COLOR.lavaHot,
          alpha: 0.25 + pulse * 0.2,
        });
      }
      // Heat coming off the body.
      for (let k = 0; k < 7; k++) {
        const seed = Renderer.noise(k * 53 + Math.floor(state.tick / 4) * 11);
        const rise = ((state.tick * 1.4 + k * 30) % 80) / 80;
        g.circle(
          e.x + (seed - 0.5) * tuning.enemies.kiln.width,
          floorY - tuning.enemies.kiln.height - rise * 40,
          3 + rise * 8,
        ).fill({ color: COLOR.emberSmoke, alpha: 0.26 * (1 - rise) });
      }
    }

    // The columns. The crack comes first and is the only warning — the boss is
    // already recovering by the time the far one arrives, so a player reading
    // the monster instead of the floor is reading the wrong thing.
    for (const r of state.eruptions) {
      const box = eruptionAt(r);
      if (box.tell) {
        const f = r.ticks / tuning.enemies.kiln.eruptTell;
        g.rect(box.left, floorY - 4, box.right - box.left, 6).fill({
          color: COLOR.lavaHot,
          alpha: 0.3 + f * 0.55,
        });
        for (let k = 0; k < 4; k++) {
          const seed = Renderer.noise(Math.round(r.x) + k * 29);
          g.rect(
            box.left + 4 + k * 8,
            floorY - 6 - f * (4 + seed * 8),
            3,
            4 + f * 8,
          ).fill({ color: COLOR.lava, alpha: 0.25 + f * 0.5 });
        }
        continue;
      }
      if (!box.live) continue;
      const h = box.bottom - box.top;
      g.rect(box.left, box.top, box.right - box.left, h).fill({
        color: COLOR.lavaDeep,
        alpha: 0.85,
      });
      g.rect(box.left + 4, box.top + 4, box.right - box.left - 8, h).fill({
        color: COLOR.lava,
        alpha: 0.9,
      });
      g.rect(box.left + 10, box.top + 10, box.right - box.left - 20, h).fill({
        color: COLOR.lavaHot,
        alpha: 0.75,
      });
      // Spatter off the top, so it reads as thrown rather than extruded.
      for (let k = 0; k < 5; k++) {
        const seed = Renderer.noise(Math.round(r.x) + k * 37 + r.ticks);
        g.circle(
          r.x + (seed - 0.5) * 40,
          box.top - seed * 22,
          2 + seed * 4,
        ).fill({ color: COLOR.lavaHot, alpha: 0.6 - seed * 0.3 });
      }
    }
  }

  private drawEnemies(state: SimState): void {
    const { width, height, maxHp } = tuning.enemies.goblin;
    this.enemyGfx.clear();
    // Under the bodies, so the maniac is standing in front of its own fire and
    // the Kiln is standing in its own heat.
    this.drawFlames(state);
    this.drawKiln(state);

    const idleArt = this.art.frame("enemy.goblin.idle");
    const hasArt = idleArt !== null;

    // Keep one Sprite per enemy slot rather than churning objects each frame.
    while (hasArt && this.enemySprites.length < state.enemies.length) {
      const s = new Sprite();
      s.anchor.set(0.5, 1); // feet on the ground, like the hurtbox
      this.world.addChild(s);
      this.enemySprites.push(s);
    }

    state.enemies.forEach((e, i) => {
      const sprite = this.enemySprites[i];
      if (sprite) {
        // Nothing in the dark is visible from outside. This is belt and braces
        // with the darkness pass: the sprites are not drawn at all.
        // The Revenant's corpse stays on screen. Everything else in the game
        // vanishes when it dies, which is right for a goblin in a crowd and
        // wrong for the one thing the player came all this way to kill.
        sprite.visible =
          state.entered &&
          hasArt &&
          (e.phase !== "dead" || e.kind === "enemy.revenant");
        if (sprite.visible) {
          const art =
            e.kind === "enemy.warden"
              ? this.wardenFrame(e)
              : e.kind === "enemy.archer"
                ? this.archerFrame(e, state.tick)
                : e.kind === "enemy.kiln"
                  ? this.kilnFrame(e, state.tick)
                  : e.kind === "enemy.revenant"
                    ? this.revenantFrame(e, state.tick)
                    : e.kind === "enemy.hollow"
                      ? this.hollowFrame(e, state.tick)
                      : e.kind === "enemy.shark"
                        ? this.sharkFrame(e, state.tick)
                        : e.kind === "enemy.crab"
                          ? this.crabFrame(e, state.tick, i)
                          : e.kind === "enemy.lizard"
                            ? this.lizardFrame(e, state.tick, i)
                            : e.kind === "enemy.bee"
                              ? this.beeFrame(e, state.tick)
                              : e.kind === "enemy.phoenix"
                                ? this.phoenixFrame(e, state.tick)
                                : e.kind === "enemy.flamer"
                                  ? this.flamerFrame(e, state.tick, i)
                                  : this.goblinFrame(e, state.tick, i);
          sprite.texture = (art ?? idleArt)!;
          sprite.position.set(e.x, e.y);
          sprite.scale.x = e.facing;
        }
      }
    });

    // Remembered after the pass, so "walking" means "moved since the last
    // frame". The simulation does not say — an enemy has phases, not a gait —
    // and the difference between standing and walking is the whole reason its
    // approach reads as a person closing on you rather than a sprite sliding.
    const rev = state.enemies.find((e) => e.kind === "enemy.revenant");
    this.revenantWasAt = rev ? rev.x : 0;

    for (const e of state.enemies) {
      if (e.phase === "dead" || !state.entered) continue;
      if (hasArt) {
        // No wind-up bar. The tell is the ANIMATION — reared back, cleaver
        // overhead, eyes lit — and a progress bar above its head does the
        // reading for you, which is the skill the game is asking for.
        const size = enemySize(e.kind);
        // Off the same table the simulation sizes them from, so a new monster
        // never comes with a bar measured for a goblin.
        const full =
          e.kind === "enemy.warden"
            ? tuning.enemies.warden.maxHp
            : e.kind === "enemy.archer"
              ? tuning.enemies.archer.maxHp
              : e.kind === "enemy.kiln"
                ? tuning.enemies.kiln.maxHp
                : e.kind === "enemy.revenant"
                  ? tuning.enemies.revenant.maxHp
                  : e.kind === "enemy.hollow"
                    ? tuning.enemies.hollow.maxHp
                    : e.kind === "enemy.shark"
                      ? tuning.enemies.shark.maxHp
                      : e.kind === "enemy.crab"
                        ? tuning.enemies.crab.maxHp
                        : e.kind === "enemy.lizard"
                          ? tuning.enemies.lizard.maxHp
                          : e.kind === "enemy.bee"
                            ? tuning.enemies.bee.maxHp
                            : e.kind === "enemy.phoenix"
                              ? tuning.enemies.phoenix.maxHp
                              : e.kind === "enemy.flamer"
                                ? tuning.enemies.flamethrower.maxHp
                                : maxHp;
        if (e.hp < full) {
          // Sized to the body it is over. Hardcoding the goblin's width drew a
          // 34-wide bar across an 84-wide boss.
          const w = size.width;
          const h =
            e.kind === "enemy.warden" ||
            e.kind === "enemy.kiln" ||
            e.kind === "enemy.hollow" ||
            e.kind === "enemy.revenant"
              ? 5
              : 3;
          void width;
          this.enemyGfx
            .rect(e.x - w / 2, e.y - size.height - 8, w, h)
            .fill({ color: 0x000000, alpha: 0.5 });
          this.enemyGfx
            .rect(e.x - w / 2, e.y - size.height - 8, w * (e.hp / full), h)
            .fill(COLOR.enemyStriking);
        }
        continue;
      }

      // The telegraph has to be loud — a wind-up the player cannot read makes
      // the parry unfair, which breaks the whole design (PRD FR-6.1).
      const colour =
        e.phase === "telegraphing"
          ? COLOR.enemyTelegraph
          : e.phase === "striking"
            ? COLOR.enemyStriking
            : e.phase === "staggered"
              ? COLOR.enemyStaggered
              : COLOR.enemy;

      this.enemyGfx
        .rect(e.x - width / 2, e.y - height, width, height)
        .fill(colour);

      // No wind-up bar here either. This path only runs when the art failed to
      // load, and the colour change above already carries the tell.

      // Health, only once hurt — no clutter on a full-health room.
      if (e.hp < maxHp) {
        this.enemyGfx
          .rect(e.x - width / 2, e.y - height - 5, width * (e.hp / maxHp), 3)
          .fill(COLOR.enemyStriking);
      }
    }
  }

  /**
   * Which frame the player should show. Derived entirely from simulation state
   * — the view holds no animation clock of its own, so a paused or rewound sim
   * always draws the same thing.
   */
  /**
   * Which sprite family the player is wearing.
   *
   * A skin re-skins most of the set but not all of it — death and the
   * transformation belong to the person rather than the armour — so this falls
   * back to the default whenever the skinned sheet does not exist. That also
   * makes a half-loaded skin degrade to the ordinary player instead of to
   * nothing at all.
   */
  private skinned(state: SimState, key: SpriteKey): SpriteKey {
    const skin = state.loadout.skin;
    if (!skin) return key;
    const which = skin.split(".")[1];
    const alt = key.replace(/^player\./, `skin.${which}.`) as SpriteKey;
    return this.art.has(alt) ? alt : key;
  }

  private playerFrame(state: SimState) {
    const p = state.player;

    // How the run ended, played out. Held on the last frame rather than looped:
    // a corpse that keeps collapsing is a corpse nobody believes.
    if (state.outcome !== "running" && state.outcome !== "extracted") {
      const key =
        state.outcome === "transformed"
          ? this.skinned(state, "player.transform")
          : this.skinned(state, "player.death");
      if (this.art.has(key)) {
        const since = state.tick - (state.endedTick ?? state.tick);
        const frames = SPRITE_MANIFEST[key].frames;
        return this.art.frame(key, Math.min(Math.floor(since / 9), frames - 1));
      }
    }

    if (
      p.action.kind === "smash" &&
      this.art.has(this.skinned(state, "player.smash"))
    ) {
      // Frames 0-2 are the dive, frame 3 the impact — so pin the last frame to
      // the moment the hitbox is actually live rather than easing through it.
      const grounded = p.stance !== "airborne";
      return grounded
        ? this.art.frame(this.skinned(state, "player.smash"), 3)
        : this.art.frameOverProgress(
            this.skinned(state, "player.smash"),
            Math.min(p.action.elapsed / 14, 0.74),
          );
    }

    if (p.action.kind === "attack") {
      // Alternating swings, so a chain does not replay the same animation.
      const key =
        p.action.variant === 0
          ? this.skinned(state, "player.attack.a")
          : this.skinned(state, "player.attack.b");
      if (this.art.has(key)) {
        const total =
          tuning.player.attackStartup +
          tuning.player.attackActive +
          tuning.player.attackRecovery;
        return this.art.frameOverProgress(key, p.action.elapsed / total);
      }
    }

    if (
      p.action.kind === "stun" &&
      this.art.has(this.skinned(state, "player.stun"))
    ) {
      // Mapped across the whole move rather than eased through it, so the two
      // wind-up frames occupy the startup and the drive lands on the tick the
      // hitbox does. The tell IS the animation here — read it wrong and the
      // 0.3s of startup is time a goblin gets for free.
      return this.art.frameOverProgress(
        this.skinned(state, "player.stun"),
        p.action.elapsed / STUN_TOTAL,
      );
    }

    if (
      p.action.kind === "block" &&
      this.art.has(this.skinned(state, "player.block"))
    ) {
      // Frame 0 is the live parry window, frame 1 the punish tail — the two
      // states must not look alike, because telling them apart IS the skill.
      const parrying = p.action.elapsed < tuning.combat.parryWindow;
      return this.art.frame(
        this.skinned(state, "player.block"),
        parrying ? 0 : 1,
      );
    }

    // A slide and a step back are not the same move and must not look alike:
    // one is a committed dive that carries into a sprint, the other is a short
    // hop away from a swing. Reading them as one costs the player exactly the
    // difference between escaping and dodging.
    if (
      p.stance === "sliding" &&
      this.art.has(this.skinned(state, "player.slide"))
    ) {
      return this.art.frameOverProgress(
        this.skinned(state, "player.slide"),
        1 - Math.min(p.dashTicks / tuning.movement.slideDuration, 1),
      );
    }
    if (
      p.stance === "backstepping" &&
      this.art.has(this.skinned(state, "player.backstep"))
    ) {
      return this.art.frameOverProgress(
        this.skinned(state, "player.backstep"),
        1 - Math.min(p.dashTicks / tuning.movement.backstepDuration, 1),
      );
    }

    // Swimming, which is the only pose in the set where the body is horizontal.
    // Checked ahead of the wall and the gait because both of those would
    // otherwise claim it: a swimmer has no ground under them, so every test
    // that starts "not on the ground" was answering for this one.
    if (
      p.stance === "swimming" &&
      this.art.has(this.skinned(state, "player.swim"))
    ) {
      // Stepped by tick rather than by height. A stroke is a rhythm the player
      // holds whether they are rising, sinking or crossing — tying it to depth
      // made it stall dead the moment they levelled out.
      return this.art.frameAtTick(
        this.skinned(state, "player.swim"),
        state.tick,
      );
    }

    if (
      p.stance === "clinging" &&
      this.art.has(this.skinned(state, "player.wall"))
    ) {
      // Stepped by HEIGHT, not by tick: the two frames are a grip slipping and
      // catching, so they have to advance as the player descends. On a timer
      // they would keep shuffling while hanging still.
      return this.art.frame(
        this.skinned(state, "player.wall"),
        Math.floor(p.y / 9),
      );
    }

    if (
      p.stance === "climbing" &&
      this.art.has(this.skinned(state, "player.crouch"))
    ) {
      // No climb art yet. The crouch pose is the only one in the set with the
      // arms up and the body compact, and stepping it by height rather than by
      // tick makes it read as hauling rather than as an idle on a ladder.
      return this.art.frame(
        this.skinned(state, "player.crouch"),
        Math.floor(p.y / 14),
      );
    }

    const moving = Math.abs(p.vx) > 0.1 && p.stance !== "airborne";

    if (p.stance === "crouching") {
      const key = moving
        ? this.skinned(state, "player.crouchWalk")
        : this.skinned(state, "player.crouch");
      if (this.art.has(key)) return this.art.frameAtTick(key, state.tick);
    }

    // Two gaits, and the difference has to be visible: the sprint is the
    // player's reward for committing to a slide, so it must not look like the
    // walk played faster.
    if (moving) {
      const key = p.running
        ? this.skinned(state, "player.run")
        : this.skinned(state, "player.walk");
      if (this.art.has(key)) return this.art.frameAtTick(key, state.tick);
    }

    return this.art.frameAtTick(this.skinned(state, "player.idle"), state.tick);
  }

  /**
   * Poisoned.
   *
   * Not fire in another colour, which is what it was and what it looked like.
   * Fire is bright, upward and fast; poison is none of those. It is something
   * IN you rather than on you, so this is drawn as a slow sickly haze that
   * clings to the body, a few beads running DOWN it, and a wash of green over
   * the whole figure — nothing rises, nothing flickers, and it fades rather
   * than gutters.
   */
  private drawPoisoned(state: SimState, x: number, y: number): void {
    const left = state.player.poisoned;
    const g = this.fxGfx;
    const h = tuning.player.height;
    const w = tuning.player.width;
    const life = left / tuning.poison.ticks;
    // Thickest in the middle of its run rather than at the start: it takes hold
    // and then wears off, which is what being poisoned feels like.
    const strength = Math.min(1, life * 2) * Math.min(1, (1 - life) * 3 + 0.35);

    // The haze: a soft column around the body, breathing slowly.
    const breathe = 0.85 + 0.15 * Math.sin(state.tick / 22);
    for (let i = 3; i >= 1; i--) {
      g.rect(
        x - w * 0.9 * (i / 3) - 4,
        y - h - 6,
        w * 1.8 * (i / 3) + 8,
        h + 12,
      ).fill({ color: COLOR.bile, alpha: 0.05 * strength * breathe * i });
    }

    // Beads running down. Slow, and they fall rather than rise.
    for (let i = 0; i < 7; i++) {
      const seed = Renderer.noise(i * 61);
      const fall = ((state.tick * 0.9 + i * 37) % 90) / 90;
      const px = x + (seed - 0.5) * w * 1.3;
      const py = y - h * (1 - fall) - 4;
      g.circle(px, py, 1.6 + seed * 2).fill({
        color: seed > 0.6 ? COLOR.bileLit : COLOR.bile,
        alpha: (0.5 - fall * 0.35) * strength,
      });
    }

    // And the body itself going green under it.
    g.rect(x - w * 0.6, y - h, w * 1.2, h).fill({
      color: COLOR.bile,
      alpha: 0.1 * strength,
    });
    // A pool of it under the feet, so the ground reads as affected too.
    g.rect(x - 22, y - 4, 44, 6).fill({
      color: COLOR.bileDeep,
      alpha: 0.28 * strength,
    });
  }

  /**
   * The player on fire.
   *
   * Drawn over whichever body is underneath rather than baked into the sprites.
   * There are five skins and eighteen poses each — ninety sheets — and catching
   * fire has to look the same on all of them, so a burning variant of every one
   * would be ninety more sheets that could drift apart. Flames that live in
   * front of the sprite are one implementation and always agree.
   *
   * Three parts, and each is doing a job:
   *
   *   the catch    a bright flare on the tick it takes hold, so you know the
   *                hit did something beyond its own damage
   *   the body     tongues rising off the shoulders and head, thickest while
   *                the burn is fresh and guttering out as it ends
   *   the ground   a wash of light under the feet, because a lit figure that
   *                does not light anything reads as a decal
   */

  /**
   * The five bubbles.
   *
   * Over the head rather than on the HUD, and that is the whole design of them.
   * The tank at the top of the screen is the run's clock and reading it means
   * looking away from the water; this is the room's clock and it is drawn where
   * the player is already looking. Five things you can count in a glance,
   * without counting.
   *
   * Each one has its own life: full and round while it is held, wobbling as it
   * gets close, and it POPS — a ring that expands and fades — rather than
   * blinking out. The pop is the warning. Nothing else in the frame announces
   * itself at exactly the moment something got worse.
   */
  private drawBreath(state: SimState, x: number, y: number): void {
    const p = state.player;
    const per = tuning.swim.bubbleTicks;
    const max = tuning.swim.bubbles * per;
    // Drawn while submerged, and for a moment after surfacing so the refill is
    // visible — a meter that vanishes the instant it stops mattering never
    // teaches anybody what it was counting.
    if (p.breath >= max && p.stance !== "swimming") return;

    const g = this.fxGfx;
    const top = y - tuning.player.height - 26;
    const held = Math.max(0, p.breath);

    for (let i = 0; i < tuning.swim.bubbles; i++) {
      // Bubble i is the i-th to go, so it owns ticks [i*per, (i+1)*per).
      const life = Math.min(1, Math.max(0, (held - i * per) / per));
      const bx = x - 34 + i * 17;
      const drift = Math.sin((state.tick + i * 40) / 15) * 1.6;
      const by = top + drift;

      if (life <= 0) {
        // Gone. The pop plays out over the third of a second after it went,
        // which is what makes losing one an event rather than an absence.
        const since = i * per - held;
        if (since < 20) {
          const f = since / 20;
          g.circle(bx, by - f * 10, 4 + f * 9).stroke({
            color: COLOR.foam,
            width: 2,
            alpha: 0.55 * (1 - f),
          });
        }
        continue;
      }

      // Held. It shrinks and shivers as its own second runs out, so the NEXT
      // pop is telegraphed rather than sudden.
      const shiver = life < 0.35 ? Math.sin(state.tick / 2.2) * 1.2 : 0;
      const r = 3.4 + life * 2.2;
      g.circle(bx + shiver, by, r).fill({ color: COLOR.foam, alpha: 0.34 });
      g.circle(bx + shiver, by, r).stroke({
        color: COLOR.seaLit,
        width: 1.4,
        alpha: 0.75,
      });
      // The highlight, which is the only reason a filled circle reads as air
      // rather than as a dot.
      g.circle(bx + shiver - r * 0.34, by - r * 0.34, r * 0.3).fill({
        color: 0xffffff,
        alpha: 0.6,
      });
    }

    // Out of breath. The water closes in from the edges of the figure — drawn
    // on the PLAYER rather than over the screen, because it is a thing
    // happening to them and a full-screen vignette reads as a UI state.
    if (held <= 0) {
      const pulse = 0.35 + 0.25 * Math.sin(state.tick / 7);
      for (let i = 3; i >= 1; i--) {
        g.rect(
          x - tuning.player.width / 2 - i * 5,
          y - tuning.player.height - i * 5,
          tuning.player.width + i * 10,
          tuning.player.height + i * 6,
        ).fill({ color: COLOR.seaDeep, alpha: (pulse * 0.16) / i });
      }
    }
  }

  /**
   * The ward: a bubble around the player that nothing gets through.
   *
   * It has to be unmistakable and it has to be temporary, and those pull in
   * opposite directions — a strong effect reads as a permanent one. So the
   * shell is bright and thin rather than bright and thick, it BREATHES at a
   * rate you can count, and in the last second and a half it flickers, which is
   * the only warning the player gets that the thing about to hit them will
   * land.
   */
  private drawShield(state: SimState, x: number, y: number): void {
    const left = state.buffs.shield;
    if (left <= 0) return;
    const g = this.fxGfx;
    const h = tuning.player.height;
    const cx = x;
    const cy = y - h * 0.52;
    const r = h * 0.72;

    // Failing. Under a second and a half it stutters, and the stutter gets
    // faster — a timer nobody can read is a timer that runs out by surprise.
    const dying = left < tuning.potions.shieldTicks * 0.22;
    const stutter = dying
      ? 0.35 + 0.65 * Math.abs(Math.sin(state.tick / 3))
      : 1;
    const breathe = 1 + 0.035 * Math.sin(state.tick / 11);

    // The body of it, barely there — a filled bubble at any real opacity hides
    // the player inside it, and the player is the thing being protected.
    g.circle(cx, cy, r * breathe).fill({
      color: COLOR.seaLit,
      alpha: 0.07 * stutter,
    });
    // Two shells, the outer one brighter. One reads as a circle drawn on the
    // screen; two read as a surface with thickness.
    g.circle(cx, cy, r * breathe).stroke({
      color: 0xffffff,
      width: 2,
      alpha: 0.5 * stutter,
    });
    g.circle(cx, cy, r * breathe - 5).stroke({
      color: COLOR.seaLit,
      width: 1.5,
      alpha: 0.35 * stutter,
    });

    // Facets running round it, turning slowly. Without them it is a soap
    // bubble; with them it is something someone made.
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + state.tick / 90;
      const rr = r * breathe;
      g.moveTo(cx + Math.cos(a) * (rr - 7), cy + Math.sin(a) * (rr - 7))
        .lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr)
        .stroke({ color: 0xffffff, width: 1.5, alpha: 0.22 * stutter });
    }
  }

  /**
   * The lamp's light: a pool on the ground, thrown ahead of the player.
   *
   * The camera lead is what the item actually BUYS, and a camera lead is
   * invisible — a player who bought it would see more and never know why. So
   * the light is the receipt: a warm cone in front of you, reaching exactly as
   * far as the extra sight does, so the thing you paid for has an edge you can
   * point at.
   *
   * Drawn under everything rather than over it, and warm rather than white,
   * because the alternative is a torch beam over the top of the art — which
   * lights nothing and hides what it crosses.
   */
  private drawLamp(state: SimState, x: number, y: number): void {
    const reach = statsFor(state.loadout).sightAhead;
    if (reach <= 0) return;
    const g = this.lampGfx;
    g.clear();
    /**
     * FORWARD, always. The lamp does not swing round when the player does.
     *
     * It used to follow `facing`, which meant every turn threw the whole cone —
     * most of the lit ground on screen — across to the other side, and the
     * camera lean went with it. Turning round is not rare in this game: you turn
     * to fight, you turn at a wall, and you turn for the entire walk home. So
     * the one item whose job is steady visibility was the thing making the
     * screen lurch.
     *
     * Fixed rather than smoothed, because smoothing only makes a slow lurch. A
     * hooded lamp pointed the way you are going is also the easier thing to
     * believe: it is strapped on, not held out.
     */
    const dir = 1;
    const eye = y - tuning.player.height * 0.72;

    // The cone. Bands rather than a gradient fill, on the same principle the
    // gloom uses: banding is only visible where it is nearly transparent, and
    // enough bands puts that below the threshold.
    // Wide as well as long. The first version was a narrow band at five per
    // cent — technically light, and invisible on a floor already lit by lava.
    // This opens to nearly a full screen height at the far end and holds enough
    // alpha to actually change what the ground looks like.
    const bands = 26;
    for (let i = 0; i < bands; i++) {
      const f = i / bands;
      const from = x + dir * (24 + f * reach);
      const spread = 90 + f * 420;
      g.rect(
        Math.min(from, from + dir * (reach / bands + 1)),
        eye - spread * 0.5,
        reach / bands + 2,
        spread,
      ).fill({ color: 0xffd9a0, alpha: 0.115 * (1 - f * 0.82) });
    }

    // A brighter core down the middle of the cone, so the near ground is
    // genuinely lit rather than merely tinted.
    for (let i = 0; i < bands; i++) {
      const f = i / bands;
      const from = x + dir * (24 + f * reach);
      const spread = 50 + f * 180;
      g.rect(
        Math.min(from, from + dir * (reach / bands + 1)),
        eye - spread * 0.5,
        reach / bands + 2,
        spread,
      ).fill({ color: 0xffe6bc, alpha: 0.075 * (1 - f * 0.9) });
    }

    // And the pool at the player's own feet, which is what makes it a lamp
    // being carried rather than a light somewhere ahead.
    for (let i = 4; i >= 1; i--) {
      g.ellipse(x + dir * 30, y - 4, 90 * i * 0.7, 26 * i * 0.55).fill({
        color: 0xffd9a0,
        alpha: 0.075 / i,
      });
    }

    // The lamp itself, on the hip, so the source is somewhere rather than
    // nowhere.
    // The lamp on the hip, with a halo, so the source is somewhere rather than
    // nowhere.
    for (let i = 3; i >= 1; i--) {
      g.circle(x - dir * 8, eye + 24, 7 * i).fill({
        color: 0xffd9a0,
        alpha: 0.16 / i,
      });
    }
    g.circle(x - dir * 8, eye + 24, 6).fill({ color: 0xffe6bc, alpha: 0.75 });
    g.circle(x - dir * 8, eye + 24, 3).fill(0xfffaf0);
  }

  private drawBurning(state: SimState, x: number, y: number): void {
    if (state.player.poisoned > 0) this.drawPoisoned(state, x, y);
    this.drawShield(state, x, y);
    this.drawBreath(state, x, y);
    const left = state.player.burning;
    if (left <= 0) return;
    const hot = COLOR.lavaHot;
    const warm = COLOR.lava;

    const g = this.fxGfx;
    const F = tuning.fire;
    const h = tuning.player.height;
    // Fierce at the start, guttering at the end, so the burn has a shape and
    // you can see when it is nearly over.
    const life = left / F.burnTicks;
    const heat = Math.min(1, life * 2.2);

    // The catch.
    if (left > F.burnTicks - 6) {
      const f = (left - (F.burnTicks - 6)) / 6;
      g.circle(x, y - h * 0.55, 26 + (1 - f) * 30).fill({
        color: hot,
        alpha: 0.4 * f,
      });
    }

    // The body of it. Tongues seeded off the tick so they flicker rather than
    // slide, which is what fire does and what scrolling embers do not.
    for (let i = 0; i < 11; i++) {
      const seed = Renderer.noise(i * 37 + Math.floor(state.tick / 3) * 13);
      const along = i / 11;
      const px = x + (seed - 0.5) * tuning.player.width * 1.5;
      const base = y - h * (0.1 + along * 0.85);
      const tall = (10 + seed * 22) * heat;
      const wide = 3 + seed * 4;
      g.moveTo(px - wide, base)
        .lineTo(px + wide, base)
        .lineTo(px + (seed - 0.5) * 6, base - tall)
        .fill({
          color: seed > 0.62 ? hot : warm,
          alpha: (0.35 + seed * 0.4) * heat,
        });
    }

    // Smoke off the top, which is what makes it read as burning rather than as
    // a glow effect.
    for (let i = 0; i < 4; i++) {
      const seed = Renderer.noise(i * 91 + Math.floor(state.tick / 5) * 7);
      const rise = ((state.tick * 1.6 + i * 40) % 70) / 70;
      g.circle(x + (seed - 0.5) * 26, y - h - rise * 46, 4 + rise * 9).fill({
        color: COLOR.emberSmoke,
        alpha: 0.3 * (1 - rise) * heat,
      });
    }

    // And the light it throws down.
    g.rect(x - 34, y - 8, 68, 10).fill({
      color: hot,
      alpha: 0.16 * heat,
    });
  }

  private drawPlayer(state: SimState, x: number, y: number): void {
    const { width, height } = tuning.player;
    const p = state.player;
    const h =
      p.stance === "crouching"
        ? height * tuning.movement.crouchHeightScale
        : height;

    const colour =
      p.action.kind === "block"
        ? COLOR.playerBlocking
        : p.action.kind === "stun"
          ? COLOR.playerStunning
          : p.action.kind === "attack"
            ? COLOR.playerAttacking
            : p.dashTicks > 0
              ? COLOR.playerDashing
              : COLOR.player;

    this.playerGfx.clear();

    const playerArt = this.playerFrame(state);
    if (playerArt) {
      if (!this.playerSprite) {
        this.playerSprite = new Sprite(playerArt);
        this.playerSprite.anchor.set(0.5, 1);
        this.world.addChild(this.playerSprite);
      }
      this.playerSprite.texture = playerArt;
      this.playerSprite.position.set(x, y);
      this.playerSprite.scale.x = p.facing;
      // Deliberately untinted: multiplying a coloured sprite by a state colour
      // muddies both. State reads from the swing box and the block ring below,
      // which are clearer anyway — and an armour skin is a different SHEET now
      // rather than a wash over this one.
      this.playerSprite.tint = 0xffffff;
    } else {
      // Hurtbox, drawn from the feet up — the sprite will hang off this later.
      this.playerGfx.rect(x - width / 2, y - h, width, h).fill(colour);
      // A facing tick, so direction is readable before there is art.
      this.playerGfx
        .rect(
          x + (p.facing > 0 ? width / 2 : -width / 2 - 6),
          y - h * 0.7,
          6,
          4,
        )
        .fill(colour);
    }

    // The stun is drawn over its whole length, not just its live frames: the
    // wind-up is the tell, and a tell nobody can see is not one.
    if (p.action.kind === "stun") {
      this.drawStunStrike(x, y - h * 0.62, p.facing, p.action.elapsed);
    }

    // The swing itself, as an arc rather than a box. Without a visible slash
    // the attack reads as nothing happening; a rectangle reads as a debug aid.
    const swing = playerHitbox(p);
    if (swing && p.action.kind === "attack") {
      const t =
        (p.action.elapsed - tuning.player.attackStartup) /
        Math.max(tuning.player.attackActive, 1);
      this.drawSlash(
        x,
        y - h * 0.55,
        p.facing,
        Math.min(Math.max(t, 0), 1),
        p.action.variant,
      );
    }

    // Block: the blade comes up between him and the threat. The parry window
    // and the punish tail must look different, because telling them apart is
    // the whole skill (PRD FR-5.7 / FR-5.9).
    if (p.action.kind === "block") {
      const parrying = p.action.elapsed < tuning.combat.parryWindow;
      const f = p.facing;

      // He carries a SHORT sword, so the guard is an arm raised high with a
      // stubby blade angled across the face — not a longsword held like a
      // fencepost. Blade length here matches the sprite's.
      const shoulder = { x: x + f * 4, y: y - h * 0.72 };
      const hand = { x: x + f * 13, y: y - h * 0.82 };
      const tip = { x: x + f * 9, y: y - h * 1.06 };

      // Raised forearm.
      this.playerGfx
        .moveTo(shoulder.x, shoulder.y)
        .lineTo(hand.x, hand.y)
        .stroke({
          width: 5,
          color: parrying ? 0xd8e2ec : COLOR.playerDashing,
          alpha: parrying ? 0.9 : 0.45,
        });
      // The short blade, angled back over the head.
      this.playerGfx
        .moveTo(hand.x, hand.y)
        .lineTo(tip.x, tip.y)
        .stroke({
          width: parrying ? 6 : 4,
          color: parrying ? COLOR.parryFlash : COLOR.playerDashing,
          alpha: parrying ? 1 : 0.55,
        });
      // Crossguard at the hand, so it reads as a sword rather than a stick.
      this.playerGfx
        .moveTo(hand.x - f * 4, hand.y - 4)
        .lineTo(hand.x + f * 5, hand.y + 2)
        .stroke({
          width: 3,
          color: parrying ? 0xf4d59a : COLOR.playerDashing,
          alpha: parrying ? 0.95 : 0.4,
        });

      if (parrying) {
        // A glint along the edge only while the window is live, so the "now"
        // is unmistakable at a glance.
        this.playerGfx
          .moveTo(hand.x + f * 1, hand.y - 3)
          .lineTo(tip.x + f * 1, tip.y + 2)
          .stroke({ width: 2, color: 0xffffff, alpha: 0.95 });
      }
    }
  }

  private drawAir(state: SimState): void {
    const low = state.entered && state.air <= VIGNETTE_TICKS;

    // No clock in the tutorial, and this is not a cosmetic call.
    //
    // The air never runs down in the hall — it is god mode — so the dial sat
    // full and the number sat still. But a number counting nothing at the top
    // of the screen is still read as a countdown, and the whole premise of the
    // game is that the number at the top of the screen is the thing that kills
    // you. Teaching somebody their controls while a timer appears to run is
    // teaching them to hurry through the part where they are supposed to be
    // experimenting. The clock is introduced by the dungeon, not by the hall.
    const teaching = state.tutorial !== null;
    this.clockGfx.visible = !teaching;
    this.airText.visible = !teaching;
    if (!teaching) this.drawClock(state, low);

    // PRD FR-1.1: large, centre-top, always visible. Above the dial, because
    // the dial answers "roughly how much" at a glance and the number answers
    // "exactly how much" when the glance is not enough — and the exact figure
    // is the one a player reads in the last ten seconds.
    const seconds = state.air / 60;
    this.airText.text = seconds >= 10 ? seconds.toFixed(0) : seconds.toFixed(1);
    this.airText.style.fill = low
      ? COLOR.airLow
      : state.entered
        ? COLOR.hud
        : COLOR.playerDashing;
    this.airText.position.set(VIEW_W / 2, 6);

    this.drawDepth(state);
    this.drawTally(state);

    this.drawPotions(state);

    // NOTHING ON SCREEN SAYS "ADMIN".
    //
    // There was a line across the middle of the view for the whole of a
    // developer-mode run, on the argument that a run where nothing can kill you
    // and a run where things can look identical until you notice you have been
    // standing in spikes for a minute. That argument is real but it is a
    // developer's problem, and it was being solved on the one surface the game
    // is judged on — it sat over the dungeon in a recording, in a screenshot,
    // and in front of anybody being shown the game.
    //
    // Admin mode is still perfectly visible where it belongs: the toggle that
    // turned it on is in Settings, and the shop shows an admin purse. The view
    // itself keeps quiet.

    // The prompt eases in and out rather than appearing. Crossing the mouth
    // swaps one line for nothing at the same instant the light changes hands,
    // and a hard cut there is the one thing that makes the threshold read as a
    // UI state change instead of a place.
    //
    // A changed line fades the old one down before bringing the new one up:
    // cross-dissolving two different sentences on the same baseline is not
    // legible as either of them.
    const prompt = this.prompt(state);
    const settled = prompt?.text === this.promptShown?.text;
    const target = prompt && settled ? 1 : 0;
    const rate = this.frameDt / PROMPT_FADE;
    this.promptFade += Math.min(
      Math.max(target - this.promptFade, -rate),
      rate,
    );

    if (!settled && this.promptFade <= 0.02) {
      this.promptShown = prompt;
      if (prompt) {
        this.promptText.text = prompt.text;
        this.promptText.style.fill = prompt.colour;
      }
    }

    const shown = this.promptShown;
    this.promptText.visible = shown !== null && this.promptFade > 0.01;
    if (this.promptText.visible && shown) {
      this.promptText.position.set(VIEW_W / 2, 108);
      const base = shown.pulse ? 0.55 + 0.3 * Math.sin(state.tick / 14) : 0.95;
      this.promptText.alpha = base * this.promptFade;
    }
  }

  /**
   * The clock. Air, drawn as a dial rather than a bar.
   *
   * A horizontal bar draining left to right is a progress bar, and a progress
   * bar reads as something filling up. This reads as something running out —
   * the hand sweeps back towards twelve and the arc behind it shortens, which
   * is the one shape everybody already knows means "time left".
   *
   * The whole dial is one revolution of the run's own capacity, not of sixty
   * seconds. Air upgrades change how long a revolution takes; they must not
   * change what a full dial means.
   */
  private drawClock(state: SimState, low: boolean): void {
    const pct =
      state.airCapacity === 0
        ? 0
        : Math.min(Math.max(state.air / state.airCapacity, 0), 1);
    const cx = VIEW_W / 2;
    const cy = 96;
    const r = 52;
    const g = this.clockGfx;
    // Dimmed until the run starts. A full, bright dial outside the mouth reads
    // as a clock already ticking, which is the one thing that is not true yet.
    const live = state.entered ? 1 : 0.4;
    const face = low ? COLOR.airLow : COLOR.air;

    g.clear();
    g.circle(cx, cy, r + 7).fill({ color: 0x000000, alpha: 0.45 * live });
    g.circle(cx, cy, r + 7).stroke({
      width: 2,
      color: face,
      alpha: 0.28 * live,
    });

    // Twelve marks, longer at the quarters, so the sweep has something to be
    // measured against. Without them the arc is just a curved bar.
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
      const quarter = i % 3 === 0;
      const inner = r - (quarter ? 11 : 6);
      g.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner)
        .lineTo(cx + Math.cos(a) * (r - 1), cy + Math.sin(a) * (r - 1))
        .stroke({
          width: quarter ? 3 : 2,
          color: 0xffffff,
          alpha: (quarter ? 0.3 : 0.16) * live,
        });
    }

    // The air still in the tank, as an arc from twelve o'clock clockwise. The
    // track behind it stays visible: what you have spent is as much information
    // as what is left.
    const top = -Math.PI / 2;
    g.arc(cx, cy, r - 17, 0, Math.PI * 2).stroke({
      width: 7,
      color: 0xffffff,
      alpha: 0.07 * live,
    });
    if (pct > 0.0005) {
      g.arc(cx, cy, r - 17, top, top + Math.PI * 2 * pct).stroke({
        width: 7,
        color: face,
        alpha: 0.95 * live,
      });
    }

    // The hand, and a pip at the far end of it so the tip is findable at a
    // glance when the arc is nearly gone.
    const hand = top + Math.PI * 2 * pct;
    g.moveTo(cx, cy)
      .lineTo(cx + Math.cos(hand) * (r - 13), cy + Math.sin(hand) * (r - 13))
      .stroke({ width: 3, color: face, alpha: 0.95 * live });
    g.circle(
      cx + Math.cos(hand) * (r - 13),
      cy + Math.sin(hand) * (r - 13),
      3.2,
    ).fill({ color: face, alpha: 0.95 * live });
    g.circle(cx, cy, 4).fill({ color: face, alpha: 0.9 * live });
    g.circle(cx, cy, 1.8).fill({ color: 0x000000, alpha: 0.7 });

    // The last ten seconds pulse. The vignette is already closing in by then,
    // but the vignette is at the edges and the eye is on the middle.
    if (low && state.entered) {
      const beat = 0.5 + 0.5 * Math.sin(state.tick / 5);
      g.circle(cx, cy, r + 7).stroke({
        width: 3,
        color: COLOR.airLow,
        alpha: 0.25 + 0.45 * beat,
      });
    }
  }

  /**
   * Where you are in the dungeon, drawn against the dungeon.
   *
   * FR-2.3 used to be answered by the line `ENV 1/5  455m`, which tells you the
   * number but not the shape: it cannot say that the next boundary is close, or
   * that the walk back is now longer than the walk in. This is the map itself,
   * to scale — the whole five environments end to end, the mouth at the left,
   * and an arrow where you are standing.
   *
   * The bar is to scale across the dungeon you can WALK, not across the whole
   * five-environment design. Scaled to the design it was accurate and useless:
   * the built world is exactly one fifth of it, so the arrow spent the entire
   * game inside the first fifth of the bar and could never leave. The four
   * environments that do not exist get a hatched stub on the right instead —
   * enough to say the dungeon keeps going, not enough to eat the resolution
   * that the reachable part needs. The stub shrinks as environments ship.
   */
  private drawDepth(state: SimState): void {
    // Not in the tutorial. The bar maps the player onto the dungeon by clamping
    // their x between the start and `builtEnd`, and the hall is built past
    // `builtEnd` — so the marker pinned itself to the far right end and told a
    // player on their first ever thirty seconds that they had finished the
    // whole game.
    if (state.tutorial) return;
    this.depthText.visible = state.entered;
    const g = this.depthGfx;
    g.clear();
    if (!state.entered) return;

    const w = 480;
    const left = (VIEW_W - w) / 2;
    const y = 168;
    const h = 7;
    // How much of the bar the unbuilt tail gets, in proportion to how much of
    // the design is missing — but capped, so it can never crowd the real map.
    const missing = 1 - (builtEnd - dungeonStart) / (worldEnd - dungeonStart);
    const stub = Math.min(missing, 0.14) * w;
    const track = w - stub;
    const span = builtEnd - dungeonStart;
    const at = (x: number) =>
      left +
      (Math.min(Math.max(x, dungeonStart), builtEnd) - dungeonStart) *
        (track / span);

    g.rect(left, y, track, h).fill({ color: 0xffffff, alpha: 0.1 });
    // The tail: hatched, and fenced off from the real map by a hard edge, so it
    // reads as "not yet" rather than as more of the same corridor.
    if (stub > 0) {
      g.rect(left + track, y, stub, h).fill({ color: 0xffffff, alpha: 0.04 });
      for (let x = left + track + 3; x < left + w; x += 7) {
        g.rect(x, y, 2, h).fill({ color: 0xffffff, alpha: 0.07 });
      }
      g.rect(left + track - 1, y - 2, 2, h + 4).fill({
        color: 0xffffff,
        alpha: 0.22,
      });
    }

    // How deep this run has ever been. Distinct from where you are standing,
    // because walking back out does not un-earn the depth.
    g.rect(left, y, at(state.deepestX) - left, h).fill({
      color: COLOR.gem,
      alpha: 0.3,
    });

    // Environment boundaries, at their real positions. Only the ones inside the
    // world that exists — the rest are inside the stub and have no place there.
    for (let i = 1; i < tuning.budget.environmentCount; i++) {
      const bx = environmentStart(i);
      if (bx >= builtEnd) break;
      g.rect(at(bx) - 1, y - 3, 2, h + 6).fill({
        color: COLOR.boundary,
        alpha: 0.55,
      });
    }
    // The mouth. The left end of the bar is the way out, and in a game about
    // getting back it should be marked as a place rather than as an edge.
    g.rect(left - 2, y - 5, 3, h + 10).fill({ color: COLOR.air, alpha: 0.8 });

    // Shortcuts you have opened — the only marks on here you earned.
    for (const s of shortcuts) {
      if (!state.openShortcuts.includes(s.id)) continue;
      g.rect(at(s.fromX), y + 1, at(s.toX) - at(s.fromX), h - 2).fill({
        color: COLOR.doorOpen,
        alpha: 0.75,
      });
    }

    // You. An arrow above the bar, pointing down at the spot.
    const px = at(state.player.x);
    g.moveTo(px, y - 2)
      .lineTo(px - 6, y - 11)
      .lineTo(px + 6, y - 11)
      .fill(COLOR.hud);

    const depth = Math.max(0, Math.round(state.deepestX - dungeonStart));
    this.depthText.text = `${depth}m   ENV ${state.environment + 1}/${tuning.budget.environmentCount}`;
    this.depthText.position.set(left + w + 14, y - 5);
  }

  /**
   * The one line of text the player gets. Ordered by what would cost them the
   * run if they missed it: the clock first, then a lever they are standing on
   * and will never be this close to again.
   */
  /**
   * The line for the lesson currently being taught.
   *
   * Written as the problem rather than as the control where it can be. "THE GAP
   * IS TOO WIDE TO WALK" and "SPACE — JUMP IT" say the same thing, and only one
   * of them is still true the second time you meet a gap.
   *
   * Keys are named as the primary binding from `DEFAULT_BINDINGS`; the control
   * bar under the canvas carries the alternates.
   */
  private lesson(state: SimState): {
    text: string;
    colour: number;
    pulse: boolean;
  } | null {
    const t = state.tutorial;
    if (!t) return null;

    // Standing on a door beats whatever lesson is running.
    //
    // The stations are walls on purpose, so the thing a stuck player most needs
    // to be told is that the way out is right here — and they will only be
    // standing on it because they walked back to look for one.
    if (
      t.step !== "leave" &&
      t.step !== "done" &&
      [tutorialGeom.backX, tutorialGeom.doorX].some(
        (d) => Math.abs(state.player.x - d) <= interactReach,
      )
    ) {
      return { text: "E — LEAVE THE TUTORIAL", colour: COLOR.air, pulse: false };
    }
    const line: Record<string, [string, number]> = {
      walk: ["A AND D — WALK. GO RIGHT", COLOR.hud],
      jump: ["TOO WIDE TO WALK.  SPACE — JUMP IT", COLOR.hud],
      slide: ["TOO LOW TO CROUCH.  SHIFT WHILE MOVING — SLIDE", COLOR.hud],
      // The one lesson that is a correction rather than an introduction. Slide
      // and backstep are the SAME KEY and players read that as one move that
      // sometimes misbehaves, so this station says the rule outright instead of
      // naming the control: what changes it is whether you are moving.
      back: ["SAME KEY STANDING STILL — STEP BACK", COLOR.hud],
      wall: ["TOO DEEP TO JUMP.  INTO THE WALL, THEN JUMP", COLOR.hud],
      fight: ["Q — SWING.  IT IS SLOW AFTER ITS OWN", COLOR.playerAttacking],
      // Said as what it beats rather than as what it does, because "stun" is
      // the one move whose name does not tell you when to reach for it.
      stun: ["L — STUN. IT GOES THROUGH A GUARD", COLOR.playerAttacking],
      smash: ["S IN THE AIR — DIVE. IT HITS BOTH SIDES", COLOR.playerAttacking],
      parry: ["R — BLOCK ON THE ARROW. IT GOES BACK", COLOR.lever],
      dive: ["S — DIVE.  THE BUBBLES ARE YOUR BREATH", COLOR.air],
      loot: ["E — OPEN IT. GEMS ARE THE WHOLE POINT", COLOR.lever],
      shop: ["THAT IS YOURS ONLY IF YOU WALK OUT  →", COLOR.air],
      leave: ["E — LEAVE. SPEND IT IN THE SHOP", COLOR.air],
      done: ["THAT IS THE GAME. GO DOWN", COLOR.air],
    };
    const found = line[t.step];
    if (!found) return null;
    // Pulses for the first few seconds of a lesson and then settles, so a
    // player who is reading is not being flashed at the whole time.
    return { text: found[0], colour: found[1], pulse: t.ticks < 60 * 4 };
  }

  private prompt(
    state: SimState,
  ): { text: string; colour: number; pulse: boolean } | null {
    // The tutorial owns the line outright.
    //
    // Ahead of everything, including the air clock, because in the hall the
    // clock is switched off and the lesson is the only thing on screen worth
    // reading. This is also why the steps live on `SimState` rather than in
    // React: the one line of teaching the game has is drawn from the same
    // state the rules are decided from, so it cannot drift out of step with
    // what the hall will actually let you do.
    if (state.tutorial) return this.lesson(state);

    // Outside, say plainly that the clock has not started. The threshold is
    // the decision; it should not be something the player discovers by dying.
    if (!state.entered) {
      return {
        text: "THE AIR ONLY BURNS INSIDE  →",
        colour: COLOR.air,
        pulse: true,
      };
    }

    const x = state.player.x;
    const p = state.player;

    // Down a shaft, before anything else. It is the only place in the dungeon
    // where the way out is a verb the player may not know they have, and the
    // spikes are counting — a mechanic introduced by a hole you die in is a
    // mechanic nobody learns, they just stop falling in holes.
    if (p.y > tuning.room.floorY + 90) {
      return p.stance === "clinging"
        ? {
            text: "W — KICK OFF IT. AGAIN AT THE TOP",
            colour: COLOR.air,
            pulse: true,
          }
        : {
            text: "HOLD INTO THE WALL TO CATCH IT",
            colour: COLOR.airLow,
            pulse: true,
          };
    }

    if (Math.abs(x - exitX) <= 150) {
      return { text: "THE WAY OUT — WALK ON", colour: COLOR.air, pulse: false };
    }

    // The chamber's doors, in and out. None of the three had a prompt, and a
    // door with no prompt is a dark rectangle on a wall: the player stands in
    // the boss room pressing every key they have, concludes there is no way
    // out, and they are right for all practical purposes.
    if (inChamber(x)) {
      const clear = !state.enemies.some(
        (e) => isLock(e.kind) && e.phase !== "dead",
      );
      if (Math.abs(x - chamber.outX) <= interactReach) {
        return clear
          ? {
              text: "E — OUT, AND BANK THE RUN",
              colour: COLOR.air,
              pulse: false,
            }
          : {
              text: "SEALED WHILE IT STANDS",
              colour: COLOR.airLow,
              pulse: false,
            };
      }
      if (Math.abs(x - chamber.backX) <= interactReach) {
        return clear
          ? {
              text: "E — BACK THE WAY YOU CAME",
              colour: COLOR.hud,
              pulse: false,
            }
          : {
              text: "IT SHUT BEHIND YOU",
              colour: COLOR.airLow,
              pulse: false,
            };
      }
    } else if (Math.abs(x - chamber.doorX) <= interactReach) {
      // Said from OUTSIDE, before the decision is taken. This is the only door
      // in the game you cannot walk back out of, and a player has to know that
      // while they still have the choice.
      return {
        text: "E — GO IN. IT SHUTS BEHIND YOU",
        colour: COLOR.lavaHot,
        pulse: true,
      };
    }

    // A shaft. Said as what it COSTS rather than as what it does, because the
    // cost is the whole decision: everything in the bag is banked, and the run
    // is over. A prompt reading "E — ESCAPE" would get pressed by somebody
    // meaning to open a chest, and the run they lose would be the good one.
    if (escapeAt(x) !== null) {
      return {
        text: "E — CLIMB OUT AND BANK THE RUN",
        colour: COLOR.air,
        pulse: false,
      };
    }

    // A chest first, because it is the thing that is about to disappear: walk
    // four steps on and the prompt is gone along with the reason to stop.
    for (const c of state.chests) {
      if (c.opened || Math.abs(x - c.x) > interactReach) continue;
      // Vertically too — the sim will not open one from below, so a prompt
      // that appeared down there would be a lie about what E does.
      if (Math.abs(state.player.y - c.y) > 52) continue;
      return { text: "E — OPEN THE CHEST", colour: COLOR.lever, pulse: true };
    }

    for (const s of shortcuts) {
      const open = state.openShortcuts.includes(s.id);

      if (Math.abs(x - s.leverX) <= interactReach && !open) {
        return {
          text: "E — FLICK THE LEVER",
          colour: COLOR.lever,
          pulse: true,
        };
      }
      // The chute is not a door and must not claim to be one. Open, there is
      // no button to press — the hole in the floor takes you whether you meant
      // it or not, and a prompt offering E would be a lie about the control.
      // Its far end is a landing, not a mouth: a slide cannot be ridden back
      // up, so nothing is offered there at all.
      if (s.id === chuteId) {
        if (open || Math.abs(x - s.fromX) > interactReach) continue;
        return {
          text: "SEALED — ITS LEVER LIES DEEPER IN",
          colour: COLOR.airLow,
          pulse: false,
        };
      }

      // The geyser chain, for the same reason: open, there is no button — you
      // stand on a vent and it throws you. Sealed, it says so, because being
      // able to see the shortcut you have not earned is FR-3.1.
      if (s.id === geyserId) {
        if (!geyserVents.some((v) => Math.abs(x - v) <= MOVE_VENT.geyserRadius))
          continue;
        return open
          ? { text: "STAND ON IT AND WAIT", colour: COLOR.lava, pulse: false }
          : {
              text: "SEALED — ITS LEVER LIES DEEPER IN",
              colour: COLOR.airLow,
              pulse: false,
            };
      }

      const atDoor =
        Math.abs(x - s.fromX) <= interactReach ||
        Math.abs(x - s.toX) <= interactReach;
      if (!atDoor) continue;

      return open
        ? {
            text: "E — TAKE THE SHORTCUT",
            colour: COLOR.doorOpen,
            pulse: false,
          }
        : {
            // FR-3.5 said plainly, at the moment it costs something. Knowing
            // the door is here is exactly what confers nothing.
            text: "SEALED — ITS LEVER LIES DEEPER IN",
            colour: COLOR.airLow,
            pulse: false,
          };
    }

    return null;
  }

  /**
   * A crescent slash sweeping through its arc. Drawn as a stack of strokes at
   * decreasing radius so it reads as a blade trail rather than a shape — the
   * leading edge is bright and the tail falls away.
   *
   * The two swings get genuinely different arcs. The sprites already differ,
   * but the slash is the loudest thing on screen, so if it does not change the
   * whole attack reads as a repeat.
   */
  private drawSlash(
    x: number,
    y: number,
    facing: 1 | -1,
    progress: number,
    variant: 0 | 1,
  ): void {
    const reach = tuning.player.attackReach;

    // A: a horizontal slash — flattened almost to a straight line and driven
    //    forward, so it reads as cutting ACROSS rather than chopping down.
    // B: a rising sweep — wide, tall, travelling up from low.
    // `flatten` squashes the arc vertically, which is what separates a level
    // cut from a swing; without it every arc looks like the same crescent.
    const shape =
      variant === 0
        ? {
            from: -0.5 + progress * 0.45,
            spread: 1.0,
            radius: reach * 1.15,
            flatten: 0.32,
            lift: 0,
            core: 0xfff3c4,
            mid: 0xf4d59a,
            tail: COLOR.swing,
            layers: 6,
          }
        : {
            // Descending. Starts above the shoulder and sweeps DOWN through
            // the target — the opposite direction of travel to A's level cut,
            // which is what stops the pair reading as one move at speed.
            from: -1.35 + progress * 1.9,
            spread: 1.6,
            radius: reach * 1.22,
            flatten: 1,
            lift: -6,
            core: 0xffffff,
            mid: 0xd6e6f2,
            tail: 0x8fb3c9,
            layers: 7,
          };

    const point = (a: number, r: number) => ({
      x: x + Math.cos(a) * r * facing,
      y: y + Math.sin(a) * r * shape.flatten + shape.lift,
    });

    // A wash under the arc, so the swing throws light rather than being a set
    // of lines laid on top of the scene. The cave is dark enough that this is
    // most of what makes a hit feel like it landed.
    const mid = point(shape.from + shape.spread * 0.5, shape.radius * 0.8);
    this.playerGfx.circle(mid.x, mid.y, reach * (0.85 - progress * 0.3)).fill({
      color: shape.core,
      alpha: 0.1 * (1 - progress),
    });

    for (let layer = 0; layer < shape.layers; layer++) {
      const r = shape.radius * (1 - layer * 0.1);
      const alpha = (0.95 - layer * 0.13) * (1 - progress * 0.3);
      const width = 9 - layer * 1.2;
      const colour =
        layer === 0 ? shape.core : layer === 1 ? shape.mid : shape.tail;

      const steps = 14;
      for (let i = 0; i <= steps; i++) {
        const p = point(shape.from + (shape.spread * i) / steps, r);
        if (i === 0) this.playerGfx.moveTo(p.x, p.y);
        else this.playerGfx.lineTo(p.x, p.y);
      }
      this.playerGfx.stroke({ width, color: colour, alpha });
    }

    // The leading edge: a bright point running ahead of the arc, which is what
    // gives the swing a direction rather than just a shape.
    const tip = point(shape.from + shape.spread, shape.radius);
    this.playerGfx
      .circle(tip.x, tip.y, 9 * (1 - progress * 0.5))
      .fill({ color: 0xffffff, alpha: 0.75 * (1 - progress) });
    this.playerGfx
      .circle(tip.x, tip.y, 20 * (1 - progress * 0.4))
      .fill({ color: shape.core, alpha: 0.22 * (1 - progress) });

    // And a few sparks thrown off it, spaced along the arc.
    for (let i = 0; i < 5; i++) {
      const f = i / 5;
      const sp = point(
        shape.from + shape.spread * (0.55 + f * 0.5),
        shape.radius * (1.02 + f * 0.16),
      );
      this.playerGfx
        .circle(sp.x, sp.y, (3.4 - f * 2) * (1 - progress))
        .fill({ color: shape.mid, alpha: 0.7 * (1 - progress) });
    }
  }

  /**
   * One floating readout: an icon and a count, rising off the chest.
   *
   * Stacked rather than overlapped when a chest pays both — gems and gold are
   * different currencies and a single merged line would read as one number.
   */
  private addPickup(
    x: number,
    y: number,
    frame: number,
    text: string,
    colour: number,
  ): void {
    const label = new Text({
      text,
      style: new TextStyle({
        fontFamily: "ui-monospace, Menlo, Consolas, monospace",
        fontSize: 17,
        fontWeight: "700",
        fill: colour,
        stroke: { color: 0x000000, width: 4 },
      }),
    });
    label.anchor.set(0, 0.5);
    this.world.addChild(label);

    let icon: Sprite | null = null;
    const art = this.art.frame("prop.loot", frame);
    if (art) {
      icon = new Sprite(art);
      icon.anchor.set(1, 0.5);
      this.world.addChild(icon);
    }

    // Stack under anything already rising off this chest.
    const stacked = this.pickups.filter((p) => Math.abs(p.x - x) < 8).length;
    this.pickups.push({ x, y: y - stacked * 24, age: 0, label, icon });
  }

  /** Rise, hold, then fade. Wall-clock, because it is a notification. */
  private stepPickups(dt: number): void {
    const LIFE = 1.6;
    this.pickups = this.pickups.filter((p) => {
      p.age += dt;
      if (p.age >= LIFE) {
        p.label.destroy();
        p.icon?.destroy();
        return false;
      }
      const t = p.age / LIFE;
      const rise = 26 * (1 - (1 - t) * (1 - t));
      const alpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
      p.label.position.set(p.x + 4, p.y - rise);
      p.label.alpha = alpha;
      if (p.icon) {
        p.icon.position.set(p.x - 1, p.y - rise);
        p.icon.alpha = alpha;
      }
      return true;
    });
  }

  /**
   * The guard-breaker, drawn across its whole length rather than only while
   * the hitbox is live.
   *
   * Two things have to be true at once. It must be legible as a WIND-UP for
   * the full 0.3s of startup, because that is the longest tell the player
   * commits to and the goblin gets every tick of it for free. And it must not
   * look like an edge: the payoff of this move is the opening, not the wound,
   * so it draws as gathered force and a blunt shove rather than as a crescent.
   */
  private drawStunStrike(
    x: number,
    y: number,
    facing: 1 | -1,
    elapsed: number,
  ): void {
    const g = this.playerGfx;
    const { stunReach, stunStartup, stunActive, stunRecovery } = tuning.player;

    if (elapsed < stunStartup) {
      // Force gathering at the fist. It draws INWARD as the wind-up completes,
      // the opposite motion to a slash's arc opening out — which is what keeps
      // the two tellable apart at a glance rather than by colour alone.
      const t = elapsed / stunStartup;
      for (let i = 0; i < 3; i++) {
        const r = (27 - i * 6) * (1.2 - t * 0.8);
        const cx = x + facing * (9 + i * 3);
        g.moveTo(cx + facing * r * 0.25, y - r * 0.62);
        g.quadraticCurveTo(
          cx + facing * r,
          y,
          cx + facing * r * 0.25,
          y + r * 0.62,
        );
        g.stroke({
          width: 2.6 - i * 0.5,
          color: COLOR.stunCharge,
          alpha: (0.12 + t * t * 0.55) * (1 - i * 0.22),
        });
      }
      return;
    }

    // The drive. A bar out to the full reach and rings off the end of it, so
    // the one thing this move has over the sword — that it lands from further
    // away — is the thing the effect is loudest about.
    const span = Math.max(stunActive + stunRecovery * 0.6, 1);
    const t = Math.min((elapsed - stunStartup) / span, 1);
    const fade = (1 - t) * (1 - t);
    const tipX = x + facing * stunReach;

    g.moveTo(x + facing * 8, y)
      .lineTo(tipX, y)
      .stroke({
        width: 14 * (1 - t * 0.6),
        color: COLOR.stunCharge,
        alpha: 0.5 * fade,
      });
    g.moveTo(x + facing * 8, y)
      .lineTo(tipX + facing * 5, y)
      .stroke({
        width: 5 * (1 - t * 0.5),
        color: COLOR.stunCore,
        alpha: 0.95 * fade,
      });

    for (let i = 0; i < 3; i++) {
      g.circle(tipX, y, 7 + t * 44 + i * 10).stroke({
        width: 3 - i,
        color: i === 0 ? COLOR.stunCore : COLOR.stunCharge,
        alpha: 0.6 * fade * (1 - i * 0.3),
      });
    }
  }

  /**
   * A wash over the whole view.
   *
   * Offset by the camera because `fxGfx` lives in the world container, not on
   * the stage — a rect at world 0 covers the screen only while the camera is
   * still clamped at the mouth, and stops covering anything the moment the
   * player is far enough in for the camera to have moved. Which is most of the
   * dungeon, and exactly where getting hit matters more.
   */
  private flashScale = 1;

  private flashScreen(colour: number, alpha: number): void {
    this.fxGfx
      .rect(this.cameraX, 0, VIEW_W, VIEW_H)
      .fill({ color: colour, alpha: alpha * this.flashScale });
  }

  /**
   * Arrows in flight.
   *
   * A returned one is drawn hot and trailing, because a parried arrow is the
   * single best thing that can happen in a fight and the game should say so
   * before it has even connected.
   */
  private drawArrows(state: SimState): void {
    const g = this.fxGfx;
    for (const a of state.arrows) {
      if (a.kind === "fireball") {
        // A fireball is not an arrow with a different colour on it, and it must
        // not look like one: an arrow can be sent back and this cannot, so the
        // two have to be told apart at a glance or the player learns the wrong
        // reflex. No point, no shaft, no direction — a tumbling ball with a
        // tail of smoke behind it.
        const speed = Math.max(Math.hypot(a.vx, a.vy), 0.001);
        const bx = -a.vx / speed;
        const by = -a.vy / speed;
        for (let k = 5; k >= 1; k--) {
          const j = Renderer.noise(a.id * 17 + k * 29);
          g.circle(
            a.x + bx * k * 11 + (j - 0.5) * 7,
            a.y + by * k * 11 + (j - 0.5) * 7,
            9 - k * 1.3,
          ).fill({ color: COLOR.emberSmoke, alpha: 0.5 - k * 0.06 });
        }
        g.circle(a.x, a.y, 13).fill({ color: COLOR.lava, alpha: 0.32 });
        g.circle(a.x, a.y, 8).fill(COLOR.lava);
        g.circle(a.x - a.vx * 0.25, a.y - a.vy * 0.25, 4).fill(COLOR.lavaHot);
        continue;
      }
      const hot = a.returned;
      // Long. A short arrow at this speed is a dash on the screen — the
      // length is what makes it read as a thing travelling rather than a
      // flicker between two frames.
      const len = hot ? 44 : 36;
      // Along its own velocity, because arrows are aimed now — one loosed down
      // from a ledge is travelling diagonally and drawing it flat would be
      // drawing a different arrow from the one that hits you.
      const speed = Math.max(Math.hypot(a.vx, a.vy), 0.001);
      const ux = a.vx / speed;
      const uy = a.vy / speed;
      // Perpendicular, for the head and the fletching.
      const px = -uy;
      const py = ux;

      const tailX = a.x - ux * len;
      const tailY = a.y - uy * len;

      g.moveTo(tailX, tailY)
        .lineTo(a.x, a.y)
        .stroke({
          width: hot ? 3 : 2,
          color: hot ? COLOR.parryFlash : COLOR.ladderRung,
        });
      g.moveTo(a.x + ux * 7, a.y + uy * 7)
        .lineTo(a.x + px * 4, a.y + py * 4)
        .lineTo(a.x - px * 4, a.y - py * 4)
        .fill(hot ? COLOR.legendary : COLOR.spikeTip);
      g.moveTo(tailX, tailY)
        .lineTo(tailX + ux * 6 + px * 4, tailY + uy * 6 + py * 4)
        .lineTo(tailX + ux * 6 - px * 4, tailY + uy * 6 - py * 4)
        .fill({ color: hot ? COLOR.legendary : COLOR.grit, alpha: 0.9 });
      // The trail: three streaks of falling width and alpha behind the shaft,
      // so the arrow drags light rather than sliding as a static shape. The
      // returned one drags gold, because a parried arrow is the best thing that
      // can happen in a fight and it should be the brightest thing on screen.
      for (let i = 1; i <= 3; i++) {
        const back = len + i * 22;
        g.moveTo(a.x - ux * back, a.y - uy * back)
          .lineTo(a.x - ux * (back - 22), a.y - uy * (back - 22))
          .stroke({
            width: (hot ? 7 : 4) / i,
            color: hot ? COLOR.legendary : COLOR.spikeTip,
            alpha: (hot ? 0.4 : 0.22) / i,
          });
      }
      // And a glow at the head, which is the part that matters to read.
      g.circle(a.x + ux * 4, a.y + uy * 4, hot ? 13 : 8).fill({
        color: hot ? COLOR.legendary : COLOR.stunCharge,
        alpha: hot ? 0.3 : 0.16,
      });
    }
  }

  private drawFx(state: SimState): void {
    this.fxGfx.clear();
    for (const event of state.events) {
      if (event.type === "parry") {
        // The parry has to feel like the best thing that can happen to you.
        this.fxGfx
          .circle(event.x, event.y, 46)
          .fill({ color: COLOR.parryFlash, alpha: 0.5 });
        this.fxGfx
          .circle(event.x, event.y, 74)
          .fill({ color: COLOR.enemyStaggered, alpha: 0.22 });
      } else if (event.type === "enemyHit") {
        // A stun lands on the same event as a sword hit but must not look like
        // one — the player needs to know the guard broke, not that they scored
        // eight damage. Concussion rings rather than a wound flash.
        if (state.player.action.kind === "stun") {
          for (let i = 0; i < 3; i++) {
            this.fxGfx.circle(event.x, event.y, 16 + i * 15).stroke({
              width: 4 - i,
              color: i === 0 ? COLOR.stunCore : COLOR.stunCharge,
              alpha: 0.7 - i * 0.2,
            });
          }
        } else {
          this.fxGfx
            .circle(event.x, event.y, 22)
            .fill({ color: COLOR.enemyStriking, alpha: 0.45 });
        }
      } else if (event.type === "chestOpened") {
        // A legendary lights the room. Nothing else in the dungeon does, so it
        // cannot be mistaken for anything else that might be happening.
        const colour = event.legendary ? COLOR.legendary : COLOR.gem;
        this.fxGfx
          .circle(event.x, event.y - 18, event.legendary ? 92 : 40)
          .fill({ color: colour, alpha: event.legendary ? 0.3 : 0.18 });
        if (event.legendary) this.flashScreen(COLOR.legendary, 0.08);
      } else if (event.type === "playerHit") {
        this.flashScreen(COLOR.enemyStriking, 0.14);
      } else if (event.type === "arrowReturned") {
        // The parry already flashes; this is the arrow itself turning over.
        this.fxGfx
          .circle(event.x, event.y, 34)
          .fill({ color: COLOR.legendary, alpha: 0.4 });
        this.particles.parry(event.x, event.y, 1);
      }
    }

    this.drawArrows(state);
  }

  /**
   * Health, in bars.
   *
   * A goblin's swing takes exactly one, so the question the player is actually
   * asking mid-fight — how many more of those can I take — is answered by
   * counting rather than by reading a length. A continuous bar makes that a
   * judgement about a fraction, which is not a judgement anyone makes with two
   * goblins closing and eight seconds of air left.
   *
   * The last bar drains continuously, because things that are not goblins do
   * not deal whole bars and pretending otherwise would hide damage.
   */
  private drawHealth(state: SimState): void {
    // Nothing to report before the run starts. Outside the mouth the player is
    // at full health by definition, so the bars said nothing — and they were
    // the one piece of HUD still painting behind the lobby and the shop.
    this.healthBar.visible = state.entered;
    if (!state.entered) {
      this.healthBar.clear();
      return;
    }
    const bars = tuning.player.healthBars;
    const perBar = tuning.player.maxHp / bars;
    const hp = Math.max(state.player.hp, 0);
    const w = 20;
    const h = 11;
    const gap = 3;

    this.healthBar.clear();
    for (let i = 0; i < bars; i++) {
      const x = 24 + i * (w + gap);
      const fill = Math.min(Math.max(hp - i * perBar, 0) / perBar, 1);
      // The empty socket stays visible: a bar you have lost is information.
      this.healthBar.rect(x, 24, w, h).fill({ color: 0x000000, alpha: 0.55 });
      this.healthBar
        .rect(x, 24, w, h)
        .stroke({ width: 1, color: 0xffffff, alpha: 0.14 });
      if (fill <= 0) continue;
      // Red for the last two, so "nearly out" reads without counting.
      const colour =
        i < 2
          ? COLOR.enemyStriking
          : i < 4
            ? COLOR.trapTell
            : COLOR.enemyStaggered;
      this.healthBar.rect(x + 1, 25, (w - 2) * fill, h - 2).fill(colour);
      this.healthBar
        .rect(x + 1, 25, (w - 2) * fill, 2)
        .fill({ color: 0xffffff, alpha: 0.22 });
    }
  }

  /**
   * What the run is carrying, in the top right corner.
   *
   * FR-22.2 wants gems and depth answerable at any moment, and the old single
   * line — `GEMS 7  GOLD 3` — answered the wrong question. Gems are not one
   * currency: five grades are five separate things, a bag of grade-1 is not a
   * grade-4, and a total collapses exactly the distinction the extraction
   * decision turns on. So it is a row: the stone, then how many of it, in
   * ascending order left to right, and gold on its own line above because gold
   * is not a gem and must never be read as the sixth grade.
   *
   * Grades you are not carrying stay in the row, dimmed. The empty socket is
   * information — it says the deep stones exist and you have none of them.
   */
  private drawTally(state: SimState): void {
    this.tally.visible = state.entered;
    if (!state.entered) return;
    this.buildTally();

    const grades = tuning.loot.grades;
    const right = VIEW_W - 24;
    const cell = 52;
    const rowW = grades * cell;
    const left = right - rowW;

    this.tallyGfx.clear();
    this.tallyGfx
      .roundRect(left - 12, 16, rowW + 24, 66, 6)
      .fill({ color: 0x000000, alpha: 0.42 });

    // Gold, above. Its own line, its own colour, a coin rather than a stone.
    // The coin is placed off the number's measured width rather than at a fixed
    // offset, so the pair stays a pair whether the count is 0 or 140.
    if (this.goldText) {
      this.goldText.text = `${state.carried.gold}`;
      this.goldText.position.set(right, 24);
      this.goldIcon?.position.set(right - this.goldText.width - 8, 22);
    }

    for (let g = 0; g < this.gemCells.length; g++) {
      const c = this.gemCells[g];
      const n = state.carried.gems[g] ?? 0;
      const x = left + g * cell;
      if (c.icon) {
        c.icon.position.set(x + 2, 62);
        c.icon.alpha = n > 0 ? 1 : 0.28;
      }
      c.text.text = `${n}`;
      c.text.position.set(x + 26, 62);
      c.text.alpha = n > 0 ? 1 : 0.3;
    }

    // A legendary is not a grade and gets no cell — it is a flag on the run,
    // and it belongs where it cannot be mistaken for a count of stones.
    const legendary = state.carried.legendaries;
    if (legendary > 0) {
      this.tallyGfx
        .roundRect(left - 12, 84, 10 + legendary * 12, 12, 3)
        .fill({ color: COLOR.legendary, alpha: 0.85 });
    }
  }

  /**
   * The potions still unspent, bottom left, under the health.
   *
   * Only drawn when there are any. A player who bought none should not be shown
   * three empty sockets and left wondering what they are missing — and a player
   * who bought one needs to know, at a glance and mid-fight, whether they have
   * already drunk it.
   */
  private drawPotions(state: SimState): void {
    const g = this.potionGfx;
    g.clear();
    if (!state.entered) return;

    const held = SHOP.filter(
      (i) => i.potion && (state.loadout.levels[i.id] ?? 0) > 0,
    ).map((i) => i.id);
    if (held.length === 0) return;

    const y = 44;
    held.forEach((id: string, i: number) => {
      const item = SHOP.find((s) => s.id === id)!;
      const spent = !state.potions.includes(item.potion!);
      const x = 24 + i * 30;

      g.roundRect(x, y, 24, 24, 5).fill({
        color: 0x000000,
        alpha: spent ? 0.3 : 0.55,
      });
      g.roundRect(x, y, 24, 24, 5).stroke({
        width: 2,
        color: POTION_TINT[item.potion!] ?? COLOR.hud,
        alpha: spent ? 0.18 : 0.9,
      });
      // A flask shape, not a square of colour — the shop showed them as
      // bottles and the HUD has to be recognisably the same object.
      g.circle(x + 12, y + 15, 6).fill({
        color: POTION_TINT[item.potion!] ?? COLOR.hud,
        alpha: spent ? 0.15 : 1,
      });
      g.rect(x + 10, y + 4, 4, 6).fill({
        color: POTION_TINT[item.potion!] ?? COLOR.hud,
        alpha: spent ? 0.15 : 0.8,
      });
      // The key that spends it. The ward has none — it spends itself.
      if (!spent && item.potion !== "ward") {
        g.rect(x + 17, y + 17, 7, 7).fill({ color: 0x000000, alpha: 0.7 });
      }
    });
  }

  /** One-time construction of the tally's sprites, once the sheet has loaded. */
  private buildTally(): void {
    if (this.goldText) return;

    const digits = (fill: number, size: number) =>
      new Text({
        text: "0",
        style: new TextStyle({
          fontFamily: "ui-monospace, Menlo, Consolas, monospace",
          fontSize: size,
          fontWeight: "700",
          fill,
          letterSpacing: 1,
        }),
      });

    this.goldText = digits(COLOR.legendary, 17);
    this.goldText.anchor.set(1, 0);
    this.tally.addChild(this.goldText);

    const coin = this.art.frame("prop.loot", COIN_FRAME);
    if (coin) {
      this.goldIcon = new Sprite(coin);
      this.goldIcon.anchor.set(1, 0);
      this.tally.addChild(this.goldIcon);
    }

    for (let g = 0; g < tuning.loot.grades; g++) {
      const art = this.art.frame("prop.loot", g);
      let icon: Sprite | null = null;
      if (art) {
        icon = new Sprite(art);
        icon.anchor.set(0, 0.5);
        this.tally.addChild(icon);
      }
      const text = digits(GEM_COLOUR[g] ?? COLOR.gem, 15);
      text.anchor.set(0, 0.5);
      this.tally.addChild(text);
      this.gemCells.push({ icon, text });
    }
  }

  /**
   * The pet, if one is out.
   *
   * VIEW-ONLY, and that is a deliberate architectural choice rather than a
   * shortcut. A pet changes nothing about the run — FR-13 says the cosmetics
   * shelf buys no advantage — so putting it in `SimState` would add physics,
   * replay surface and a desync risk in exchange for nothing. Here it cannot
   * affect a single thing the simulation decides, which is exactly the
   * guarantee the shelf is selling.
   *
   * It follows at a lag, falls under the same gravity, lands on the same
   * terrain the player does, and hops when it is left behind. The lag IS the
   * character: a pet welded to your shoulder is a hat.
   */
  private drawPet(state: SimState, px: number, py: number, dt: number): void {
    const id = state.loadout.pet;
    if (!id || !state.entered) {
      if (this.petSprite) this.petSprite.visible = false;
      this.petSettled = false;
      return;
    }
    const which = id.split(".")[1];

    // A moth does not walk. Which pets fly lives here rather than on the shop
    // item, because flight is entirely a drawing decision — the simulation does
    // not know pets exist at all, so nothing outside this file has an opinion.
    const flies = which === "moth";

    // Dropped in beside the player the first time it appears, rather than
    // arriving from wherever the last run left it.
    if (!this.petSettled) {
      this.pet = {
        x: px - 46,
        y: flies ? py - tuning.player.height : py,
        vy: 0,
        hop: 0,
        step: 0,
      };
      this.petSettled = true;
    }

    const pet = this.pet;
    const follow = px - 46 * state.player.facing;
    const gap = follow - pet.x;

    // Chase, capped. A pet that could teleport to you would never look like it
    // was trying, and one that could not keep up would be lost on the first
    // sprint.
    const speed = Math.min(
      Math.abs(gap) * (flies ? 0.06 : 0.09),
      flies ? 7 : 9,
    );
    if (Math.abs(gap) > 6) pet.x += Math.sign(gap) * speed;

    let airborne: boolean;
    if (flies) {
      // No gravity, no ground, no hopping. It eases toward a point beside the
      // player's shoulder and bobs on the way, which is the entire difference
      // between a moth and a dog wearing wings.
      //
      // Deliberately NOT clamped to the terrain: a moth drifting straight over
      // a spike pit is the point of owning one. It is drawn, not simulated, so
      // there is nothing for it to collide with.
      const hover =
        py -
        tuning.player.height -
        24 +
        Math.sin(state.tick / 24) * 8 +
        Math.sin(state.tick / 9) * 2;
      pet.y += (hover - pet.y) * Math.min(1, dt * 3.2);
      pet.vy = 0;
      airborne = true;
      // Always flapping, whether or not it is going anywhere.
      pet.step += dt * 11;
    } else {
      // Its own gravity, against the real terrain.
      const floor = groundUnder(pet.x, tuning.room.floorY - 200);
      pet.vy = Math.min(pet.vy + 0.55, 16);
      pet.y += pet.vy;
      if (pet.y >= floor) {
        pet.y = floor;
        pet.vy = 0;
        // Hop when it is falling behind, or when the ground ahead is higher —
        // which is what makes it look like it is following rather than sliding.
        const ahead = groundUnder(
          pet.x + 26 * Math.sign(gap || 1),
          tuning.room.floorY - 200,
        );
        const climbing = ahead < floor - 6;
        if (Math.abs(gap) > 90 || climbing) pet.vy = -9.5;
      }
      airborne = pet.y < floor - 1;
      if (Math.abs(gap) > 6) pet.step += dt * 9;
    }
    pet.hop = airborne ? 1 : 0;

    // A flier has no standing pose: the wingbeat IS the idle, and the jump
    // frame is the hard upstroke it uses to climb.
    const climbingHard = flies && pet.y > py - tuning.player.height - 8;
    const key = flies
      ? climbingHard
        ? (`pet.${which}.jump` as SpriteKey)
        : (`pet.${which}.walk` as SpriteKey)
      : airborne
        ? (`pet.${which}.jump` as SpriteKey)
        : Math.abs(gap) > 6
          ? (`pet.${which}.walk` as SpriteKey)
          : (`pet.${which}.idle` as SpriteKey);
    const art =
      this.art.frameAtTick(key, Math.floor(pet.step * 4) + state.tick) ??
      this.art.frame(`pet.${which}.idle` as SpriteKey);
    if (!art) return;

    if (!this.petSprite) {
      this.petSprite = new Sprite();
      this.petSprite.anchor.set(0.5, 1);
      this.world.addChild(this.petSprite);
    }
    this.petSprite.visible = true;
    this.petSprite.texture = art;
    this.petSprite.position.set(Math.round(pet.x), Math.round(pet.y));
    this.petSprite.scale.x = gap >= 0 ? 1 : -1;
  }

  private drawVignette(state: SimState): void {
    // PRD FR-1.2: the corners darken progressively inward over the last ten
    // seconds. Diegetic hypoxia rather than a UI overlay.
    this.vignette.clear();
    if (state.air > VIGNETTE_TICKS) return;

    const closeness = 1 - state.air / VIGNETTE_TICKS;
    const maxInset = 260;
    const inset = maxInset * closeness;
    const steps = 14;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const band = (inset / steps) * (i + 1);
      this.vignette
        .rect(0, 0, VIEW_W, band)
        .rect(0, 720 - band, VIEW_W, band)
        .rect(0, 0, band, 720)
        .rect(VIEW_W - band, 0, band, 720)
        .fill({ color: 0x000000, alpha: 0.06 * (1 - t) });
    }
  }

  destroy(): void {
    this.app.destroy(true, { children: true });
  }
}
