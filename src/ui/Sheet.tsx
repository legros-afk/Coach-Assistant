import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface Props {
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  /** Tallest the sheet may get, as a share of the screen. */
  maxHeight?: string
}

/** M3 modal bottom sheet: drag handle, extra-large top corners, springs up. */
export function Sheet({ onClose, title, children, maxHeight = '85vh' }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end backdrop-in"
      style={{ background: 'var(--m-scrim)' }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full bg-m-surface-container-low text-m-on-surface rounded-t-m-xl sheet-in px-4 pt-2 overflow-y-auto"
        style={{ maxHeight }}
        onClick={e => e.stopPropagation()}
      >
        <div className="mx-auto mb-2 h-1 w-8 rounded-full bg-m-outline-variant" aria-hidden="true" />
        {title !== undefined && (
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="text-2xl emphasized min-w-0">{title}</div>
            <button onClick={onClose} aria-label="Close" className="m-press w-12 h-12 -mr-2 rounded-full flex items-center justify-center text-m-on-surface-variant flex-shrink-0">
              <X size={22} strokeWidth={2} />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
