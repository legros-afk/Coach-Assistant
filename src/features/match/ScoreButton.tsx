import { Plus } from 'lucide-react'

export function ScoreButton({
  label, value, primary, onClick,
}: { label: string; value: number; primary?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="tap-target flex-1 rounded-m-md flex items-center justify-center gap-1.5 font-bold active:scale-95 transition"
      style={{
        background: primary ? 'white' : 'rgba(255,255,255,0.1)',
        color:      primary ? 'var(--x-on-bright)' : 'white',
        border:     primary ? 'none' : '1px solid rgba(255,255,255,0.2)',
      }}
    >
      <Plus size={14} strokeWidth={2.5} />
      <span className="text-sm">{label}</span>
      <span className="mono text-xl tabular-nums">{value}</span>
    </button>
  )
}
