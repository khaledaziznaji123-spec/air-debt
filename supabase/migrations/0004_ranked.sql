-- Ranked runs.
--
-- Run this once in the Supabase dashboard: SQL Editor -> New query -> paste ->
-- Run. It is safe to run more than once.
--
-- ---------------------------------------------------------------------------
-- A ranked run is played on equipment nobody had to earn: every weapon and every
-- piece of gear at its top tier, and every shortcut already open. That is the
-- point of it — a leaderboard where the winner is whoever has played longest
-- measures hours rather than skill, and the shop is a progression system for
-- Story rather than a thing to compete through.
--
-- It is a column for the same reason `admin` is. The loadout and the open
-- shortcuts are frozen onto the row before the first tick and the replay is run
-- against exactly those, so "this was a ranked run" cannot be a sentence the
-- browser sends — it would be a request for maxed gear with a real score on it.
--
-- Only ranked runs carry a score. Story runs still record what they did and
-- still credit their loot; they simply do not rank, because a starting-gear run
-- and a maxed one on the same board would be a board measuring equipment.
-- ---------------------------------------------------------------------------

alter table public.runs
  add column if not exists ranked boolean not null default false;

-- The board queries all filter on it now, so it belongs in both indexes.
drop index if exists runs_riches_idx;
drop index if exists runs_speed_idx;

create index if not exists runs_riches_idx
  on public.runs (riches desc, submitted_at asc)
  where submitted_at is not null and riches is not null and ranked;

create index if not exists runs_speed_idx
  on public.runs (speed desc, submitted_at asc)
  where submitted_at is not null and speed is not null and ranked;

-- Anything already on a board was played before ranked existed, on whatever
-- gear that account happened to own. Those are Story runs by definition, and
-- leaving them ranked would seed the boards with the exact comparison this
-- migration exists to prevent.
update public.runs set riches = null, speed = null where not ranked;
