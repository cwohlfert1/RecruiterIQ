-- Migration 020: Spread Tracker — placement tracking + high watermark
-- Run in Supabase SQL editor

-- Placements table
create table if not exists spread_placements (
  id                uuid         primary key default gen_random_uuid(),
  user_id           uuid         not null references auth.users(id),
  consultant_name   text         not null,
  client_company    text         not null,
  client_color      text         not null default '#6366F1',
  role              text         not null,
  weekly_spread     numeric(10,2) not null,
  contract_end_date date         not null,
  status            text         not null default 'active'
                    check (status in ('active', 'locked_up', 'falling_off')),
  notes             text,
  created_at        timestamptz  not null default now(),
  updated_at        timestamptz  not null default now()
);

alter table spread_placements enable row level security;

create policy "Users manage own placements"
  on spread_placements for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index spread_placements_user_id on spread_placements (user_id);

-- updated_at trigger
create or replace function update_spread_placements_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger spread_placements_updated_at
  before update on spread_placements
  for each row execute function update_spread_placements_updated_at();

-- All Time High watermark
create table if not exists spread_high_watermark (
  user_id     uuid         primary key references auth.users(id),
  high_amount numeric(10,2) not null default 0,
  achieved_at timestamptz  not null default now()
);

alter table spread_high_watermark enable row level security;

create policy "Users manage own watermark"
  on spread_high_watermark for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
