'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Trash2, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { ColorPicker } from './color-picker'

export interface Placement {
  id: string
  consultant_name: string
  client_company: string
  client_color: string
  role: string
  weekly_spread: number
  contract_end_date: string
  status: 'active' | 'locked_up' | 'falling_off'
  notes: string | null
  user_id?: string
}

interface DrawerProps {
  open: boolean
  placement: Placement | null
  readOnly?: boolean
  onClose: () => void
  onSaved: () => void
}

const EMPTY: Omit<Placement, 'id'> = {
  consultant_name: '',
  client_company: '',
  client_color: '#6366F1',
  role: '',
  weekly_spread: 0,
  contract_end_date: '',
  status: 'active',
  notes: null,
}

export function PlacementDrawer({ open, placement, readOnly, onClose, onSaved }: DrawerProps) {
  const [form, setForm] = useState<Omit<Placement, 'id'>>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  const isEdit = !!placement

  useEffect(() => {
    if (open) {
      if (placement) {
        setForm({
          consultant_name: placement.consultant_name,
          client_company: placement.client_company,
          client_color: placement.client_color,
          role: placement.role,
          weekly_spread: placement.weekly_spread,
          contract_end_date: placement.contract_end_date,
          status: placement.status,
          notes: placement.notes,
        })
      } else {
        setForm(EMPTY)
      }
      setConfirmDelete(false)
      setTimeout(() => nameRef.current?.focus(), 200)
    }
  }, [open, placement])

  function set<K extends keyof typeof form>(key: K, val: (typeof form)[K]) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  async function handleSave() {
    if (!form.consultant_name.trim() || !form.client_company.trim() || !form.role.trim() || !form.contract_end_date) {
      toast.error('Fill all required fields')
      return
    }
    if (form.weekly_spread <= 0) {
      toast.error('Weekly spread must be greater than $0')
      return
    }

    setSaving(true)
    try {
      const url = isEdit ? `/api/spread-tracker/${placement.id}` : '/api/spread-tracker'
      const method = isEdit ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error()
      toast.success(isEdit ? 'Placement updated' : 'Placement added')
      onSaved()
      onClose()
    } catch {
      toast.error('Failed to save placement')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!placement) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/spread-tracker/${placement.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Placement deleted')
      onSaved()
      onClose()
    } catch {
      toast.error('Failed to delete placement')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/40"
          />

          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-[420px] max-w-full bg-[#12141F] border-l border-white/10 flex flex-col shadow-2xl"
          >
            {/* Header with client color bar */}
            <div
              className="h-1 flex-shrink-0"
              style={{ backgroundColor: form.client_color }}
            />
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
              <h2 className="text-sm font-semibold text-white">
                {readOnly ? 'Placement Details' : isEdit ? 'Edit Placement' : 'Add Placement'}
              </h2>
              <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
              <Field label="Consultant Name" required>
                <input
                  ref={nameRef}
                  type="text"
                  value={form.consultant_name}
                  onChange={e => set('consultant_name', e.target.value)}
                  disabled={readOnly}
                  className="w-full bg-white/6 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 disabled:opacity-50"
                  placeholder="e.g., Sarah Johnson"
                />
              </Field>

              <Field label="Client Company" required>
                <input
                  type="text"
                  value={form.client_company}
                  onChange={e => set('client_company', e.target.value)}
                  disabled={readOnly}
                  className="w-full bg-white/6 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 disabled:opacity-50"
                  placeholder="e.g., Acme Corp"
                />
              </Field>

              <Field label="Client Color">
                <ColorPicker value={form.client_color} onChange={v => set('client_color', v)} />
              </Field>

              <Field label="Role / Title" required>
                <input
                  type="text"
                  value={form.role}
                  onChange={e => set('role', e.target.value)}
                  disabled={readOnly}
                  className="w-full bg-white/6 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 disabled:opacity-50"
                  placeholder="e.g., Senior React Developer"
                />
              </Field>

              <Field label="Weekly Spread" required>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.weekly_spread || ''}
                    onChange={e => set('weekly_spread', Number(e.target.value))}
                    disabled={readOnly}
                    className="w-full bg-white/6 border border-white/10 rounded-lg pl-7 pr-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 disabled:opacity-50 tabular-nums"
                    placeholder="0.00"
                  />
                </div>
              </Field>

              <Field label="Contract End Date" required>
                <input
                  type="date"
                  value={form.contract_end_date}
                  onChange={e => set('contract_end_date', e.target.value)}
                  disabled={readOnly}
                  className="w-full bg-white/6 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 disabled:opacity-50"
                />
              </Field>

              <Field label="Status" required>
                <select
                  value={form.status}
                  onChange={e => set('status', e.target.value as Placement['status'])}
                  disabled={readOnly}
                  className="w-full bg-white/6 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 disabled:opacity-50"
                >
                  <option value="active">Active</option>
                  <option value="locked_up">Locked Up</option>
                  <option value="falling_off">Falling Off</option>
                </select>

                <label className="flex items-center gap-2.5 mt-3 cursor-pointer group">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={form.status === 'locked_up'}
                    disabled={readOnly}
                    onClick={() => set('status', form.status === 'locked_up' ? 'active' : 'locked_up')}
                    className={cn(
                      'relative w-9 h-5 rounded-full transition-colors flex-shrink-0',
                      form.status === 'locked_up' ? 'bg-indigo-500' : 'bg-white/10',
                      readOnly && 'opacity-50 cursor-not-allowed',
                    )}
                  >
                    <span className={cn(
                      'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform',
                      form.status === 'locked_up' && 'translate-x-4',
                    )} />
                  </button>
                  <span className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors leading-tight">
                    Mark as Locked Up
                    <span className="block text-[10px] text-slate-600">Candidate accepted, in onboarding — not yet billing</span>
                  </span>
                </label>
              </Field>

              <Field label="Notes">
                <textarea
                  value={form.notes ?? ''}
                  onChange={e => set('notes', e.target.value || null)}
                  disabled={readOnly}
                  rows={3}
                  className="w-full bg-white/6 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 disabled:opacity-50 resize-none"
                  placeholder="Optional notes..."
                />
              </Field>
            </div>

            {/* Footer */}
            {!readOnly && (
              <div className="px-5 py-4 border-t border-white/8 space-y-2 flex-shrink-0">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 disabled:opacity-50 transition-all"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {isEdit ? 'Save Changes' : 'Add Placement'}
                </button>

                {isEdit && !confirmDelete && (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-sm font-medium text-red-400 border border-red-500/25 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Placement
                  </button>
                )}

                {isEdit && confirmDelete && (
                  <div className="flex gap-2">
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="flex-1 py-2 px-4 rounded-xl text-sm font-medium text-white bg-red-500 hover:bg-red-400 disabled:opacity-50 transition-colors"
                    >
                      {deleting ? 'Deleting...' : 'Confirm Delete'}
                    </button>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="py-2 px-4 rounded-xl text-sm text-slate-400 border border-white/10 hover:bg-white/5 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-400 mb-1.5 block">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}
