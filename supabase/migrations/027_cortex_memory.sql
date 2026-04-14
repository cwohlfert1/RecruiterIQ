-- Migration 027: Cortex AI memory per user
-- Run in Supabase SQL editor

create table if not exists cortex_memory (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id),
  memory_key   text        not null,
  memory_value text        not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table cortex_memory enable row level security;

create policy "Users manage own memory"
  on cortex_memory for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create unique index cortex_memory_user_key on cortex_memory (user_id, memory_key);
