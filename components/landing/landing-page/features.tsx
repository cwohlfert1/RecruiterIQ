import { ClipboardCheck, FileSearch, FileText, FolderOpen, Search, Sparkles, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Reveal } from './reveal'

const FEATURES = [
  {
    icon:  <FileSearch className="w-5 h-5" />,
    color: 'bg-indigo-500/15 text-indigo-400',
    name:  'Resume Scorer',
    desc:  'Paste the JD and resume. Get a CQI score out of 100, weighted across five dimensions: skills match, domain experience, communication, tenure, and tool depth. Know in seconds whether it\'s worth a call.',
    badge: null,
  },
  {
    icon:  <FileText className="w-5 h-5" />,
    color: 'bg-violet-500/15 text-violet-400',
    name:  'Client Summary Generator',
    desc:  'Four client-ready bullets in under 5 seconds. Experience level, top skills, domain fit, and comp or availability. Copy, paste into your email, send.',
    badge: null,
  },
  {
    icon:  <Search className="w-5 h-5" />,
    color: 'bg-blue-500/15 text-blue-400',
    name:  'Boolean String Generator',
    desc:  'Job title, must-haves, nice-to-haves, exclusions. Two strings back — one for LinkedIn Recruiter, one for Indeed — with correct AND, OR, NOT syntax. Works on the first try.',
    badge: null,
  },
  {
    icon:  <Trophy className="w-5 h-5" />,
    color: 'bg-yellow-500/15 text-yellow-400',
    name:  'Stack Ranking',
    desc:  'Add your entire shortlist to one session. Candid.ai scores every candidate and returns a ranked leaderboard with per-candidate breakdowns. Know who to call first without reading 10 resumes side by side.',
    badge: 'Agency',
  },
  {
    icon:  <FolderOpen className="w-5 h-5" />,
    color: 'bg-emerald-500/15 text-emerald-400',
    name:  'Projects',
    desc:  'Every open role gets its own pipeline. Add candidates, auto-score them against the JD, move them from Sourced to Placed, and keep your AM submittal notes where you can actually find them.',
    badge: null,
  },
  {
    icon:  <ClipboardCheck className="w-5 h-5" />,
    color: 'bg-cyan-500/15 text-cyan-400',
    name:  'Skill Assessments',
    desc:  'Send proctored coding and written assessments straight from a candidate\'s profile. You get a Trust Score and a Skill Score back. Something to show the client besides your gut.',
    badge: 'Agency',
  },
  {
    icon:  <Sparkles className="w-5 h-5" />,
    color: 'bg-indigo-500/15 text-indigo-400',
    name:  'Cortex AI',
    desc:  'An AI co-pilot that already knows your JD, your candidates, and their scores. Ask it why someone scored low, how to position an overqualified candidate, or to fix a Boolean string that returns zero results. It lives inside the app — not a chatbot you have to context-switch to.',
    badge: 'Agency',
  },
]

export function FeaturesSection() {
  return (
    <section id="features" className="py-24 bg-white/1">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <Reveal className="text-center mb-14">
          <h2 className="text-3xl font-bold text-white">Built for the tools you actually use</h2>
          <p className="mt-3 text-slate-400 max-w-xl mx-auto">
            Every feature exists because a recruiter asked for it. Nothing here is filler.
          </p>
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {FEATURES.map((f, i) => (
            <Reveal key={f.name} delay={i * 0.08}>
              <div className="rounded-2xl p-px h-full bg-white/[0.06] hover:bg-gradient-to-br hover:from-indigo-500/30 hover:via-violet-500/10 hover:to-transparent transition-all duration-300 group">
                <div className="bg-[#12141F] rounded-[15px] p-6 h-full relative overflow-hidden">

                <div className="flex items-start gap-3 mb-3">
                  <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', f.color)}>
                    {f.icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-white">{f.name}</h3>
                      {f.badge && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
                          {f.badge}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
