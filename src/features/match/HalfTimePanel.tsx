import { ArrowRight, Play } from 'lucide-react'
import type { Player, PlayerMatchState, Group } from '@/lib/events/types'
import { GroupBadge } from './GroupBadge'
import { PURPLE, PURPLE_SOFTER, INK } from './liveMatchUtils'

export interface DueSwap {
  off: Player
  on: Player
  group: Group
  dueNow: boolean
  atHalfTime: boolean
  dueAtMs: number
}

interface HalfTimePanelProps {
  scoreUs: number
  scoreThem: number
  dueSwaps: DueSwap[]
  squad: Player[]
  playerStates: Map<string, PlayerMatchState>
  helperMode: boolean
  onApplySwaps: () => void
  onStartSecondHalf: () => void
}

export function HalfTimePanel({
  scoreUs, scoreThem, dueSwaps, squad, playerStates, helperMode, onApplySwaps, onStartSecondHalf,
}: HalfTimePanelProps) {
  return (
    <div className="mx-3 mt-3 rounded-m-xl overflow-hidden pop-in bg-m-surface-container" style={{ border: `2px solid ${PURPLE}` }}>
      <div className="px-3 py-2.5 flex items-center justify-between" style={{ background: PURPLE_SOFTER }}>
        <div className="text-lg font-bold" style={{ color: PURPLE }}>Half time</div>
        <div className="mono text-lg font-bold tabular-nums" style={{ color: INK }}>
          {scoreUs}–{scoreThem}
        </div>
      </div>

      <div className="px-3 py-2.5">
        <div className="text-xs font-bold mb-1.5" style={{ color: 'var(--m-on-surface-variant)' }}>
          {dueSwaps.length > 0 ? 'Changes for the second half' : 'No changes needed'}
        </div>
        {dueSwaps.length > 0 ? (
          <div className="space-y-1.5">
            {dueSwaps.map((swap, i) => (
              <div key={i} className="flex items-center gap-2 text-base">
                <GroupBadge group={swap.group} size="sm" />
                <span className="font-semibold truncate" style={{ color: 'var(--m-on-error-container)' }}>{swap.off.name}</span>
                <ArrowRight size={14} className="flex-shrink-0 opacity-50" />
                <span className="font-semibold truncate" style={{ color: 'var(--x-good)' }}>{swap.on.name}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-m-on-surface-variant">Everyone is on course for at least a half.</div>
        )}
      </div>

      <div className="px-3 pb-2.5">
        <div className="text-xs font-bold mb-1" style={{ color: 'var(--m-on-surface-variant)' }}>Least played so far</div>
        <div className="text-sm" style={{ color: INK }}>
          {squad
            .filter(p => { const st = playerStates.get(p.id)?.status; return st === 'on' || st === 'bench' })
            .sort((a, b) => (playerStates.get(a.id)!.minutesPlayed) - (playerStates.get(b.id)!.minutesPlayed))
            .slice(0, 4)
            .map(p => `${p.name} ${Math.round(playerStates.get(p.id)!.minutesPlayed / 60_000)}'`)
            .join(' · ')}
        </div>
      </div>

      {!helperMode && (
        <div className="px-3 pb-3 flex gap-2">
          {dueSwaps.length > 0 && (
            <button
              onClick={onApplySwaps}
              className="flex-1 rounded-m-md font-bold text-sm active:scale-95 transition"
              style={{ minHeight: 48, background: 'var(--m-secondary-container)', color: 'var(--m-on-secondary-container)' }}
            >
              Make {dueSwaps.length} change{dueSwaps.length === 1 ? '' : 's'}
            </button>
          )}
          <button
            onClick={onStartSecondHalf}
            className="flex-1 rounded-m-md font-bold text-sm flex items-center justify-center gap-1.5 active:scale-95 transition"
            style={{ minHeight: 48, background: 'var(--x-go)', color: 'var(--x-on-bright)' }}
          >
            <Play size={16} strokeWidth={2.5} /> Start second half
          </button>
        </div>
      )}
    </div>
  )
}
