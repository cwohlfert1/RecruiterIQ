-- Migration 024: Add project_id and jd_context to assessment_invites
-- Run in Supabase SQL editor

alter table assessment_invites
  add column if not exists project_id uuid references projects(id),
  add column if not exists jd_context text;
