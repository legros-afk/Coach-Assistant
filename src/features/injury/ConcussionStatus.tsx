import { useState } from 'react'
import { Check, Lock, Undo2 } from 'lucide-react'
import type { ConcussionProtocol, StageNumber } from '@/lib/safeguarding/types'
import {
  canCompleteStage, currentStage, daysElapsed, daysUntilEarliestReturn,
  earliestReturnDate, stageEarliestDate, startLabel, toIsoDay,
} from '@/lib/safeguarding/gras'
import { ukDate } from '@/lib/safeguarding/injuryEmail'
import { Button } from '@/ui/Button'

interface Props {
  protocol: ConcussionProtocol
  /** Safeguarding officer only: tick off stages and drop back. */
  onComplete?: (stage: StageNumber) => void
  onDropBack?: () => void
}

/** Headline numbers for a protocol: where they are and when they can play. */
export function ConcussionSummary({ protocol: p }: { protocol: ConcussionProtocol }) {
  const today = toIsoDay(new Date())
  const cur = currentStage(p)
  const left = daysUntilEarliestReturn(p, today)
  return (
    <div className="grid grid-cols-3 gap-2 text-center">
      <div className="rounded-m-md bg-m-surface-container-high p-2">
        <div className="text-2xl font-bold tabular-nums">{daysElapsed(p, today)}</div>
        <div className="text-xs text-m-on-surface-variant">days since injury</div>
      </div>
      <div className="rounded-m-md bg-m-surface-container-high p-2">
        <div className="text-2xl font-bold">{cur ? cur.stage : '✓'}</div>
        <div className="text-xs text-m-on-surface-variant">{cur ? 'current stage' : 'all stages done'}</div>
      </div>
      <div className={`rounded-m-md p-2 ${left > 0 ? 'bg-m-error-container text-m-on-error-container' : 'bg-m-surface-container-high'}`}>
        <div className="text-2xl font-bold tabular-nums">{left}</div>
        <div className="text-xs">{left > 0 ? 'days to earliest return' : 'earliest return reached'}</div>
      </div>
    </div>
  )
}

/** The six GRAS stages as a timeline, with in-order ticking for the officer. */
export function ConcussionTimeline({ protocol: p, onComplete, onDropBack }: Props) {
  const today = toIsoDay(new Date())
  const cur = currentStage(p)
  const [blocked, setBlocked] = useState<string | null>(null)
  const manage = !!onComplete

  const tick = (stage: StageNumber) => {
    const check = canCompleteStage(p, stage, today)
    if (!check.ok) { setBlocked(check.reason); return }
    setBlocked(null)
    onComplete?.(stage)
  }

  return (
    <div>
      <ol className="space-y-2">
        {p.stages.map(s => {
          const isCur = cur?.stage === s.stage
          const earliest = stageEarliestDate(p, s)
          const tooEarly = isCur && earliest > today
          return (
            <li
              key={s.stage}
              className={`rounded-m-md p-3 flex items-start gap-3 ${isCur ? 'bg-m-primary-container text-m-on-primary-container ring-2 ring-m-primary' : 'bg-m-surface-container-high'}`}
            >
              {manage ? (
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={s.completed}
                  aria-label={`Stage ${s.stage} done`}
                  disabled={!isCur}
                  onClick={() => tick(s.stage)}
                  className={`m-press w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 border-2 ${s.completed ? 'bg-m-primary border-m-primary text-m-on-primary' : isCur ? 'border-m-primary' : 'border-m-outline-variant text-m-on-surface-variant'}`}
                >
                  {s.completed ? <Check size={20} strokeWidth={3} /> : !isCur ? <Lock size={16} /> : null}
                </button>
              ) : (
                <span className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-base font-bold ${s.completed ? 'bg-m-primary text-m-on-primary' : 'border-2 border-m-outline-variant'}`}>
                  {s.completed ? <Check size={20} strokeWidth={3} /> : s.stage}
                </span>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-base font-semibold leading-snug">
                  {s.stage}. {s.name}
                </div>
                <div className="text-sm opacity-80 leading-snug">
                  {s.completed && s.completedAt
                    ? `Done ${ukDate(s.completedAt)}`
                    : `${startLabel(s.stage)}${s.stage === 3 ? '' : ` · from ${ukDate(earliest)}`}`}
                </div>
                {isCur && <div className="text-sm mt-1 leading-snug">{s.description}</div>}
                {isCur && s.stage === 5 && (
                  <div className="text-sm mt-1 font-medium">Only if they have had no symptoms for 14 days.</div>
                )}
                {tooEarly && manage && (
                  <div className="text-sm mt-1 font-medium">Can’t be signed off before {ukDate(earliest)}.</div>
                )}
              </div>
            </li>
          )
        })}
      </ol>
      {blocked && <div role="alert" className="mt-2 text-sm font-medium text-m-error">{blocked}</div>}
      {manage && onDropBack && p.stages.some(s => s.completed) && (
        <div className="mt-3">
          <Button variant="outlined" full icon={<Undo2 size={18} strokeWidth={2.25} />} onClick={onDropBack}>
            Symptoms back — drop back a stage
          </Button>
        </div>
      )}
      <div className="mt-3 text-sm text-m-on-surface-variant">
        Earliest return to matches: <span className="font-semibold">{ukDate(earliestReturnDate(p))}</span>
        {' '}(day 21, and only if symptom-free).
      </div>
    </div>
  )
}
