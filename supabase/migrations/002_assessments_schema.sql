-- ============================================================
-- Migration 002: RecruiterIQ Assessments Module
-- Adds assessment platform schema on top of existing tables.
-- Run after 001_initial_schema.sql.
-- ============================================================

-- ── 0. Reuse existing updated_at trigger function ────────────
-- handle_updated_at() is defined in 001_initial_schema.sql
-- All tables that need updated_at auto-update will reference it.

-- ============================================================
-- 1. EXISTING TABLE MODIFICATIONS
-- ============================================================

-- Add role column to user_profiles
-- Owner is always treated as manager in application logic
-- regardless of this field value.
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'recruiter'
    CHECK (role IN ('recruiter', 'manager'));

-- Expand activity_log.feature CHECK to include 'assessment'
-- activity_log is not in the "do not touch" list; this is additive.
ALTER TABLE public.activity_log
  DROP CONSTRAINT IF EXISTS activity_log_feature_check;

ALTER TABLE public.activity_log
  ADD CONSTRAINT activity_log_feature_check
    CHECK (feature IN (
      'resume_scorer',
      'client_summary',
      'boolean_search',
      'stack_ranking',
      'assessment'
    ));

-- ============================================================
-- 2. NEW TABLES
-- ============================================================

-- ── 2a. assessments ─────────────────────────────────────────
-- One row per assessment. Created and owned by a manager.
-- Published assessments cannot be edited (enforced in app layer).

CREATE TABLE IF NOT EXISTS public.assessments (
  id                  UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title               TEXT        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 100),
  description         TEXT             CHECK (char_length(description) <= 500),
  role                TEXT        NOT NULL CHECK (char_length(role) BETWEEN 1 AND 100),
  time_limit_minutes  INTEGER     NOT NULL CHECK (time_limit_minutes BETWEEN 10 AND 180),
  proctoring_config   JSONB       NOT NULL DEFAULT '{}',
  -- proctoring_config shape:
  -- {
  --   "tab_switching":               boolean,
  --   "paste_detection":             boolean,
  --   "eye_tracking":                boolean,
  --   "keystroke_dynamics":          boolean,
  --   "presence_challenges":         boolean,
  --   "presence_challenge_frequency": 2 | 3,
  --   "snapshots":                   boolean
  -- }
  question_order      TEXT        NOT NULL DEFAULT 'sequential'
                        CHECK (question_order IN ('sequential', 'random')),
  presentation_mode   TEXT        NOT NULL DEFAULT 'one_at_a_time'
                        CHECK (presentation_mode IN ('one_at_a_time', 'all_at_once')),
  status              TEXT        NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'published', 'archived')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_assessments_updated_at
  BEFORE UPDATE ON public.assessments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── 2b. assessment_questions ─────────────────────────────────
-- One row per question within an assessment.
-- type-specific columns are nullable; application enforces which are required per type.

CREATE TABLE IF NOT EXISTS public.assessment_questions (
  id              UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_id   UUID        NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  type            TEXT        NOT NULL CHECK (type IN ('coding', 'multiple_choice', 'written')),
  prompt          TEXT        NOT NULL,
  points          INTEGER     NOT NULL DEFAULT 100 CHECK (points > 0),
  sort_order      INTEGER     NOT NULL DEFAULT 0,

  -- Coding-only fields
  language        TEXT        CHECK (language IN (
                    'javascript', 'typescript', 'react_jsx', 'react_tsx', 'python'
                  )),
  starter_code    TEXT,
  test_cases_json JSONB,
  -- test_cases_json shape: [{ "input": "string", "expectedOutput": "string" }]
  instructions    TEXT,

  -- Multiple-choice-only fields
  options_json    JSONB,
  -- options_json shape: [{ "id": "string", "text": "string", "is_correct": boolean }]
  correct_option  TEXT,
  time_limit_secs INTEGER     CHECK (time_limit_secs > 0),

  -- Written-only fields
  length_hint     TEXT        CHECK (length_hint IN ('short', 'medium', 'long')),
  rubric_hints    TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 2c. assessment_invites ───────────────────────────────────
-- One row per candidate invite. Token is the public URL identifier.
-- Expires 7 days after creation. Status managed by app + cleanup job.

CREATE TABLE IF NOT EXISTS public.assessment_invites (
  id               UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_id    UUID        NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  created_by       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- created_by: the manager who sent this invite
  candidate_name   TEXT        NOT NULL CHECK (char_length(candidate_name) BETWEEN 1 AND 200),
  candidate_email  TEXT        NOT NULL CHECK (candidate_email ~* '^[^@]+@[^@]+\.[^@]+$'),
  token            TEXT        NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  status           TEXT        NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'started', 'completed', 'expired')),
  expires_at       TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  sent_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 2d. assessment_sessions ──────────────────────────────────
