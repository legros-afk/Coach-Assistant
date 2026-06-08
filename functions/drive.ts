/// <reference types="@cloudflare/workers-types" />

// Proxy for Google Drive API — avoids CORS and HTTP referrer restrictions.
// Accepts GET /drive?path=<relative-drive-path>

interface Env {
  GOOGLE_API_KEY: string
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const apiKey = env.GOOGLE_API_KEY
  if (!apiKey) return Response.json({ error: 'Drive API key not configured on server' }, { status: 503 })

  const url  = new URL(request.url)
  const path = url.searchParams.get('path') ?? ''
  if (!path) return Response.json({ error: 'Missing path' }, { status: 400 })

  const sep      = path.includes('?') ? '&' : '?'
  const driveUrl = `https://www.googleapis.com/drive/v3/${path}${sep}key=${apiKey}`

  const res  = await fetch(driveUrl, { headers: { Accept: 'application/json' } })
  const text = await res.text()
  let data: unknown
  try { data = JSON.parse(text) } catch { data = { raw: text } }

  return Response.json(data, { status: res.status })
}
