-- =============================================================================
-- Migration 005: RecruiterIQ Projects Module
-- Version: 005
-- Depends on: 001_initial_schema.sql, 002_assessments_schema.sql,
--             003_red_flags.sql
-- (Note: 004 is reserved; run this as 005)
--
-- New tables:
--   projects                  — Project definitions (owner, title, client, JD)
--   project_members           — Role-based team membership per project
--   project_candidates        — Candidates within a project (pipeline)
--   project_boolean_strings   — Per-recruiter Boolean variations (with history)
--   project_activity          — Append-only action log per project
--
-- Modifications to existing tables:
--   notifications             — Extends type CHECK to add 'project_shared'
--
-- Helper RLS functions:
--   is_project_member(uuid)       — true if caller is any member of the project
--   is_project_collaborator(uuid) — true if caller is owner or collaborator
--
-- Plan gating (enforced in application layer — documented here as reference):
--   Free:   max 1 active project  (status IN ('active','on_hold'))
--   Pro:    max 10 active projects
--   Agency: unlimited
-- =============================================================================


-- =============================================================================
-- 1. RLS HELPER FUNCTIONS
-- SECURITY DEFINER is required so these functions can read project_members
-- without triggering RLS recursion (project_members policies call these same
-- functions, which would otherwise cause circular evaluation).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.is_project_member(p_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = p_id
      AND user_id    = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_project_collaborator(p_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = p_id
      AND user_id    = auth.uid()
      AND role IN ('owner', 'collaborator')
  );
$$;


-- =============================================================================
-- 2. TABLE: projects
--
-- One row per job opening / project. Owner is always a member (owner role).
-- JD is optional at creation; can be added/updated later.
-- Status 'active' and 'on_hold' count toward plan limit; 'filled' and
-- 'archived' do not.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.projects (
  id          uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       text        NOT NULL CHECK (char_length(title)       BETWEEN 1 AND 100),
  client_name text        NOT NULL CHECK (char_length(client_name) BETWEEN 1 AND 100),
  jd_text     text,
  status      text        NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'filled', 'on_hold', 'archived')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Reuse the update_updated_at() trigger function from migration 001.
CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- SELECT: owner or any project member
DROP POLICY IF EXISTS "projects_select" ON public.projects;
CREATE POLICY "projects_select" ON public.projects
  FOR SELECT USING (
    owner_id = auth.uid()
    OR is_project_member(id)
  );

-- INSERT: authenticated users; owner_id must equal caller
DROP POLICY IF EXISTS "projects_insert" ON public.projects;
CREATE POLICY "projects_insert" ON public.projects
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND owner_id = auth.uid()
  );

-- UPDATE: owner or collaborator role
DROP POLICY IF EXISTS "projects_update" ON public.projects;
CREATE POLICY "projects_update" ON public.projects
  FOR UPDATE USING (
    owner_id = auth.uid()
    OR is_project_collaborator(id)
  );

-- DELETE: owner only (cascade removes all child rows)
DROP POLICY IF EXISTS "projects_delete" ON public.projects;
CREATE POLICY "projects_delete" ON public.projects
  FOR DELETE USING (owner_id = auth.uid());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_projects_owner_id   ON public.projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_status     ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON public.projects(created_at DESC);


