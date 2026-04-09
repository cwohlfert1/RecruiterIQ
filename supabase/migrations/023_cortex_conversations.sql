-- Migration 023: Cortex AI assistant conversation history
-- Run in Supabase SQL editor

create table if not exists cortex_conversations (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id),
  role         text        not null check (role in ('user', 'assistant')),
  content      text        not null,
  page_context text,
  created_at   timestamptz not null default now()
);

alter table cortex_conversations enable row level security;

create policy "Users manage own messages"
  on cortex_conversations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index cortex_conversations_user_created
  on cortex_conversations (user_id, created_at desc);
