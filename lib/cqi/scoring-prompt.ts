/**
 * Shared CQI scoring prompt — used by all scoring routes.
 * Includes seniority detection and adjusted scoring rules.
 */

export const CQI_SYSTEM_PROMPT =
  'You are an expert technical recruiter. Evaluate the resume against the job description.\n' +
  'Return ONLY valid JSON, no markdown, no explanation outside the JSON.'

export function buildCqiUserPrompt(jdText: string, resumeText: string, options?: { includeJobTitle?: boolean }): string {
  const jobTitleField = options?.includeJobTitle !== false
    ? '"job_title": "<extracted job title from JD or empty string>",'
    : '"job_title": "",'

  return `Score this resume against this job description using the CQI (Candidate Quality Index) framework.

STEP 1 — SENIORITY DETECTION
Before scoring, detect the candidate's seniority level from their resume:
- Senior/Architect: titles containing Architect, Principal, Staff, Director of Engineering, VP of Engineering, Lead, or 8+ years of experience
- Mid: 4-8 years, titles like Senior Engineer, Senior Developer, Senior Analyst
- Junior: 0-4 years, titles like Engineer, Developer, Analyst, Associate

STEP 2 — SCORING CATEGORIES AND WEIGHTS
- Technical Fit (40%): match to required tools/stack and depth of hands-on experience
- Domain Experience (15%): relevance of industry background and environment
- Scope & Impact (15%): ownership, complexity, and measurable contributions
- Communication (15%): clarity, articulation, and stakeholder interaction signals from the resume
- Catfish Risk (15%): inconsistencies, vague experience, or overinflated skills — score 0-100 where 100 = very high risk

STEP 3 — SENIORITY-ADJUSTED SCORING RULES

For Senior/Architect level candidates:
- Technical Fit: Do NOT penalize for not listing every tool explicitly. Senior candidates demonstrate depth through architecture decisions, system design, and outcomes — not tool lists. If they mention a platform (e.g. SAP, AWS, Azure) give full credit for that ecosystem even without listing every sub-module. Score based on depth of ownership not breadth of keywords.
- Scope & Impact: Weight higher — look for team size led, budget owned, systems designed, measurable outcomes (uptime %, cost savings, performance improvements).
- Domain Experience: Give full credit if the industry domain matches even if the specific company size differs.
- Communication: Senior resumes are often more concise — do not penalize brevity. A 1-page architect resume is not a communication problem.
- Catfish Risk: Senior candidates with long tenures at recognizable companies should score very low risk. Do not flag vague descriptions as catfish risk if the candidate has verifiable employment history at known companies.

For Mid level candidates:
- Apply standard scoring weights as defined.

For Junior level candidates:
- Technical Fit: Be more strict on exact tool matches since juniors are hired for specific stack fit.
- Scope & Impact: Weight lower — expect less ownership at junior level.
- Catfish Risk: Be more vigilant — junior catfishing is more common.

IMPORTANT for Catfish Risk: this score is INVERTED when computing overall_score.
A candidate with catfish_risk score of 0 (no red flags) contributes the full 15 points.
A candidate with catfish_risk score of 100 (extreme red flags) contributes 0 points.

Weighted contribution formula:
- technical_fit:     score * 0.40
- domain_experience: score * 0.15
- scope_impact:      score * 0.15
- communication:     score * 0.15
- catfish_risk:      (100 - score) * 0.15

overall_score = sum of all weighted contributions (integer 0-100)

recommendation:
- "Strong Submit" if overall_score >= 85
- "Submit" if overall_score 70-84
- "Borderline" if overall_score 55-69
- "Pass" if overall_score < 55

SCORING RULES:
- Never inflate scores — if the resume genuinely lacks detail, score accordingly
- The seniority adjustment is about accuracy and fairness, not inflation
- A senior architect who is genuinely not a fit for the JD should still score low
- For every category, the explanation MUST be exactly 1 sentence explaining why that score was given

Job Description:
${jdText}

Resume:
${resumeText}

Return ONLY this JSON structure:
{
  "overall_score": <integer 0-100>,
  ${jobTitleField}
  "recommendation": "<Strong Submit|Submit|Borderline|Pass>",
  "breakdown": {
    "technical_fit":     { "score": <0-100>, "weight": 0.40, "weighted": <score*0.40 rounded>, "explanation": "<1 sentence>" },
    "domain_experience": { "score": <0-100>, "weight": 0.15, "weighted": <score*0.15 rounded>, "explanation": "<1 sentence>" },
    "scope_impact":      { "score": <0-100>, "weight": 0.15, "weighted": <score*0.15 rounded>, "explanation": "<1 sentence>" },
    "communication":     { "score": <0-100>, "weight": 0.15, "weighted": <score*0.15 rounded>, "explanation": "<1 sentence>" },
    "catfish_risk":      { "score": <0-100>, "weight": 0.15, "weighted": <(100-score)*0.15 rounded>, "explanation": "<1 sentence>" }
  }
}`
}
