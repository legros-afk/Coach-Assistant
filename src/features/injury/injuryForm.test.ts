import { describe, expect, it } from 'vitest'
import { emptyInjuryForm, formMissing, formToReport } from './injuryForm'

const now = new Date(2026, 10, 8, 10, 5)

describe('injury form', () => {
  it('defaults to today, now, training and the tapped player', () => {
    const f = emptyInjuryForm({ name: 'Henry' }, 'Flo', now)
    expect(f.date).toBe('2026-11-08')
    expect(f.time).toBe('10:05')
    expect(f.locationChoice).toBe('Training')
    expect(f.playerName).toBe('Henry')
    expect(f.playerAgeGroup).toBe('U12')
    expect(f.parentsInformed).toBe(false)
  })

  it('needs how it happened and the treatment', () => {
    const f = emptyInjuryForm({ name: 'Henry' }, '', now)
    expect(formMissing(f)).toBe('Say how it happened')
    expect(formMissing({ ...f, incidentDescription: 'fell' })).toBe('Say what treatment was given')
    expect(formMissing({ ...f, incidentDescription: 'fell', treatmentGiven: 'ice' })).toBeNull()
    expect(formMissing({ ...f, incidentDescription: 'fell', treatmentGiven: 'ice', locationChoice: 'Other' })).toBe('Say where it happened')
  })

  it('builds a report, leaving empty optional fields out', () => {
    const f = { ...emptyInjuryForm({ name: 'Henry' }, 'Flo', now), incidentDescription: ' fell ', treatmentGiven: 'ice', locationChoice: 'Other' as const, locationOther: 'Tour' }
    const r = formToReport(f, 'inj-1', 'p1', '2026-11-08T10:06:00Z')
    expect(r).toMatchObject({ id: 'inj-1', playerId: 'p1', location: 'Tour', incidentDescription: 'fell', reportedBy: 'Flo', version: 1 })
    expect('followUp' in r).toBe(false)
    expect('bodyPart' in r).toBe(false)
  })
})
