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
    default: 'RecruiterIQ — AI Toolkit for Recruiters',
    template: '%s | RecruiterIQ',
  },
  description: 'Score resumes, generate client summaries, build Boolean strings, and stack rank candidates — powered by AI.',
  keywords: ['recruiter', 'AI', 'resume scorer', 'boolean search', 'recruiting tools'],
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
