-- Migration 021: Add insights_json column to project_candidates
-- Run in Supabase SQL editor

alter table project_candidates
  add column if not exists insights_json jsonb;
