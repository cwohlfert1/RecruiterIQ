import type { Config } from 'tailwindcss'
import { fontFamily } from 'tailwindcss/defaultTheme'

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      colors: {
        // Brand palette
        brand: {
          bg:      '#0F1117', // page background
          surface: '#1A1D2E', // sidebar, cards
          border:  'rgba(255,255,255,0.08)',
          indigo:  '#6366F1', // primary accent
          violet:  '#8B5CF6', // secondary accent
        },
        // Semantic
        success: '#22C55E',
        warning: '#EAB308',
        error:   '#EF4444',
        // shadcn-compatible overrides (dark-first)
        background:  '#0F1117',
        foreground:  '#F8FAFC',
        card: {
          DEFAULT:     '#1A1D2E',
          foreground:  '#F8FAFC',
        },
        popover: {
          DEFAULT:    '#1A1D2E',
          foreground: '#F8FAFC',
        },
        primary: {
          DEFAULT:    '#6366F1',
          foreground: '#FFFFFF',
        },
        secondary: {
          DEFAULT:    '#1A1D2E',
          foreground: '#94A3B8',
        },
        muted: {
          DEFAULT:    'rgba(255,255,255,0.05)',
          foreground: '#64748B',
        },
        accent: {
          DEFAULT:    '#6366F1',
          foreground: '#FFFFFF',
        },
        destructive: {
          DEFAULT:    '#EF4444',
          foreground: '#FFFFFF',
        },
        border:  'rgba(255,255,255,0.08)',
        input:   'rgba(255,255,255,0.06)',
        ring:    '#6366F1',
      },
      fontFamily: {
        sans: ['var(--font-inter)', ...fontFamily.sans],
      },
      borderRadius: {
        lg: '0.75rem',
        md: '0.5rem',
        sm: '0.375rem',
        xl: '1rem',
        '2xl': '1.25rem',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to:   { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to:   { height: '0' },
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 8px 0 rgba(99,102,241,0.4)' },
          '50%':       { boxShadow: '0 0 20px 4px rgba(99,102,241,0.6)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up':   'accordion-up 0.2s ease-out',
        'fade-in':        'fade-in 0.3s ease-out',
        'glow-pulse':     'glow-pulse 2s ease-in-out infinite',
      },
      backgroundImage: {
        'gradient-brand': 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
        'gradient-text':  'linear-gradient(135deg, #6366F1, #8B5CF6)',
        'dot-grid': `radial-gradient(circle, rgba(99,102,241,0.15) 1px, transparent 1px)`,
      },
      backgroundSize: {
        'dot-grid': '24px 24px',
      },
      boxShadow: {
        'glow-sm': '0 0 8px 0 rgba(99,102,241,0.35)',
        'glow':    '0 0 16px 0 rgba(99,102,241,0.45)',
        'glow-lg': '0 0 32px 4px rgba(99,102,241,0.5)',
        'glass':   '0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
