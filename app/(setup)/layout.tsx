export default function SetupLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800">
        <div className="w-7 h-7 bg-blue-600 rounded-md flex items-center justify-center">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L4 6V12C4 16.4 7.4 20.5 12 22C16.6 20.5 20 16.4 20 12V6L12 2Z" fill="white"/>
          </svg>
        </div>
        <span className="font-semibold text-slate-900 dark:text-white">CompliGuard</span>
        <span className="text-slate-300 dark:text-slate-600 mx-1">·</span>
        <span className="text-sm text-slate-500">Setup Wizard</span>
      </div>
      <main className="max-w-2xl mx-auto py-8 px-4">
        {children}
      </main>
    </div>
  )
}
