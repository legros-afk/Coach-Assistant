// localStorage keys and helpers for Spond credentials + state.

import type { Player } from '@/lib/events/types'
import type { SpondMember } from './spondApi'

export const SPOND_EMAIL_KEY    = 'coach-spond-email'
export const SPOND_PASS_KEY     = 'coach-spond-password'
export const SPOND_TOKEN_KEY    = 'coach-spond-token'
export const SPOND_GROUP_ID_KEY = 'coach-spond-group-id'
export const SPOND_GROUP_NAME_KEY = 'coach-spond-group-name'

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
