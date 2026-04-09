import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now  = new Date()
  const diff = now.getTime() - date.getTime()

  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours   = Math.floor(minutes / 60)
  const days    = Math.floor(hours / 24)

  if (seconds < 60)  return 'just now'
  if (minutes < 60)  return `${minutes}m ago`
  if (hours   < 24)  return `${hours}h ago`
  if (days    < 7)   return `${days}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function getPlanLabel(tier: 'free' | 'pro' | 'agency'): string {
  return { free: 'Free', pro: 'Pro', agency: 'Agency' }[tier]
}

export function getPlanLimit(tier: 'free' | 'pro' | 'agency'): number | null {
  return tier === 'free' ? 25 : null // null = unlimited
}

export function getScoreColor(score: number): string {
  if (score >= 80) return '#22C55E'
  if (score >= 60) return '#EAB308'
  return '#EF4444'
}

export function getScoreLabel(score: number): 'green' | 'yellow' | 'red' {
  if (score >= 80) return 'green'
  if (score >= 60) return 'yellow'
  return 'red'
}
