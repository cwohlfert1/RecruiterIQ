-- Migration 010: Session 1 — Companies, Hire Benchmarks, Flagged Candidates,
-- Candidate Notes, project_boolean_strings variants, project_candidates reactions,
-- agency branding on user_profiles

-- ── New tables ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS companies (
  id               uuid primary key default gen_random_uuid(),
  agency_owner_id  uuid references auth.users not null,
  name             text not null,
  logo_url         text,
  industry         text,
  website          text,
  created_at       timestamptz default now()
);

CREATE TABLE IF NOT EXISTS hire_benchmarks (
  id               uuid primary key default gen_random_uuid(),
  agency_owner_id  uuid references auth.users,
  role_keywords    text[],
  template_type    text,
  cqi_score        integer,
  trust_score      integer,
  skill_score      integer,
  resume_summary   text,
  project_id       uuid references projects(id),
  hired_at         timestamptz default now(),
  created_at       timestamptz default now()
);

CREATE TABLE IF NOT EXISTS flagged_candidates (
  id                  uuid primary key default gen_random_uuid(),
  flagged_by          uuid references auth.users,
  agency_owner_id     uuid references auth.users,
  candidate_email     text not null,
  candidate_name      text,
  flag_type           text check (flag_type in ('catfish', 'dnu', 'watch')),
  reason              text,
  source_project_id   uuid references projects(id),
  source_session_id   uuid references assessment_sessions(id),
  created_at          timestamptz default now()
);

CREATE TABLE IF NOT EXISTS project_candidate_notes (
  id           uuid primary key default gen_random_uuid(),
  candidate_id uuid references project_candidates(id) on delete cascade,
  project_id   uuid references projects(id),
  user_id      uuid references auth.users,
  content      text not null,
  created_at   timestamptz default now()
);

-- ── Alter existing tables ─────────────────────────────────────────────────────

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS hired_candidate_id uuid;

ALTER TABLE project_candidates
  ADD COLUMN IF NOT EXISTS starred boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS reaction text,
  ADD COLUMN IF NOT EXISTS hired boolean DEFAULT false;

ALTER TABLE project_boolean_strings
  ADD COLUMN IF NOT EXISTS variant_type      text DEFAULT 'targeted',
  ADD COLUMN IF NOT EXISTS feedback          text,
  ADD COLUMN IF NOT EXISTS refinement_count  integer DEFAULT 0;

-- Already added in 009_session_c but safe to repeat with IF NOT EXISTS
ALTER TABLE assessment_snapshots
  ADD COLUMN IF NOT EXISTS triggered_by_event text,
  ADD COLUMN IF NOT EXISTS event_severity     text;

-- Agency branding on user_profiles
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS agency_logo_url text,
  ADD COLUMN IF NOT EXISTS agency_name     text;

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE companies               ENABLE ROW LEVEL SECURITY;
ALTER TABLE hire_benchmarks         ENABLE ROW LEVEL SECURITY;
ALTER TABLE flagged_candidates      ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_candidate_notes ENABLE ROW LEVEL SECURITY;

-- companies: owner only
CREATE POLICY "companies_owner" ON companies
  FOR ALL USING (agency_owner_id = auth.uid());

-- hire_benchmarks: owner only
CREATE POLICY "hire_benchmarks_owner" ON hire_benchmarks
  FOR ALL USING (agency_owner_id = auth.uid());

-- flagged_candidates: agency owner reads all; flagged_by can insert
CREATE POLICY "flagged_candidates_owner_read" ON flagged_candidates
  FOR SELECT USING (agency_owner_id = auth.uid() OR flagged_by = auth.uid());

CREATE POLICY "flagged_candidates_insert" ON flagged_candidates
  FOR INSERT WITH CHECK (flagged_by = auth.uid());

-- project_candidate_notes: project members only (via project_members or owner)
CREATE POLICY "candidate_notes_project_member" ON project_candidate_notes
  FOR ALL USING (
    user_id = auth.uid()
    OR project_id IN (
      SELECT id FROM projects WHERE owner_id = auth.uid()
    )
    OR project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );
