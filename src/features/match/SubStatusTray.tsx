import { Activity, AlertTriangle, ArrowRight, Check, X } from 'lucide-react'
import type { Group, Player, PlayerMatchState } from '@/lib/events/types'
import { GroupBadge } from './GroupBadge'

export interface SubPairing {
  off: { player: Player; ps: PlayerMatchState } | null
  on: { player: Player; ps: PlayerMatchState } | null
  match: boolean
  onGroup: Group
}

interface SubStatusTrayProps {
  comingOffIds: string[]
  comingOnIds: string[]
  pendingConfirm: boolean
  pairings: SubPairing[]
  onClear: () => void
  onConfirm: () => void
  /** Shown while one player is picked to come off: switch to the blood / injury menu instead */
  onInjuryInstead?: () => void
}

export function SubStatusTray({
  comingOffIds, comingOnIds, pendingConfirm, pairings, onClear, onConfirm, onInjuryInstead,
}: SubStatusTrayProps) {
  const statusText = comingOffIds.length > comingOnIds.length
    ? 'Now tap a replacement'
    : pendingConfirm
      ? 'Position mismatch — confirm below'
      : 'Sub in progress'

  return (
    <div
      className="fixed above-live-bar app-x px-3 py-2.5 shadow-2xl z-30"
      style={{ background: 'var(--x-live-bar)', color: 'white', borderTop: '2px solid var(--brand)' }}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold opacity-60">{statusText}</span>
        <button onClick={onClear} className="opacity-60 active:opacity-100">
          <X size={16} />
        </button>
      </div>
      <div className="space-y-1">
        {pairings.map((pr, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <div className="flex-1 flex items-center gap-1.5 min-w-0">
              {pr.off
                ? <><GroupBadge group={pr.off.ps.activeGroup} size="sm" /><span className="font-semibold truncate" style={{ color: 'var(--m-error)' }}>{pr.off.player.name}</span></>
                : <span className="opacity-40 italic text-xs">—</span>}
            </div>
            <ArrowRight size={13} className="opacity-40 flex-shrink-0" />
            <div className="flex-1 flex items-center gap-1.5 min-w-0">
              {pr.on
                ? <><GroupBadge group={pr.onGroup} size="sm" /><span className="font-semibold truncate" style={{ color: 'var(--x-on-brand-good)' }}>{pr.on.player.name}</span></>
                : <span className="opacity-40 italic text-xs">tap bench →</span>}
            </div>
            <div className="w-4 flex-shrink-0">
              {pr.off && pr.on && (
                pr.match
                  ? <Check size={14} style={{ color: 'var(--x-go)' }} strokeWidth={2.5} />
                  : <AlertTriangle size={14} style={{ color: 'var(--m-error)' }} strokeWidth={2.5} />
              )}
            </div>
          </div>
        ))}
      </div>
      {onInjuryInstead && (
        <button
          onClick={onInjuryInstead}
          className="w-full mt-2 py-2 rounded-m-md text-sm font-bold flex items-center justify-center gap-1.5 active:scale-95 transition"
          style={{ background: 'rgba(255,255,255,0.12)', color: 'white' }}
        >
          <Activity size={14} strokeWidth={2.5} /> Blood or injury instead
        </button>
      )}
      {pendingConfirm && (
        <button
          onClick={onConfirm}
          className="w-full mt-2 py-2 rounded-m-md text-sm font-bold flex items-center justify-center gap-1.5 active:scale-95 transition"
          style={{ background: 'var(--x-pause)', color: 'var(--x-on-bright)' }}
        >
          <AlertTriangle size={14} strokeWidth={2.5} /> Confirm sub anyway
        </button>
      )}
    </div>
  )
}
