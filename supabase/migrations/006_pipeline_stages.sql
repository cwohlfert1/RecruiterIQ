-- =============================================================================
-- Migration 006: Pipeline Stages, Tags, and Candidate Notes
-- Version: 006
-- Depends on: 005_projects_schema.sql
--
-- Changes:
--   1. Add pipeline_stage column to project_candidates (text with check constraint)
--   2. Add stage_changed_at column to project_candidates (for "days in stage")
--   3. Add tags_json column to project_candidates (jsonb array of tag strings)
--   4. Create project_candidate_notes table with RLS
-- =============================================================================


-- =============================================================================
-- 1. Add pipeline_stage to project_candidates
-- =============================================================================

ALTER TABLE public.project_candidates
  ADD COLUMN IF NOT EXISTS pipeline_stage text NOT NULL DEFAULT 'sourced'
    CHECK (pipeline_stage IN (
      'sourced',
      'contacted',
      'phone_screen',
      'am_review',
      'assessment_sent',
      'submitted',
      'placed',
      'rejected'
    ));

-- Track when candidate entered current stage (for "days in stage" display)
ALTER TABLE public.project_candidates
  ADD COLUMN IF NOT EXISTS stage_changed_at timestamptz NOT NULL DEFAULT now();

-- =============================================================================
-- 2. Add tags_json to project_candidates
-- =============================================================================

ALTER TABLE public.project_candidates
  ADD COLUMN IF NOT EXISTS tags_json jsonb NOT NULL DEFAULT '[]'::jsonb;

-- =============================================================================
-- 3. Index for pipeline queries
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_project_candidates_pipeline_stage
  ON public.project_candidates(project_id, pipeline_stage)
  WHERE deleted_at IS NULL;

-- =============================================================================
-- 4. TABLE: project_candidate_notes
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.project_candidate_notes (
  id           uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_id uuid        NOT NULL REFERENCES public.project_candidates(id) ON DELETE CASCADE,
  project_id   uuid        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content      text        NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_candidate_notes_candidate_id
  ON public.project_candidate_notes(candidate_id);

CREATE INDEX IF NOT EXISTS idx_candidate_notes_project_id
  ON public.project_candidate_notes(project_id);

-- =============================================================================
-- 5. RLS for project_candidate_notes
-- =============================================================================

ALTER TABLE public.project_candidate_notes ENABLE ROW LEVEL SECURITY;

-- SELECT: visible to all project members (owner + any project_members entry)
CREATE POLICY "candidate_notes_select" ON public.project_candidate_notes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      LEFT JOIN public.project_members pm ON pm.project_id = p.id
      WHERE p.id = project_candidate_notes.project_id
        AND (p.owner_id = auth.uid() OR pm.user_id = auth.uid())
    )
  );

-- INSERT: collaborators and owners only (not viewers)
CREATE POLICY "candidate_notes_insert" ON public.project_candidate_notes
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.projects p
      LEFT JOIN public.project_members pm ON pm.project_id = p.id
      WHERE p.id = project_candidate_notes.project_id
        AND (
          p.owner_id = auth.uid()
          OR (pm.user_id = auth.uid() AND pm.role IN ('owner', 'collaborator'))
        )
    )
  );

-- DELETE: own notes only
CREATE POLICY "candidate_notes_delete" ON public.project_candidate_notes
  FOR DELETE USING (user_id = auth.uid());
