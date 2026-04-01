export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          user_id:                string
          plan_tier:              'free' | 'pro' | 'agency'
          subscription_status:   'free' | 'active' | 'grace' | 'cancelling' | 'cancelled'
          square_customer_id:    string | null
          square_subscription_id: string | null
          ai_calls_this_month:   number
          last_reset_at:         string
          billing_period_end:    string | null
          grace_period_start:    string | null
          role:                  'recruiter' | 'manager'
          created_at:            string
          updated_at:            string
        }
        Insert: {
          user_id:                string
          plan_tier?:             'free' | 'pro' | 'agency'
          subscription_status?:  'free' | 'active' | 'grace' | 'cancelling' | 'cancelled'
          square_customer_id?:   string | null
          square_subscription_id?: string | null
          ai_calls_this_month?:  number
          last_reset_at?:        string
          billing_period_end?:   string | null
          grace_period_start?:   string | null
          role?:                 'recruiter' | 'manager'
        }
        Update: {
          plan_tier?:             'free' | 'pro' | 'agency'
          subscription_status?:  'free' | 'active' | 'grace' | 'cancelling' | 'cancelled'
          square_customer_id?:   string | null
          square_subscription_id?: string | null
          ai_calls_this_month?:  number
          last_reset_at?:        string
          billing_period_end?:   string | null
          grace_period_start?:   string | null
          role?:                 'recruiter' | 'manager'
        }
      }
      assessments: {
        Row: {
          id:                 string
          user_id:            string
          title:              string
          description:        string | null
          role:               string
          time_limit_minutes: number
          proctoring_config:  ProctoringConfig
          question_order:     'sequential' | 'random'
          presentation_mode:  'one_at_a_time' | 'all_at_once'
          status:             'draft' | 'published' | 'archived'
          created_at:         string
          updated_at:         string
        }
        Insert: {
          id?:                string
          user_id:            string
          title:              string
          description?:       string | null
          role:               string
          time_limit_minutes: number
          proctoring_config?: ProctoringConfig
          question_order?:    'sequential' | 'random'
          presentation_mode?: 'one_at_a_time' | 'all_at_once'
          status?:            'draft' | 'published' | 'archived'
        }
        Update: {
          title?:              string
          description?:        string | null
          role?:               string
          time_limit_minutes?: number
          proctoring_config?:  ProctoringConfig
          question_order?:     'sequential' | 'random'
          presentation_mode?:  'one_at_a_time' | 'all_at_once'
          status?:             'draft' | 'published' | 'archived'
        }
      }
      assessment_questions: {
        Row: {
          id:               string
          assessment_id:    string
          type:             'coding' | 'multiple_choice' | 'written'
          prompt:           string
          points:           number
          sort_order:       number
          language:         'javascript' | 'typescript' | 'react_jsx' | 'react_tsx' | 'python' | null
          starter_code:     string | null
          test_cases_json:  TestCase[] | null
          instructions:     string | null
          options_json:     MCOption[] | null
          correct_option:   string | null
          time_limit_secs:  number | null
          length_hint:      'short' | 'medium' | 'long' | null
          rubric_hints:     string | null
          created_at:       string
        }
        Insert: {
          id?:              string
          assessment_id:    string
          type:             'coding' | 'multiple_choice' | 'written'
          prompt:           string
          points?:          number
          sort_order?:      number
          language?:        'javascript' | 'typescript' | 'react_jsx' | 'react_tsx' | 'python' | null
          starter_code?:    string | null
          test_cases_json?: TestCase[] | null
          instructions?:    string | null
          options_json?:    MCOption[] | null
          correct_option?:  string | null
          time_limit_secs?: number | null
          length_hint?:     'short' | 'medium' | 'long' | null
          rubric_hints?:    string | null
        }
        Update: {
          prompt?:          string
          points?:          number
          sort_order?:      number
          language?:        'javascript' | 'typescript' | 'react_jsx' | 'react_tsx' | 'python' | null
          starter_code?:    string | null
          test_cases_json?: TestCase[] | null
          instructions?:    string | null
          options_json?:    MCOption[] | null
          correct_option?:  string | null
          time_limit_secs?: number | null
          length_hint?:     'short' | 'medium' | 'long' | null
          rubric_hints?:    string | null
        }
      }
      assessment_invites: {
        Row: {
          id:              string
          assessment_id:   string
          created_by:      string
          candidate_name:  string
          candidate_email: string
          token:           string
          status:          'pending' | 'started' | 'completed' | 'expired'
          expires_at:      string
          sent_at:         string | null
          created_at:      string
        }
        Insert: {
          id?:             string
          assessment_id:   string
          created_by:      string
          candidate_name:  string
          candidate_email: string
          token?:          string
          status?:         'pending' | 'started' | 'completed' | 'expired'
          expires_at?:     string
          sent_at?:        string | null
        }
        Update: {
          status?:   'pending' | 'started' | 'completed' | 'expired'
          sent_at?:  string | null
        }
      }
      assessment_sessions: {
        Row: {
          id:                   string
          invite_id:            string
          assessment_id:        string
          user_id:              string | null
          started_at:           string
          completed_at:         string | null
          time_spent_seconds:   number | null
          trust_score:          number | null
          skill_score:          number | null
          ai_integrity_summary: string | null
          status:               'in_progress' | 'completed' | 'abandoned'
          created_at:           string
        }
        Insert: {
          id?:                   string
          invite_id:             string
          assessment_id:         string
          user_id?:              string | null
          started_at?:           string
          completed_at?:         string | null
          time_spent_seconds?:   number | null
          trust_score?:          number | null
          skill_score?:          number | null
          ai_integrity_summary?: string | null
          status?:               'in_progress' | 'completed' | 'abandoned'
        }
        Update: {
          completed_at?:         string | null
          time_spent_seconds?:   number | null
          trust_score?:          number | null
          skill_score?:          number | null
          ai_integrity_summary?: string | null
          status?:               'in_progress' | 'completed' | 'abandoned'
        }
      }
      assessment_question_responses: {
        Row: {
          id:               string
          session_id:       string
          question_id:      string
          answer_text:      string | null
          selected_option:  string | null
          skill_score:      number | null
          feedback_json:    Json | null
          test_results_json: Json | null
          graded_at:        string | null
          saved_at:         string
        }
        Insert: {
          id?:               string
          session_id:        string
          question_id:       string
          answer_text?:      string | null
          selected_option?:  string | null
          skill_score?:      number | null
          feedback_json?:    Json | null
          test_results_json?: Json | null
          graded_at?:        string | null
          saved_at?:         string
        }
        Update: {
          answer_text?:      string | null
          selected_option?:  string | null
          skill_score?:      number | null
          feedback_json?:    Json | null
          test_results_json?: Json | null
          graded_at?:        string | null
          saved_at?:         string
        }
      }
      proctoring_events: {
        Row: {
          id:           string
          session_id:   string
          event_type:   ProctoringEventType
          severity:     'low' | 'medium' | 'high' | 'info'
          payload_json: Json
          timestamp:    string
        }
        Insert: {
          id?:          string
          session_id:   string
          event_type:   ProctoringEventType
          severity:     'low' | 'medium' | 'high' | 'info'
          payload_json?: Json
          timestamp?:   string
        }
        Update: never
      }
      assessment_snapshots: {
        Row: {
          id:           string
          session_id:   string
          invite_id:    string
          storage_path: string
          taken_at:     string
        }
        Insert: {
          id?:          string
          session_id:   string
          invite_id:    string
          storage_path: string
          taken_at?:    string
        }
        Update: never
      }
      notifications: {
        Row: {
          id:         string
          user_id:    string
          type:       'assessment_completed' | 'assessment_started' | 'invite_expired'
          title:      string
          message:    string | null
          link:       string | null
          read:       boolean
          created_at: string
        }
        Insert: {
          id?:        string
          user_id:    string
          type:       'assessment_completed' | 'assessment_started' | 'invite_expired'
          title:      string
          message?:   string | null
          link?:      string | null
          read?:      boolean
        }
        Update: {
          read?: boolean
        }
      }
      team_members: {
        Row: {
          id:               string
          owner_user_id:    string
          member_user_id:   string | null
          invited_email:    string
          invite_token:     string | null
          invite_expires_at: string | null
          status:           'pending' | 'active' | 'removed'
          joined_at:        string | null
          created_at:       string
          updated_at:       string
        }
        Insert: {
          id?:              string
          owner_user_id:    string
          member_user_id?:  string | null
          invited_email:    string
          invite_token?:    string | null
          invite_expires_at?: string | null
          status?:          'pending' | 'active' | 'removed'
          joined_at?:       string | null
        }
        Update: {
          member_user_id?:  string | null
          invite_token?:    string | null
          invite_expires_at?: string | null
          status?:          'pending' | 'active' | 'removed'
          joined_at?:       string | null
        }
      }
      resume_scores: {
        Row: {
          id:             string
          user_id:        string
          job_title:      string | null
          resume_text:    string
          jd_text:        string
          score:          number
          breakdown_json: BreakdownJson
          created_at:     string
        }
        Insert: {
          id?:            string
          user_id:        string
          job_title?:     string | null
          resume_text:    string
          jd_text:        string
          score:          number
          breakdown_json: BreakdownJson
        }
        Update: never
      }
      client_summaries: {
        Row: {
          id:             string
          user_id:        string
          job_title:      string
          company_name:   string | null
          input_notes:    string
          summary_output: string
          created_at:     string
        }
        Insert: {
          id?:            string
          user_id:        string
          job_title:      string
          company_name?:  string | null
          input_notes:    string
          summary_output: string
        }
        Update: never
      }
      boolean_searches: {
        Row: {
          id:              string
          user_id:         string
          job_title:       string
          required_skills: string[]
          optional_skills: string[]
          exclusions:      string[]
          boolean_output:  string
          created_at:      string
        }
        Insert: {
          id?:             string
          user_id:         string
          job_title:       string
          required_skills: string[]
          optional_skills: string[]
          exclusions:      string[]
          boolean_output:  string
        }
        Update: never
      }
      red_flag_checks: {
        Row: {
          id:              string
          user_id:         string
          resume_text:     string
          jd_text:         string | null
          integrity_score: number
          flags_json:      RedFlag[]
          summary:         string
          recommendation:  'proceed' | 'caution' | 'pass'
          created_at:      string
        }
        Insert: {
          id?:             string
          user_id:         string
          resume_text:     string
          jd_text?:        string | null
          integrity_score: number
          flags_json:      RedFlag[]
          summary:         string
          recommendation:  'proceed' | 'caution' | 'pass'
        }
        Update: never
      }
      stack_rankings: {
        Row: {
          id:         string
          user_id:    string
          job_title:  string | null
          jd_text:    string
          created_at: string
        }
        Insert: {
          id?:        string
          user_id:    string
          job_title?: string | null
          jd_text:    string
        }
        Update: never
      }
      stack_ranking_candidates: {
        Row: {
          id:             string
          ranking_id:     string
          user_id:        string
          candidate_name: string
          resume_text:    string
          score:          number
          rank:           number
          breakdown_json: BreakdownJson
          notes:          string | null
          created_at:     string
          updated_at:     string
        }
        Insert: {
          id?:            string
          ranking_id:     string
          user_id:        string
          candidate_name: string
          resume_text:    string
          score:          number
          rank:           number
          breakdown_json: BreakdownJson
          notes?:         string | null
        }
        Update: {
          notes?:      string | null
          updated_at?: string
        }
      }
      activity_log: {
        Row: {
          id:          string
          user_id:     string
          feature:     ActivityFeature
          record_id:   string
          description: string
          created_at:  string
        }
        Insert: {
          id?:         string
          user_id:     string
          feature:     ActivityFeature
          record_id:   string
          description: string
        }
        Update: never
      }
      square_webhook_events: {
        Row: {
          id:           string
          event_id:     string
          event_type:   string
          payload:      Json
          processed:    boolean
          processed_at: string | null
          error:        string | null
          created_at:   string
        }
        Insert: {
          id?:          string
          event_id:     string
          event_type:   string
          payload:      Json
          processed?:   boolean
          processed_at?: string | null
          error?:       string | null
        }
        Update: {
          processed?:    boolean
          processed_at?: string | null
          error?:        string | null
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}

// ─── Domain types ─────────────────────────────────────────

export type RedFlag = {
  type:        string
  severity:    'high' | 'medium' | 'low'
  evidence:    string
  explanation: string
}

export type ActivityFeature =
  | 'resume_scorer'
  | 'summary'
  | 'boolean'
  | 'stack_ranking'
  | 'assessment'

export type ProctoringEventType =
  | 'tab_switch'
  | 'paste_detected'
  | 'gaze_off_screen'
  | 'face_not_detected'
  | 'eye_tracking_degraded'
  | 'keystroke_anomaly'
  | 'presence_challenge_passed'
  | 'presence_challenge_failed'
  | 'offline_detected'
  | 'session_resumed'

export type ProctoringConfig = {
  tab_switching:                boolean
  paste_detection:              boolean
  eye_tracking:                 boolean
  keystroke_dynamics:           boolean
  presence_challenges:          boolean
  presence_challenge_frequency: 2 | 3
  snapshots:                    boolean
}

export type TestCase = {
  input:          string
  expectedOutput: string
}

export type MCOption = {
  id:         string
  text:       string
  is_correct: boolean
}

export type BreakdownCategory = {
  score:    number
  weight:   number
  weighted: number
}

export type BreakdownJson = {
  must_have_skills:  BreakdownCategory
  domain_experience: BreakdownCategory
  communication:     BreakdownCategory
  tenure_stability:  BreakdownCategory
  tool_depth:        BreakdownCategory
}

export type BooleanInputsJson = {
  job_title:           string
  must_have_skills:    string
  nice_to_have_skills?: string
  location?:           string
  exclude_terms?:      string
}

// ─── Convenience row types ─────────────────────────────────

export type UserProfile              = Database['public']['Tables']['user_profiles']['Row']
export type TeamMember               = Database['public']['Tables']['team_members']['Row']
export type ResumeScore              = Database['public']['Tables']['resume_scores']['Row']
export type ClientSummary            = Database['public']['Tables']['client_summaries']['Row']
export type BooleanSearch            = Database['public']['Tables']['boolean_searches']['Row']
export type StackRanking             = Database['public']['Tables']['stack_rankings']['Row']
export type StackCandidate           = Database['public']['Tables']['stack_ranking_candidates']['Row']
export type ActivityLog              = Database['public']['Tables']['activity_log']['Row']
export type Assessment               = Database['public']['Tables']['assessments']['Row']
export type AssessmentQuestion       = Database['public']['Tables']['assessment_questions']['Row']
export type AssessmentInvite         = Database['public']['Tables']['assessment_invites']['Row']
export type AssessmentSession        = Database['public']['Tables']['assessment_sessions']['Row']
export type AssessmentQuestionResponse = Database['public']['Tables']['assessment_question_responses']['Row']
export type ProctoringEvent          = Database['public']['Tables']['proctoring_events']['Row']
export type AssessmentSnapshot       = Database['public']['Tables']['assessment_snapshots']['Row']
export type Notification             = Database['public']['Tables']['notifications']['Row']
export type RedFlagCheck             = Database['public']['Tables']['red_flag_checks']['Row']
