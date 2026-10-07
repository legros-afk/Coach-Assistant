import { MoreVertical, Activity } from 'lucide-react'
import type { Player, PlayerMatchState } from '@/lib/events/types'
import { GroupBadge } from './GroupBadge'
import { fmt, balanceColor, liveMinMs, PURPLE, PURPLE_DARK, PURPLE_SOFTER, INK } from './liveMatchUtils'

export interface PlayerCardProps {
  player: Player
  ps: PlayerMatchState
  avgMs: number
  liveElapsedMs: number
  picked?: boolean
  pickedTone?: 'rose' | 'emerald'
  onTap?: () => void
  /** Opens the blood / injury menu for this player */
  onMenu?: () => void
  muted?: boolean
  suggested?: boolean   // fits the position of the player coming off
  dimmed?: boolean      // doesn't fit — still tappable, just de-emphasised
  onReturn?: () => void
}

export function MatchPlayerCard({
  player, ps, avgMs, liveElapsedMs,
  picked, pickedTone, onTap, onMenu, muted, suggested, dimmed, onReturn,
}: PlayerCardProps) {
  const mins = liveMinMs(ps, liveElapsedMs)
  const pickedBg     = pickedTone === 'rose' ? 'var(--m-error-container)' : 'var(--x-good-container)'
  const pickedBorder = pickedTone === 'rose' ? 'var(--m-error)' : 'var(--x-go)'

  return (
    <div
      onClick={onTap}
      className={`p-2.5 rounded-m-md transition relative ${onTap ? 'active:scale-[0.98] cursor-pointer' : ''}`}
      style={{
        background: picked ? pickedBg : muted ? 'var(--m-surface-container-low)' : suggested ? PURPLE_SOFTER : 'var(--m-surface-container)',
        border: picked
          ? `2px solid ${pickedBorder}`
          : suggested ? `2px solid ${PURPLE_DARK}` : '1px solid var(--m-outline-variant)',
        opacity: muted ? 0.7 : dimmed ? 0.5 : 1,
      }}
    >
      <div className="flex items-start gap-2 mb-1.5">
        <GroupBadge group={ps.activeGroup} />
        <div className="flex-1 min-w-0">
          <div className="font-bold text-base leading-tight line-clamp-2" style={{ color: INK }}>
            {player.name}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: balanceColor(mins, avgMs) }}
            />
            <span className="mono text-xs tabular-nums opacity-70">{fmt(mins)}</span>
            {ps.triesScored > 0 && (
              <span className="mono text-xs font-bold" style={{ color: PURPLE }}>
                {ps.triesScored}T
              </span>
            )}
          </div>
        </div>
        {onMenu && (
          // Blood and injury live behind this menu, well away from the tap-to-sub
          // area, so a stray tap can't take a player off by accident.
          <button
            onClick={e => { e.stopPropagation(); onMenu() }}
            aria-label={`Blood or injury — ${player.name}`}
            className="-mr-1.5 -mt-1.5 w-11 h-11 flex items-center justify-center rounded-m-md active:bg-m-outline-variant flex-shrink-0"
          >
            <MoreVertical size={18} strokeWidth={2.5} style={{ color: 'var(--m-on-surface-variant)' }} />
          </button>
        )}
      </div>
      {onReturn && (
        <button
          onClick={e => { e.stopPropagation(); onReturn() }}
          className="w-full mt-1.5 py-1.5 rounded-m-md text-xs font-bold flex items-center justify-center gap-1 active:scale-95"
          style={{ background: 'var(--x-go)', color: 'white' }}
        >
          <Activity size={12} strokeWidth={2.5} /> Return
        </button>
      )}
    </div>
  )
}
