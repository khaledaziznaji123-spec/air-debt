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
  TilingSprite,
} from "pixi.js";
import { tuning } from "../config/tuning.ts";
import { playerHitbox, type SimState } from "../sim/index.ts";
import { SpriteSet } from "./sprites.ts";
import { Particles } from "./particles.ts";

const COLOR = {
  sky: 0x0b0e14,
  floor: 0x1d2432,
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
} as const;

/** The last ten seconds, when the vignette starts closing in (PRD FR-1.2). */
const VIGNETTE_TICKS = 10 * 60;

export class Renderer {
  private app: Application;
  private world = new Container();
  private playerGfx = new Graphics();
  private enemyGfx = new Graphics();
  private fxGfx = new Graphics();
  private floorGfx = new Graphics();
  private vignette = new Graphics();
  private airBar = new Graphics();
  private healthBar = new Graphics();
  private airText: Text;
  private debugText: Text;
  private debug = false;
  private art: SpriteSet;
  /** One sprite per enemy, reused across ticks rather than rebuilt. */
  private enemySprites: Sprite[] = [];
  private playerSprite: Sprite | null = null;
  private floorTile: TilingSprite | null = null;
  private particles = new Particles();
  private lastDrawMs = 0;

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

    this.debugText = new Text({
      text: "",
      style: new TextStyle({
        fontFamily: "ui-monospace, Menlo, Consolas, monospace",
        fontSize: 13,
        fill: 0x8a94a6,
      }),
    });

