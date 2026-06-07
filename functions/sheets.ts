/// <reference types="@cloudflare/workers-types" />

// Proxy for Google Sheets API — avoids CORS and HTTP referrer restrictions.
// Accepts GET /sheets?path=<spreadsheetId/values/range>

interface Env {
  GOOGLE_API_KEY: string
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const apiKey = env.GOOGLE_API_KEY
  if (!apiKey) return Response.json({ error: 'Sheets API key not configured on server' }, { status: 503 })

  const url  = new URL(request.url)
  const path = url.searchParams.get('path') ?? ''
  if (!path) return Response.json({ error: 'Missing path' }, { status: 400 })

  const sep       = path.includes('?') ? '&' : '?'
  const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${path}${sep}key=${apiKey}`

  const res  = await fetch(sheetsUrl)
  const text = await res.text()
  let data: unknown
  try { data = JSON.parse(text) } catch { data = { raw: text } }

  return Response.json(data, { status: res.status })
}
