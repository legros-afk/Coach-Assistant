import { describe, expect, it } from 'vitest'
import { refitToFormat } from './refitFormat'
import type { Group, ID, Player } from '../events/types'

const p = (id: string, g: Group, also: Group[] = []): Player =>
  ({ id, name: id, defaultGroup: g, eligibleGroups: [g, ...also] })

// Team A at 10-a-side: 5 forwards, 4 backs, 1 scrum-half; three on the bench
const forwards = ['f1', 'f2', 'f3', 'f4', 'f5'].map(id => p(id, 'forward'))
const backs = ['b1', 'b2', 'b3', 'b4'].map(id => p(id, 'back'))
const sh = p('sh', 'scrumhalf')
const bench = [p('xb1', 'back'), p('xb2', 'back'), p('xf', 'forward', ['back'])]
const players = [...forwards, ...backs, sh, ...bench]

const tenASide = () => {
  const m = new Map<ID, 'A' | 'bench-A'>()
  for (const x of [...forwards, ...backs, sh]) m.set(x.id, 'A')
  for (const x of bench) m.set(x.id, 'bench-A')
  return m
}

describe('refitToFormat', () => {
  it('10 → 12 brings the two least-played backs off the bench', () => {
    const r = refitToFormat({
      players, assignments: tenASide(), groupOverrides: new Map(), playersPerSide: 12,
      played: new Map([['xb1', 30], ['xb2', 10], ['xf', 0]]), teamCount: 1,
    })
    // xf has played least but is a forward covering back, so natural backs go first
    expect(r.up.map(u => u.id)).toEqual(['xb2', 'xb1'])
    expect(r.groups.get('xb1')).toBe('back')
    expect(r.down).toEqual([])
    expect(r.short.A).toBe(0)
  })

  it('uses cover players when there are no natural backs left, and says when it is still short', () => {
    const assignments = tenASide()
    assignments.set('xb1', 'unavailable' as never)
    assignments.set('xb2', 'unavailable' as never)
    const r = refitToFormat({
      players, assignments, groupOverrides: new Map(), playersPerSide: 12, played: new Map(), teamCount: 1,
    })
    expect(r.up.map(u => u.id)).toEqual(['xf'])
    expect(r.groups.get('xf')).toBe('back')
    expect(r.short.A).toBe(1)
  })

  it('12 → 10 sits the two most-played backs down', () => {
    const assignments = tenASide()
    assignments.set('xb1', 'A')
    assignments.set('xb2', 'A')
    const r = refitToFormat({
      players, assignments, groupOverrides: new Map(), playersPerSide: 10,
      played: new Map([['b3', 50], ['xb2', 40]]), teamCount: 1,
    })
    expect(r.down.map(d => d.id)).toEqual(['b3', 'xb2'])
    expect(r.assignments.get('b3')).toBe('bench-A')
    expect(r.up).toEqual([])
  })

  it('leaves a team with no starters alone', () => {
    const assignments = new Map<ID, 'bench-A'>(players.map(x => [x.id, 'bench-A']))
    const r = refitToFormat({
      players, assignments, groupOverrides: new Map(), playersPerSide: 12, played: new Map(), teamCount: 2,
    })
    expect(r.assignments.size).toBe(0)
  })
})
