-- Player progress, on the server.
--
-- Run this once in the Supabase dashboard: SQL Editor -> New query -> paste ->
-- Run. It is safe to run more than once.
--
-- ---------------------------------------------------------------------------
-- The shape of the security here is the whole point, so it is worth reading.
--
-- The browser may READ its own row and nothing else. It may not write at all —
-- not gems, not gold, not even which hat you are wearing. Every write goes
-- through server code holding the service key.
--
-- That is not paranoia about hats. It is that anyone can open the console and
-- call the database with their own key, so a policy that lets the browser write
-- `gold` is a policy that lets the browser set `gold` to a million. PRD FR-15.8
-- says currency is written server-side; this is that sentence as SQL.
-- ---------------------------------------------------------------------------

create table if not exists public.progress (
  user_id uuid primary key references auth.users (id) on delete cascade,

  -- Item id -> level owned. Mirrors the `levels` map the shop already uses.
  levels jsonb not null default '{}'::jsonb,

  -- Gems by grade, and the two currencies. Integers, never negative — a
  -- constraint rather than a convention, because a negative balance is the
  -- shape most currency bugs take.
  gems integer[] not null default '{}',
  gold integer not null default 0 check (gold >= 0),
  legendaries integer not null default 0 check (legendaries >= 0),

  -- Shortcut ids whose levers have been flicked. FR-3.3 makes these permanent,
  -- so this is the one list that may only ever grow.
  levered text[] not null default '{}',

  -- Cosmetics. No effect on a run; kept here so a player's look follows them.
  skin text,
  pet text,

  updated_at timestamptz not null default now()
);

alter table public.progress enable row level security;

-- Read your own row. Nothing more.
drop policy if exists "read own progress" on public.progress;
create policy "read own progress"
  on public.progress
  for select
  using (auth.uid() = user_id);

-- Deliberately absent: insert, update and delete policies. With row-level
-- security on and no policy for an action, that action is denied to everyone
-- holding the public key. The service key ignores policies, which is exactly
-- why it lives on the server and only there.

-- Give every new account a row, so the game never has to handle "signed in but
-- has no save". A trigger rather than application code because it must also
-- cover accounts made from the dashboard.
create or replace function public.give_new_player_progress()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.progress (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.give_new_player_progress();

-- And rows for the accounts that already exist.
insert into public.progress (user_id)
select id from auth.users
on conflict (user_id) do nothing;
