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
