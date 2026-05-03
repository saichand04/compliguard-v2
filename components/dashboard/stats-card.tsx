import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface StatsCardProps {
  label: string
  value: string | number
  icon?: LucideIcon
  trend?: { value: number; label: string }
  colorClass?: string
  className?: string
}

export function StatsCard({ label, value, icon: Icon, trend, colorClass = 'text-blue-600', className }: StatsCardProps) {
  return (
    <div className={cn('bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5', className)}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
          <p className={cn('text-3xl font-bold mt-1', colorClass)}>{value}</p>
          {trend && (
            <p className={cn('text-xs mt-1', trend.value >= 0 ? 'text-green-600' : 'text-red-600')}>
              {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}% {trend.label}
            </p>
          )}
        </div>
        {Icon && (
          <div className={cn('p-2 rounded-lg bg-slate-50 dark:bg-slate-700', colorClass)}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
    </div>
  )
}
