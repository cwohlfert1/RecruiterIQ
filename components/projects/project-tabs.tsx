'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Users, FileText, Search, Activity, Settings, Construction } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CandidateRow } from '@/app/dashboard/projects/[id]/page'
import { CandidatesTab } from '@/components/projects/tabs/candidates-tab'
import { JdTab }         from '@/components/projects/tabs/jd-tab'

// ─── Types ──────────────────────────────────────────────────

type TabKey = 'candidates' | 'jd' | 'boolean' | 'activity' | 'settings'

interface Tab {
  key:   TabKey
  label: string
  icon:  React.ElementType
}

interface ProjectRef {
  id:          string
  title:       string
  client_name: string
  jd_text:     string | null
  owner_id:    string
}

interface Props {
  project:    ProjectRef
  candidates: CandidateRow[]
  userId:     string
  canEdit:    boolean
  isManager:  boolean
}

// ─── Tabs Config ─────────────────────────────────────────────

const TABS: Tab[] = [
  { key: 'candidates', label: 'Candidates',      icon: Users    },
  { key: 'jd',         label: 'Job Description', icon: FileText },
  { key: 'boolean',    label: 'Boolean Strings', icon: Search   },
  { key: 'activity',   label: 'Activity Feed',   icon: Activity },
  { key: 'settings',   label: 'Settings',        icon: Settings },
]

// ─── Stub Content ─────────────────────────────────────────────

function TabStub({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-white/8 flex items-center justify-center mb-4">
        <Construction className="w-6 h-6 text-slate-600" />
      </div>
      <p className="text-sm font-medium text-slate-400 mb-1">{label}</p>
      <p className="text-xs text-slate-600 max-w-xs">
        This tab is coming soon as part of the full projects module.
      </p>
    </div>
  )
}

// ─── Component ───────────────────────────────────────────────

export function ProjectTabs({ project, candidates, userId, canEdit, isManager }: Props) {
  const [active,  setActive]  = useState<TabKey>('candidates')
  const [jdText,  setJdText]  = useState<string | null>(project.jd_text)

  const isOwner = project.owner_id === userId

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-white/8 mb-6 overflow-x-auto">
        {TABS.map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.key}
              onClick={() => setActive(tab.key)}
              className={cn(
                'relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0',
                active === tab.key ? 'text-white' : 'text-slate-500 hover:text-slate-300'
              )}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {active === tab.key && (
                <motion.div
                  layoutId="project-tab-underline"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-400 rounded-full"
                />
              )}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      {active === 'candidates' && (
        <CandidatesTab
          project={{ ...project, jd_text: jdText }}
          initialCandidates={candidates}
          userId={userId}
          canEdit={canEdit}
          isOwner={isOwner}
          isManager={isManager}
        />
      )}

      {active === 'jd' && (
        <JdTab
          projectId={project.id}
          jdText={jdText}
          canEdit={canEdit}
          onJdSaved={setJdText}
        />
      )}

      {(active === 'boolean' || active === 'activity' || active === 'settings') && (
        <TabStub label={TABS.find(t => t.key === active)!.label} />
      )}
    </div>
  )
}
