import { Clock, FileText, Search } from 'lucide-react'
import { Reveal } from './reveal'

const PAIN_POINTS = [
  {
    icon: <Clock className="w-5 h-5" />,
    headline: 'You read 40 resumes to send 3',
    body: "The other 37 weren't worth your time, but you had no way to know that until you read them. There's no consistent scoring system — just your gut and whatever bandwidth you have that morning.",
  },
  {
    icon: <FileText className="w-5 h-5" />,
    headline: 'Submittals that look fine until the client pushes back',
    body: "You write the candidate summary in 15 minutes, you think it covers everything, and then the client emails back asking for more context. Turns out you hit all the wrong bullets. Again.",
  },
  {
    icon: <Search className="w-5 h-5" />,
    headline: 'The same Boolean string pulling the same bad pool',
    body: "You built it six months ago for a different role. You've been tweaking it ever since. It's still pulling the same mediocre LinkedIn results and you're not sure where the string is breaking down.",
  },
]

export function ProblemSection() {
  return (
    <section className="py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <Reveal className="text-center mb-14">
          <h2 className="text-3xl font-bold text-white">
            Three things that slow every desk down
          </h2>
          <p className="mt-3 text-slate-400 max-w-xl mx-auto">
            Every agency recruiter loses hours to these. Most just accept it. You don&apos;t have to.
          </p>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PAIN_POINTS.map((p, i) => (
            <Reveal key={p.headline} delay={i * 0.1}>
              <div className="rounded-2xl p-px h-full bg-white/[0.06] hover:bg-gradient-to-br hover:from-red-500/20 hover:via-red-500/5 hover:to-transparent transition-all duration-300">
                <div className="bg-[#12141F] rounded-[15px] p-6 h-full">
                  <div className="w-10 h-10 rounded-xl bg-red-500/12 flex items-center justify-center text-red-400 mb-4">
                    {p.icon}
                  </div>
                  <h3 className="text-base font-semibold text-white mb-2">{p.headline}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{p.body}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
