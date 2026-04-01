import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from 'sonner'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'Candid.ai — AI Recruiting Platform',
    template: '%s | Candid.ai',
  },
  description: 'AI-powered recruiting platform for modern agencies. Score resumes, rank candidates, and verify skills — all in one place.',
  keywords: ['recruiter', 'AI', 'resume scorer', 'boolean search', 'recruiting tools', 'candid.ai'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="bg-background text-foreground antialiased">
        {children}
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#1A1D2E',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#F8FAFC',
            },
          }}
        />
      </body>
    </html>
  )
}
