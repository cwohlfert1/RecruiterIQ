import { Reveal } from './reveal'

const STEPS = [
  {
    n:    '01',
    head: 'Paste the job description and resume',
    body: 'No formatting required. Plain text pasted directly into the input — that\'s it. Two fields, one button.',
  },
  {
    n:    '02',
    head: 'Candid.ai scores and summarizes in seconds',
    body: 'Candid.ai runs a structured evaluation weighted across five dimensions. Score, breakdown, and summary ready in under 10 seconds.',
  },
  {
    n:    '03',
    head: 'Submit with confidence. Make the placement.',
    body: 'You know who to call. Your internal submittal is written. The Boolean string found them. Now go close.',
  },
]

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <Reveal className="text-center mb-14">
          <h2 className="text-3xl font-bold text-white">How it works</h2>
          <p className="mt-3 text-slate-400">Three steps. Less than 30 seconds.</p>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          <div className="hidden md:block absolute top-7 left-[calc(16.6%+1rem)] right-[calc(16.6%+1rem)] h-px bg-white/6" />

          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 0.12}>
              <div className="flex flex-col items-start md:items-center md:text-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center flex-shrink-0 relative z-10">
                  <span className="text-lg font-bold text-indigo-400">{s.n}</span>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white mb-2">{s.head}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{s.body}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