-- One row per candidate attempt. Created when candidate starts.
-- trust_score and skill_score are NULL until calculated post-completion.
-- No overall_score — trust and skill are always displayed separately.

CREATE TABLE IF NOT EXISTS public.assessment_sessions (
  id                    UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invite_id             UUID        NOT NULL UNIQUE REFERENCES public.assessment_invites(id) ON DELETE CASCADE,
  -- UNIQUE: one session per invite (one attempt per candidate link)
  assessment_id         UUID        NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  user_id               UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  -- user_id: the manager who owns the assessment (denormalized for RLS)
  started_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at          TIMESTAMPTZ,
  time_spent_seconds    INTEGER,
  trust_score           INTEGER     CHECK (trust_score BETWEEN 0 AND 100),
  skill_score           INTEGER     CHECK (skill_score BETWEEN 0 AND 100),
  ai_integrity_summary  TEXT,
  -- ai_integrity_summary: Claude-generated 3-sentence proctoring narrative
  status                TEXT        NOT NULL DEFAULT 'in_progress'
                          CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 2e. assessment_question_responses ────────────────────────
-- Per-question answers and Claude-generated scores.
-- Separated from assessment_sessions to allow partial saves.

CREATE TABLE IF NOT EXISTS public.assessment_question_responses (
  id              UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id      UUID        NOT NULL REFERENCES public.assessment_sessions(id) ON DELETE CASCADE,
  question_id     UUID        NOT NULL REFERENCES public.assessment_questions(id) ON DELETE CASCADE,
  answer_text     TEXT,
  -- answer_text: for written + coding (final code submission)
  selected_option TEXT,
  -- selected_option: for multiple choice (option id)
  skill_score     INTEGER     CHECK (skill_score BETWEEN 0 AND 100),
  -- skill_score: Claude grade (coding/written) or auto-score (MC)
  feedback_json   JSONB,
  -- feedback_json shape for coding:
  -- { "correctness": { "score": 80, "feedback": "..." }, "code_quality": {...}, ... }
  -- shape for written:
  -- { "relevance": { "score": 70, "feedback": "..." }, "depth": {...}, "clarity": {...} }
  test_results_json JSONB,
  -- test_results_json: [{ "input": "...", "expected": "...", "actual": "...", "passed": bool }]
  graded_at       TIMESTAMPTZ,
  saved_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- saved_at: updated on every localStorage sync
  UNIQUE (session_id, question_id)
);

-- ── 2f. proctoring_events ────────────────────────────────────
-- Append-only log of all proctoring signals during a session.
-- Written via service-role API routes (candidate has no auth session).

CREATE TABLE IF NOT EXISTS public.proctoring_events (
  id           UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id   UUID        NOT NULL REFERENCES public.assessment_sessions(id) ON DELETE CASCADE,
  event_type   TEXT        NOT NULL CHECK (event_type IN (
                 'tab_switch',
                 'paste_detected',
                 'gaze_off_screen',
                 'face_not_detected',
                 'eye_tracking_degraded',
                 'keystroke_anomaly',
                 'presence_challenge_passed',
                 'presence_challenge_failed',
                 'offline_detected',
                 'session_resumed'
               )),
  severity     TEXT        NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'info')),
  payload_json JSONB       NOT NULL DEFAULT '{}',
  -- payload_json examples:
  -- tab_switch:          { "duration_away_ms": 18000 }
  -- paste_detected:      { "char_count": 650, "content_preview": "first 100 chars..." }
  -- gaze_off_screen:     { "duration_ms": 8000 }
  -- keystroke_anomaly:   { "baseline_iki_ms": 120, "current_iki_ms": 800 }
  -- presence_challenge:  { "word": "BANANA", "response": "BANANA", "response_time_ms": 2100 }
  timestamp    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 2g. assessment_snapshots ─────────────────────────────────
-- Webcam snapshots taken every 5 min when consent + feature enabled.
-- Stored in private Supabase storage bucket 'assessment-snapshots'.
-- NOTE: 90-day retention — implement cleanup in scheduled Edge Function.
--
-- STORAGE BUCKET SETUP (run via Supabase dashboard or CLI):
--   supabase storage create assessment-snapshots --private
--   Access via signed URLs only. Manager requests signed URL server-side.
--   Path pattern: {session_id}/{unix_timestamp}.jpg
--
-- STORAGE RLS (set in dashboard):
--   INSERT: service role only (via API route)
--   SELECT: service role only (manager requests signed URL via API)

