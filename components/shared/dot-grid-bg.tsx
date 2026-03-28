export function DotGridBg() {
  return (
    <>
      {/* Base dark background */}
      <div className="fixed inset-0 bg-[#0F1117]" />
      {/* Dot grid overlay */}
      <div
        className="fixed inset-0 dot-grid-bg opacity-60"
        aria-hidden="true"
      />
      {/* Radial gradient vignette — fades dots toward edges */}
      <div
        className="fixed inset-0"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% 40%, transparent 30%, #0F1117 100%)',
        }}
        aria-hidden="true"
      />
    </>
  )
}
