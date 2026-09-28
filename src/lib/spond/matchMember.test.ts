import { describe, expect, it } from 'vitest'
import { matchMember } from './spondStore'
import type { Player } from '@/lib/events/types'
import type { SpondMember } from './spondApi'

const p = (id: string, name: string): Player => ({ id, name, defaultGroup: 'back', eligibleGroups: ['back'] })
const players = [p('a', 'Alexander'), p('s', 'Seth'), p('hw', 'Henry W'), p('ht', 'Henry T')]

describe('matchMember', () => {
  it("uses the child's own name, not the parent's account attached to it", () => {
    const m: SpondMember = { id: '1', firstName: 'Seth', lastName: 'Fayinka', profile: { id: 'x', firstName: 'Charles', lastName: 'Fayinka' } }
    expect(matchMember(m, players)?.id).toBe('s')
  })
  it('matches a child with no account of their own', () => {
    expect(matchMember({ id: '2', firstName: 'Alexander', lastName: 'Smith' }, players)?.id).toBe('a')
  })
  it('tells players apart by surname initial', () => {
    expect(matchMember({ id: '3', firstName: 'Henry', lastName: 'Taylor' }, players)?.id).toBe('ht')
    expect(matchMember({ id: '4', firstName: 'Henry', lastName: 'Walker' }, players)?.id).toBe('hw')
  })
  it('does not guess when a first name is shared', () => {
    expect(matchMember({ id: '5', firstName: 'Henry', lastName: 'Brown' }, players)).toBeUndefined()
  })
})
