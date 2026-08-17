import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { replay, type InputRecord } from "../sim/index.ts";
import { BOARDS, scoreOf, type Board } from "../sim/score.ts";
import { tuning } from "../config/tuning.ts";
import { levelOf, rankedLoadout, type Loadout } from "../config/shop.ts";
import { allShortcutIds } from "../config/dungeon.ts";
import { credit, load, type StoredProgress } from "./progress.ts";
import { checkName } from "../config/names.ts";

/**
 * The leaderboards, and the only code allowed to put anything on one.
 *
 * `server-only` at the top is load-bearing for the same reason it is in
 * `progress.ts`: importing this from a client component fails the build rather
 * than shipping the service key to a browser.
 *
 * THE POINT OF THIS FILE IS THAT IT DOES NOT BELIEVE THE CLIENT.
 *
 * A score is never sent. What is sent is the input log — the keys held on each
 * tick — and this replays it through the same reducer the game runs, then reads
 * the score off the result with the same function the client displays. There is
 * one definition of "richest" and one of "fastest" (src/sim/score.ts) and both
 * sides use it, so they cannot disagree.
 *
 * What makes that check mean anything is that the run's STARTING conditions are
 * not the client's to choose either. The seed decides the layout, the tank
 * decides the length, and the loadout decides how hard everything hits — so all
 * three are written down by `start` before a single tick is played, and the
 * replay runs against those. A forged log has to be a log that genuinely
 * produces the score from those exact conditions, which is a run.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
 * How many ticks of input a run may submit.
 *
 * Twenty minutes at sixty a second, matching the ceiling the speed board is
 * measured against. This is a denial-of-service bound rather than a game rule:
 * replaying is real CPU on a shared server, and without a cap the endpoint
 * accepts a hundred-million-entry array and sits there simulating it.
 */
const MAX_TICKS = 60 * 60 * 20;

/** The most air any account can possibly have, for bounding a claimed run. */
function maxAir(): number {
  return tuning.air.max;
}

/** The run's loadout, in the shape the sim wants it. */
function loadoutOf(p: {
  levels: Record<string, number>;
  skin: string | null;
  pet: string | null;
}): Loadout {
  return { levels: p.levels, skin: p.skin, pet: p.pet };
}

export type StartedRun = {
  runId: string;
  seed: number;
  air: number;
  /**
   * Played on maxed gear with every shortcut open, and the only kind of run that
   * ranks. Decided here and handed to the client, never asked of it — a browser
   * that could set this would be a browser asking for top-tier equipment with a
   * real score attached.
   */
  ranked: boolean;
  /** What to play it on. For a ranked run this is not what the account owns. */
  loadout: Loadout;
  openShortcuts: string[];
  /**
   * Whether this run is invincible, decided HERE and told to the client rather
   * than asked of it.
   *
   * Admin used to be a browser flag in `localStorage`, which was fine while it
   * only affected the player's own fun. It affects a public board now, so it is
   * a column on `progress` granted by hand in the database — and the client is
   * informed of it so the run it plays matches the run the server will replay.
   */
  admin: boolean;
};

/**
 * Open a run, and decide everything it will be judged against.
 *
 * The seed is generated HERE. FR-15.1 puts it server-side and this is why: a
 * client that picks its own seed can pick one it has already mapped, and on a
 * speed board that is the whole game. `Math.random` is fine — this is the
 * server, outside the reducer, and the determinism rule (ARCH AD-1) is about
 * what happens once a run is under way.
 */
