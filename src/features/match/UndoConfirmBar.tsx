interface UndoConfirmBarProps {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function UndoConfirmBar({ open, onConfirm, onCancel }: UndoConfirmBarProps) {
  if (!open) return null
  return (
    <div
      className="fixed above-live-bar app-x px-3 py-3 flex items-center justify-between z-40"
      style={{ background: 'var(--m-error)', color: 'var(--m-on-error)' }}
    >
      <span className="text-sm font-semibold">Undo last action?</span>
      <div className="flex gap-2">
        <button
          onClick={onConfirm}
          className="text-sm font-bold px-4 py-1.5 rounded-m-md bg-m-surface-container"
          style={{ color: 'var(--m-error)' }}
        >
          Undo
        </button>
        <button
          onClick={onCancel}
          className="text-sm px-3 py-1.5 opacity-80"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
