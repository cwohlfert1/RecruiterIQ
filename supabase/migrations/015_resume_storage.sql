-- Migration 015: Resume file storage
-- Adds resume_file_url to project_candidates for storing original uploaded file path.
-- Requires a 'resumes' storage bucket to be created in Supabase Dashboard.

ALTER TABLE project_candidates
  ADD COLUMN IF NOT EXISTS resume_file_url text;

-- Storage policy: authenticated users can upload to the resumes bucket.
-- Run this after creating the 'resumes' bucket in Supabase Storage UI.
-- Signed URL generation for download uses service role (bypasses RLS).
INSERT INTO storage.buckets (id, name, public)
  VALUES ('resumes', 'resumes', false)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "resumes_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'resumes');

CREATE POLICY "resumes_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'resumes');
