import React from 'react'
import { formatRelativeTime, getScoreColor } from '@/lib/utils'
import type { ResumeScore } from '@/types/database'
import { ExpandPanel, RowActions, ScoreBadge } from './atoms'
import { TH_CLS } from './constants'

interface Props {
  rows:       ResumeScore[]
  expandedId: string | null
  onToggle:   (id: string) => void
  onDelete:   (id: string) => void
}

export function ScoresTable({ rows, expandedId, onToggle, onDelete }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/6">
            <th className={TH_CLS}>Date</th>
            <th className={TH_CLS}>Job Title</th>
            <th className={TH_CLS}>Score</th>
            <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wide pb-3">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/4">
          {rows.map(row => (
            <React.Fragment key={row.id}>
              <tr
                className="group cursor-pointer hover:bg-white/3 transition-colors"
                onClick={() => onToggle(row.id)}
              >
                <td className="py-3 pr-4 text-sm text-slate-400 whitespace-nowrap">
                  {formatRelativeTime(row.created_at)}
                </td>
                <td className="py-3 pr-4 text-sm text-slate-200 max-w-[200px] truncate">
                  {row.job_title ?? 'Untitled'}
                </td>
                <td className="py-3 pr-4">
                  <ScoreBadge score={row.score} />
                </td>
                <td className="py-3">
                  <RowActions expanded={expandedId === row.id} onDelete={() => onDelete(row.id)} />
                </td>
              </tr>
              {expandedId === row.id && (
                <tr>
                  <td colSpan={4} className="pb-3">
                    <ExpandPanel>
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Resume preview</p>
                        <p className="text-sm text-slate-400 line-clamp-3">{row.resume_text}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Score breakdown</p>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                          {Object.entries(row.breakdown_json)
                            .filter(([key]) => key !== 'recommendation')
                            .map(([key, val]) => {
                              const cat = val as { score: number }
                              const label = key === 'catfish_risk' ? 'Red Flag Risk' : key === 'scope_impact' ? 'Scope & Impact' : key.replace(/_/g, ' ')
                              const displayScore = key === 'catfish_risk' ? 100 - cat.score : cat.score
                              return (
                                <div key={key} className="text-center">
                                  <p className="text-xs text-slate-500 mb-1 capitalize leading-tight">{label}</p>
                                  <p className="text-xl font-bold" style={{ color: getScoreColor(displayScore) }}>
                                    {displayScore}
                                  </p>
                                </div>
                              )
                            })}
                        </div>
                      </div>
                    </ExpandPanel>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}
