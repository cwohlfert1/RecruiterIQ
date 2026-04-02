-- Migration 008: Add assessment_session_id to client_summaries
-- Depends on: assessments schema (assessment_sessions table)

ALTER TABLE client_summaries
  ADD COLUMN IF NOT EXISTS assessment_session_id uuid
    REFERENCES assessment_sessions(id) ON DELETE SET NULL;
