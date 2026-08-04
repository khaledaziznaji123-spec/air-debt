/**
 * Art loading. ARCH AD-16: the core never names an asset — it deals in entity
 * and animation identifiers, and this module is the only place those become
 * files. Swapping every sprite must never require touching `src/sim`.
 *
 * Everything here is optional by design. A missing file is not an error: the
 * renderer falls back to its placeholder shapes, so the game stays playable
 * while the art is still being drawn.
 */

import { Assets, Texture } from "pixi.js";

export type SpriteKey =
  | "player.idle"
  | "enemy.goblin.idle"
  | "enemy.goblin.windup"
  | "tile.floor";

type SpriteDef = {
  path: string;
  /** Expected pixel size. Mismatches are reported rather than silently scaled. */
  width: number;
  height: number;
};

/**
 * The manifest is the contract with whoever is drawing. Sizes match the world
 * units in `tuning.ts` 1:1, so nothing needs scaling.
 */
export const SPRITE_MANIFEST: Record<SpriteKey, SpriteDef> = {
  "player.idle": { path: "/art/player-idle.png", width: 32, height: 64 },
  "enemy.goblin.idle": { path: "/art/goblin-idle.png", width: 32, height: 48 },
  "enemy.goblin.windup": { path: "/art/goblin-windup.png", width: 32, height: 48 },
  "tile.floor": { path: "/art/tile-floor.png", width: 32, height: 32 },
};

export class SpriteSet {
  private textures = new Map<SpriteKey, Texture>();
  private warnings: string[] = [];

  /** Which sprites were found. Anything absent falls back to placeholder art. */
  get loaded(): ReadonlySet<SpriteKey> {
    return new Set(this.textures.keys());
  }

  get issues(): readonly string[] {
    return this.warnings;
  }

  get(key: SpriteKey): Texture | null {
    return this.textures.get(key) ?? null;
  }

  static async load(): Promise<SpriteSet> {
    const set = new SpriteSet();

    await Promise.all(
      (Object.keys(SPRITE_MANIFEST) as SpriteKey[]).map(async (key) => {
        const def = SPRITE_MANIFEST[key];
        try {
          // A 404 returns HTML, which Pixi rejects — so a missing file lands
          // here rather than producing a broken texture.
          const texture = await Assets.load<Texture>(def.path);
          if (!texture) return;

          // Pixel art must not be smoothed. Without this, a 32px sprite scaled
          // to any non-integer size turns to mush.
          texture.source.scaleMode = "nearest";
          set.textures.set(key, texture);

          if (texture.width !== def.width || texture.height !== def.height) {
            set.warnings.push(
              `${def.path} is ${texture.width}x${texture.height}, expected ${def.width}x${def.height}`,
            );
          }
        } catch {
          // Absent art is the normal state until it is drawn. Not an error.
        }
      }),
    );

    return set;
  }
}
