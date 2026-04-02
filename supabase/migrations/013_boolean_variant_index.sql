-- Migration 013: Fix boolean strings unique index to support targeted + broad variants
-- The original index (005) only allowed one active row per (project_id, user_id).
-- Migration 010 added variant_type, so the index must include it to allow
-- one targeted and one broad active row per user per project.

DROP INDEX IF EXISTS idx_project_boolean_strings_active_unique;

CREATE UNIQUE INDEX idx_project_boolean_strings_active_unique
  ON project_boolean_strings(project_id, user_id, variant_type)
  WHERE is_active = true;
