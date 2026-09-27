import { describe, expect, it, vi } from 'vitest'
vi.mock('@/lib/db/db', () => ({ db: {} }))
vi.mock('@/lib/drive/drivePublish', () => ({ publishMatch: vi.fn() }))
import { clockFromEvents } from './useMatchStore'
import type { MatchEvent } from '@/lib/events/types'

const at = (min: number) => new Date(Date.UTC(2026, 9, 4, 10, min)).toISOString()

describe('clockFromEvents', () => {
  it('keeps a running clock running from its last start', () => {
    const events: MatchEvent[] = [
      { id: '1', ts: at(0), type: 'CLOCK_START', payload: { half: 1 } },
      { id: '2', ts: at(20), type: 'HALF_END', payload: { half: 1, elapsedMs: 20 * 60_000 } },
      { id: '3', ts: at(25), type: 'CLOCK_START', payload: { half: 2 } },
      { id: '4', ts: at(30), type: 'TRY_US', payload: { elapsedMs: 25 * 60_000 } },
    ]
    const c = clockFromEvents(events)
    expect(c.running).toBe(true)
    expect(c.baseElapsedMs).toBe(20 * 60_000)
    expect(c.startedAt).toBe(Date.parse(at(25)))
  })

  it('reports a stopped clock at the time it stopped', () => {
    const events: MatchEvent[] = [
      { id: '1', ts: at(0), type: 'CLOCK_START', payload: { half: 1 } },
      { id: '2', ts: at(7), type: 'CLOCK_PAUSE', payload: { elapsedMs: 7 * 60_000 } },
    ]
    expect(clockFromEvents(events)).toEqual({ running: false, baseElapsedMs: 7 * 60_000, startedAt: null })
  })
})
