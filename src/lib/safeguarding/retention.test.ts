import { describe, expect, it } from 'vitest'
import { injuryExpired, isExpired, protocolExpired } from './retention'

describe('one-year retention', () => {
  it('keeps records up to 365 days old and drops older ones', () => {
    expect(isExpired('2025-11-08', '2026-11-08')).toBe(false)   // exactly 365 days
    expect(isExpired('2025-11-07', '2026-11-08')).toBe(true)    // 366 days
    expect(isExpired(undefined, '2026-11-08')).toBe(false)
  })
  it('ages injuries by reportedAt and protocols by concussionDate', () => {
    expect(injuryExpired({ reportedAt: '2025-11-01T12:00:00Z' }, '2026-11-08')).toBe(true)
    expect(injuryExpired({ reportedAt: '2026-01-01T12:00:00Z' }, '2026-11-08')).toBe(false)
    expect(protocolExpired({ concussionDate: '2025-10-01' }, '2026-11-08')).toBe(true)
    expect(protocolExpired({ concussionDate: '2026-10-01' }, '2026-11-08')).toBe(false)
  })
})
