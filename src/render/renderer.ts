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

import { Application, Container, Graphics, Text, TextStyle } from "pixi.js";
import { tuning } from "../config/tuning.ts";
import type { SimState } from "../sim/index.ts";

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
} as const;

/** The last ten seconds, when the vignette starts closing in (PRD FR-1.2). */
const VIGNETTE_TICKS = 10 * 60;

export class Renderer {
  private app: Application;
  private world = new Container();
  private playerGfx = new Graphics();
  private floorGfx = new Graphics();
  private vignette = new Graphics();
  private airBar = new Graphics();
  private airText: Text;
  private debugText: Text;
  private debug = false;

  private constructor(app: Application) {
    this.app = app;

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

    this.world.addChild(this.floorGfx, this.playerGfx);
    this.app.stage.addChild(this.world, this.vignette, this.airBar, this.airText, this.debugText);
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
    return new Renderer(app);
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

    this.drawFloor();
    this.drawPlayer(state, x, y);
    this.drawAir(state);
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
      ].join("\n");
    }
  }

  private drawFloor(): void {
    const { floorY, width } = tuning.room;
    this.floorGfx.clear();
    this.floorGfx.rect(0, floorY, width, 720 - floorY).fill(COLOR.floor);
  }

  private drawPlayer(state: SimState, x: number, y: number): void {
    const { width, height } = tuning.player;
    const p = state.player;
    const h = p.stance === "crouching" ? height * tuning.movement.crouchHeightScale : height;

    const colour =
      p.action.kind === "block"
        ? COLOR.playerBlocking
        : p.action.kind === "attack" || p.action.kind === "stun"
          ? COLOR.playerAttacking
          : p.dashTicks > 0
            ? COLOR.playerDashing
            : COLOR.player;

    this.playerGfx.clear();
    // Hurtbox, drawn from the feet up — the sprite will hang off this later.
    this.playerGfx.rect(x - width / 2, y - h, width, h).fill(colour);
    // A facing tick, so direction is readable before there is art.
    this.playerGfx.rect(x + (p.facing > 0 ? width / 2 : -width / 2 - 6), y - h * 0.7, 6, 4).fill(colour);
  }

  private drawAir(state: SimState): void {
    const pct = state.airCapacity === 0 ? 0 : state.air / state.airCapacity;
    const low = state.air <= VIGNETTE_TICKS;
    const barWidth = 420;
    const left = (tuning.room.width - barWidth) / 2;

    this.airBar.clear();
    this.airBar.rect(left, 62, barWidth, 8).fill({ color: 0xffffff, alpha: 0.08 });
    this.airBar.rect(left, 62, barWidth * pct, 8).fill(low ? COLOR.airLow : COLOR.air);

    // PRD FR-1.1: large, centre-top, always visible.
    const seconds = state.air / 60;
    this.airText.text = seconds >= 10 ? seconds.toFixed(0) : seconds.toFixed(1);
    this.airText.style.fill = low ? COLOR.airLow : COLOR.hud;
    this.airText.position.set(tuning.room.width / 2, 20);
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