-- =============================================================================
-- 3. TABLE: project_members
--
-- Role-based team membership. The project owner is inserted here as 'owner'
-- by the /api/projects/create route immediately after project creation.
-- UNIQUE (project_id, user_id) prevents duplicate membership rows.
--
-- Roles:
--   owner       — full access; can delete project and manage members
--   collaborator — can add candidates, run scoring/red flag/boolean/assessments
--   viewer      — read-only; cannot add or modify anything
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.project_members (
  id         uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES auth.users(id)  ON DELETE CASCADE,
  role       text        NOT NULL CHECK (role IN ('owner', 'collaborator', 'viewer')),
  added_by   uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  added_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- SELECT: any member can see the full member list for the project
DROP POLICY IF EXISTS "project_members_select" ON public.project_members;
CREATE POLICY "project_members_select" ON public.project_members
  FOR SELECT USING (is_project_member(project_id));

-- INSERT: collaborator+ can add new members (including owner adding viewers)
DROP POLICY IF EXISTS "project_members_insert" ON public.project_members;
CREATE POLICY "project_members_insert" ON public.project_members
  FOR INSERT WITH CHECK (is_project_collaborator(project_id));

-- UPDATE: collaborator+ can change roles
DROP POLICY IF EXISTS "project_members_update" ON public.project_members;
CREATE POLICY "project_members_update" ON public.project_members
  FOR UPDATE USING (is_project_collaborator(project_id));

-- DELETE: owner only — verified via projects table to avoid RLS helper recursion
DROP POLICY IF EXISTS "project_members_delete" ON public.project_members;
CREATE POLICY "project_members_delete" ON public.project_members
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_id AND owner_id = auth.uid()
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON public.project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user_id    ON public.project_members(user_id);


-- =============================================================================
-- 4. TABLE: project_candidates
--
-- One row per candidate per project. UNIQUE on (project_id, candidate_email)
-- prevents duplicate candidate entries within a project (enforced at DB level;
-- same email is allowed in different projects).
--
-- Soft-delete via deleted_at — candidate rows are never hard-deleted; the app
-- filters WHERE deleted_at IS NULL for normal views.
--
-- cqi_score:       filled on add (if JD exists) or via batch-score action.
-- red_flag_score:  filled when "Check Red Flags" action is run.
-- assessment_invite_id: linked when "Send Assessment" action is used;
--   SET NULL on delete so dropping an invite doesn't cascade-delete the candidate.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.project_candidates (
  id                   uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id           uuid        NOT NULL REFERENCES public.projects(id)            ON DELETE CASCADE,
  candidate_name       text        NOT NULL,
  candidate_email      text        NOT NULL,
  resume_text          text        NOT NULL,
  cqi_score            integer     CHECK (cqi_score       BETWEEN 0 AND 100),
  cqi_breakdown_json   jsonb,
  red_flag_score       integer     CHECK (red_flag_score  BETWEEN 0 AND 100),
  red_flag_summary     text,
  red_flags_json       jsonb,
  assessment_invite_id uuid        REFERENCES public.assessment_invites(id)           ON DELETE SET NULL,
  added_by             uuid        REFERENCES auth.users(id)                          ON DELETE SET NULL,
  status               text        NOT NULL DEFAULT 'reviewing'
                                   CHECK (status IN ('reviewing', 'screening', 'submitted', 'rejected')),
  deleted_at           timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, candidate_email)
);

CREATE TRIGGER project_candidates_updated_at
  BEFORE UPDATE ON public.project_candidates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.project_candidates ENABLE ROW LEVEL SECURITY;

-- SELECT: any member can see candidates (app filters deleted_at IS NULL in queries)
DROP POLICY IF EXISTS "project_candidates_select" ON public.project_candidates;
CREATE POLICY "project_candidates_select" ON public.project_candidates
  FOR SELECT USING (is_project_member(project_id));

-- INSERT: collaborator+ can add candidates
DROP POLICY IF EXISTS "project_candidates_insert" ON public.project_candidates;
CREATE POLICY "project_candidates_insert" ON public.project_candidates
  FOR INSERT WITH CHECK (is_project_collaborator(project_id));

-- UPDATE: collaborator+ can update scores, status, red flags, deleted_at
DROP POLICY IF EXISTS "project_candidates_update" ON public.project_candidates;
CREATE POLICY "project_candidates_update" ON public.project_candidates
  FOR UPDATE USING (is_project_collaborator(project_id));

-- DELETE (hard): owner only; soft-delete (deleted_at) is preferred
DROP POLICY IF EXISTS "project_candidates_delete" ON public.project_candidates;
CREATE POLICY "project_candidates_delete" ON public.project_candidates
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_id AND owner_id = auth.uid()
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_project_candidates_project_id
  ON public.project_candidates(project_id);
CREATE INDEX IF NOT EXISTS idx_project_candidates_status
  ON public.project_candidates(project_id, status);
