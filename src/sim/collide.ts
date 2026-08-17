/**
 * Terrain collision.
 *
 * Separated on both axes and resolved vertically first, which is the standard
 * arrangement and the only one that behaves at a corner: resolve horizontally
 * first and a player walking onto a step gets shoved sideways out of ground
 * they were about to stand on.
 *
 * Pure, like everything else in here — it takes a position and gives a position
 * back, and knows nothing about who is moving.
 */

import { terrain, type Surface } from "../config/terrain.ts";
import { tuning } from "../config/tuning.ts";

const BODY = tuning.player;
/** Widened from the literal type, so enemies can be collided at their own size. */
const BODY_WIDTH: number = BODY.width;

/**
 * The surface the feet land on this tick, or null for still falling.
 *
 * A landing is a CROSSING, not an overlap: the feet must have been at or above
 * the top before the move and at or below it after. Testing overlap alone would
 * teleport anything that fell faster than a surface is thick straight through
 * it, and at terminal velocity the player falls 16 units a tick.
 */
export function landingSurface(
  x: number,
  prevFeet: number,
  feet: number,
  vy: number,
  width = BODY_WIDTH,
): Surface | null {
  if (vy < 0) return null;
  let best: Surface | null = null;
  for (const s of terrain.surfaces) {
    if (x + width / 2 <= s.x0 || x - width / 2 >= s.x1) continue;
    // Tolerance upward only: a body already standing on a surface has feet
    // exactly at its top, and must be allowed to stay there.
    if (prevFeet > s.top + 0.001) continue;
    if (feet < s.top) continue;
    if (best === null || s.top < best.top) best = s;
  }
  return best;
}

/**
 * The surface a rising head strikes this tick, or null for clear air.
 *
 * The mirror of `landingSurface`, and required the moment platforms became
 * solid: without it a jump into the underside of a ledge passes through
 * vertically and is then shoved sideways by the horizontal pass, which reads as
 * the player being swatted rather than as hitting their head.
 */
export function ceilingSurface(
  x: number,
  prevHead: number,
  head: number,
  vy: number,
  width = BODY_WIDTH,
): Surface | null {
  if (vy >= 0) return null;
  let best: Surface | null = null;
  for (const s of terrain.surfaces) {
    if (x + width / 2 <= s.x0 || x - width / 2 >= s.x1) continue;
    if (prevHead < s.bottom - 0.001) continue;
    if (head > s.bottom) continue;
    if (best === null || s.bottom > best.bottom) best = s;
  }
  return best;
}

/**
 * Horizontal blocking against solid mass.
 *
 * One-way ledges are skipped entirely — they exist to be walked off and jumped
 * through. Only the ground and raised blocks push back, and they push out along
 * whichever side the body came from, so a step becomes a wall rather than a
 * place to get stuck inside.
 */
/**
 * How high a lip can be and still be walked over rather than jumped.
 *
 * Deliberately small. It exists to stop the seabed's own segment boundaries
 * behaving like walls, not to make climbing free — at a fifth of the player's
 * height it is invisible everywhere the ground is flat, which is everywhere
 * except the water.
 */
const STEP_OVER = 18;

