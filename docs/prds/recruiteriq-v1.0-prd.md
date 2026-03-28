# RecruiterIQ — Product Requirements Document (PRD)

## Requirements Description

### Background

- **Business Problem**: Agency recruiters and in-house recruiting teams spend significant time manually reviewing resumes, writing candidate summaries for clients, building Boolean search strings, and comparing candidates. This work is repetitive, inconsistent, and doesn't scale. RecruiterIQ uses AI to automate and standardize these workflows, saving recruiters hours per week while improving output consistency.
- **Target Users**: Agency recruiters and in-house recruiting teams — solo recruiters through small teams of up to 5 members. Users range from individual contributors to team leads who need visibility into team activity.
- **Value Proposition**: A purpose-built AI toolkit for recruiters — not a generic AI assistant — that understands recruiting workflows, enforces consistent scoring methodology, and produces client-ready outputs instantly.

---

### Feature Overview

**Core Features (MVP)**:
1. Resume Scorer (weighted CQI score with animated breakdown)
2. Client Summary Generator (streaming 4-bullet submittal summary)
3. Boolean String Generator (LinkedIn + Indeed optimized, streaming)
4. Stack Ranking / CQI Dashboard (multi-candidate leaderboard)
5. History Page (per-feature browsable, searchable, deletable history)
6. Team Management (Agency tier: owner + up to 4 invitees, admin view)
7. Subscription Management (Free / Pro / Agency via Square)
8. Dashboard Home (stats, activity feed, usage meter)
9. Landing Page (marketing, pricing, Start Free CTA)

**Out of Scope for MVP**:
- Bulk resume upload or PDF/DOCX parsing — text paste only
- Onboarding wizard — empty states with CTAs only
- Mid-month proration on plan upgrades
- Ownership transfer between team members
- Bulk history deletion
- Historical CSV export for stack rankings (current session only)
- Enterprise self-serve beyond 5 seats
- External API access for integrations

---

### Detailed Requirements

#### Feature 1: Resume Scorer

- **Inputs**: Job Description (required, max 2,000 words), Resume Text (required, max 5,000 words)
- **Validation**: Both fields required; inline error if empty on submit; character counter shown at 80% of limit (amber); hard block at limit
- **Processing**: Claude API (`claude-sonnet-4-5`), standard async/await (no streaming), server-side API route
- **Scoring Weights**:
  - Must-Have Skills Match: 40%
  - Domain/Industry Experience: 20%
  - Communication & Clarity of Resume: 15%
  - Tenure Stability: 10%
  - Depth of Tool Usage: 15%
- **Output**: Score out of 100 with animated SVG score ring + per-category mini progress bars
- **Score ring colors**: Green (80+), Yellow (60–79), Red (<60)
- **AI call cost**: 1 call per submission
- **Persistence**: Saved to `resume_scores` on success; failed calls not saved and do not count against limit

#### Feature 2: Client Summary Generator

- **Inputs**: Resume Text (required, max 5,000 words)
- **Processing**: Claude API with Server-Sent Events streaming
- **Output format**:
  - Bullet 1: Years of experience + core title/specialty
  - Bullet 2: Top 3 technical skills or tools
  - Bullet 3: Most relevant domain/industry experience
  - Bullet 4: Compensation or availability note (blank if not in resume)
- **UI**: Output streams progressively; one-click copy button with checkmark animation on completion
- **AI call cost**: 1 call per submission
- **Persistence**: Saved to `client_summaries` on success

#### Feature 3: Boolean String Generator

- **Inputs**:
  - Job Title (required)
  - Must-Have Skills (required)
  - Nice-to-Have Skills (optional)
  - Location (optional)
  - Exclude Terms (optional)
- **Processing**: Claude API with Server-Sent Events streaming
- **Output**: Two optimized strings — LinkedIn Recruiter and Indeed; Boolean operators (AND, OR, NOT) syntax-highlighted in output
- **UI**: Individual copy button per string with animation
- **AI call cost**: 1 call per submission
- **Persistence**: Saved to `boolean_searches` on success

#### Feature 4: Stack Ranking / CQI Dashboard

