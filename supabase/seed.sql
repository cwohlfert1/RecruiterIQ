-- =============================================================================
-- RecruiterIQ — Seed Data
-- Created: 2026-03-27
--
-- Creates 3 test users (one per plan tier) with representative data.
-- Run after 001_initial_schema.sql.
--
-- Test accounts:
--   free@test.recruiteriq.com     — Free tier  (password: TestSeed123!)
--   pro@test.recruiteriq.com      — Pro tier   (password: TestSeed123!)
--   agency@test.recruiteriq.com   — Agency tier (password: TestSeed123!)
--
-- NOTE: Inserting into auth.users requires the Supabase service role key
-- or running via the Supabase SQL editor (which runs as superuser).
-- Do NOT run this in client-side code.
--
-- The handle_new_user() trigger will auto-create user_profiles rows,
-- so we only INSERT into user_profiles to UPDATE the plan_tier/status.
-- =============================================================================

BEGIN;

-- =============================================================================
-- STEP 1: Create auth.users rows
-- All passwords are "TestSeed123!" — bcrypt hash (cost 10) generated offline.
-- =============================================================================

INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change
) VALUES
  -- Free tier user
  (
    '11111111-1111-1111-1111-111111111111',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'free@test.recruiteriq.com',
    '$2a$10$RzIFmB0RjjU.pORxV9hpb.h2/b7fYf2vRpZ3M7MXPsX9TiZnZ4Jai',  -- TestSeed123!
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Alex Freeman"}',
    now() - interval '30 days',
    now(),
    '', '', '', ''
  ),
  -- Pro tier user
  (
    '22222222-2222-2222-2222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'pro@test.recruiteriq.com',
    '$2a$10$RzIFmB0RjjU.pORxV9hpb.h2/b7fYf2vRpZ3M7MXPsX9TiZnZ4Jai',  -- TestSeed123!
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Parker Reed"}',
    now() - interval '60 days',
    now(),
    '', '', '', ''
  ),
  -- Agency tier user (team owner)
  (
    '33333333-3333-3333-3333-333333333333',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'agency@test.recruiteriq.com',
    '$2a$10$RzIFmB0RjjU.pORxV9hpb.h2/b7fYf2vRpZ3M7MXPsX9TiZnZ4Jai',  -- TestSeed123!
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Jordan Hayes"}',
    now() - interval '90 days',
    now(),
    '', '', '', ''
  ),
  -- Agency tier team member (invited by agency user)
  (
    '44444444-4444-4444-4444-444444444444',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'member@test.recruiteriq.com',
    '$2a$10$RzIFmB0RjjU.pORxV9hpb.h2/b7fYf2vRpZ3M7MXPsX9TiZnZ4Jai',  -- TestSeed123!
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Casey Morgan"}',
    now() - interval '45 days',
    now(),
    '', '', '', ''
  )
ON CONFLICT (id) DO NOTHING;


-- =============================================================================
-- STEP 2: Update user_profiles
-- The trigger auto-created rows with plan_tier='free'. Update to correct tiers.
-- =============================================================================

-- Free user: already at defaults, just set call count to simulate some usage
UPDATE public.user_profiles
SET
  ai_calls_this_month = 7,
  last_reset_at = date_trunc('month', now())
WHERE user_id = '11111111-1111-1111-1111-111111111111';

-- Pro user
UPDATE public.user_profiles
SET
  plan_tier              = 'pro',
  subscription_status    = 'active',
  square_customer_id     = 'CUST_TEST_PRO_001',
  square_subscription_id = 'SUB_TEST_PRO_001',
  ai_calls_this_month    = 34,
  last_reset_at          = date_trunc('month', now()),
  billing_period_end     = date_trunc('month', now()) + interval '1 month'
WHERE user_id = '22222222-2222-2222-2222-222222222222';

-- Agency user (owner)
UPDATE public.user_profiles
SET
  plan_tier              = 'agency',
  subscription_status    = 'active',
  square_customer_id     = 'CUST_TEST_AGENCY_001',
  square_subscription_id = 'SUB_TEST_AGENCY_001',
  ai_calls_this_month    = 112,
  last_reset_at          = date_trunc('month', now()),
  billing_period_end     = date_trunc('month', now()) + interval '1 month'
WHERE user_id = '33333333-3333-3333-3333-333333333333';

