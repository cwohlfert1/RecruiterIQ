'use client'

import { useState, useRef, useCallback } from 'react'
import { X, Upload, FileSpreadsheet, ChevronDown, ChevronUp, AlertCircle, CheckCircle2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import * as XLSX from 'xlsx'

interface ImportModalProps {
  open: boolean
  onClose: () => void
  onImported: () => void
}

interface ParsedRow {
  [key: string]: string | number | undefined
}

const REQUIRED_FIELDS = ['consultant_name', 'client_company', 'role', 'weekly_spread', 'contract_end_date'] as const
const OPTIONAL_FIELDS = ['status', 'notes'] as const
const ALL_FIELDS = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS]

const FIELD_LABELS: Record<string, string> = {
  consultant_name:   'Consultant Name',
  client_company:    'Client Company',
  role:              'Role',
  weekly_spread:     'Weekly Spread',
  contract_end_date: 'Contract End Date',
  status:            'Status',
  notes:             'Notes',
}

// Common column header variations → our field names
const AUTO_MAP: Record<string, string> = {
  'consultant name':    'consultant_name',
  'consultant':         'consultant_name',
  'name':               'consultant_name',
  'client company':     'client_company',
  'client':             'client_company',
  'company':            'client_company',
  'role':               'role',
  'title':              'role',
  'role/title':         'role',
  'weekly spread':      'weekly_spread',
  'spread':             'weekly_spread',
  'weekly margin':      'weekly_spread',
  'margin':             'weekly_spread',
  'contract end date':  'contract_end_date',
  'end date':           'contract_end_date',
  'contract end':       'contract_end_date',
  'status':             'status',
  'notes':              'notes',
}

