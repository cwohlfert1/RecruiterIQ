import type { PipelineStage, BreakdownJson } from '@/types/database'

export const STAGES: Array<{ key: PipelineStage; label: string }> = [
  { key: 'reviewing',          label: 'Reviewing'          },
  { key: 'screened',           label: 'Screened'           },
  { key: 'internal_submittal', label: 'Internal Submittal' },
  { key: 'client_submittal',   label: 'Client Submittal'   },
  { key: 'interviewing',       label: 'Interviewing'       },
  { key: 'placed',             label: 'Placed'             },
  { key: 'rejected',           label: 'Rejected'           },
]

export const BREAKDOWN_CATEGORIES: Array<{ key: keyof BreakdownJson; label: string; inverted?: boolean }> = [
  { key: 'technical_fit',     label: 'Technical Fit'    },
  { key: 'domain_experience', label: 'Domain Experience' },
  { key: 'scope_impact',      label: 'Scope & Impact'   },
  { key: 'communication',     label: 'Communication'    },
  { key: 'catfish_risk',      label: 'Red Flag Risk',   inverted: true },
]

export const RECOMMENDATION_BADGE: Record<string, { label: string; cls: string }> = {
  'Strong Submit': { label: 'Strong Submit', cls: 'bg-green-500/15 text-green-400 border border-green-500/25' },
  'Submit':        { label: 'Submit',        cls: 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/25' },
  'Borderline':    { label: 'Borderline',    cls: 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/25' },
  'Pass':          { label: 'Pass',          cls: 'bg-red-500/15 text-red-400 border border-red-500/25' },
}

export interface ProjectRef {
  id:          string
  title:       string
  client_name: string
  jd_text:     string | null
  owner_id:    string
}

export interface BenchmarkData {
  role_title:  string
  hired_name:  string | null
  cqi_score:   number
  hired_at:    string | null
  this_cqi:    number
}

export interface ClientIntel {
  outcome_count:     number
  success_threshold: number | null
  avg_cqi_placed:    number | null
}

export interface Insights {
  overqualified:        boolean
  overqualified_reason: string | null
  submit_if:            string[]
  avoid_if:             string[]
  key_gaps:             string[]
}

export interface RedFlag {
  type:        string
  severity:    string
  evidence:    string
  explanation: string
}
