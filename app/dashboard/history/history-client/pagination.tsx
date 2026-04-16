import { PAGE_SIZE } from './constants'

interface Props {
  page:       number
  totalCount: number
  totalPages: number
  onChange:   (page: number) => void
}

export function Pagination({ page, totalCount, totalPages, onChange }: Props) {
  if (totalPages <= 1) return null
  const from = (page - 1) * PAGE_SIZE + 1
  const to   = Math.min(page * PAGE_SIZE, totalCount)
  return (
    <div className="flex items-center justify-between mt-6 pt-5 border-t border-white/6">
      <p className="text-xs text-slate-500">
        Showing {from}–{to} of {totalCount}
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="px-3 py-1.5 rounded-lg text-sm text-slate-400 border border-white/10 hover:border-white/20 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Previous
        </button>
        <span className="px-3 py-1.5 text-sm text-slate-500">
          {page} / {totalPages}
        </span>
        <button
          onClick={() => onChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          className="px-3 py-1.5 rounded-lg text-sm text-slate-400 border border-white/10 hover:border-white/20 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  )
}
