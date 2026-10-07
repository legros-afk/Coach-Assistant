import { AlertTriangle, X } from 'lucide-react'
import type { Player, PlayerMatchState } from '@/lib/events/types'
import { GroupBadge } from './GroupBadge'
import { fmt, liveMinMs, PURPLE_DARK, INK } from './liveMatchUtils'

export type ReplacementKind = 'blood' | 'injury'

interface ReplacementPickerProps {
  kind: ReplacementKind
  player: Player | null
  bench: Player[]
  replacementsFor: (forPlayer: Player) => { p: Player; fits: boolean }[]
  playerStates: Map<string, PlayerMatchState>
  liveElapsedMs: number
  onSelect: (replacementId: string | undefined) => void
  onClose: () => void
}

export function ReplacementPicker({
  kind, player, bench, replacementsFor, playerStates, liveElapsedMs, onSelect, onClose,
}: ReplacementPickerProps) {
  if (!player) return null
  const isBlood = kind === 'blood'
  const title = isBlood ? `Blood — ${player.name}` : `Injured — ${player.name}`

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
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            {!isBlood && <AlertTriangle size={22} style={{ color: INK }} />}
            <div className="text-2xl font-bold" style={{ color: INK }}>
              {title}
            </div>
          </div>
          <button
            onClick={onClose}
            className="tap-target w-12 flex items-center justify-center"
          >
            <X />
          </button>
        </div>
        <p className="text-sm text-m-on-surface-variant mb-3">Who comes on as replacement?</p>
        <div className="space-y-1.5">
          {replacementsFor(player).map(({ p, fits }) => (
            <button
              key={p.id}
              onClick={() => onSelect(p.id)}
              className="tap-target w-full flex items-center gap-3 px-3 bg-m-surface-container rounded-m-md border active:scale-[0.98] transition"
              style={{ borderColor: fits ? PURPLE_DARK : 'var(--m-outline-variant)', opacity: fits ? 1 : 0.5 }}
            >
              <GroupBadge group={playerStates.get(p.id)!.activeGroup} />
              <span className="font-semibold flex-1 text-left">{p.name}</span>
              <span className="mono text-xs opacity-50">
                {fmt(liveMinMs(playerStates.get(p.id)!, liveElapsedMs))}
              </span>
            </button>
          ))}
          {bench.length === 0 && (
            <p className="text-sm italic text-m-outline px-3 py-2">No bench players available</p>
          )}
          <button
            onClick={() => onSelect(undefined)}
            className="tap-target w-full px-3 italic active:scale-[0.98] transition opacity-60 text-sm"
          >
            Continue without replacement
          </button>
        </div>
      </div>
    </div>
  )
}
