-- 016: LinkedIn OAuth profile fields + avatars storage bucket

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS avatar_url              text,
  ADD COLUMN IF NOT EXISTS display_name            text,
  ADD COLUMN IF NOT EXISTS job_title               text,
  ADD COLUMN IF NOT EXISTS linkedin_url            text,
  ADD COLUMN IF NOT EXISTS linkedin_id             text,
  ADD COLUMN IF NOT EXISTS linkedin_connected_at   timestamptz,
  ADD COLUMN IF NOT EXISTS phone                   text;

-- Avatars bucket (public, 2 MB limit, images only)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for avatars bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'avatars_public_read'
  ) THEN
    CREATE POLICY "avatars_public_read"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'avatars');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'avatars_auth_insert'
  ) THEN
    CREATE POLICY "avatars_auth_insert"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'avatars');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'avatars_auth_update'
  ) THEN
    CREATE POLICY "avatars_auth_update"
      ON storage.objects FOR UPDATE TO authenticated
      USING (bucket_id = 'avatars');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'avatars_auth_delete'
  ) THEN
    CREATE POLICY "avatars_auth_delete"
      ON storage.objects FOR DELETE TO authenticated
      USING (
        bucket_id = 'avatars'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END $$;
