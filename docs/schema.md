# RecruiterIQ — Database Schema Reference

**Database**: Supabase PostgreSQL
**Migrations**: `supabase/migrations/001_initial_schema.sql`, `supabase/migrations/002_assessments_schema.sql`
**Last updated**: 2026-03-31

---

## Entity Relationship Diagram

```
auth.users (Supabase managed)
    │
    ├─── user_profiles                (1:1)   Plan tier, billing state, role, AI call counter
    │
    ├─── team_members                 (1:N)   Agency invite/membership records
    │         owner_user_id ──► auth.users
    │         member_user_id ──► auth.users (nullable until accepted)
    │
    ├─── resume_scores                (1:N)   Feature 1 history
    │
    ├─── client_summaries             (1:N)   Feature 2 history
    │
    ├─── boolean_searches             (1:N)   Feature 3 history
    │
    ├─── stack_rankings               (1:N)   Feature 4 session records
    │         │
    │         └─── stack_ranking_candidates  (1:N)  Per-candidate scores + notes
    │
    ├─── activity_log                 (1:N)   Dashboard "last 5 actions" feed
    │
    ├─── assessments                  (1:N)   Assessment definitions (manager-created)
    │         │
    │         ├─── assessment_questions      (1:N)  Questions per assessment
    │         │
    │         └─── assessment_invites        (1:N)  Per-candidate invite + token
    │                   │
    │                   └─── assessment_sessions    (1:1)  Candidate attempt record
    │                             │
    │                             ├─── assessment_question_responses  (1:N)  Per-question answers + scores
    │                             ├─── proctoring_events              (1:N)  Proctoring signal log
    │                             └─── assessment_snapshots           (1:N)  Webcam snapshot refs
    │
    ├─── notifications                (1:N)   In-app notification feed
    │
    └─── (no direct user FK)
         square_webhook_events                Square billing event store (service role only)
```

---

## Tables

### `public.user_profiles`

One row per user. Auto-created by trigger on `auth.users` INSERT.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `user_id` | uuid | NOT NULL | — | PK; FK → `auth.users(id)` CASCADE |
| `plan_tier` | text | NOT NULL | `'free'` | `'free'` \| `'pro'` \| `'agency'` |
| `subscription_status` | text | NOT NULL | `'free'` | See status lifecycle below |
| `square_customer_id` | text | NULL | — | Square customer identifier |
| `square_subscription_id` | text | NULL | — | Square subscription identifier |
| `ai_calls_this_month` | integer | NOT NULL | `0` | Resets on calendar month boundary |
| `last_reset_at` | timestamptz | NOT NULL | `date_trunc('month', now())` | When counter was last reset to 0 |
| `billing_period_end` | timestamptz | NULL | — | Populated by Square webhook; controls cancelling → free downgrade |
| `grace_period_start` | timestamptz | NULL | — | Set when payment fails; cleared on resolution |
| `created_at` | timestamptz | NOT NULL | `now()` | |
| `updated_at` | timestamptz | NOT NULL | `now()` | Auto-updated by trigger |

**Subscription status lifecycle:**
```
signup
  └─► 'free'
         └─► 'active'      (on upgrade payment success)
               ├─► 'grace'       (on payment failure — 3-day window)
               │     ├─► 'active'    (on payment resolution)
               │     └─► 'cancelled' (after 3 days unresolved)
               └─► 'cancelling'  (on user cancellation — access until billing_period_end)
                     └─► 'free'      (when billing_period_end passes)
```

**Indexes:**
- `idx_user_profiles_square_customer` — partial on `square_customer_id` (webhook lookups)
- `idx_user_profiles_square_subscription` — partial on `square_subscription_id` (webhook lookups)
- `idx_user_profiles_grace` — partial on `grace_period_start` WHERE `subscription_status = 'grace'`

**RLS:** Users can SELECT and UPDATE their own row only. INSERT via SECURITY DEFINER trigger.

---

### `public.team_members`

