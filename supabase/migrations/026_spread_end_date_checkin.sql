-- Migration 026: Add end_date_checked_in to spread_placements
-- Run in Supabase SQL editor

alter table spread_placements
  add column if not exists end_date_checked_in boolean not null default false;
