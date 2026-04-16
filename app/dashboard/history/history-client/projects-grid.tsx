'use client'

import { useRouter } from 'next/navigation'
import { cn, formatRelativeTime } from '@/lib/utils'
import { STATUS_CONFIG, type ProjectRow } from './constants'

export function ProjectsGrid({ rows }: { rows: ProjectRow[] }) {
  const router = useRouter()
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {rows.map(project => {
        const status = STATUS_CONFIG[project.status] ?? STATUS_CONFIG.archived
        return (
          <button
            key={project.id}
            onClick={() => router.push(`/dashboard/projects/${project.id}`)}
            className="text-left p-4 rounded-xl border border-white/8 bg-white/3 hover:bg-white/6 hover:border-white/14 transition-all group"
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <p className="text-sm font-semibold text-slate-200 group-hover:text-white transition-colors line-clamp-1">
                {project.title}
              </p>
              <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full border flex-shrink-0', status.cls)}>
                {status.label}
              </span>
            </div>
            {project.client_name && (
              <p className="text-xs text-slate-500 mb-2 truncate">{project.client_name}</p>
            )}
            <p className="text-xs text-slate-600">
              Updated {formatRelativeTime(project.updated_at)}
            </p>
          </button>
        )
      })}
    </div>
  )
}
