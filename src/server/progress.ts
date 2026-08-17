import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SHOP, priceOf, levelOf, type Loadout } from "../config/shop.ts";
import { tuning } from "../config/tuning.ts";

/**
 * The only code allowed to write a balance.
 *
 * `server-only` at the top is load-bearing: import this from a client component
 * and the build fails rather than shipping the service key to a browser. That
 * key ignores row-level security entirely, so the difference between "on the
 * server" and "in the bundle" is the difference between a game and a game where
 * everyone has a million gold.
 *
 * PRD FR-15.8 in one sentence: the client may ASK, the server DECIDES.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

export type StoredProgress = {
  levels: Record<string, number>;
  gems: number[];
  gold: number;
  legendaries: number;
  levered: string[];
  skin: string | null;
  pet: string | null;
};

export const EMPTY: StoredProgress = {
  levels: {},
  gems: [],
  gold: 0,
  legendaries: 0,
  levered: [],
  skin: null,
  pet: null,
};

let admin: SupabaseClient | null = null;

function service(): SupabaseClient {
  if (!URL || !SERVICE) {
    throw new Error(
      "Supabase service credentials are missing — see .env.example",
    );
  }
  admin ??= createClient(URL, SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return admin;
}

/**
 * Who is making this request, from the token they sent.
 *
 * Never from anything the request BODY says. A user id in a payload is a user
 * id the caller chose, and the entire point of checking it here is that they
 * do not get to choose.
 */
export async function userFromToken(
  token: string | null,
): Promise<string | null> {
  if (!token) return null;
  const { data, error } = await service().auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

export async function load(userId: string): Promise<StoredProgress> {
  const sb = service();
  const { data, error } = await sb
    .from("progress")
    .select("levels, gems, gold, legendaries, levered, skin, pet")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) {
    // The trigger should have made this row. If it has not — an account made
    // before the migration ran — make it now rather than failing.
    const { error: made } = await sb
      .from("progress")
      .insert({ user_id: userId });
    if (made && !/duplicate key/i.test(made.message))
      throw new Error(made.message);
    return { ...EMPTY };
  }

  return {
    levels: (data.levels as Record<string, number>) ?? {},
    gems: (data.gems as number[]) ?? [],
    gold: data.gold ?? 0,
    legendaries: data.legendaries ?? 0,
    levered: (data.levered as string[]) ?? [],
    skin: data.skin ?? null,
    pet: data.pet ?? null,
  };
}

