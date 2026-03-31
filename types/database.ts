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

export type ActivityFeature =
  | 'resume_scorer'
  | 'summary'
  | 'boolean'
  | 'stack_ranking'

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

export type UserProfile    = Database['public']['Tables']['user_profiles']['Row']
export type TeamMember     = Database['public']['Tables']['team_members']['Row']
export type ResumeScore    = Database['public']['Tables']['resume_scores']['Row']
export type ClientSummary  = Database['public']['Tables']['client_summaries']['Row']
export type BooleanSearch  = Database['public']['Tables']['boolean_searches']['Row']
export type StackRanking   = Database['public']['Tables']['stack_rankings']['Row']
export type StackCandidate = Database['public']['Tables']['stack_ranking_candidates']['Row']
export type ActivityLog    = Database['public']['Tables']['activity_log']['Row']
