import type { ReactNode } from 'react'

export interface NavItem<T extends string> { key: T; label: string; icon: ReactNode }

/** M3 navigation bar: icon in a pill indicator that springs open when active. */
export function NavBar<T extends string>({ items, active, onSelect }: { items: NavItem<T>[]; active: T | null; onSelect: (k: T) => void }) {
  return (
    <nav
      className="fixed bottom-0 app-x z-40 bg-m-surface-container flex"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {items.map(it => {
        const on = it.key === active
        return (
          <button
            key={it.key}
            onClick={() => onSelect(it.key)}
            aria-current={on ? 'page' : undefined}
            className="flex-1 pt-3 pb-4 flex flex-col items-center gap-1"
          >
            <span
              className="h-8 rounded-full flex items-center justify-center transition-all duration-300 ease-spring"
              style={{
                width: on ? '4rem' : '2.5rem',
                background: on ? 'var(--m-secondary-container)' : 'transparent',
                color: on ? 'var(--m-on-secondary-container)' : 'var(--m-on-surface-variant)',
              }}
            >
              {it.icon}
            </span>
            <span className={`text-xs ${on ? 'font-bold text-m-on-surface' : 'font-medium text-m-on-surface-variant'}`}>{it.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
