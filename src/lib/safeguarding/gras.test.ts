import { describe, expect, it } from 'vitest'
import {
  GRAS_STAGES, addDays, canCompleteStage, completeStage, currentStage, daysElapsed,
  daysUntilEarliestReturn, dropBackStage, earliestReturnDate, freshStages,
} from './gras'
import type { ConcussionProtocol } from './types'

const proto = (over: Partial<ConcussionProtocol> = {}): ConcussionProtocol => ({
  id: 'c1', playerId: 'p1', playerName: 'Henry', injuryReportId: 'r1',
  concussionDate: '2026-11-01', stages: freshStages(), managedBy: '', version: 1, ...over,
})

describe('GRAS constants', () => {
  it('has six stages with the RFU earliest start days', () => {
    expect(GRAS_STAGES.map(s => s.stage)).toEqual([1, 2, 3, 4, 5, 6])
    expect(GRAS_STAGES.map(s => s.earliestStartDay)).toEqual([0, 3, 3, 8, 15, 21])
  })
})

describe('dates', () => {
  it('adds days across month ends', () => {
    expect(addDays('2026-11-25', 21)).toBe('2026-12-16')
  })
  it('earliest return is day 21', () => {
    expect(earliestReturnDate(proto())).toBe('2026-11-22')
    expect(daysUntilEarliestReturn(proto(), '2026-11-08')).toBe(14)
    expect(daysUntilEarliestReturn(proto(), '2026-12-01')).toBe(0)
    expect(daysElapsed(proto(), '2026-11-08')).toBe(7)
  })
})

describe('stage progression', () => {
  it('only allows the current stage, in order', () => {
    const p = proto()
    expect(canCompleteStage(p, 1, '2026-11-01').ok).toBe(true)
    expect(canCompleteStage(p, 2, '2026-11-05').ok).toBe(false)
  })
  it('blocks a stage before its earliest day', () => {
    let p = proto()
    p = completeStage(p, 1, '2026-11-02T10:00:00Z')
    p = completeStage(p, 2, '2026-11-04T10:00:00Z')
    p = completeStage(p, 3, '2026-11-05T10:00:00Z')
    expect(currentStage(p)?.stage).toBe(4)
    expect(canCompleteStage(p, 4, '2026-11-08').ok).toBe(false)  // day 7
    expect(canCompleteStage(p, 4, '2026-11-09').ok).toBe(true)   // day 8
  })
  it('completing stage 6 completes the protocol; drop back reopens', () => {
    let p = proto()
    for (const s of [1, 2, 3, 4, 5, 6] as const) p = completeStage(p, s, '2026-11-30T10:00:00Z')
    expect(p.completedAt).toBe('2026-11-30T10:00:00Z')
    expect(currentStage(p)).toBeNull()
    p = dropBackStage(p)
    expect(p.completedAt).toBeUndefined()
    expect(currentStage(p)?.stage).toBe(6)
  })
})
