-- =============================================================================
-- Migration 018: Pipeline stages overhaul, pay rate, boolean edits, job boards
-- Depends on: 017_internal_submittal_stage.sql
-- =============================================================================

-- ── PHASE 1: Simplify pipeline stages ─────────────────────────────────────────
-- Remove phone_screen, am_review, assessment_sent → add assessment, keep internal_submittal

-- Migrate existing rows before dropping the constraint
UPDATE public.project_candidates
  SET pipeline_stage = 'contacted'
  WHERE pipeline_stage = 'phone_screen';

UPDATE public.project_candidates
  SET pipeline_stage = 'internal_submittal'
  WHERE pipeline_stage = 'am_review';

UPDATE public.project_candidates
  SET pipeline_stage = 'assessment'
  WHERE pipeline_stage = 'assessment_sent';

-- Drop both old constraints (017 added one, 006 added another name)
ALTER TABLE public.project_candidates
  DROP CONSTRAINT IF EXISTS project_candidates_pipeline_stage_check;

-- New canonical set of stages
ALTER TABLE public.project_candidates
  ADD CONSTRAINT project_candidates_pipeline_stage_check
    CHECK (pipeline_stage IN (
      'sourced',
      'contacted',
      'internal_submittal',
      'assessment',
      'submitted',
      'placed',
      'rejected'
    ));

-- ── PHASE 4: Pay rate fields ───────────────────────────────────────────────────
ALTER TABLE public.project_candidates
  ADD COLUMN IF NOT EXISTS pay_rate_min  integer,
  ADD COLUMN IF NOT EXISTS pay_rate_max  integer,
  ADD COLUMN IF NOT EXISTS pay_rate_type text DEFAULT 'hourly';

-- ── PHASE 2: Boolean edit tracking ────────────────────────────────────────────
ALTER TABLE public.project_boolean_strings
  ADD COLUMN IF NOT EXISTS is_edited       boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS original_linkedin_string text,
  ADD COLUMN IF NOT EXISTS original_indeed_string   text;

-- ── PHASE 5: Job board preferences ────────────────────────────────────────────
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS job_boards jsonb DEFAULT '["linkedin"]'::jsonb;