export function ImportModal({ open, onClose, onImported }: ImportModalProps) {
  const [step, setStep] = useState<'upload' | 'map' | 'preview' | 'importing' | 'done'>('upload')
  const [rawHeaders, setRawHeaders] = useState<string[]>([])
  const [rawRows, setRawRows] = useState<ParsedRow[]>([])
  const [columnMap, setColumnMap] = useState<Record<string, string>>({})
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: Array<{ row: number; reason: string }> } | null>(null)
  const [showErrors, setShowErrors] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const reset = useCallback(() => {
    setStep('upload')
    setRawHeaders([])
    setRawRows([])
    setColumnMap({})
    setResult(null)
    setShowErrors(false)
  }, [])

  function handleClose() {
    reset()
    onClose()
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!ext || !['csv', 'xlsx', 'xls'].includes(ext)) {
      toast.error('Please upload a .csv, .xlsx, or .xls file')
      return
    }

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array', cellDates: true })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const json = XLSX.utils.sheet_to_json<ParsedRow>(sheet, { defval: '', raw: false })

        if (json.length === 0) {
          toast.error('No data found in file')
          return
        }

        const headers = Object.keys(json[0])
        setRawHeaders(headers)
        setRawRows(json)

        // Auto-map columns
        const autoMapped: Record<string, string> = {}
        for (const h of headers) {
          const normalized = h.toLowerCase().trim()
          if (AUTO_MAP[normalized]) {
            autoMapped[h] = AUTO_MAP[normalized]
          }
        }
        setColumnMap(autoMapped)

        // Check if all required fields are auto-mapped
        const mappedFields = new Set(Object.values(autoMapped))
        const allRequired = REQUIRED_FIELDS.every(f => mappedFields.has(f))
        setStep(allRequired ? 'preview' : 'map')
      } catch {
        toast.error('Failed to parse file — check the format')
      }
    }
    reader.readAsArrayBuffer(file)
    // Reset input so same file can be re-selected
    e.target.value = ''
  }

  function getMappedRows(): Array<Record<string, string | number | undefined>> {
    return rawRows.map(row => {
      const mapped: Record<string, string | number | undefined> = {}
      for (const [sourceCol, targetField] of Object.entries(columnMap)) {
        mapped[targetField] = row[sourceCol]
      }
      return mapped
    })
  }

  async function handleImport() {
    setStep('importing')
    const rows = getMappedRows()

    try {
      const res = await fetch('/api/spread-tracker/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      })

      if (!res.ok) throw new Error()
      const data = await res.json()
      setResult(data)
      setStep('done')

      if (data.imported > 0) {
        const msg = data.skipped > 0
          ? `${data.imported} imported, ${data.skipped} skipped`
          : `${data.imported} placements imported successfully`
        toast.success(msg)
        onImported()
      } else {
        toast.error('No valid rows found — check your file matches the template format')
      }
    } catch {
      toast.error('Import failed — please try again')
      setStep('preview')
    }
  }

  function downloadTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Consultant Name', 'Client Company', 'Role', 'Weekly Spread', 'Contract End Date', 'Status', 'Notes'],
      ['Sarah Johnson', 'Acme Corp', 'Senior React Developer', 1250, '2025-06-30', 'Active', ''],
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Template')
    XLSX.writeFile(wb, 'spread-tracker-template.csv')
  }

  const mappedFields = new Set(Object.values(columnMap))
  const missingRequired = REQUIRED_FIELDS.filter(f => !mappedFields.has(f))
  const previewRows = getMappedRows().slice(0, 5)

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="bg-[#12141F] border border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
                <div className="flex items-center gap-2.5">
                  <FileSpreadsheet className="w-5 h-5 text-indigo-400" />
                  <h2 className="text-sm font-semibold text-white">
                    {step === 'upload' && 'Import from CSV/Excel'}
                    {step === 'map' && 'Map Columns'}
                    {step === 'preview' && 'Preview Import'}
                    {step === 'importing' && 'Importing...'}
                    {step === 'done' && 'Import Complete'}
                  </h2>
                </div>
                <button onClick={handleClose} className="text-slate-500 hover:text-white transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-6 py-5">

                {/* Step 1: Upload */}
                {step === 'upload' && (
                  <div className="space-y-5">
                    <div
                      onClick={() => fileRef.current?.click()}
                      className="border-2 border-dashed border-white/10 rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-all"
                    >
                      <Upload className="w-8 h-8 text-slate-500" />
                      <div className="text-center">
                        <p className="text-sm font-medium text-white">Click to upload or drag & drop</p>
                        <p className="text-xs text-slate-500 mt-1">.csv, .xlsx, or .xls</p>
                      </div>
                    </div>
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <div className="flex items-center justify-center">
                      <button onClick={downloadTemplate} className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors underline underline-offset-2">
                        Download template CSV
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 2: Column Mapping */}
                {step === 'map' && (
                  <div className="space-y-4">
                    <p className="text-xs text-slate-400">Map your spreadsheet columns to Spread Tracker fields. Required fields are marked with *.</p>

                    <div className="space-y-2.5">
                      {ALL_FIELDS.map(field => {
                        const isReq = (REQUIRED_FIELDS as readonly string[]).includes(field)
                        const currentSource = Object.entries(columnMap).find(([, v]) => v === field)?.[0] ?? ''
                        return (
                          <div key={field} className="flex items-center gap-3">
                            <span className="text-xs text-slate-300 w-36 flex-shrink-0">
                              {FIELD_LABELS[field]}{isReq && <span className="text-red-400 ml-0.5">*</span>}
                            </span>
                            <select
                              value={currentSource}
                              onChange={(e) => {
                                const newMap = { ...columnMap }
                                // Remove old mapping for this field
                                for (const [k, v] of Object.entries(newMap)) {
                                  if (v === field) delete newMap[k]
                                }
                                if (e.target.value) newMap[e.target.value] = field
                                setColumnMap(newMap)
                              }}
                              className="flex-1 bg-white/6 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500/50"
                            >
                              <option value="">— not mapped —</option>
                              {rawHeaders.map(h => (
                                <option key={h} value={h}>{h}</option>
                              ))}
                            </select>
                          </div>
                        )
                      })}
                    </div>

                    {missingRequired.length > 0 && (
                      <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-300">
                          Missing required: {missingRequired.map(f => FIELD_LABELS[f]).join(', ')}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Step 3: Preview */}
                {step === 'preview' && (
                  <div className="space-y-4">
                    <p className="text-xs text-slate-400">{rawRows.length} row{rawRows.length !== 1 ? 's' : ''} found. Showing first {Math.min(5, rawRows.length)}:</p>

                    <div className="overflow-x-auto rounded-lg border border-white/8">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-white/8 bg-white/3">
                            {REQUIRED_FIELDS.map(f => (
                              <th key={f} className="text-left px-3 py-2 text-slate-500 font-medium">{FIELD_LABELS[f]}</th>
                            ))}
                            <th className="text-left px-3 py-2 text-slate-500 font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {previewRows.map((row, i) => (
                            <tr key={i} className="border-b border-white/5">
                              {REQUIRED_FIELDS.map(f => (
                                <td key={f} className="px-3 py-2 text-slate-300 max-w-[150px] truncate">
                                  {String(row[f] ?? '—')}
                                </td>
                              ))}
                              <td className="px-3 py-2 text-slate-300">{String(row.status ?? 'active')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {rawRows.length > 5 && (
                      <p className="text-[10px] text-slate-600 text-center">
                        ...and {rawRows.length - 5} more row{rawRows.length - 5 !== 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                )}

                {/* Step 4: Importing */}
                {step === 'importing' && (
                  <div className="flex flex-col items-center py-8 gap-3">
                    <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-slate-300">Importing {rawRows.length} placement{rawRows.length !== 1 ? 's' : ''}...</p>
                  </div>
                )}

                {/* Step 5: Done */}
                {step === 'done' && result && (
                  <div className="space-y-4">
                    <div className="flex flex-col items-center py-4 gap-2">
                      <CheckCircle2 className="w-10 h-10 text-green-400" />
                      <p className="text-sm font-semibold text-white">
                        {result.imported} placement{result.imported !== 1 ? 's' : ''} imported
                      </p>
                      {result.skipped > 0 && (
                        <p className="text-xs text-slate-400">
                          {result.skipped} row{result.skipped !== 1 ? 's' : ''} skipped
                        </p>
                      )}
                    </div>

                    {result.errors.length > 0 && (
                      <div>
                        <button
                          onClick={() => setShowErrors(v => !v)}
                          className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-300 transition-colors"
                        >
                          {showErrors ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          {showErrors ? 'Hide' : 'Show'} skipped rows
                        </button>
                        {showErrors && (
                          <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-white/8 divide-y divide-white/5">
                            {result.errors.map((e, i) => (
                              <div key={i} className="px-3 py-1.5 flex justify-between text-xs">
                                <span className="text-slate-500">Row {e.row}</span>
                                <span className="text-red-400">{e.reason}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-white/8 flex justify-end gap-2">
                {step === 'map' && (
                  <>
                    <button onClick={() => setStep('upload')} className="py-2 px-4 rounded-xl text-sm text-slate-400 border border-white/10 hover:bg-white/5 transition-colors">
                      Back
                    </button>
                    <button
                      onClick={() => setStep('preview')}
                      disabled={missingRequired.length > 0}
                      className="py-2 px-4 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      Next: Preview
                    </button>
                  </>
                )}
                {step === 'preview' && (
                  <>
                    <button onClick={() => setStep('map')} className="py-2 px-4 rounded-xl text-sm text-slate-400 border border-white/10 hover:bg-white/5 transition-colors">
                      Back
                    </button>
                    <button
                      onClick={handleImport}
                      className="py-2 px-4 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 transition-all"
                    >
                      Confirm Import ({rawRows.length} row{rawRows.length !== 1 ? 's' : ''})
                    </button>
                  </>
                )}
                {step === 'done' && (
                  <button onClick={handleClose} className="py-2 px-4 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 transition-all">
                    Done
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