export function blockHorizontally(
  x: number,
  prevX: number,
  feet: number,
  height: number,
  width = BODY_WIDTH,
  /**
   * Whether small lips and overhangs are passable.
   *
   * TRUE ONLY IN WATER, and that restriction is the whole reason this is a
   * parameter rather than a rule. A swimmer can tilt and slip past a lip; a
   * walker has to slide, and the slide existing is the point — with the
   * allowance switched on everywhere, every lintel in the game with more than
   * sixty-four units of clearance became something you could stroll under, and
   * the one piece of geometry that exists to make the dodge necessary stopped
   * being necessary.
   */
  forgiving = false,
): number {
  const half = width / 2;
  const head = feet - height;
  let at = x;

  for (const s of terrain.surfaces) {
    // No vertical overlap means no wall. This is what lets a jump clear a block
    // and what lets a body stand on top of one without being pushed off it.
    if (head >= s.bottom || feet <= s.top) continue;
    // And a LIP is not a wall either.
    //
    // Nothing in the game had a step-up, which never showed because the floor
    // is one flat line and everything above it is a ledge you jump. The seabed
    // is not flat: it is built out of segments at slightly different depths, so
    // walking along it meant being stopped dead by a four-unit lip — and in the
    // cenote system, where the bed rises and falls the whole way, that was a
    // wall every seventy units.
    //
    // Eighteen units, which is a fifth of the player's height. Anything taller
    // is still something you have to jump.
    if (forgiving && feet - s.top <= STEP_OVER) continue;
    // And a low OVERHANG is not a wall either — the same rule, upside down.
    //
    // A swimmer holding up rides the ceiling with their head exactly at it, so
    // every downward step in the roof was a wall to them exactly as a lip in
    // the floor was a wall to a walker. The cenote system's ceiling swells and
    // pinches the whole way, which put one of those every twenty-eight units.
    //
    // `duckUnder` is what makes this safe: it pushes the head back out on the
    // same tick, so passing under a low bit lowers you rather than embedding
    // you in it.
    if (forgiving && s.bottom - head <= STEP_OVER) continue;
    if (at + half <= s.x0 || at - half >= s.x1) continue;

    // Came from the left of it, or the right?
    const cameFromLeft = prevX + half <= s.x0 + 0.001;
    const cameFromRight = prevX - half >= s.x1 - 0.001;
    if (cameFromLeft) at = s.x0 - half;
    else if (cameFromRight) at = s.x1 + half;
    else {
      // Already inside — push out the nearer way rather than picking a side by
      // accident. Reachable when a surface appears around a body, which today
      // means the spawn and nothing else.
      const outLeft = s.x0 - (at + half);
      const outRight = s.x1 - (at - half);
      at += Math.abs(outLeft) < Math.abs(outRight) ? outLeft : outRight;
    }
  }

  return at;
}

/**
 * Which side a grabbable wall is on, or 0 for none.
 *
 * A wall is solid mass that overlaps the body vertically and is within a hand's
 * reach horizontally. The reach is deliberately a little wider than the body:
 * the horizontal pass has already stopped the player flush against the face, so
 * testing for overlap would be testing for a condition that collision has just
 * finished removing, and the grab would flicker on and off frame to frame.
 *
 * Only the torso counts, not the whole body. Measuring from the feet would let a
 * player cling to the lip of a block their shins are level with, which reads as
 * grabbing thin air; measuring from the head would drop the grab the moment they
 * slid past a low ledge.
 */
export function wallBeside(
  x: number,
  feet: number,
  height: number,
  width = BODY_WIDTH,
): -1 | 0 | 1 {
  const half = width / 2;
  const reach = tuning.movement.wallGrabReach;
  const head = feet - height;
  const top = head + height * 0.2;
  const bottom = feet - height * 0.15;

  for (const s of terrain.surfaces) {
    if (s.oneWay) continue;
    // A wall, not a lip.
    //
    // A ledge is twenty-six units of edge, and that edge was grippable — so a
    // player could jump beside any shelf in the game, catch its rim with the
    // top of their head, and kick their way up it. On the fire's high road,
    // which is one continuous shelf, that meant wall-jumping onto a shortcut
    // whose lever had never been touched.
    //
    // Half the player's own height is the line. Anything shorter is something
    // you get a hand over, not something you brace against — and every real
    // wall in the game is full-height stone, so nothing that was meant to be
    // climbable stops being climbable.
    if (s.bottom - s.top < height * 0.5) continue;
    if (top >= s.bottom || bottom <= s.top) continue;
    // The horizontal pass leaves the body flush: x + half === s.x0 against a
    // wall on the right, x - half === s.x1 against one on the left. The reach
    // extends that backwards only — a body already past the face is inside the
    // surface, not holding it.
    const right = x + half;
    const left = x - half;
    if (right <= s.x0 + 0.5 && right >= s.x0 - reach) return 1;
    if (left >= s.x1 - 0.5 && left <= s.x1 + reach) return -1;
  }
  return 0;
}

/** The highest standable top under a point. Used to place things, not to move. */
export function groundUnder(x: number, from = -Infinity): number {
  let best = Infinity;
  for (const s of terrain.surfaces) {
    if (x < s.x0 || x > s.x1) continue;
    if (s.top < from) continue;
    if (s.top < best) best = s.top;
  }
  return best === Infinity ? tuning.room.floorY : best;
}

