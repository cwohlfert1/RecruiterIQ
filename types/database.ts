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
          user_id:                  string
          plan_tier:                'free' | 'pro' | 'agency'
          subscription_status:     'free' | 'active' | 'grace' | 'cancelling' | 'cancelled'
          square_customer_id:      string | null
          square_subscription_id:  string | null
          ai_calls_this_month:     number
          last_reset_at:           string
          billing_period_end:      string | null
          grace_period_start:      string | null
          role:                    'recruiter' | 'manager'
          created_at:              string
          updated_at:              string
          avatar_url:              string | null
          display_name:            string | null
          job_title:               string | null
          linkedin_url:            string | null
          linkedin_id:             string | null
          linkedin_connected_at:   string | null
          phone:                   string | null
        }
        Insert: {
          user_id:                  string
          plan_tier?:               'free' | 'pro' | 'agency'
          subscription_status?:    'free' | 'active' | 'grace' | 'cancelling' | 'cancelled'
          square_customer_id?:     string | null
          square_subscription_id?: string | null
          ai_calls_this_month?:    number
          last_reset_at?:          string
          billing_period_end?:     string | null
          grace_period_start?:     string | null
          role?:                   'recruiter' | 'manager'
          avatar_url?:             string | null
          display_name?:           string | null
          job_title?:              string | null
          linkedin_url?:           string | null
          linkedin_id?:            string | null
          linkedin_connected_at?:  string | null
          phone?:                  string | null
        }
        Update: {
          plan_tier?:               'free' | 'pro' | 'agency'
          subscription_status?:    'free' | 'active' | 'grace' | 'cancelling' | 'cancelled'
          square_customer_id?:     string | null
          square_subscription_id?: string | null
          ai_calls_this_month?:    number
          last_reset_at?:          string
          billing_period_end?:     string | null
          grace_period_start?:     string | null
          role?:                   'recruiter' | 'manager'
          avatar_url?:             string | null
          display_name?:           string | null
          job_title?:              string | null
          linkedin_url?:           string | null
          linkedin_id?:            string | null
          linkedin_connected_at?:  string | null
          phone?:                  string | null
        }
      }
      assessments: {
        Row: {
          id:                       string
          user_id:                  string
          title:                    string
          description:              string | null
          role:                     string
          time_limit_minutes:       number
          proctoring_config:        ProctoringConfig
          question_order:           'sequential' | 'random'
          presentation_mode:        'one_at_a_time' | 'all_at_once'
          status:                   'draft' | 'published' | 'archived'
          expiry_hours:             number | null
          notification_recipients:  NotificationRecipient[]
          template_type:            string | null
          allow_retakes:            boolean
          proctoring_intensity:     string | null
          created_at:               string
          updated_at:               string
        }
        Insert: {
          id?:                       string
          user_id:                   string
          title:                     string
          description?:              string | null
          role:                      string
          time_limit_minutes:        number
          proctoring_config?:        ProctoringConfig
          question_order?:           'sequential' | 'random'
          presentation_mode?:        'one_at_a_time' | 'all_at_once'
          status?:                   'draft' | 'published' | 'archived'
          expiry_hours?:             number | null
          notification_recipients?:  NotificationRecipient[]
          template_type?:            string | null
          allow_retakes?:            boolean
          proctoring_intensity?:     string | null
        }
        Update: {
          title?:                     string
          description?:               string | null
          role?:                      string
          time_limit_minutes?:        number
          proctoring_config?:         ProctoringConfig
          question_order?:            'sequential' | 'random'
          presentation_mode?:         'one_at_a_time' | 'all_at_once'
          status?:                    'draft' | 'published' | 'archived'
          expiry_hours?:              number | null
          notification_recipients?:   NotificationRecipient[]
          template_type?:             string | null
          allow_retakes?:             boolean
          proctoring_intensity?:      string | null
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
          recruiter_decision:   string | null
          decision_notes:       string | null
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
          recruiter_decision?:   string | null
          decision_notes?:       string | null
        }
        Update: {
          completed_at?:         string | null
          time_spent_seconds?:   number | null
          trust_score?:          number | null
          skill_score?:          number | null
          ai_integrity_summary?: string | null
          status?:               'in_progress' | 'completed' | 'abandoned'
          recruiter_decision?:   string | null
          decision_notes?:       string | null
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
          type:       'assessment_completed' | 'assessment_started' | 'invite_expired' | 'project_shared'
          title:      string
          message:    string | null
          link:       string | null
          read:       boolean
          created_at: string
        }
        Insert: {
          id?:        string
          user_id:    string
          type:       'assessment_completed' | 'assessment_started' | 'invite_expired' | 'project_shared'
          title:      string
          message?:   string | null
          link?:      string | null
          read?:      boolean
        }
        Update: {
          read?: boolean
        }
      }
      projects: {
        Row: {
          id:                    string
          owner_id:              string
          title:                 string
          client_name:           string
          jd_text:               string | null
          status:                'active' | 'filled' | 'on_hold' | 'archived'
          hired_candidate_id:    string | null
          hired_candidate_name:  string | null
          teams_webhook_url:     string | null
          company_id:            string | null
          job_boards:            string[]
          created_at:            string
          updated_at:            string
        }
        Insert: {
          id?:                   string
          owner_id:              string
          title:                 string
          client_name:           string
          jd_text?:              string | null
          status?:               'active' | 'filled' | 'on_hold' | 'archived'
          hired_candidate_id?:   string | null
          hired_candidate_name?: string | null
          teams_webhook_url?:    string | null
          company_id?:           string | null
          job_boards?:           string[]
        }
        Update: {
          title?:                string
          client_name?:          string
          jd_text?:              string | null
          status?:               'active' | 'filled' | 'on_hold' | 'archived'
          hired_candidate_id?:   string | null
          hired_candidate_name?: string | null
          teams_webhook_url?:    string | null
          company_id?:           string | null
          job_boards?:           string[]
        }
      }
      project_members: {
        Row: {
          id:         string
          project_id: string
          user_id:    string
          role:       'owner' | 'collaborator' | 'viewer'
          added_by:   string | null
          added_at:   string
        }
        Insert: {
          id?:        string
          project_id: string
          user_id:    string
          role:       'owner' | 'collaborator' | 'viewer'
          added_by?:  string | null
          added_at?:  string
        }
        Update: {
          role?: 'owner' | 'collaborator' | 'viewer'
        }
      }
      project_candidates: {
        Row: {
          id:                   string
          project_id:           string
          candidate_name:       string
          candidate_email:      string
          resume_text:          string
          cqi_score:            number | null
          cqi_breakdown_json:   BreakdownJson | null
          red_flag_score:       number | null
          red_flag_summary:     string | null
          red_flags_json:       RedFlag[] | null
          assessment_invite_id: string | null
          added_by:             string | null
          status:               'reviewing' | 'screening' | 'submitted' | 'rejected'
          pipeline_stage:       PipelineStage
          stage_changed_at:     string
          tags_json:            string[]
          starred:              boolean
          reaction:             string | null
          hired:                boolean
          flag_type:            string | null
          resume_file_url:      string | null
          pay_rate_min:         number | null
          pay_rate_max:         number | null
          pay_rate_type:        string | null
          deleted_at:           string | null
          created_at:           string
          updated_at:           string
        }
        Insert: {
          id?:                   string
          project_id:            string
          candidate_name:        string
          candidate_email:       string
          resume_text:           string
          cqi_score?:            number | null
          cqi_breakdown_json?:   BreakdownJson | null
          red_flag_score?:       number | null
          red_flag_summary?:     string | null
          red_flags_json?:       RedFlag[] | null
          assessment_invite_id?: string | null
          added_by?:             string | null
          status?:               'reviewing' | 'screening' | 'submitted' | 'rejected'
          pipeline_stage?:       PipelineStage
          stage_changed_at?:     string
          tags_json?:            string[]
          pay_rate_min?:         number | null
          pay_rate_max?:         number | null
          pay_rate_type?:        string | null
        }
        Update: {
          candidate_name?:       string
          cqi_score?:            number | null
          cqi_breakdown_json?:   BreakdownJson | null
          red_flag_score?:       number | null
          red_flag_summary?:     string | null
          red_flags_json?:       RedFlag[] | null
          assessment_invite_id?: string | null
          status?:               'reviewing' | 'screening' | 'submitted' | 'rejected'
          pipeline_stage?:       PipelineStage
          stage_changed_at?:     string
          tags_json?:            string[]
          starred?:              boolean
          reaction?:             string | null
          hired?:                boolean
          flag_type?:            string | null
          resume_file_url?:      string | null
          pay_rate_min?:         number | null
          pay_rate_max?:         number | null
          pay_rate_type?:        string | null
          deleted_at?:           string | null
        }
      }
      project_candidate_notes: {
        Row: {
          id:           string
          candidate_id: string
          project_id:   string
          user_id:      string
          content:      string
          created_at:   string
        }
        Insert: {
          id?:          string
          candidate_id: string
          project_id:   string
          user_id:      string
          content:      string
        }
        Update: never
      }
      project_boolean_strings: {
        Row: {
          id:                        string
          project_id:                string
          user_id:                   string
          linkedin_string:           string
          indeed_string:             string
          is_active:                 boolean
          is_edited:                 boolean
          original_linkedin_string:  string | null
          original_indeed_string:    string | null
          created_by:                string | null
          created_at:                string
        }
        Insert: {
          id?:                        string
          project_id:                 string
          user_id:                    string
          linkedin_string:            string
          indeed_string:              string
          is_active?:                 boolean
          is_edited?:                 boolean
          original_linkedin_string?:  string | null
          original_indeed_string?:    string | null
          created_by?:                string | null
        }
        Update: {
          is_active?:                boolean
          linkedin_string?:          string
          indeed_string?:            string
          is_edited?:                boolean
          original_linkedin_string?: string | null
          original_indeed_string?:   string | null
        }
      }
      project_activity: {
        Row: {
          id:            string
          project_id:    string
          user_id:       string | null
          action_type:   string
          metadata_json: Json
          created_at:    string
        }
        Insert: {
          id?:            string
          project_id:     string
          user_id?:       string | null
          action_type:    string
          metadata_json?: Json
        }
        Update: never
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

export type NotificationRecipient = {
  email:   string
  name:    string
  user_id?: string | null
}

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
  | 'automated_input_detected'
  | 'code_without_typing'

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
  score:       number
  weight:      number
  weighted:    number
  explanation?: string
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
export type Project                  = Database['public']['Tables']['projects']['Row']
export type ProjectMember            = Database['public']['Tables']['project_members']['Row']
export type ProjectCandidate         = Database['public']['Tables']['project_candidates']['Row']
export type ProjectBooleanString     = Database['public']['Tables']['project_boolean_strings']['Row']
export type ProjectActivity          = Database['public']['Tables']['project_activity']['Row']
export type ProjectCandidateNote     = Database['public']['Tables']['project_candidate_notes']['Row']

// ─── Project domain types ──────────────────────────────────

export type ProjectStatus      = 'active' | 'filled' | 'on_hold' | 'archived'
export type ProjectMemberRole  = 'owner' | 'collaborator' | 'viewer'
export type CandidateStatus    = 'reviewing' | 'screening' | 'submitted' | 'rejected'
export type PipelineStage      =
  | 'sourced'
  | 'contacted'
  | 'internal_submittal'
  | 'assessment'
  | 'submitted'
  | 'placed'
  | 'rejected'

export type ProjectActivityType =
  | 'project_created'
  | 'candidate_added'
  | 'candidate_scored'
  | 'candidate_status_changed'
  | 'candidate_stage_changed'
  | 'red_flag_checked'
  | 'boolean_generated'
  | 'boolean_regenerated'
  | 'assessment_sent'
  | 'assessment_completed'
  | 'project_shared'
  | 'jd_updated'
  | 'project_status_changed'
  | 'member_added'
  | 'batch_score_started'
  | 'batch_score_completed'
  | 'candidate_hired'
  | 'candidate_starred'
  | 'candidate_reacted'
  | 'candidate_flagged'
  | 'flag_override'
  | 'note_added'

// Enriched project row returned by /api/projects/list
export type ProjectListItem = Project & {
  candidate_count:  number
  top_cqi:          number | null
  last_activity_at: string | null
  members:          Array<{ user_id: string; role: ProjectMemberRole }>
  is_owner:         boolean
  company_logo_url: string | null
  hired_first_name: string | null
}
