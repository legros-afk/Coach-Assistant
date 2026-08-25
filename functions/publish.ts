/// <reference types="@cloudflare/workers-types" />

// Writes fixture/squad/match JSON into the shared Drive folder using a Google
// service account, so any coach can publish without signing in to Drive as
// the head coach. Gated by a shared club code (CLUB_PUBLISH_CODE) — anyone
// who knows it can write into the folder the service account has access to,
// nothing more.
//
// Accepts POST { code, folderId, subfolder?, fileName, content }

interface Env {
  GOOGLE_SERVICE_ACCOUNT_EMAIL: string
  GOOGLE_SERVICE_ACCOUNT_KEY: string
  CLUB_PUBLISH_CODE: string
}

interface PublishRequest {
  code: string
  folderId: string
  subfolder?: string
  fileName: string
  content: unknown
}

const DRIVE_BASE  = 'https://www.googleapis.com/drive/v3'
const UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3'
const TOKEN_URL   = 'https://oauth2.googleapis.com/token'
const BOUNDARY    = '==coach_publish_boundary=='
const FOLDER_MIME = 'application/vnd.google-apps.folder'
const SCOPE       = 'https://www.googleapis.com/auth/drive'

// ── service-account access token, memoized per isolate ──────────────────────

let cachedToken: { token: string; exp: number } | null = null

function base64url(bytes: ArrayBuffer | Uint8Array | string): string {
  const buf = typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes
  const arr = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let bin = ''
  for (const b of arr) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function pemToPkcs8(pem: string): ArrayBuffer {
  const normalized = pem.includes('\\n') ? pem.replace(/\\n/g, '\n') : pem
  const body = normalized
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '')
  const bin = atob(body)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes.buffer
}

async function getAccessToken(env: Env): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  if (cachedToken && cachedToken.exp > now + 60) return cachedToken.token

  const header = { alg: 'RS256', typ: 'JWT' }
  const claim = {
    iss: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  }
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claim))}`

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToPkcs8(env.GOOGLE_SERVICE_ACCOUNT_KEY),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signingInput))
  const jwt = `${signingInput}.${base64url(signature)}`

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  if (!res.ok) throw new Error(`Google token exchange failed (${res.status}): ${(await res.text()).slice(0, 300)}`)
  const data = await res.json() as { access_token: string; expires_in: number }
  cachedToken = { token: data.access_token, exp: now + data.expires_in }
  return data.access_token
}

// ── Drive helpers ────────────────────────────────────────────────────────────

async function driveJson<T>(url: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Drive API error (${res.status}): ${(await res.text()).slice(0, 300)}`)
  return res.json() as Promise<T>
}

async function findFileId(name: string, parentId: string, token: string, mimeType?: string): Promise<string | null> {
  const clauses = [`'${parentId}' in parents`, `name = '${name.replace(/'/g, "\\'")}'`, 'trashed = false']
  if (mimeType) clauses.push(`mimeType = '${mimeType}'`)
  const q = encodeURIComponent(clauses.join(' and '))
  const data = await driveJson<{ files: Array<{ id: string }> }>(
    `${DRIVE_BASE}/files?q=${q}&fields=files(id)`, token,
  )
  return data.files[0]?.id ?? null
}

async function ensureSubfolder(name: string, parentId: string, token: string): Promise<string> {
  const existing = await findFileId(name, parentId, token, FOLDER_MIME)
  if (existing) return existing
  const created = await driveJson<{ id: string }>(`${DRIVE_BASE}/files`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parentId] }),
  })
  return created.id
}

function multipartBody(metadata: object, content: unknown): string {
  return [
    `--${BOUNDARY}`, 'Content-Type: application/json; charset=UTF-8', '',
    JSON.stringify(metadata),
    `--${BOUNDARY}`, 'Content-Type: application/json; charset=UTF-8', '',
    JSON.stringify(content),
    `--${BOUNDARY}--`,
  ].join('\r\n')
}

async function upsertFile(name: string, content: unknown, parentId: string, token: string): Promise<string> {
  // Name-based lookup, not a client-cached file ID — any coach's device finds
  // the same file, so two coaches publishing the same fixture update in
  // place instead of creating duplicates.
  const existing = await findFileId(name, parentId, token)
  const url = existing
    ? `${UPLOAD_BASE}/files/${existing}?uploadType=multipart`
    : `${UPLOAD_BASE}/files?uploadType=multipart`
  const data = await driveJson<{ id: string }>(url, token, {
    method: existing ? 'PATCH' : 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${BOUNDARY}` },
    body: multipartBody(existing ? { name } : { name, parents: [parentId] }, content),
  })
  return data.id
}

// ── handler ───────────────────────────────────────────────────────────────────

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !env.GOOGLE_SERVICE_ACCOUNT_KEY || !env.CLUB_PUBLISH_CODE) {
    return Response.json({ ok: false, error: 'Publishing is not configured on the server yet.' }, { status: 503 })
  }

  let payload: PublishRequest
  try {
    payload = await request.json() as PublishRequest
  } catch {
    return Response.json({ ok: false, error: 'Invalid request body' }, { status: 400 })
  }

  if (payload.code !== env.CLUB_PUBLISH_CODE) {
    return Response.json({ ok: false, error: 'Wrong club code.' }, { status: 403 })
  }
  if (!payload.folderId || !payload.fileName || payload.content === undefined) {
    return Response.json({ ok: false, error: 'Missing folderId, fileName, or content.' }, { status: 400 })
  }

  try {
    const token = await getAccessToken(env)
    const parentId = payload.subfolder
      ? await ensureSubfolder(payload.subfolder, payload.folderId, token)
      : payload.folderId
    await upsertFile(payload.fileName, payload.content, parentId, token)
    return Response.json({ ok: true })
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : 'Publish failed' }, { status: 502 })
  }
}
