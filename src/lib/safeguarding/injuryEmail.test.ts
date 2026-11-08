import { describe, expect, it } from 'vitest'
import { concussionSms, injuryEmailBody, injuryWhere, injuryEmailSubject, injuryMailto } from './injuryEmail'
import { protocolFromReport } from './protocol'
import { earliestReturnDate } from './gras'
import type { InjuryReport } from './types'

const report: InjuryReport = {
  id: 'inj-1', playerId: 'p1', playerName: 'Henry', playerAgeGroup: 'U12',
  date: '2026-11-08', time: '10:05', location: 'Training', staffPresent: 'Flo, Dan',
  parentGuardian: 'Sarah', parentContact: '07000 000000',
  incidentDescription: 'Head clash in a tackle', treatmentGiven: 'Sat out, ice pack',
  parentsInformed: true, injuryType: ['bruise'], headInjuryOrConcussion: true,
  hospitalOrAmbulance: false, reportedBy: 'Flo', reportedAt: '2026-11-08T10:06:00Z', version: 1,
}

describe('injury email', () => {
  it('uses the per-report subject', () => {
    expect(injuryEmailSubject(report)).toBe('Youth & Mini Injury Report: Henry, 08/11/2026')
  })

  it('addresses Bekah and copies Liz and couppis', () => {
    const url = injuryMailto(report)
    expect(url.startsWith('mailto:body_elite_essex@hotmail.com?')).toBe(true)
    const q = new URLSearchParams(url.split('?')[1])
    expect(q.get('cc')).toBe('lizngrant@yahoo.co.uk,couppis@gmail.com')
    expect(q.get('subject')).toBe('Youth & Mini Injury Report: Henry, 08/11/2026')
    expect(url).not.toContain('+')
  })

  it('follows the club form layout', () => {
    const body = injuryEmailBody(report)
    const labels = ['Date: 08/11/2026', 'Time: 10:05', 'Location: Training', 'Staff: Flo, Dan',
      'Player [Full Name]: Henry', 'Age Group: U12', 'Parent/Guardian: Sarah', 'Contact No.: 07000 000000',
      'Incident Report:', 'Head Injury/Concussion?: Yes', 'Hospital/Ambulance?: No']
    let at = -1
    for (const l of labels) {
      const i = body.indexOf(l)
      expect(i, l).toBeGreaterThan(at)
      at = i
    }
    expect(body).toContain('First aid / treatment given: Sat out, ice pack')
    expect(body).toContain('Parents/guardians informed: Yes')
  })

  it('texts Bekah', () => {
    expect(concussionSms(report).startsWith('sms:07857301296?&body=')).toBe(true)
  })
})

describe('concussion protocol from a report', () => {
  it('starts on the day of injury with six open stages', () => {
    const p = protocolFromReport(report, 'con-1')
    expect(p.concussionDate).toBe('2026-11-08')
    expect(p.injuryReportId).toBe('inj-1')
    expect(p.stages).toHaveLength(6)
    expect(p.stages.every(s => !s.completed)).toBe(true)
    expect(earliestReturnDate(p)).toBe('2026-11-29')
  })
})

describe('injury email fixture', () => {
  const atMatch: InjuryReport = { ...report, location: 'Match', fixtureId: 'f1', fixtureLabel: '14 Sep vs Chingford (away)' }

  it('gives the fixture straight after the location', () => {
    const body = injuryEmailBody(atMatch)
    const loc = body.indexOf('Location: Match')
    const fixture = body.indexOf('Fixture: 14 Sep vs Chingford (away)')
    expect(loc).toBeGreaterThan(-1)
    expect(fixture).toBeGreaterThan(loc)
    expect(fixture).toBeLessThan(body.indexOf('Staff:'))
  })

  it('leaves the fixture line out for older reports and training', () => {
    expect(injuryEmailBody(report)).not.toContain('Fixture:')
    expect(injuryEmailBody({ ...report, location: 'Match' })).not.toContain('Fixture:')
  })

  it('reads where it happened in one line', () => {
    expect(injuryWhere(atMatch)).toBe('Match · 14 Sep vs Chingford (away)')
    expect(injuryWhere(report)).toBe('Training')
  })
})
