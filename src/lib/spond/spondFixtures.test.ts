import { describe, expect, it } from 'vitest'
import { reconcileWithSpond, opponentOf, isMatchEvent } from './spondFixtures'
import type { SpondEvent } from './spondApi'
import type { Fixture } from '@/lib/events/types'

const ev = (id: string, date: string, heading: string, extra: Partial<SpondEvent> = {}): SpondEvent => ({
  id, heading, startTimestamp: `${date}T09:00:00.000Z`,
  responses: { acceptedIds: [], declinedIds: [], unansweredIds: [] }, ...extra,
})
const fx = (id: string, date: string, opponent: string, extra: Partial<Fixture> = {}): Fixture => ({
  id, date, opponent, teamSheets: [], playersPerSide: 12, updatedAt: '', version: 1, ...extra,
})
const TODAY = '2026-09-28'
const run = (events: SpondEvent[], fixtures: Fixture[], played = new Set<string>()) =>
  reconcileWithSpond(events, fixtures, TODAY, played, 12, '2026-09-28T10:00:00Z')

describe('opponentOf', () => {
  it('uses Spond match info with home/away', () => {
    expect(opponentOf(ev('1', '2026-10-04', 'x', { matchEvent: true, matchInfo: { opponentName: 'Eton Manor', type: 'AWAY' } })))
      .toBe('Eton Manor (Away)')
  })
  it('reads "Home – Away" headings', () => {
    expect(opponentOf(ev('1', '2026-10-04', 'Eton Manor – Woodford Rugby Club'))).toBe('Eton Manor (Away)')
    expect(opponentOf(ev('1', '2026-10-04', 'Woodford Rugby Club – Old Albanians'))).toBe('Old Albanians (Home)')
  })
  it('reads "vs" headings', () => {
    expect(opponentOf(ev('1', '2026-10-04', 'vs Upminster Festival'))).toBe('Upminster Festival')
  })
})

describe('isMatchEvent', () => {
  it('skips trainings', () => {
    expect(isMatchEvent(ev('1', '2026-09-30', 'U12 Mid-Week Training'))).toBe(false)
    expect(isMatchEvent(ev('2', '2026-10-04', 'Eton Manor – Woodford Rugby Club'))).toBe(true)
  })
})

describe('reconcileWithSpond', () => {
  it('matches the real 4 Oct case: festival cancelled, Eton Manor added', () => {
    const fixtures = [fx('a', '2026-10-04', 'Upminster Festival'), fx('b', '2026-10-11', 'Upminster (Away)')]
    const events = [
      ev('s1', '2026-10-04', 'Eton Manor – Woodford Rugby Club', { matchEvent: true, matchInfo: { opponentName: 'Eton Manor', type: 'AWAY' } }),
      ev('s2', '2026-10-04', 'vs Upminster Festival', { cancelled: true }),
      ev('s3', '2026-10-11', 'Upminster – Woodford Rugby Club'),
      ev('t1', '2026-10-07', 'U12 Mid-Week Training'),
    ]
    const { changed, summary } = run(events, fixtures)
    const festival = changed.find(f => f.id === 'a')!
    expect(festival.cancelled).toBe(true)
    expect(festival.spondEventId).toBe('s2')
    const eton = changed.find(f => f.spondEventId === 's1')!
    expect(eton.opponent).toBe('Eton Manor (Away)')
    expect(eton.date).toBe('2026-10-04')
    expect(changed.find(f => f.id === 'b')!.spondEventId).toBe('s3')
    expect(summary.added).toBe(1)
    expect(changed.some(f => /training/i.test(f.opponent))).toBe(false)
  })

  it('moves a fixture when Spond changes its date', () => {
    const fixtures = [fx('a', '2026-10-18', 'Old Albanians (Home)', { spondEventId: 's1' })]
    const { changed } = run([ev('s1', '2026-10-25', 'Woodford Rugby Club – Old Albanians')], fixtures)
    expect(changed[0].date).toBe('2026-10-25')
    expect(changed[0].version).toBe(2)
  })

  it('retires upcoming fixtures Spond does not have, but only within its dates', () => {
    const fixtures = [fx('gone', '2026-10-25', 'Eton Manor (Away)'), fx('later', '2027-02-14', 'Brentwood (Home)')]
    const { changed } = run([ev('s1', '2026-11-01', 'Woodford Rugby Club – Barnet')], fixtures)
    expect(changed.find(f => f.id === 'gone')!.cancelled).toBe(true)
    expect(changed.find(f => f.id === 'later')).toBeUndefined()
  })

  it('never retires a fixture that has already been played', () => {
    const fixtures = [fx('p', '2026-10-25', 'X', { teamSheets: [{ id: 'ts', label: 'A', starters: { forwards: [], backs: [], scrumhalf: '' }, bench: [], unavailable: [] }] })]
    const { changed } = run([ev('s1', '2026-11-01', 'Woodford Rugby Club – Barnet')], fixtures, new Set(['ts']))
    expect(changed.find(f => f.id === 'p')).toBeUndefined()
  })

  it('changes nothing when already in step', () => {
    const fixtures = [fx('a', '2026-10-11', 'Upminster (Away)', { spondEventId: 's3' })]
    const { changed } = run([ev('s3', '2026-10-11', 'Upminster – Woodford Rugby Club')], fixtures)
    expect(changed).toHaveLength(0)
  })
})
