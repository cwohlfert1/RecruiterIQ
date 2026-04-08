'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

const PRESET_COLORS = [
  '#6366F1', '#8B5CF6', '#EC4899', '#F43F5E',
  '#EF4444', '#F97316', '#F59E0B', '#EAB308',
  '#22C55E', '#10B981', '#14B8A6', '#06B6D4',
  '#0EA5E9', '#3B82F6', '#A855F7', '#84CC16',
]

interface ColorPickerProps {
  value: string
  onChange: (hex: string) => void
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const [customHex, setCustomHex] = useState('')
  const isCustom = !PRESET_COLORS.includes(value)

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-8 gap-1.5">
        {PRESET_COLORS.map(hex => (
          <button
            key={hex}
            type="button"
            onClick={() => onChange(hex)}
            className={cn(
              'w-7 h-7 rounded-md transition-all duration-100',
              value === hex
                ? 'ring-2 ring-white ring-offset-2 ring-offset-[#12141F] scale-110'
                : 'hover:scale-105',
            )}
            style={{ backgroundColor: hex }}
            aria-label={hex}
          />
        ))}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[10px] text-slate-500 uppercase tracking-wide">Custom</span>
        <div className="flex items-center gap-1.5 flex-1">
          <div
            className="w-6 h-6 rounded border border-white/10 flex-shrink-0"
            style={{ backgroundColor: isCustom ? value : customHex || '#6366F1' }}
          />
          <input
            type="text"
            placeholder="#hex"
            value={isCustom ? value : customHex}
            onChange={(e) => {
              const v = e.target.value
              setCustomHex(v)
              if (/^#[0-9a-fA-F]{6}$/.test(v)) onChange(v)
            }}
            className="flex-1 bg-white/6 border border-white/10 rounded-md px-2 py-1 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"
          />
        </div>
      </div>
    </div>
  )
}