/** True while the body is inside a ladder's column and within its run. */
export function ladderAt(x: number, feet: number) {
  for (const l of terrain.ladders) {
    if (Math.abs(x - l.x) > tuning.movement.ladderReach) continue;
    if (feet < l.top - 12 || feet > l.bottom + 8) continue;
    return l;
  }
  return null;
}

/**
 * Somewhere behind `x` that is safe to be put down on.
 *
 * Used when a trap throws the player back: it has to land them on ground they
 * could have stood on, which means not inside rock, not on the spikes, and not
 * at the bottom of the pit they were probably about to fall into. Walking
 * backwards in short steps is the whole algorithm — the first spot that passes
 * is the nearest one, and nearest is what makes the throw-back feel like being
 * shoved rather than teleported across the level.
 *
 * Falls back to the trap itself if the whole search fails, which can only
 * happen with a trap standing on the only ground for four hundred units. A
 * player put back exactly where they were is better than one put inside a wall.
 */
export function safeGroundBefore(
  x: number,
  facing: 1 | -1,
  width = BODY_WIDTH,
  height = BODY.height,
): { x: number; y: number } | null {
  const ok = (at: number) => {
    if (at < width || at > terrainEnd() - width) return null;
    const top = groundUnder(at);
    // Not down a hole — being thrown into a different pit is not a rescue —
    // and not onto spikes.
    if (top > tuning.room.floorY + 1) return null;
    if (onSpikes(at, top, width)) return null;
    // And not inside anything: if the horizontal pass would move them, the
    // spot is occupied.
    if (Math.abs(blockHorizontally(at, at, top, height, width) - at) > 0.5)
      return null;
    return { x: at, y: top };
  };

  // The NEAREST safe ground, either way.
  //
  // It used to search four hundred units BEHIND you first and only look
  // forward if that failed, on the theory that being put back where you came
  // from is the reading that makes a pit a mistake. That is true at the edge of
  // a small hole and wrong everywhere else: fall into the middle of a wide
  // pool and "behind" is four hundred units of more pool, so you were thrown
  // most of a screen backwards past ground you were standing next to.
  //
  // So both directions are tried at each distance and the closer one wins,
  // with ties going backward — which keeps the old reading exactly where it was
  // right and drops it where it was not.
  const back = -facing;
  for (let step = 40; step <= 1600; step += 20) {
    const behind = ok(x + back * step);
    if (behind) return behind;
    const ahead = ok(x + facing * step);
    if (ahead) return ahead;
  }
  return null;
}

/** The far end of the built ground, for bounding the search above. */
function terrainEnd(): number {
  let end = 0;
  for (const s of terrain.surfaces) if (s.x1 > end) end = s.x1;
  return end;
}

/**
 * Whether the pit a body is standing in is a lava one.
 *
 * The simulation goes out of its way not to care — a pool and an iron pit are
 * the same rule and the same code — and this is the single exception: lava sets
 * you alight and iron does not. Kept beside `onSpikes` so the two can never
 * disagree about which pool is which.
 */
export function inPoison(x: number, feet: number, width = BODY_WIDTH): boolean {
  for (const s of terrain.spikes) {
    if (!s.poison) continue;
    if (x + width / 2 <= s.x0 || x - width / 2 >= s.x1) continue;
    if (feet >= s.top) return true;
  }
  return false;
}

export function inLava(x: number, feet: number, width = BODY_WIDTH): boolean {
  for (const s of terrain.spikes) {
    if (!s.lava) continue;
    if (x + width / 2 <= s.x0 || x - width / 2 >= s.x1) continue;
    if (feet >= s.top) return true;
  }
  return false;
}

/**
 * The water a body is in, or null for dry air.
 *
 * Measured at the CHEST rather than the feet. Feet-deep is a puddle you walk
 * through and the game should not take the controls away for it; chest-deep is
 * swimming. That one choice is the difference between a beach and a wall of
 * water at the edge of the sand.
 */