CREATE TABLE IF NOT EXISTS public.assessment_snapshots (
  id            UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id    UUID        NOT NULL REFERENCES public.assessment_sessions(id) ON DELETE CASCADE,
  invite_id     UUID        NOT NULL REFERENCES public.assessment_invites(id) ON DELETE CASCADE,
  storage_path  TEXT        NOT NULL,
  -- storage_path: relative path in 'assessment-snapshots' bucket
  -- e.g. "{session_id}/1711900000.jpg"
  taken_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 2h. notifications ────────────────────────────────────────
-- In-app notification feed. One row per notification per user.
-- Currently only 'assessment_completed' type; extensible via type column.

CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        TEXT        NOT NULL CHECK (type IN (
                'assessment_completed',
                'assessment_started',
                'invite_expired'
              )),
  title       TEXT        NOT NULL,
  message     TEXT,
  link        TEXT,
  -- link: the /dashboard URL to navigate to on click
  read        BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 3. INDEXES
-- ============================================================

-- assessments
CREATE INDEX IF NOT EXISTS idx_assessments_user_id
  ON public.assessments (user_id);

CREATE INDEX IF NOT EXISTS idx_assessments_user_created
  ON public.assessments (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_assessments_status
  ON public.assessments (user_id, status);

-- assessment_questions
CREATE INDEX IF NOT EXISTS idx_assessment_questions_assessment
  ON public.assessment_questions (assessment_id, sort_order);

-- assessment_invites
CREATE UNIQUE INDEX IF NOT EXISTS idx_assessment_invites_token
  ON public.assessment_invites (token);
-- used on every candidate page load — must be unique + fast

CREATE INDEX IF NOT EXISTS idx_assessment_invites_assessment
  ON public.assessment_invites (assessment_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_assessment_invites_created_by
  ON public.assessment_invites (created_by, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_assessment_invites_pending_expired
  ON public.assessment_invites (expires_at)
  WHERE status = 'pending';
-- used by expiry cleanup to find stale pending invites

-- assessment_sessions
CREATE INDEX IF NOT EXISTS idx_assessment_sessions_invite
  ON public.assessment_sessions (invite_id);

CREATE INDEX IF NOT EXISTS idx_assessment_sessions_assessment
  ON public.assessment_sessions (assessment_id, completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_assessment_sessions_user
  ON public.assessment_sessions (user_id, created_at DESC);
-- for dashboard stat card "Assessments Sent This Month"

-- assessment_question_responses
CREATE INDEX IF NOT EXISTS idx_aqr_session
  ON public.assessment_question_responses (session_id);

-- proctoring_events
CREATE INDEX IF NOT EXISTS idx_proctoring_events_session_time
  ON public.proctoring_events (session_id, timestamp ASC);
-- primary report query: all events for a session in chronological order

CREATE INDEX IF NOT EXISTS idx_proctoring_events_type
  ON public.proctoring_events (session_id, event_type);

-- assessment_snapshots
CREATE INDEX IF NOT EXISTS idx_assessment_snapshots_session
  ON public.assessment_snapshots (session_id, taken_at ASC);

-- notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id, created_at DESC)
  WHERE read = false;

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications (user_id, created_at DESC);

-- ============================================================
-- 4. ROW LEVEL SECURITY
-- ============================================================
-- Design principle for candidate-facing writes:
--   Candidate pages (/assess/*) have NO Supabase auth session.
--   All candidate writes (session creation, proctoring events, snapshots)
--   go through Next.js server-side API routes that:
--     1. Validate the token by querying assessment_invites via service role
--     2. Confirm token is valid (not expired, status = pending/started)
--     3. Perform the write using the Supabase ADMIN client (service role)
--   The service role bypasses RLS entirely, so these tables only need
--   RLS policies for authenticated manager reads.
--   NEVER expose SUPABASE_SERVICE_ROLE_KEY to the browser.

ALTER TABLE public.assessments              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_questions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_invites       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_sessions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_question_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proctoring_events        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_snapshots     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications            ENABLE ROW LEVEL SECURITY;

-- ── assessments ──────────────────────────────────────────────
-- Managers see their own assessments.
-- Team members on the same agency account also need read access
-- (handled in app via owner_user_id lookup — extend if needed).

CREATE POLICY "assessments_select_own"
  ON public.assessments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "assessments_insert_own"
  ON public.assessments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "assessments_update_own"
  ON public.assessments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "assessments_delete_own"
  ON public.assessments FOR DELETE
  USING (auth.uid() = user_id);

-- ── assessment_questions ──────────────────────────────────────
-- Access controlled via parent assessment ownership.

CREATE POLICY "aq_select_own"
  ON public.assessment_questions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.assessments a
      WHERE a.id = assessment_id AND a.user_id = auth.uid()
    )
  );

CREATE POLICY "aq_insert_own"
  ON public.assessment_questions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.assessments a
      WHERE a.id = assessment_id AND a.user_id = auth.uid()
    )
  );

CREATE POLICY "aq_update_own"
  ON public.assessment_questions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.assessments a
      WHERE a.id = assessment_id AND a.user_id = auth.uid()
    )
  );

CREATE POLICY "aq_delete_own"
  ON public.assessment_questions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.assessments a
      WHERE a.id = assessment_id AND a.user_id = auth.uid()
    )
  );

-- ── assessment_invites ────────────────────────────────────────
-- Manager reads/writes own invites.
-- Candidate token validation handled server-side via service role
-- (no anon SELECT policy needed).

CREATE POLICY "invites_select_own"
  ON public.assessment_invites FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "invites_insert_own"
  ON public.assessment_invites FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "invites_update_own"
  ON public.assessment_invites FOR UPDATE
  USING (auth.uid() = created_by);

-- ── assessment_sessions ───────────────────────────────────────
-- Manager reads sessions for their assessments.
-- Writes (candidate starting/completing) go through service role API.

CREATE POLICY "sessions_select_own"
  ON public.assessment_sessions FOR SELECT
  USING (auth.uid() = user_id);

-- ── assessment_question_responses ─────────────────────────────
-- Manager reads responses via session ownership.

CREATE POLICY "aqr_select_own"
  ON public.assessment_question_responses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.assessment_sessions s
      WHERE s.id = session_id AND s.user_id = auth.uid()
    )
  );

-- ── proctoring_events ─────────────────────────────────────────
-- Manager reads events for their sessions.
-- All writes go through service role API.

CREATE POLICY "pe_select_own"
  ON public.proctoring_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.assessment_sessions s
      WHERE s.id = session_id AND s.user_id = auth.uid()
    )
  );

-- ── assessment_snapshots ──────────────────────────────────────
-- Manager reads snapshot metadata for their sessions.
-- All writes + storage access go through service role API.

CREATE POLICY "snapshots_select_own"
  ON public.assessment_snapshots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.assessment_sessions s
      WHERE s.id = session_id AND s.user_id = auth.uid()
    )
  );

-- ── notifications ─────────────────────────────────────────────

CREATE POLICY "notifications_select_own"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "notifications_update_own"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- INSERT via service role only (server creates notifications on events)

-- ============================================================
-- 5. AUTO-EXPIRY APPROACH
-- ============================================================
-- Option chosen: handle at query time (no pg_cron required).
--
-- In the app:
--   - On token validation: WHERE token = $1 AND expires_at > now()
--   - Assessment invite list: show computed 'expired' badge if
--     expires_at < now() AND status = 'pending'
--
-- Periodic cleanup (run via Supabase scheduled Edge Function
-- or pg_cron if enabled on your Supabase plan):
--
--   UPDATE public.assessment_invites
--   SET status = 'expired'
--   WHERE status = 'pending'
--     AND expires_at < now();
--
-- 90-day data retention cleanup:
--
--   DELETE FROM public.proctoring_events
--   WHERE timestamp < now() - INTERVAL '90 days';
--
--   DELETE FROM public.assessment_snapshots
--   WHERE taken_at < now() - INTERVAL '90 days';
--   -- Also delete from storage bucket (handle in Edge Function):
--   --   supabase.storage.from('assessment-snapshots').remove([paths])
--
-- Schedule: daily at 3am UTC via Supabase Edge Function cron.

-- ============================================================
-- 6. STORAGE BUCKET NOTES
-- ============================================================
-- Create via Supabase dashboard or CLI — cannot be done in SQL migration:
--
--   supabase storage buckets create assessment-snapshots \
--     --public false
--
-- Bucket configuration:
--   Name:         assessment-snapshots
--   Public:       false (private — signed URLs only)
--   File size:    max 2MB per snapshot (set in dashboard)
--   Allowed MIME: image/jpeg
--
-- Access pattern:
--   WRITE: server-side API route uses admin client → no storage RLS needed
--   READ:  server-side API route generates signed URL (60s expiry)
--          → manager's browser loads signed URL directly
--
-- Retention:
--   90-day cleanup handled in scheduled Edge Function (see section 5)
