import { useState } from 'react'
import type { Group, ID, Player } from '@/lib/events/types'
import type { SpondAvailability } from '@/lib/spond/spondSync'
import { teamLimits } from '@/lib/domain/validateComposition'

const PURPLE      = '#3D0066'
const PURPLE_DARK = '#5B1A99'
const INK         = '#1A1A1A'
const BLUE        = '#1D4ED8'

export type Assignment = 'A' | 'bench-A' | 'B' | 'bench-B' | 'unavailable' | null

const GROUP_SHORT: Record<Group, string> = { forward: 'F', back: 'B', scrumhalf: 'SH' }
const GROUP_GHOST: Record<Group, string> = { forward: 'FORWARD', back: 'BACK', scrumhalf: 'SCRUM-HALF' }

export function GroupBadge({ group, size = 'sm' }: { group: Group; size?: 'sm' | 'xs' }) {
  const bg = group === 'forward' ? INK : group === 'back' ? PURPLE : PURPLE_DARK
  const cls = size === 'xs' ? 'w-5 h-5 text-[9px]' : 'w-6 h-6 text-[10px]'
  return (
    <span className={`font-bold rounded-full flex items-center justify-center flex-shrink-0 ${cls}`}
      style={{ background: bg, color: 'white' }}>
      {GROUP_SHORT[group]}
    </span>
  )
}

interface Props {
  players: Player[]
  playersPerSide: number
  assignments: Map<ID, Assignment>
  groupOverrides: Map<ID, Group>
  spondAvailability: SpondAvailability | null
  onAssign: (id: ID, val: Assignment) => void
  onOverride: (id: ID, group: Group | null) => void
}