export function waterAt(
  x: number,
  feet: number,
  height: number = BODY.height,
  width = BODY_WIDTH,
) {
  const chest = feet - height * 0.45;
  for (const w of terrain.water) {
    if (x + width / 2 <= w.x0 || x - width / 2 >= w.x1) continue;
    if (chest < w.surface) continue;
    if (feet > w.floor + 20) continue;
    return w;
  }
  return null;
}

/** Whether the head is under the waterline — the only place air is spent extra. */
export function submerged(
  x: number,
  feet: number,
  height: number = BODY.height,
): boolean {
  const head = feet - height * 0.86;
  for (const w of terrain.water) {
    if (x < w.x0 || x > w.x1) continue;
    if (head >= w.surface) return true;
  }
  return false;
}

/** Whether a body standing here is on spikes. */
export function onSpikes(x: number, feet: number, width = BODY_WIDTH): boolean {
  for (const s of terrain.spikes) {
    if (x + width / 2 <= s.x0 || x - width / 2 >= s.x1) continue;
    if (feet >= s.top) return true;
  }
  return false;
}

/**
 * Whether a point is inside solid rock.
 *
 * For projectiles, which are points rather than bodies and so need no push-out
 * — an arrow that meets stone stops existing, it does not slide along it.
 *
 * Thin surfaces are ignored on purpose. A ledge is twenty-six units of lip and
 * an arrow passing an inch under one should carry on; what has to stop a shot
 * is a wall, a tower or the floor.
 */
export function insideSolid(x: number, y: number): boolean {
  for (const s of terrain.surfaces) {
    if (s.thin) continue;
    if (x < s.x0 || x > s.x1) continue;
    if (y > s.top && y < s.bottom) return true;
  }
  return false;
}

/**
 * Whether a shot in flight has just hit terrain.
 *
 * Not `insideSolid`, and the difference is the one-way platforms. Those are
 * `thin`, and `insideSolid` skips every thin surface — which is correct for a
 * body, because a body has to be able to jump up through them, and is badly
 * wrong for a fireball. Five of the eight raised surfaces in the fire
 * environment are thin, so a phoenix hovering over a ledge was shooting down
 * THROUGH it at somebody standing underneath, and the ledge you took cover on
 * was not cover.
 *
 * So a thin platform stops a shot the same way it stops a body: from above
 * only. A ball crossing its top line on the way down hits it; one on the way up
 * passes through, which is the same rule the player's own jump plays by.
 *
 * Takes the previous position because a shot moves several units a tick — the
 * question is whether the SEGMENT crossed the line, not whether the endpoint
 * happens to sit on it.
 */
export function blocksShot(
  x: number,
  y: number,
  prevY: number,
): boolean {
  for (const s of terrain.surfaces) {
    if (x < s.x0 || x > s.x1) continue;
    if (s.thin && !s.shotproof) {
      // Downward only, and only if this step crossed the surface.
      if (y > prevY && prevY <= s.top && y >= s.top) return true;
      continue;
    }
    if (s.thin) {
      // Shotproof: solid to a shot from either side. A slab has no depth to be
      // inside of, so the test is whether this step crossed its line at all.
      if ((prevY <= s.top && y >= s.top) || (prevY >= s.top && y <= s.top))
        return true;
      continue;
    }
    if (y > s.top && y < s.bottom) return true;
  }
  return false;
}

/**
 * Pushed down out of an overhang you have just ducked under.
 *
 * The partner to the `STEP_OVER` allowance in `blockHorizontally`: that lets a
 * body move under rock slightly lower than its head, and this puts the head
 * back below it. Without the pair, allowing the movement would leave the player
 * embedded in the ceiling until something else happened to move them.
 *
 * Returns the corrected feet position, or the one it was given.
 */
export function duckUnder(
  x: number,
  feet: number,
  height: number,
  width = BODY_WIDTH,
): number {
  const half = width / 2;
  const head = feet - height;
  let lowest = head;
  for (const s of terrain.surfaces) {
    if (x + half <= s.x0 || x - half >= s.x1) continue;
    if (s.bottom <= head || s.top > head) continue;
    // Only the small ones. A body properly inside a wall is a different
    // problem and is not this function's to solve.
    if (s.bottom - head > STEP_OVER) continue;
    if (s.bottom > lowest) lowest = s.bottom;
  }
  return lowest === head ? feet : lowest + height;
}
