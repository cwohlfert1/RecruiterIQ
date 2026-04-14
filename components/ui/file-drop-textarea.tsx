'use client'

import { useState, useRef, useCallback, useId } from 'react'
import { Paperclip, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// ─── Constants ──────────────────────────────────────────────────────────────

const ACCEPTED_TYPES = {
  'application/pdf':                                                        'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'text/plain':                                                             'txt',
} as const

const MAX_FILE_BYTES = 5 * 1024 * 1024 // 5 MB

// ─── Parsers ────────────────────────────────────────────────────────────────

async function parseTxt(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.readAsText(file)
  })
}

async function parsePdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()

  // Dynamic import to avoid SSR issues
  // Use unpkg CDN which serves directly from npm — guaranteed to have any published version
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`

  const pdf   = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const pages: string[] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page    = await pdf.getPage(i)
    const content = await page.getTextContent()
    const text    = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
    pages.push(text)
  }

  return pages.join('\n\n').replace(/\s{3,}/g, '  ').trim()
}

async function parseDocx(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const mammoth     = await import('mammoth')
  const result      = await mammoth.extractRawText({ arrayBuffer })
  return result.value.trim()
}

export async function parseFile(file: File): Promise<string> {
  if (file.type === 'application/pdf')                                                          return parsePdf(file)
  if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return parseDocx(file)
  return parseTxt(file)
}

// ─── Props ──────────────────────────────────────────────────────────────────

export interface FileDropTextareaProps {
  value:        string
  onChange:     (value: string) => void
  onFile?:      (file: File | null) => void
  placeholder?: string
  maxWords?:    number
  label?:       string
  required?:    boolean
  className?:   string
  minHeight?:   string
  id?:          string
  rows?:        number
  error?:       string
}

// ─── Component ──────────────────────────────────────────────────────────────

export function FileDropTextarea({
  value,
  onChange,
  onFile,
  placeholder = 'Type or paste text here, or drag and drop a PDF, DOCX, or TXT file…',
  maxWords,
  label,
  required,
  className,
  minHeight = '200px',
  id: externalId,
  rows,
  error,
}: FileDropTextareaProps) {
  const generatedId = useId()
  const inputId     = externalId ?? generatedId

  const [dragging,    setDragging]    = useState(false)
  const [parsing,     setParsing]     = useState(false)
  const [fileName,    setFileName]    = useState<string | null>(null)
  const dragCount                     = useRef(0)
  const fileInputRef                  = useRef<HTMLInputElement>(null)

  // ── Drag handlers ────────────────────────────────────────────────────────

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCount.current += 1
    if (dragCount.current === 1) setDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCount.current -= 1
    if (dragCount.current === 0) setDragging(false)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  // ── File processing ──────────────────────────────────────────────────────

  const processFile = useCallback(async (file: File) => {
    if (file.size > MAX_FILE_BYTES) {
      toast.error('File is too large. Maximum size is 5 MB.')
      return
    }

    const isAccepted = Object.keys(ACCEPTED_TYPES).includes(file.type) ||
      file.name.endsWith('.docx') ||
      file.name.endsWith('.pdf') ||
      file.name.endsWith('.txt')

    if (!isAccepted) {
      toast.error('Unsupported file type. Please upload a PDF, DOCX, or TXT file.')
      return
    }

    setParsing(true)
    try {
      const text = await parseFile(file)
      if (!text.trim()) {
        toast.error('No text could be extracted from the file.')
        return
      }
      onChange(text)
      setFileName(file.name)
      onFile?.(file)
    } catch (err) {
      console.error('[parsePdf] error:', err)
      toast.error('Failed to read file. Please try copy-pasting the text instead.')
    } finally {
      setParsing(false)
    }
  }, [onChange])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCount.current = 0
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [processFile])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    // Reset so same file can be re-selected
    e.target.value = ''
  }, [processFile])

  const handleClearFile = useCallback(() => {
    setFileName(null)
    onChange('')
    onFile?.(null)
  }, [onChange, onFile])

  // ── Render ───────────────────────────────────────────────────────────────

  const isEmpty = !value.trim()

  return (
    <div className={cn('relative', className)}>
      {/* Label row */}
      {(label || fileName) && (
        <div className="flex items-center justify-between mb-1.5">
          {label && (
            <label htmlFor={inputId} className="text-sm font-medium text-slate-300">
              {label}
              {required && <span className="text-red-400 ml-0.5">*</span>}
            </label>
          )}

          {/* Filename chip */}
          {fileName && !parsing && (
            <span className="flex items-center gap-1 text-xs text-indigo-300 bg-indigo-500/15 border border-indigo-500/25 rounded-full px-2 py-0.5 max-w-[200px]">
              <Paperclip className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{fileName}</span>
              <button
                type="button"
                onClick={handleClearFile}
                className="flex-shrink-0 hover:text-white transition-colors ml-0.5"
                aria-label="Remove file"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
        </div>
      )}

      {/* Textarea wrapper */}
      <div
        className={cn(
          'relative rounded-xl transition-all duration-150',
          dragging && 'ring-2 ring-indigo-500/60',
        )}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* Upload button (top-right corner of textarea) */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={parsing}
          className={cn(
            'absolute top-2 right-2 z-10 flex items-center gap-1.5 px-2 py-1 rounded-lg',
            'text-xs text-slate-400 border border-white/10 bg-white/5',
            'hover:text-slate-200 hover:bg-white/10 hover:border-white/20 transition-all duration-150',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          )}
          aria-label="Upload file"
          title="Upload PDF, DOCX, or TXT"
        >
          {parsing ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Reading…</span>
            </>
          ) : (
            <>
              <Paperclip className="w-3 h-3" />
              <span>Upload File</span>
            </>
          )}
        </button>

        {/* Textarea */}
        <textarea
          id={inputId}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          disabled={parsing}
          className={cn(
            'w-full resize-none rounded-xl bg-white/5 border pr-28 px-4 py-3',
            'text-sm text-slate-200 placeholder:text-slate-600',
            'focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-colors',
            isEmpty ? 'border-dashed border-white/20' : 'border-white/10',
            error ? 'border-red-500/60' : '',
            dragging ? 'border-indigo-500/50 border-solid' : '',
            parsing ? 'opacity-60 cursor-not-allowed' : '',
          )}
          style={{ minHeight }}
        />

        {/* Drag overlay */}
        {dragging && (
          <div className="absolute inset-0 rounded-xl bg-indigo-500/10 border-2 border-indigo-500/60 border-dashed flex items-center justify-center pointer-events-none z-20">
            <div className="flex flex-col items-center gap-2">
              <Paperclip className="w-6 h-6 text-indigo-400" />
              <p className="text-sm font-medium text-indigo-300">Drop file here</p>
              <p className="text-xs text-indigo-400/70">PDF, DOCX, or TXT</p>
            </div>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
        onChange={handleFileInput}
        className="hidden"
        aria-hidden="true"
      />
    </div>
  )
}
