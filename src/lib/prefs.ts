// Small per-device preferences, kept in one place so Settings and the screens
// that use them agree.

import { isFormat } from '@/lib/domain/validateComposition'

const FORMAT_KEY = 'coach-players-per-side'

/** Format new fixtures start with (each fixture can still be switched). */
export function getDefaultFormat(): number {
  const n = parseInt(localStorage.getItem(FORMAT_KEY) ?? '12', 10)
  return isFormat(n) ? n : 12
}

export function setDefaultFormat(n: number): void {
  localStorage.setItem(FORMAT_KEY, String(isFormat(n) ? n : 12))
}
