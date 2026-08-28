// localStorage keys and helpers for Spond credentials + state.

import type { Player } from '@/lib/events/types'
import type { SpondMember } from './spondApi'

export const SPOND_EMAIL_KEY    = 'coach-spond-email'
export const SPOND_PASS_KEY     = 'coach-spond-password'
export const SPOND_TOKEN_KEY    = 'coach-spond-token'
export const SPOND_GROUP_ID_KEY = 'coach-spond-group-id'
export const SPOND_GROUP_NAME_KEY = 'coach-spond-group-name'
export const SPOND_KICKOFF_KEY   = 'coach-spond-kickoff'
export const SPOND_DURATION_KEY  = 'coach-spond-duration'

// The club schedule carries dates but no times, so the kick-off has to come
// from the coach. These are only defaults — each event is built from them and
// can be corrected in Spond afterwards.
export const DEFAULT_KICKOFF  = '10:00'
export const DEFAULT_DURATION = 120  // minutes

export function getKickoffDefaults(): { kickOff: string; durationMins: number } {
  const kickOff = localStorage.getItem(SPOND_KICKOFF_KEY) || DEFAULT_KICKOFF
  const stored  = parseInt(localStorage.getItem(SPOND_DURATION_KEY) ?? '', 10)
  return { kickOff, durationMins: Number.isFinite(stored) && stored > 0 ? stored : DEFAULT_DURATION }
}

export function saveKickoffDefaults(kickOff: string, durationMins: number): void {
  localStorage.setItem(SPOND_KICKOFF_KEY, kickOff)
  localStorage.setItem(SPOND_DURATION_KEY, String(durationMins))
}

// Builds the UTC window Spond wants from a local fixture date and kick-off.
// Going through a local Date keeps BST/GMT correct — an October fixture and a
// January one at the same clock time are an hour apart in UTC.
export function eventWindow(date: string, kickOff: string, durationMins: number): { startTimestamp: string; endTimestamp: string } {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm]  = kickOff.split(':').map(Number)
  const start = new Date(y, m - 1, d, hh, mm, 0, 0)
  const end   = new Date(start.getTime() + durationMins * 60_000)
  return { startTimestamp: start.toISOString(), endTimestamp: end.toISOString() }
}

export interface SpondCreds {
  email: string
  password: string
  token: string
  groupId: string
  groupName: string
}

export function getSpondCreds(): SpondCreds {
  return {
    email:     localStorage.getItem(SPOND_EMAIL_KEY) ?? '',
    password:  localStorage.getItem(SPOND_PASS_KEY) ?? '',
    token:     localStorage.getItem(SPOND_TOKEN_KEY) ?? '',
    groupId:   localStorage.getItem(SPOND_GROUP_ID_KEY) ?? '',
    groupName: localStorage.getItem(SPOND_GROUP_NAME_KEY) ?? '',
  }
}

export function saveSpondCreds(email: string, password: string) {
  localStorage.setItem(SPOND_EMAIL_KEY, email)
  localStorage.setItem(SPOND_PASS_KEY, password)
  localStorage.removeItem(SPOND_TOKEN_KEY)
}

export function saveSpondToken(token: string) {
  localStorage.setItem(SPOND_TOKEN_KEY, token)
}

export function saveSpondGroup(id: string, name: string) {
  localStorage.setItem(SPOND_GROUP_ID_KEY, id)
  localStorage.setItem(SPOND_GROUP_NAME_KEY, name)
}

export function clearSpondToken() {
  localStorage.removeItem(SPOND_TOKEN_KEY)
}

export function clearSpondCreds() {
  [SPOND_EMAIL_KEY, SPOND_PASS_KEY, SPOND_TOKEN_KEY, SPOND_GROUP_ID_KEY, SPOND_GROUP_NAME_KEY]
    .forEach(k => localStorage.removeItem(k))
}

export function spondConfigured(): boolean {
  return !!(localStorage.getItem(SPOND_EMAIL_KEY) && localStorage.getItem(SPOND_GROUP_ID_KEY))
}

// Match a Spond member to an app player by name.
// Spond has firstName + lastName; app uses short names like "Henry W".
export function matchMember(member: SpondMember, players: Player[]): Player | undefined {
  if (!member.profile) return undefined
  const { firstName, lastName } = member.profile
  if (!firstName) return undefined
  const fullLower  = `${firstName} ${lastName}`.toLowerCase().trim()
  const initLower  = `${firstName} ${lastName.charAt(0)}`.toLowerCase().trim()
  const firstLower = firstName.toLowerCase().trim()

  return players.find(p => {
    const n = p.name.toLowerCase().trim()
    return n === fullLower || n === initLower || n.startsWith(firstLower + ' ')
  })
}

// Extract opponent name from a Spond event heading.
export function extractOpponent(heading: string): string {
  const m = heading.match(/\bvs\.?\s+(.+)/i)
  return m ? m[1].trim() : heading.trim()
}
