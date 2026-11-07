import { describe, expect, it } from 'vitest'
import { pitchOrder } from './pitchOrder'
import type { MatchEvent, TeamSheet } from '../events/types'

const sheet: TeamSheet = {
  id: 't', label: 'A', starters: { forwards: ['f1', 'f2'], backs: ['b1', 'b2'], scrumhalf: 'n9' },
  bench: ['x', 'y'], unavailable: [],
}
const ev = (e: Omit<MatchEvent, 'id' | 'ts'>, i: number) => ({ ...e, id: String(i), ts: '' }) as MatchEvent

describe('pitchOrder', () => {
  it('starts forwards, 9, backs', () => {
    expect(pitchOrder(sheet, [])).toEqual(['f1', 'f2', 'n9', 'b1', 'b2'])
  })

  it('puts a sub in the place of the player they replaced', () => {
    const events = [
      ev({ type: 'SUB_BATCH', payload: { offIds: ['f2', 'b1'], onIds: ['x', 'y'], elapsedMs: 1 } }, 1),
      // f2 comes back on for x later: back in that same place
      ev({ type: 'SUB_BATCH', payload: { offIds: ['x'], onIds: ['f2'], elapsedMs: 2 } }, 2),
    ]
    expect(pitchOrder(sheet, events)).toEqual(['f1', 'f2', 'n9', 'y', 'b2'])
  })

  it('handles blood replacements and players sent on to a short pitch', () => {
    const events = [
      ev({ type: 'BLOOD_OFF', payload: { playerId: 'b2', replacementId: 'x', elapsedMs: 1 } }, 1),
      ev({ type: 'SUB_BATCH', payload: { offIds: [], onIds: ['y'], elapsedMs: 2 } }, 2),
    ]
    expect(pitchOrder(sheet, events)).toEqual(['f1', 'f2', 'n9', 'b1', 'x', 'y'])
  })
})