-- Agency member: member has their own free profile until they sub independently
-- (while on team, their access is governed by owner's agency status check in app logic)
UPDATE public.user_profiles
SET
  ai_calls_this_month = 18,
  last_reset_at = date_trunc('month', now())
WHERE user_id = '44444444-4444-4444-4444-444444444444';


-- =============================================================================
-- STEP 3: Team membership for agency user
-- =============================================================================

INSERT INTO public.team_members (
  id,
  owner_user_id,
  member_user_id,
  invited_email,
  invite_token,
  invite_expires_at,
  status,
  joined_at
) VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '33333333-3333-3333-3333-333333333333',
  '44444444-4444-4444-4444-444444444444',
  'member@test.recruiteriq.com',
  NULL,                                           -- token cleared after acceptance
  NULL,
  'active',
  now() - interval '45 days'
),
-- A pending invite (no account yet)
(
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  '33333333-3333-3333-3333-333333333333',
  NULL,
  'pending.invite@example.com',
  'tok_seed_pending_abc123',
  now() + interval '7 days',
  'pending',
  NULL
)
ON CONFLICT (id) DO NOTHING;


-- =============================================================================
-- STEP 4: Resume Scores (Feature 1 history)
-- =============================================================================

INSERT INTO public.resume_scores (id, user_id, job_title, resume_text, jd_text, score, breakdown_json, created_at)
VALUES
  -- Free user — 3 scores this month
  (
    'rs-1111-0001-0000-0000-000000000001',
    '11111111-1111-1111-1111-111111111111',
    'Senior Frontend Engineer',
    'Jane Doe | 8 years experience in React, TypeScript, Redux...',
    'We are looking for a Senior Frontend Engineer with 5+ years React experience...',
    82,
    '{"must_have_skills":{"score":88,"weight":0.40,"weighted":35},"domain_experience":{"score":75,"weight":0.20,"weighted":15},"communication":{"score":85,"weight":0.15,"weighted":13},"tenure_stability":{"score":80,"weight":0.10,"weighted":8},"tool_depth":{"score":85,"weight":0.15,"weighted":13}}',
    now() - interval '5 days'
  ),
  (
    'rs-1111-0002-0000-0000-000000000001',
    '11111111-1111-1111-1111-111111111111',
    'Product Manager',
    'John Smith | 4 years in B2B SaaS product management...',
    'Seeking an experienced Product Manager to lead our platform team...',
    61,
    '{"must_have_skills":{"score":65,"weight":0.40,"weighted":26},"domain_experience":{"score":60,"weight":0.20,"weighted":12},"communication":{"score":70,"weight":0.15,"weighted":11},"tenure_stability":{"score":55,"weight":0.10,"weighted":6},"tool_depth":{"score":55,"weight":0.15,"weighted":8}}',
    now() - interval '3 days'
  ),
  (
    'rs-1111-0003-0000-0000-000000000001',
    '11111111-1111-1111-1111-111111111111',
    'DevOps Engineer',
    'Maria Garcia | 6 years AWS, Terraform, Kubernetes...',
    'Looking for a DevOps Engineer to lead our cloud infrastructure...',
    91,
    '{"must_have_skills":{"score":95,"weight":0.40,"weighted":38},"domain_experience":{"score":90,"weight":0.20,"weighted":18},"communication":{"score":85,"weight":0.15,"weighted":13},"tenure_stability":{"score":90,"weight":0.10,"weighted":9},"tool_depth":{"score":85,"weight":0.15,"weighted":13}}',
    now() - interval '1 day'
  ),
  -- Pro user — 5 scores this month
  (
    'rs-2222-0001-0000-0000-000000000001',
    '22222222-2222-2222-2222-222222222222',
    'Data Scientist',
    'Alex Kim | 5 years Python, ML, TensorFlow, Scikit-learn...',
    'Senior Data Scientist needed to build predictive models...',
    78,
    '{"must_have_skills":{"score":82,"weight":0.40,"weighted":33},"domain_experience":{"score":75,"weight":0.20,"weighted":15},"communication":{"score":70,"weight":0.15,"weighted":11},"tenure_stability":{"score":75,"weight":0.10,"weighted":8},"tool_depth":{"score":80,"weight":0.15,"weighted":12}}',
    now() - interval '8 days'
  ),
  (
    'rs-2222-0002-0000-0000-000000000001',
    '22222222-2222-2222-2222-222222222222',
    'Backend Engineer',
    'Sam Patel | 7 years Go, PostgreSQL, gRPC, microservices...',
    'Looking for a senior backend engineer with Go expertise...',
    88,
    '{"must_have_skills":{"score":92,"weight":0.40,"weighted":37},"domain_experience":{"score":85,"weight":0.20,"weighted":17},"communication":{"score":80,"weight":0.15,"weighted":12},"tenure_stability":{"score":90,"weight":0.10,"weighted":9},"tool_depth":{"score":88,"weight":0.15,"weighted":13}}',
    now() - interval '4 days'
  );


-- =============================================================================
-- STEP 5: Client Summaries (Feature 2 history)
-- =============================================================================

