# RecruiterIQ Assessments - Product Requirements Document (PRD)

## Requirements Description

### Background

- **Business Problem**: Recruiters using RecruiterIQ need a way to objectively evaluate candidate skill and integrity before submission. Currently they rely on phone screens and reference checks alone. This module adds structured, proctored skill assessments that generate a Trust Score and Skill Score — giving managers defensible, data-backed hiring signals without leaving RecruiterIQ or integrating with Bullhorn.
- **Target Users**:
  - **Managers** (Agency plan): create assessments, send invites, view full reports
  - **Recruiters** (Agency plan): access to existing tools (Scorer, Summary, Boolean, Stack Ranking) only — no assessment creation or report access
  - **Candidates**: public-facing, no login required, receive link via email
- **Value Proposition**: One tool replaces ad-hoc take-home tests, screen recording tools, and manual skill evaluations. Trust Score catches proxy test-takers. Skill Score objectively measures technical ability. Both visible separately for independent signal.

---

### Feature Overview

- **Core Features**:
  1. Assessment Builder (4-step wizard for managers)
  2. Candidate Assessment Flow (public `/assess/*` routes)
  3. Live Proctoring Suite (tab switching, paste detection, eye tracking, keystroke dynamics, presence challenges, snapshots)
  4. Skill Assessment Engine (coding with live preview, multiple choice, written)
  5. Proctoring Report with Trust Score + Skill Score
  6. Recruiter/Manager role system
  7. Transactional email via Resend

