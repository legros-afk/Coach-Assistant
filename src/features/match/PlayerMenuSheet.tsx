import { X } from 'lucide-react'
import type { Player } from '@/lib/events/types'
import { INK } from './liveMatchUtils'

interface PlayerMenuSheetProps {
  player: Player | null
  onClose: () => void
  onBlood: (player: Player) => void
  onInjury: (player: Player) => void
}

export function PlayerMenuSheet({ player, onClose, onBlood, onInjury }: PlayerMenuSheetProps) {
  if (!player) return null
  return (
    <div
      className="fixed inset-0 z-40 flex items-end backdrop-in"
      style={{ background: 'var(--m-scrim)' }}
      onClick={onClose}
    >
      <div
        className="bg-m-surface-container-low w-full max-w-[40rem] mx-auto rounded-t-m-xl sheet-in px-4 pt-2 space-y-2"
        onClick={e => e.stopPropagation()}
      >
        <div className="mx-auto mb-2 h-1 w-8 rounded-full bg-m-outline-variant" aria-hidden="true" />
        <div className="flex items-center justify-between mb-1">
          <div className="text-2xl font-bold" style={{ color: INK }}>{player.name}</div>
          <button onClick={onClose} className="w-12 h-12 flex items-center justify-center" aria-label="Close">
            <X />
          </button>
        </div>
        <button
          onClick={() => onBlood(player)}
          className="tap-target w-full rounded-m-md px-4 text-left active:scale-[0.98] transition"
          style={{ background: 'var(--m-error-container)', color: 'var(--m-on-error-container)' }}
        >
          <div className="font-bold text-base">Blood — temporary</div>
          <div className="text-sm">Off now, can return once treated</div>
        </button>
        <button
          onClick={() => onInjury(player)}
          className="tap-target w-full rounded-m-md px-4 text-left active:scale-[0.98] transition"
          style={{ background: 'var(--m-surface-container-high)', color: INK }}
        >
          <div className="font-bold text-base">Injury</div>
          <div className="text-sm text-m-on-surface-variant">Off, left out of the minutes balance</div>
        </button>
      </div>
    </div>
  )
}
