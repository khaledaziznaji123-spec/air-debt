-- Messages sent from the support form.
--
-- The same rule the rest of this schema is built on: the browser may not write
-- here. A public form is the one place a stranger's input reaches the database,
-- so it reaches it through server code holding the service key, which is where
-- the length limits and the rate limit live. An INSERT policy for `anon` would
-- be a public endpoint for filling a table.
--
-- Nothing here is read by the browser either. There is no SELECT policy, so the
-- only way to read a message is the service key or the Supabase dashboard.

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  -- Who sent it, as they typed it. Not trusted, not verified, and never used to
  -- identify anybody — it is how to write back, and that is all.
  name text not null,
  email text not null,
  body text not null,

  -- Set when the sender happened to be signed in. Not required: the support
  -- form is on a public page precisely so that somebody who cannot get INTO
  -- their account can still report that.
  user_id uuid references auth.users (id) on delete set null,

  -- What the browser said about itself, for reproducing a bug. Truncated by the
  -- server before it arrives.
  agent text,

  -- Support workflow, such as it is for one person: has this been dealt with.
  handled boolean not null default false
);

-- Newest first is the only way this table is ever read.
create index if not exists messages_created_idx
  on public.messages (created_at desc);

alter table public.messages enable row level security;

-- No policy of any kind, deliberately. Row-level security denies anything not
-- explicitly allowed, so absence IS the policy: the browser can neither read
-- these nor write them. Every route into this table goes through the server.