- **Inputs**: Job Description (required, max 2,000 words), one or more candidates (name + resume text)
- **Processing**: Each candidate scored individually via Claude API (same weights as Feature 1); standard async/await, no streaming; candidates scored in parallel where possible
- **Output**: Ranked leaderboard — Rank, Name, CQI Score, per-category breakdown; animated score count-up on reveal; color-coded rows; trophy icon for Rank 1; notes field per candidate
- **AI call cost**: 1 call per candidate scored (5-candidate session = 5 calls)
- **CSV Export** (Agency tier only): Rank, Candidate Name, CQI Score, Must-Have Skills Score, Domain Experience Score, Communication Score, Tenure Score, Tool Depth Score, Notes, Date Scored — current session only
- **Persistence**: Saved to `stack_rankings` on session complete

#### Feature 5: History Page

- **Structure**: Tabbed by feature — Resume Scores | Summaries | Boolean Strings | Stack Rankings
- **Search/filter**: By date range and job title
- **Delete**: Trash icon per row; confirmation dialog required before deletion
- **Bulk delete**: Not available in MVP
- **Retention**: Indefinite

#### Feature 6: Team Management (Agency Tier)

- **Seat model**: Owner = seat 1; can invite up to 4 additional members by email (owner + 4 = 5 total)
- **Members**: Each has own login, own history, own AI call counter
- **Owner admin view**: All members' name, email, join date, AI calls used this month
- **Remove member**: Member loses app access immediately; their history is retained on their account; they must start own subscription to regain access
- **6th seat attempt**: Prompt — "You've reached your 5-seat limit. Contact us to discuss enterprise pricing." No self-serve path.
- **Ownership transfer**: Not available in MVP

#### Feature 7: Subscription Management

| Plan | Price | AI Calls | Features |
|------|-------|----------|----------|
| Free | $0 | 10/month | Scorer, Summary, Boolean |
| Pro | $39/month | Unlimited | All above features |
| Agency | $99/month | Unlimited | Pro + Stack Ranking + Team (5 seats) + CSV Export |

- **Billing**: Square Web Payments SDK (client-side card capture) + Square Subscriptions API (server-side)
- **Webhooks**: Sync subscription status to Supabase on all payment events; idempotent handler; store raw events for replay
- **Failed payment**: 3-day grace period; persistent warning banner on all pages: *"Your payment failed — update your billing to avoid losing access."*; downgrade to Free after 3 days if unresolved
- **Cancellation**: User retains current plan access through end of billing period; then downgrades to Free
- **Upgrade**: Full amount charged immediately; no proration; plan tier updated in Supabase immediately
- **Subscription page**: View current plan, next billing date, cancel button

#### Feature 8: Dashboard Home

- **Stat cards**: Resumes scored, summaries generated, boolean strings created (current month)
- **Recent activity feed**: Last 5 actions across all features
- **Usage meter**: AI calls used vs limit; "Unlimited" shown for Pro/Agency
- **Quick action buttons**: One per AI feature
- **Upgrade CTA banner**: Shown to Free tier users only

#### Feature 9: Landing Page

- Hero: gradient headline, subheadline, "Start Free" CTA
- 4 feature highlights with icons
- Pricing section (Free / Pro / Agency cards)
- Testimonials placeholder section
- Footer

---

### Edge Cases & Error Handling

| Scenario | Behavior |
|----------|----------|
| Claude API failure | Toast: "Something went wrong — please try again." + retry button. Raw errors never shown. Failed call not counted against limit. |
| Free tier limit hit mid-session | Current in-flight request completes. Next request blocked with upgrade modal. |
| Input at 80% of character limit | Character counter turns amber. Submission still allowed. |
| Input at 100% of character limit | Hard block — cannot type further. |
| Empty required field on submit | Inline validation error shown under field. Form cannot submit. |
| Payment grace period active | Persistent warning banner on all authenticated pages for up to 3 days. |
| 6th team seat invite | Upsell prompt with contact CTA. No self-serve resolution. |
| Unverified email after signup | Redirect to "Check your email" screen. App inaccessible until verified. |

---

## Design Decisions

### Technical Approach