Agency-tier team invitations and membership records.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NOT NULL | `gen_random_uuid()` | PK |
| `owner_user_id` | uuid | NOT NULL | — | FK → `auth.users(id)` CASCADE |
| `member_user_id` | uuid | NULL | — | FK → `auth.users(id)` SET NULL; null until invite accepted |
| `invited_email` | text | NOT NULL | — | Email address the invite was sent to |
| `invite_token` | text | NULL | — | Short-lived token embedded in invite link; cleared after acceptance |
| `invite_expires_at` | timestamptz | NULL | — | Token TTL (recommended: 7 days from invite) |
| `status` | text | NOT NULL | `'pending'` | `'pending'` \| `'active'` \| `'removed'` |
| `joined_at` | timestamptz | NULL | — | Set when invite accepted |
| `created_at` | timestamptz | NOT NULL | `now()` | |
| `updated_at` | timestamptz | NOT NULL | `now()` | Auto-updated by trigger |

**Status transitions:**
```
owner invites → 'pending'
  ├─► 'active'   (member accepts invite link)
  │     └─► 'removed'  (owner removes member)
  └─► (expired — invite_expires_at passed, status stays 'pending' until owner re-invites)
```

**Constraints:**
- `UNIQUE` on `invite_token`
- Partial unique index: `(owner_user_id, lower(invited_email))` WHERE `status IN ('pending', 'active')` — prevents duplicate active invites; allows re-inviting after removal

**Seat count query** (used before allowing new invite):
```sql
SELECT COUNT(*) FROM team_members
WHERE owner_user_id = $1 AND status IN ('pending', 'active');
-- Must be < 5 (owner occupies 1 seat, so 4 invites max)
```

**Indexes:**
- `idx_team_members_owner` — on `owner_user_id` (admin view queries)
- `idx_team_members_member` — partial on `member_user_id` (member access check)
- `idx_team_members_token` — partial on `invite_token` (invite acceptance)
- `idx_team_members_unique_active_invite` — partial unique (duplicate prevention)

**RLS:**
- Owner: full SELECT/INSERT/UPDATE/DELETE on rows where `owner_user_id = auth.uid()`
- Member: SELECT own membership record where `member_user_id = auth.uid()`

---

### `public.resume_scores`

Feature 1 history. One row per successful resume scoring.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NOT NULL | `gen_random_uuid()` | PK |
| `user_id` | uuid | NOT NULL | — | FK → `auth.users(id)` CASCADE |
| `job_title` | text | NULL | — | Extracted from JD by Claude; used for history search |
| `resume_text` | text | NOT NULL | — | Full resume paste (max ~5,000 words) |
| `jd_text` | text | NOT NULL | — | Full JD paste (max ~2,000 words) |
| `score` | integer | NOT NULL | — | 0–100; CHECK constraint enforced |
| `breakdown_json` | jsonb | NOT NULL | — | Per-category scores (see structure below) |
| `created_at` | timestamptz | NOT NULL | `now()` | |

**`breakdown_json` structure:**
```json
{
  "must_have_skills":  { "score": 85, "weight": 0.40, "weighted": 34 },
  "domain_experience": { "score": 70, "weight": 0.20, "weighted": 14 },
  "communication":     { "score": 80, "weight": 0.15, "weighted": 12 },
  "tenure_stability":  { "score": 90, "weight": 0.10, "weighted":  9 },
  "tool_depth":        { "score": 80, "weight": 0.15, "weighted": 12 }
}
```

**Indexes:**
- `idx_resume_scores_user_created` — `(user_id, created_at DESC)` — primary history query
- `idx_resume_scores_user_job_title` — `(user_id, job_title)` partial — history title search
- `idx_resume_scores_user_month` — `(user_id, date_trunc('month', created_at))` — dashboard stat card

**RLS:** Users can SELECT/INSERT/DELETE their own rows.

---

### `public.client_summaries`

Feature 2 history. One row per generated 4-bullet summary.

> **Schema note:** The PRD says to filter history by "job title" but Client Summary Generator
> has no JD input — only a resume is pasted. Added `candidate_name` (optional) as the
> searchable identifier instead. The History page for this tab should label its search
> field "Candidate Name" rather than "Job Title."

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NOT NULL | `gen_random_uuid()` | PK |
| `user_id` | uuid | NOT NULL | — | FK → `auth.users(id)` CASCADE |
| `candidate_name` | text | NULL | — | Optional; used for history search |
| `resume_text` | text | NOT NULL | — | Full resume paste |
| `summary_output` | text | NOT NULL | — | Generated 4-bullet text |
| `created_at` | timestamptz | NOT NULL | `now()` | |

