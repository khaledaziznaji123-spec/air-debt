-- Runs, and the leaderboards built out of them.
--
-- Run this once in the Supabase dashboard: SQL Editor -> New query -> paste ->
-- Run. It is safe to run more than once.
--
-- ---------------------------------------------------------------------------
-- WHY A RUN IS A ROW BEFORE IT IS A SCORE.
--
-- A leaderboard that accepts "I scored 4000" from a browser is a leaderboard
-- that says whatever the browser wants. This one accepts an INPUT LOG and
-- replays it through the same reducer the game runs, then scores the result
-- itself (see src/sim/score.ts). To cheat you have to submit inputs that
-- genuinely produce the score, which is not cheating, that is playing.
--
-- Replaying only proves anything if the server already knows what the run
-- STARTED from — a different seed lays out a different dungeon, and a bigger
-- tank is a longer run. So the run is created here first, with its seed and its
-- starting conditions frozen, and the log is checked against those. That is
-- also why the loadout and the levered list are snapshotted rather than read at
-- submit time: buying an upgrade between starting and finishing must not change
-- what the run is judged against.
--
-- The security shape is the same one `progress` uses and for the same reason.
-- Anyone can open the console and call the database with their own key, so the
-- browser gets SELECT on finished runs and nothing else. Every write goes
-- through server code holding the service key. PRD FR-15.8.
-- ---------------------------------------------------------------------------

create table if not exists public.runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  -- What the run was played from. Frozen at start; the replay is only
  -- meaningful against exactly these.
  seed bigint not null,
  air integer not null check (air > 0),
  loadout jsonb not null default '{}'::jsonb,
  levered text[] not null default '{}',

  -- What the game calls this player, resolved server-side at submit time.
  -- Stored on the row rather than joined at read time so the board never has to
  -- touch auth.users, which would mean exposing e-mail addresses to a public
  -- SELECT policy.
  name text,

  -- The scores, one column per board, null when the run did not qualify. Both
  -- are HIGHER IS BETTER, including speed — a time is stored as ticks saved
  -- against a ceiling, so nothing that sorts these ever has to know which board
  -- it is looking at. See `scoreOf` in src/sim/score.ts.
  riches integer check (riches is null or riches >= 0),
  speed integer check (speed is null or speed >= 0),

  -- How the run ended, and how long it took. Kept for display, not for ranking.
  outcome text,
  ticks integer,

  started_at timestamptz not null default now(),
  -- Null until the log has been replayed and accepted. An unsubmitted run is
  -- not a score and must never appear on a board.
  submitted_at timestamptz
);

-- The two board queries, and the weekly cut of each. Partial indexes because
-- most rows are unsubmitted or unqualified and there is no reason to carry them
-- in an index that only ever excludes them.
create index if not exists runs_riches_idx
  on public.runs (riches desc, submitted_at asc)
  where submitted_at is not null and riches is not null;

create index if not exists runs_speed_idx
  on public.runs (speed desc, submitted_at asc)
  where submitted_at is not null and speed is not null;

create index if not exists runs_user_idx on public.runs (user_id, started_at desc);

alter table public.runs enable row level security;

-- Read any FINISHED run. A leaderboard is public by definition, and the row
-- holds nothing private: a seed, a score, and a chosen display name.
--
-- The `submitted_at is not null` clause is the load-bearing half. Without it a
-- player could read the seed of a run in progress — including somebody else's —
-- and the seed is the dungeon's layout. On this account it would only spoil
-- chest positions; on a PvP mode it would be the whole match.
drop policy if exists "read finished runs" on public.runs;
create policy "read finished runs"
  on public.runs
  for select
  using (submitted_at is not null);

-- No insert, update or delete policy of any kind. The browser cannot start a
-- run, cannot score one, and cannot remove one it does not like the look of.
-- Absence is the policy — RLS denies anything not explicitly allowed, so this
-- comment is the only thing here, and it is here so nobody adds one by accident.

-- ---------------------------------------------------------------------------
-- Housekeeping: runs that were started and never finished.
--
-- Every "play" press creates a row, and most runs end with the tab being
-- closed. Without this the table is mostly abandoned rows forever. Nothing
-- depends on it running — an unsubmitted run is already invisible to every
-- query — so it is a plain function to call from a scheduled job rather than a
-- trigger that has to be right.
-- ---------------------------------------------------------------------------
create or replace function public.prune_abandoned_runs()
returns integer
language sql
security definer
set search_path = public
as $$
  with gone as (
    delete from public.runs
    where submitted_at is null
      and started_at < now() - interval '12 hours'
    returning 1
  )
  select count(*)::integer from gone;
$$;