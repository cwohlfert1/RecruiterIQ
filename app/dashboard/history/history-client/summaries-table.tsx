import React from 'react'
import { formatRelativeTime } from '@/lib/utils'
import type { ClientSummary } from '@/types/database'
import { CopyButton, ExpandPanel, RowActions } from './atoms'
import { TH_CLS } from './constants'

interface Props {
  rows:       ClientSummary[]
  expandedId: string | null
  onToggle:   (id: string) => void
  onDelete:   (id: string) => void
}

export function SummariesTable({ rows, expandedId, onToggle, onDelete }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/6">
            <th className={TH_CLS}>Date</th>
            <th className={TH_CLS}>Job Title</th>
            <th className={TH_CLS}>Notes preview</th>
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
                <td className="py-3 pr-4 text-sm text-slate-200 max-w-[140px] truncate">{row.job_title}</td>
                <td className="py-3 pr-4 text-sm text-slate-500 max-w-[280px] truncate">{row.input_notes.slice(0, 80)}…</td>
                <td className="py-3">
                  <RowActions expanded={expandedId === row.id} onDelete={() => onDelete(row.id)} />
                </td>
              </tr>
              {expandedId === row.id && (
                <tr>
                  <td colSpan={4} className="pb-3">
                    <ExpandPanel>
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Generated Summary</p>
                        <CopyButton text={row.summary_output} />
                      </div>
                      <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{row.summary_output}</p>
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
