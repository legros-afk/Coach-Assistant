import { useState, type ReactNode } from 'react'
import { Check, Plus } from 'lucide-react'
import { GROUP_COLOR, GROUP_NAME, GROUP_SHORT } from '@/ui/positions'
import type { Group, ID, Player } from '@/lib/events/types'
import type { SpondAvailability } from '@/lib/spond/spondSync'
import { teamLimits } from '@/lib/domain/validateComposition'
import { ButtonGroup } from '@/ui/ButtonGroup'
import { Button } from '@/ui/Button'
import { Sheet } from '@/ui/Sheet'
import { Pitch, PitchTile } from '@/ui/Pitch'


export type Assignment = 'A' | 'bench-A' | 'B' | 'bench-B' | 'unavailable' | null
type Team = 'A' | 'B'

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

type Open =
  | { kind: 'slot'; group: Group; current: ID | null }
  | { kind: 'player'; id: ID }
  | { kind: 'add-bench' }
  | null

// The team on a pitch. Tap a place to choose who plays there: the list says
// plainly who is free, on this team's bench, or already in the other team.
// Everyone off the pitch sits in rows underneath.
export default function SquadPicker({
  players, playersPerSide, assignments, groupOverrides, spondAvailability,
  starts = null, minutes = null, teamCount = 1, onAssign, onOverride,
}: Props) {
  const [tab, setTab] = useState<Team>('A')
  const team: Team = teamCount === 1 ? 'A' : tab
  const other: Team = team === 'A' ? 'B' : 'A'
  const limits = teamLimits(playersPerSide)
  const limitOf: Record<Group, number> = { forward: limits.f, back: limits.b, scrumhalf: limits.sh }

  const [open, setOpen] = useState<Open>(null)
  const [notice, setNotice] = useState<string | null>(null)
  // Where each starter stands, so a replacement takes the same place
  const [order, setOrder] = useState<ID[]>([])

  const byId = new Map(players.map(p => [p.id, p]))
  const assignOf = (id: ID) => effectiveAssignment(assignments.get(id), teamCount)
  const groupOf = (p: Player) => groupOverrides.get(p.id) ?? p.defaultGroup

  const spondOf = (id: ID): 'yes' | 'no' | 'maybe' | null => {
    if (!spondAvailability) return null
    if (spondAvailability.accepted.includes(id)) return 'yes'
    if (spondAvailability.declined.includes(id)) return 'no'
    if (spondAvailability.unanswered.includes(id)) return 'maybe'
    return null
  }
  const mark = (id: ID): ReactNode => {
    const s = spondOf(id)
    if (s === 'yes') return <span className="text-x-good" aria-label="coming">✓</span>
    if (s === 'no') return <span className="text-m-error" aria-label="said no">✗</span>
    if (s === 'maybe') return <span className="text-m-on-surface-variant" aria-label="no reply">?</span>
    return null
  }
  const played = (id: ID) => minutes
    ? `${Math.round(minutes.get(id) ?? 0)} min`
    : starts ? `${starts.get(id) ?? 0} starts` : ''

  const byOrder = (a: Player, b: Player) => {
    const ia = order.indexOf(a.id), ib = order.indexOf(b.id)
    return (ia < 0 ? Infinity : ia) - (ib < 0 ? Infinity : ib) || a.name.localeCompare(b.name)
  }
  const startersIn = (t: Team, g: Group) =>
    players.filter(p => assignOf(p.id) === t && groupOf(p) === g).sort(byOrder)
  const starterCount = (t: Team) => players.filter(p => assignOf(p.id) === t).length
  const benchOf = (t: Team) => players.filter(p => assignOf(p.id) === `bench-${t}`)
  const free = players.filter(p => assignOf(p.id) === null)
  const out = players.filter(p => assignOf(p.id) === 'unavailable')

  const say = (msg: string) => {
    setNotice(msg)
    setTimeout(() => setNotice(n => n === msg ? null : n), 6000)
  }

  const where = (p: Player): string => {
    const a = assignOf(p.id)
    if (a === 'A' || a === 'B') return `${teamCount === 2 ? `Team ${a} · ` : ''}starting as ${GROUP_NAME[groupOf(p)]}`
    if (a === 'bench-A' || a === 'bench-B') return teamCount === 2 ? `Team ${a.slice(-1)} bench` : 'Bench'
    if (a === 'unavailable') return 'Not coming'
    return 'Not picked'
  }

  // ── picking someone for a place on this team's pitch
  const pickFor = (g: Group, current: ID | null, p: Player) => {
    const was = assignOf(p.id)
    const wasGroup = groupOf(p)
    const slots = startersIn(team, g).map(x => x.id)
    if (current) onAssign(current, `bench-${team}`)
    onAssign(p.id, team)
    onOverride(p.id, g)
    const next = current ? slots.map(id => id === current ? p.id : id) : [...slots, p.id]
    setOrder(o => [...next, ...o.filter(id => !next.includes(id))])
    if (was === other) say(`${p.name} moved from Team ${other} — Team ${other} now needs a ${GROUP_NAME[wasGroup]}.`)
    else if (was === `bench-${other}`) say(`${p.name} moved from Team ${other}’s bench.`)
    setOpen(null)
  }

  const moveTo = (p: Player, a: Assignment) => {
    onAssign(p.id, a)
    setOpen(null)
  }

  // ── the pitch
  const slotsFor = (g: Group) => {
    const here = startersIn(team, g)
    const tiles = here.map((p, i) => (
      <PitchTile
        key={p.id}
        group={g}
        name={p.name}
        detail={played(p.id) || undefined}
        mark={mark(p.id)}
        tone={i >= limitOf[g] ? 'over' : 'normal'}
        ariaLabel={`${p.name}, ${GROUP_NAME[g]} — change`}
        onClick={() => setOpen({ kind: 'slot', group: g, current: p.id })}
      />
    ))
    for (let i = here.length; i < limitOf[g]; i++) {
      tiles.push(
        <PitchTile key={`empty-${g}-${i}`} group={g} onClick={() => setOpen({ kind: 'slot', group: g, current: null })} />,
      )
    }
    return tiles
  }

  // ── a row in the "who plays here?" list
  const Candidate = ({ p, g, current, note }: { p: Player; g: Group; current: ID | null; note?: string }) => {
    const detail = [played(p.id), p.defaultGroup !== g ? `usually ${GROUP_NAME[p.defaultGroup]}` : '']
      .filter(Boolean).join(' · ')
    return (
      <button
        onClick={() => pickFor(g, current, p)}
        className="m-press w-full min-h-[3.5rem] flex items-center gap-3 px-3 py-2 rounded-m-md bg-m-surface-container-high text-left"
      >
        <GroupBadge group={p.defaultGroup} />
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-1.5">
            <span className="text-base font-semibold truncate">{p.name}</span>
            {mark(p.id)}
          </span>
          {detail && <span className="block text-xs mono text-m-on-surface-variant">{detail}</span>}
        </span>
        {note && (
          <span className="flex-shrink-0 h-7 px-2.5 rounded-full inline-flex items-center text-xs font-semibold bg-m-secondary-container text-m-on-secondary-container">
            {note}
          </span>
        )}
      </button>
    )
  }

  const slotSheet = (g: Group, current: ID | null) => {
    const cur = current ? byId.get(current) : undefined
    const eligible = players
      .filter(p => p.id !== current && p.eligibleGroups.includes(g) && !(assignOf(p.id) === team && groupOf(p) === g))
      .sort((a, b) => {
        const rank = (x: Player) => (spondOf(x.id) === 'yes' ? 0 : spondOf(x.id) === 'no' ? 2 : 1)
        return rank(a) - rank(b)
          || (a.defaultGroup === g ? 0 : 1) - (b.defaultGroup === g ? 0 : 1)
          || (minutes ? (minutes.get(a.id) ?? 0) - (minutes.get(b.id) ?? 0) : (starts?.get(a.id) ?? 0) - (starts?.get(b.id) ?? 0))
          || a.name.localeCompare(b.name)
      })
    const sections: { title: string; list: Player[]; note?: (p: Player) => string }[] = [
      { title: 'Not picked', list: eligible.filter(p => assignOf(p.id) === null) },
      { title: teamCount === 2 ? `Team ${team} bench` : 'Bench', list: eligible.filter(p => assignOf(p.id) === `bench-${team}`) },
      {
        title: `In Team ${other} — picking moves them here`,
        list: teamCount === 2 ? eligible.filter(p => assignOf(p.id) === other || assignOf(p.id) === `bench-${other}`) : [],
        note: p => assignOf(p.id) === other ? `${other} · starting` : `${other} · bench`,
      },
      {
        title: `Starting elsewhere${teamCount === 2 ? ` for Team ${team}` : ''} — leaves that place empty`,
        list: eligible.filter(p => assignOf(p.id) === team),
        note: p => GROUP_NAME[groupOf(p)],
      },
      { title: 'Not coming', list: eligible.filter(p => assignOf(p.id) === 'unavailable') },
    ]
    return (
      <Sheet onClose={() => setOpen(null)} title={`${GROUP_NAME[g]}${teamCount === 2 ? ` · Team ${team}` : ''}`}>
        <div className="space-y-4 pb-4">
          {cur && (
            <div className="p-3 rounded-m-lg bg-m-secondary-container text-m-on-secondary-container">
              <div className="text-base font-semibold mb-2">{cur.name} is playing here</div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outlined" onClick={() => moveTo(cur, `bench-${team}`)}>To the bench</Button>
                {teamCount === 2 && <Button size="sm" variant="outlined" onClick={() => moveTo(cur, null)}>Not picked</Button>}
                <Button size="sm" variant="outlined" onClick={() => moveTo(cur, 'unavailable')}>Not coming</Button>
              </div>
              <div className="text-sm mt-2 opacity-80">Or choose who plays here instead — {cur.name} goes to the bench.</div>
            </div>
          )}
          {sections.filter(s => s.list.length > 0).map(s => (
            <div key={s.title}>
              <div className="text-sm font-medium text-m-on-surface-variant mb-1.5 px-1">{s.title}</div>
              <div className="space-y-1.5">
                {s.list.map(p => <Candidate key={p.id} p={p} g={g} current={current} note={s.note?.(p)} />)}
              </div>
            </div>
          ))}
          {eligible.length === 0 && (
            <p className="text-sm text-m-on-surface-variant px-1">
              Nobody else can play {GROUP_NAME[g]}. Positions each player can cover are set in the Team tab.
            </p>
          )}
        </div>
      </Sheet>
    )
  }

  const playerSheet = (p: Player) => {
    const a = assignOf(p.id)
    // Straight onto the pitch where this team still has an empty place
    const startable = p.eligibleGroups.filter(g => startersIn(team, g).length < limitOf[g])
    const options: { label: string; to: Assignment }[] = []
    for (const t of (teamCount === 2 ? ['A', 'B'] : ['A']) as Team[]) {
      if (a !== `bench-${t}`) options.push({ label: teamCount === 2 ? `Team ${t} bench` : 'Bench', to: `bench-${t}` })
    }
    if (teamCount === 2 && a !== null) options.push({ label: 'Not picked', to: null })
    if (a !== 'unavailable') options.push({ label: 'Not coming', to: 'unavailable' })
    return (
      <Sheet onClose={() => setOpen(null)} title={p.name}>
        <p className="text-sm -mt-2 mb-4 text-m-on-surface-variant">
          {where(p)}{played(p.id) ? ` · ${played(p.id)} this season` : ''}
        </p>
        <div className="space-y-2 pb-4">
          {a !== 'unavailable' && startable.map(g => (
            <Button key={g} full onClick={() => pickFor(g, null, p)}>
              Start as {GROUP_NAME[g]}{teamCount === 2 ? ` for Team ${team}` : ''}
            </Button>
          ))}
          {a === 'unavailable' && (
            <Button full onClick={() => moveTo(p, teamCount === 2 ? null : 'bench-A')}>Coming after all</Button>
          )}
          {options.filter(o => !(a === 'unavailable' && o.to === null)).map(o => (
            <Button key={o.label} full variant="tonal" onClick={() => moveTo(p, o.to)}>{o.label}</Button>
          ))}
        </div>
      </Sheet>
    )
  }

  const addBenchSheet = () => (
    <Sheet onClose={() => setOpen(null)} title={`Team ${team} bench`}>
      <p className="text-sm -mt-2 mb-4 text-m-on-surface-variant">Tap everyone who sits on Team {team}’s bench.</p>
      <div className="space-y-1.5 pb-4">
        {players.filter(p => assignOf(p.id) === null || assignOf(p.id) === `bench-${team}`).map(p => {
          const on = assignOf(p.id) === `bench-${team}`
          return (
            <button
              key={p.id}
              onClick={() => onAssign(p.id, on ? null : `bench-${team}`)}
              className={`m-press w-full h-14 flex items-center gap-3 px-3 rounded-m-md text-left ${on ? 'bg-x-good-container text-x-on-good-container' : 'bg-m-surface-container-high'}`}
            >
              <GroupBadge group={p.defaultGroup} />
              <span className="flex-1 text-base font-semibold truncate">{p.name}</span>
              {mark(p.id)}
              {on && <Check size={18} strokeWidth={2.5} />}
            </button>
          )
        })}
        <Button full className="mt-3" onClick={() => setOpen(null)}>Done</Button>
      </div>
    </Sheet>
  )

  // ── rows under the pitch
  const Chip = ({ p, dim }: { p: Player; dim?: boolean }) => (
    <button
      onClick={() => setOpen({ kind: 'player', id: p.id })}
      className="m-press h-10 pl-1.5 pr-3 rounded-full inline-flex items-center gap-1.5 bg-m-surface-container-high text-m-on-surface"
      style={{ opacity: dim ? 0.6 : 1 }}
    >
      <GroupBadge group={p.defaultGroup} />
      <span className="text-sm font-semibold">{p.name}</span>
      {mark(p.id)}
    </button>
  )
  const Row = ({ title, list, dim, add }: { title: string; list: Player[]; dim?: boolean; add?: () => void }) => (
    <div>
      <div className="text-sm font-semibold text-m-on-surface-variant mb-1.5 px-1">{title} ({list.length})</div>
      <div className="flex flex-wrap gap-2">
        {list.map(p => <Chip key={p.id} p={p} dim={dim} />)}
        {add && (
          <button
            onClick={add}
            className="m-press h-10 px-3 rounded-full inline-flex items-center gap-1 text-sm font-semibold border border-m-outline text-m-primary"
          >
            <Plus size={16} strokeWidth={2.5} /> Add
          </button>
        )}
        {list.length === 0 && !add && <span className="text-sm text-m-on-surface-variant px-1">Nobody</span>}
      </div>
    </div>
  )

  const tabLabel = (t: Team) => {
    const n = starterCount(t)
    return `Team ${t} · ${n}/${playersPerSide}${n === playersPerSide ? ' ✓' : ''}`
  }

  return (
    <div className="space-y-3">
      {teamCount === 2 && (
        <ButtonGroup
          full
          ariaLabel="Team"
          value={tab}
          onChange={t => { setTab(t); setNotice(null) }}
          options={(['A', 'B'] as const).map(t => ({ value: t, label: tabLabel(t) }))}
        />
      )}

      {notice && (
        <div className="px-4 py-3 rounded-m-lg text-sm font-medium bg-m-secondary-container text-m-on-secondary-container">
          {notice}
        </div>
      )}

      <Pitch
        forwards={slotsFor('forward')}
        nine={slotsFor('scrumhalf')}
        backs={slotsFor('back')}
      />

      <Row
        title={teamCount === 2 ? `Team ${team} bench` : 'Bench'}
        list={benchOf(team)}
        add={teamCount === 2 && free.length > 0 ? () => setOpen({ kind: 'add-bench' }) : undefined}
      />
      {teamCount === 2 && free.length > 0 && <Row title="Not picked" list={free} />}
      {out.length > 0 && <Row title="Not coming" list={out} dim />}

      {open?.kind === 'slot' && slotSheet(open.group, open.current)}
      {open?.kind === 'player' && byId.get(open.id) && playerSheet(byId.get(open.id)!)}
      {open?.kind === 'add-bench' && addBenchSheet()}
    </div>
  )
}

