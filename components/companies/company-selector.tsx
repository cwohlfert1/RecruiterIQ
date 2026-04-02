'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Plus, Building2, X, Loader2, Check } from 'lucide-react'
import Image from 'next/image'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────

export interface Company {
  id:        string
  name:      string
  website:   string | null
  logo_url:  string | null
  industry:  string | null
}

interface CompanySelectorProps {
  value:       string          // client_name text shown
  companyId:   string | null   // selected company.id (null if free text / new)
  onChange:    (value: string, companyId: string | null, logoUrl: string | null) => void
  error?:      string | null
  placeholder?: string
}

// ─── Company Logo / Initials ──────────────────────────────

function CompanyLogo({ name, logoUrl, size = 28 }: { name: string; logoUrl: string | null; size?: number }) {
  const [imgError, setImgError] = useState(false)

  if (logoUrl && !imgError) {
    return (
      <Image
        src={logoUrl}
        alt={name}
        width={size}
        height={size}
        style={{
          width:        size,
          height:       size,
          objectFit:    'contain',
          background:   'white',
          borderRadius: 4,
          padding:      2,
          flexShrink:   0,
        }}
        onError={() => setImgError(true)}
        unoptimized
      />
    )
  }

  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('')

  return (
    <div
      style={{ width: size, height: size }}
      className="rounded bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-[9px] font-bold text-indigo-300 shrink-0"
    >
      {initials || <Building2 style={{ width: size * 0.55, height: size * 0.55 }} />}
    </div>
  )
}

// ─── Create Company Mini Form ─────────────────────────────

interface CreateFormProps {
  initialName: string
  onCreated:   (company: Company) => void
  onCancel:    () => void
}

function CreateCompanyForm({ initialName, onCreated, onCancel }: CreateFormProps) {
  const [name,     setName]     = useState(initialName)
  const [website,  setWebsite]  = useState('')
  const [saving,   setSaving]   = useState(false)
  const [logoUrl,  setLogoUrl]  = useState<string | null>(null)
  const [fetching, setFetching] = useState(false)
  const logoDebounceRef         = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-fetch Clearbit logo when website changes
  useEffect(() => {
    if (logoDebounceRef.current) clearTimeout(logoDebounceRef.current)
    if (!website.trim()) { setLogoUrl(null); return }

    logoDebounceRef.current = setTimeout(async () => {
      setFetching(true)
      try {
        const res  = await fetch('/api/companies/fetch-logo', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ domain: website.trim() }),
        })
        const data = await res.json() as { logo_url: string | null }
        setLogoUrl(data.logo_url)
      } catch {
        setLogoUrl(null)
      } finally {
        setFetching(false)
      }
    }, 600)

    return () => { if (logoDebounceRef.current) clearTimeout(logoDebounceRef.current) }
  }, [website])

  async function handleSave() {
    if (!name.trim() || saving) return
    setSaving(true)
    try {
      const res = await fetch('/api/companies', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: name.trim(), website: website.trim() || undefined, logo_url: logoUrl }),
      })
      if (!res.ok) { setSaving(false); return }
      const data = await res.json() as { company: Company }
      onCreated(data.company)
    } catch {
      setSaving(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.15 }}
      className="p-3 space-y-2.5"
    >
      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">New Company</p>

      {/* Name */}
      <input
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Company name"
        autoFocus
        className="w-full rounded-lg bg-white/5 border border-white/10 px-2.5 py-1.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
      />

      {/* Website (for logo) */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={website}
          onChange={e => setWebsite(e.target.value)}
          placeholder="website.com (optional)"
          className="flex-1 rounded-lg bg-white/5 border border-white/10 px-2.5 py-1.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
        />
        <div className="w-7 h-7 shrink-0 flex items-center justify-center">
          {fetching ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />
          ) : logoUrl ? (
            <CompanyLogo name={name} logoUrl={logoUrl} size={24} />
          ) : (
            <Building2 className="w-3.5 h-3.5 text-slate-600" />
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={!name.trim() || saving}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150',
            'bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed',
          )}
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
          {saving ? 'Saving…' : 'Save Company'}
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 rounded-lg text-xs text-slate-400 border border-white/10 hover:text-slate-200 hover:border-white/20 transition-colors"
        >
          Cancel
        </button>
      </div>
    </motion.div>
  )
}

