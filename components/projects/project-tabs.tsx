'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { LayoutDashboard, Users, Kanban, FileText, Search, Activity, Settings, GripVertical } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
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
  id:                string
  title:             string
  client_name:       string
  jd_text:           string | null
  owner_id:          string
  teams_webhook_url?: string | null
  job_boards?:       string[] | null
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

const DEFAULT_TAB_ORDER: TabKey[] = ['overview', 'candidates', 'pipeline', 'jd', 'boolean', 'activity']

const TAB_META: Record<TabKey, { label: string; icon: React.ElementType }> = {
  overview:   { label: 'Overview',        icon: LayoutDashboard },
  candidates: { label: 'Candidates',      icon: Users           },
  pipeline:   { label: 'Pipeline',        icon: Kanban          },
  jd:         { label: 'Job Description', icon: FileText        },
  boolean:    { label: 'Boolean Strings', icon: Search          },
  activity:   { label: 'Activity Feed',   icon: Activity        },
  settings:   { label: 'Settings',        icon: Settings        },
}

function getStorageKey(projectId: string) {
  return `candidai_tab_order_${projectId}`
}

// ─── Sortable Tab ────────────────────────────────────────────

function SortableTab({
  tabKey,
  active,
  onClick,
}: {
  tabKey: TabKey
  active: boolean
  onClick: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tabKey })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
  }

  const meta = TAB_META[tabKey]
  const Icon = meta.icon

  return (
    <button
      ref={setNodeRef}
      style={style}
      onClick={onClick}
      className={cn(
        'relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 group',
        active ? 'text-white' : 'text-slate-500 hover:text-slate-300',
        isDragging && 'opacity-80 shadow-lg shadow-indigo-500/10 rounded-lg border border-indigo-500/30 bg-[#12141F]',
      )}
      {...attributes}
    >
      {/* Drag handle — visible on hover */}
      <span
        {...listeners}
        className="opacity-0 group-hover:opacity-40 transition-opacity cursor-grab active:cursor-grabbing flex-shrink-0 -ml-1.5 mr--0.5"
        onClick={e => e.stopPropagation()}
      >
        <GripVertical className="w-3 h-3" />
      </span>

      <Icon className="w-4 h-4" />
      <span>{meta.label}</span>
      {active && !isDragging && (
        <motion.div
          layoutId="project-tab-underline"
          className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-400 rounded-full"
        />
      )}
    </button>
  )
}

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
  const [tabOrder,              setTabOrder]              = useState<TabKey[]>(DEFAULT_TAB_ORDER)

  const isOwner = project.owner_id === userId

  // Load saved tab order from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(getStorageKey(project.id))
      if (saved) {
        const parsed = JSON.parse(saved) as TabKey[]
        // Validate: must contain all default keys
        if (Array.isArray(parsed) && DEFAULT_TAB_ORDER.every(k => parsed.includes(k))) {
          setTabOrder(parsed.filter(k => DEFAULT_TAB_ORDER.includes(k)))
        }
      }
    } catch { /* ignore */ }
  }, [project.id])

  const saveOrder = useCallback((order: TabKey[]) => {
    setTabOrder(order)
    try {
      localStorage.setItem(getStorageKey(project.id), JSON.stringify(order))
    } catch { /* ignore */ }
  }, [project.id])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active: dragActive, over } = event
    if (!over || dragActive.id === over.id) return
    const oldIndex = tabOrder.indexOf(dragActive.id as TabKey)
    const newIndex = tabOrder.indexOf(over.id as TabKey)
    if (oldIndex === -1 || newIndex === -1) return
    saveOrder(arrayMove(tabOrder, oldIndex, newIndex))
  }

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
      <div className="flex border-b border-white/8 mb-6 overflow-x-auto">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={tabOrder} strategy={horizontalListSortingStrategy}>
            {tabOrder.map(key => (
              <SortableTab
                key={key}
                tabKey={key}
                active={active === key}
                onClick={() => setActive(key)}
              />
            ))}
          </SortableContext>
        </DndContext>

        {/* Settings tab — always last, not draggable */}
        <button
          onClick={() => setActive('settings')}
          className={cn(
            'relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 ml-auto',
            active === 'settings' ? 'text-white' : 'text-slate-500 hover:text-slate-300'
          )}
        >
          <Settings className="w-4 h-4" />
          <span>Settings</span>
          {active === 'settings' && (
            <motion.div
              layoutId="project-tab-underline"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-400 rounded-full"
            />
          )}
        </button>
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
          teamsWebhookUrl={project.teams_webhook_url ?? null}
          jobBoards={(project.job_boards as string[] | null) ?? ['linkedin']}
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
