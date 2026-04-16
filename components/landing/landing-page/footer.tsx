import Link from 'next/link'

export function Footer() {
  return (
    <footer className="border-t border-white/6 py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-8 mb-8">
          <div>
            <p className="text-lg font-bold gradient-text mb-1">Candid.ai</p>
            <p className="text-xs text-slate-500 max-w-xs">
              AI-powered recruiting platform for modern agencies.
            </p>
          </div>

          <div className="flex flex-wrap gap-x-8 gap-y-2">
            <a href="#features" className="text-sm text-slate-400 hover:text-slate-200 transition-colors">Features</a>
            <a href="#pricing"  className="text-sm text-slate-400 hover:text-slate-200 transition-colors">Pricing</a>
            <Link href="/login"  className="text-sm text-slate-400 hover:text-slate-200 transition-colors">Login</Link>
            <Link href="/signup" className="text-sm text-slate-400 hover:text-slate-200 transition-colors">Sign Up</Link>
            <Link href="/privacy" className="text-sm text-slate-400 hover:text-slate-200 transition-colors">Privacy</Link>
            <Link href="/terms"   className="text-sm text-slate-400 hover:text-slate-200 transition-colors">Terms</Link>
          </div>
        </div>

        <div className="border-t border-white/6 pt-6">
          <p className="text-xs text-slate-600">
            &copy; 2026 Candid.ai. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
