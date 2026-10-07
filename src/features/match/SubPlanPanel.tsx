import { AlertTriangle, ArrowRight, Clock } from 'lucide-react'
import type { Group, Player } from '@/lib/events/types'
import { GroupBadge } from './GroupBadge'
import { PURPLE, PURPLE_DARK, PURPLE_SOFT, PURPLE_SOFTER } from './liveMatchUtils'

export interface SubPlanSwap {
  off: Player
  on: Player
  group: Group
  dueNow: boolean
  atHalfTime: boolean
  dueAtMs: number
}

interface SubPlanPanelProps {
  subPlan: SubPlanSwap[]
  dueSwaps: SubPlanSwap[]
  dismissedKey: string | null
  dueKey: string
  onApply: () => void
  onDismiss: () => void
}

/**
 * Standing sub plan, shown while the match is in progress (not at half-time).
 * Renders one of three states:
 *  - a quiet "N changes planned for half time" line (when all swaps are at half-time)
 *  - the full panel with due/next subs and Apply / Later buttons
 *  - nothing (parent decides not to render)
 */
export function SubPlanPanel({
  subPlan, dueSwaps, dismissedKey, dueKey, onApply, onDismiss,
}: SubPlanPanelProps) {
  // Before the break, half-time changes are one quiet line, not a list
  if (dueSwaps.length === 0 && subPlan.every(sw => sw.atHalfTime)) {
    return (
      <div className="mx-3 mt-3 px-3 py-2.5 rounded-m-md bg-m-surface-container flex items-center gap-2 text-sm" style={{ border: '1px solid var(--m-outline-variant)', color: 'var(--m-on-surface-variant)' }}>
        <Clock size={16} strokeWidth={2} style={{ color: 'var(--m-on-surface-variant)' }} className="flex-shrink-0" />
        <span>{subPlan.length} change{subPlan.length === 1 ? '' : 's'} planned for half time</span>
      </div>
    )
  }

  // Dismissed until the set of due swaps changes
  if (dismissedKey === dueKey) return null

  return (
    <div
      className="mx-3 mt-3 rounded-m-md p-3 flex items-start gap-3"
      style={{
        background: dueSwaps.length ? PURPLE_SOFTER : 'var(--m-surface-container)',
        border: `1px solid ${dueSwaps.length ? PURPLE : PURPLE_SOFT}`,
      }}
    >
      {dueSwaps.length > 0
        ? <AlertTriangle size={18} style={{ color: PURPLE }} className="flex-shrink-0 mt-0.5" strokeWidth={2.5} />
        : <Clock size={18} style={{ color: 'var(--m-on-surface-variant)' }} className="flex-shrink-0 mt-0.5" strokeWidth={2} />}
      <div className="flex-1 text-sm min-w-0">
        <div className="font-bold mb-1" style={{ color: PURPLE_DARK }}>
          {dueSwaps.length > 0 ? 'Subs due now' : 'Next subs'}
        </div>
        <div className="space-y-1">
          {subPlan.map((swap, i) => (
            <div
              key={i}
              className="flex items-center gap-1.5 text-sm"
              style={{ color: PURPLE, opacity: swap.dueNow ? 1 : 0.6 }}
            >
              <GroupBadge group={swap.group} size="sm" />
              <span className="font-semibold truncate">{swap.off.name}</span>
              <ArrowRight size={10} className="flex-shrink-0 opacity-50" />
              <span className="font-semibold truncate">{swap.on.name}</span>
              <span className="mono text-xs ml-auto flex-shrink-0 tabular-nums">
                {swap.dueNow ? 'now' : swap.atHalfTime ? 'HT' : `~${Math.ceil(swap.dueAtMs / 60_000)}'`}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1 flex-shrink-0">
        {dueSwaps.length > 0 && (
          <button
            onClick={onApply}
            className="text-xs font-bold px-2.5 py-1 rounded-m-md whitespace-nowrap"
            style={{ background: PURPLE, color: 'var(--m-on-primary)' }}
          >
            {dueSwaps.length > 1 ? 'Apply all' : 'Apply'}
          </button>
        )}
        <button
          onClick={onDismiss}
          className="text-xs px-2 py-1 text-center"
          style={{ color: PURPLE }}
        >
          Later
        </button>
      </div>
    </div>
  )
}
