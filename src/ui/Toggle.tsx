import type { ReactNode } from 'react'

/** M3 switch in a full-width row: the whole row is the touch target. */
export function SwitchRow({ label, hint, checked, onChange }: { label: ReactNode; hint?: ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="w-full flex items-center gap-3 min-h-[3.5rem] py-2 text-left"
    >
      <div className="flex-1 min-w-0">
        <div className="text-base font-medium">{label}</div>
        {hint && <div className="text-sm text-m-on-surface-variant leading-snug">{hint}</div>}
      </div>
      <span
        aria-hidden="true"
        className={`relative w-[3.25rem] h-8 rounded-full flex-shrink-0 transition-colors duration-200 border-2 ${checked ? 'bg-m-primary border-m-primary' : 'bg-m-surface-container-highest border-m-outline'}`}
      >
        <span
          className={`absolute top-1/2 -translate-y-1/2 rounded-full transition-all duration-300 ease-spring ${checked ? 'left-[1.375rem] w-6 h-6 bg-m-on-primary' : 'left-1 w-4 h-4 bg-m-outline'}`}
        />
      </span>
    </button>
  )
}

/** A tickbox in a full-width row. */
export function CheckRow({ label, checked, onChange }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="w-full flex items-center gap-3 min-h-[3.5rem] py-2 text-left"
    >
      <span
        aria-hidden="true"
        className={`w-6 h-6 rounded-m-xs flex items-center justify-center flex-shrink-0 border-2 text-sm font-bold ${checked ? 'bg-m-primary border-m-primary text-m-on-primary' : 'border-m-outline'}`}
      >
        {checked ? '✓' : ''}
      </span>
      <span className="flex-1 text-base font-medium">{label}</span>
    </button>
  )
}

/** Filter-chip style checkbox, for picking several from a short list. */
export function CheckChip({ label, checked, onChange }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`m-press h-10 px-4 rounded-m-sm text-sm font-semibold border ${checked ? 'bg-m-secondary-container text-m-on-secondary-container border-transparent' : 'border-m-outline text-m-on-surface-variant'}`}
    >
      {checked ? '✓ ' : ''}{label}
    </button>
  )
}
