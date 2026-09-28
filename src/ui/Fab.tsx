import type { ReactNode } from 'react'

/** M3 extended FAB, above the navigation bar. */
export function Fab({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <div className="fixed fab-bottom app-right z-20">
      <button
        onClick={onClick}
        className="m-press h-14 pl-4 pr-5 rounded-m-lg bg-m-primary-container text-m-on-primary-container elev-3 font-semibold text-base inline-flex items-center gap-2"
      >
        {icon}
        {label}
      </button>
    </div>
  )
}
