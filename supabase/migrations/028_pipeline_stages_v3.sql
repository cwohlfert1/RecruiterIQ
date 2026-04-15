-- Migration 028: Pipeline stages overhaul v3
-- New stages: reviewing, screened, internal_submittal, client_submittal, interviewing, placed, rejected
-- Run in Supabase SQL editor

-- 1. Migrate old stage values to new
UPDATE project_candidates SET pipeline_stage = 'reviewing'         WHERE pipeline_stage = 'sourced';
UPDATE project_candidates SET pipeline_stage = 'screened'          WHERE pipeline_stage = 'contacted';
UPDATE project_candidates SET pipeline_stage = 'client_submittal'  WHERE pipeline_stage = 'submitted';
UPDATE project_candidates SET pipeline_stage = 'interviewing'      WHERE pipeline_stage = 'assessment';
-- internal_submittal, placed, rejected stay the same

-- 2. Drop old constraint and add new
ALTER TABLE project_candidates DROP CONSTRAINT IF EXISTS project_candidates_pipeline_stage_check;
ALTER TABLE project_candidates ADD CONSTRAINT project_candidates_pipeline_stage_check
  CHECK (pipeline_stage IN (
    'reviewing',
    'screened',
    'internal_submittal',
    'client_submittal',
    'interviewing',
    'placed',
    'rejected'
  ));
