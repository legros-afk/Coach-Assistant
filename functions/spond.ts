/// <reference types="@cloudflare/workers-types" />

// Proxy for the unofficial Spond API — needed to avoid CORS from the browser.
// Accepts POST { path, method?, body?, token? } and forwards to api.spond.com.

interface SpondProxyRequest {
  path: string
  method?: string
  body?: unknown
  token?: string
}

export const onRequestPost: PagesFunction = async ({ request }) => {
  let payload: SpondProxyRequest
  try {
    payload = await request.json() as SpondProxyRequest
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { path, method = 'GET', body, token } = payload

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`https://api.spond.com/core/v1/${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  const text = await res.text()
  let data: unknown
  try { data = JSON.parse(text) } catch { data = { raw: text } }

  return Response.json(data, { status: res.status })
}
