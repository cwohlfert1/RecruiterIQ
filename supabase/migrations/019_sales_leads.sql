-- Migration 019: Enterprise AI sales agent lead capture
-- Run in Supabase SQL editor

create table if not exists sales_leads (
  id                uuid        primary key default gen_random_uuid(),
  session_id        uuid        not null unique,
  client_ip         text,
  name              text,
  email             text,
  company           text,
  team_size         text,
  conversation_json jsonb       not null default '[]',
  qualified         boolean     not null default false,
  drop_off          boolean     not null default false,
  drop_off_reason   text,
  inactivity_close  boolean     not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- All reads/writes go through service-role API routes — no client access
alter table sales_leads enable row level security;

-- updated_at trigger
create or replace function update_sales_leads_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger sales_leads_updated_at
  before update on sales_leads
  for each row execute function update_sales_leads_updated_at();

-- Index for IP-based rate limiting queries
create index sales_leads_client_ip_created_at on sales_leads (client_ip, created_at);