**Indexes:**
- `idx_client_summaries_user_created` — `(user_id, created_at DESC)`
- `idx_client_summaries_user_name` — partial on `(user_id, candidate_name)`
- `idx_client_summaries_user_month` — dashboard stat card

**RLS:** Users can SELECT/INSERT/DELETE their own rows.

---

### `public.boolean_searches`

Feature 3 history. One row per generated boolean string pair.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NOT NULL | `gen_random_uuid()` | PK |
| `user_id` | uuid | NOT NULL | — | FK → `auth.users(id)` CASCADE |
| `job_title` | text | NOT NULL | — | Top-level column for search (also in `inputs_json`) |
| `inputs_json` | jsonb | NOT NULL | — | All input fields (see structure below) |
| `linkedin_string` | text | NOT NULL | — | Generated LinkedIn Recruiter boolean string |
| `indeed_string` | text | NOT NULL | — | Generated Indeed boolean string |
| `created_at` | timestamptz | NOT NULL | `now()` | |

**`inputs_json` structure:**
```json
{
  "job_title":           "Senior Software Engineer",
  "must_have_skills":    "React, TypeScript, Node.js",
  "nice_to_have_skills": "GraphQL, AWS",
  "location":            "New York, NY",
  "exclude_terms":       "junior, intern"
}
```

**Indexes:**
- `idx_boolean_searches_user_created` — `(user_id, created_at DESC)`
- `idx_boolean_searches_user_job_title` — `(user_id, job_title)`
- `idx_boolean_searches_user_month` — dashboard stat card

**RLS:** Users can SELECT/INSERT/DELETE their own rows.

---

### `public.stack_rankings`

Feature 4 session records. One row per ranking session. Candidates stored in child table.

> **Schema change from PRD:** `candidates_json` removed. Normalized into
> `stack_ranking_candidates` child table. Enables: per-candidate note updates,
> efficient CSV export, and cleaner RLS without JSONB manipulation.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NOT NULL | `gen_random_uuid()` | PK |
| `user_id` | uuid | NOT NULL | — | FK → `auth.users(id)` CASCADE |
| `job_title` | text | NULL | — | Extracted from JD; used for history search |
| `jd_text` | text | NOT NULL | — | Full JD paste |
| `created_at` | timestamptz | NOT NULL | `now()` | |

**Indexes:**
- `idx_stack_rankings_user_created` — `(user_id, created_at DESC)`
- `idx_stack_rankings_user_job_title` — partial on `(user_id, job_title)`

**RLS:** Users can SELECT/INSERT/DELETE their own rows. Cascade delete removes all candidates.

---

### `public.stack_ranking_candidates`

Child table of `stack_rankings`. One row per candidate per session.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NOT NULL | `gen_random_uuid()` | PK |
| `ranking_id` | uuid | NOT NULL | — | FK → `stack_rankings(id)` CASCADE |
| `user_id` | uuid | NOT NULL | — | Denormalized FK → `auth.users(id)`; for RLS without JOIN |
| `candidate_name` | text | NOT NULL | — | |
| `resume_text` | text | NOT NULL | — | |
| `score` | integer | NOT NULL | — | 0–100 |
| `rank` | integer | NOT NULL | — | 1-based; 1 = top candidate |
| `breakdown_json` | jsonb | NOT NULL | — | Same structure as `resume_scores.breakdown_json` |
| `notes` | text | NULL | — | Editable post-session |
| `created_at` | timestamptz | NOT NULL | `now()` | |
| `updated_at` | timestamptz | NOT NULL | `now()` | Auto-updated on notes change |

**CSV export query** (Agency tier — current session):
```sql
SELECT rank, candidate_name, score,
       (breakdown_json->'must_have_skills'->>'weighted')::int  AS must_have_skills_score,
       (breakdown_json->'domain_experience'->>'weighted')::int AS domain_experience_score,
       (breakdown_json->'communication'->>'weighted')::int     AS communication_score,
       (breakdown_json->'tenure_stability'->>'weighted')::int  AS tenure_score,
       (breakdown_json->'tool_depth'->>'weighted')::int        AS tool_depth_score,
       notes,
       created_at::date AS date_scored
FROM stack_ranking_candidates
WHERE ranking_id = $1
ORDER BY rank ASC;
```

**Indexes:**
- `idx_srk_candidates_ranking` — `(ranking_id, rank)` — primary session load
- `idx_srk_candidates_user` — `(user_id)` — RLS shortcut

