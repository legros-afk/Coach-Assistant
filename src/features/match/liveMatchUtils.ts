// Pure helpers and constants for the LiveMatch screen.
// Extracted to a .ts file so they can be unit-tested (they can't be tested
// while buried inside a .tsx component).

import type { PlayerMatchState } from '@/lib/events/types'

// ── brand constants ────────────────────────────────────────────────────────────

export const PURPLE        = 'var(--m-primary)'
export const PURPLE_DARK   = 'var(--m-on-primary-container)'
export const PURPLE_SOFT   = 'var(--m-primary-container)'
export const PURPLE_SOFTER = 'var(--m-primary-container)'
export const INK           = 'var(--m-on-surface)'

// ── game timing ────────────────────────────────────────────────────────────────

export const TOTAL_GAME_MS  = 40 * 60_000
export const HALF_LENGTH_MS = TOTAL_GAME_MS / 2
// Starts reward performance; the guarantee is that everyone plays at least
// a half, with changes batched at the break wherever possible.
export const MINIMUM_MS     = HALF_LENGTH_MS

// Parent-safe helper mode: subs and scores only. Persisted so a mid-game
// reload doesn't hand a parent the full coach UI.
export const HELPER_KEY = 'coach-helper-mode'

// ── pure helpers ──────────────────────────────────────────────────────────────

export function fmt(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function balanceColor(playerMs: number, avgMs: number): string {
  const diff = Math.abs(playerMs - avgMs)
  if (diff < 2 * 60_000) return 'var(--x-go)'
  if (diff < 5 * 60_000) return 'var(--x-pause)'
  return 'var(--m-error)'
}

export function liveMinMs(ps: PlayerMatchState, elapsedMs: number): number {
  return ps.status === 'on' && ps.currentStintStartedAtMs !== undefined
    ? ps.minutesPlayed + (elapsedMs - ps.currentStintStartedAtMs)
    : ps.minutesPlayed
}
