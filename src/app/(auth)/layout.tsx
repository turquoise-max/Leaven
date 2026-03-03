export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-indigo-50 to-white dark:from-gray-900 dark:to-gray-800 p-4">
      {children}
    </div>
  )
}