**RLS:** Users can SELECT/INSERT/DELETE their own rows. UPDATE allowed for notes only.

---

### `public.activity_log`

Append-only log for the dashboard "last 5 actions" feed.

> **Schema addition:** This table was absent from the PRD schema but required
> for the dashboard activity feed. Querying all 4 history tables via UNION on
> every dashboard load is expensive and scales poorly.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NOT NULL | `gen_random_uuid()` | PK |
| `user_id` | uuid | NOT NULL | — | FK → `auth.users(id)` CASCADE |
| `feature` | text | NOT NULL | — | `'resume_scorer'` \| `'client_summary'` \| `'boolean_search'` \| `'stack_ranking'` |
| `record_id` | uuid | NOT NULL | — | References the created row in the feature table (no FK — polymorphic) |
| `description` | text | NOT NULL | — | Human-readable: "Scored resume for Senior Engineer" |
| `created_at` | timestamptz | NOT NULL | `now()` | |

**Dashboard query:**
```sql
SELECT * FROM activity_log
WHERE user_id = auth.uid()
ORDER BY created_at DESC
LIMIT 5;
```

**Indexes:**
- `idx_activity_log_user_created` — `(user_id, created_at DESC)`

**RLS:** Users can SELECT/INSERT their own rows. No UPDATE or DELETE (append-only).

---

### `public.square_webhook_events`

Append-only store for all inbound Square webhook payloads.

> **Schema addition:** Absent from PRD schema but explicitly required —
> "store raw webhook events for replay and audit."

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NOT NULL | `gen_random_uuid()` | PK |
| `event_id` | text | NOT NULL | — | Square's event ID — UNIQUE; idempotency key |
| `event_type` | text | NOT NULL | — | e.g. `'subscription.updated'`, `'invoice.payment_failed'` |
| `payload` | jsonb | NOT NULL | — | Full raw payload for replay |
| `processed` | boolean | NOT NULL | `false` | Set to true after successful processing |
| `processed_at` | timestamptz | NULL | — | Timestamp of successful processing |
| `error` | text | NULL | — | Error detail if processing failed |
| `created_at` | timestamptz | NOT NULL | `now()` | |

**Idempotency pattern:**
```sql
-- Before processing any webhook:
INSERT INTO square_webhook_events (event_id, event_type, payload)
VALUES ($1, $2, $3)
ON CONFLICT (event_id) DO NOTHING;
-- If 0 rows affected: already processed — skip.
```

**Indexes:**
- `idx_webhook_events_event_id` — unique on `event_id`
- `idx_webhook_events_unprocessed` — partial on `created_at DESC` WHERE `processed = false`

**RLS:** Enabled with zero user policies. Service role only.

---

## Index Summary

| Table | Index | Columns | Purpose |
|-------|-------|---------|---------|
| user_profiles | idx_user_profiles_square_customer | `square_customer_id` (partial) | Webhook lookup |
| user_profiles | idx_user_profiles_square_subscription | `square_subscription_id` (partial) | Webhook lookup |
| user_profiles | idx_user_profiles_grace | `grace_period_start` (partial) | Grace period check |
| team_members | idx_team_members_owner | `owner_user_id` | Admin view queries |
| team_members | idx_team_members_member | `member_user_id` (partial) | Member access check |
| team_members | idx_team_members_token | `invite_token` (partial) | Invite acceptance |
| team_members | idx_team_members_unique_active_invite | `(owner_user_id, lower(invited_email))` partial unique | Duplicate prevention |
| resume_scores | idx_resume_scores_user_created | `(user_id, created_at DESC)` | History page |
| resume_scores | idx_resume_scores_user_job_title | `(user_id, job_title)` partial | History search |
| resume_scores | idx_resume_scores_user_month | `(user_id, date_trunc('month',…))` | Dashboard stat |
| client_summaries | idx_client_summaries_user_created | `(user_id, created_at DESC)` | History page |
| client_summaries | idx_client_summaries_user_name | `(user_id, candidate_name)` partial | History search |
| client_summaries | idx_client_summaries_user_month | `(user_id, date_trunc('month',…))` | Dashboard stat |
| boolean_searches | idx_boolean_searches_user_created | `(user_id, created_at DESC)` | History page |
| boolean_searches | idx_boolean_searches_user_job_title | `(user_id, job_title)` | History search |
| boolean_searches | idx_boolean_searches_user_month | `(user_id, date_trunc('month',…))` | Dashboard stat |
| stack_rankings | idx_stack_rankings_user_created | `(user_id, created_at DESC)` | History page |
| stack_rankings | idx_stack_rankings_user_job_title | `(user_id, job_title)` partial | History search |
| stack_ranking_candidates | idx_srk_candidates_ranking | `(ranking_id, rank)` | Session load + CSV |
| stack_ranking_candidates | idx_srk_candidates_user | `(user_id)` | RLS shortcut |
| activity_log | idx_activity_log_user_created | `(user_id, created_at DESC)` | Dashboard feed |
| square_webhook_events | idx_webhook_events_event_id | `event_id` unique | Idempotency |
| square_webhook_events | idx_webhook_events_unprocessed | `created_at DESC` partial | Ops monitoring |

