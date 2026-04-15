-- Migration 029: Placement outcomes + client intel for CQI learning
-- Run in Supabase SQL editor

create table if not exists placement_outcomes (
  id                    uuid         primary key default gen_random_uuid(),
  user_id               uuid         not null references auth.users(id),
  candidate_id          uuid,
  project_id            uuid,
  client_company        text         not null,
  job_title             text         not null,
  cqi_score             numeric(5,2),
  cqi_breakdown         jsonb,
  pipeline_stage_reached text,
  rejection_reason      text,
  catfish_notes         text,
  is_catfish            boolean      not null default false,
  outcome               text         not null check (outcome in ('rejected', 'placed', 'withdrawn')),
  notes                 text,
  created_at            timestamptz  not null default now()
);

alter table placement_outcomes enable row level security;
create policy "Users manage own outcomes"
  on placement_outcomes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index placement_outcomes_user_client on placement_outcomes (user_id, client_company);

create table if not exists client_intel (
  id                uuid         primary key default gen_random_uuid(),
  user_id           uuid         not null references auth.users(id),
  client_company    text         not null,
  job_title_tokens  text[]       not null default '{}',
  outcome_count     int          not null default 0,
  avg_cqi_placed    numeric(5,2),
  avg_cqi_rejected  numeric(5,2),
  success_threshold numeric(5,2),
  catfish_patterns  jsonb,
  last_updated      timestamptz  not null default now()
);

alter table client_intel enable row level security;
create policy "Users manage own intel"
  on client_intel for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create unique index client_intel_user_client on client_intel (user_id, client_company);
