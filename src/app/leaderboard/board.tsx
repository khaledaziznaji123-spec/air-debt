"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase, authConfigured } from "../auth.ts";

/**
 * The boards.
 *
 * Two of them, cut two ways. The weekly cut exists because an all-time board is
 * only motivating for the people already on it — after a few months the top
 * hundred is the earliest hundred dedicated players and nobody new can ever see
 * their name. A board that empties every Monday is always reachable.
 *
 * The scores arrive already ranked and already formatted for sorting: both
 * boards are higher-is-better, including speed, which is stored as time saved
 * rather than time taken. See `scoreOf` in src/sim/score.ts — the reason lives
 * there because that is where the decision is enforced.
 */

type Row = {
  rank: number;
  name: string;
  value: number;
  at: string;
  mine: boolean;
  /** Played with invincibility on. Said on the row, never hidden. */
  admin: boolean;
};

const BOARDS = [
  {
    id: "riches" as const,
    name: "Richest run",
    blurb: "Most brought back out in one go. Dying with it does not count.",
  },
  {
    id: "speed" as const,
    name: "Fastest kill",
    blurb: "Entering the dungeon to the Revenant going down.",
  },
];

const PERIODS = [
  { id: "week" as const, name: "This week" },
  { id: "all" as const, name: "All time" },
];

/** A speed score is stored as ticks saved; this turns it back into a clock. */
const SPEED_CEILING = 60 * 60 * 20;

function clock(ticks: number): string {
  const seconds = Math.max(0, ticks) / 60;
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
}

export default function Board({
  board: initialBoard = "riches",
  period: initialPeriod = "week",
}: {
  board?: "riches" | "speed";
  period?: "week" | "all";
}) {
  const [board, setBoard] = useState<"riches" | "speed">(initialBoard);
  const [period, setPeriod] = useState<"week" | "all">(initialPeriod);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      // Cleared in here rather than in the effect body: a synchronous setState
      // during an effect is an immediate second render of a component that has
      // not painted once yet, and the lint rule that catches it is right.
      setRows(null);
      setError(null);
      // The token is optional here — the board reads without one. It is sent so
      // the server can mark which rows are yours, which is the only part of
      // this page that needs to know who is looking.
      const headers: Record<string, string> = {};
      if (authConfigured) {
        const { data } = await supabase().auth.getSession();
        const jwt = data.session?.access_token;
        if (jwt) headers.authorization = `Bearer ${jwt}`;
      }
      try {
        const r = await fetch(
          `/api/leaderboard?board=${board}&period=${period}`,
          { headers },
        );
        const body = (await r.json()) as { rows?: Row[]; error?: string };
        if (!live) return;
        if (body.error) setError(body.error);
        else setRows(body.rows ?? []);
      } catch {
        if (live) setError("Could not reach the leaderboard.");
      }
    })();
    return () => {
      live = false;
    };
  }, [board, period]);

  const spec = BOARDS.find((b) => b.id === board)!;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <Link
          href="/home"
          className="rounded-full border border-[#2b3644] px-4 py-1.5 text-xs font-semibold tracking-[0.16em] text-[#8a94a6] uppercase transition-colors hover:border-lens/50 hover:text-lens"
        >
          ← Home
        </Link>
        <Link
          href="/play?ranked=1"
          className="rounded-full border border-lens/40 px-4 py-1.5 text-xs font-semibold tracking-[0.16em] text-lens uppercase transition-colors hover:border-lens hover:bg-lens/10"
        >
          Play ranked →
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#e7ecf2]">
          Leaderboards
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-[#6b7a89]">
          Every score here was re-played on the server from the keys that were
          pressed. There is no way to post one without playing it.
        </p>
        {/* Said on the board rather than buried in the mode, because the first
            question anybody asks about a leaderboard is what it is measuring. */}
        <p className="mt-3 rounded-lg border border-[#1c2531] bg-[#10151d] p-3 text-sm leading-relaxed text-[#8a94a6]">
          Ranked runs only. Everyone plays on every weapon and every piece of
          gear at full tier, with all shortcuts open — so a time or a haul is how
          well it was played, not how long the account has been grinding. Your
          potions and your look are your own.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {BOARDS.map((b) => (
          <button
            key={b.id}
            onClick={() => setBoard(b.id)}
            className={`rounded-full border px-4 py-1.5 text-xs font-semibold tracking-[0.16em] uppercase transition-colors ${
              board === b.id
                ? "border-lens bg-lens/10 text-lens"
                : "border-[#2b3644] text-[#8a94a6] hover:text-[#e7ecf2]"
            }`}
          >
            {b.name}
          </button>
        ))}
        <span className="grow" />
        {PERIODS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPeriod(p.id)}
            className={`rounded-full border px-4 py-1.5 text-xs font-semibold tracking-[0.16em] uppercase transition-colors ${
              period === p.id
                ? "border-brass bg-brass/10 text-brass"
                : "border-[#2b3644] text-[#8a94a6] hover:text-[#e7ecf2]"
            }`}
          >
            {p.name}
          </button>
        ))}
      </div>

      <p className="text-sm text-[#6b7a89]">{spec.blurb}</p>

      {error && (
        <p
          role="status"
          className="rounded-lg border border-[#e56b6f]/30 bg-[#e56b6f]/10 px-4 py-2 text-sm text-[#e56b6f]"
        >
          {error}
        </p>
      )}

      {rows === null && !error && (
        <p className="text-sm text-[#6b7a89]">Reading the board…</p>
      )}

      {rows !== null && rows.length === 0 && (
        <div className="rounded-lg border border-[#2b3644] p-6 text-center">
          <p className="text-sm text-[#8a94a6]">
            Nobody has posted a score{period === "week" ? " this week" : ""} yet.
          </p>
          <p className="mt-1 text-sm text-[#6b7a89]">
            First one on it holds it.
          </p>
        </div>
      )}

      {rows !== null && rows.length > 0 && (
        <ol className="flex flex-col gap-1">
          {rows.map((row) => (
            <li
              key={`${row.rank}-${row.name}-${row.at}`}
              className={`flex items-center gap-4 rounded-lg border px-4 py-2.5 ${
                row.mine
                  ? "border-lens/50 bg-lens/5"
                  : "border-[#1c2531] bg-[#10151d]"
              }`}
            >
              <span className="w-8 shrink-0 text-right font-mono text-sm text-[#6b7a89]">
                {row.rank}
              </span>
              <span className="grow truncate text-sm text-[#e7ecf2]">
                {row.name}
                {row.mine && (
                  <span className="ml-2 text-xs tracking-[0.16em] text-lens uppercase">
                    you
                  </span>
                )}
                {/* Marked, always. These runs are allowed on the board — the
                    accounts that can make them are set by hand in the database
                    — but an invincible score sitting unmarked above everybody
                    else would make the board worthless, and not lying is the
                    only thing a leaderboard has to sell. */}
                {row.admin && (
                  <span className="ml-2 rounded-sm border border-brass/40 px-1.5 py-0.5 text-[10px] tracking-[0.16em] text-brass uppercase">
                    dev · no risk
                  </span>
                )}
              </span>
              <span className="shrink-0 font-mono text-sm text-brass">
                {board === "speed"
                  ? clock(SPEED_CEILING - row.value)
                  : row.value.toLocaleString()}
              </span>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}