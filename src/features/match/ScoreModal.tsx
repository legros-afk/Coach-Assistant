import { Trophy, X } from 'lucide-react'
import type { Player, PlayerMatchState } from '@/lib/events/types'
import { GroupBadge } from './GroupBadge'
import { PURPLE, INK } from './liveMatchUtils'

interface ScoreModalProps {
  open: boolean
  onPitch: Player[]
  playerStates: Map<string, PlayerMatchState>
  onPick: (playerId: string | undefined) => void
  onClose: () => void
}

export function ScoreModal({ open, onPitch, playerStates, onPick, onClose }: ScoreModalProps) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-40 flex items-end backdrop-in"
      style={{ background: 'var(--m-scrim)' }}
      onClick={onClose}
    >
      <div
        className="bg-m-surface-container-low w-full max-w-[40rem] mx-auto rounded-t-m-xl sheet-in px-4 pt-2 max-h-[70vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="mx-auto mb-2 h-1 w-8 rounded-full bg-m-outline-variant" aria-hidden="true" />
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Trophy size={22} style={{ color: PURPLE }} />
            <div className="text-2xl font-bold" style={{ color: INK }}>Who scored?</div>
          </div>
          <button
            onClick={onClose}
            className="tap-target w-12 flex items-center justify-center"
          >
            <X />
          </button>
        </div>
        <div className="space-y-1.5">
          {onPitch.map(p => (
            <button
              key={p.id}
              onClick={() => onPick(p.id)}
              className="tap-target w-full flex items-center gap-3 px-3 bg-m-surface-container rounded-m-md border active:scale-[0.98] transition"
              style={{ borderColor: 'var(--m-outline-variant)' }}
            >
              <GroupBadge group={playerStates.get(p.id)!.activeGroup} />
              <span className="font-semibold flex-1 text-left">{p.name}</span>
              {(playerStates.get(p.id)?.triesScored ?? 0) > 0 && (
                <span className="mono text-xs opacity-60">
                  {playerStates.get(p.id)!.triesScored}T
                </span>
              )}
            </button>
          ))}
          <button
            onClick={() => onPick(undefined)}
            className="tap-target w-full px-3 italic active:scale-[0.98] transition opacity-70"
          >
            Unattributed / decide later
          </button>
        </div>
      </div>
    </div>
  )
}
