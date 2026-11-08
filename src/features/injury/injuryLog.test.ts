import { describe, expect, it } from 'vitest'
import { filterReports, logSummary } from './SafeguardingWorkspace'
import type { InjuryReport } from '@/lib/safeguarding/types'

const base: InjuryReport = {
  id: 'a', playerId: 'p1', playerName: 'Henry', playerAgeGroup: 'U12', date: '2026-10-01', time: '10:00',
  location: 'Training', staffPresent: '', parentGuardian: '', parentContact: '', incidentDescription: 'x',
  treatmentGiven: 'y', parentsInformed: true, injuryType: ['cut'], headInjuryOrConcussion: false,
  hospitalOrAmbulance: false, reportedBy: '', reportedAt: '2026-10-01T10:00:00Z', version: 1,
}
const reports = [
  base,
  { ...base, id: 'b', playerName: 'Sam', date: '2026-11-05', injuryType: [], headInjuryOrConcussion: true },
  { ...base, id: 'c', date: '2026-11-07', injuryType: ['sprain'], hospitalOrAmbulance: true },
]
const none = { player: '', from: '', to: '', types: [] as string[] }
const ids = (rs: InjuryReport[]) => rs.map(r => r.id)

describe('injury log filters', () => {
  it('filters by player, date and type', () => {
    expect(ids(filterReports(reports, none))).toEqual(['a', 'b', 'c'])
    expect(ids(filterReports(reports, { ...none, player: 'Henry' }))).toEqual(['a', 'c'])
    expect(ids(filterReports(reports, { ...none, from: '2026-11-01' }))).toEqual(['b', 'c'])
    expect(ids(filterReports(reports, { ...none, to: '2026-11-05' }))).toEqual(['a', 'b'])
    expect(ids(filterReports(reports, { ...none, types: ['head'] }))).toEqual(['b'])
    expect(ids(filterReports(reports, { ...none, types: ['cut', 'hospital'] }))).toEqual(['a', 'c'])
  })
})

describe('injury log summary', () => {
  it('shows the fixture when there is one', () => {
    expect(logSummary({ ...base, location: 'Match', fixtureId: 'f1', fixtureLabel: '14 Sep vs Chingford (away)' }))
      .toBe('01/10/2026 · 10:00 · Match · 14 Sep vs Chingford (away)')
  })

  it('reads older reports with no fixture as before', () => {
    expect(logSummary(base)).toBe('01/10/2026 · 10:00 · Training')
    expect(logSummary({ ...base, location: 'Match' })).toBe('01/10/2026 · 10:00 · Match')
  })
})