async function save(userId: string, next: StoredProgress): Promise<void> {
  const { error } = await service()
    .from("progress")
    .update({ ...next, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

/** As a `Loadout`, which is what the shop's own helpers expect. */
function loadoutOf(p: StoredProgress): Loadout {
  return { levels: p.levels, skin: p.skin, pet: p.pet };
}

// ---------------------------------------------------------------------------
// Buying
// ---------------------------------------------------------------------------

/**
 * Buy one level of one item.
 *
 * Fully authoritative, and the reason it can be: the server has the price list.
 * The request says WHICH item, and nothing else — not the price, not the
 * resulting balance. So there is no number in the payload worth tampering with.
 */
export async function buy(
  userId: string,
  itemId: string,
): Promise<{ error: string } | { ok: true; progress: StoredProgress }> {
  const item = SHOP.find((i) => i.id === itemId);
  if (!item || !item.live) return { error: "No such item." };

  const current = await load(userId);
  const level = levelOf(loadoutOf(current), item.id);
  const tiers = item.tiers ?? 1;
  if (level >= tiers) return { error: "Already at the top level." };

  const price = priceOf(item, level);
  // `priceOf` returns null for a level that does not exist, which the tier
  // check above has already ruled out — but the type does not know that and
  // "trust me" is not a thing to write into a payment path.
  if (!price) return { error: "That level is not for sale." };

  const gems = [...current.gems];
  for (const [gradeIndex, cost] of price.gems.entries()) {
    if ((gems[gradeIndex] ?? 0) < cost)
      return { error: "Not enough of that stone." };
  }
  if (current.gold < price.gold) return { error: "Not enough gold." };

  for (const [gradeIndex, cost] of price.gems.entries()) {
    gems[gradeIndex] = (gems[gradeIndex] ?? 0) - cost;
  }

  const next: StoredProgress = {
    ...current,
    gems,
    gold: current.gold - price.gold,
    levels: { ...current.levels, [item.id]: level + 1 },
  };
  await save(userId, next);
  return { ok: true, progress: next };
}

// ---------------------------------------------------------------------------
// Banking a run
// ---------------------------------------------------------------------------

/**
 * How much one run is allowed to be worth.
 *
 * This is a CEILING, not a verification. The honest position: the client still
 * reports what it collected, and a determined player can lie inside these
 * bounds. What the cap buys is that the lie is small and bounded rather than
 * "one gold, nine zeroes" — and it costs almost nothing to have while the real
 * answer is built.
 *
 * The real answer is replay: ARCH AD-7 keeps the whole simulation runnable in
 * Node precisely so this route can one day re-run the seed and the recorded
 * intents and compute the loot itself, instead of being told. Until that is
 * here, this cap is the guard rail and it is deliberately generous enough not
 * to punish a genuinely good run.
 */
// The per-run ceiling that used to sit here is gone with `bank`.
//
// It capped a number the browser sent, which reads like a safety rail and was
// not one: the request carried no run id, so the ceiling was not a limit on
// cheating, it was the amount of free loot available per call. What replaced it
// is `credit`, which takes its figures from a replay — and a verified figure
// wants no ceiling at all, because there is nothing left to cheat and a cap can
// only rob an exceptional run.

export type Banked = {
  gems: number[];
  gold: number;
  legendaries: number;
  levered: string[];
};

/**
 * Credit a run that the server has already replayed and believes.
 *
 * This replaced `bank`, which took the numbers from the browser and clamped
 * them to a per-run ceiling. That was never a defence, only a limit on how fast
 * you could help yourself: the request carried no run id, so anyone signed in
 * could post the ceiling from a console as often as they liked, having never
 * pressed play. Three hundred gems and four legendaries a call, against prices
 * measured in whole clears.
 *
 * Nothing here is claimed. `carried` and `levered` come out of
 * `replay(log)` in `leaderboard.ts` — the same reducer the game runs, from a
 * seed and a tank this server wrote down before the first tick. See ARCH AD-7
 * and PRD FR-15.8: the client may ASK, the server DECIDES, and what it decides
 * from is the run.
 *
 * THERE IS NO CAP, and that is deliberate rather than an oversight. A ceiling
 * on a verified figure cannot stop a cheat — there is nothing left to cheat —
 * and it can rob an exceptional run, which is the one run a player will
 * remember. The reducer is the limit now.
 */
export async function credit(
  userId: string,
  run: { gems: readonly number[]; gold: number; legendaries: number; levered: readonly string[] },
): Promise<StoredProgress> {
  const current = await load(userId);
  const grades = tuning.loot.grades;

  const gems = [...current.gems];
  for (let g = 0; g < grades; g++) {
    // Still floored and still refused if it is not a number. Not against a
    // cheat — against a bug in here putting `NaN` in somebody's account, which
    // is the sort of thing that is only ever noticed weeks later.
    const took = Math.floor(Number(run.gems[g] ?? 0));
    gems[g] = (gems[g] ?? 0) + (Number.isFinite(took) && took > 0 ? took : 0);
  }
  const gold = Math.max(0, Math.floor(Number(run.gold) || 0));
  const legendaries = Math.max(0, Math.floor(Number(run.legendaries) || 0));

  // Levers only ever accumulate, and only ones that exist. FR-3.3 makes them
  // permanent, so this is the one list that may never shrink.
  const levered = [
    ...new Set([...current.levered, ...(run.levered ?? [])]),
  ].filter((id) => /^shortcut\.\d[a-z]$/.test(id));

  const next: StoredProgress = {
    ...current,
    gems,
    gold: current.gold + gold,
    legendaries: current.legendaries + legendaries,
    levered,
  };
  const { error } = await service()
    .from("progress")
    .update({
      gems: next.gems,
      gold: next.gold,
      legendaries: next.legendaries,
      levered: next.levered,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return next;
}

/** Cosmetics. No effect on a run, but still written here — one door, not two. */
export async function wear(
  userId: string,
  what: { skin?: string | null; pet?: string | null },
): Promise<{ error: string } | { ok: true; progress: StoredProgress }> {
  const current = await load(userId);
  const owns = (id: string | null | undefined) =>
    id == null || (current.levels[id] ?? 0) > 0;
  if (!owns(what.skin) || !owns(what.pet))
    return { error: "You do not own that." };

  const next: StoredProgress = {
    ...current,
    skin: what.skin === undefined ? current.skin : what.skin,
    pet: what.pet === undefined ? current.pet : what.pet,
  };
  await save(userId, next);
  return { ok: true, progress: next };
}
