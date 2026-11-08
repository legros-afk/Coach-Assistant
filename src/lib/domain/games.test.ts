import { describe, expect, it } from 'vitest'
import { gameId, gamesBySheet, hasEnded, manualResultEvents, nextGame, scoreOf } from './games'
import type { Match } from '../events/types'

const match = (id: string, teamSheetId: string, game?: number): Match => ({
  id, fixtureId: 'f', teamSheetId, opponent: 'X', events: [], version: 1, ...(game ? { game } : {}),
})

describe('games', () => {
  it('keeps game 1 on the team sheet ID, so earlier matches still load', () => {
    expect(gameId('ts1', 1)).toBe('ts1')
    expect(gameId('ts1', 2)).toBe('ts1-g2')
  })

  it('groups games by team and orders them, treating no number as game 1', () => {
    const map = gamesBySheet([match('ts1-g2', 'ts1', 2), match('ts2', 'ts2'), match('ts1', 'ts1')])
    expect(map.get('ts1')!.map(m => m.id)).toEqual(['ts1', 'ts1-g2'])
    expect(nextGame(map.get('ts1')!)).toBe(3)
    expect(nextGame(map.get('ts2')!)).toBe(2)
    expect(nextGame([])).toBe(1)
  })

  it('turns a typed-in result into a finished match with the right score', () => {
    const m = { ...match('ts1-g2', 'ts1', 2), events: manualResultEvents(['p1', 'p1', undefined], 1, '2026-10-04T12:00:00.000Z') }
    expect(hasEnded(m)).toBe(true)
    expect(scoreOf(m)).toEqual({ us: 3, them: 1 })
    expect(new Set(m.events.map(e => e.id)).size).toBe(m.events.length)
  })
})