---

## RLS Policy Summary

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| user_profiles | own row | trigger only | own row | cascade |
| team_members | owner + member own | owner only | owner only | owner only |
| resume_scores | own rows | own rows | — | own rows |
| client_summaries | own rows | own rows | — | own rows |
| boolean_searches | own rows | own rows | — | own rows |
| stack_rankings | own rows | own rows | — | own rows |
| stack_ranking_candidates | own rows | own rows | own rows (notes) | own rows |
| activity_log | own rows | own rows | — | — |
| square_webhook_events | none | none | none | none |

---

---

## Assessments Module Tables (Migration 002)

### `public.assessments`

One row per assessment. Created and owned by a manager. Published assessments cannot be edited.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NOT NULL | `gen_random_uuid()` | PK |
| `user_id` | uuid | NOT NULL | — | FK → `auth.users(id)` CASCADE |
| `title` | text | NOT NULL | — | 1–100 chars |
| `description` | text | NULL | — | max 500 chars |
| `role` | text | NOT NULL | — | Position being assessed |
| `time_limit_minutes` | integer | NOT NULL | — | 10–180 |
| `proctoring_config` | jsonb | NOT NULL | `{}` | Per-feature toggles (see shape below) |
| `question_order` | text | NOT NULL | `'sequential'` | `'sequential'` \| `'random'` |
| `presentation_mode` | text | NOT NULL | `'one_at_a_time'` | `'one_at_a_time'` \| `'all_at_once'` |
| `status` | text | NOT NULL | `'draft'` | `'draft'` \| `'published'` \| `'archived'` |
| `created_at` | timestamptz | NOT NULL | `now()` | |
| `updated_at` | timestamptz | NOT NULL | `now()` | Auto-updated by trigger |

**`proctoring_config` shape:**
```json
{
  "tab_switching": true,
  "paste_detection": true,
  "eye_tracking": false,
  "keystroke_dynamics": true,
  "presence_challenges": true,
  "presence_challenge_frequency": 2,
  "snapshots": false
}
```

**RLS:** Manager reads/writes own rows (`user_id = auth.uid()`).

---

### `public.assessment_questions`

One row per question within an assessment. Type-specific columns are nullable.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NOT NULL | `gen_random_uuid()` | PK |
| `assessment_id` | uuid | NOT NULL | — | FK → `assessments(id)` CASCADE |
| `type` | text | NOT NULL | — | `'coding'` \| `'multiple_choice'` \| `'written'` |
| `prompt` | text | NOT NULL | — | Question text |
| `points` | integer | NOT NULL | `100` | Point value, > 0 |
| `sort_order` | integer | NOT NULL | `0` | Display order |
| `language` | text | NULL | — | Coding only: `'javascript'` \| `'typescript'` \| `'react_jsx'` \| `'react_tsx'` \| `'python'` |
| `starter_code` | text | NULL | — | Coding only: initial editor content |
| `test_cases_json` | jsonb | NULL | — | Coding only: `[{input, expectedOutput}]` |
| `instructions` | text | NULL | — | Coding only: markdown instructions |
| `options_json` | jsonb | NULL | — | MC only: `[{id, text, is_correct}]` |
| `correct_option` | text | NULL | — | MC only: correct option id |
| `time_limit_secs` | integer | NULL | — | MC only: per-question timer |
| `length_hint` | text | NULL | — | Written only: `'short'` \| `'medium'` \| `'long'` |
| `rubric_hints` | text | NULL | — | Written only: grading context for Claude |
| `created_at` | timestamptz | NOT NULL | `now()` | |

