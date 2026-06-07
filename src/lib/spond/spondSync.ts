// Higher-level Spond helpers used by the app UI.

import { spondLogin, spondGetGroups, spondGetEvents } from './spondApi'
import { getSpondCreds, saveSpondToken, clearSpondToken, matchMember } from './spondStore'
import type { Player } from '@/lib/events/types'

export async function ensureToken(forceRefresh = false): Promise<string> {
  const { email, password, token } = getSpondCreds()
  if (token && !forceRefresh) return token
  if (!email || !password) throw new Error('Spond credentials not set — open settings')
  const newToken = await spondLogin(email, password)
  saveSpondToken(newToken)
  return newToken
}

function isUnauthorised(e: unknown): boolean {
  return e instanceof Error && (e.message.includes('401') || e.message.toLowerCase().includes('unauthorized'))
}

// Runs fn with the current token. On 401 clears the cached token,
// re-logs in once, and retries. Any other error propagates as-is.
async function withFreshToken<T>(fn: (token: string) => Promise<T>): Promise<T> {
  const token = await ensureToken()
  try {
    return await fn(token)
  } catch (e) {
    if (!isUnauthorised(e)) throw e
    clearSpondToken()
    const fresh = await ensureToken(true)
    return fn(fresh)
  }
}

export interface SpondAvailability {
  accepted: string[]    // app player IDs who accepted
  declined: string[]    // app player IDs who declined
  unanswered: string[]  // app player IDs who haven't responded
}

export async function getSpondAvailability(
  spondEventId: string,
  players: Player[],
): Promise<SpondAvailability> {
  const { groupId } = getSpondCreds()
  if (!groupId) return { accepted: [], declined: [], unanswered: [] }

  const [groups, events] = await withFreshToken(token =>
    Promise.all([spondGetGroups(token), spondGetEvents(token, groupId)])
  )

  const group = groups.find(g => g.id === groupId)
  const event = events.find(e => e.id === spondEventId)
  if (!group || !event) return { accepted: [], declined: [], unanswered: [] }

  const toPlayerIds = (ids: string[]) => {
    const set = new Set(ids)
    return group.members
      .filter(m => set.has(m.id))
      .map(m => matchMember(m, players))
      .filter((p): p is Player => p !== undefined)
      .map(p => p.id)
  }

  return {
    accepted:   toPlayerIds(event.responses.acceptedIds),
    declined:   toPlayerIds(event.responses.declinedIds),
    unanswered: toPlayerIds(event.responses.unansweredIds),
  }
}
