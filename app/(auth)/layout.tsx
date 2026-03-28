import { DotGridBg } from '@/components/shared/dot-grid-bg'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen flex items-center justify-center p-4">
      <DotGridBg />
      <div className="relative z-10 w-full max-w-md">
        {children}
      </div>
    </div>
  )
}
