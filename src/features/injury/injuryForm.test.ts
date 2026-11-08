import { describe, expect, it } from 'vitest'
import {
  FIXTURE_OTHER, chooseFixture, chooseLocation, emptyInjuryForm, fixtureLabel, fixtureOptions, formMissing, formToReport,
} from './injuryForm'
import type { Fixture } from '@/lib/events/types'

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

const fx = (id: string, date: string, opponent: string, extra: Partial<Fixture> = {}): Fixture =>
  ({ id, date, opponent, teamSheets: [], updatedAt: '', version: 1, ...extra })
const fixtures = [
  fx('f1', '2026-09-14', 'Chingford (Away)'),
  fx('f2', '2026-11-08', 'Eton Manor (Home)'),
  fx('f3', '2026-11-15', 'Old Albanians'),
  fx('f4', '2026-11-01', 'Harlow', { cancelled: true }),
]
const filled = { ...emptyInjuryForm({ name: 'Henry' }, 'Flo', now), incidentDescription: 'fell', treatmentGiven: 'ice' }

describe('injury form fixture', () => {
  it('labels a fixture with date, opponent and home/away', () => {
    expect(fixtureLabel(fixtures[0])).toBe('14 Sep vs Chingford (away)')
    expect(fixtureLabel(fixtures[1])).toBe('8 Nov vs Eton Manor (home)')
    expect(fixtureLabel(fixtures[2])).toBe('15 Nov vs Old Albanians')
  })

  it('offers fixtures nearest the day first, without cancelled ones', () => {
    expect(fixtureOptions(fixtures, '2026-11-09').map(f => f.id)).toEqual(['f2', 'f3', 'f1'])
    expect(fixtureOptions(fixtures, '2026-11-08', 1).map(f => f.id)).toEqual(['f2'])
  })

  it('needs a fixture choice for a match or festival, not for training', () => {
    expect(formMissing(filled)).toBeNull()
    const match = { ...filled, locationChoice: 'Match' as const }
    expect(formMissing(match)).toBe('Pick which match it was')
    expect(formMissing({ ...match, locationChoice: 'Festival' })).toBe('Pick which festival it was')
    expect(formMissing(chooseFixture(match, 'f1', fixtures))).toBeNull()
    const other = chooseFixture(match, FIXTURE_OTHER, fixtures)
    expect(formMissing(other)).toBe('Say which match it was')
    expect(formMissing({ ...other, fixtureOther: '  ' })).toBe('Say which match it was')
    expect(formMissing({ ...other, fixtureOther: 'Friendly vs Harlow' })).toBeNull()
  })

  it("pre-picks the day's only fixture, or free text when there are none", () => {
    expect(chooseLocation(filled, 'Match', fixtures)).toMatchObject({ fixtureChoice: 'f2', fixtureLabel: '8 Nov vs Eton Manor (home)' })
    expect(chooseLocation({ ...filled, date: '2026-11-10' }, 'Match', fixtures).fixtureChoice).toBe('')
    expect(chooseLocation(filled, 'Festival', []).fixtureChoice).toBe(FIXTURE_OTHER)
    expect(chooseLocation(filled, 'Training', fixtures).fixtureChoice).toBe('')
    // a choice already made is kept
    const picked = chooseFixture({ ...filled, locationChoice: 'Match' }, 'f1', fixtures)
    expect(chooseLocation(picked, 'Festival', fixtures).fixtureChoice).toBe('f1')
  })

  it('stamps the fixture id and label on the report', () => {
    const f = chooseFixture({ ...filled, locationChoice: 'Match' }, 'f1', fixtures)
    const r = formToReport(f, 'inj-1', 'p1', '2026-11-08T10:06:00Z')
    expect(r).toMatchObject({ location: 'Match', fixtureId: 'f1', fixtureLabel: '14 Sep vs Chingford (away)' })
  })

  it('stamps typed-in text with no fixture id', () => {
    const f = { ...chooseFixture({ ...filled, locationChoice: 'Festival' }, FIXTURE_OTHER, fixtures), fixtureOther: ' Harlow festival ' }
    const r = formToReport(f, 'inj-1', 'p1', '2026-11-08T10:06:00Z')
    expect(r.fixtureLabel).toBe('Harlow festival')
    expect('fixtureId' in r).toBe(false)
  })

  it('drops a fixture picked before switching back to training', () => {
    const f = { ...chooseFixture({ ...filled, locationChoice: 'Match' }, 'f1', fixtures), locationChoice: 'Training' as const }
    const r = formToReport(f, 'inj-1', 'p1', '2026-11-08T10:06:00Z')
    expect('fixtureId' in r).toBe(false)
    expect('fixtureLabel' in r).toBe(false)
  })
})