- **Framework**: Next.js 14 App Router — server components for data fetching, client components for interactive UI and animations
- **AI**: All Claude API calls server-side in Next.js API routes. Streaming via Server-Sent Events for Summary Generator and Boolean Generator. Standard async/await for Resume Scorer and Stack Ranking (structured JSON responses)
- **Auth**: Supabase email/password with email verification enforced before app access
- **Database**: Supabase PostgreSQL with Row Level Security (RLS) enforcing user data isolation on all tables
- **Payments**: Square Web Payments SDK (client-side) + Square Subscriptions API (server-side) + webhook sync
- **Animations**: Framer Motion for page transitions, card loads, AI result reveals; custom animated SVG rings for CQI scores; score count-up animation on Stack Ranking reveal
- **Deployment**: Railway with all environment variables configured via Railway dashboard

### Key Components

- Auth middleware protecting all `/app/*` routes; redirect unauthenticated and unverified users
- Plan gate middleware: check `user_profiles.plan_tier` and `ai_calls_this_month` before executing AI calls
- AI call counter: increment on success only; reset on 1st of each calendar month
- Square webhook handler with SQUARE_WEBHOOK_SIGNATURE_KEY verification; idempotent by event ID
- SSE streaming endpoints: `/api/summary/stream`, `/api/boolean/stream`
- Team invite system: email-based invitations with pending/active/removed status
- CSV export generator for Stack Ranking sessions (Agency tier gate enforced server-side)

### Data Storage

```sql
-- Supabase manages the users table via auth

user_profiles (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL UNIQUE,
  plan_tier text NOT NULL DEFAULT 'free', -- 'free' | 'pro' | 'agency'
  subscription_status text NOT NULL DEFAULT 'free', -- 'active' | 'grace' | 'cancelled' | 'free'
  square_customer_id text,
  square_subscription_id text,
  ai_calls_this_month integer NOT NULL DEFAULT 0,
  reset_date date NOT NULL DEFAULT date_trunc('month', now()),
  grace_period_start timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
)

team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid REFERENCES auth.users NOT NULL,
  member_user_id uuid REFERENCES auth.users,
  invited_email text NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- 'pending' | 'active' | 'removed'
  joined_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
)

resume_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  job_title text,
  resume_text text NOT NULL,
  jd_text text NOT NULL,
  score integer NOT NULL,
  breakdown_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
)

client_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  resume_text text NOT NULL,
  summary_output text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
)

boolean_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  inputs_json jsonb NOT NULL,
  linkedin_string text NOT NULL,
  indeed_string text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
)

stack_rankings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  job_title text,
  candidates_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
)
```

### Constraints

- **Performance**: Streaming features render first token within 2 seconds of submission; loading skeleton shown immediately on all AI submissions
- **Security**: All API keys (Anthropic, Square, Supabase service role) server-side only; Square webhook signature verified on every request; Supabase RLS enforces row-level user isolation; no raw error messages exposed to client
- **Cost control**: Resume max 5,000 words; JD max 2,000 words enforced client and server-side
- **Scalability**: Monthly reset via `reset_date` check on each AI call; seat count enforced at invite time server-side
- **Compatibility**: Mobile responsive at 375px and above; dark mode only

### Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Square SDK integration complexity — less documented than Stripe | Medium | Use Square sandbox extensively; build payment flow early in Phase 4 to surface issues |
| Claude API streaming in Next.js App Router requires careful SSE setup | Medium | Prototype streaming endpoint before building UI; keep non-streaming fallback |
| Supabase RLS policies can silently block data access | High | Write and test RLS policies immediately after schema creation; validate in Supabase dashboard |
| Square webhooks may arrive out of order or be delayed | Medium | Idempotent webhook handler; store raw events table for replay and audit |
| Claude API rate limits under heavy Agency Stack Ranking usage | Low-Medium | Show per-candidate progress UI; consider request queuing if scoring >10 candidates |
| Team management is the most complex feature relative to MVP value | Low | Build last in Phase 5; can ship without it if timeline is constrained |

---

## Acceptance Criteria

### Functional Acceptance

