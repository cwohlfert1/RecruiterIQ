-- Migration 025: Add linkedin_url to project_candidates
-- Run in Supabase SQL editor

alter table project_candidates
  add column if not exists linkedin_url text;