// ─── Main Component ───────────────────────────────────────

export function CompanySelector({ value, companyId, onChange, error, placeholder }: CompanySelectorProps) {
  const [open,        setOpen]        = useState(false)
  const [query,       setQuery]       = useState(value)
  const [companies,   setCompanies]   = useState<Company[]>([])
  const [loading,     setLoading]     = useState(false)
  const [showCreate,  setShowCreate]  = useState(false)
  const [selected,    setSelected]    = useState<Company | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setShowCreate(false)
        // If user typed something but didn't select, treat as free-text client name
        if (!companyId && query !== value) {
          onChange(query, null, null)
        }
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [companyId, query, value, onChange])

  // Fetch companies debounced
  const fetchCompanies = useCallback(async (q: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/companies?q=${encodeURIComponent(q)}`)
      if (res.ok) {
        const data = await res.json() as { companies: Company[] }
        setCompanies(data.companies)
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  function handleInputChange(v: string) {
    setQuery(v)
    setSelected(null)
    onChange(v, null, null)
    setOpen(true)
    setShowCreate(false)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchCompanies(v), 250)
  }

  function handleFocus() {
    setOpen(true)
    fetchCompanies(query)
  }

  function handleSelect(company: Company) {
    setSelected(company)
    setQuery(company.name)
    onChange(company.name, company.id, company.logo_url)
    setOpen(false)
    setShowCreate(false)
  }

  function handleCreated(company: Company) {
    handleSelect(company)
    // Also update companies list
    setCompanies(prev => [company, ...prev])
  }

  function handleClear() {
    setSelected(null)
    setQuery('')
    onChange('', null, null)
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Input */}
      <div className={cn(
        'flex items-center gap-2 w-full px-3 py-2.5 rounded-xl bg-white/5 border text-sm transition-colors',
        'focus-within:ring-2 focus-within:ring-indigo-500/50',
        error ? 'border-red-500/60' : 'border-white/10 hover:border-white/20',
      )}>
        {selected ? (
          <CompanyLogo name={selected.name} logoUrl={selected.logo_url} size={20} />
        ) : (
          <Search className="w-4 h-4 text-slate-500 shrink-0" />
        )}
        <input
          type="text"
          value={query}
          onChange={e => handleInputChange(e.target.value)}
          onFocus={handleFocus}
          placeholder={placeholder ?? 'Search or create a company…'}
          className="flex-1 bg-transparent text-slate-200 placeholder:text-slate-600 focus:outline-none"
        />
        {query && (
          <button onClick={handleClear} className="text-slate-500 hover:text-slate-300 transition-colors shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0,  scale: 1     }}
            exit={{    opacity: 0, y: -4, scale: 0.97  }}
            transition={{ duration: 0.12 }}
            className="absolute left-0 right-0 top-full mt-1.5 bg-[#1A1D2E] border border-white/10 rounded-xl shadow-xl z-30 overflow-hidden"
          >
            <AnimatePresence mode="wait">
              {showCreate ? (
                <CreateCompanyForm
                  key="create"
                  initialName={query}
                  onCreated={handleCreated}
                  onCancel={() => setShowCreate(false)}
                />
              ) : (
                <motion.div key="list">
                  {/* Company list */}
                  {loading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
                    </div>
                  ) : companies.length > 0 ? (
                    <div className="max-h-48 overflow-y-auto">
                      {companies.map(company => (
                        <button
                          key={company.id}
                          onClick={() => handleSelect(company)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 transition-colors text-left"
                        >
                          <CompanyLogo name={company.name} logoUrl={company.logo_url} size={22} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-slate-200 truncate">{company.name}</p>
                            {company.website && (
                              <p className="text-[10px] text-slate-500 truncate">{company.website}</p>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="px-3 py-3 text-xs text-slate-500">
                      {query ? `No companies matching "${query}"` : 'No saved companies yet'}
                    </div>
                  )}

                  {/* Create new option */}
                  <div className="border-t border-white/8">
                    <button
                      onClick={() => setShowCreate(true)}
                      className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-indigo-500/10 transition-colors text-left"
                    >
                      <Plus className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span className="text-sm text-indigo-300">
                        {query ? `Create "${query}"` : 'Create a new company'}
                      </span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
