import React from 'react'
import { formatRelativeTime } from '@/lib/utils'
import type { BooleanSearch } from '@/types/database'
import { CopyButton, ExpandPanel, HighlightBoolean, RowActions } from './atoms'
import { TH_CLS } from './constants'

interface Props {
  rows:       BooleanSearch[]
  expandedId: string | null
  onToggle:   (id: string) => void
  onDelete:   (id: string) => void
}

export function BooleanTable({ rows, expandedId, onToggle, onDelete }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/6">
            <th className={TH_CLS}>Date</th>
            <th className={TH_CLS}>Job Title</th>
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
                <td className="py-3 pr-4 text-sm text-slate-200 max-w-[360px] truncate">{row.job_title}</td>
                <td className="py-3">
                  <RowActions expanded={expandedId === row.id} onDelete={() => onDelete(row.id)} />
                </td>
              </tr>
              {expandedId === row.id && (
                <tr>
                  <td colSpan={3} className="pb-3">
                    <ExpandPanel>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Boolean String</p>
                          <CopyButton text={row.boolean_output} />
                        </div>
                        <div className="bg-slate-900/60 rounded-lg p-3">
                          <HighlightBoolean str={row.boolean_output} />
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
