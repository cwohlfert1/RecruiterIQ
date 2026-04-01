export default function AssessLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-white text-gray-900 antialiased">
      {children}
    </div>
  )
}