CREATE INDEX IF NOT EXISTS idx_project_candidates_cqi_score
  ON public.project_candidates(project_id, cqi_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_project_candidates_created_at
  ON public.project_candidates(project_id, created_at);
CREATE INDEX IF NOT EXISTS idx_project_candidates_added_by
  ON public.project_candidates(project_id, added_by);
-- (project_id, candidate_email) unique index created implicitly by UNIQUE constraint


-- =============================================================================
-- 5. TABLE: project_boolean_strings
--
-- Per-recruiter Boolean search string variations for a project. There is NO
-- unique constraint on (project_id, user_id) because history is preserved when
-- a recruiter regenerates their string: old rows are set to is_active = false
-- and a new row with is_active = true is inserted.
--
-- Application invariant (not enforced at DB level):
--   At most ONE row per (project_id, user_id) should have is_active = true.
--   Application must UPDATE is_active = false on prior rows before INSERT.
--
-- Partial index on (project_id, user_id) WHERE is_active = true makes the
-- "load active variation per recruiter" query fast.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.project_boolean_strings (
  id              uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id      uuid        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id         uuid        NOT NULL REFERENCES auth.users(id)  ON DELETE CASCADE,
  linkedin_string text        NOT NULL,
  indeed_string   text        NOT NULL,
  is_active       boolean     NOT NULL DEFAULT true,
  created_by      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
  -- No unique constraint on (project_id, user_id) — history is kept.
);

ALTER TABLE public.project_boolean_strings ENABLE ROW LEVEL SECURITY;

-- SELECT:
--   collaborator+ sees all variations for the project (manager table view)
--   viewer/recruiter sees only their own user_id row
DROP POLICY IF EXISTS "project_boolean_strings_select" ON public.project_boolean_strings;
CREATE POLICY "project_boolean_strings_select" ON public.project_boolean_strings
  FOR SELECT USING (
    is_project_member(project_id)
    AND (
      is_project_collaborator(project_id)
      OR user_id = auth.uid()
    )
  );

-- INSERT: collaborator+ (API route generates and inserts variations)
DROP POLICY IF EXISTS "project_boolean_strings_insert" ON public.project_boolean_strings;
CREATE POLICY "project_boolean_strings_insert" ON public.project_boolean_strings
  FOR INSERT WITH CHECK (is_project_collaborator(project_id));

-- UPDATE: collaborator+ (for setting is_active = false on old rows)
DROP POLICY IF EXISTS "project_boolean_strings_update" ON public.project_boolean_strings;
CREATE POLICY "project_boolean_strings_update" ON public.project_boolean_strings
  FOR UPDATE USING (is_project_collaborator(project_id));

-- DELETE: owner only
DROP POLICY IF EXISTS "project_boolean_strings_delete" ON public.project_boolean_strings;
CREATE POLICY "project_boolean_strings_delete" ON public.project_boolean_strings
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_id AND owner_id = auth.uid()
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_project_boolean_strings_project_id
  ON public.project_boolean_strings(project_id);
CREATE INDEX IF NOT EXISTS idx_project_boolean_strings_user_id
  ON public.project_boolean_strings(project_id, user_id);
CREATE INDEX IF NOT EXISTS idx_project_boolean_strings_created_at
  ON public.project_boolean_strings(project_id, created_at DESC);
-- Partial index: fast lookup of the single active variation per recruiter
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_boolean_strings_active_unique
  ON public.project_boolean_strings(project_id, user_id)
  WHERE is_active = true;
-- ↑ This UNIQUE partial index enforces the application invariant at DB level:
--   only one active row per (project_id, user_id) is possible.
--   The application still UPDATEs old rows to is_active = false before INSERT,
--   but the index provides a hard DB-level guarantee.


-- =============================================================================
-- 6. TABLE: project_activity
--
-- Append-only action log. One row per write event in the project.
-- Inserted by server-side API routes using the service role client.
-- No user-facing INSERT policy — RLS INSERT is intentionally absent.
-- SELECT is open to all project members.
-- UPDATE and DELETE are never allowed.
--
-- Supported action_type values (enforced in application; not a CHECK constraint
-- to allow future extension without a schema migration):
--   'project_created', 'candidate_added', 'candidate_scored',
--   'candidate_status_changed', 'red_flag_checked', 'boolean_generated',
--   'boolean_regenerated', 'assessment_sent', 'assessment_completed',
--   'project_shared', 'jd_updated', 'project_status_changed',
--   'member_added', 'batch_score_started', 'batch_score_completed'
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.project_activity (
  id            uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id    uuid        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  action_type   text        NOT NULL,
  metadata_json jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_activity ENABLE ROW LEVEL SECURITY;

-- SELECT: any project member can view the full activity feed
DROP POLICY IF EXISTS "project_activity_select" ON public.project_activity;
CREATE POLICY "project_activity_select" ON public.project_activity
  FOR SELECT USING (is_project_member(project_id));

-- INSERT: no user-facing policy — service role only (bypasses RLS)
-- UPDATE: none — append-only
-- DELETE: none — append-only

-- Indexes
CREATE INDEX IF NOT EXISTS idx_project_activity_project_created
  ON public.project_activity(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_activity_user_id
  ON public.project_activity(user_id);


-- =============================================================================
-- 7. EXTEND notifications.type CHECK CONSTRAINT
--
-- The notifications table was created in migration 002 with an inline CHECK
-- constraint auto-named 'notifications_type_check'. We drop it and recreate
-- it with 'project_shared' added.
--
-- If the constraint name differs in your environment, run:
--   SELECT conname FROM pg_constraint
--   WHERE conrelid = 'public.notifications'::regclass AND contype = 'c';
-- to find the actual name.
-- =============================================================================

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
    CHECK (type IN (
      'assessment_completed',
      'assessment_started',
      'invite_expired',
      'project_shared'
    ));
