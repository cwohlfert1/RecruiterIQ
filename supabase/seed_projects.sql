-- =============================================================================
-- RecruiterIQ — Projects Module Seed Data
-- File: supabase/seed_projects.sql
-- Run after: seed.sql, seed_assessments.sql, migration 005
--
-- BEFORE RUNNING:
--   Replace every occurrence of 'REPLACE_WITH_YOUR_USER_ID' with your actual
--   auth.users UUID. To find it:
--     SELECT id FROM auth.users LIMIT 5;
--   Or check: Supabase Dashboard → Authentication → Users
--
-- Seed contents:
--   1 project     — "Senior React Developer" at TechCorp (Active, has JD)
--   3 candidates  — Alice Chen (scored CQI 87), Bob Martinez (unscored),
--                   Carol White (red flags checked)
--   2 boolean strings — one per recruiter (simulated with same user; swap
--                       REPLACE_WITH_RECRUITER_2_ID for a real second user)
--   5 activity rows — representative action history
-- =============================================================================


-- =============================================================================
-- Stable UUIDs (used throughout — safe to re-run via ON CONFLICT DO NOTHING)
-- =============================================================================

-- project:    f47ac10b-58cc-4372-a567-0e02b2c3d479
-- candidate1: 550e8400-e29b-41d4-a716-446655440001
-- candidate2: 550e8400-e29b-41d4-a716-446655440002
-- candidate3: 550e8400-e29b-41d4-a716-446655440003
-- boolean1:   660e8400-e29b-41d4-a716-446655440001
-- boolean2:   660e8400-e29b-41d4-a716-446655440002
-- activity1:  770e8400-e29b-41d4-a716-446655440001
-- activity2:  770e8400-e29b-41d4-a716-446655440002
-- activity3:  770e8400-e29b-41d4-a716-446655440003
-- activity4:  770e8400-e29b-41d4-a716-446655440004
-- activity5:  770e8400-e29b-41d4-a716-446655440005


-- =============================================================================
-- 1. PROJECT
-- =============================================================================

INSERT INTO public.projects (
  id,
  owner_id,
  title,
  client_name,
  jd_text,
  status
) VALUES (
  'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  'REPLACE_WITH_YOUR_USER_ID'::uuid,
  'Senior React Developer',
  'TechCorp',
  E'We are looking for a Senior React Developer to join our growing engineering team at TechCorp.\n\n'
  E'Requirements:\n'
  E'- 5+ years of experience with React and modern JavaScript (ES6+)\n'
  E'- Strong proficiency in TypeScript\n'
  E'- Experience with Next.js and server-side rendering\n'
  E'- Familiarity with state management (Redux, Zustand, or React Query)\n'
  E'- Experience with REST APIs and GraphQL\n'
  E'- Knowledge of CSS-in-JS solutions (Tailwind CSS, Styled Components)\n'
  E'- Experience with testing frameworks (Jest, React Testing Library)\n'
  E'- Understanding of CI/CD pipelines and DevOps practices\n\n'
  E'Nice to have:\n'
  E'- Experience with Node.js and backend development\n'
  E'- Familiarity with AWS or GCP cloud services\n'
  E'- Open source contributions\n\n'
  E'The role is fully remote. We offer competitive compensation, equity, and comprehensive benefits.',
  'active'
) ON CONFLICT (id) DO NOTHING;


-- =============================================================================
-- 2. PROJECT MEMBER (owner)
-- The /api/projects/create route inserts the owner as a member. Seeded here
-- so project RLS policies work correctly for subsequent inserts.
-- =============================================================================

INSERT INTO public.project_members (
  project_id,
  user_id,
  role,
  added_by
) VALUES (
  'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  'REPLACE_WITH_YOUR_USER_ID'::uuid,
  'owner',
  'REPLACE_WITH_YOUR_USER_ID'::uuid
) ON CONFLICT (project_id, user_id) DO NOTHING;


-- =============================================================================
-- 3. CANDIDATES
-- =============================================================================

