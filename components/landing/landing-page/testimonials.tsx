import { cn } from '@/lib/utils'
import { Reveal } from './reveal'

const TESTIMONIALS = [
  {
    initials: 'SM',
    color:    'bg-indigo-500/25 text-indigo-300',
    border:   'from-indigo-500/40 to-indigo-500/0',
    name:     'Sarah M.',
    title:    'Senior Recruiter',
    agency:   'Meridian Talent Group',
    quote:    "I was doing 45 minutes of pre-screening every morning before I could even get to the phones. Now I do 10 resumes in under 20 minutes and I know exactly who to call first. My submit-to-interview ratio went from around 40% to closer to 65%.",
  },
  {
    initials: 'JT',
    color:    'bg-violet-500/25 text-violet-300',
    border:   'from-violet-500/40 to-violet-500/0',
    name:     'James T.',
    title:    'Account Manager',
    agency:   'Caliber Search Partners',
    quote:    "My clients started asking how I put together such clean write-ups. I didn't change anything — I just started using the summary generator. It writes the bullets they actually want to see, not the ones I thought they wanted.",
  },
  {
    initials: 'DA',
    color:    'bg-blue-500/25 text-blue-300',
    border:   'from-blue-500/40 to-blue-500/0',
    name:     'Derek A.',
    title:    'Sourcing Specialist',
    agency:   'Apex Staffing',
    quote:    "The Boolean tool alone paid for itself the first week. Rebuilt a string for a tough SR DevOps role we'd been spinning on for two months. Got 15 new qualified candidates the same day. My manager thought I'd found a secret database.",
  },
]

export function TestimonialsSection() {
  return (
    <section className="py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <Reveal className="text-center mb-14">
          <h2 className="text-3xl font-bold text-white">What recruiters say</h2>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {TESTIMONIALS.map((t, i) => (
            <Reveal key={t.name} delay={i * 0.1}>
              <div className="rounded-2xl p-px h-full bg-white/[0.06] hover:bg-gradient-to-b hover:from-white/10 hover:to-transparent transition-all duration-300">
                <div className="bg-[#12141F] rounded-[15px] p-6 h-full flex flex-col gap-5 relative overflow-hidden">
                  <div className={cn('absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b', t.border)} />
                  <p className="text-sm text-slate-300 leading-relaxed flex-1">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  <div className="flex items-center gap-3">
                    <div className={cn('w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0', t.color)}>
                      {t.initials}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{t.name}</p>
                      <p className="text-xs text-slate-500">{t.title}, {t.agency}</p>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
