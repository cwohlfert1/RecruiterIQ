-- Migration 009: Session C — Event-triggered snapshot columns
-- Depends on: 002_assessments_schema.sql

ALTER TABLE assessment_snapshots
  ADD COLUMN IF NOT EXISTS triggered_by_event text;

ALTER TABLE assessment_snapshots
  ADD COLUMN IF NOT EXISTS event_severity text;
