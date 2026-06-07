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
  unmatched: string[]   // Spond member display names that couldn't be matched to a squad player
}

export async function getSpondAvailability(
  spondEventId: string,
  players: Player[],
): Promise<SpondAvailability> {
  const { groupId } = getSpondCreds()
  if (!groupId) return { accepted: [], declined: [], unanswered: [], unmatched: [] }

  const [groups, events] = await withFreshToken(token =>
    Promise.all([spondGetGroups(token), spondGetEvents(token, groupId)])
  )

  const group = groups.find(g => g.id === groupId)
  const event = events.find(e => e.id === spondEventId)
  if (!group || !event) return { accepted: [], declined: [], unanswered: [], unmatched: [] }

  // Single pass: match every member who has a response, collect unmatched names.
  const allResponseIds = new Set([
    ...event.responses.acceptedIds,
    ...event.responses.declinedIds,
    ...event.responses.unansweredIds,
  ])
  const memberToPlayerId = new Map<string, string>()
  const unmatchedNames: string[] = []

  for (const member of group.members) {
    if (!allResponseIds.has(member.id)) continue
    const player = matchMember(member, players)
    if (player) {
      memberToPlayerId.set(member.id, player.id)
    } else {
      const name = [member.profile.firstName, member.profile.lastName].filter(Boolean).join(' ').trim()
      if (name) unmatchedNames.push(name)
    }
  }

  const idsFor = (memberIds: string[]) =>
    memberIds.map(id => memberToPlayerId.get(id)).filter((id): id is string => id !== undefined)

  return {
    accepted:   idsFor(event.responses.acceptedIds),
    declined:   idsFor(event.responses.declinedIds),
    unanswered: idsFor(event.responses.unansweredIds),
    unmatched:  unmatchedNames,
  }
}