- [ ] **Auth**: User can sign up, receive verification email, verify email, and access dashboard. Unverified users see "Check your email" screen and cannot access app.
- [ ] **Resume Scorer**: User can paste JD + resume, submit, and receive score out of 100 with animated ring and per-category breakdown. Result saved to history.
- [ ] **Client Summary Generator**: User can paste resume and receive a progressively streaming 4-bullet summary. Copy to clipboard works with checkmark animation. Result saved to history.
- [ ] **Boolean String Generator**: User can enter job title + must-have skills (and optional fields) and receive syntax-highlighted LinkedIn and Indeed strings. Each has a copy button. Result saved to history.
- [ ] **Stack Ranking**: Agency user can input multiple candidates + JD, receive animated ranked leaderboard, add notes, and export CSV with correct 10 columns.
- [ ] **History Page**: All 4 feature tabs display past results. Search by date and job title works. Delete with confirmation removes individual records.
- [ ] **Free Tier Gate**: Free user blocked after 10 AI calls with upgrade modal. In-flight request always completes.
- [ ] **Pro Gate**: Pro user has unlimited AI calls; Stack Ranking, team features, and CSV export are inaccessible.
- [ ] **Agency Gate**: Agency user has all features; team seat management and CSV export functional.
- [ ] **Team Management**: Agency owner can invite up to 4 members by email, view admin dashboard with usage stats, and remove members. 6th invite shows enterprise contact prompt.
- [ ] **Subscription Management**: User can view plan and billing date, cancel subscription (access retained through billing period end), and upgrade (charged immediately).
- [ ] **Failed Payment Grace Period**: Persistent warning banner shown for 3 days; plan downgrades to Free on day 4 if payment not resolved.
- [ ] **Landing Page**: Hero, feature highlights, pricing, testimonials placeholder, and footer render correctly. "Start Free" CTA routes to signup.

### Quality Standards

- [ ] **Security**: All API keys server-side; Square webhook signature verified; Supabase RLS enforced on all tables; no raw API errors shown to users
- [ ] **Responsive**: All pages functional and usable on mobile (375px+) and desktop
- [ ] **Input Validation**: Character limits enforced with counters; required fields validated inline on submit; hard block prevents submission of over-limit input
- [ ] **Loading States**: Loading skeleton shown immediately on all AI submissions; streaming output renders progressively
- [ ] **Error Recovery**: Claude API failure shows toast with retry button; failed calls never deducted from monthly limit

### User Acceptance

