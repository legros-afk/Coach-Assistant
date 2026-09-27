import { describe, expect, it } from 'vitest'
import { effectiveAssignment } from './SquadPicker'

describe('effectiveAssignment', () => {
  it('treats an unpicked player as Bench when there is one team', () => {
    expect(effectiveAssignment(null, 1)).toBe('bench-A')
    expect(effectiveAssignment(undefined, 1)).toBe('bench-A')
  })

  it('leaves an unpicked player unpicked when there are two teams', () => {
    expect(effectiveAssignment(null, 2)).toBeNull()
  })

  it('never changes a deliberate choice', () => {
    expect(effectiveAssignment('A', 1)).toBe('A')
    expect(effectiveAssignment('unavailable', 1)).toBe('unavailable')
    expect(effectiveAssignment('bench-B', 2)).toBe('bench-B')
  })
})
