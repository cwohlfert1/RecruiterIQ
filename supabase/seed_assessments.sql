-- ============================================================
-- Seed: RecruiterIQ Assessments Module
-- Run AFTER 002_assessments_schema.sql.
-- Requires an existing user in auth.users.
-- Replace 61d36a5a-b883-4aa1-9d90-229104ce44ec with a real auth.users UUID.
-- ============================================================

-- ── Seed variables ───────────────────────────────────────────
-- Adjust these UUIDs to match your local/staging environment.

DO $$
DECLARE
  v_manager_id     UUID := '61d36a5a-b883-4aa1-9d90-229104ce44ec'::UUID;
  v_assessment_id  UUID := gen_random_uuid();
  v_q_coding_id    UUID := gen_random_uuid();
  v_q_mc_id        UUID := gen_random_uuid();
  v_q_written_id   UUID := gen_random_uuid();
  v_invite_done_id UUID := gen_random_uuid();
  v_invite_pend_id UUID := gen_random_uuid();
  v_session_id     UUID := gen_random_uuid();
  v_token_done     TEXT := 'seed-token-completed-abc123';
  v_token_pend     TEXT := 'seed-token-pending-def456';
BEGIN

  -- ── Update manager role ─────────────────────────────────
  UPDATE public.user_profiles
  SET role = 'manager'
  WHERE user_id = v_manager_id;

  -- ── Assessment ──────────────────────────────────────────
  INSERT INTO public.assessments (
    id, user_id, title, description, role,
    time_limit_minutes, proctoring_config,
    question_order, presentation_mode, status
  ) VALUES (
    v_assessment_id,
    v_manager_id,
    'Senior React Developer Assessment',
    'Technical assessment for senior React roles covering component design, state management, and problem solving.',
    'Senior Software Engineer',
    60,
    '{
      "tab_switching": true,
      "paste_detection": true,
      "eye_tracking": false,
      "keystroke_dynamics": true,
      "presence_challenges": true,
      "presence_challenge_frequency": 2,
      "snapshots": false
    }'::jsonb,
    'sequential',
    'one_at_a_time',
    'published'
  );

  -- ── Questions ───────────────────────────────────────────

  -- Q1: React Coding Challenge
  INSERT INTO public.assessment_questions (
    id, assessment_id, type, prompt, points, sort_order,
    language, starter_code, test_cases_json, instructions
  ) VALUES (
    v_q_coding_id,
    v_assessment_id,
    'coding',
    'Build a custom React hook called useCounter that manages a counter with increment, decrement, and reset functionality.',
    100,
    1,
    'react_tsx',
    'import { useState } from "react";

export function useCounter(initialValue: number = 0) {
  // TODO: implement this hook
}

// Example usage (do not modify):
export default function App() {
  const { count, increment, decrement, reset } = useCounter(0);
  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={increment}>+</button>
      <button onClick={decrement}>-</button>
      <button onClick={reset}>Reset</button>
    </div>
  );
}',
    '[
      {"input": "useCounter(0) → increment()", "expectedOutput": "count: 1"},
      {"input": "useCounter(5) → decrement()", "expectedOutput": "count: 4"},
      {"input": "useCounter(10) → increment() → reset()", "expectedOutput": "count: 10"}
    ]'::jsonb,
    'Implement the useCounter hook. The hook should accept an optional initialValue parameter (default 0) and return an object with count, increment, decrement, and reset functions.'
  );

  -- Q2: Multiple Choice
  INSERT INTO public.assessment_questions (
    id, assessment_id, type, prompt, points, sort_order,
    options_json, correct_option
  ) VALUES (
    v_q_mc_id,
    v_assessment_id,
    'multiple_choice',
    'Which React hook should you use when you need to run a side effect after every render, but only when a specific value changes?',
    50,
    2,
    '[
      {"id": "a", "text": "useState", "is_correct": false},
      {"id": "b", "text": "useEffect with a dependency array", "is_correct": true},
      {"id": "c", "text": "useCallback", "is_correct": false},
      {"id": "d", "text": "useMemo", "is_correct": false}
    ]'::jsonb,
    'b'
  );

  -- Q3: Written / Short Answer
  INSERT INTO public.assessment_questions (
    id, assessment_id, type, prompt, points, sort_order,
    length_hint, rubric_hints
  ) VALUES (
    v_q_written_id,
    v_assessment_id,
    'written',
    'Explain the difference between controlled and uncontrolled components in React. When would you choose one over the other?',
    75,
    3,
    'medium',
    'Look for: clear definition of both terms, understanding that controlled components derive state from React, uncontrolled use refs/DOM, practical examples of when each is appropriate (e.g., uncontrolled for file inputs, controlled for forms needing validation).'
  );

  -- ── Invites ─────────────────────────────────────────────

  -- Invite 1: Completed
  INSERT INTO public.assessment_invites (
    id, assessment_id, created_by,
    candidate_name, candidate_email,
    token, status, expires_at, sent_at
  ) VALUES (
    v_invite_done_id,
    v_assessment_id,
    v_manager_id,
    'Alice Nguyen',
    'alice.nguyen@example.com',
    v_token_done,
    'completed',
    now() + INTERVAL '7 days',
    now() - INTERVAL '2 days'
  );

  -- Invite 2: Pending
  INSERT INTO public.assessment_invites (
    id, assessment_id, created_by,
    candidate_name, candidate_email,
    token, status, expires_at, sent_at
  ) VALUES (
    v_invite_pend_id,
    v_assessment_id,
    v_manager_id,
    'Marcus Williams',
    'marcus.williams@example.com',
    v_token_pend,
    'pending',
    now() + INTERVAL '5 days',
    now() - INTERVAL '2 hours'
  );

  -- ── Completed Session (Alice) ────────────────────────────
  INSERT INTO public.assessment_sessions (
    id, invite_id, assessment_id, user_id,
    started_at, completed_at, time_spent_seconds,
    trust_score, skill_score,
    ai_integrity_summary, status
  ) VALUES (
    v_session_id,
    v_invite_done_id,
    v_assessment_id,
    v_manager_id,
    now() - INTERVAL '2 days' + INTERVAL '1 hour',
    now() - INTERVAL '2 days' + INTERVAL '1 hour 42 minutes',
    2520,
    75,
    82,
    'The candidate demonstrated consistent focus throughout the assessment with only one minor tab switch under 5 seconds. A single paste event was detected in the coding section but the character count was below the suspicious threshold. Keystroke dynamics remained stable and both presence challenges were passed promptly, suggesting authentic independent work.',
    'completed'
  );

  -- ── Proctoring Events (Alice's session) ─────────────────
  INSERT INTO public.proctoring_events
    (session_id, event_type, severity, payload_json, timestamp)
  VALUES
    -- Tab switch (minor)
    (
      v_session_id, 'tab_switch', 'low',
      '{"duration_away_ms": 4200}'::jsonb,
      now() - INTERVAL '2 days' + INTERVAL '1 hour 15 minutes'
    ),
    -- Paste detected (below threshold)
    (
      v_session_id, 'paste_detected', 'low',
      '{"char_count": 87, "content_preview": "const handleClick = () => {"}'::jsonb,
      now() - INTERVAL '2 days' + INTERVAL '1 hour 22 minutes'
    ),
    -- Keystroke dynamics normal (info)
    (
      v_session_id, 'keystroke_anomaly', 'medium',
      '{"baseline_iki_ms": 130, "current_iki_ms": 198, "note": "Brief slowdown — likely reviewing instructions"}'::jsonb,
      now() - INTERVAL '2 days' + INTERVAL '1 hour 35 minutes'
    ),
    -- Presence challenges passed
    (
      v_session_id, 'presence_challenge_passed', 'low',
      '{"word": "MONITOR", "response": "MONITOR", "response_time_ms": 1840}'::jsonb,
      now() - INTERVAL '2 days' + INTERVAL '1 hour 18 minutes'
    ),
    (
      v_session_id, 'presence_challenge_passed', 'low',
      '{"word": "CIRCUIT", "response": "CIRCUIT", "response_time_ms": 2210}'::jsonb,
      now() - INTERVAL '2 days' + INTERVAL '1 hour 38 minutes'
    );

  -- ── Question Responses (Alice) ────────────────────────────
  INSERT INTO public.assessment_question_responses
    (session_id, question_id, answer_text, selected_option, skill_score, feedback_json, test_results_json, graded_at)
  VALUES
    -- Coding response
    (
      v_session_id, v_q_coding_id,
      'import { useState } from "react";

export function useCounter(initialValue: number = 0) {
  const [count, setCount] = useState(initialValue);
  const increment = () => setCount(c => c + 1);
  const decrement = () => setCount(c => c - 1);
  const reset = () => setCount(initialValue);
  return { count, increment, decrement, reset };
}',
      NULL,
      85,
      '{
        "correctness": {"score": 90, "feedback": "All three test cases pass. The use of functional updates (c => c + 1) is a good practice."},
        "code_quality": {"score": 85, "feedback": "Clean implementation. Could add optional min/max constraints for extra robustness."},
        "readability": {"score": 80, "feedback": "Very readable. Arrow functions and clear naming conventions."},
        "performance": {"score": 85, "feedback": "Efficient — no unnecessary re-renders triggered."}
      }'::jsonb,
      '[
        {"input": "useCounter(0) → increment()", "expected": "count: 1", "actual": "count: 1", "passed": true},
        {"input": "useCounter(5) → decrement()", "expected": "count: 4", "actual": "count: 4", "passed": true},
        {"input": "useCounter(10) → increment() → reset()", "expected": "count: 10", "actual": "count: 10", "passed": true}
      ]'::jsonb,
      now() - INTERVAL '1 day 22 hours'
    ),
    -- Multiple choice response
    (
      v_session_id, v_q_mc_id,
      NULL,
      'b',
      100,
      '{"auto_scored": true}'::jsonb,
      NULL,
      now() - INTERVAL '1 day 22 hours'
    ),
    -- Written response
    (
      v_session_id, v_q_written_id,
      'Controlled components have their state managed by React — the component''s value is driven by state and updated via onChange handlers. Uncontrolled components manage their own state through the DOM, typically accessed via refs. I prefer controlled components for most form inputs because they give you full control for validation, conditional rendering, and derived state. Uncontrolled components make sense for file inputs (which can''t be controlled) or when integrating with non-React code where you just need to read a value on submit rather than respond to every change.',
      NULL,
      78,
      '{
        "relevance": {"score": 85, "feedback": "Directly addresses both concepts with accurate definitions."},
        "depth": {"score": 72, "feedback": "Good practical examples. Could expand on refs usage and when uncontrolled avoids unnecessary re-renders."},
        "clarity": {"score": 78, "feedback": "Well structured and readable. The file input example is a strong practical anchor."}
      }'::jsonb,
      NULL,
      now() - INTERVAL '1 day 22 hours'
    );

  -- ── Notification ─────────────────────────────────────────
  INSERT INTO public.notifications
    (user_id, type, title, message, link, read)
  VALUES
    (
      v_manager_id,
      'assessment_completed',
      'Alice Nguyen completed an assessment',
      'Senior React Developer Assessment — Trust: 75 | Skill: 82',
      '/dashboard/assessments/' || v_assessment_id || '/report/' || v_session_id,
      false
    );

END $$;
