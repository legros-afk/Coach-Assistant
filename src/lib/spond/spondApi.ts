// Client wrapper for the Spond API via the /spond Cloudflare Function proxy.

async function proxy<T>(path: string, options?: {
  method?: string
  body?: unknown
  token?: string
}): Promise<T> {
  const res = await fetch('/spond', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      path,
      method: options?.method ?? 'GET',
      body: options?.body,
      token: options?.token,
    }),
  })
  const data = await res.json() as T & { error?: string; message?: string }
  if (!res.ok) {
    const d = data as Record<string, unknown>
    const detail = (typeof d.error === 'string' && d.error)
      || (typeof d.message === 'string' && d.message)
      || JSON.stringify(d)
    throw new Error(`Spond ${res.status}: ${detail}`)
  }
  return data
}

export interface SpondLoginResult {
  accessToken?: { token: string }
  loginToken?: string
}

export async function spondLogin(email: string, password: string): Promise<string> {
  const data = await proxy<SpondLoginResult>('auth2/login', {
    method: 'POST',
    body: { email, password },
  })
  const token = data.accessToken?.token ?? data.loginToken
  if (!token) throw new Error('Spond login succeeded but returned no token')
  return token
}

export interface SpondMember {
  id: string
  profile?: {
    id: string
    firstName: string
    lastName: string
  }
}

export interface SpondGroup {
  id: string
  name: string
  members: SpondMember[]
}

export async function spondGetGroups(token: string): Promise<SpondGroup[]> {
  return proxy<SpondGroup[]>('groups', { token })
}

export interface SpondEvent {
  id: string
  heading: string
  startTimestamp: string
  endTimestamp?: string
  responses: {
    acceptedIds: string[]
    declinedIds: string[]
    unansweredIds: string[]
  }
}

export async function spondGetEvents(token: string, groupId: string): Promise<SpondEvent[]> {
  const now = new Date().toISOString()
  return proxy<SpondEvent[]>(
    `sponds?groupId=${groupId}&includeComments=false&includeHidden=true&addProfileInfo=true&order=asc&max=20&minEndTimestamp=${encodeURIComponent(now)}`,
    { token },
  )
}

// ── creating events ───────────────────────────────────────────────────────────

export interface SpondEventDraft {
  groupId: string
  heading: string
  description?: string
  startTimestamp: string   // ISO, UTC
  endTimestamp: string     // ISO, UTC
}

// Spond has no public API. This payload follows the shape the community
// clients use against core/v1/sponds; it has not been verified against a live
// account from here, so the first call is worth making on a single fixture and
// checking in the Spond app. The proxy passes Spond's own error body straight
// back, which is what a rejected payload will show.
export async function spondCreateEvent(token: string, draft: SpondEventDraft): Promise<string> {
  const data = await proxy<{ id?: string }>('sponds', {
    method: 'POST',
    token,
    body: {
      heading: draft.heading,
      description: draft.description ?? '',
      spondType: 'EVENT',
      startTimestamp: draft.startTimestamp,
      endTimestamp: draft.endTimestamp,
      openEnded: false,
      commentsDisabled: false,
      maxAccepted: 0,
      visibility: 'INVITEES',
      participantsHidden: false,
      autoAccept: false,
      autoReminderType: 'DISABLED',
      attachments: [],
      recipients: {
        group: { id: draft.groupId, subGroups: [], members: [] },
      },
    },
  })
  if (!data.id) throw new Error('Spond accepted the event but returned no id')
  return data.id
}
