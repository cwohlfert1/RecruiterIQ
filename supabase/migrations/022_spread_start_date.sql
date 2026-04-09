-- Migration 022: Add expected_start_date and has_checked_in to spread_placements
-- Run in Supabase SQL editor

alter table spread_placements
  add column if not exists expected_start_date date,
  add column if not exists has_checked_in boolean not null default false;