**RLS:** Access via parent assessment ownership.

---

### `public.assessment_invites`

One row per candidate invite. Token is the public URL identifier (`/assess/[token]`).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NOT NULL | `gen_random_uuid()` | PK |
| `assessment_id` | uuid | NOT NULL | — | FK → `assessments(id)` CASCADE |
| `created_by` | uuid | NOT NULL | — | FK → `auth.users(id)` CASCADE — manager who sent invite |
| `candidate_name` | text | NOT NULL | — | 1–200 chars |
| `candidate_email` | text | NOT NULL | — | Validated format |
| `token` | text | NOT NULL | `gen_random_uuid()::text` | UNIQUE — used in public URL |
| `status` | text | NOT NULL | `'pending'` | `'pending'` \| `'started'` \| `'completed'` \| `'expired'` |
| `expires_at` | timestamptz | NOT NULL | `now() + 7 days` | 7-day expiry from creation |
| `sent_at` | timestamptz | NULL | — | Set when Resend email delivered |
| `created_at` | timestamptz | NOT NULL | `now()` | |

**Expiry handling:** Checked at query time (`WHERE expires_at > now()`). Batch UPDATE to `'expired'` via scheduled Edge Function daily at 3am UTC.

**RLS:** Manager reads/writes via `created_by = auth.uid()`. Candidate token validation is server-side only (service role).

---

### `public.assessment_sessions`

One row per candidate attempt. One attempt per invite (UNIQUE on `invite_id`).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NOT NULL | `gen_random_uuid()` | PK |
| `invite_id` | uuid | NOT NULL | — | FK → `assessment_invites(id)` CASCADE; UNIQUE |
| `assessment_id` | uuid | NOT NULL | — | FK → `assessments(id)` CASCADE |
| `user_id` | uuid | NULL | — | FK → `auth.users(id)` SET NULL — manager (denormalized for RLS) |
| `started_at` | timestamptz | NOT NULL | `now()` | |
| `completed_at` | timestamptz | NULL | — | Set on submit |
| `time_spent_seconds` | integer | NULL | — | Calculated on completion |
| `trust_score` | integer | NULL | — | 0–100; calculated post-completion |
| `skill_score` | integer | NULL | — | 0–100; calculated post-completion |
| `ai_integrity_summary` | text | NULL | — | Claude-generated 3-sentence summary |
| `status` | text | NOT NULL | `'in_progress'` | `'in_progress'` \| `'completed'` \| `'abandoned'` |
| `created_at` | timestamptz | NOT NULL | `now()` | |

**Note:** No `overall_score` — Trust Score and Skill Score are always displayed separately. Blending them is explicitly excluded from scope.

**Offline handling:** `status = 'abandoned'` set by server if candidate is offline > 10 minutes. localStorage progress synced to Supabase via service role API on reconnect.

**RLS:** Manager reads sessions where `user_id = auth.uid()`. All candidate writes go through service role API.

---

### `public.assessment_question_responses`

Per-question answers and Claude-generated scores. One row per question per session.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NOT NULL | `gen_random_uuid()` | PK |
| `session_id` | uuid | NOT NULL | — | FK → `assessment_sessions(id)` CASCADE |
| `question_id` | uuid | NOT NULL | — | FK → `assessment_questions(id)` CASCADE |
| `answer_text` | text | NULL | — | Written + coding: final submitted text |
| `selected_option` | text | NULL | — | MC: selected option id |
| `skill_score` | integer | NULL | — | 0–100; Claude grade or MC auto-score |
| `feedback_json` | jsonb | NULL | — | Per-category feedback (coding/written) |
| `test_results_json` | jsonb | NULL | — | Coding: per-test-case pass/fail |
| `graded_at` | timestamptz | NULL | — | Set when Claude grading completes |
| `saved_at` | timestamptz | NOT NULL | `now()` | Updated on every localStorage sync |

**UNIQUE** on `(session_id, question_id)`.

**RLS:** Manager reads via session ownership.

---

### `public.proctoring_events`

Append-only log of all proctoring signals. 90-day retention.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NOT NULL | `gen_random_uuid()` | PK |
| `session_id` | uuid | NOT NULL | — | FK → `assessment_sessions(id)` CASCADE |
| `event_type` | text | NOT NULL | — | See enum below |
| `severity` | text | NOT NULL | — | `'low'` \| `'medium'` \| `'high'` \| `'info'` |
| `payload_json` | jsonb | NOT NULL | `{}` | Event-specific data |
| `timestamp` | timestamptz | NOT NULL | `now()` | |

