// Higher-level Spond helpers used by the app UI.

import { spondLogin, spondGetGroups, spondGetEvents } from './spondApi'
import { getSpondCreds, saveSpondToken, matchMember } from './spondStore'
import type { Player } from '@/lib/events/types'

export async function ensureToken(): Promise<string> {
  const { email, password, token } = getSpondCreds()
  if (token) return token
  if (!email || !password) throw new Error('Spond credentials not set — open settings')
  const newToken = await spondLogin(email, password)
  saveSpondToken(newToken)
  return newToken
}

// Returns app player IDs that have declined the given Spond event.
export async function getSpondUnavailablePlayers(spondEventId: string, players: Player[]): Promise<string[]> {
  const { groupId } = getSpondCreds()
  if (!groupId) return []

  const token = await ensureToken()
  const [groups, events] = await Promise.all([
    spondGetGroups(token),
    spondGetEvents(token, groupId),
  ])

  const group = groups.find(g => g.id === groupId)
  const event = events.find(e => e.id === spondEventId)
  if (!group || !event) return []

  const declinedSet = new Set(event.responses.declinedIds)
  return group.members
    .filter(m => declinedSet.has(m.id))
    .map(m => matchMember(m, players))
    .filter((p): p is Player => p !== undefined)
    .map(p => p.id)
}
