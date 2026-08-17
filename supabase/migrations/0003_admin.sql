-- Admin, as something the SERVER knows.
--
-- Run this once in the Supabase dashboard: SQL Editor -> New query -> paste ->
-- Run. It is safe to run more than once.
--
-- ---------------------------------------------------------------------------
-- WHY THIS IS A COLUMN AND NOT A FLAG IN A REQUEST.
--
-- Admin runs are allowed on the leaderboards, which means the replay that
-- verifies them has to run with the same invincibility the player had — replay
-- an admin run without it and the player dies where they did not, and the score
-- comes out wrong.
--
-- So the server needs to know. It cannot ask the browser: "this run is an admin
-- run" is precisely the sentence a cheat would send, because it buys an
-- invincible run that still scores. `runs.admin` is therefore copied from
-- `progress.admin` at the moment the run is opened, before a tick is played,
-- and the replay reads it from the row.
--
-- `progress.admin` is granted by hand, here, by somebody with dashboard access.
-- There is no endpoint that grants it and there should never be one.
-- ---------------------------------------------------------------------------

alter table public.progress
  add column if not exists admin boolean not null default false;

alter table public.runs
  add column if not exists admin boolean not null default false;

-- Board rows carry it so the leaderboard can label them. An invincible run
-- sitting unmarked at the top of a board is the board lying, and the whole
-- claim being made about these boards is that they do not.
create index if not exists runs_admin_idx on public.runs (admin)
  where submitted_at is not null;

-- ---------------------------------------------------------------------------
-- Granting it. Replace the address, run, done.
--
--   update public.progress set admin = true
--   where user_id = (select id from auth.users where email = 'you@example.com');
--
-- And taking it away is the same with `false`.
-- ---------------------------------------------------------------------------