**Event types:** `tab_switch`, `paste_detected`, `gaze_off_screen`, `face_not_detected`, `eye_tracking_degraded`, `keystroke_anomaly`, `presence_challenge_passed`, `presence_challenge_failed`, `offline_detected`, `session_resumed`

**Retention:** Deleted after 90 days by scheduled Edge Function.

**RLS:** Manager reads via session → assessment ownership. All writes via service role API.

---

### `public.assessment_snapshots`

Webcam snapshot metadata. Actual files in private Supabase storage bucket `assessment-snapshots`.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NOT NULL | `gen_random_uuid()` | PK |
| `session_id` | uuid | NOT NULL | — | FK → `assessment_sessions(id)` CASCADE |
| `invite_id` | uuid | NOT NULL | — | FK → `assessment_invites(id)` CASCADE |
| `storage_path` | text | NOT NULL | — | Relative path in bucket: `{session_id}/{unix_ts}.jpg` |
| `taken_at` | timestamptz | NOT NULL | `now()` | |

**Storage bucket:** `assessment-snapshots` — private, signed URLs only (60s expiry), max 2MB per file, MIME: `image/jpeg`.

**Retention:** Metadata row + storage object deleted after 90 days by scheduled Edge Function.

**RLS:** Manager reads metadata via session ownership. All writes (metadata + storage) via service role API.

---

### `public.notifications`

In-app notification feed. One row per notification.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NOT NULL | `gen_random_uuid()` | PK |
| `user_id` | uuid | NOT NULL | — | FK → `auth.users(id)` CASCADE |
| `type` | text | NOT NULL | — | `'assessment_completed'` \| `'assessment_started'` \| `'invite_expired'` |
| `title` | text | NOT NULL | — | Bell dropdown headline |
| `message` | text | NULL | — | Optional body text |
| `link` | text | NULL | — | Dashboard URL to navigate to on click |
| `read` | boolean | NOT NULL | `false` | Marked true when dropdown opened |
| `created_at` | timestamptz | NOT NULL | `now()` | |

**RLS:** Users read/update own rows. INSERT via service role only.

---

### `user_profiles` modification (Migration 002)

**Added column:**

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `role` | text | NOT NULL | `'recruiter'` | `'recruiter'` \| `'manager'`; owner always treated as manager in app logic |

---

## Candidate-Facing Write Pattern

Candidate pages (`/assess/*`) have no Supabase auth session. All database writes use this pattern:

```
Browser (no auth)
    │
    │  POST /api/assess/[token]/start
    │  POST /api/assess/[token]/save
    │  POST /api/assess/[token]/events   (batched, every 60s)
    │  POST /api/assess/[token]/submit
    ▼
Next.js API Route (server-side)
    1. Validate token → query assessment_invites WHERE token = $1 AND expires_at > now()
    2. Confirm status = 'pending' or 'started'
    3. Write using Supabase ADMIN client (SUPABASE_SERVICE_ROLE_KEY)
       → service role bypasses RLS entirely
    │
    ▼
Supabase (writes bypass RLS)
```

**Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser.**

---

## Index Summary (Migration 002 additions)

| Table | Index | Columns | Purpose |
|-------|-------|---------|---------|
| assessments | idx_assessments_user_id | `user_id` | Manager's assessment list |
| assessments | idx_assessments_user_created | `(user_id, created_at DESC)` | Sorted list |
| assessments | idx_assessments_status | `(user_id, status)` | Filter by status |
| assessment_questions | idx_assessment_questions_assessment | `(assessment_id, sort_order)` | Ordered question load |
| assessment_invites | idx_assessment_invites_token | `token` UNIQUE | Token lookup on every candidate page load |
| assessment_invites | idx_assessment_invites_assessment | `(assessment_id, created_at DESC)` | Invite table in detail page |
| assessment_invites | idx_assessment_invites_created_by | `(created_by, created_at DESC)` | History tab |
| assessment_invites | idx_assessment_invites_pending_expired | `expires_at` partial (status='pending') | Expiry cleanup job |
| assessment_sessions | idx_assessment_sessions_invite | `invite_id` | Session lookup by invite |
| assessment_sessions | idx_assessment_sessions_assessment | `(assessment_id, completed_at DESC)` | Results list |
| assessment_sessions | idx_assessment_sessions_user | `(user_id, created_at DESC)` | Dashboard stat card |
| assessment_question_responses | idx_aqr_session | `session_id` | Report: all responses |
| proctoring_events | idx_proctoring_events_session_time | `(session_id, timestamp ASC)` | Chronological event timeline |
| proctoring_events | idx_proctoring_events_type | `(session_id, event_type)` | Filter by type |
| assessment_snapshots | idx_assessment_snapshots_session | `(session_id, taken_at ASC)` | Snapshot gallery |
| notifications | idx_notifications_user_unread | `(user_id, created_at DESC)` partial (read=false) | Bell unread count |
| notifications | idx_notifications_user_created | `(user_id, created_at DESC)` | Full notification list |

