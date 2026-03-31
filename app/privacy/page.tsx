import Link from 'next/link'

export const metadata = { title: 'Privacy Policy | RecruiterIQ' }

export default function PrivacyPage() {
  const lastUpdated = 'March 27, 2025'

  return (
    <div className="min-h-screen bg-[#0F1117] text-white">
      {/* Simple nav */}
      <nav className="border-b border-white/6 h-14 flex items-center px-6">
        <Link href="/" className="text-base font-bold gradient-text">
          RecruiterIQ
        </Link>
      </nav>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-16">
        <h1 className="text-3xl font-bold text-white mb-2">Privacy Policy</h1>
        <p className="text-sm text-slate-500 mb-10">Last updated: {lastUpdated}</p>

        <div className="space-y-8 text-sm text-slate-400 leading-relaxed">

          <section>
            <h2 className="text-base font-semibold text-white mb-3">1. What we collect</h2>
            <p>When you create an account, we collect your email address and password (stored as a secure hash via Supabase Auth). When you use AI features, we temporarily process the text you paste (resumes, job descriptions) to generate results. That text is stored in your account history so you can retrieve it later.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">2. How we use it</h2>
            <p>We use your data to operate the service — running AI scoring, generating summaries, and storing your history. We do not sell your data or use it to train AI models. Resume and job description text you paste is sent to Anthropic's Claude API to generate results; that processing is governed by <a href="https://www.anthropic.com/legal/privacy" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 transition-colors">Anthropic's privacy policy</a>.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">3. Data storage</h2>
            <p>Your account data is stored in Supabase (hosted on AWS). Your billing information is handled entirely by Square — we never store your credit card details. Row-level security ensures your data is only accessible to your account.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">4. Cookies and tracking</h2>
            <p>We use session cookies for authentication. We do not use third-party advertising trackers or analytics beyond basic server logs.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">5. Data deletion</h2>
            <p>You can delete individual history records from the History page. To delete your account and all associated data, email us at <a href="mailto:privacy@recruiteriq.app" className="text-indigo-400 hover:text-indigo-300 transition-colors">privacy@recruiteriq.app</a> and we will process your request within 30 days.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">6. Changes to this policy</h2>
            <p>We may update this policy. If we make material changes, we will email registered users before the changes take effect.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">7. Contact</h2>
            <p>Questions? Email <a href="mailto:privacy@recruiteriq.app" className="text-indigo-400 hover:text-indigo-300 transition-colors">privacy@recruiteriq.app</a>.</p>
          </section>

        </div>

        <div className="mt-12 pt-8 border-t border-white/6">
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
            &larr; Back to RecruiterIQ
          </Link>
        </div>
      </main>
    </div>
  )
}
