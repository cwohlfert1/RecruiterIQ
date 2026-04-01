-- ─── Red Flag Checks ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.red_flag_checks (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  resume_text     text        NOT NULL,
  jd_text         text,
  integrity_score integer     NOT NULL CHECK (integrity_score BETWEEN 0 AND 100),
  flags_json      jsonb       NOT NULL DEFAULT '[]'::jsonb,
  summary         text        NOT NULL,
  recommendation  text        NOT NULL CHECK (recommendation IN ('proceed', 'caution', 'pass')),
  created_at      timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_red_flag_checks_user_id    ON public.red_flag_checks(user_id);
CREATE INDEX IF NOT EXISTS idx_red_flag_checks_created_at ON public.red_flag_checks(created_at DESC);

ALTER TABLE public.red_flag_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "red_flag_checks_select_own" ON public.red_flag_checks;
CREATE POLICY "red_flag_checks_select_own"
  ON public.red_flag_checks FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "red_flag_checks_insert_own" ON public.red_flag_checks;
CREATE POLICY "red_flag_checks_insert_own"
  ON public.red_flag_checks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "red_flag_checks_delete_own" ON public.red_flag_checks;
CREATE POLICY "red_flag_checks_delete_own"
  ON public.red_flag_checks FOR DELETE
  USING (auth.uid() = user_id);
