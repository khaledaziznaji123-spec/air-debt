"use client";

import { supabase, authConfigured } from "./auth.ts";
import { readProgress, writeProgress, type Progress } from "./progress.ts";

/**
 * The bridge between the save file on the server and the one in this browser.
 *
 * The local store stays exactly where it was. It is still what the game reads
 * every frame, because a run cannot wait on a network round trip to know how
 * much reach your sword has — and if the connection drops mid-session the game
 * should keep working rather than stopping.
 *
 * So the server is the truth and the local copy is a cache of it:
 *
 *   sign in   pull the server's row over the local copy
 *   buy       ask the server; it decides; store what it sends back
 *   bank      same
 *
 * Nothing here computes a balance. Every number in this file arrived from the
 * server, which is the whole point — see `src/server/progress.ts`.
 */

async function token(): Promise<string | null> {
  if (!authConfigured) return null;
  const { data } = await supabase().auth.getSession();
  return data.session?.access_token ?? null;
}

type Reply = { progress?: Progress; error?: string; capped?: boolean };

async function ask(body: unknown): Promise<Reply> {
  const jwt = await token();
  if (!jwt) return { error: "Not signed in." };
  const r = await fetch("/api/progress", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify(body),
  });
  return (await r.json()) as Reply;
}

/** Pull the account's save down over the local one. Call on sign-in. */
export async function pull(): Promise<Progress | null> {
  const jwt = await token();
  if (!jwt) return null;
  const r = await fetch("/api/progress", {
    headers: { authorization: `Bearer ${jwt}` },
  });
  if (!r.ok) return null;
  const { progress } = (await r.json()) as Reply;
  if (!progress) return null;
  writeProgress(progress);
  return progress;
}

/**
 * Buy one level of one item.
 *
 * Sends only the item id. Not the price, not the balance afterwards — the
 * server holds the price list, so there is nothing in this request worth
 * tampering with.
 */
export async function buy(
  itemId: string,
): Promise<{ error: string } | { ok: true }> {
  const reply = await ask({ action: "buy", item: itemId });
  if (reply.error) return { error: reply.error };
  if (reply.progress) writeProgress(reply.progress);
  return { ok: true };
}


/** Change what you are wearing. */
export async function wear(what: {
  skin?: string | null;
  pet?: string | null;
}): Promise<{ error: string } | { ok: true }> {
  const reply = await ask({ action: "wear", ...what });
  if (reply.error) return { error: reply.error };
  if (reply.progress) writeProgress(reply.progress);
  return { ok: true };
}

/**
 * Whether the local copy has anything in it worth keeping.
 *
 * Used once, on the first sign-in: somebody who has been playing offline should
 * not have their kit deleted by an empty account. It is offered up rather than
 * merged silently — merging two save files without asking is how people lose
 * things.
 */
export function localHasProgress(): boolean {
  const p = readProgress();
  return (
    p.gold > 0 ||
    p.legendaries > 0 ||
    p.levered.length > 0 ||
    p.gems.some((n) => n > 0) ||
    Object.keys(p.levels).length > 0
  );
}

/**
 * Opening and closing a run, for the leaderboards.
 *
 * The same shape as everything else in this file: the client asks, the server
 * decides. `openRun` does not choose the seed and `closeRun` does not send a
 * score — it sends the input log and the server replays it (see
 * `src/server/leaderboard.ts`). There is nothing in either request worth
 * tampering with, which is the entire design.
 */
export type OpenRun = {
  runId: string;
  seed: number;
  air: number;
  /** Decided by the server from a column, not by this browser. */
  admin: boolean;
  ranked: boolean;
  /** What to play on. For a ranked run this is not what the account owns. */
  loadout: { levels: Record<string, number>; skin: string | null; pet: string | null };
  openShortcuts: string[];
};

export async function openRun(ranked = false): Promise<OpenRun | null> {
  const jwt = await token();
  if (!jwt) return null;
  const r = await fetch("/api/runs", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({ action: "start", ranked }),
  });
  if (!r.ok) return null;
  const body = (await r.json()) as Partial<OpenRun> & { error?: string };
  if (typeof body.runId !== "string" || typeof body.seed !== "number")
    return null;
  return {
    runId: body.runId,
    seed: body.seed,
    air: Number(body.air),
    admin: Boolean(body.admin),
    ranked: Boolean(body.ranked),
    loadout: body.loadout ?? { levels: {}, skin: null, pet: null },
    openShortcuts: Array.isArray(body.openShortcuts) ? body.openShortcuts : [],
  };
}

export type RunScores = { board: "riches" | "speed"; value: number }[];

export async function closeRun(
  runId: string,
  log: readonly { tick: number; intents: number }[],
): Promise<{ error: string } | { scores: RunScores }> {
  const jwt = await token();
  if (!jwt) return { error: "Not signed in." };
  const r = await fetch("/api/runs", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({ action: "submit", runId, log }),
  });
  const body = (await r.json()) as {
    error?: string;
    scores?: RunScores;
    progress?: Progress;
  };
  if (body.error) return { error: body.error };
  // This is where a run's loot arrives. There is no other way in: `bankRun` is
  // gone, and with it the request that added to a balance by asking. The server
  // replayed the log, worked out what the run actually took out, credited it,
  // and sent back the account — so the local copy is overwritten with the
  // server's answer rather than reconciled against a guess.
  if (body.progress) writeProgress(body.progress);
  return { scores: body.scores ?? [] };
}
