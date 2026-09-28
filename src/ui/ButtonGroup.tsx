import type { ReactNode } from 'react'

export interface GroupOption<T extends string | number> {
  value: T
  label: ReactNode
  /** Classes for this option when selected (defaults to the primary colours). */
  selectedClass?: string
  ariaLabel?: string
}

interface Props<T extends string | number> {
  options: GroupOption<T>[]
  value: T | null
  onChange: (v: T) => void
  ariaLabel: string
  size?: 'sm' | 'md'
  /** Stretch to the full width, options sharing it equally. */
  full?: boolean
  /** Sits on the purple app bar rather than on a surface. */
  onBrand?: boolean
  className?: string
}

/**
 * M3 Expressive connected button group: segments with a small gap, the
 * outer ends fully rounded, and the selected segment morphing to a pill.
 */
export function ButtonGroup<T extends string | number>({
  options, value, onChange, ariaLabel, size = 'md', full, onBrand, className = '',
}: Props<T>) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={`flex gap-0.5 ${full ? 'w-full' : ''} ${className}`}>
      {options.map((o, i) => {
        const selected = o.value === value
        const first = i === 0
        const last = i === options.length - 1
        const shape = selected
          ? 'rounded-full'
          : `${first ? 'rounded-l-full' : 'rounded-l-m-sm'} ${last ? 'rounded-r-full' : 'rounded-r-m-sm'}`
        const colour = selected
          ? (o.selectedClass ?? (onBrand ? 'bg-white text-brand' : 'bg-m-primary text-m-on-primary'))
          : (onBrand ? 'bg-brand-control text-brand-on' : 'bg-m-surface-container-highest text-m-on-surface-variant')
        return (
          <button
            key={String(o.value)}
            role="radio"
            aria-checked={selected}
            aria-label={o.ariaLabel}
            onClick={() => onChange(o.value)}
            className={`m-press ${shape} ${colour} ${full ? 'flex-1' : ''} ${size === 'sm' ? 'h-10 px-3 text-sm' : 'h-12 px-4 text-sm'} font-semibold inline-flex items-center justify-center gap-1.5 min-w-0 whitespace-nowrap`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
