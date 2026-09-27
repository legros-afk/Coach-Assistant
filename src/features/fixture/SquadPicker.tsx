import { useState } from 'react'
import { GROUP_COLOR } from '@/ui/positions'
import type { Group, ID, Player } from '@/lib/events/types'
import type { SpondAvailability } from '@/lib/spond/spondSync'
import { teamLimits } from '@/lib/domain/validateComposition'

const PURPLE      = '#3D0066'
const PURPLE_DARK = '#5B1A99'
const INK         = '#1A1A1A'
const MUTED       = '#6E6E73'

export type Assignment = 'A' | 'bench-A' | 'B' | 'bench-B' | 'unavailable' | null
type Team = 'A' | 'B'
type Choice = 'start' | 'bench' | 'out'

const GROUP_SHORT: Record<Group, string> = { forward: 'F', back: 'B', scrumhalf: 'SH' }
const GROUP_TITLE: Record<Group, string> = { forward: 'Forwards', back: 'Backs', scrumhalf: 'Scrum-half' }
const GROUP_ORDER: Group[] = ['forward', 'back', 'scrumhalf']

export function GroupBadge({ group, size = 'sm' }: { group: Group; size?: 'sm' | 'xs' }) {
  const bg = GROUP_COLOR[group]
  const cls = size === 'xs' ? 'w-5 h-5 text-[11px]' : 'w-6 h-6 text-xs'
  return (
    <span className={`font-bold rounded-full flex items-center justify-center flex-shrink-0 ${cls}`}
      style={{ background: bg, color: 'white' }}>
      {GROUP_SHORT[group]}
    </span>
  )
}

/**
 * In one-team mode an unpicked player (null) counts as Bench, so the coach
 * only has to tap starters and absentees. Everything that reads team sheets
 * should see the same thing the picker shows.
 */
export function effectiveAssignment(a: Assignment | undefined, teamCount: 1 | 2): Assignment {
  const v = a ?? null
  return v === null && teamCount === 1 ? 'bench-A' : v
}

interface Props {
  players: Player[]
  playersPerSide: number
  assignments: Map<ID, Assignment>
  groupOverrides: Map<ID, Group>
  spondAvailability: SpondAvailability | null
  /** Season starts per player; null hides the counts (e.g. first fixture of the season). */
  starts?: Map<ID, number> | null
  /** Season minutes per player from earlier matches; null hides them. */
  minutes?: Map<ID, number> | null
  teamCount?: 1 | 2
  onAssign: (id: ID, val: Assignment) => void
  onOverride: (id: ID, group: Group | null) => void
}