export default function TeamBoard({ players, playersPerSide, assignments, groupOverrides, spondAvailability, onAssign, onOverride }: Props) {
  const [selectedId, setSelectedId] = useState<ID | null>(null)

  const limits = teamLimits(playersPerSide)
  const assignOf = (id: ID) => assignments.get(id) ?? null
  const groupOf = (p: Player) => groupOverrides.get(p.id) ?? p.defaultGroup

  // Selection is only meaningful while the player is still in the pool
  // (a Spond sync can pull them out from under us).
  const selected = selectedId !== null
    ? players.find(p => p.id === selectedId && assignOf(p.id) === null) ?? null
    : null

  const pool    = players.filter(p => assignOf(p.id) === null)
  const poolF   = pool.filter(p => p.defaultGroup === 'forward')
  const poolBS  = pool.filter(p => p.defaultGroup !== 'forward')
  const unavail = players.filter(p => assignOf(p.id) === 'unavailable')

  const fits = (p: Player, g: Group) => p.eligibleGroups.includes(g)

  const pickUp = (id: ID) => {
    onAssign(id, null)
    onOverride(id, null)
    setSelectedId(id)
  }
  const place = (team: 'A' | 'B', g: Group) => {
    if (!selected || !fits(selected, g)) return
    onAssign(selected.id, team)
    onOverride(selected.id, g)
    setSelectedId(null)
  }
  const bench = (team: 'A' | 'B') => {
    if (!selected) return
    onAssign(selected.id, `bench-${team}`)
    setSelectedId(null)
  }
  const markUnavailable = () => {
    if (!selected) return
    onAssign(selected.id, 'unavailable')
    setSelectedId(null)
  }

  const spondGlyph = (p: Player) => {
    if (!spondAvailability) return null
    const status = spondAvailability.accepted.includes(p.id) ? 'accepted'
      : spondAvailability.declined.includes(p.id) ? 'declined'
      : spondAvailability.unanswered.includes(p.id) ? 'unanswered'
      : null
    if (!status) return null
    return (
      <span
        className="text-[10px] font-bold flex-shrink-0"
        style={{ color: status === 'accepted' ? '#16a34a' : status === 'declined' ? '#dc2626' : '#a8a29e' }}
        title={status}
      >
        {status === 'accepted' ? '✓' : status === 'declined' ? '✗' : '?'}
      </span>
    )
  }

  const poolChip = (p: Player) => {
    const isSel = selected?.id === p.id
    return (
      <button
        key={p.id}
        onClick={() => setSelectedId(isSel ? null : p.id)}
        aria-label={`${p.name}${isSel ? ', selected' : ''}`}
        aria-pressed={isSel}
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold active:scale-95 transition"
        style={isSel
          ? { border: '1px solid #7C3AED', background: '#F3E8FF', boxShadow: '0 0 0 2px #DDD0F0', color: INK }
          : { border: '1px solid #E4D0F5', background: 'white', color: INK }}
      >
        <GroupBadge group={p.defaultGroup} size="xs" />
        <span className="truncate max-w-[110px]">{p.name}</span>
        {spondGlyph(p)}
      </button>
    )
  }

  const teamPanel = (team: 'A' | 'B') => {
    const teamColor = team === 'A' ? PURPLE : BLUE
    const starters  = players.filter(p => assignOf(p.id) === team)
    const benched   = players.filter(p => assignOf(p.id) === `bench-${team}`)
    const total     = starters.length
    const over      = total > playersPerSide

    const section = (g: Group, limit: number) => {
      const placed = starters.filter(p => groupOf(p) === g)
      const empties = Math.max(0, limit - placed.length)
      const rows = []
      for (const p of placed) {
        rows.push(
          <button
            key={p.id}
            onClick={() => pickUp(p.id)}
            aria-label={`${p.name}, Team ${team} ${g === 'scrumhalf' ? 'scrum-half' : g} — pick up`}
            className="w-full h-8 rounded-lg mb-1 flex items-center gap-1.5 px-2 text-xs font-bold active:scale-[0.98] transition"
            style={{ background: teamColor, color: 'white' }}
          >
            <span className="text-[9px] font-extrabold opacity-60 w-4 text-left flex-shrink-0">{GROUP_SHORT[g]}</span>
            <span className="truncate">{p.name}</span>
          </button>
        )
      }
      for (let i = 0; i < empties; i++) {
        const want = !!selected && fits(selected, g)
        rows.push(
          <button
            key={`empty-${g}-${i}`}
            onClick={() => place(team, g)}
            aria-label={`Empty ${g === 'scrumhalf' ? 'scrum-half' : g} slot, Team ${team}`}
            className="w-full h-8 rounded-lg mb-1 flex items-center px-2 transition"
            style={want
              ? { border: '1.5px dashed #7C3AED', background: '#F3E8FF', color: '#7C3AED' }
              : { border: '1.5px dashed #D8C6EC', background: '#FBF8FF', color: '#B9A6CF' }}
          >
            <span className="text-[9px] font-extrabold tracking-wider">{GROUP_GHOST[g]}</span>
          </button>
        )
      }
      return rows
    }

    return (
      <div className="bg-white rounded-xl p-2" style={{ border: '1px solid #E4D0F5' }}>
        <div className="flex items-center justify-between mb-1.5 px-0.5">
          <span className="text-[11px] font-extrabold tracking-wider" style={{ color: teamColor }}>TEAM {team}</span>
          <span
            className="mono text-[10px] font-bold"
            style={{ color: over ? '#DC2626' : total === playersPerSide ? '#059669' : '#A8A29E' }}
          >
            {total}/{playersPerSide}
          </span>
        </div>
        {section('forward', limits.f)}
        {section('back', limits.b)}
        {section('scrumhalf', limits.sh)}
        <div className="mt-1 pt-1.5 px-0.5 pb-0.5" style={{ borderTop: '1px solid #F0E6FA' }}>
          <span className="block text-[8px] font-extrabold tracking-widest" style={{ color: '#A8A29E' }}>
            BENCH{benched.length > 0 ? ` (${benched.length})` : ''}
          </span>
          {benched.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {benched.map(p => (
                <button
                  key={p.id}
                  onClick={() => pickUp(p.id)}
                  aria-label={`${p.name}, bench Team ${team} — pick up`}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold active:scale-95 transition"
                  style={{ border: '1px solid #E4D0F5', background: 'white', color: INK }}
                >
                  <GroupBadge group={p.defaultGroup} size="xs" />
                  <span className="truncate max-w-[80px]">{p.name}</span>
                </button>
              ))}
            </div>
          )}
          {selected && (
            <button
              onClick={() => bench(team)}
              aria-label={`Add ${selected.name} to Team ${team} bench`}
              className="w-full h-7 mt-1 rounded-lg flex items-center justify-center text-[9px] font-extrabold tracking-wider transition"
              style={{ border: '1.5px dashed #7C3AED', background: '#F3E8FF', color: '#7C3AED' }}
            >
              + BENCH
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        {teamPanel('A')}
        {teamPanel('B')}
      </div>

      {selected && (
        <div className="flex items-center gap-2 mt-2 px-2.5 py-1.5 rounded-lg" style={{ background: '#F3E8FF' }}>
          <span className="flex-1 text-xs font-semibold truncate" style={{ color: '#5B1A99' }}>
            Placing {selected.name} — tap a slot or bench
          </span>
          <button
            onClick={markUnavailable}
            className="flex-shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-bold active:scale-95 transition"
            style={{ background: 'white', border: '1px solid #E7D5D5', color: '#B42318' }}
          >
            ✗ Unavailable
          </button>
        </div>
      )}

      {pool.length > 0 ? (
        <>
          {poolF.length > 0 && (
            <>
              <div className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mt-3 mb-1.5 px-1">Available — forwards</div>
              <div className="flex flex-wrap gap-1.5">{poolF.map(poolChip)}</div>
            </>
          )}
          {poolBS.length > 0 && (
            <>
              <div className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mt-3 mb-1.5 px-1">Available — backs &amp; SH</div>
              <div className="flex flex-wrap gap-1.5">{poolBS.map(poolChip)}</div>
            </>
          )}
        </>
      ) : (
        <div className="text-center text-xs text-stone-400 mt-4">Everyone placed 🎉</div>
      )}

      {unavail.length > 0 && (
        <div className="mt-3 rounded-lg px-3 py-2" style={{ background: '#EFEAF3' }}>
          <span className="text-[11px] font-bold" style={{ color: '#57534E' }}>
            Unavailable ({unavail.length}) — tap to restore
          </span>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {unavail.map(p => {
              const declined = spondAvailability?.declined.includes(p.id)
              return (
                <button
                  key={p.id}
                  onClick={() => { onAssign(p.id, null); onOverride(p.id, null) }}
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold active:scale-95 transition"
                  style={{ border: '1px solid #DDD3E4', background: 'white', color: '#78716C' }}
                >
                  {p.name}
                  {declined && <span style={{ color: '#dc2626' }}>✗</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
