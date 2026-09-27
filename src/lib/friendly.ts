// Plain-language messages for coaches. Everything technical (Drive, API keys,
// HTTP codes) stays in the code; the screen says what happened and what to do.

export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

/** A failed attempt to share something with the other coaches. */
export function friendlyShareError(raw: string | undefined): string {
  const msg = (raw ?? '').toLowerCase()
  if (isOffline() || msg.includes('network') || msg.includes('fetch') || msg.includes('load failed')) {
    return "No signal — it's saved on this phone and will be shared when you're back online."
  }
  if (msg.includes('pin') || msg.includes('401') || msg.includes('403') || msg.includes('unauthor') || msg.includes('code')) {
    return "The coach PIN on this phone isn't right. Check it in Coach setup."
  }
  return "Couldn't share just now — it's saved on this phone and we'll try again automatically."
}

/** A failed attempt to fetch the latest from the club. */
export function friendlySyncError(raw: string | undefined): string {
  const msg = (raw ?? '').toLowerCase()
  if (isOffline() || msg.includes('internet') || msg.includes('network') || msg.includes('fetch')) {
    return 'Offline — using saved copy'
  }
  if (msg.includes('folder') || msg.includes('anyone with the link')) {
    return 'Can’t update — ask your head coach'
  }
  return 'Couldn’t update — using saved copy'
}