- **Feature Boundaries**:
  - Agency plan only — Free and Pro plans have no access to assessments
  - No Bullhorn or ATS integration — RecruiterIQ is fully standalone
  - No combined "overall score" — Trust and Skill always displayed separately
  - MVP languages for coding: JavaScript, TypeScript, Python, React (JSX/TSX) — client-side only
  - Judge0 integration (Java, C#, Go, Ruby) is post-MVP
  - Pre-built question library is post-MVP
  - Assessments Add-on pricing tier is post-MVP (future)
  - No video recording — snapshots only (canvas.toBlob every 5 min)

- **User Scenarios**:
  - Manager creates a React coding assessment with paste detection + presence challenges enabled, publishes it, pastes candidate email, sends link — candidate receives email, takes assessment on desktop, manager reviews Trust Score + Skill Score + full proctoring timeline
  - Candidate opens link on mobile and sees a coding challenge — app shows desktop-required warning for that question type
  - Candidate goes offline mid-assessment — "You're offline — your progress is saved" banner appears, resumes within 10 minutes, syncs to Supabase

---

### Detailed Requirements

#### Role System

Add `role` enum to `user_profiles`: `'recruiter' | 'manager'`

- **Owner**: always has manager-level access
- **Manager**: can create assessments, send invites, view all reports, assign roles in team settings
- **Recruiter**: access to Scorer, Summary, Boolean, Stack Ranking only — assessment routes return 403
- Role assignment: Owner assigns manager role to team members on `/dashboard/settings/team`
- Role field visible and editable only by Owner in team settings

#### Assessment Builder (Manager only)

4-step wizard at `/dashboard/assessments/create`:

**Step 1 — Assessment Details**
- Title (required, max 100 chars)
- Description (optional, max 500 chars)
- Role/position (required, max 100 chars)
- Time limit: overall assessment time limit in minutes (required, min 10, max 180)
- Question presentation: "One at a time" or "All at once" (recruiter toggle)

**Step 2 — Questions**
- Add questions of 3 types: Coding Challenge, Multiple Choice, Written/Short Answer
- Drag-and-drop reorder (using @dnd-kit/core or similar)
- Each question has: prompt (required), point value (default 100), type-specific fields below

*Coding Challenge fields:*
- Language: JavaScript, TypeScript, React (JSX), React (TSX), Python
- Starter code (Monaco Editor in builder)
- Test cases: array of { input: string, expectedOutput: string } — up to 10 per question
- Instructions (markdown supported)

*Multiple Choice fields:*
- Question text
- Options: 2–6 answer choices
- Correct answer (single select for MVP)
- Per-question time limit in seconds (optional; if set, overrides overall limit for that question)

*Written/Short Answer fields:*
- Question text
- Expected answer length hint: Short (1–2 sentences), Medium (1 paragraph), Long (3+ paragraphs)
- Grading rubric hints (optional — fed to Claude with response)

**Step 3 — Proctoring Settings**

Per-assessment toggles (all default OFF):
- Tab/window switching detection: on/off
- Paste detection: on/off
- Eye tracking (requires webcam + gaze consent): on/off
- Keystroke dynamics: on/off
- Human presence challenges: on/off → if on, frequency: 2 or 3 times
- Periodic snapshots (requires explicit snapshot consent): on/off

**Step 4 — Review + Publish**
- Summary of all questions, point values, time limit, proctoring settings enabled
- "Publish Assessment" button → sets status to `published`, generates shareable base link
- After publish: assessment cannot be edited (to prevent mid-session changes) — only archived

#### Invite Flow

From assessment detail page `/dashboard/assessments/[id]`:
- "Invite Candidate" form: candidate name (required) + email (required)
- Single invite at a time for MVP
- On submit:
  - Creates `assessment_invites` row with unique token (UUID), expires_at = now + 7 days, status = pending
  - Sends email via Resend: subject "You've been invited to complete an assessment for [Role]", body includes candidate name, role, company reference, and unique link `/assess/[token]`
  - Manager sees invite row in table with: candidate name, email, status badge, expiry date, link to report (once completed)

#### Candidate Assessment Flow (Public `/assess/*` routes)

These routes require NO auth. No session or cookie for the recruiter user.

**`/assess/[token]`** — Landing
- Validates token: if expired → "This assessment link has expired. Please contact the recruiter for a new link." If already completed → "You have already completed this assessment."
- Shows: assessment title, role, time limit, brief instructions, number of questions
- "Start Assessment" button → navigates to `/assess/[token]/consent`

**`/assess/[token]/consent`** — Consent Screen
- Dynamically lists only the proctoring features enabled for this assessment
- Each enabled feature has its own checkbox the candidate must check:
  - "I consent to tab switching being monitored"
  - "I consent to paste events being logged"
  - "I consent to webcam access for eye tracking" (if eye tracking on)
  - "I consent to keystroke timing being recorded"
  - "I consent to random presence challenges during the assessment"
  - "I consent to webcam snapshots being taken every 5 minutes during the assessment" (if snapshots on)
- "Begin Assessment" button disabled until all required checkboxes checked
- If webcam required (eye tracking or snapshots): browser permission prompt triggered here; if denied → show error "Webcam access is required for this assessment. Please allow camera access and refresh."

**`/assess/[token]/[questionIndex]`** — Assessment UI
- Shows one question at a time OR all at once based on assessment setting
- Timer: countdown from time limit, visible in top bar
- On time expiry: auto-submit whatever is completed
- Navigation: Previous / Next buttons (when one-at-a-time mode)
- Progress indicator: "Question 3 of 7"
- All proctoring starts immediately on first question load

*Coding question UI:*
- Monaco Editor (left pane, desktop only)
- Live preview pane (right pane, iframe sandbox with React CDN — React questions only)
  - React starter templates selectable: Blank JSX, Blank TSX, useState+useEffect, Props+Callback
- "Run Tests" button — executes test cases client-side
- Test results panel: each test case shows pass/fail with actual vs expected output
- Python: runs via Pyodide (loads on first Python question render)
- Mobile: if coding question detected on mobile → full-screen warning "This assessment contains coding challenges that require a desktop browser. Please reopen this link on your computer." — no fallback

*Multiple choice UI:*
- Question text, radio button options, per-question timer if set
- Mobile friendly

*Written response UI:*
- Textarea with word count, paste detection active
- Mobile friendly

**Auto-save**: localStorage saves full answer state every 30 seconds. On reconnect after offline, syncs to Supabase. If offline > 10 minutes → session marked `abandoned` in Supabase, candidate sees "Your session has expired due to extended offline time."

**`/assess/[token]/complete`** — Completion Screen
- "You're done! Thank you for completing your assessment."
- Shows: assessment title, role
- Does NOT show scores to candidate
- Triggers: score calculation, report generation, recruiter notification (email + in-app)

#### Proctoring — Technical Implementation

All proctoring runs entirely client-side. No audio/video streams leave the browser.

**Tab / Window Switching** (Visibility API + blur/focus)
- Log: `{ type: 'tab_switch', timestamp, duration_away_ms }`
- Flag severity: `low` if < 15s, `high` if ≥ 15s

**Paste Detection** (paste event listener on all inputs + Monaco)
- Log: `{ type: 'paste', timestamp, char_count, content_preview: first 100 chars }`
- Flag severity: `low` if < 500 chars, `high` if ≥ 500 chars

**Eye Tracking** (WebGazer.js primary, face-api.js fallback)
- WebGazer.js: calibrated on consent screen (click 5 dots) → tracks gaze coordinates
- Flag when gaze exits viewport bounds for > 2 seconds
- Log: `{ type: 'gaze_off_screen', timestamp, duration_ms }`
- Severity: `low` < 5s, `medium` 5–15s, `high` > 15s
- Known limitation: WebGazer.js accuracy degrades with poor lighting, glasses, or unusual head positions. PRD flags this — if WebGazer fails to initialize, fall back to face-api.js face-presence detection only, log `{ type: 'eye_tracking_degraded' }` in report

**Keystroke Dynamics**
- Record inter-keystroke intervals (IKI) throughout assessment
- Baseline: average IKI from first 2 minutes
- Flag: if rolling 30-second average IKI deviates > 40% from baseline
- Log: `{ type: 'keystroke_anomaly', timestamp, baseline_iki_ms, current_iki_ms }`
- Severity: always `medium`

**Human Presence Challenges**
- Triggered 2 or 3 times (recruiter setting) at random intervals (not in first 3 min or last 3 min)
- Modal: "Verify you're human — type this word: [RANDOM_WORD]" with 5-second countdown
- Pass: word typed correctly within 5 seconds
- Fail: wrong word OR timeout
- Log: `{ type: 'presence_challenge', timestamp, passed: boolean, word, response_time_ms }`
- Severity: `low` if passed, `high` if failed

**Snapshots**
- `canvas.toBlob()` from webcam stream every 5 minutes
- Upload to Supabase storage bucket `assessment-snapshots` at path `{session_id}/{timestamp}.jpg`
- Creates `assessment_snapshots` row
- Only visible to manager in report

#### Trust Score Calculation

Starts at 100, deductions applied:

| Event | Deduction |
|-------|-----------|
| Tab switch (< 15s) | -5 per event |
| Tab switch (≥ 15s) | -10 per event |
| Paste (< 500 chars) | -10 per event |
| Paste (≥ 500 chars) | -20 per event |
| Gaze off screen | -3 per flag, capped at -25 total |
| Keystroke anomaly | -15 (once) |
| Presence challenge failed | -25 per failure |

Minimum score: 0. Score displayed with color coding: ≥ 80 green, 50–79 yellow, < 50 red.

#### Skill Score Calculation

**Coding challenge** (Claude grades):
- Correctness: 50% (for React: 40%)
- Code quality: 25% (React: 20%)
- Readability: 15% (React: unchanged)
- Efficiency: 10% (React: performance considerations 15%)
- Claude also checks test case pass rate and weights it into correctness score
- Output: 0–100 score + written feedback per category

**Multiple choice**: `(correct answers / total questions) × 100`

**Written/short answer** (Claude grades):
- Relevance: 40%
- Depth: 35%
- Clarity: 25%
- Output: 0–100 + written feedback

**Mixed assessment Skill Score**: weighted average by point value across all questions

#### Proctoring Report (`/dashboard/assessments/[id]/report/[sessionId]`)

Manager-only. Sections:

1. **Header**: Candidate name + email, assessment title, role, date completed, time spent
2. **Scores**: Trust Score (large, color-coded) | Skill Score (large, color-coded) — side by side, never blended
3. **Data retention notice**: "Proctoring data and snapshots are retained for 90 days from assessment date."
4. **Proctoring Event Timeline**: chronological list of all flagged events, each showing type, timestamp, severity badge, detail
5. **Paste Log**: table of paste events — timestamp, char count, content preview (first 100 chars)
6. **Eye Tracking Timeline**: visual green/red bar (green = on screen, red = gaze off) — if WebGazer degraded, shows face-presence timeline instead with note
7. **Keystroke Rhythm Graph**: line chart of IKI over time, baseline marked, anomaly windows highlighted
8. **Presence Challenge Results**: list of each challenge — word, response, pass/fail, time taken
9. **Snapshot Gallery**: grid of webcam snapshots with timestamps (if enabled)
10. **AI Integrity Summary**: Claude-written 3-sentence summary synthesizing all proctoring signals — e.g., "The candidate showed two high-risk tab switches totaling 48 seconds away from the assessment. Paste activity was detected once but below the character threshold. Eye tracking was consistent throughout with no sustained gaze-off events."
11. **Actions**: "Download PDF" button | "Send to Client" button (copies plain-text summary to clipboard: scores + AI Integrity Summary)

#### Integrations with Existing Features

- **Stack Ranking**: "Send Assessment" button added next to each candidate row — prefills invite form with candidate name
- **Resume Scorer**: after score displayed, show CTA card "Want to go deeper? Send [role] assessment →"
- **Dashboard Home**: new stat card "Assessments Sent This Month" (count from assessment_invites where created_at >= start of month)
- **History Page**: add 5th tab "Assessments" — table of all invites sent with columns: candidate, assessment title, status badge, sent date, link to report

#### Notifications

New `notifications` table. In-app notification bell in existing top bar:
- Unread count badge
- Dropdown: last 10 notifications, each showing candidate name + assessment title + "View Report" link
- Mark as read on dropdown open
- Notification created on assessment completion (type: `assessment_completed`)

Email via Resend on completion:
- To: the manager who created the assessment
- Subject: `[Candidate Name] completed their assessment for [Role]`
- Body: candidate name, role, assessment title, completion time, link to report

---

### Data Requirements

#### New Environment Variables

```
RESEND_API_KEY=re_...
JUDGE0_API_KEY=                    # post-MVP
JUDGE0_API_URL=                    # post-MVP
```

#### New Database Tables

```sql
-- Role system (ALTER existing table)
ALTER TABLE user_profiles
  ADD COLUMN role TEXT NOT NULL DEFAULT 'recruiter'
    CHECK (role IN ('recruiter', 'manager'));

-- Assessments
CREATE TABLE assessments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title               TEXT NOT NULL,
  description         TEXT,
  role                TEXT NOT NULL,
  time_limit_minutes  INTEGER NOT NULL CHECK (time_limit_minutes BETWEEN 10 AND 180),
  proctoring_config   JSONB NOT NULL DEFAULT '{}',
  question_order      TEXT NOT NULL DEFAULT 'sequential' CHECK (question_order IN ('sequential', 'random')),
  presentation_mode   TEXT NOT NULL DEFAULT 'one_at_a_time' CHECK (presentation_mode IN ('one_at_a_time', 'all_at_once')),
  status              TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- proctoring_config JSONB shape:
-- {
--   tab_switching: boolean,
--   paste_detection: boolean,
--   eye_tracking: boolean,
--   keystroke_dynamics: boolean,
--   presence_challenges: boolean,
--   presence_challenge_count: 2 | 3,
--   snapshots: boolean
-- }

-- Assessment Questions
CREATE TABLE assessment_questions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id   UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  type            TEXT NOT NULL CHECK (type IN ('coding', 'multiple_choice', 'written')),
  prompt          TEXT NOT NULL,
  points          INTEGER NOT NULL DEFAULT 100,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  -- coding fields
  language        TEXT CHECK (language IN ('javascript','typescript','react_jsx','react_tsx','python')),
  starter_code    TEXT,
  test_cases_json JSONB,   -- [{ input: string, expectedOutput: string }]
  instructions    TEXT,
  -- multiple_choice fields
  options_json    JSONB,   -- [{ id: string, text: string }]
  correct_option  TEXT,
  time_limit_secs INTEGER,
  -- written fields
  length_hint     TEXT CHECK (length_hint IN ('short','medium','long')),
  rubric_hints    TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Assessment Invites
CREATE TABLE assessment_invites (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id    UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  candidate_name   TEXT NOT NULL,
  candidate_email  TEXT NOT NULL,
  token            TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','started','completed','expired')),
  expires_at       TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  sent_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Assessment Sessions
CREATE TABLE assessment_sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id           UUID NOT NULL REFERENCES assessment_invites(id) ON DELETE CASCADE,
  assessment_id       UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  user_id             UUID REFERENCES auth.users(id),  -- manager who owns the assessment
  started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at        TIMESTAMPTZ,
  time_spent_seconds  INTEGER,
  trust_score         INTEGER CHECK (trust_score BETWEEN 0 AND 100),
  skill_score         INTEGER CHECK (skill_score BETWEEN 0 AND 100),
  ai_integrity_summary TEXT,
  status              TEXT NOT NULL DEFAULT 'in_progress'
                        CHECK (status IN ('in_progress','completed','abandoned')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Proctoring Events
CREATE TABLE proctoring_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID NOT NULL REFERENCES assessment_sessions(id) ON DELETE CASCADE,
  event_type   TEXT NOT NULL,
  severity     TEXT NOT NULL CHECK (severity IN ('low','medium','high')),
  payload_json JSONB NOT NULL DEFAULT '{}',
  timestamp    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Assessment Snapshots
CREATE TABLE assessment_snapshots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL REFERENCES assessment_sessions(id) ON DELETE CASCADE,
  storage_path  TEXT NOT NULL,
  taken_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Notifications
CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  title       TEXT NOT NULL,
  body        TEXT,
  metadata    JSONB NOT NULL DEFAULT '{}',
  read        BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### RLS Policies (all new tables)
- `assessments`: manager reads/writes own rows (`user_id = auth.uid()`)
- `assessment_questions`: manager reads/writes via assessment ownership
- `assessment_invites`: manager reads/writes via assessment ownership; public read by token (for candidate flow)
- `assessment_sessions`: manager reads via assessment ownership; public insert (candidate submitting)
- `proctoring_events`: manager reads via session→assessment ownership; public insert
- `assessment_snapshots`: manager reads via session ownership; public insert
- `notifications`: user reads/updates own rows only

#### Data Retention (automated cleanup)
- `proctoring_events`: delete rows where `timestamp < now() - INTERVAL '90 days'`
- `assessment_snapshots`: delete rows + storage objects where `taken_at < now() - INTERVAL '90 days'`
- Implement via Supabase pg_cron job or Edge Function scheduled daily
- `assessment_sessions`, `assessment_invites`, `assessments`: retained indefinitely while subscription active

---

### Edge Cases

| Scenario | Behavior |
|----------|----------|
| Candidate opens expired link | "This link has expired. Contact the recruiter for a new link." |
| Candidate opens already-completed link | "You have already completed this assessment." |
| Webcam denied when required | Error screen with instructions to allow camera access |
| WebGazer fails to initialize | Fall back to face-api.js presence detection; log `eye_tracking_degraded` event |
| Offline > 10 minutes | Session marked abandoned; "session expired due to extended offline time" |
| Offline < 10 minutes | Offline banner; auto-resume on reconnect; sync localStorage to Supabase |
| Coding question opened on mobile | Full-screen desktop-required warning; no fallback code editor |
| MC or written opened on mobile | Fully responsive, works normally |
| Pyodide fails to load | Show error: "Python environment failed to load. Please refresh." |
| Time limit expires | Auto-submit current answers; redirect to `/assess/[token]/complete` |
| Presence challenge timeout | Fail logged; -25 trust deduction; assessment continues |
| Non-manager accesses `/dashboard/assessments/*` | 403 — "This feature requires manager access. Contact your account owner." |

---

## Design Decisions

### Technical Approach

- **Architecture**: All candidate-facing routes (`/assess/*`) are public Next.js App Router pages with no auth middleware. All recruiter-facing routes (`/dashboard/assessments/*`) use existing auth middleware and add role check for manager.
- **Key Components**:
  - `AssessmentBuilder` — 4-step wizard, client component
  - `ProctoringSuite` — client component wrapping all proctoring hooks, mounts on first question
  - `MonacoQuestion` — Monaco Editor + test runner + React live preview
  - `EyeTracker` — WebGazer.js hook with face-api.js fallback
  - `ProctoringReport` — server component rendering full report from Supabase data
  - `NotificationBell` — client component in existing TopBar
- **Proctoring data flow**: events captured client-side → batched via `useRef` array → flushed to `/api/assessments/events` every 60 seconds AND on question navigation AND on submit
- **Skill grading**: triggered server-side after session completion → calls Anthropic API → updates session row with skill_score + per-question feedback
- **PDF generation**: react-pdf renders report server-side → streamed as download from `/api/assessments/[id]/report/[sessionId]/pdf`

### Constraints

- **Performance**: WebGazer.js adds ~2MB to candidate page bundle — load lazily only if eye tracking enabled for this assessment
- **Security**: `/assess/[token]` API routes validate token existence, expiry, and `status = 'pending' OR 'started'` before any data write. All recruiter API routes validate auth + `role = 'manager'`
- **Browser compatibility**: Chrome/Edge required for WebGazer.js (getUserMedia + requestAnimationFrame). Firefox supported for non-webcam assessments. Safari: limited webcam support, warn candidate.
- **Sandbox security**: JS/TS test execution uses `new Function()` — no network access, no DOM access. React preview uses sandboxed iframe with `allow-scripts` only. Python uses Pyodide — network disabled via CSP.

### Risk Assessment

- **WebGazer.js reliability** (Medium risk): accuracy degrades with glasses, poor lighting, or small screens. Documented fallback to face-api.js presence detection. Flag clearly in report when degraded.
- **Pyodide bundle size** (Medium risk): Pyodide is ~8MB. Lazy load only when Python question is reached. Show loading indicator "Loading Python environment…"
- **face-api.js model loading** (Low risk): models are ~6MB. Load on consent screen click (before assessment starts), not on page load.
- **Judge0 post-MVP** (Low risk): Java/C#/Go/Ruby questions not available in MVP. Builder shows these languages as "Coming soon" — disabled in language selector.
- **Claude grading latency** (Low risk): grading runs after completion, not blocking the candidate. Report may show "Grading in progress…" for 30–60 seconds after completion.

---

## Acceptance Criteria

### Functional Acceptance

**Role System**
- [ ] `user_profiles.role` column added with `recruiter` / `manager` enum
- [ ] Owner account always treated as manager
- [ ] Recruiter accessing `/dashboard/assessments/*` sees 403 message
- [ ] Owner can assign manager role in team settings

**Assessment Builder**
- [ ] 4-step wizard navigable, each step validates before advancing
- [ ] All 3 question types buildable with correct fields
- [ ] Drag-and-drop reorder works for questions
- [ ] All 6 proctoring toggles functional, presence challenge count selector appears when challenges enabled
- [ ] "Publish" sets status to published, generates invite-ready assessment
- [ ] Published assessments cannot be edited (edit button disabled with tooltip)

**Invite Flow**
- [ ] Manager can invite candidate with name + email
- [ ] Invite row appears in table with status, expiry date
- [ ] Resend email delivered with correct link
- [ ] Token expiry = 7 days from sent_at

**Candidate Flow**
- [ ] Expired token shows correct message
- [ ] Completed token shows correct message
- [ ] Consent screen shows only enabled proctoring items
- [ ] All checkboxes must be checked before "Begin" is enabled
- [ ] Webcam permission prompt fires before assessment starts (when required)
- [ ] Webcam denial shows error with instructions
- [ ] Auto-save fires every 30 seconds to localStorage
- [ ] Offline banner appears when connection lost
- [ ] Offline > 10 min → session abandoned
- [ ] Timer counts down, auto-submits on expiry
- [ ] Completion screen shows after submit

**Proctoring**
- [ ] Tab switch events logged with correct severity thresholds (15s)
- [ ] Paste events logged with correct severity thresholds (500 chars)
- [ ] WebGazer gaze tracking logs off-screen events
- [ ] face-api.js fallback activates and is documented in report when WebGazer fails
- [ ] Keystroke baseline established in first 2 min, anomalies flagged at 40% deviation
- [ ] Presence challenges fire at correct frequency, at random intervals (not first/last 3 min)
- [ ] Snapshots upload to Supabase storage every 5 min (when enabled)

**Coding Challenge**
- [ ] Monaco Editor renders for JS/TS/React/Python questions on desktop
- [ ] React live preview pane renders alongside editor for React questions
- [ ] 4 React starter templates selectable
- [ ] Python runs via Pyodide, "Loading Python environment…" shown on first load
- [ ] Test cases run client-side, pass/fail shown per case
- [ ] Mobile warning shown for coding questions on mobile devices

**Scoring**
- [ ] Trust Score calculated correctly per weighting table, minimum 0
- [ ] Skill Score calculated correctly per question type
- [ ] Mixed assessments use point-weighted average for Skill Score
- [ ] Claude grades coding + written questions after completion
- [ ] Both scores visible in report, never blended

**Report**
- [ ] All 11 report sections render with correct data
- [ ] Eye tracking timeline shows green/red bar (or degraded fallback notice)
- [ ] Keystroke rhythm graph renders
- [ ] Snapshot gallery renders (when enabled)
- [ ] AI Integrity Summary generated by Claude
- [ ] "Download PDF" generates and downloads correctly
- [ ] "Send to Client" copies plain-text summary to clipboard
- [ ] Data retention notice visible on all reports

**Notifications**
- [ ] Bell icon in top bar shows unread count
- [ ] Dropdown shows last 10 notifications
- [ ] Notifications marked read when dropdown opens
- [ ] Resend email sent to manager on completion

**Integrations**
- [ ] "Send Assessment" button in Stack Ranking candidate rows
- [ ] "Send Assessment" CTA card on Resume Scorer results
- [ ] Dashboard stat card "Assessments Sent This Month" renders
- [ ] History page 5th tab "Assessments" shows invites table

### Quality Standards

- [ ] All new API routes return 401 for unauthenticated requests
- [ ] All assessment management routes return 403 for recruiter role
- [ ] All new DB tables have RLS enabled
- [ ] `npm run build` (TypeScript) passes with zero errors
- [ ] No console errors on recruiter-facing or candidate-facing pages

### User Acceptance

- [ ] Candidate flow completable end-to-end in a single browser session without errors
- [ ] Report loads and all sections render within 3 seconds for a completed session

---

## Execution Phases

### Phase 1: Foundation
**Goal**: Database, role system, routing skeleton, nav

- [ ] Write and apply Supabase migration for all 6 new tables + `role` column on `user_profiles`
- [ ] Create Supabase storage bucket `assessment-snapshots` with correct RLS
- [ ] Add RLS policies for all new tables
- [ ] Add `role` check middleware to `/dashboard/assessments/*` routes
- [ ] Add manager role assignment UI to `/dashboard/settings/team`
- [ ] Add new sidebar nav items: "My Assessments" + "Create Assessment"
- [ ] Scaffold empty page components for all new routes
- [ ] Add `RESEND_API_KEY` to env + Resend client singleton
- **Deliverables**: DB ready, routes accessible, role gating functional
- **Dependencies**: None — builds on existing auth/middleware pattern

### Phase 2: Assessment Builder
**Goal**: Managers can create and publish assessments

- [ ] Build 4-step wizard UI with step navigation and validation
- [ ] Step 1: details form (title, description, role, time limit, presentation mode)
- [ ] Step 2: question builder — all 3 types with correct fields + drag-and-drop reorder
- [ ] Step 3: proctoring toggles + presence challenge count selector
- [ ] Step 4: review summary + publish button
- [ ] POST `/api/assessments` — create assessment + questions
- [ ] PATCH `/api/assessments/[id]/publish` — set status to published
- [ ] Assessment list page `/dashboard/assessments` — table of all assessments with status badges
- [ ] Assessment detail page `/dashboard/assessments/[id]` — assessment info + invite table (empty for now)
- **Deliverables**: Full assessment creation flow working end-to-end
- **Dependencies**: Phase 1

### Phase 3: Invite + Candidate Landing
**Goal**: Manager can send invite, candidate can open link and reach consent screen

- [ ] Invite form on assessment detail page (name + email)
- [ ] POST `/api/assessments/[id]/invite` — creates invite row, sends Resend email
- [ ] Candidate landing page `/assess/[token]` — token validation + assessment overview
- [ ] Candidate consent page `/assess/[token]/consent` — dynamic consent checkboxes based on proctoring config
- [ ] Webcam permission request on consent screen (when required)
- [ ] GET `/api/assess/[token]` — public route returning assessment metadata for candidate
- [ ] Expired / completed token states
- [ ] Completion page `/assess/[token]/complete`
- **Deliverables**: Full invite and candidate landing flow
- **Dependencies**: Phase 2, Resend configured

### Phase 4: Assessment Taking — Questions + Auto-save
**Goal**: Candidates can answer all question types, progress saves

- [ ] Question rendering engine — routes `/assess/[token]/[questionIndex]`
- [ ] Multiple choice question UI (mobile-friendly)
- [ ] Written/short answer UI (mobile-friendly, word count)
- [ ] Monaco Editor coding question UI (desktop, language selector)
- [ ] React live preview pane for React questions + starter templates
- [ ] Pyodide integration for Python questions
- [ ] Client-side JS/TS test case runner
- [ ] Mobile desktop-required warning for coding questions
- [ ] Timer component + auto-submit on expiry
- [ ] localStorage auto-save every 30 seconds
- [ ] Offline detection banner + 10-minute abandon logic
- [ ] POST `/api/assess/[token]/save` — sync progress to Supabase
- [ ] POST `/api/assess/[token]/submit` — mark session completed, trigger scoring
- **Deliverables**: Full question flow functional for all types
- **Dependencies**: Phase 3

### Phase 5: Proctoring Suite
**Goal**: All proctoring signals captured and logged

- [ ] ProctoringSuite client component mounting on first question
- [ ] Tab switch detection (Visibility API + blur/focus)
- [ ] Paste detection (paste event listeners on all inputs + Monaco)
- [ ] WebGazer.js integration + gaze off-screen detection + degraded fallback to face-api.js
- [ ] face-api.js face presence detection
- [ ] Keystroke dynamics hook (IKI logging + baseline + anomaly detection)
- [ ] Presence challenge modal (random timing, 5s countdown, pass/fail logging)
- [ ] Snapshot capture (canvas.toBlob every 5 min + Supabase storage upload)
- [ ] Event batching + flush to POST `/api/assess/[token]/events` every 60s + on navigation + on submit
- [ ] All proctoring conditional on `proctoring_config` flags from assessment
- **Deliverables**: All 6 proctoring signals operational
- **Dependencies**: Phase 4

### Phase 6: Scoring + Report
**Goal**: Scores calculated, full report visible to manager

- [ ] Trust Score calculation from proctoring events (server-side, post-submit)
- [ ] Multiple choice auto-scoring
- [ ] Claude API grading for coding + written questions (async, post-submit)
- [ ] Skill Score calculation (point-weighted average)
- [ ] Proctoring report page `/dashboard/assessments/[id]/report/[sessionId]`
- [ ] All 11 report sections rendered
- [ ] Eye tracking timeline visual component
- [ ] Keystroke rhythm graph (recharts or similar)
- [ ] Snapshot gallery component
- [ ] Claude AI Integrity Summary generation
- [ ] PDF generation endpoint + Download PDF button
- [ ] "Send to Client" clipboard copy
- [ ] Data retention notice in report UI
- **Deliverables**: Full report functional with all sections
- **Dependencies**: Phase 5

### Phase 7: Notifications + Integrations
**Goal**: Notifications working, existing features integrated

- [ ] `notifications` table + Supabase RLS
- [ ] Notification bell in existing TopBar component
- [ ] Notification dropdown (last 10, mark read on open)
- [ ] Create notification + send Resend email on assessment completion
- [ ] "Send Assessment" button in Stack Ranking candidate rows
- [ ] "Send Assessment" CTA card on Resume Scorer results
- [ ] Dashboard stat card "Assessments Sent This Month"
- [ ] History page "Assessments" 5th tab
- [ ] 90-day retention cleanup job (Supabase scheduled Edge Function or pg_cron)
- **Deliverables**: Feature fully integrated across existing RecruiterIQ
- **Dependencies**: Phase 6

---

**Document Version**: 1.0
**Created**: 2026-03-31
**Clarification Rounds**: 3
**Quality Score**: 93/100
