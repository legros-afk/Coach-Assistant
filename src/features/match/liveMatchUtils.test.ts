import { describe, it, expect } from 'vitest'
import { fmt, balanceColor, liveMinMs, TOTAL_GAME_MS, HALF_LENGTH_MS, MINIMUM_MS } from './liveMatchUtils'
import type { PlayerMatchState } from '@/lib/events/types'

describe('fmt', () => {
  it('formats milliseconds as m:ss', () => {
    expect(fmt(0)).toBe('0:00')
    expect(fmt(59_000)).toBe('0:59')
    expect(fmt(60_000)).toBe('1:00')
    expect(fmt(1_000_000)).toBe('16:40')
  })

  it('pads seconds to two digits', () => {
    expect(fmt(5_000)).toBe('0:05')
    expect(fmt(65_000)).toBe('1:05')
  })
})

describe('balanceColor', () => {
  it('is green when within 2 minutes of the average', () => {
    expect(balanceColor(0, 0)).toBe('var(--x-go)')
    expect(balanceColor(60_000, 0)).toBe('var(--x-go)')
    expect(balanceColor(119_999, 0)).toBe('var(--x-go)')
  })

  it('is amber between 2 and 5 minutes off', () => {
    expect(balanceColor(120_000, 0)).toBe('var(--x-pause)')
    expect(balanceColor(299_999, 0)).toBe('var(--x-pause)')
  })

  it('is red at 5 minutes off or more', () => {
    expect(balanceColor(300_000, 0)).toBe('var(--m-error)')
    expect(balanceColor(600_000, 0)).toBe('var(--m-error)')
  })

  it('treats over-played and under-played symmetrically', () => {
    expect(balanceColor(120_000, 0)).toBe(balanceColor(0, 120_000))
    expect(balanceColor(300_000, 0)).toBe(balanceColor(0, 300_000))
  })
})

describe('liveMinMs', () => {
  const base: PlayerMatchState = {
    status: 'on',
    minutesPlayed: 600_000,                  // 10:00 banked before the current stint
    currentStintStartedAtMs: 1_000_000,      // current stint started at 16:40 of game time
    activeGroup: 'forward',
    triesScored: 0,
    hooks: 0,
  }

  it('adds elapsed time of the current stint for an on-pitch player', () => {
    // 100s into the current stint → 10:00 + 1:40 = 11:40
    expect(liveMinMs(base, 1_100_000)).toBe(700_000)
  })

  it('returns only the banked minutes when the player is not on pitch', () => {
    const off: PlayerMatchState = { ...base, status: 'bench', currentStintStartedAtMs: undefined }
    expect(liveMinMs(off, 1_100_000)).toBe(600_000)
  })

  it('returns only banked minutes when currentStintStartedAtMs is missing', () => {
    const noStint: PlayerMatchState = { ...base, currentStintStartedAtMs: undefined }
    expect(liveMinMs(noStint, 1_100_000)).toBe(600_000)
  })
})

describe('game timing constants', () => {
  it('models a 40-minute U12 game in two 20-minute halves', () => {
    expect(TOTAL_GAME_MS).toBe(40 * 60_000)
    expect(HALF_LENGTH_MS).toBe(20 * 60_000)
    expect(MINIMUM_MS).toBe(HALF_LENGTH_MS) // every player gets at least a half
  })
})