-- Candidate 1: Alice Chen — scored, CQI 87
INSERT INTO public.project_candidates (
  id,
  project_id,
  candidate_name,
  candidate_email,
  resume_text,
  cqi_score,
  cqi_breakdown_json,
  status,
  added_by
) VALUES (
  '550e8400-e29b-41d4-a716-446655440001',
  'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  'Alice Chen',
  'alice.chen@example.com',
  E'Alice Chen\nalice.chen@example.com | linkedin.com/in/alicechen\n\n'
  E'SUMMARY\nSenior Frontend Engineer with 7 years of experience building high-performance web '
  E'applications. Deep expertise in React, TypeScript, and Next.js. Proven track record shipping '
  E'features used by millions at scale.\n\n'
  E'EXPERIENCE\nSenior Frontend Engineer — Stripe (2021–present)\n'
  E'- Led migration of core dashboard from Angular to React, reducing bundle size by 40%\n'
  E'- Built and maintained internal component library used across 8 product teams\n'
  E'- Mentored 4 junior engineers; drove adoption of TypeScript across the frontend org\n\n'
  E'Frontend Engineer — Shopify (2018–2021)\n'
  E'- Delivered 12 A/B experiments in the checkout flow, lifting conversion by 3.2%\n'
  E'- Rebuilt the merchant analytics dashboard using React and GraphQL\n'
  E'- Owned Jest + Playwright test suite; maintained 92% code coverage\n\n'
  E'SKILLS\nReact, TypeScript, Next.js, GraphQL, Tailwind CSS, Redux, React Query, Jest, Playwright\n\n'
  E'EDUCATION\nB.S. Computer Science, UC Berkeley, 2017',
  87,
  '{
    "must_have_skills":  { "score": 92, "weight": 0.40, "weighted": 37 },
    "domain_experience": { "score": 85, "weight": 0.20, "weighted": 17 },
    "communication":     { "score": 90, "weight": 0.15, "weighted": 14 },
    "tenure_stability":  { "score": 80, "weight": 0.10, "weighted":  8 },
    "tool_depth":        { "score": 75, "weight": 0.15, "weighted": 11 }
  }'::jsonb,
  'reviewing',
  'REPLACE_WITH_YOUR_USER_ID'::uuid
) ON CONFLICT (id) DO NOTHING;


-- Candidate 2: Bob Martinez — added without JD scoring (cqi_score is null)
INSERT INTO public.project_candidates (
  id,
  project_id,
  candidate_name,
  candidate_email,
  resume_text,
  cqi_score,
  cqi_breakdown_json,
  status,
  added_by
) VALUES (
  '550e8400-e29b-41d4-a716-446655440002',
  'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  'Bob Martinez',
  'bob.martinez@example.com',
  E'Bob Martinez\nbob.martinez@example.com\n\n'
  E'SUMMARY\nFrontend developer with 4 years of experience. Comfortable with React and Vue.\n\n'
  E'EXPERIENCE\nFrontend Developer — Acme Corp (2020–present)\n'
  E'- Built customer-facing features in React and JavaScript\n'
  E'- Worked with REST APIs; maintained SCSS stylesheets\n'
  E'- Collaborated with design team on component library\n\n'
  E'Junior Developer — Local Agency (2019–2020)\n'
  E'- Built landing pages with HTML, CSS, jQuery\n\n'
  E'SKILLS\nReact, JavaScript, Vue.js, SCSS, REST APIs\n\n'
  E'EDUCATION\nB.S. Information Technology, Arizona State University, 2019',
  null,
  null,
  'reviewing',
  'REPLACE_WITH_YOUR_USER_ID'::uuid
) ON CONFLICT (id) DO NOTHING;


-- Candidate 3: Carol White — scored CQI 72, red flags checked
INSERT INTO public.project_candidates (
  id,
  project_id,
  candidate_name,
  candidate_email,
  resume_text,
  cqi_score,
  cqi_breakdown_json,
  red_flag_score,
  red_flag_summary,
  red_flags_json,
  status,
  added_by
) VALUES (
  '550e8400-e29b-41d4-a716-446655440003',
  'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  'Carol White',
  'carol.white@example.com',
  E'Carol White\ncarol.white@example.com\n\n'
  E'SUMMARY\nExperienced React developer with 5 years of industry experience across several startups.\n\n'
  E'EXPERIENCE\nFrontend Lead — StartupA (Oct 2023–present)\n'
  E'Frontend Engineer — StartupB (Mar 2023–Sep 2023)\n'
  E'React Developer — StartupC (Aug 2022–Feb 2023)\n'
  E'UI Developer — StartupD (2021–2022)\n'
  E'Junior Frontend — Agency (2019–2021)\n\n'
  E'SKILLS\nReact, JavaScript, TypeScript, CSS, REST APIs\n\n'
  E'EDUCATION\nB.A. Graphic Design, 2018',
  72,
  '{
    "must_have_skills":  { "score": 78, "weight": 0.40, "weighted": 31 },
    "domain_experience": { "score": 65, "weight": 0.20, "weighted": 13 },
    "communication":     { "score": 70, "weight": 0.15, "weighted": 11 },
    "tenure_stability":  { "score": 35, "weight": 0.10, "weighted":  4 },
    "tool_depth":        { "score": 80, "weight": 0.15, "weighted": 12 }
  }'::jsonb,
  38,
  'Significant job-hopping pattern detected: 4 roles in under 24 months, with the longest '
  'tenure at 7 months. Proceed with caution — discuss reasons for frequent transitions.',
  '[
    {
      "severity": "high",
      "category": "tenure_stability",
      "detail": "4 jobs in 24 months — average tenure under 7 months"
    },
    {
      "severity": "medium",
      "category": "experience_gap",
      "detail": "No TypeScript mentioned in most recent 3 roles despite being a core requirement"
    }
  ]'::jsonb,
  'screening',
  'REPLACE_WITH_YOUR_USER_ID'::uuid
) ON CONFLICT (id) DO NOTHING;


-- =============================================================================
-- 4. BOOLEAN STRINGS
-- Two recruiter variations. Uses the same user ID for demonstration.
-- Swap REPLACE_WITH_RECRUITER_2_ID with a real second team member's UUID
-- to simulate the multi-recruiter scenario.
-- =============================================================================

