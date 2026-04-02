-- =============================================================================
-- Migration 007: Assessment Enhancements — Session A
-- Version: 007
-- Depends on: 002_assessments_schema.sql
-- =============================================================================

-- ── assessments table additions ───────────────────────────────────────────────

ALTER TABLE assessments ADD COLUMN IF NOT EXISTS
  expiry_hours integer DEFAULT 48;

ALTER TABLE assessments ADD COLUMN IF NOT EXISTS
  notification_recipients jsonb DEFAULT '[]';

ALTER TABLE assessments ADD COLUMN IF NOT EXISTS
  template_type text;

ALTER TABLE assessments ADD COLUMN IF NOT EXISTS
  allow_retakes boolean DEFAULT false;

ALTER TABLE assessments ADD COLUMN IF NOT EXISTS
  proctoring_intensity text DEFAULT 'standard';

-- ── assessment_sessions table additions ───────────────────────────────────────

ALTER TABLE assessment_sessions ADD COLUMN IF NOT EXISTS
  recruiter_decision text;

ALTER TABLE assessment_sessions ADD COLUMN IF NOT EXISTS
  decision_notes text;

-- ── assessment_invites table additions ────────────────────────────────────────

ALTER TABLE assessment_invites ADD COLUMN IF NOT EXISTS
  reminder_sent boolean DEFAULT false;

-- ── assessment_benchmarks table ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS assessment_benchmarks (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  template_type      text        NOT NULL UNIQUE,
  avg_skill_score    numeric(5,2),
  avg_trust_score    numeric(5,2),
  total_assessments  integer     DEFAULT 0,
  updated_at         timestamptz DEFAULT now()
);
