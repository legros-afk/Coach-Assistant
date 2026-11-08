import type { ConcussionProtocol } from '@/lib/safeguarding/types'
import { currentStage, earliestReturnDate } from '@/lib/safeguarding/gras'
import { ukDate } from '@/lib/safeguarding/injuryEmail'
import { Sheet } from '@/ui/Sheet'
import { ConcussionSummary, ConcussionTimeline } from './ConcussionStatus'
import { RedFlagButton } from './RedFlags'

/**
 * What any coach sees when they tap a player's concussion badge. Read-only:
 * only the safeguarding officer moves a player through the stages.
 */
export default function ConcussionStatusSheet({ protocol: p, onClose }: { protocol: ConcussionProtocol; onClose: () => void }) {
  const cur = currentStage(p)
  return (
    <Sheet onClose={onClose} title={p.playerName} maxHeight="92vh">
      <div className="space-y-4 pb-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 p-3 rounded-m-md bg-m-error-container text-m-on-error-container">
            <div className="text-base font-bold leading-snug">Not cleared to play.</div>
            <div className="text-sm leading-snug">
              Concussion on {ukDate(p.concussionDate)}.{cur ? ` On stage ${cur.stage}: ${cur.name}.` : ''}
              {' '}Earliest return {ukDate(earliestReturnDate(p))}.
            </div>
          </div>
          <RedFlagButton />
        </div>
        <ConcussionSummary protocol={p} />
        <ConcussionTimeline protocol={p} />
        <p className="text-sm text-m-on-surface-variant">
          The safeguarding officer signs off each stage. Ask them before picking this player.
        </p>
      </div>
    </Sheet>
  )
}
