interface MatchToastProps {
  msg: string | null
  undo: boolean
  onUndo: () => void
}

export function MatchToast({ msg, undo, onUndo }: MatchToastProps) {
  if (!msg) return null
  return (
    <div
      className="fixed bottom-32 left-1/2 -translate-x-1/2 pl-4 pr-1 py-1 rounded-full text-sm shadow-lg z-50 whitespace-nowrap flex items-center gap-2"
      style={{ background: 'var(--m-inverse-surface)', color: 'var(--m-inverse-on-surface)', minHeight: 48 }}
    >
      <span className={undo ? '' : 'pr-3'}>{msg}</span>
      {undo && (
        <button
          onClick={onUndo}
          className="h-9 px-3 rounded-full text-sm font-bold active:scale-95 transition"
          style={{ color: 'var(--m-primary-container)' }}
        >
          Undo
        </button>
      )}
    </div>
  )
}
