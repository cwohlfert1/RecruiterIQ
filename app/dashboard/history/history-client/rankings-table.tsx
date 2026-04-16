import React from 'react'
import { cn, formatRelativeTime } from '@/lib/utils'
import { ExpandPanel, RowActions, ScoreBadge } from './atoms'
import { TH_CLS, type RankingRow } from './constants'

interface Props {
  rows:       RankingRow[]
  expandedId: string | null
  onToggle:   (id: string) => void
  onDelete:   (id: string) => void
}

export function RankingsTable({ rows, expandedId, onToggle, onDelete }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/6">
            <th className={TH_CLS}>Date</th>
            <th className={TH_CLS}>Job Title</th>
            <th className={TH_CLS}>Candidates</th>
            <th className={TH_CLS}>Top Scorer</th>
            <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wide pb-3">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/4">
          {rows.map(row => {
            const sorted = [...row.stack_ranking_candidates].sort((a, b) => b.score - a.score)
            const top = sorted[0]
            return (
              <React.Fragment key={row.id}>
                <tr
                  className="group cursor-pointer hover:bg-white/3 transition-colors"
                  onClick={() => onToggle(row.id)}
                >
                  <td className="py-3 pr-4 text-sm text-slate-400 whitespace-nowrap">{formatRelativeTime(row.created_at)}</td>
                  <td className="py-3 pr-4 text-sm text-slate-200 max-w-[200px] truncate">{row.job_title ?? 'Untitled'}</td>
                  <td className="py-3 pr-4 text-sm text-slate-400">{row.stack_ranking_candidates.length}</td>
                  <td className="py-3 pr-4">
                    {top ? (
                      <span className="flex items-center gap-2 text-sm text-slate-300">
                        <span className="max-w-[120px] truncate">{top.candidate_name}</span>
                        <ScoreBadge score={top.score} />
                      </span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                  <td className="py-3">
                    <RowActions expanded={expandedId === row.id} onDelete={() => onDelete(row.id)} />
                  </td>
                </tr>
                {expandedId === row.id && (
                  <tr>
                    <td colSpan={5} className="pb-3">
                      <ExpandPanel>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Leaderboard</p>
                        <div className="space-y-2">
                          {sorted.map((c, idx) => (
                            <div key={c.id} className="flex items-center gap-3">
                              <span className={cn(
                                'text-sm font-bold w-6 text-center flex-shrink-0',
                                idx === 0 ? 'text-amber-400'
                                : idx === 1 ? 'text-slate-300'
                                : idx === 2 ? 'text-amber-600'
                                : 'text-slate-600',
                              )}>
                                #{idx + 1}
                              </span>
                              <span className="flex-1 text-sm text-slate-200 truncate">{c.candidate_name}</span>
                              <ScoreBadge score={c.score} />
                            </div>
                          ))}
                        </div>
                      </ExpandPanel>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
