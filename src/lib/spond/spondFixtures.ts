// Spond is the club's source of truth for what's being played and when.
// reconcileWithSpond works out, from the Spond events and the app's fixtures,
// which fixtures to add, update or retire. It's pure so it can be tested; the
// runner at the bottom applies the result.

import type { Fixture } from '@/lib/events/types'
import type { SpondEvent } from './spondApi'

const CLUB_WORDS = /woodford/i

/** Trainings, socials and the like aren't fixtures. */
export function isMatchEvent(ev: SpondEvent): boolean {
  if (ev.matchEvent) return true
  if (/training|practice|session|social|meeting|awards|presentation/i.test(ev.heading)) return false
  return /\bvs?\.?\b|festival|tournament|match|\s[–-]\s|fixture/i.test(ev.heading)
}

/** "Eton Manor (Away)" from whatever Spond gives us. */
export function opponentOf(ev: SpondEvent): string {
  const side = (t?: string) => t === 'HOME' ? ' (Home)' : t === 'AWAY' ? ' (Away)' : ''
  if (ev.matchInfo?.opponentName) return `${ev.matchInfo.opponentName.trim()}${side(ev.matchInfo.type)}`

  const heading = ev.heading.replace(/\s+/g, ' ').trim()
  const vs = heading.match(/\bvs?\.?\s+(.+)/i)
  if (vs) return vs[1].trim()

  // Spond match headings read "Home team – Away team"
  const parts = heading.split(/\s[–—-]\s/)
  if (parts.length === 2) {
    const [a, b] = parts.map(p => p.trim())
    if (CLUB_WORDS.test(b) && !CLUB_WORDS.test(a)) return `${a} (Away)`
    if (CLUB_WORDS.test(a) && !CLUB_WORDS.test(b)) return `${b} (Home)`
  }
  return heading
}

/** Local calendar date of the event, as the app stores fixture dates. */
export function localDate(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

// Words that identify a side: "Upminster Festival (Away)" → {upminster}
function nameKey(s: string): Set<string> {
  return new Set(
    s.toLowerCase()
      .replace(/\(.*?\)/g, ' ')
      .replace(/\b(vs?|festival|tournament|rfc|rugby|club|fc|u\d+s?|under|home|away|at|the)\b/g, ' ')
      .split(/[^a-z]+/)
      .filter(w => w.length > 2),
  )
}
function sameSide(a: string, b: string): boolean {
  const ka = nameKey(a), kb = nameKey(b)
  for (const w of ka) if (kb.has(w)) return true
  return false
}

const hasHistory = (f: Fixture, played: Set<string>) => f.teamSheets.some(ts => played.has(ts.id))

export interface Reconciled {
  /** Fixtures to save (new, changed or retired), each with its version bumped. */
  changed: Fixture[]
  summary: { added: number; updated: number; cancelled: number }
}

let _seq = 0
const newId = () => `f-${Date.now()}-${++_seq}`

/**
 * @param events  upcoming Spond events (any type)
 * @param fixtures the app's fixtures
 * @param today   'YYYY-MM-DD'
 * @param played  team-sheet ids that already have match events (never retired)
 */
export function reconcileWithSpond(
  events: SpondEvent[],
  fixtures: Fixture[],
  today: string,
  played: Set<string>,
  defaultFormat: number,
  nowIso = new Date().toISOString(),
): Reconciled {
  const matches = events.filter(isMatchEvent)
  const byId = new Map(fixtures.filter(f => f.spondEventId).map(f => [f.spondEventId!, f]))
  const claimed = new Set<string>()          // fixture ids matched to a Spond event
  const changed = new Map<string, Fixture>()
  const summary = { added: 0, updated: 0, cancelled: 0 }

  const bump = (f: Fixture, patch: Partial<Fixture>): Fixture => {
    const next = { ...f, ...patch, version: (f.version ?? 0) + 1, updatedAt: nowIso }
    changed.set(next.id, next)
    return next
  }

  // Pass 1: events already linked to a fixture
  const unlinked: SpondEvent[] = []
  for (const ev of matches) {
    const f = byId.get(ev.id)
    if (f) claimed.add(f.id)
    else unlinked.push(ev)
  }

  // Pass 2: link each new event to an unlinked fixture on the same day with the
  // same opponent (or the only one that day), otherwise create a fixture.
  // Cancelled events go last so a live game that day gets the match first.
  unlinked.sort((a, b) => Number(!!a.cancelled) - Number(!!b.cancelled))
  for (const ev of unlinked) {
    const date = localDate(ev.startTimestamp)
    const opponent = opponentOf(ev)
    const sameDay = fixtures.filter(f => !f.spondEventId && !claimed.has(f.id) && f.date === date)
    // Names can differ ("Old Albanians" / "OA"), so when both sides have exactly
    // one game that day they're taken to be the same game.
    const spondThatDay = matches.filter(e => localDate(e.startTimestamp) === date).length
    const match = sameDay.find(f => sameSide(f.opponent, opponent))
      ?? (sameDay.length === 1 && spondThatDay === 1 && !sameDay[0].cancelled ? sameDay[0] : undefined)
    if (match) {
      claimed.add(match.id)
      byId.set(ev.id, match)
      bump(match, { spondEventId: ev.id })
      continue
    }
    if (ev.cancelled) continue // nothing to add for a game that isn't happening
    const created: Fixture = {
      id: newId(), date, opponent, teamSheets: [], playersPerSide: defaultFormat,
      spondEventId: ev.id, updatedAt: nowIso, version: 1,
    }
    changed.set(created.id, created)
    claimed.add(created.id)
    summary.added++
  }

  // Pass 3: bring linked fixtures in line with Spond (date, opponent, cancelled)
  for (const ev of matches) {
    const base = byId.get(ev.id)
    if (!base) continue
    const current = changed.get(base.id) ?? base
    const date = localDate(ev.startTimestamp)
    const opponent = opponentOf(ev)
    const cancelled = !!ev.cancelled
    const patch: Partial<Fixture> = {}
    if (current.date !== date) patch.date = date
    // Keep a coach's own wording unless Spond's is clearly a different side
    if (!sameSide(current.opponent, opponent)) patch.opponent = opponent
    if (!!current.cancelled !== cancelled) patch.cancelled = cancelled
    if (Object.keys(patch).length) {
      if (changed.has(current.id)) changed.set(current.id, { ...current, ...patch })
      else bump(current, patch)
      if (patch.cancelled) summary.cancelled++
      else summary.updated++
    }
  }

  // Pass 4: upcoming fixtures Spond doesn't have. Only within the dates Spond
  // actually covers — games further out may simply not be in Spond yet.
  const spondDates = matches.map(ev => localDate(ev.startTimestamp)).sort()
  const lastSpondDate = spondDates[spondDates.length - 1]
  if (lastSpondDate) {
    for (const f of fixtures) {
      if (claimed.has(f.id) || f.cancelled) continue
      // Today's game may already have finished and dropped off Spond's list
      if (f.date <= today || f.date > lastSpondDate) continue
      if (hasHistory(f, played)) continue
      // A fixture still linked to a Spond event that's gone from the list
      bump(changed.get(f.id) ?? f, { cancelled: true })
      summary.cancelled++
    }
  }

  return { changed: [...changed.values()], summary }
}
