-- =============================================================================
-- RecruiterIQ — Initial Schema Migration
-- Version: 001
-- Created: 2026-03-27
--
-- Tables:
--   user_profiles           — plan tier, billing state, AI call counter
--   team_members            — Agency invite/membership records
--   resume_scores           — Feature 1 history
--   client_summaries        — Feature 2 history
--   boolean_searches        — Feature 3 history
--   stack_rankings          — Feature 4 session records
--   stack_ranking_candidates — Feature 4 per-candidate scores (normalized)
--   activity_log            — Dashboard "last 5 actions" feed
--   square_webhook_events   — Idempotent webhook store for replay/audit
--
-- All tables have RLS enabled. Users see only their own data.
-- Agency owners see team membership records but NOT member history.
-- Service role bypasses RLS for webhook updates and admin operations.
-- =============================================================================


-- =============================================================================
-- EXTENSIONS
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- =============================================================================
-- HELPER: updated_at auto-update trigger function
-- =============================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


-- =============================================================================
-- TABLE: user_profiles
--
-- One row per auth user, auto-created on signup via trigger.
-- Stores plan tier, Square billing identifiers, AI call counter,
-- subscription lifecycle state, and billing period end date.
--
-- PRD changes from spec:
--   - user_id is the PK (no separate id column — 1:1 with auth.users)
--   - reset_date (date) → last_reset_at (timestamptz) for reliable month-boundary logic
--   - Added billing_period_end for cancellation "access until period end" flow
--   - Added subscription_status='cancelling' for paid-but-cancelled state
-- =============================================================================
CREATE TABLE public.user_profiles (
  user_id                uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_tier              text        NOT NULL DEFAULT 'free'
                                       CHECK (plan_tier IN ('free', 'pro', 'agency')),
  subscription_status    text        NOT NULL DEFAULT 'free'
                                       CHECK (subscription_status IN (
                                         'free',        -- no subscription
                                         'active',      -- paid and current
                                         'grace',       -- payment failed, 3-day window
                                         'cancelling',  -- cancelled but access until billing_period_end
                                         'cancelled'    -- fully lapsed
                                       )),
  square_customer_id     text,
  square_subscription_id text,
  ai_calls_this_month    integer     NOT NULL DEFAULT 0 CHECK (ai_calls_this_month >= 0),
  last_reset_at          timestamptz NOT NULL DEFAULT date_trunc('month', now()),
  billing_period_end     timestamptz,          -- populated by Square webhook; used for cancelling → free downgrade
  grace_period_start     timestamptz,          -- set when payment fails; cleared on resolution
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Auto-create profile row when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Indexes: Square ID lookups used by webhook handler
CREATE INDEX idx_user_profiles_square_customer
  ON public.user_profiles(square_customer_id)
  WHERE square_customer_id IS NOT NULL;

CREATE INDEX idx_user_profiles_square_subscription
  ON public.user_profiles(square_subscription_id)
  WHERE square_subscription_id IS NOT NULL;

-- Partial index for users in grace period (checked on every authenticated request)
CREATE INDEX idx_user_profiles_grace
  ON public.user_profiles(grace_period_start)
  WHERE subscription_status = 'grace';

-- RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_profiles: select own"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "user_profiles: update own"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- No INSERT policy — handled by SECURITY DEFINER trigger
-- No DELETE policy — cascade from auth.users deletion


-- =============================================================================
-- TABLE: team_members
--
-- Tracks Agency-tier team invitations and membership.
-- One row per invite. Status transitions: pending → active → removed.
-- invite_token is a short-lived token embedded in the invite email link.
--
-- Constraint: an owner cannot have two pending/active invites to the same email
--   (enforced via partial unique index). Re-inviting after removal is allowed.
-- =============================================================================
CREATE TABLE public.team_members (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_user_id    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_email     text        NOT NULL,
  invite_token      text        UNIQUE,                   -- NULL once invite is accepted or expired
  invite_expires_at timestamptz,                          -- token TTL (e.g. 7 days from invite)
  status            text        NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending', 'active', 'removed')),
  joined_at         timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER team_members_updated_at
  BEFORE UPDATE ON public.team_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Indexes
CREATE INDEX idx_team_members_owner
  ON public.team_members(owner_user_id);

CREATE INDEX idx_team_members_member
  ON public.team_members(member_user_id)
  WHERE member_user_id IS NOT NULL;

CREATE INDEX idx_team_members_token
  ON public.team_members(invite_token)
  WHERE invite_token IS NOT NULL;

-- Prevent duplicate active/pending invites from the same owner to the same email.
-- Allows re-inviting after removal (status = 'removed' is excluded).
CREATE UNIQUE INDEX idx_team_members_unique_active_invite
  ON public.team_members(owner_user_id, lower(invited_email))
  WHERE status IN ('pending', 'active');

-- RLS
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team_members: owner can select all"
  ON public.team_members FOR SELECT
  USING (auth.uid() = owner_user_id);

CREATE POLICY "team_members: member can select own record"
  ON public.team_members FOR SELECT
  USING (auth.uid() = member_user_id);

CREATE POLICY "team_members: owner can insert"
  ON public.team_members FOR INSERT
  WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "team_members: owner can update"
  ON public.team_members FOR UPDATE
  USING (auth.uid() = owner_user_id);

CREATE POLICY "team_members: owner can delete"
  ON public.team_members FOR DELETE
  USING (auth.uid() = owner_user_id);


-- =============================================================================
-- TABLE: resume_scores
--
-- Feature 1 history. One row per scored resume.
-- breakdown_json structure:
--   {
--     "must_have_skills":  { "score": 85, "weight": 0.40, "weighted": 34 },
--     "domain_experience": { "score": 70, "weight": 0.20, "weighted": 14 },
--     "communication":     { "score": 80, "weight": 0.15, "weighted": 12 },
--     "tenure_stability":  { "score": 90, "weight": 0.10, "weighted":  9 },
--     "tool_depth":        { "score": 80, "weight": 0.15, "weighted": 12 }
--   }
-- =============================================================================
CREATE TABLE public.resume_scores (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_title      text,                              -- extracted from JD by Claude or left null
  resume_text    text        NOT NULL,
  jd_text        text        NOT NULL,
  score          integer     NOT NULL CHECK (score BETWEEN 0 AND 100),
  breakdown_json jsonb       NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- History page: user's records, newest first (primary query pattern)
CREATE INDEX idx_resume_scores_user_created
  ON public.resume_scores(user_id, created_at DESC);

-- History search: filter by job_title text
CREATE INDEX idx_resume_scores_user_job_title
  ON public.resume_scores(user_id, job_title)
  WHERE job_title IS NOT NULL;

-- Dashboard stat card: count this month's scores per user
CREATE INDEX idx_resume_scores_user_month
  ON public.resume_scores(user_id, date_trunc('month', created_at));

-- RLS
ALTER TABLE public.resume_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "resume_scores: select own"
  ON public.resume_scores FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "resume_scores: insert own"
  ON public.resume_scores FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "resume_scores: delete own"
  ON public.resume_scores FOR DELETE
  USING (auth.uid() = user_id);


-- =============================================================================
-- TABLE: client_summaries
--
-- Feature 2 history. One row per generated summary.
--
-- PRD gap: History page filters by "job title" but Client Summary has no JD
-- input — only a resume is pasted. Added optional candidate_name field for
-- history identification instead. The History page for this tab should label
-- its search field "Candidate Name" rather than "Job Title".
-- =============================================================================
CREATE TABLE public.client_summaries (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  candidate_name  text,                              -- optional; used for history search
  resume_text     text        NOT NULL,
  summary_output  text        NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_client_summaries_user_created
  ON public.client_summaries(user_id, created_at DESC);

CREATE INDEX idx_client_summaries_user_name
  ON public.client_summaries(user_id, candidate_name)
  WHERE candidate_name IS NOT NULL;

-- Dashboard stat card
CREATE INDEX idx_client_summaries_user_month
  ON public.client_summaries(user_id, date_trunc('month', created_at));

-- RLS
ALTER TABLE public.client_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_summaries: select own"
  ON public.client_summaries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "client_summaries: insert own"
  ON public.client_summaries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "client_summaries: delete own"
  ON public.client_summaries FOR DELETE
  USING (auth.uid() = user_id);


-- =============================================================================
-- TABLE: boolean_searches
--
-- Feature 3 history. One row per generated boolean string pair.
-- job_title is duplicated as a top-level column (also in inputs_json)
-- to enable efficient history search without JSONB extraction.
--
-- inputs_json structure:
--   {
--     "job_title":            "...",
--     "must_have_skills":     "...",
--     "nice_to_have_skills":  "...",   (nullable)
--     "location":             "...",   (nullable)
--     "exclude_terms":        "..."    (nullable)
--   }
-- =============================================================================
CREATE TABLE public.boolean_searches (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_title       text        NOT NULL,              -- top-level for search; also in inputs_json
  inputs_json     jsonb       NOT NULL,
  linkedin_string text        NOT NULL,
  indeed_string   text        NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_boolean_searches_user_created
  ON public.boolean_searches(user_id, created_at DESC);

CREATE INDEX idx_boolean_searches_user_job_title
  ON public.boolean_searches(user_id, job_title);

-- Dashboard stat card
CREATE INDEX idx_boolean_searches_user_month
  ON public.boolean_searches(user_id, date_trunc('month', created_at));

-- RLS
ALTER TABLE public.boolean_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "boolean_searches: select own"
  ON public.boolean_searches FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "boolean_searches: insert own"
  ON public.boolean_searches FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "boolean_searches: delete own"
  ON public.boolean_searches FOR DELETE
  USING (auth.uid() = user_id);


-- =============================================================================
-- TABLE: stack_rankings
--
-- Feature 4 session records. One row per ranking session.
-- Candidates are stored in the child table stack_ranking_candidates.
--
-- PRD change: candidates_json removed. A JSONB blob makes per-candidate note
-- updates and CSV export generation messy. Child table is cleaner and faster.
-- =============================================================================
CREATE TABLE public.stack_rankings (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_title   text,
  jd_text     text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_stack_rankings_user_created
  ON public.stack_rankings(user_id, created_at DESC);

CREATE INDEX idx_stack_rankings_user_job_title
  ON public.stack_rankings(user_id, job_title)
  WHERE job_title IS NOT NULL;

-- RLS
ALTER TABLE public.stack_rankings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stack_rankings: select own"
  ON public.stack_rankings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "stack_rankings: insert own"
  ON public.stack_rankings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "stack_rankings: delete own"
  ON public.stack_rankings FOR DELETE
  USING (auth.uid() = user_id);


-- =============================================================================
-- TABLE: stack_ranking_candidates
--
-- Normalized child table of stack_rankings. One row per candidate per session.
-- user_id is denormalized here to simplify RLS (avoids JOIN in policy).
-- notes column is editable post-session (UPDATE policy provided).
--
-- breakdown_json uses the same structure as resume_scores.breakdown_json.
-- =============================================================================
CREATE TABLE public.stack_ranking_candidates (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ranking_id     uuid        NOT NULL REFERENCES public.stack_rankings(id) ON DELETE CASCADE,
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  candidate_name text        NOT NULL,
  resume_text    text        NOT NULL,
  score          integer     NOT NULL CHECK (score BETWEEN 0 AND 100),
  rank           integer     NOT NULL CHECK (rank > 0),
  breakdown_json jsonb       NOT NULL,
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER stack_ranking_candidates_updated_at
  BEFORE UPDATE ON public.stack_ranking_candidates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Primary access pattern: load all candidates for a ranking session
CREATE INDEX idx_srk_candidates_ranking
  ON public.stack_ranking_candidates(ranking_id, rank);

-- RLS shortcut: user owns all their candidates
CREATE INDEX idx_srk_candidates_user
  ON public.stack_ranking_candidates(user_id);

-- RLS
ALTER TABLE public.stack_ranking_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stack_ranking_candidates: select own"
  ON public.stack_ranking_candidates FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "stack_ranking_candidates: insert own"
  ON public.stack_ranking_candidates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Notes are editable post-session; score/rank are immutable after insert
CREATE POLICY "stack_ranking_candidates: update notes"
  ON public.stack_ranking_candidates FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "stack_ranking_candidates: delete own"
  ON public.stack_ranking_candidates FOR DELETE
  USING (auth.uid() = user_id);


-- =============================================================================
-- TABLE: activity_log
--
-- Append-only log powering the dashboard "last 5 actions" feed.
-- One row per successful AI feature use.
-- record_id references the created row in the relevant feature table.
-- No FK constraint on record_id (polymorphic reference across 4 tables).
--
-- PRD gap: This table was absent from the PRD schema but is required for
-- the dashboard activity feed. A 4-table UNION on every dashboard load
-- would be expensive; this table enables a single indexed query.
-- =============================================================================
CREATE TABLE public.activity_log (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature     text        NOT NULL
                            CHECK (feature IN (
                              'resume_scorer',
                              'client_summary',
                              'boolean_search',
                              'stack_ranking'
                            )),
  record_id   uuid        NOT NULL,
  description text        NOT NULL,    -- e.g. "Scored resume for Senior Engineer"
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Primary access pattern: user's last N actions, newest first
CREATE INDEX idx_activity_log_user_created
  ON public.activity_log(user_id, created_at DESC);

-- RLS
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activity_log: select own"
  ON public.activity_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "activity_log: insert own"
  ON public.activity_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- No UPDATE or DELETE — activity log is append-only from the user's perspective.
-- (Service role may clean up orphaned records if a history item is deleted.)


-- =============================================================================
-- TABLE: square_webhook_events
--
-- Append-only store for all inbound Square webhook payloads.
-- event_id (Square's unique event identifier) is the idempotency key.
-- PRD gap: This table was absent from the PRD schema but is explicitly
-- required — "store raw webhook events for replay and audit".
--
-- No user-facing RLS policies — service role only.
-- =============================================================================
CREATE TABLE public.square_webhook_events (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     text        UNIQUE NOT NULL,   -- Square event ID; prevents double-processing
  event_type   text        NOT NULL,          -- e.g. 'subscription.updated', 'payment.failed'
  payload      jsonb       NOT NULL,          -- full raw payload for replay
  processed    boolean     NOT NULL DEFAULT false,
  processed_at timestamptz,
  error        text,                          -- error message if processing failed
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Primary lookup: check if event already processed (idempotency)
CREATE INDEX idx_webhook_events_event_id
  ON public.square_webhook_events(event_id);

-- Ops/monitoring: find unprocessed events
CREATE INDEX idx_webhook_events_unprocessed
  ON public.square_webhook_events(created_at DESC)
  WHERE processed = false;

-- RLS: no user policies — all access via service role key only
ALTER TABLE public.square_webhook_events ENABLE ROW LEVEL SECURITY;
-- (Zero policies = zero client access. Service role bypasses RLS.)


-- =============================================================================
-- DOWN MIGRATION (run in reverse order to drop cleanly)
-- =============================================================================
-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- DROP FUNCTION IF EXISTS public.handle_new_user();
-- DROP FUNCTION IF EXISTS public.update_updated_at();
-- DROP TABLE IF EXISTS public.square_webhook_events;
-- DROP TABLE IF EXISTS public.activity_log;
-- DROP TABLE IF EXISTS public.stack_ranking_candidates;
-- DROP TABLE IF EXISTS public.stack_rankings;
-- DROP TABLE IF EXISTS public.boolean_searches;
-- DROP TABLE IF EXISTS public.client_summaries;
-- DROP TABLE IF EXISTS public.resume_scores;
-- DROP TABLE IF EXISTS public.team_members;
-- DROP TABLE IF EXISTS public.user_profiles;