// One row per player, grouped by position, with a Start / Bench / Out switch:
// every decision is a single tap on the player's own row.
export default function SquadPicker({
  players, playersPerSide, assignments, groupOverrides, spondAvailability,
  starts = null, minutes = null, teamCount = 1, onAssign, onOverride,
}: Props) {
  const [tab, setTab] = useState<Team>('A')
  const team: Team = teamCount === 1 ? 'A' : tab
  const other: Team = team === 'A' ? 'B' : 'A'
  const limits = teamLimits(playersPerSide)
  const limitOf: Record<Group, number> = { forward: limits.f, back: limits.b, scrumhalf: limits.sh }

  const assignOf = (id: ID) => effectiveAssignment(assignments.get(id), teamCount)
  const groupOf = (p: Player) => groupOverrides.get(p.id) ?? p.defaultGroup

  const choiceOf = (id: ID): Choice | null => {
    const a = assignOf(id)
    if (a === team) return 'start'
    if (a === `bench-${team}`) return 'bench'
    if (a === 'unavailable') return 'out'
    return null
  }
  const inOtherTeam = (id: ID) => {
    const a = assignOf(id)
    return teamCount === 2 && (a === other || a === `bench-${other}`)
  }

  const choose = (p: Player, c: Choice) => {
    const current = choiceOf(p.id)
    if (current === c) {
      // Two teams: tapping the selected option again un-picks the player so
      // they're free for the other side. One team: there's nothing to undo to.
      if (teamCount === 2 && c !== 'out') onAssign(p.id, null)
      // One team: a default Bench becomes a deliberate one, so Auto-pick
      // leaves the player where the coach put them.
      else if (c === 'bench' && (assignments.get(p.id) ?? null) === null) onAssign(p.id, 'bench-A')
      return
    }
    if (c === 'start') {
      onAssign(p.id, team)
      onOverride(p.id, groupOf(p))
    } else if (c === 'bench') {
      onAssign(p.id, `bench-${team}`)
    } else {
      onAssign(p.id, 'unavailable')
    }
  }

  const moveGroup = (p: Player, g: Group) => {
    onOverride(p.id, g === p.defaultGroup ? null : g)
  }

  const spondStatus = (p: Player) => {
    if (!spondAvailability) return null
    if (spondAvailability.accepted.includes(p.id)) return 'yes'
    if (spondAvailability.declined.includes(p.id)) return 'no'
    if (spondAvailability.unanswered.includes(p.id)) return 'no reply'
    return null
  }

  const starters = players.filter(p => assignOf(p.id) === team)
  const benchCount = players.filter(p => assignOf(p.id) === `bench-${team}`).length
  const outCount = players.filter(p => assignOf(p.id) === 'unavailable').length
  const unpicked = players.filter(p => assignOf(p.id) === null).length

  const row = (p: Player) => {
    const choice = choiceOf(p.id)
    const g = groupOf(p)
    const otherGroups = p.eligibleGroups.filter(x => x !== g)
    const spond = spondStatus(p)
    const n = starts?.get(p.id) ?? 0
    const elsewhere = inOtherTeam(p.id)
    return (
      <div
        key={p.id}
        className="flex items-center gap-2 py-1.5"
        style={{ borderBottom: '1px solid #EFEFF4', opacity: choice === 'out' || elsewhere ? 0.6 : 1 }}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[15px] font-semibold truncate" style={{ color: INK }}>{p.name}</span>
            {spond && (
              <span
                className="text-xs font-semibold flex-shrink-0"
                style={{ color: spond === 'yes' ? '#059669' : spond === 'no' ? '#dc2626' : MUTED }}
              >
                {spond === 'yes' ? '✓' : spond === 'no' ? 'said no' : '?'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {elsewhere && (
              <span className="text-xs font-semibold" style={{ color: MUTED }}>in Team {other}</span>
            )}
            {otherGroups.map(og => (
              <button
                key={og}
                onClick={() => moveGroup(p, og)}
                aria-label={`Move ${p.name} to ${GROUP_TITLE[og]}`}
                className="text-xs font-semibold px-2 py-0.5 rounded-full active:scale-95 transition"
                style={{ border: `1px solid ${PURPLE_DARK}`, color: PURPLE_DARK, background: 'white' }}
              >
                also {GROUP_SHORT[og]}
              </button>
            ))}
            {(starts || minutes) && (
              <span className="text-xs mono" style={{ color: MUTED }}>
                {starts ? `${n} start${n === 1 ? '' : 's'}` : ''}
                {starts && minutes ? ' · ' : ''}
                {minutes ? `${Math.round(minutes.get(p.id) ?? 0)} min` : ''}
              </span>
            )}
          </div>
        </div>
        <div
          role="radiogroup"
          aria-label={`${p.name}${teamCount === 2 ? `, Team ${team}` : ''}`}
          className="flex rounded-lg overflow-hidden flex-shrink-0"
          style={{ border: '1px solid #E5E5EA' }}
        >
          {(['start', 'bench', 'out'] as const).map((c, i) => {
            const on = choice === c
            const selected = c === 'start'
              ? { background: PURPLE, color: 'white' }
              : c === 'bench'
                ? { background: '#E5E5EA', color: INK }
                : { background: '#FDECEC', color: '#B42318' }
            return (
              <button
                key={c}
                role="radio"
                aria-checked={on}
                onClick={() => choose(p, c)}
                className="w-[58px] text-[13px] font-semibold active:scale-95 transition"
                style={{
                  minHeight: 44,
                  borderLeft: i > 0 ? '1px solid #E5E5EA' : undefined,
                  ...(on ? selected : { background: 'white', color: MUTED }),
                }}
              >
                {c === 'start' ? 'Start' : c === 'bench' ? 'Bench' : 'Out'}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div>
      {teamCount === 2 && (
        <div className="flex rounded-lg overflow-hidden mb-2" style={{ border: '1px solid #E5E5EA' }}>
          {(['A', 'B'] as const).map(t => {
            const n = players.filter(p => assignOf(p.id) === t).length
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="flex-1 text-sm font-bold transition"
                style={{
                  minHeight: 44,
                  background: tab === t ? PURPLE : 'white',
                  color: tab === t ? 'white' : PURPLE_DARK,
                }}
              >
                Team {t} · {n}/{playersPerSide}
              </button>
            )
          })}
        </div>
      )}

      <div className="text-[13px] font-semibold mb-1 px-1" style={{ color: INK }}>
        Starting {starters.length}/{playersPerSide} · Bench {benchCount} · Out {outCount}
        {teamCount === 2 && unpicked > 0 && <span style={{ color: MUTED }}> · Not picked {unpicked}</span>}
      </div>

      {GROUP_ORDER.map(g => {
        const inGroup = players.filter(p => groupOf(p) === g)
        if (inGroup.length === 0) return null
        const count = starters.filter(p => groupOf(p) === g).length
        const limit = limitOf[g]
        const color = count > limit ? '#DC2626' : count === limit ? '#059669' : MUTED
        return (
          <section key={g} className="mt-3">
            <div className="flex items-baseline justify-between px-1 pb-1" style={{ borderBottom: `2px solid ${PURPLE_DARK}` }}>
              <h3 className="text-sm font-bold" style={{ color: PURPLE }}>{GROUP_TITLE[g]}</h3>
              <span className="text-sm font-bold mono" style={{ color }}>
                {count}/{limit}{count === limit ? ' ✓' : ''}
              </span>
            </div>
            <div className="px-1">{inGroup.map(row)}</div>
          </section>
        )
      })}
    </div>
  )
}
