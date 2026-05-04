/// <reference types="@cloudflare/workers-types" />

interface Env {
  ANTHROPIC_API_KEY: string
}

interface SummariseRequest {
  opponent: string
  scoreUs: number
  scoreThem: number
  tryScorers: string[]
  teamLabel: string
  date: string
}

const SYSTEM_PROMPT = `You are writing a short, fun match summary for a grassroots U12 rugby \
team's WhatsApp group. The audience is parents and coaches.

Tone: warm, a little cheeky, encouraging. Like a friend who watched \
the match and is texting the group chat. Never mean, never sarcastic \
about the kids.

Style:
- Two to four short sentences. Tight, punchy.
- Always name the scorers if there are any.
- If we won, celebrate without gloating. If we lost, find the positive \
without being saccharine. If it was close, say so.
- One emoji maximum, only if it lands naturally.
- Refer to the team as "the boys" or "the lads" or by club name. \
Never use the children's names except to credit scorers.
- Don't invent events. Only use the facts in the data.

Output: just the summary text. No preamble, no quotation marks, no \
"here's a draft."`

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = await request.json() as SummariseRequest

  const result = body.scoreUs > body.scoreThem ? 'Win'
    : body.scoreUs < body.scoreThem ? 'Loss'
    : 'Draw'

  const scorerLine = body.tryScorers.length > 0
    ? body.tryScorers.join(', ')
    : 'none recorded'

  const userMessage = [
    `Date: ${body.date}`,
    `Match: Woodford RFC U12 Team ${body.teamLabel} vs ${body.opponent}`,
    `Result: ${result}`,
    `Score: Woodford ${body.scoreUs} tries – ${body.opponent} ${body.scoreThem} tries`,
    `Try scorers: ${scorerLine}`,
  ].join('\n')

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: userMessage }],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    return Response.json({ error: err }, { status: 502 })
  }

  const data = await res.json() as { content: Array<{ text: string }> }
  const summary = data.content[0]?.text?.trim() ?? ''
  return Response.json({ summary })
}
