import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { Reveal } from './reveal'

export function CtaSection() {
  return (
    <section className="py-24 bg-white/1">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
        <Reveal>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Your next placement is buried in a stack of resumes. Find it in seconds.
          </h2>
          <p className="text-slate-400 mb-8 text-lg">
            25 free AI calls every month. No credit card.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-base font-semibold text-white bg-gradient-brand hover-glow transition-all duration-150"
          >
            Start Free — No Credit Card Required
            <ChevronRight className="w-4 h-4" />
          </Link>
          <p className="mt-4 text-sm text-slate-600">
            Upgrade to Pro or Agency when you&apos;re ready.
          </p>
        </Reveal>
      </div>
    </section>
  )
}
