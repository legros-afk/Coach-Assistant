import { useState } from 'react'
import { GROUP_COLOR } from '@/ui/positions'
import type { Group, ID, Player } from '@/lib/events/types'
import type { SpondAvailability } from '@/lib/spond/spondSync'
import { teamLimits } from '@/lib/domain/validateComposition'
import { ButtonGroup } from '@/ui/ButtonGroup'
import { Card } from '@/ui/Card'


export type Assignment = 'A' | 'bench-A' | 'B' | 'bench-B' | 'unavailable' | null
type Team = 'A' | 'B'
type Choice = 'start' | 'bench' | 'out'

const GROUP_SHORT: Record<Group, string> = { forward: 'F', back: 'B', scrumhalf: 'SH' }
const GROUP_TITLE: Record<Group, string> = { forward: 'Forwards', back: 'Backs', scrumhalf: 'Scrum-half' }
const GROUP_ORDER: Group[] = ['forward', 'back', 'scrumhalf']

export function GroupBadge({ group, size = 'sm' }: { group: Group; size?: 'sm' | 'xs' }) {
  const bg = GROUP_COLOR[group]
  const cls = size === 'xs' ? 'w-5 h-5 text-xs' : 'w-6 h-6 text-xs'
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
        className="flex flex-wrap items-center gap-x-2 gap-y-1.5 px-4 py-2 transition-opacity"
        style={{ opacity: choice === 'out' || elsewhere ? 0.55 : 1 }}
      >
        {/* With large text the switch wraps under the name rather than squeezing it */}
        <div className="flex-1 min-w-[7.5rem]">
          <div className="flex items-center gap-1.5">
            <span className="text-base font-semibold truncate text-m-on-surface">{p.name}</span>
            {spond && (
              <span className={`text-xs font-semibold flex-shrink-0 ${spond === 'yes' ? 'text-x-good' : spond === 'no' ? 'text-m-error' : 'text-m-on-surface-variant'}`}>
                {spond === 'yes' ? '✓' : spond === 'no' ? 'said no' : '?'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {elsewhere && <span className="text-xs font-semibold text-m-on-surface-variant">in Team {other}</span>}
            {otherGroups.map(og => (
              <button
                key={og}
                onClick={() => moveGroup(p, og)}
                aria-label={`Move ${p.name} to ${GROUP_TITLE[og]}`}
                className="m-press h-7 px-2.5 rounded-m-sm text-xs font-semibold border border-m-outline text-m-on-surface-variant"
              >
                also {GROUP_SHORT[og]}
              </button>
            ))}
            {(starts || minutes) && (
              <span className="text-xs mono text-m-on-surface-variant">
                {starts ? `${n} start${n === 1 ? '' : 's'}` : ''}
                {starts && minutes ? ' · ' : ''}
                {minutes ? `${Math.round(minutes.get(p.id) ?? 0)} min` : ''}
              </span>
            )}
          </div>
        </div>
        <ButtonGroup
          size="md"
          ariaLabel={`${p.name}${teamCount === 2 ? `, Team ${team}` : ''}`}
          value={choice}
          onChange={c => choose(p, c)}
          className="flex-shrink-0 ml-auto"
          options={[
            { value: 'start', label: 'Start' },
            { value: 'bench', label: 'Bench', selectedClass: 'bg-m-secondary-container text-m-on-secondary-container' },
            { value: 'out', label: 'Out', selectedClass: 'bg-m-error-container text-m-on-error-container' },
          ]}
        />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {teamCount === 2 && (
        <ButtonGroup
          full
          ariaLabel="Team"
          value={tab}
          onChange={setTab}
          options={(['A', 'B'] as const).map(t => ({
            value: t,
            label: `Team ${t} · ${players.filter(p => assignOf(p.id) === t).length}/${playersPerSide}`,
          }))}
        />
      )}

      <div className="text-base font-semibold px-1 text-m-on-surface">
        Starting {starters.length}/{playersPerSide} · Bench {benchCount} · Out {outCount}
        {teamCount === 2 && unpicked > 0 && <span className="text-m-on-surface-variant"> · Not picked {unpicked}</span>}
      </div>

      {GROUP_ORDER.map(g => {
        const inGroup = players.filter(p => groupOf(p) === g)
        if (inGroup.length === 0) return null
        const count = starters.filter(p => groupOf(p) === g).length
        const limit = limitOf[g]
        const tone = count > limit
          ? 'bg-m-error-container text-m-on-error-container'
          : count === limit
            ? 'bg-x-good-container text-x-on-good-container'
            : 'bg-m-surface-container-highest text-m-on-surface-variant'
        return (
          <Card key={g} className="overflow-hidden">
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <h3 className="text-lg emphasized text-m-on-surface">{GROUP_TITLE[g]}</h3>
              <span className={`h-8 px-3 rounded-full inline-flex items-center text-sm font-bold mono transition-colors ${tone}`}>
                {count}/{limit}{count === limit ? ' ✓' : ''}
              </span>
            </div>
            <div className="divide-y divide-m-outline-variant pb-1">{inGroup.map(row)}</div>
          </Card>
        )
      })}
    </div>
  )
}
