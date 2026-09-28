// Light / dark: follow the phone by default, or a coach can pin one in
// Settings (e.g. always Light for bright match days).

export type Appearance = 'system' | 'light' | 'dark'
const KEY = 'coach-appearance'

export function getAppearance(): Appearance {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch { return 'system' }
}

export function applyAppearance(a: Appearance = getAppearance()): void {
  const root = document.documentElement
  if (a === 'system') delete root.dataset.theme
  else root.dataset.theme = a
}

export function setAppearance(a: Appearance): void {
  try { localStorage.setItem(KEY, a) } catch { /* ignore */ }
  applyAppearance(a)
}
