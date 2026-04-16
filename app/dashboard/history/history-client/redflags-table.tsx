import React from 'react'
import { cn, formatRelativeTime } from '@/lib/utils'
import type { RedFlagCheck } from '@/types/database'
import { ExpandPanel, RowActions, ScoreBadge } from './atoms'
import { RECOMMENDATION_BADGE, RECOMMENDATION_LABEL, TH_CLS } from './constants'

interface Props {
  rows:       RedFlagCheck[]
  expandedId: string | null
  onToggle:   (id: string) => void
  onDelete:   (id: string) => void
}

export function RedFlagsTable({ rows, expandedId, onToggle, onDelete }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/6">
            <th className={TH_CLS}>Date</th>
            <th className={TH_CLS}>Integrity</th>
            <th className={TH_CLS}>Flags</th>
            <th className={TH_CLS}>Recommendation</th>
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
                <td className="py-3 pr-4 text-sm text-slate-400 whitespace-nowrap">{formatRelativeTime(row.created_at)}</td>
                <td className="py-3 pr-4">
                  <ScoreBadge score={row.integrity_score} />
                </td>
                <td className="py-3 pr-4 text-sm text-slate-400">
                  {row.flags_json.length} flag{row.flags_json.length !== 1 ? 's' : ''}
                </td>
                <td className="py-3 pr-4">
                  <span className={cn(
                    'text-xs font-semibold px-2 py-0.5 rounded-full border',
                    RECOMMENDATION_BADGE[row.recommendation] ?? 'bg-white/10 text-slate-400 border-white/10',
                  )}>
                    {RECOMMENDATION_LABEL[row.recommendation] ?? row.recommendation}
                  </span>
                </td>
                <td className="py-3">
                  <RowActions expanded={expandedId === row.id} onDelete={() => onDelete(row.id)} />
                </td>
              </tr>
              {expandedId === row.id && (
                <tr>
                  <td colSpan={5} className="pb-3">
                    <ExpandPanel>
                      {row.flags_json.length === 0 ? (
                        <p className="text-sm text-slate-400 italic">No flags detected.</p>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Flags</p>
                          {row.flags_json.map((flag, i) => {
                            const sevCls =
                              flag.severity === 'high'   ? 'text-red-400'    :
                              flag.severity === 'medium' ? 'text-yellow-400' : 'text-green-400'
                            const sevDot =
                              flag.severity === 'high'   ? '🔴' :
                              flag.severity === 'medium' ? '🟡' : '🟢'
                            return (
                              <div key={i} className="flex items-start gap-2.5 p-3 rounded-lg bg-white/4 border border-white/6">
                                <span className="text-sm leading-5">{sevDot}</span>
                                <div className="min-w-0">
                                  <p className={cn('text-xs font-semibold mb-0.5', sevCls)}>{flag.type}</p>
                                  <p className="text-xs text-slate-400 leading-relaxed">{flag.evidence}</p>
                                  <p className="text-xs text-slate-500 italic leading-relaxed mt-0.5">{flag.explanation}</p>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                      {row.summary && (
                        <div>
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Summary</p>
                          <p className="text-sm text-slate-300 leading-relaxed">{row.summary}</p>
                        </div>
                      )}
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
