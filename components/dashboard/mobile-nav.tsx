'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, FileSearch, FileText, Search, Trophy, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

const TAB_ITEMS = [
  { label: 'Home',    href: '/dashboard',         icon: LayoutDashboard },
  { label: 'Score',   href: '/dashboard/scorer',  icon: FileSearch      },
  { label: 'Summary', href: '/dashboard/summary', icon: FileText        },
  { label: 'Boolean', href: '/dashboard/boolean', icon: Search          },
  { label: 'History', href: '/dashboard/history', icon: Clock           },
]

export function MobileNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-[#1A1D2E]/95 backdrop-blur-md border-t border-white/8">
      <div className="flex items-center justify-around px-2 py-2 safe-area-bottom">
        {TAB_ITEMS.map(({ label, href, icon: Icon }) => {
          const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all duration-150',
                isActive
                  ? 'text-indigo-400'
                  : 'text-slate-500 hover:text-slate-300'
              )}
            >
              <Icon className={cn('w-5 h-5', isActive && 'drop-shadow-[0_0_6px_rgba(99,102,241,0.6)]')} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