---

## RLS Policy Summary (Migration 002 additions)

| Table | SELECT | INSERT | UPDATE | DELETE | Notes |
|-------|--------|--------|--------|--------|-------|
| assessments | own rows | own rows | own rows | own rows | `user_id = auth.uid()` |
| assessment_questions | via assessment ownership | via assessment ownership | via assessment ownership | via assessment ownership | JOIN to assessments |
| assessment_invites | own rows (created_by) | own rows | own rows | — | Candidate access: service role only |
| assessment_sessions | own rows (user_id) | — | — | — | All candidate writes: service role only |
| assessment_question_responses | via session ownership | — | — | — | Service role for candidate saves |
| proctoring_events | via session ownership | — | — | — | Service role for candidate events |
| assessment_snapshots | via session ownership | — | — | — | Service role for uploads |
| notifications | own rows | — | own rows | — | INSERT: service role only |

## Schema Gaps Flagged (vs PRD)

| # | Gap | Resolution |
|---|-----|------------|
| 1 | `reset_date` (date) — loses timezone, requires complex "is today >= reset_date" check | Replaced with `last_reset_at` (timestamptz); check `last_reset_at < date_trunc('month', now())` |
| 2 | `billing_period_end` missing — needed for cancelling→free downgrade timing | Added to `user_profiles` |
| 3 | `subscription_status` missing `'cancelling'` state | Added; distinct from `'cancelled'` (paid until period end vs fully lapsed) |
| 4 | `candidates_json` JSONB in `stack_rankings` makes notes editable post-session impossible | Replaced with `stack_ranking_candidates` child table |
| 5 | No `activity_log` table — dashboard feed would require expensive 4-table UNION | Added `activity_log` with `(user_id, created_at DESC)` index |
| 6 | No `square_webhook_events` table — PRD explicitly requires raw event storage | Added with `UNIQUE event_id` for idempotency |
| 7 | No `invite_token` / `invite_expires_at` on `team_members` — needed for email invite link | Added both columns |
| 8 | `client_summaries` has no searchable title — PRD says filter by "job title" but no JD input | Added `candidate_name` (nullable); History page for this tab should say "Candidate Name" not "Job Title" |

## Schema Notes — Migration 002

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | No `overall_score` on `assessment_sessions` | PRD explicitly excludes combined score — Trust and Skill always shown separately |
| 2 | `assessment_question_responses` added (not in original PRD schema) | Needed for partial save sync, per-question Claude feedback, and test result display in report |
| 3 | `activity_log.feature` CHECK constraint expanded to include `'assessment'` | Required for dashboard activity feed and History 5th tab |
| 4 | Candidate writes use service role API pattern, not anon RLS policies | More secure; avoids crafting RLS policies that allow unauthenticated writes with only token validation |
| 5 | `invite_id` denormalized onto `assessment_snapshots` | Avoids JOIN through session for snapshot → invite path in cleanup job |
| 6 | `user_id` denormalized onto `assessment_sessions` | Avoids JOIN through invite → assessment for RLS without expensive nested EXISTS |
| 7 | Auto-expiry handled at query time + scheduled Edge Function | pg_cron not available on all Supabase plans; query-time check is always accurate; batch UPDATE is cleanup only |
| 8 | Judge0 (Java/C#/Go/Ruby) excluded from MVP | Client-side only for MVP: JS/TS (Function sandbox), React (iframe), Python (Pyodide). No JUDGE0_API_KEY needed yet |
