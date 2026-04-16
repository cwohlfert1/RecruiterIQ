import { AlertTriangle, ClipboardCopy, Eye, Keyboard, ShieldCheck, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Assessment, ProctoringEvent } from '@/types/database'
import { SeverityDot } from './atoms'

interface Props {
  assessment: Assessment
  events:     ProctoringEvent[]
}

export function ProctoringDetails({ assessment, events }: Props) {
  const proctoring = assessment.proctoring_config as Record<string, boolean | number>

  const tabSwitches    = events.filter(e => e.event_type === 'tab_switch')
  const pastes         = events.filter(e => e.event_type === 'paste_detected')
  const gazeOff        = events.filter(e => e.event_type === 'gaze_off_screen')
  const keystroke      = events.filter(e => e.event_type === 'keystroke_anomaly')
  const presencePassed = events.filter(e => e.event_type === 'presence_challenge_passed')
  const presenceFailed = events.filter(e => e.event_type === 'presence_challenge_failed')
  const automatedInput = events.filter(e => e.event_type === 'automated_input_detected')
  const codeNoTyping   = events.filter(e => e.event_type === 'code_without_typing')

  return (
    <div className="space-y-4">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Proctoring Details</h2>

      {proctoring.tab_switching && (
        <div className="glass-card rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-semibold text-white">Tab Switching</span>
            <span className="ml-auto text-xs text-slate-500">{tabSwitches.length} events</span>
          </div>
          {tabSwitches.length === 0 ? (
            <p className="text-xs text-slate-500">No tab switches detected.</p>
          ) : (
            <div className="space-y-1.5">
              {tabSwitches.map(e => {
                const payload = e.payload_json as Record<string, unknown>
                const ms = typeof payload.duration_away_ms === 'number' ? payload.duration_away_ms : 0
                const suspicious = ms > 15000
                return (
                  <div key={e.id} className="flex items-center gap-3 text-xs">
                    <SeverityDot severity={e.severity} />
                    <span className="text-slate-400">{new Date(e.timestamp).toLocaleTimeString()}</span>
                    <span className={cn(suspicious ? 'text-red-400' : 'text-slate-300')}>
                      {(ms / 1000).toFixed(1)}s away{suspicious && ' ⚠ Suspicious'}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {proctoring.paste_detection && (
        <div className="glass-card rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <ClipboardCopy className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-semibold text-white">Paste Detection</span>
            <span className="ml-auto text-xs text-slate-500">{pastes.length} events</span>
          </div>
          {pastes.length === 0 ? (
            <p className="text-xs text-slate-500">No paste events detected.</p>
          ) : (
            <div className="space-y-1.5">
              {pastes.map(e => {
                const payload = e.payload_json as Record<string, unknown>
                const chars = typeof payload.char_count === 'number' ? payload.char_count : 0
                const preview = typeof payload.content_preview === 'string' ? payload.content_preview : ''
                return (
                  <div key={e.id} className="text-xs space-y-0.5">
                    <div className="flex items-center gap-3">
                      <SeverityDot severity={e.severity} />
                      <span className="text-slate-400">{new Date(e.timestamp).toLocaleTimeString()}</span>
                      <span className={cn(chars > 500 ? 'text-red-400' : 'text-slate-300')}>
                        {chars} chars{chars > 500 && ' ⚠ High risk'}
                      </span>
                    </div>
                    {preview && <p className="ml-6 text-slate-500 font-mono truncate">&ldquo;{preview}&rdquo;</p>}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {proctoring.keystroke_dynamics && (
        <div className="glass-card rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-semibold text-white">Keystroke Dynamics</span>
            <span className="ml-auto text-xs text-slate-500">{keystroke.length} anomalies</span>
          </div>
          {keystroke.length === 0 ? (
            <p className="text-xs text-slate-500">No significant rhythm anomalies detected.</p>
          ) : (
            <div className="space-y-1.5">
              {keystroke.map(e => {
                const payload = e.payload_json as Record<string, unknown>
                return (
                  <div key={e.id} className="flex items-center gap-3 text-xs">
                    <SeverityDot severity={e.severity} />
                    <span className="text-slate-400">{new Date(e.timestamp).toLocaleTimeString()}</span>
                    <span className="text-slate-300">
                      Baseline {String(payload.baseline_iki_ms ?? '?')}ms → Current {String(payload.current_iki_ms ?? '?')}ms
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {proctoring.presence_challenges && (
        <div className="glass-card rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-semibold text-white">Presence Challenges</span>
            <span className="ml-auto text-xs text-slate-500">
              {presencePassed.length}/{presencePassed.length + presenceFailed.length} passed
            </span>
          </div>
          {presencePassed.length + presenceFailed.length === 0 ? (
            <p className="text-xs text-slate-500">No presence challenges recorded.</p>
          ) : (
            <div className="space-y-1.5">
              {[...presencePassed, ...presenceFailed].sort((a, b) =>
                new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
              ).map(e => {
                const passed  = e.event_type === 'presence_challenge_passed'
                const payload = e.payload_json as Record<string, unknown>
                return (
                  <div key={e.id} className="flex items-center gap-3 text-xs">
                    <span className={cn('text-lg', passed ? 'text-green-400' : 'text-red-400')}>{passed ? '✓' : '✗'}</span>
                    <span className="text-slate-400">{new Date(e.timestamp).toLocaleTimeString()}</span>
                    <span className="text-slate-300 font-mono">&ldquo;{String(payload.word ?? '')}&rdquo;</span>
                    {passed && <span className="text-slate-500">{String(payload.response_time_ms ?? '')}ms</span>}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {proctoring.eye_tracking && (
        <div className="glass-card rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-semibold text-white">Eye Tracking</span>
            <span className="ml-auto text-xs text-slate-500">{gazeOff.length} gaze-off events</span>
          </div>
          {gazeOff.length === 0 ? (
            <p className="text-xs text-slate-500">No gaze-off events recorded.</p>
          ) : (
            <div className="space-y-1.5">
              {gazeOff.map(e => {
                const payload = e.payload_json as Record<string, unknown>
                const ms = typeof payload.duration_ms === 'number' ? payload.duration_ms : 0
                return (
                  <div key={e.id} className="flex items-center gap-3 text-xs">
                    <SeverityDot severity={e.severity} />
                    <span className="text-slate-400">{new Date(e.timestamp).toLocaleTimeString()}</span>
                    <span className="text-slate-300">{(ms / 1000).toFixed(1)}s off screen</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {automatedInput.length > 0 && (
        <div className="glass-card rounded-2xl p-5 space-y-3 border border-red-500/20">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-red-400" />
            <span className="text-sm font-semibold text-red-300">Superhuman Typing Speed Detected</span>
            <span className="ml-auto text-xs text-red-400/60">{automatedInput.length} event{automatedInput.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="space-y-2">
            {automatedInput.map(e => {
              const payload = e.payload_json as Record<string, unknown>
              const avg = typeof payload.avgIntervalMs === 'number' ? payload.avgIntervalMs : null
              return (
                <div key={e.id} className="text-xs space-y-1">
                  <div className="flex items-center gap-3">
                    <SeverityDot severity="high" />
                    <span className="text-slate-400">{new Date(e.timestamp).toLocaleTimeString()}</span>
                    {avg !== null && <span className="text-red-300 font-medium">{avg}ms avg between keystrokes</span>}
                  </div>
                  <p className="ml-5 text-slate-500 leading-relaxed">
                    Code entered at {avg !== null ? `${avg}ms` : 'superhuman'} average between keystrokes — human maximum is ~120ms.
                    Possible AI completion tool, clipboard macro, or remote operator.
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {codeNoTyping.length > 0 && (
        <div className="glass-card rounded-2xl p-5 space-y-3 border border-red-500/20">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="text-sm font-semibold text-red-300">Code Appeared Without Keyboard Activity</span>
            <span className="ml-auto text-xs text-red-400/60">{codeNoTyping.length} event{codeNoTyping.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="space-y-2">
            {codeNoTyping.map(e => {
              const payload = e.payload_json as Record<string, unknown>
              const chars = typeof payload.charsAdded === 'number' ? payload.charsAdded : null
              const keys  = typeof payload.keystrokesDetected === 'number' ? payload.keystrokesDetected : null
              return (
                <div key={e.id} className="text-xs space-y-1">
                  <div className="flex items-center gap-3">
                    <SeverityDot severity="high" />
                    <span className="text-slate-400">{new Date(e.timestamp).toLocaleTimeString()}</span>
                    {chars !== null && keys !== null && (
                      <span className="text-red-300 font-medium">{chars} chars, {keys} keystroke{keys !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                  <p className="ml-5 text-slate-500 leading-relaxed">
                    {chars} characters appeared with only {keys} keystroke{keys !== 1 ? 's' : ''} detected.
                    Consistent with pasting, code injection, or a remote operator typing on a different device.
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
