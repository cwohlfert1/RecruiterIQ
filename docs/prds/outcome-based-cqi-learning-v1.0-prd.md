# Outcome-Based CQI Learning — Product Requirements Document (PRD)

## Requirements Description

### Background
- **Business Problem**: CQI scores are based purely on resume-to-JD match. A 78 CQI that gets rejected every time on CenterPoint roles should flag as risky for that client. Recruiters have no way to feed real placement outcomes back into the scoring system.
- **Target Users**: Agency plan recruiters with repeat clients and enough volume to generate patterns (3+ outcomes per client).
- **Value Proposition**: Candid.ai learns from each recruiter's actual desk — which candidates get placed, which get rejected, and why. Over time, CQI scores gain client-specific context and Cortex surfaces proactive intel that helps recruiters submit smarter.

### Feature Overview
- **Core Features**:
  1. Rejection reason capture on stage change to Rejected (10 dropdown options + free text)
  2. Placement outcome capture on Placed (automatic)
  3. Catfish-specific flagging with notes that feed into pattern detection
  4. Client intel cache (`client_intel` table) refreshed after each outcome
  5. Client Intel badge on CQI scores when 3+ outcomes exist
  6. Cortex integration — proactive warnings and historical pattern answers

- **Feature Boundaries**:
  - No ML models — pure statistical analysis on stored data
  - CQI score number is never modified — intel is additive (badge only)
  - Catfish Risk score is never auto-adjusted — warning only via Cortex/Insights
  - Data kept forever — no auto-expiry
  - Agency plan only for full feature; Pro gets rejection capture only

### Detailed Requirements

**Rejection Reason Capture**
When pipeline_stage changes to `rejected`:
- Show inline prompt: "Why was this candidate rejected?"
- Dropdown: Not technical enough, Overqualified, Rate too high, Client went another direction, Candidate withdrew, No response from client, Failed assessment, Cultural fit concern, Catfish / Fake candidate, Other (free text)
- On "Catfish / Fake candidate": show additional text input "What tipped you off?" (max 200 chars)
- Save to `placement_outcomes` with `outcome = 'rejected'`

**Placement Capture**
When pipeline_stage changes to `placed`:
- Auto-save to `placement_outcomes` with `outcome = 'placed'`
- No prompt needed — data captured silently

**Job Title Matching**
- Split job titles into tokens, lowercase
- Remove stop words: senior, junior, lead, staff, principal, associate, I, II, III, iv
- Match if 2+ non-generic tokens overlap
- Example: "Senior Data Engineer" → tokens [data, engineer] → matches "Data Engineer", "Lead Data Engineer"

**Pattern Analysis (client_intel)**
- After each outcome saved, refresh `client_intel` for that client_company + job_title_tokens
- Calculate: outcome_count, avg_cqi_placed, avg_cqi_rejected, success_threshold
- success_threshold = CQI below which submit-to-interview rate drops under 30%
- catfish_patterns = aggregated notes from is_catfish outcomes
- Minimum 3 outcomes before showing any intel

**Client Intel Badge**
- Amber badge with star icon: "Client Intel"
- One-line: "Based on [N] submissions to [Client], candidates below [threshold] have [X]% interview rate"
- Visible in: candidate slide-out CQI section, candidates table, resume scorer results
- Only shows when 3+ outcomes exist for the client

**Cortex Integration**
- Cortex reads client_intel and placement_outcomes for the current user
- Answers: "How do candidates like this perform on [Client]?", "What CQI do I need for an interview here?"
- Proactive: surfaces catfish pattern warnings when resume matches flagged patterns

---

## Design Decisions

### Database Schema

```sql
-- Placement outcomes
create table placement_outcomes (
  id                   uuid         primary key default gen_random_uuid(),
  user_id              uuid         not null references auth.users(id),
  candidate_id         uuid,
  project_id           uuid,
  client_company       text         not null,
  job_title            text         not null,
  cqi_score            numeric(5,2),
  cqi_breakdown        jsonb,
  pipeline_stage_reached text,
  rejection_reason     text,
  catfish_notes        text,
  is_catfish           boolean      not null default false,
  outcome              text         not null check (outcome in ('rejected', 'placed', 'withdrawn')),
  notes                text,
  created_at           timestamptz  not null default now()
);

alter table placement_outcomes enable row level security;
create policy "Users manage own outcomes"
  on placement_outcomes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index placement_outcomes_user_client on placement_outcomes (user_id, client_company);

-- Client intel cache
create table client_intel (
  id               uuid         primary key default gen_random_uuid(),
  user_id          uuid         not null references auth.users(id),
  client_company   text         not null,
  job_title_tokens text[]       not null default '{}',
  outcome_count    int          not null default 0,
  avg_cqi_placed   numeric(5,2),
  avg_cqi_rejected numeric(5,2),
  success_threshold numeric(5,2),
  catfish_patterns jsonb,
  last_updated     timestamptz  not null default now()
);

alter table client_intel enable row level security;
create policy "Users manage own intel"
  on client_intel for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create unique index client_intel_user_client on client_intel (user_id, client_company);
```

### Architecture
- **Outcome capture**: triggered in stage change API route (`/api/projects/[id]/candidates/[candidateId]/stage`)
- **Intel refresh**: server-side function called after outcome insert
- **Badge display**: client component fetches intel for current client on load
- **Cortex**: reads client_intel in context builder when on project page

### Execution Phases

**Phase 1: Schema + Outcome Capture**
- [ ] Migration: placement_outcomes + client_intel tables
- [ ] Rejection reason modal on stage change to Rejected
- [ ] Auto-capture on Placed
- [ ] API route for saving outcomes

**Phase 2: Pattern Analysis**
- [ ] Job title tokenizer utility
- [ ] client_intel refresh function (runs after each outcome)
- [ ] Statistical calculations: avg CQI placed/rejected, success threshold, catfish patterns

**Phase 3: Client Intel Badge**
- [ ] Badge component (amber, star icon, one-line context)
- [ ] Display in candidate slideout, candidates table, scorer results
- [ ] Fetch intel for current client on project page load

**Phase 4: Cortex Integration**
- [ ] Add client_intel to Cortex context builder
- [ ] Add placement_outcomes summary to context
- [ ] Proactive catfish pattern warnings

---

**Document Version**: 1.0
**Created**: 2026-04-15
**Clarification Rounds**: 1
**Quality Score**: 96/100