-- Variation 1: assigned to the project owner (active)
INSERT INTO public.project_boolean_strings (
  id,
  project_id,
  user_id,
  linkedin_string,
  indeed_string,
  is_active,
  created_by
) VALUES (
  '660e8400-e29b-41d4-a716-446655440001',
  'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  'REPLACE_WITH_YOUR_USER_ID'::uuid,
  '("React Developer" OR "Frontend Engineer" OR "UI Engineer") AND ("TypeScript" OR "TS") AND ("Next.js" OR "NextJS") AND "5+ years" NOT (junior OR intern OR entry-level)',
  '("React Developer" OR "Frontend Engineer") AND TypeScript AND "Next.js" AND (senior OR lead) NOT junior',
  true,
  'REPLACE_WITH_YOUR_USER_ID'::uuid
) ON CONFLICT (id) DO NOTHING;

-- Variation 2: assigned to a second recruiter (active)
-- Replace REPLACE_WITH_RECRUITER_2_ID with a real UUID or the same user ID for testing
INSERT INTO public.project_boolean_strings (
  id,
  project_id,
  user_id,
  linkedin_string,
  indeed_string,
  is_active,
  created_by
) VALUES (
  '660e8400-e29b-41d4-a716-446655440002',
  'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  'REPLACE_WITH_RECRUITER_2_ID'::uuid,
  '("ReactJS Developer" OR "Frontend Developer" OR "React Engineer") AND ("JavaScript" OR "JS") AND ("NextJS" OR "Next.js" OR "SSR") AND (principal OR senior OR "5 years") NOT (contract OR freelance OR intern)',
  '("React" OR "ReactJS") AND "frontend developer" AND (TypeScript OR JavaScript) AND senior NOT (entry OR junior)',
  true,
  'REPLACE_WITH_YOUR_USER_ID'::uuid
) ON CONFLICT (id) DO NOTHING;


-- =============================================================================
-- 5. ACTIVITY LOG
-- 5 representative entries; newest first in display but inserted oldest-first
-- for clarity. created_at values spread over the past 3 days.
-- =============================================================================

-- Entry 1: Project created
INSERT INTO public.project_activity (
  id,
  project_id,
  user_id,
  action_type,
  metadata_json,
  created_at
) VALUES (
  '770e8400-e29b-41d4-a716-446655440001',
  'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  'REPLACE_WITH_YOUR_USER_ID'::uuid,
  'project_created',
  '{"project_title": "Senior React Developer", "client_name": "TechCorp"}'::jsonb,
  now() - interval '3 days'
) ON CONFLICT (id) DO NOTHING;

-- Entry 2: Alice Chen added (auto-scored)
INSERT INTO public.project_activity (
  id,
  project_id,
  user_id,
  action_type,
  metadata_json,
  created_at
) VALUES (
  '770e8400-e29b-41d4-a716-446655440002',
  'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  'REPLACE_WITH_YOUR_USER_ID'::uuid,
  'candidate_added',
  '{
    "candidate_name":  "Alice Chen",
    "candidate_email": "alice.chen@example.com",
    "cqi_score":       87
  }'::jsonb,
  now() - interval '2 days 18 hours'
) ON CONFLICT (id) DO NOTHING;

-- Entry 3: Boolean variations generated
INSERT INTO public.project_activity (
  id,
  project_id,
  user_id,
  action_type,
  metadata_json,
  created_at
) VALUES (
  '770e8400-e29b-41d4-a716-446655440003',
  'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  'REPLACE_WITH_YOUR_USER_ID'::uuid,
  'boolean_generated',
  '{"recruiter_count": 2}'::jsonb,
  now() - interval '2 days 12 hours'
) ON CONFLICT (id) DO NOTHING;

-- Entry 4: Bob Martinez added (no JD at time — score null; JD added later)
INSERT INTO public.project_activity (
  id,
  project_id,
  user_id,
  action_type,
  metadata_json,
  created_at
) VALUES (
  '770e8400-e29b-41d4-a716-446655440004',
  'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  'REPLACE_WITH_YOUR_USER_ID'::uuid,
  'candidate_added',
  '{
    "candidate_name":  "Bob Martinez",
    "candidate_email": "bob.martinez@example.com",
    "cqi_score":       null
  }'::jsonb,
  now() - interval '1 day 6 hours'
) ON CONFLICT (id) DO NOTHING;

-- Entry 5: Red flag check on Carol White
INSERT INTO public.project_activity (
  id,
  project_id,
  user_id,
  action_type,
  metadata_json,
  created_at
) VALUES (
  '770e8400-e29b-41d4-a716-446655440005',
  'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  'REPLACE_WITH_YOUR_USER_ID'::uuid,
  'red_flag_checked',
  '{
    "candidate_name":  "Carol White",
    "candidate_email": "carol.white@example.com",
    "red_flag_score":  38,
    "flag_count":      2
  }'::jsonb,
  now() - interval '4 hours'
) ON CONFLICT (id) DO NOTHING;