export async function start(
  userId: string,
  options: { ranked?: boolean } = {},
): Promise<StartedRun> {
  const progress = await load(userId);
  const ranked = options.ranked ?? false;
  // Ranked plays on equipment nobody earned: every weapon and every piece of
  // gear at its top tier. Potions and cosmetics are left exactly as the account
  // has them — see `rankedLoadout` for why.
  const owned = loadoutOf(progress);
  const loadout = ranked ? rankedLoadout(owned) : owned;
  const openShortcuts = ranked ? allShortcutIds() : progress.levered;

  // The same sum the client makes, from the same numbers. It has to be, or an
  // honest run replays against a tank it never had and is rejected. On a ranked
  // run that is the full tank, because the tank is gear.
  const air = Math.min(
    tuning.air.base + levelOf(loadout, "gear.tank") * tuning.air.perUpgrade,
    tuning.air.max,
  );
  // A 32-bit seed, which is what `deriveSeed` expects to be handed.
  const seed = Math.floor(Math.random() * 0x7fffffff);

  const { data, error } = await service()
    .from("runs")
    .insert({
      user_id: userId,
      seed,
      air,
      // Snapshotted, not read at submit time. Buying an upgrade between
      // starting and finishing must not change what the run is judged against —
      // and more to the point, the replay would stop matching and every honest
      // run that shopped mid-session would be rejected as a forgery.
      loadout,
      levered: openShortcuts,
      ranked,
      // Frozen with everything else, for the same reason: the replay has to run
      // under the same rules the player did, and a request cannot be allowed to
      // choose them. "This run was invincible" is exactly the sentence a cheat
      // would send, because it buys an easy run that still scores.
      admin: progress.admin,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return {
    runId: data.id as string,
    seed,
    air,
    admin: progress.admin,
    ranked,
    loadout,
    openShortcuts,
  };
}

export type Submission =
  | { error: string }
  | {
      scores: { board: Board; value: number }[];
      outcome: string;
      /**
       * The account after the run was credited — the client's cue to overwrite
       * its local copy. It never computes this: it displays what came back.
       */
      progress: StoredProgress;
    };

/**
 * Close a run: replay what was sent, score the result, record it.
 *
 * Returns an error rather than throwing for anything the caller did wrong, so
 * the route can answer 400 without a try/catch around every case.
 */
export async function submit(
  userId: string,
  runId: string,
  log: readonly InputRecord[],
): Promise<Submission> {
  if (typeof runId !== "string" || runId.length === 0)
    return { error: "Which run?" };
  if (!Array.isArray(log)) return { error: "Malformed log." };
  if (log.length > MAX_TICKS) return { error: "That log is too long." };

  const sb = service();
  const { data, error } = await sb
    .from("runs")
    .select("user_id, seed, air, loadout, levered, admin, ranked, submitted_at")
    .eq("id", runId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return { error: "No such run." };
  // Whose run this is comes from the row, and who is asking comes from the
  // bearer token. A run id in a payload is a run id the caller picked, so this
  // is the check that stops one account submitting a log against another's row.
  if (data.user_id !== userId) return { error: "Not your run." };
  // Once only. Without this the best log could be resubmitted forever, and
  // every submission would be another row on the board.
  if (data.submitted_at !== null) return { error: "Already submitted." };

  const air = Number(data.air);
  if (!Number.isFinite(air) || air <= 0 || air > maxAir())
    return { error: "That run is not playable." };

  // Every entry has to be a tick number and a bitfield, because `replay` will
  // happily index an array with whatever it is given and this is a payload from
  // the open internet.
  for (const entry of log) {
    if (
      !entry ||
      !Number.isInteger(entry.tick) ||
      entry.tick < 0 ||
      entry.tick > MAX_TICKS ||
      !Number.isInteger(entry.intents) ||
      entry.intents < 0 ||
      entry.intents > 0xffff
    ) {
      return { error: "Malformed log." };
    }
  }

  const finished = replay(log, air, {
    seed: Number(data.seed),
    openShortcuts: (data.levered as string[]) ?? [],
    loadout: data.loadout as Loadout,
    // From the ROW, never the request. An admin run is replayed with the same
    // invincibility it was played with — otherwise the player dies in the replay
    // where they did not in the game, and the score comes out wrong — and a
    // request that could set this would be a request that buys an invincible run
    // with a real score on it.
    god: Boolean(data.admin),
  });

  // ONLY A RANKED RUN CARRIES A SCORE.
  //
  // A Story run still records what it did and still gets its loot credited — it
  // simply does not rank, because it was played on whatever that account had
  // managed to buy. A starting-gear run and a maxed one on the same board is a
  // board measuring equipment, which is the thing ranked exists to stop
  // measuring.
  const scores = !data.ranked
    ? []
    : BOARDS.map((board) => ({
        board,
        value: scoreOf(finished, board),
      })).filter((s): s is { board: Board; value: number } => s.value !== null);

  // Credited from the replay, before anything is written to the board — a run
  // that pays and then fails to record a score is a bad day; a score recorded
  // for a run that never paid is a bug somebody notices.
  //
  // Only an extraction pays. FR-4.2 and FR-21.1: walking out banks the whole
  // bag, dying and transforming cost exactly the same thing and it is the loot.
  // The levers go across either way — they are not loot, they are something you
  // DID, and a run that opened a shortcut and then drowned still opened it.
  const progress =
    finished.outcome === "extracted"
      ? await credit(userId, {
          gems: finished.carried.gems,
          gold: finished.carried.gold,
          legendaries: finished.carried.legendaries,
          levered: finished.leversFlicked,
        })
      : await credit(userId, {
          gems: [],
          gold: 0,
          legendaries: 0,
          levered: finished.leversFlicked,
        });

  const name = await displayNameOf(userId);
  const { error: wrote } = await sb
    .from("runs")
    .update({
      name,
      riches: scores.find((s) => s.board === "riches")?.value ?? null,
      speed: scores.find((s) => s.board === "speed")?.value ?? null,
      outcome: finished.outcome,
      ticks: finished.tick,
      submitted_at: new Date().toISOString(),
    })
    .eq("id", runId)
    // Belt and braces against two submissions racing: the row only updates
    // while it is still open, so the second one changes nothing.
    .is("submitted_at", null);

  if (wrote) throw new Error(wrote.message);
  return { scores, outcome: finished.outcome, progress };
}

/**
 * What the game calls this player, for the board.
 *
 * Falls back to "scavenger" rather than to the local part of the e-mail, which
 * is what the in-game HUD does. The HUD is only ever seen by its owner; a board
 * is public, and half an address is still half an address.
 */
async function displayNameOf(userId: string): Promise<string> {
  const { data } = await service().auth.admin.getUserById(userId);
  const meta = data?.user?.user_metadata as { name?: unknown } | undefined;
  const name = typeof meta?.name === "string" ? meta.name.trim() : "";
  // Checked again here, and this is the check that counts.
  //
  // `user_metadata` is writable by its owner through Supabase's own API, with
  // or without our form — so anything the sign-up screen enforces is a courtesy
  // to honest players and nothing more. This is a PUBLIC page, and the two
  // things that actually matter are that a name cannot be long enough to break
  // the layout for everybody else and cannot be a wall of invisible characters
  // pretending to be a blank row. React escapes the markup; this handles the
  // rest. A name that fails goes on the board as "scavenger" rather than
  // rejecting the run — the score was earned either way.
  return checkName(name) === null ? name : "scavenger";
}

export type Row = {
  rank: number;
  name: string;
  value: number;
  at: string;
  mine: boolean;
  /**
   * Played with invincibility on. Shown on the row, always.
   *
   * These runs are allowed to rank — the people who can make them are named in
   * the database by hand — but an unmarked invincible score at the top of a
   * board would make the board a lie, and not lying is the only thing a
   * leaderboard has to offer.
   */
  admin: boolean;
};

/**
 * A board, best first.
 *
 * `since` cuts it to a period — the weekly board is this same query with a
 * Monday in it. One function rather than two because the only difference
 * between all-time and weekly is a `where`, and two copies of a ranking query
 * is two chances for them to rank differently.
 */
export async function top(
  board: Board,
  options: { since?: Date; limit?: number; userId?: string | null } = {},
): Promise<Row[]> {
  const column = board === "riches" ? "riches" : "speed";
  let query = service()
    .from("runs")
    .select("user_id, name, admin, " + column + ", submitted_at")
    .not("submitted_at", "is", null)
    .not(column, "is", null)
    // Ranked only. Everything on a board was played on the same equipment with
    // the same shortcuts open, so a time or a haul is how well it was played.
    .eq("ranked", true)
    // Higher is better on both boards — that is what `scoreOf` guarantees, and
    // it is why this sort does not have to know which board it is.
    .order(column, { ascending: false })
    // Ties break to whoever got there first.
    .order("submitted_at", { ascending: true })
    .limit(Math.min(options.limit ?? 100, 200));

  if (options.since) query = query.gte("submitted_at", options.since.toISOString());

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map((r, i) => {
    const row = r as unknown as Record<string, unknown>;
    return {
      rank: i + 1,
      name: (row.name as string) || "scavenger",
      value: Number(row[column]),
      at: String(row.submitted_at),
      mine: Boolean(options.userId) && row.user_id === options.userId,
      admin: Boolean(row.admin),
    };
  });
}

/** The most recent Monday, UTC. The weekly board's floor. */
export function weekStart(now: Date = new Date()): Date {
  const d = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  // getUTCDay is 0 for Sunday, so Sunday counts back six days rather than none.
  const back = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - back);
  return d;
}