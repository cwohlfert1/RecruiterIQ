'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DatePickerProps {
  value: string
  onChange: (date: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function firstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay()
}

export function DatePicker({ value, onChange, placeholder = 'Select date', disabled, className }: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Parse value or default to current month
  const parsed = value ? new Date(value + 'T00:00:00') : null
  const [viewYear, setViewYear] = useState(parsed?.getFullYear() ?? new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(parsed?.getMonth() ?? new Date().getMonth())

  // Sync view when value changes externally
  useEffect(() => {
    if (value) {
      const d = new Date(value + 'T00:00:00')
      if (!isNaN(d.getTime())) {
        setViewYear(d.getFullYear())
        setViewMonth(d.getMonth())
      }
    }
  }, [value])

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  function selectDate(day: number) {
    const m = String(viewMonth + 1).padStart(2, '0')
    const d = String(day).padStart(2, '0')
    onChange(`${viewYear}-${m}-${d}`)
    setOpen(false)
  }

  const totalDays = daysInMonth(viewYear, viewMonth)
  const startDay = firstDayOfMonth(viewYear, viewMonth)
  const selectedDay = parsed && parsed.getFullYear() === viewYear && parsed.getMonth() === viewMonth ? parsed.getDate() : null
  const today = new Date()
  const isToday = (day: number) => today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === day

  const displayValue = parsed
    ? parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : ''

  // Determine if dropdown should open upward
  const [openUp, setOpenUp] = useState(false)

  function handleOpen() {
    if (disabled) return
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      setOpenUp(spaceBelow < 320)
    }
    setOpen(o => !o)
  }

  return (
    <div ref={ref} className={cn('relative', className)}>
      {/* Trigger */}
      <button
        type="button"
        onClick={handleOpen}
        disabled={disabled}
        className={cn(
          'w-full flex items-center gap-2 bg-white/6 border border-white/10 rounded-lg px-3 py-2 text-sm text-left transition-colors',
          'focus:outline-none focus:border-indigo-500/50 hover:border-white/20',
          disabled && 'opacity-50 cursor-not-allowed',
          displayValue ? 'text-white' : 'text-slate-500',
        )}
      >
        <span className="flex-1 truncate">{displayValue || placeholder}</span>
        <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
      </button>

      {/* Dropdown calendar */}
      {open && (
        <div className={cn(
          'absolute z-50 w-64 bg-[#12141F] border border-white/10 rounded-xl shadow-2xl shadow-black/40 p-3',
          openUp ? 'bottom-full mb-1' : 'top-full mt-1',
        )}>
          {/* Month/year header */}
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={prevMonth} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/8 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium text-white">
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button type="button" onClick={nextMonth} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/8 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map(d => (
              <div key={d} className="text-center text-[10px] font-medium text-slate-500 py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7">
            {/* Empty cells for days before the 1st */}
            {Array.from({ length: startDay }).map((_, i) => (
              <div key={`empty-${i}`} className="h-8" />
            ))}

            {/* Day cells */}
            {Array.from({ length: totalDays }).map((_, i) => {
              const day = i + 1
              const selected = day === selectedDay
              const todayMark = isToday(day)

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => selectDate(day)}
                  className={cn(
                    'h-8 w-full flex items-center justify-center rounded-lg text-xs font-medium transition-colors',
                    selected
                      ? 'bg-indigo-500 text-white'
                      : todayMark
                        ? 'bg-white/8 text-indigo-300 ring-1 ring-indigo-500/30'
                        : 'text-slate-300 hover:bg-white/8 hover:text-white',
                  )}
                >
                  {day}
                </button>
              )
            })}
          </div>

          {/* Quick actions */}
          <div className="flex gap-1 mt-2 pt-2 border-t border-white/8">
            <button
              type="button"
              onClick={() => {
                const t = new Date()
                selectDate(t.getDate())
                setViewYear(t.getFullYear())
                setViewMonth(t.getMonth())
              }}
              className="flex-1 text-[10px] text-slate-400 hover:text-white py-1 rounded-lg hover:bg-white/5 transition-colors"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false) }}
              className="flex-1 text-[10px] text-slate-400 hover:text-white py-1 rounded-lg hover:bg-white/5 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