- [ ] **Design System**: Dark mode default (#0F1117 background), glass morphism cards, electric indigo (#6366F1) accents, Inter font, Lucide icons throughout
- [ ] **Animations**: Framer Motion page transitions and card loads; SVG score ring animates on reveal; Stack Ranking scores count up; AI result reveals fade-in + slide-up
- [ ] **Copy UX**: One-click copy with checkmark animation on Summary and Boolean outputs
- [ ] **Toast Notifications**: Dark-themed with colored left border for success/error/warning
- [ ] **Empty States**: All features and history tabs show illustration + one-line description + CTA when no data exists
- [ ] **Upgrade CTA**: Free tier users see upgrade banner on dashboard and upgrade modal when limit is hit

---

## Execution Phases

### Phase 1: Foundation & Auth
**Goal**: Project scaffolding, design system, auth, database schema, and Railway deployment

- [ ] Initialize Next.js 14 App Router project with Tailwind CSS, shadcn/ui, Framer Motion
- [ ] Configure Supabase project: email/password auth, email verification required, SMTP settings
- [ ] Create full database schema in Supabase with RLS policies on all tables
- [ ] Implement auth flow: signup, login, email verification gate, protected `/app/*` routes, redirect logic
- [ ] Build design system baseline: color tokens, glass morphism card, button variants (rounded-xl, hover glow), toast component, loading skeleton
- [ ] Configure Railway deployment with all environment variables
- [ ] **Deliverables**: Working auth with email verification on Railway; full Supabase schema live with RLS; design system components
- [ ] **Estimated effort**: 2–3 days

---

### Phase 2: AI Features
**Goal**: All 4 AI features with plan gating, validation, and history persistence

- [ ] Build plan gate middleware: check `plan_tier` and `ai_calls_this_month` before every AI call; increment counter on success only
- [ ] Free tier limit enforcement: block after 10 calls with upgrade modal; in-flight requests always complete
- [ ] **Resume Scorer**: two-textarea form with validation + character counters; Claude API route (async/await); animated SVG score ring; per-category mini progress bars; save to `resume_scores`
- [ ] **Client Summary Generator**: textarea form; SSE streaming API route (`/api/summary/stream`); progressive render; copy button with checkmark animation; save to `client_summaries`
- [ ] **Boolean String Generator**: multi-field form (required: job title + must-have skills); SSE streaming API route (`/api/boolean/stream`); syntax-highlighted output; per-string copy buttons; save to `boolean_searches`
- [ ] **Stack Ranking**: multi-candidate input UI; batch Claude API calls (1 per candidate); animated leaderboard with score count-up; trophy icon for rank 1; notes per candidate; save to `stack_rankings`; CSV export (Agency gate enforced server-side)
- [ ] Loading skeletons on all AI submissions; micro-animations on result reveals (fade-in + slide-up)
- [ ] **Deliverables**: All 4 features functional with plan gating; history saved; streaming working
- [ ] **Estimated effort**: 5–7 days

---

### Phase 3: Dashboard & History
**Goal**: Dashboard home, history page, and empty states

- [ ] Dashboard home: animated stat cards (monthly counts), recent activity feed (last 5 actions), usage meter, quick action buttons, Free tier upgrade CTA banner
- [ ] History page: tabbed layout (4 tabs), search/filter by date range + job title, delete row with confirmation dialog, empty state per tab
- [ ] Empty states for all features and history tabs: illustration/icon + one-line description + CTA button
- [ ] **Deliverables**: Dashboard and history fully functional; empty states in place
- [ ] **Estimated effort**: 2–3 days

---

### Phase 4: Payments & Subscriptions
**Goal**: Full Square billing integration and subscription lifecycle

- [ ] Square Web Payments SDK integration: card capture UI on upgrade flow
- [ ] Square Subscriptions API: create Pro ($39/mo) and Agency ($99/mo) subscriptions server-side
- [ ] Webhook endpoint (`/api/webhooks/square`) with SQUARE_WEBHOOK_SIGNATURE_KEY verification; idempotent by event ID; sync `subscription_status` and `plan_tier` to Supabase
- [ ] Grace period logic: set `grace_period_start` on failed payment; show persistent warning banner; auto-downgrade after 3 days via webhook or cron check
- [ ] Cancellation flow: update status in Supabase; retain access through billing period end via `subscription_status` check
- [ ] Upgrade flow: immediate charge; immediate `plan_tier` update in Supabase
- [ ] Subscription management page: current plan display, next billing date, cancel button with confirmation
- [ ] **Deliverables**: Full billing lifecycle working in Square sandbox; upgrade/cancel/grace period flows tested
- [ ] **Estimated effort**: 3–5 days

---

### Phase 5: Team Management, Landing Page & Polish
**Goal**: Agency team features, marketing page, final animation and responsive polish

- [ ] Team invite system: owner sends email invite; invite stored as `pending` in `team_members`; invite link routes member through signup/login and activates seat
- [ ] Owner admin view: member table with name, email, join date, AI calls this month
- [ ] Remove member: set status to `removed`; revoke app access; member's data retained
- [ ] Seat enforcement: block invite at 5 seats; show enterprise contact prompt on 6th attempt
- [ ] Landing page: hero section, 4 feature highlights with Lucide icons, pricing cards (Free/Pro/Agency), testimonials placeholder, footer
- [ ] Final animation audit: Framer Motion page transitions, card loads, score ring animations, Stack Ranking count-up
- [ ] Mobile responsiveness audit across all pages (375px+)
- [ ] **Deliverables**: Agency team features live; landing page live; production-ready on Railway
- [ ] **Estimated effort**: 3–4 days

---

**Document Version**: 1.0
**Created**: 2026-03-27
**Clarification Rounds**: 3
**Final Quality Score**: 91/100
