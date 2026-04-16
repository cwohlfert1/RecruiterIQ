import React from 'react'
import { FileSearch, FileText, FolderOpen, Search, ShieldAlert, Trophy } from 'lucide-react'
import type { StackCandidate, StackRanking } from '@/types/database'

export type Tab = 'scores' | 'summaries' | 'boolean' | 'rankings' | 'redflags' | 'projects'

export type ProjectRow = {
  id:          string
  title:       string
  client_name: string | null
  status:      'active' | 'filled' | 'on_hold' | 'archived'
  created_at:  string
  updated_at:  string
}

export type RankingRow = StackRanking & {
  stack_ranking_candidates: Pick<StackCandidate, 'id' | 'candidate_name' | 'score' | 'rank'>[]
}

export const PAGE_SIZE = 20

export const TAB_CONFIG: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'scores',    label: 'Resume Scores',   icon: <FileSearch   className="w-4 h-4" /> },
  { id: 'summaries', label: 'Summaries',        icon: <FileText     className="w-4 h-4" /> },
  { id: 'boolean',   label: 'Boolean Strings',  icon: <Search       className="w-4 h-4" /> },
  { id: 'rankings',  label: 'Stack Rankings',   icon: <Trophy       className="w-4 h-4" /> },
  { id: 'redflags',  label: 'Red Flag Checks',  icon: <ShieldAlert  className="w-4 h-4" /> },
  { id: 'projects',  label: 'Projects',          icon: <FolderOpen   className="w-4 h-4" /> },
]

export const STATUS_CONFIG: Record<ProjectRow['status'], { label: string; cls: string }> = {
  active:   { label: 'Active',   cls: 'bg-green-500/20 text-green-400 border-green-500/30'    },
  filled:   { label: 'Filled',   cls: 'bg-blue-500/20 text-blue-400 border-blue-500/30'       },
  on_hold:  { label: 'On Hold',  cls: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  archived: { label: 'Archived', cls: 'bg-slate-500/20 text-slate-400 border-slate-500/30'    },
}

export const RECOMMENDATION_BADGE: Record<string, string> = {
  proceed: 'bg-green-500/20 text-green-400 border-green-500/30',
  caution: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  pass:    'bg-red-500/20 text-red-400 border-red-500/30',
}

export const RECOMMENDATION_LABEL: Record<string, string> = {
  proceed: 'Proceed',
  caution: 'Ask About Flags',
  pass:    'Consider Passing',
}

export const TH_CLS = 'text-left text-xs font-semibold text-slate-500 uppercase tracking-wide pb-3 pr-4'
