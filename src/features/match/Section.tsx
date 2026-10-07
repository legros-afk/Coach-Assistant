import { PURPLE, INK } from './liveMatchUtils'

export function Section({
  title, count, subtitle, hint, children,
}: { title: string; count: number; subtitle: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2 px-1">
        <div className="flex items-baseline gap-2">
          <h2 className="text-xl font-bold" style={{ color: INK }}>{title}</h2>
          <span className="mono text-sm opacity-50">({count})</span>
        </div>
        <span
          className="text-xs font-semibold"
          style={{ color: hint ? PURPLE : 'var(--m-on-surface-variant)' }}
        >
          {hint ?? subtitle}
        </span>
      </div>
      {children}
    </div>
  )
}
