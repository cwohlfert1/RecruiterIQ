'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import { CandidLogo } from '@/components/candid-logo'
import { cn } from '@/lib/utils'

export function Nav() {
  const [open,     setOpen]     = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <nav
      className={cn(
        'fixed top-0 inset-x-0 z-50 transition-all duration-300',
        scrolled
          ? 'bg-[#0F1117]/90 backdrop-blur-md border-b border-white/6'
          : 'bg-transparent',
      )}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link href="/" className="select-none">
          <CandidLogo variant="light" className="h-9 w-auto" />
        </Link>

        <div className="hidden md:flex items-center gap-7">
          <a href="#features" className="text-sm text-slate-400 hover:text-slate-200 transition-colors">Features</a>
          <a href="#pricing"  className="text-sm text-slate-400 hover:text-slate-200 transition-colors">Pricing</a>
          <Link href="/login"  className="text-sm text-slate-400 hover:text-slate-200 transition-colors">Log in</Link>
          <Link
            href="/signup"
            className="px-4 py-1.5 rounded-lg text-sm font-semibold text-white bg-gradient-brand hover-glow transition-all duration-150"
          >
            Start Free
          </Link>
        </div>

        <button onClick={() => setOpen(v => !v)} className="md:hidden text-slate-400 p-1">
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {open && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="md:hidden bg-[#0F1117] border-b border-white/8 px-4 pb-5 space-y-1"
        >
          <a href="#features" onClick={() => setOpen(false)} className="block text-sm text-slate-400 py-2.5 border-b border-white/6">Features</a>
          <a href="#pricing"  onClick={() => setOpen(false)} className="block text-sm text-slate-400 py-2.5 border-b border-white/6">Pricing</a>
          <Link href="/login"  className="block text-sm text-slate-400 py-2.5 border-b border-white/6">Log in</Link>
          <Link href="/signup" className="block w-full mt-3 py-2.5 px-4 rounded-xl text-sm font-semibold text-white text-center bg-gradient-brand">
            Start Free
          </Link>
        </motion.div>
      )}
    </nav>
  )
}
