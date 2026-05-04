/// <reference types="@cloudflare/workers-types" />

interface Env {
  GOOGLE_AI_API_KEY: string
}

interface SummariseRequest {
  opponent: string
  scoreUs: number
  scoreThem: number
  tryScorers: string[]
  teamLabel: string
  date: string
  subsCount: number
  playersUsed: number
}

const SYSTEM_PROMPT = `You write short, fun match reports for a U12 grassroots rugby team's WhatsApp group. The audience is the kids' parents.

Your job: turn a few facts into 2-3 sentences that sound like a friend texting the group chat after the game. Warm, lightly cheeky, real. Not a press release. Not a school newsletter.

Follow the voice in the examples below. The data tells you what happened — you decide how to say it.

---

Example 1.
Data: Woodford 4 — Saints 2. Try scorers: Henry W (2), Tom B, Lewis. Result: win.
Output: Cracking afternoon at Woodford, the lads putting 4 past Saints. Henry W with a brace and Tom B and Lewis getting on the score sheet too. Heads high, boys 💪

Example 2.
Data: Woodford 1 — Harlequins 3. Try scorers: Lewis. Result: loss.
Output: Tough one against a sharp Harlequins side, 3-1. Lewis grabbed a consolation and the boys never stopped trying — plenty to take into next week.

Example 3.
Data: Woodford 2 — Wasps 2. Try scorers: Khan, Patel. Result: draw.
Output: Honours even at home to Wasps, 2-2. Khan and Patel both crossed and Woodford had to dig in late to hold the draw. Proper grassroots scrap.

Example 4.
Data: Woodford 5 — Bees 0. Try scorers: Henry W, Tom B (2), Patel, Khan. Result: win.
Output: Statement performance from the boys, running in 5 unanswered against Bees. Tom B helped himself to a brace, with Henry W, Patel and Khan all getting in on the act. Lovely stuff.

---

Now write the report for this match.`

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = await request.json() as SummariseRequest

  const result = body.scoreUs > body.scoreThem ? 'Win'
    : body.scoreUs < body.scoreThem ? 'Loss'
    : 'Draw'

  const scorerLine = body.tryScorers.length > 0
    ? body.tryScorers.join(', ')
    : 'none'

  const tryWord = (n: number) => n === 1 ? '1 try' : `${n} tries`

  const userMessage = [
    `Date: ${body.date}`,
    `Woodford RFC U12 (Team ${body.teamLabel}) vs ${body.opponent}`,
    `Result: ${result}`,
    `Final score: Woodford ${tryWord(body.scoreUs)} – ${body.opponent} ${tryWord(body.scoreThem)}`,
    `Try scorers: ${scorerLine}`,
    `Players used: ${body.playersUsed}`,
    `Substitutions made: ${body.subsCount}`,
  ].join('\n')

  const model = 'gemini-2.5-flash'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GOOGLE_AI_API_KEY}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ parts: [{ text: userMessage }] }],
      generationConfig: { maxOutputTokens: 200, temperature: 0.9 },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    return Response.json({ error: err }, { status: 502 })
  }

  const data = await res.json() as { candidates: Array<{ content: { parts: Array<{ text: string }> } }> }
  const summary = data.candidates[0]?.content?.parts[0]?.text?.trim() ?? ''
  return Response.json({ summary })
}
