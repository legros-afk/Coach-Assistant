import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'

interface Props {
  title: ReactNode
  subtitle?: ReactNode
  onBack?: () => void
  /** Leading item when there's no back arrow (e.g. the club crest). */
  leading?: ReactNode
  /** Buttons at the right of the bar (use BarButton). */
  actions?: ReactNode
  /** Extra sticky row under the bar, e.g. a tab switch. */
  children?: ReactNode
  /** Use the large title that shrinks into the bar on scroll (default on). */
  large?: boolean
}

/**
 * M3 flexible top app bar in the club purple. The large title scrolls away
 * and the same title fades into the compact bar, which stays pinned.
 */
export function TopAppBar({ title, subtitle, onBack, leading, actions, children, large = true }: Props) {
  const [collapsed, setCollapsed] = useState(!large)
  const sentinel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!large || !sentinel.current) return
    const io = new IntersectionObserver(
      ([e]) => setCollapsed(!e.isIntersecting),
      { rootMargin: '-64px 0px 0px 0px', threshold: 0 },
    )
    io.observe(sentinel.current)
    return () => io.disconnect()
  }, [large])

  return (
    <>
      <header className="sticky top-0 z-30 safe-top bg-brand text-brand-on">
        <div className="h-16 px-1 flex items-center gap-1">
          {onBack ? (
            <button onClick={onBack} aria-label="Back" className="m-press w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0">
              <ArrowLeft size={24} strokeWidth={2.25} />
            </button>
          ) : leading ? (
            <div className="w-12 h-12 flex items-center justify-center flex-shrink-0">{leading}</div>
          ) : <div className="w-3" />}
          <div
            className="flex-1 min-w-0 transition-opacity duration-200"
            style={{ opacity: collapsed ? 1 : 0 }}
            aria-hidden={!collapsed}
          >
            <div className="text-lg font-semibold truncate leading-tight">{title}</div>
            {subtitle && !large && <div className="text-xs text-brand-on-variant truncate">{subtitle}</div>}
          </div>
          {actions && <div className="flex items-center gap-1.5 pr-2 flex-shrink-0">{actions}</div>}
        </div>
        {children && !large && <div className="px-4 pb-3">{children}</div>}
      </header>
      {large && (
        <div className={`bg-brand text-brand-on px-4 -mt-px ${children ? 'pb-3' : 'pb-5'}`}>
          <h1 className="text-3xl emphasized leading-tight">{title}</h1>
          {subtitle && <div className="text-sm text-brand-on-variant mt-0.5">{subtitle}</div>}
          <div ref={sentinel} className="h-px" />
        </div>
      )}
      {/* With a large title, the extra row sits under it and pins below the bar */}
      {children && large && (
        <div
          className="sticky z-20 bg-brand px-4 pb-3 -mt-px"
          style={{ top: 'calc(env(safe-area-inset-top, 0px) + 4rem)' }}
        >
          {children}
        </div>
      )}
    </>
  )
}

/** A labelled pill button for the purple bar. */
export function BarButton({ icon, label, onClick, active }: { icon?: ReactNode; label: string; onClick: () => void; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`m-press h-10 px-3.5 rounded-full text-sm font-semibold inline-flex items-center gap-1.5 ${active ? 'bg-white text-brand' : 'bg-brand-control text-brand-on'}`}
    >
      {icon}
      {label}
    </button>
  )
}
