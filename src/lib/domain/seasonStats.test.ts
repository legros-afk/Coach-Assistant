import { describe, expect, it } from 'vitest'
import { seasonStats } from './seasonStats'
import { manualResultEvents } from './games'
import type { Fixture, Match, MatchEvent, Player, TeamSheet } from '../events/types'

const players: Player[] = [
  { id: 'a', name: 'A', defaultGroup: 'forward', eligibleGroups: ['forward'] },
  { id: 'b', name: 'B', defaultGroup: 'back', eligibleGroups: ['back'] },
]
const sheet = (id: string): TeamSheet => ({
  id, label: 'A', starters: { forwards: ['a'], backs: [], scrumhalf: '' }, bench: ['b'], unavailable: [],
})
const fixture = (id: string, date: string): Fixture => ({
  id, date, opponent: 'X', teamSheets: [sheet(`ts-${id}`)], playersPerSide: 12, updatedAt: '', version: 1,
})
const at = (min: number) => new Date(Date.UTC(2026, 8, 1, 10, min)).toISOString()
const played = (fid: string): Match => ({
  id: `ts-${fid}`, fixtureId: fid, teamSheetId: `ts-${fid}`, opponent: 'X', version: 1,
  events: [
    { id: '1', ts: at(0), type: 'CLOCK_START', payload: { half: 1 } },
    { id: '2', ts: at(20), type: 'MATCH_END', payload: { elapsedMs: 20 * 60_000 } },
  ] as MatchEvent[],
})

describe('seasonStats counting-from date', () => {
  const fixtures = [fixture('pre', '2026-09-20'), fixture('real', '2026-10-04')]
  const matches = [played('pre'), played('real')]

  it('counts every match this season without a reset date', () => {
    const s = seasonStats(fixtures, matches, players, '2026-27')
    expect(s.get('a')).toMatchObject({ games: 2, starts: 2, minutes: 40 })
  })

  it('ignores matches before the reset date', () => {
    const s = seasonStats(fixtures, matches, players, '2026-27', '2026-09-28')
    expect(s.get('a')).toMatchObject({ games: 1, starts: 1, minutes: 20 })
  })
})

describe('seasonStats with two games for one team', () => {
  const fixtures = [fixture('day', '2026-10-04')]
  const game2: Match = {
    id: 'ts-day-g2', fixtureId: 'day', teamSheetId: 'ts-day', opponent: 'X', game: 2, manual: true, version: 1,
    events: manualResultEvents(['b', 'a', undefined], 1, at(60)),
  }

  it('counts both games, and tries from a result typed in afterwards', () => {
    const s = seasonStats(fixtures, [played('day'), game2], players, '2026-27')
    expect(s.get('a')).toMatchObject({ games: 2, starts: 2, minutes: 20, tries: 1 })
    // Bench, no minutes in either game, but scored in the typed-in one
    expect(s.get('b')).toMatchObject({ games: 1, starts: 0, minutes: 0, tries: 1 })
  })
})