INSERT INTO public.client_summaries (id, user_id, candidate_name, resume_text, summary_output, created_at)
VALUES
  (
    'cs-2222-0001-0000-0000-000000000001',
    '22222222-2222-2222-2222-222222222222',
    'Sam Patel',
    'Sam Patel | 7 years Go, PostgreSQL, gRPC, microservices...',
    E'• 7 years of backend engineering experience specializing in distributed systems and microservices architecture.\n• Expert in Go, PostgreSQL, gRPC, and Docker/Kubernetes orchestration.\n• Deep domain experience in fintech and high-throughput API platforms processing 10M+ daily transactions.\n• Open to new opportunities; current compensation $185K base — flexible for the right role.',
    now() - interval '4 days'
  ),
  (
    'cs-1111-0001-0000-0000-000000000001',
    '11111111-1111-1111-1111-111111111111',
    'Jane Doe',
    'Jane Doe | 8 years experience in React, TypeScript, Redux...',
    E'• 8 years of frontend engineering experience with a focus on large-scale React applications.\n• Proficient in TypeScript, Redux Toolkit, and Next.js with a strong eye for performance optimization.\n• Primary domain experience in e-commerce and SaaS platforms with cross-functional team collaboration.\n• Availability: 2 weeks notice; compensation expectations not provided.',
    now() - interval '5 days'
  );


-- =============================================================================
-- STEP 6: Boolean Searches (Feature 3 history)
-- =============================================================================

INSERT INTO public.boolean_searches (id, user_id, job_title, inputs_json, linkedin_string, indeed_string, created_at)
VALUES
  (
    'bs-2222-0001-0000-0000-000000000001',
    '22222222-2222-2222-2222-222222222222',
    'Senior Backend Engineer',
    '{"job_title":"Senior Backend Engineer","must_have_skills":"Go, PostgreSQL, microservices","nice_to_have_skills":"Kubernetes, Redis","location":"New York, NY","exclude_terms":"junior, intern, entry level"}',
    '("Senior Backend Engineer" OR "Senior Software Engineer") AND (Go OR Golang) AND (PostgreSQL OR "Postgres") AND microservices AND ("New York" OR "NYC" OR remote) NOT (junior OR intern OR "entry level")',
    '("Senior Backend Engineer" OR "Backend Developer") AND (Go OR Golang) AND (PostgreSQL OR Postgres) AND microservices -junior -intern -"entry level" location:"New York, NY"',
    now() - interval '6 days'
  ),
  (
    'bs-3333-0001-0000-0000-000000000001',
    '33333333-3333-3333-3333-333333333333',
    'VP of Sales',
    '{"job_title":"VP of Sales","must_have_skills":"SaaS sales, enterprise accounts, quota attainment","nice_to_have_skills":"Salesforce, MEDDIC","location":"Remote","exclude_terms":"SDR, BDR, account executive"}',
    '("VP of Sales" OR "Vice President of Sales" OR "Head of Sales") AND ("SaaS" OR "B2B software") AND ("enterprise" OR "mid-market") AND ("quota" OR "revenue") NOT (SDR OR BDR OR "Account Executive")',
    '("VP Sales" OR "VP of Sales" OR "Head of Sales") AND (SaaS OR "software sales") AND enterprise AND quota -SDR -BDR -"Account Executive"',
    now() - interval '2 days'
  );


-- =============================================================================
-- STEP 7: Stack Rankings (Feature 4 — agency user only)
-- =============================================================================

INSERT INTO public.stack_rankings (id, user_id, job_title, jd_text, created_at)
VALUES (
  'sr-3333-0001-0000-0000-000000000001',
  '33333333-3333-3333-3333-333333333333',
  'Senior Account Executive',
  'We are hiring a Senior Account Executive to join our enterprise sales team. Requirements: 5+ years SaaS sales, proven quota attainment above 110%, experience closing 6-figure deals...',
  now() - interval '3 days'
);

