'use client'

import { cn } from '@/lib/utils'

interface CortexOrbProps {
  size?: number
  className?: string
  active?: boolean
}

/**
 * Animated color orb for Cortex AI trigger.
 * Uses CSS conic gradients + @property animation.
 * Indigo/violet palette matching Candid.ai dark theme.
 */
export function CortexOrb({ size = 20, className, active }: CortexOrbProps) {
  const dim = `${size}px`

  return (
    <div
      className={cn('cortex-orb flex-shrink-0', active && 'cortex-orb-active', className)}
      style={{
        width: dim,
        height: dim,
      }}
    >
      <style jsx>{`
        @property --orb-angle {
          syntax: "<angle>";
          inherits: false;
          initial-value: 0deg;
        }

        .cortex-orb {
          display: grid;
          grid-template-areas: "stack";
          overflow: hidden;
          border-radius: 50%;
          position: relative;
        }

        .cortex-orb::before {
          content: "";
          display: block;
          grid-area: stack;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background:
            conic-gradient(from calc(var(--orb-angle) * 2) at 30% 70%, #8B5CF6, transparent 25% 75%, #8B5CF6),
            conic-gradient(from calc(var(--orb-angle) * -3) at 70% 30%, #6366F1, transparent 30% 70%, #6366F1),
            conic-gradient(from calc(var(--orb-angle) * 2) at 50% 50%, #A855F7, transparent 20% 80%, #A855F7),
            radial-gradient(circle at center, #1e1b4b 0%, #312e81 50%, #1e1b4b 100%);
          filter: blur(1.5px) contrast(1.4);
          animation: orb-spin 8s linear infinite;
        }

        .cortex-orb-active::before {
          animation: orb-spin 4s linear infinite;
          filter: blur(1px) contrast(1.6) brightness(1.2);
        }

        @keyframes orb-spin {
          to { --orb-angle: 360deg; }
        }

        @media (prefers-reduced-motion: reduce) {
          .cortex-orb::before { animation: none; }
        }
      `}</style>
    </div>
  )
}