    this.world.addChild(
      this.floorGfx,
      this.enemyGfx,
      this.playerGfx,
      this.fxGfx,
      this.particles.gfx,
    );
    this.app.stage.addChild(
      this.world,
      this.vignette,
      this.airBar,
      this.healthBar,
      this.airText,
      this.debugText,
    );
  }

  static async create(canvas: HTMLCanvasElement): Promise<Renderer> {
    const app = new Application();
    await app.init({
      canvas,
      width: tuning.room.width,
      height: 720,
      background: COLOR.sky,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(globalThis.devicePixelRatio ?? 1, 2),
    });
    // Art is optional — a missing file falls back to placeholder shapes, so
    // the game stays playable while it is still being drawn (ARCH AD-16).
    const art = await SpriteSet.load();
    return new Renderer(app, art);
  }

  setDebug(on: boolean): void {
    this.debug = on;
    this.debugText.visible = on;
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
    this.spawnParticles(state);
    this.particles.update(dt);
    this.particles.draw();

    this.drawFloor();
    this.drawEnemies(state);
    this.drawPlayer(state, x, y);
    this.drawFx(state);
    this.drawAir(state);
    this.drawHealth(state);
    this.drawVignette(state);

    if (this.debug) {
      this.debugText.position.set(12, 12);
      this.debugText.text = [
        `tick     ${state.tick}`,
        `air      ${state.air} (${(state.air / 60).toFixed(1)}s)`,
        `pos      ${p.x.toFixed(1)}, ${p.y.toFixed(1)}`,
        `vel      ${p.vx.toFixed(2)}, ${p.vy.toFixed(2)}`,
        `stance   ${p.stance}`,
        `facing   ${p.facing > 0 ? "right" : "left"}`,
        `action   ${p.action.kind ?? "-"} (lockout ${p.action.lockout})`,
        `outcome  ${state.outcome}`,
        "",
        `art      ${this.art.loaded.size}/16 loaded`,
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
          this.particles.hit(event.x, event.y, p.facing);
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

  private drawFloor(): void {
    const { floorY, width } = tuning.room;
    const tile = this.art.frame("tile.floor");

    if (tile) {
      if (!this.floorTile) {
        this.floorTile = new TilingSprite({
          texture: tile,
          width,
          height: 720 - floorY,
        });
        this.floorTile.position.set(0, floorY);
        this.world.addChildAt(this.floorTile, 0);
      }
      this.floorGfx.clear();
      return;
    }

    this.floorGfx.clear();
    this.floorGfx.rect(0, floorY, width, 720 - floorY).fill(COLOR.floor);
  }

  /**
   * Which frame a goblin shows, derived entirely from its simulation phase.
   * The wind-up pose gets used for the whole commitment rather than only the
   * telegraph, because that is the thing the player is reading.
   */
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

  private drawEnemies(state: SimState): void {
    const { width, height, maxHp } = tuning.enemies.goblin;
    this.enemyGfx.clear();

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
        sprite.visible = hasArt && e.phase !== "dead";
        if (sprite.visible) {
          sprite.texture = (this.goblinFrame(e, state.tick, i) ?? idleArt)!;
          sprite.position.set(e.x, e.y);
          sprite.scale.x = e.facing;
        }
      }
    });

    for (const e of state.enemies) {
      if (e.phase === "dead") continue;
      if (hasArt) {
        // Art is drawn by the sprites above; still show the tell and health.
        if (e.phase === "telegraphing") {
          const t = e.phaseTicks / tuning.enemies.goblin.telegraph;
          this.enemyGfx
            .rect(e.x - width / 2, e.y - height - 12, width, 4)
            .fill({ color: 0xffffff, alpha: 0.15 });
          this.enemyGfx
            .rect(e.x - width / 2, e.y - height - 12, width * t, 4)
            .fill(COLOR.enemyTelegraph);
        }
        if (e.hp < maxHp) {
          this.enemyGfx
            .rect(e.x - width / 2, e.y - height - 5, width * (e.hp / maxHp), 3)
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

      // Wind-up bar, so the tell is legible before there is animation to carry it.
      if (e.phase === "telegraphing") {
        const t = e.phaseTicks / tuning.enemies.goblin.telegraph;
        this.enemyGfx
          .rect(e.x - width / 2, e.y - height - 12, width, 4)
          .fill({ color: 0xffffff, alpha: 0.15 });
        this.enemyGfx
          .rect(e.x - width / 2, e.y - height - 12, width * t, 4)
          .fill(COLOR.enemyTelegraph);
      }

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
  private playerFrame(state: SimState) {
    const p = state.player;

    if (p.action.kind === "smash" && this.art.has("player.smash")) {
      // Frames 0-2 are the dive, frame 3 the impact — so pin the last frame to
      // the moment the hitbox is actually live rather than easing through it.
      const grounded = p.stance !== "airborne";
      return grounded
        ? this.art.frame("player.smash", 3)
        : this.art.frameOverProgress(
            "player.smash",
            Math.min(p.action.elapsed / 14, 0.74),
          );
    }

    if (p.action.kind === "attack") {
      // Alternating swings, so a chain does not replay the same animation.
      const key =
        p.action.variant === 0 ? "player.attack.a" : "player.attack.b";
      if (this.art.has(key)) {
        const total =
          tuning.player.attackStartup +
          tuning.player.attackActive +
          tuning.player.attackRecovery;
        return this.art.frameOverProgress(key, p.action.elapsed / total);
      }
    }

    if (p.action.kind === "block" && this.art.has("player.block")) {
      // Frame 0 is the live parry window, frame 1 the punish tail — the two
      // states must not look alike, because telling them apart IS the skill.
      const parrying = p.action.elapsed < tuning.combat.parryWindow;
      return this.art.frame("player.block", parrying ? 0 : 1);
    }

    if (
      (p.stance === "sliding" || p.stance === "backstepping") &&
      this.art.has("player.slide")
    ) {
      const total = tuning.movement.slideDuration;
      return this.art.frameOverProgress(
        "player.slide",
        1 - Math.min(p.dashTicks / total, 1),
      );
    }

    const moving = Math.abs(p.vx) > 0.1 && p.stance !== "airborne";

    if (p.stance === "crouching") {
      const key = moving ? "player.crouchWalk" : "player.crouch";
      if (this.art.has(key)) return this.art.frameAtTick(key, state.tick);
    }

    if (moving && this.art.has("player.run")) {
      return this.art.frameAtTick("player.run", state.tick);
    }

    return this.art.frameAtTick("player.idle", state.tick);
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
        : p.action.kind === "attack" || p.action.kind === "stun"
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
      // which are clearer anyway.
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

    // The swing itself, as an arc rather than a box. Without a visible slash
    // the attack reads as nothing happening; a rectangle reads as a debug aid.
    const swing = playerHitbox(p);
    if (swing && p.action.kind !== "smash") {
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
      const guardX = x + f * 15;
      const top = y - h * 0.95;
      const bottom = y - h * 0.15;

      // The blade itself, held vertically across the body.
      this.playerGfx
        .moveTo(guardX, top)
        .lineTo(guardX - f * 3, bottom)
        .stroke({
          width: parrying ? 6 : 4,
          color: parrying ? COLOR.parryFlash : COLOR.playerDashing,
          alpha: parrying ? 1 : 0.55,
        });
      // Crossguard, so it reads as a sword rather than a bar.
      this.playerGfx
        .moveTo(guardX - f * 8, y - h * 0.42)
        .lineTo(guardX + f * 7, y - h * 0.46)
        .stroke({
          width: 3,
          color: parrying ? 0xf4d59a : COLOR.playerDashing,
          alpha: parrying ? 0.95 : 0.4,
        });

      if (parrying) {
        // A glint running down the edge only while the window is live, so the
        // "now" is unmistakable at a glance.
        this.playerGfx
          .moveTo(guardX + f * 2, top + 4)
          .lineTo(guardX - f * 1, bottom - 10)
          .stroke({ width: 2, color: 0xffffff, alpha: 0.9 });
      }
    }
  }

  private drawAir(state: SimState): void {
    const pct = state.airCapacity === 0 ? 0 : state.air / state.airCapacity;
    const low = state.air <= VIGNETTE_TICKS;
    const barWidth = 420;
    const left = (tuning.room.width - barWidth) / 2;

    this.airBar.clear();
    this.airBar
      .rect(left, 62, barWidth, 8)
      .fill({ color: 0xffffff, alpha: 0.08 });
    this.airBar
      .rect(left, 62, barWidth * pct, 8)
      .fill(low ? COLOR.airLow : COLOR.air);

    // PRD FR-1.1: large, centre-top, always visible.
    const seconds = state.air / 60;
    this.airText.text = seconds >= 10 ? seconds.toFixed(0) : seconds.toFixed(1);
    this.airText.style.fill = low ? COLOR.airLow : COLOR.hud;
    this.airText.position.set(tuning.room.width / 2, 20);
  }

  /**
   * One-tick feedback. Events are cleared by the sim every tick, so these are
   * drawn as instantaneous flashes rather than tracked as animation state —
   * keeping timing-dependent state out of the view (ARCH AD-5).
   */
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

    // A: an overhead chop — steep, tight, sweeping downward.
    // B: a rising sweep — wide, flat, travelling up from low.
    const shape =
      variant === 0
        ? {
            from: -1.35 + progress * 1.75,
            spread: 1.35,
            radius: reach,
            lift: 0,
            core: 0xfff3c4,
            mid: 0xf4d59a,
            tail: COLOR.swing,
            layers: 4,
          }
        : {
            from: 1.15 - progress * 1.9,
            spread: 1.7,
            radius: reach * 1.12,
            lift: 10,
            core: 0xffffff,
            mid: 0xd6e6f2,
            tail: 0x8fb3c9,
            layers: 5,
          };

    for (let layer = 0; layer < shape.layers; layer++) {
      const r = shape.radius * (1 - layer * 0.12);
      const alpha = (0.85 - layer * 0.15) * (1 - progress * 0.35);
      const width = 7 - layer * 1.2;
      const colour =
        layer === 0 ? shape.core : layer === 1 ? shape.mid : shape.tail;

      const steps = 12;
      for (let i = 0; i <= steps; i++) {
        const a = shape.from + (shape.spread * i) / steps;
        const px = x + Math.cos(a) * r * facing;
        const py = y + Math.sin(a) * r + shape.lift;
        if (i === 0) this.playerGfx.moveTo(px, py);
        else this.playerGfx.lineTo(px, py);
      }
      this.playerGfx.stroke({ width, color: colour, alpha });
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
        this.fxGfx
          .circle(event.x, event.y, 22)
          .fill({ color: COLOR.enemyStriking, alpha: 0.45 });
      } else if (event.type === "playerHit") {
        this.fxGfx
          .rect(0, 0, tuning.room.width, 720)
          .fill({ color: COLOR.enemyStriking, alpha: 0.14 });
      }
    }
  }

  private drawHealth(state: SimState): void {
    const pct = state.player.hp / tuning.player.maxHp;
    const barWidth = 220;
    this.healthBar.clear();
    this.healthBar
      .rect(24, 24, barWidth, 10)
      .fill({ color: 0xffffff, alpha: 0.08 });
    this.healthBar
      .rect(24, 24, barWidth * Math.max(pct, 0), 10)
      .fill(pct > 0.35 ? COLOR.enemyStaggered : COLOR.enemyStriking);
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
        .rect(0, 0, tuning.room.width, band)
        .rect(0, 720 - band, tuning.room.width, band)
        .rect(0, 0, band, 720)
        .rect(tuning.room.width - band, 0, band, 720)
        .fill({ color: 0x000000, alpha: 0.06 * (1 - t) });
    }
  }

  destroy(): void {
    this.app.destroy(true, { children: true });
  }
}