INSERT INTO public.stack_ranking_candidates (id, ranking_id, user_id, candidate_name, resume_text, score, rank, breakdown_json, notes, created_at)
VALUES
  (
    'src-0001-0000-0000-0000-000000000001',
    'sr-3333-0001-0000-0000-000000000001',
    '33333333-3333-3333-3333-333333333333',
    'Taylor Brooks',
    'Taylor Brooks | 7 years enterprise SaaS sales, consistently 120%+ quota, closed $2M+ ARR deals at Salesforce...',
    89,
    1,
    '{"must_have_skills":{"score":95,"weight":0.40,"weighted":38},"domain_experience":{"score":90,"weight":0.20,"weighted":18},"communication":{"score":85,"weight":0.15,"weighted":13},"tenure_stability":{"score":80,"weight":0.10,"weighted":8},"tool_depth":{"score":80,"weight":0.15,"weighted":12}}',
    'Strong closer. Wants $180K base. Following up Monday.',
    now() - interval '3 days'
  ),
  (
    'src-0002-0000-0000-0000-000000000001',
    'sr-3333-0001-0000-0000-000000000001',
    '33333333-3333-3333-3333-333333333333',
    'Drew Sullivan',
    'Drew Sullivan | 5 years SaaS sales, 105% average quota attainment, SMB to mid-market focus...',
    71,
    2,
    '{"must_have_skills":{"score":75,"weight":0.40,"weighted":30},"domain_experience":{"score":70,"weight":0.20,"weighted":14},"communication":{"score":80,"weight":0.15,"weighted":12},"tenure_stability":{"score":65,"weight":0.10,"weighted":7},"tool_depth":{"score":60,"weight":0.15,"weighted":9}}',
    'Solid but mostly SMB experience. Stretch for enterprise.',
    now() - interval '3 days'
  ),
  (
    'src-0003-0000-0000-0000-000000000001',
    'sr-3333-0001-0000-0000-000000000001',
    '33333333-3333-3333-3333-333333333333',
    'Morgan Lee',
    'Morgan Lee | 4 years inside sales then AE, 98% quota, first AE role at a Series B startup...',
    58,
    3,
    '{"must_have_skills":{"score":60,"weight":0.40,"weighted":24},"domain_experience":{"score":55,"weight":0.20,"weighted":11},"communication":{"score":75,"weight":0.15,"weighted":11},"tenure_stability":{"score":50,"weight":0.10,"weighted":5},"tool_depth":{"score":55,"weight":0.15,"weighted":8}}',
    NULL,
    now() - interval '3 days'
  );


-- =============================================================================
-- STEP 8: Activity Log
-- =============================================================================

INSERT INTO public.activity_log (id, user_id, feature, record_id, description, created_at)
VALUES
  -- Free user activity
  ('al-1111-0001-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'resume_scorer',   'rs-1111-0003-0000-0000-000000000001', 'Scored resume for DevOps Engineer — 91/100',            now() - interval '1 day'),
  ('al-1111-0002-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'client_summary',  'cs-1111-0001-0000-0000-000000000001', 'Generated summary for Jane Doe',                        now() - interval '5 days'),
  ('al-1111-0003-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'resume_scorer',   'rs-1111-0002-0000-0000-000000000001', 'Scored resume for Product Manager — 61/100',            now() - interval '3 days'),
  ('al-1111-0004-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'resume_scorer',   'rs-1111-0001-0000-0000-000000000001', 'Scored resume for Senior Frontend Engineer — 82/100',   now() - interval '5 days'),
  -- Pro user activity
  ('al-2222-0001-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'resume_scorer',   'rs-2222-0002-0000-0000-000000000001', 'Scored resume for Backend Engineer — 88/100',           now() - interval '4 days'),
  ('al-2222-0002-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'client_summary',  'cs-2222-0001-0000-0000-000000000001', 'Generated summary for Sam Patel',                       now() - interval '4 days'),
  ('al-2222-0003-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'boolean_search',  'bs-2222-0001-0000-0000-000000000001', 'Generated boolean strings for Senior Backend Engineer', now() - interval '6 days'),
  ('al-2222-0004-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'resume_scorer',   'rs-2222-0001-0000-0000-000000000001', 'Scored resume for Data Scientist — 78/100',             now() - interval '8 days'),
  -- Agency user activity
  ('al-3333-0001-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'stack_ranking',   'sr-3333-0001-0000-0000-000000000001', 'Stack ranked 3 candidates for Senior Account Executive',now() - interval '3 days'),
  ('al-3333-0002-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'boolean_search',  'bs-3333-0001-0000-0000-000000000001', 'Generated boolean strings for VP of Sales',             now() - interval '2 days');


-- =============================================================================
-- STEP 9: Square Webhook Events (sample processed events)
-- =============================================================================

INSERT INTO public.square_webhook_events (id, event_id, event_type, payload, processed, processed_at)
VALUES
  (
    'wh-0001-0000-0000-0000-000000000001',
    'sq_evt_pro_subscription_created',
    'subscription.created',
    '{"id":"sq_evt_pro_subscription_created","type":"subscription.created","data":{"object":{"subscription":{"id":"SUB_TEST_PRO_001","customer_id":"CUST_TEST_PRO_001","status":"ACTIVE","plan_variation_id":"PLAN_PRO_MONTHLY"}}}}',
    true,
    now() - interval '60 days'
  ),
  (
    'wh-0002-0000-0000-0000-000000000001',
    'sq_evt_agency_subscription_created',
    'subscription.created',
    '{"id":"sq_evt_agency_subscription_created","type":"subscription.created","data":{"object":{"subscription":{"id":"SUB_TEST_AGENCY_001","customer_id":"CUST_TEST_AGENCY_001","status":"ACTIVE","plan_variation_id":"PLAN_AGENCY_MONTHLY"}}}}',
    true,
    now() - interval '90 days'
  );

COMMIT;
