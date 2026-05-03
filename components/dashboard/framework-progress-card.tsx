import { cn } from '@/lib/utils'

interface FrameworkProgressCardProps {
  name: string
  shortName: string
  totalControls: number
  implementedControls: number
  className?: string
}

export function FrameworkProgressCard({
  name,
  shortName,
  totalControls,
  implementedControls,
  className,
}: FrameworkProgressCardProps) {
  const percent = totalControls > 0 ? Math.round((implementedControls / totalControls) * 100) : 0

  const getColor = (pct: number) => {
    if (pct >= 80) return 'bg-green-500'
    if (pct >= 50) return 'bg-blue-500'
    if (pct >= 25) return 'bg-amber-500'
    return 'bg-red-500'
  }

  return (
    <div className={cn('bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5', className)}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">{shortName}</p>
          <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[180px]">{name}</p>
        </div>
        <span className="text-lg font-bold text-slate-900 dark:text-white">{percent}%</span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', getColor(percent))}
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="flex justify-between mt-2">
        <span className="text-xs text-slate-400">{implementedControls} implemented</span>
        <span className="text-xs text-slate-400">{totalControls} total</span>
      </div>
    </div>
  )
}
