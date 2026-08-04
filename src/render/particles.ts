/**
 * Particle effects. Pure view state (ARCH AD-5) — the simulation neither knows
 * nor cares that these exist, so they can be as expensive or as pretty as the
 * frame budget allows without ever affecting what actually happened.
 *
 * Deliberately driven by wall-clock rather than simulation ticks. Particles are
 * decoration, and decoration that stutters when the sim catches up looks worse
 * than decoration that runs free.
 */

import { Graphics } from "pixi.js";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: number;
  gravity: number;
  /** Streaks draw as a line along their velocity rather than a dot. */
  streak: boolean;
};

/**
 * A tiny deterministic-enough RNG. Not the simulation's — particles must never
 * touch that stream, or drawing would change the outcome of a run.
 */
function makeRandom(seed = 0x2f6e2b1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SPARK = [0xfff3c4, 0xf4a259, 0xe56b6f] as const;

export class Particles {
  readonly gfx = new Graphics();
  private items: Particle[] = [];
  private rand = makeRandom();
  /** Hard cap. A pile-up of particles must never be what drops the frame rate. */
  private static readonly MAX = 320;

  private push(p: Particle) {
    if (this.items.length >= Particles.MAX) this.items.shift();
    this.items.push(p);
  }

  /** Sparks thrown from a sword connecting. */
  hit(x: number, y: number, facing: 1 | -1, count = 14) {
    for (let i = 0; i < count; i++) {
      const a = (this.rand() - 0.5) * 2.4;
      const speed = 2 + this.rand() * 6;
      this.push({
        x,
        y,
        vx: Math.cos(a) * speed * facing + facing * 2,
        vy: Math.sin(a) * speed - 1.5,
        life: 1,
        maxLife: 0.25 + this.rand() * 0.35,
        size: 1 + this.rand() * 2,
        color: SPARK[Math.floor(this.rand() * SPARK.length)],
        gravity: 26,
        streak: this.rand() > 0.5,
      });
    }
  }

  /**
   * A parry. Deliberately the loudest effect in the game — it is the single
   * best thing that can happen to a player, and it should feel like it.
   */
  parry(x: number, y: number) {
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + this.rand() * 0.3;
      const speed = 4 + this.rand() * 7;
      this.push({
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        life: 1,
        maxLife: 0.3 + this.rand() * 0.3,
        size: 1 + this.rand() * 2.5,
        color: i % 3 === 0 ? 0xffffff : 0x9beee7,
        gravity: 8,
        streak: true,
      });
    }
  }

  /** Dust kicked outward when the smash lands. */
  impact(x: number, y: number, radius: number) {
    for (let i = 0; i < 22; i++) {
      const dir = this.rand() > 0.5 ? 1 : -1;
      this.push({
        x: x + (this.rand() - 0.5) * radius,
        y,
        vx: dir * (2 + this.rand() * 7),
        vy: -(1 + this.rand() * 5),
        life: 1,
        maxLife: 0.35 + this.rand() * 0.4,
        size: 1.5 + this.rand() * 3,
        color: 0x8a94a6,
        gravity: 30,
        streak: false,
      });
    }
  }

  /** Faint motes trailing a slide, so movement leaves a mark. */
  dust(x: number, y: number, facing: 1 | -1) {
    for (let i = 0; i < 3; i++) {
      this.push({
        x,
        y: y - this.rand() * 4,
        vx: -facing * (1 + this.rand() * 2),
        vy: -this.rand() * 2,
        life: 1,
        maxLife: 0.25 + this.rand() * 0.25,
        size: 1 + this.rand() * 2,
        color: 0x6a7581,
        gravity: 12,
        streak: false,
      });
    }
  }

  update(dt: number) {
    for (const p of this.items) {
      p.life -= dt / p.maxLife;
      p.vy += p.gravity * dt;
      p.x += p.vx * dt * 60;
      p.y += p.vy * dt * 60;
    }
    this.items = this.items.filter((p) => p.life > 0);
  }

  draw() {
    this.gfx.clear();
    for (const p of this.items) {
      // Ease out, so particles die away rather than blinking off.
      const alpha = Math.min(1, p.life * p.life * 1.6);
      if (p.streak) {
        const len = Math.min(9, Math.hypot(p.vx, p.vy) * 0.9);
        const a = Math.atan2(p.vy, p.vx);
        this.gfx
          .moveTo(p.x, p.y)
          .lineTo(p.x - Math.cos(a) * len, p.y - Math.sin(a) * len)
          .stroke({ width: p.size, color: p.color, alpha });
      } else {
        this.gfx.rect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size).fill({
          color: p.color,
          alpha,
        });
      }
    }
  }

  clear() {
    this.items.length = 0;
    this.gfx.clear();
  }
}
