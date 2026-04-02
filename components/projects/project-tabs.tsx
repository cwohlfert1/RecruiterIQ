'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { LayoutDashboard, Users, Kanban, FileText, Search, Activity, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CandidateRow } from '@/app/dashboard/projects/[id]/page'
import type { PipelineStage } from '@/types/database'
import { OverviewTab }    from '@/components/projects/tabs/overview-tab'
import { CandidatesTab }  from '@/components/projects/tabs/candidates-tab'
import { KanbanBoard }    from '@/components/projects/kanban-board'
import { JdTab }          from '@/components/projects/tabs/jd-tab'
import { BooleanTab }     from '@/components/projects/tabs/boolean-tab'
import { ActivityTab }    from '@/components/projects/tabs/activity-tab'
import { SettingsTab }    from '@/components/projects/tabs/settings-tab'
import { ShareModal }     from '@/components/projects/share-modal'

// ─── Types ──────────────────────────────────────────────────

type TabKey = 'overview' | 'candidates' | 'pipeline' | 'jd' | 'boolean' | 'activity' | 'settings'

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

interface Member {
  id:       string
  user_id:  string
  role:     string
  email:    string | null
  added_at?: string | null
}

interface Props {
  project:    ProjectRef
  candidates: CandidateRow[]
  userId:     string
  canEdit:    boolean
  isManager:  boolean
  planTier:   'free' | 'pro' | 'agency'
  members:    Member[]
}

// ─── Tabs Config ─────────────────────────────────────────────

const TABS: Tab[] = [
  { key: 'overview',   label: 'Overview',        icon: LayoutDashboard },
  { key: 'candidates', label: 'Candidates',       icon: Users           },
  { key: 'pipeline',   label: 'Pipeline',         icon: Kanban          },
  { key: 'jd',         label: 'Job Description',  icon: FileText        },
  { key: 'boolean',    label: 'Boolean Strings',  icon: Search          },
  { key: 'activity',   label: 'Activity Feed',    icon: Activity        },
  { key: 'settings',   label: 'Settings',         icon: Settings        },
]

// ─── Component ───────────────────────────────────────────────

export function ProjectTabs({
  project,
  candidates,
  userId,
  canEdit,
  isManager,
  planTier,
  members: initialMembers,
}: Props) {
  const [active,                setActive]                = useState<TabKey>('overview')
  const [jdText,                setJdText]                = useState<string | null>(project.jd_text)
  const [jdUpdatedThisSession,  setJdUpdatedThisSession]  = useState(false)
  const [members,               setMembers]               = useState<Member[]>(initialMembers)
  const [showShareModal,        setShowShareModal]        = useState(false)
  const [pipelineStageFilter,   setPipelineStageFilter]   = useState<PipelineStage | undefined>(undefined)

  const isOwner = project.owner_id === userId

  function handleJdSaved(text: string | null) {
    setJdText(text)
    setJdUpdatedThisSession(true)
  }

  function jumpToPipeline(stage?: PipelineStage) {
    setPipelineStageFilter(stage)
    setActive('pipeline')
  }

  function jumpToCandidates() {
    setActive('candidates')
  }

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
      {active === 'overview' && (
        <OverviewTab
          project={{ ...project, jd_text: jdText }}
          candidates={candidates}
          members={members}
          planTier={planTier}
          isManager={isManager}
          onJumpToPipeline={jumpToPipeline}
          onJumpToCandidates={jumpToCandidates}
        />
      )}

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

      {active === 'pipeline' && (
        <KanbanBoard
          project={{ ...project, jd_text: jdText }}
          initialCandidates={candidates}
          userId={userId}
          canEdit={canEdit}
          isManager={isManager}
          initialStageFilter={pipelineStageFilter}
        />
      )}

      {active === 'jd' && (
        <JdTab
          projectId={project.id}
          jdText={jdText}
          canEdit={canEdit}
          onJdSaved={handleJdSaved}
        />
      )}

      {active === 'boolean' && (
        <BooleanTab
          projectId={project.id}
          hasJd={!!jdText}
          isOwner={isOwner}
          isManager={isManager}
          jdText={jdText ?? ''}
          jdUpdatedThisSession={jdUpdatedThisSession}
        />
      )}

      {active === 'activity' && (
        <ActivityTab projectId={project.id} />
      )}

      {active === 'settings' && (
        <SettingsTab
          projectId={project.id}
          projectTitle={project.title}
          canEdit={canEdit}
          isOwner={isOwner}
          members={members}
          onMembersChange={setMembers}
          onShareClick={() => setShowShareModal(true)}
        />
      )}

      {/* Share modal */}
      {showShareModal && (
        <ShareModal
          projectId={project.id}
          planTier={planTier}
          onClose={() => setShowShareModal(false)}
          onShared={() => {
            fetch(`/api/projects/${project.id}`)
              .then(r => r.json())
              .then(json => {
                if (json.project?.project_members) {
                  setMembers(json.project.project_members)
                }
              })
              .catch(() => {})
          }}
        />
      )}
    </div>
  )
}
