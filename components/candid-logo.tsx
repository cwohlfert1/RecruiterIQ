// Candid.ai logo component — inline SVG, no external files required

interface Props {
  variant?: 'dark' | 'light' | 'icon'
  className?: string
}

export function CandidLogo({ variant = 'dark', className = 'h-9 w-auto' }: Props) {
  if (variant === 'icon') {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 80 80"
        fill="none"
        className={className}
        aria-label="Candid.ai"
      >
        <polygon points="40,2 78,22 78,58 40,78 2,58 2,22"
          fill="none" stroke="#7c3aed" strokeWidth="1" strokeOpacity="0.3"/>
        <polygon points="40,6 74,24 74,56 40,74 6,56 6,24"
          fill="#0d0020" stroke="#7c3aed" strokeWidth="2"/>
        <polygon points="40,12 68,28 68,52 40,68 12,52 12,28"
          fill="none" stroke="#6d28d9" strokeWidth="0.8" strokeOpacity="0.35"/>
        <circle cx="40" cy="32" r="12" fill="#7c3aed"/>
        <circle cx="37" cy="29" r="4" fill="#9333ea" fillOpacity="0.45"/>
        <path d="M 12 78 Q 12 54 40 54 Q 68 54 68 78" fill="#5b21b6"/>
        <path d="M 12 78 Q 12 60 40 57 Q 68 60 68 78" fill="#6d28d9" fillOpacity="0.35"/>
        <circle cx="62" cy="24" r="12" fill="#0d0020" stroke="#7c3aed" strokeWidth="1.6"/>
        <circle cx="62" cy="24" r="10" fill="#7c3aed"/>
        <circle cx="62" cy="24" r="10" fill="#a855f7" fillOpacity="0.5"/>
        <polyline points="56,24 60,28 69,18"
          fill="none" stroke="white" strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    )
  }

  const textFill = variant === 'light' ? '#0d0020' : '#ffffff'

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 260 80"
      fill="none"
      className={className}
      aria-label="Candid.ai"
    >
      <g>
        <polygon points="32,2 62,19 62,53 32,70 2,53 2,19"
          fill="none" stroke="#7c3aed" strokeWidth="0.8" strokeOpacity="0.3"/>
        <polygon points="32,6 58,21 58,51 32,66 6,51 6,21"
          fill="#0d0020" stroke="#7c3aed" strokeWidth="1.8"/>
        <polygon points="32,12 52,23 52,49 32,60 12,49 12,23"
          fill="none" stroke="#6d28d9" strokeWidth="0.6" strokeOpacity="0.35"/>
        <circle cx="32" cy="28" r="10" fill="#7c3aed"/>
        <circle cx="29" cy="25" r="3" fill="#9333ea" fillOpacity="0.45"/>
        <path d="M 10 68 Q 10 46 32 46 Q 54 46 54 68" fill="#5b21b6"/>
        <path d="M 10 68 Q 10 52 32 49 Q 54 52 54 68" fill="#6d28d9" fillOpacity="0.35"/>
        <circle cx="50" cy="22" r="10" fill="#0d0020" stroke="#7c3aed" strokeWidth="1.4"/>
        <circle cx="50" cy="22" r="8.5" fill="#7c3aed"/>
        <circle cx="50" cy="22" r="8.5" fill="#a855f7" fillOpacity="0.5"/>
        <polyline points="45,22 48.5,25.5 56,17"
          fill="none" stroke="white" strokeWidth="2.2"
          strokeLinecap="round" strokeLinejoin="round"/>
      </g>
      <text
        x="76" y="48"
        fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        fontSize="34" fontWeight="500"
        fill={textFill}
      >
        candid<tspan fill="#a855f7">.ai</tspan>
      </text>
    </svg>
  )
}
