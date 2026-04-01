-- =============================================================================
-- Migration 005: RecruiterIQ Projects Module
-- Version: 005
-- Depends on: 001_initial_schema.sql, 002_assessments_schema.sql,
--             003_red_flags.sql
-- (Note: 004 is reserved; run this as 005)
--
-- Execution order (resolves forward-reference issue):
--   1. CREATE TABLE projects
--   2. CREATE TABLE project_members
--   3. CREATE FUNCTION is_project_member / is_project_collaborator
--      (LANGUAGE sql validates table refs at creation — tables must exist first)
--   4. RLS policies for projects + project_members
--   5. Remaining tables + RLS
--   6. notifications type extension
-- =============================================================================


-- =============================================================================
-- 1. TABLE: projects (created first — referenced by project_members FK)
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

CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX IF NOT EXISTS idx_projects_owner_id   ON public.projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_status     ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON public.projects(created_at DESC);


-- =============================================================================
-- 2. TABLE: project_members (created second — referenced by RLS helper functions)
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

CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON public.project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user_id    ON public.project_members(user_id);


-- =============================================================================
-- 3. RLS HELPER FUNCTIONS
-- Created after project_members exists — LANGUAGE sql validates table refs
-- at function creation time (unlike plpgsql which defers to call time).
-- SECURITY DEFINER prevents RLS recursion: project_members RLS policies call
-- these functions, which need to read project_members directly.
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
-- 4. RLS: projects
-- =============================================================================

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "projects_select" ON public.projects;
CREATE POLICY "projects_select" ON public.projects
  FOR SELECT USING (
    owner_id = auth.uid()
    OR is_project_member(id)
  );

DROP POLICY IF EXISTS "projects_insert" ON public.projects;
CREATE POLICY "projects_insert" ON public.projects
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND owner_id = auth.uid()
  );

DROP POLICY IF EXISTS "projects_update" ON public.projects;
CREATE POLICY "projects_update" ON public.projects
  FOR UPDATE USING (
    owner_id = auth.uid()
    OR is_project_collaborator(id)
  );

DROP POLICY IF EXISTS "projects_delete" ON public.projects;
CREATE POLICY "projects_delete" ON public.projects
  FOR DELETE USING (owner_id = auth.uid());


-- =============================================================================
-- 5. RLS: project_members
-- =============================================================================

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_members_select" ON public.project_members;
CREATE POLICY "project_members_select" ON public.project_members
  FOR SELECT USING (is_project_member(project_id));

DROP POLICY IF EXISTS "project_members_insert" ON public.project_members;
CREATE POLICY "project_members_insert" ON public.project_members
  FOR INSERT WITH CHECK (is_project_collaborator(project_id));

DROP POLICY IF EXISTS "project_members_update" ON public.project_members;
CREATE POLICY "project_members_update" ON public.project_members
  FOR UPDATE USING (is_project_collaborator(project_id));

DROP POLICY IF EXISTS "project_members_delete" ON public.project_members;
CREATE POLICY "project_members_delete" ON public.project_members
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_id AND owner_id = auth.uid()
    )
  );


-- =============================================================================
-- 6. TABLE: project_candidates
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.project_candidates (
  id                   uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id           uuid        NOT NULL REFERENCES public.projects(id)           ON DELETE CASCADE,
  candidate_name       text        NOT NULL,
  candidate_email      text        NOT NULL,
  resume_text          text        NOT NULL,
  cqi_score            integer     CHECK (cqi_score      BETWEEN 0 AND 100),
  cqi_breakdown_json   jsonb,
  red_flag_score       integer     CHECK (red_flag_score BETWEEN 0 AND 100),
  red_flag_summary     text,
  red_flags_json       jsonb,
  assessment_invite_id uuid        REFERENCES public.assessment_invites(id)          ON DELETE SET NULL,
  added_by             uuid        REFERENCES auth.users(id)                         ON DELETE SET NULL,
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

DROP POLICY IF EXISTS "project_candidates_select" ON public.project_candidates;
CREATE POLICY "project_candidates_select" ON public.project_candidates
  FOR SELECT USING (is_project_member(project_id));

DROP POLICY IF EXISTS "project_candidates_insert" ON public.project_candidates;
CREATE POLICY "project_candidates_insert" ON public.project_candidates
  FOR INSERT WITH CHECK (is_project_collaborator(project_id));

DROP POLICY IF EXISTS "project_candidates_update" ON public.project_candidates;
CREATE POLICY "project_candidates_update" ON public.project_candidates
  FOR UPDATE USING (is_project_collaborator(project_id));

DROP POLICY IF EXISTS "project_candidates_delete" ON public.project_candidates;
CREATE POLICY "project_candidates_delete" ON public.project_candidates
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_id AND owner_id = auth.uid()
    )
  );

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


-- =============================================================================
-- 7. TABLE: project_boolean_strings
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
  -- No unique constraint on (project_id, user_id) — history rows kept on regenerate.
);

ALTER TABLE public.project_boolean_strings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_boolean_strings_select" ON public.project_boolean_strings;
CREATE POLICY "project_boolean_strings_select" ON public.project_boolean_strings
  FOR SELECT USING (
    is_project_member(project_id)
    AND (
      is_project_collaborator(project_id)
      OR user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "project_boolean_strings_insert" ON public.project_boolean_strings;
CREATE POLICY "project_boolean_strings_insert" ON public.project_boolean_strings
  FOR INSERT WITH CHECK (is_project_collaborator(project_id));

DROP POLICY IF EXISTS "project_boolean_strings_update" ON public.project_boolean_strings;
CREATE POLICY "project_boolean_strings_update" ON public.project_boolean_strings
  FOR UPDATE USING (is_project_collaborator(project_id));

DROP POLICY IF EXISTS "project_boolean_strings_delete" ON public.project_boolean_strings;
CREATE POLICY "project_boolean_strings_delete" ON public.project_boolean_strings
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_id AND owner_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_project_boolean_strings_project_id
  ON public.project_boolean_strings(project_id);
CREATE INDEX IF NOT EXISTS idx_project_boolean_strings_user_id
  ON public.project_boolean_strings(project_id, user_id);
CREATE INDEX IF NOT EXISTS idx_project_boolean_strings_created_at
  ON public.project_boolean_strings(project_id, created_at DESC);
-- Partial unique index: enforces one active row per (project_id, user_id) at DB level
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_boolean_strings_active_unique
  ON public.project_boolean_strings(project_id, user_id)
  WHERE is_active = true;


-- =============================================================================
-- 8. TABLE: project_activity
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

DROP POLICY IF EXISTS "project_activity_select" ON public.project_activity;
CREATE POLICY "project_activity_select" ON public.project_activity
  FOR SELECT USING (is_project_member(project_id));

-- INSERT: no user-facing policy — service role only (bypasses RLS)
-- UPDATE: none — append-only
-- DELETE: none — append-only

CREATE INDEX IF NOT EXISTS idx_project_activity_project_created
  ON public.project_activity(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_activity_user_id
  ON public.project_activity(user_id);


-- =============================================================================
-- 9. EXTEND notifications.type CHECK CONSTRAINT
-- notifications.type is a CHECK constraint (not a PG ENUM) as created in
-- migration 002. Drop and recreate to add 'project_shared'.
-- If the name differs, run:
--   SELECT conname FROM pg_constraint
--   WHERE conrelid = 'public.notifications'::regclass AND contype = 'c';
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
