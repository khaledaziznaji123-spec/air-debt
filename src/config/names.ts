/**
 * What a player is allowed to be called.
 *
 * In `config` rather than beside the sign-up form, because three places need
 * the same answer and they run in three different environments: the sign-up
 * screen and the profile page (browser), and the leaderboard (server, before it
 * publishes a name on a page anyone can open).
 *
 * It lived in `src/app/auth.ts`, which is a `"use client"` module — importing
 * that from server code drags the browser Supabase client into the server
 * bundle to reach one pure function. This has no imports at all and never will.
 */

/** The longest a name may be. Short enough that a board row cannot be shoved out of shape. */
export const NAME_MAX = 18;

/**
 * What is wrong with this name, or null if nothing is.
 *
 * The character class is a whitelist rather than a blacklist of the things that
 * cause trouble, because the list of things that cause trouble is not knowable:
 * zero-width joiners, right-to-left overrides and the several hundred code
 * points that render as blank would each have to be thought of. Letters,
 * numbers and five pieces of punctuation cannot surprise anybody.
 *
 * `\p{L}` and `\p{N}` rather than `A-Za-z0-9`, so a name in Arabic or Japanese
 * is a name.
 */
export function checkName(raw: string): string | null {
  const name = raw.trim();
  if (name.length < 2) return "A bit longer than that.";
  if (name.length > NAME_MAX) return "Eighteen characters at the most.";
  if (!/^[\p{L}\p{N} '\-_.]+$/u.test(name))
    return "Letters, numbers, spaces, and - _ . ' only.";
  return null;
}