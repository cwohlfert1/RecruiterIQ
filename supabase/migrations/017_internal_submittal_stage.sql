-- =============================================================================
-- Migration 017: Add internal_submittal to pipeline_stage CHECK constraint
-- Version: 017
-- Depends on: 006_pipeline_stages.sql
-- =============================================================================

-- PostgreSQL requires dropping and re-adding CHECK constraints to modify them.
-- The constraint name was auto-generated; drop by name if known, else use the
-- column-level inline constraint pattern (re-create with ALTER COLUMN ... SET).

-- Step 1: Drop the existing check constraint
ALTER TABLE public.project_candidates
  DROP CONSTRAINT IF EXISTS project_candidates_pipeline_stage_check;

-- Step 2: Add updated constraint with internal_submittal included
ALTER TABLE public.project_candidates
  ADD CONSTRAINT project_candidates_pipeline_stage_check
    CHECK (pipeline_stage IN (
      'sourced',
      'contacted',
      'phone_screen',
      'am_review',
      'assessment_sent',
      'internal_submittal',
      'submitted',
      'placed',
      'rejected'
    ));
