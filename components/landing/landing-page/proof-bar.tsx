import { Reveal } from './reveal'

const AGENCIES = [
  'Meridian Talent Group',
  'Apex Search Partners',
  'Caliber Recruiting Group',
  'Northgate Staffing',
]

export function ProofBar() {
  return (
    <section className="border-y border-white/6 bg-white/2 py-6">
      <Reveal className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-8">
          <p className="text-xs font-medium text-slate-500 whitespace-nowrap flex-shrink-0">
            Recruiters at these firms use Candid.ai:
          </p>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-2 justify-center sm:justify-start">
            {AGENCIES.map(name => (
              <span key={name} className="text-sm font-medium text-slate-500">
                {name}
              </span>
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  )
}
