import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from 'sonner'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const TITLE       = 'Candid.ai — AI Recruiting Platform for Agency Recruiters'
const DESCRIPTION = 'Score resumes, build Boolean strings, rank candidates, and manage pipelines — all in one place. Built for agency recruiters who move fast.'

export const metadata: Metadata = {
  title: {
    default:  TITLE,
    template: '%s | Candid.ai',
  },
  description: DESCRIPTION,
  keywords: [
    'AI recruiting platform',
    'Boolean string generator',
    'resume scorer',
    'candidate ranking',
    'agency recruiter tools',
    'CQI score',
    'recruiting software',
  ],
  metadataBase: new URL('https://candidai.app'),
  alternates: {
    canonical: 'https://candidai.app',
  },
  openGraph: {
    title:       TITLE,
    description: DESCRIPTION,
    url:         'https://candidai.app',
    siteName:    'Candid.ai',
    type:        'website',
    images: [
      {
        url:    '/og-image.png',
        width:  1200,
        height: 630,
        alt:    'Candid.ai — AI Recruiting Platform',
      },
    ],
  },
  twitter: {
    card:        'summary_large_image',
    title:       TITLE,
    description: DESCRIPTION,
    images:      ['/og-image.png'],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const verificationCode = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION

  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        {verificationCode && (
          <meta name="google-site-verification" content={verificationCode} />
        )}
      </head>
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
