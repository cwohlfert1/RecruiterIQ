-- Migration 012: Session 3 — Teams webhook, hired badges, flag badges on candidates

-- ── Teams webhook on projects ─────────────────────────────────────────────────
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS teams_webhook_url text;

-- ── flag_type snapshot on project_candidates (for fast display without join) ──
ALTER TABLE project_candidates
  ADD COLUMN IF NOT EXISTS flag_type text
    CHECK (flag_type IN ('catfish', 'dnu', 'watch'));

-- ── hired_candidate_name cache on projects (for fast project card display) ────
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS hired_candidate_name text;
