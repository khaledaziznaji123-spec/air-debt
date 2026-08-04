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
  | "player.run"
  | "player.attack.a"
  | "player.attack.b"
  | "player.block"
  | "player.hurt"
  | "enemy.goblin.idle"
  | "enemy.goblin.walk"
  | "enemy.goblin.windup"
  | "enemy.goblin.strike"
  | "enemy.goblin.stagger"
  | "tile.floor";

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
  "player.idle": { path: "/art/player-idle.png", width: 48, height: 96, frames: 4, ticksPerFrame: 14 },
  "player.run": { path: "/art/player-run.png", width: 48, height: 96, frames: 8, ticksPerFrame: 5 },
  // Two swings, alternating, so a chain never replays the same animation.
  "player.attack.a": { path: "/art/player-attack-a.png", width: 48, height: 96, frames: 6 },
  "player.attack.b": { path: "/art/player-attack-b.png", width: 48, height: 96, frames: 6 },
  "player.block": { path: "/art/player-block.png", width: 48, height: 96, frames: 2 },
  "player.hurt": { path: "/art/player-hurt.png", width: 48, height: 96, frames: 1 },
  "enemy.goblin.idle": { path: "/art/goblin-idle.png", width: 48, height: 64, frames: 2, ticksPerFrame: 16 },
  "enemy.goblin.walk": { path: "/art/goblin-walk.png", width: 48, height: 64, frames: 6, ticksPerFrame: 7 },
  "enemy.goblin.windup": { path: "/art/goblin-windup.png", width: 48, height: 64, frames: 2 },
  "enemy.goblin.strike": { path: "/art/goblin-strike.png", width: 48, height: 64, frames: 2 },
  "enemy.goblin.stagger": { path: "/art/goblin-stagger.png", width: 48, height: 64, frames: 1 },
  "tile.floor": { path: "/art/tile-floor.png", width: 32, height: 32, frames: 1 },
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
