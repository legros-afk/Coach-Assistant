import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check, ChevronLeft, ClipboardPaste, CloudUpload, List, RefreshCw } from 'lucide-react'
import { validateComposition } from '@/lib/domain/validateComposition'
import { parseTeamSheet } from '@/lib/domain/parseTeamSheet'
import type { ParsedSlot } from '@/lib/domain/parseTeamSheet'
import type { Group, ID, Player, TeamSheet } from '@/lib/events/types'
import { useSquadStore } from '@/features/squad/useSquadStore'
import { useFixtureStore } from './useFixtureStore'
import type { Fixture } from '@/lib/events/types'
import { FOLDER_ID_KEY } from '@/lib/drive/driveRead'
import { OAUTH_ENABLED } from '@/lib/drive/driveAuth'
import { publishFixture } from '@/lib/drive/drivePublish'

const PURPLE      = '#3D0066'
const PURPLE_DARK = '#5B1A99'
const INK         = '#1A1A1A'

const GROUP_SHORT: Record<Group, string> = { forward: 'F', back: 'B', scrumhalf: 'SH' }

// ── assignment model ─────────────────────────────────────────────────────────
type Assignment = 'A' | 'bench-A' | 'B' | 'bench-B' | 'unavailable' | null

const ASSIGN_STYLE: Record<NonNullable<Assignment>, { bg: string; color: string; label: string }> = {
  'A':           { bg: PURPLE,      color: 'white',   label: 'A' },
  'bench-A':     { bg: '#C084FC',   color: 'white',   label: 'bA' },
  'B':           { bg: '#1D4ED8',   color: 'white',   label: 'B' },
  'bench-B':     { bg: '#93C5FD',   color: INK,       label: 'bB' },
  'unavailable': { bg: '#C8A0E8',   color: '#78716C', label: '✗' },
}

const todayIso = () => new Date().toISOString().slice(0, 10)
let _seq = 0
const newId = () => `f-${Date.now()}-${++_seq}`

// Forwards are always 5 (scrum requirement), SH always 1, backs fill the rest.
const teamLimits = (n: number) => ({ f: 5, b: Math.max(0, n - 6) })

// ── helpers ───────────────────────────────────────────────────────────────────
function countTeam(team: 'A' | 'B', assignments: Map<ID, Assignment>, groupOverrides: Map<ID, Group>, squad: Player[]) {
  const starters = squad.filter(p => assignments.get(p.id) === team)
  const groups = starters.map(p => groupOverrides.get(p.id) ?? p.defaultGroup)
  const f = groups.filter(g => g === 'forward').length
  const b = groups.filter(g => g === 'back').length
  const sh = groups.filter(g => g === 'scrumhalf').length
  const bench = squad.filter(p => assignments.get(p.id) === `bench-${team}`).length
  const comp = validateComposition(groups)
  return { f, b, sh, bench, comp }
}

function buildSheet(team: 'A' | 'B', assignments: Map<ID, Assignment>, groupOverrides: Map<ID, Group>, squad: Player[]): TeamSheet {
  const starters = squad.filter(p => assignments.get(p.id) === team)
  const bench    = squad.filter(p => assignments.get(p.id) === `bench-${team}`)
  const unavail  = squad.filter(p => assignments.get(p.id) === 'unavailable')
  const forwards    = starters.filter(p => (groupOverrides.get(p.id) ?? p.defaultGroup) === 'forward').map(p => p.id)
  const backs       = starters.filter(p => (groupOverrides.get(p.id) ?? p.defaultGroup) === 'back').map(p => p.id)
  const scrumhalves = starters.filter(p => (groupOverrides.get(p.id) ?? p.defaultGroup) === 'scrumhalf').map(p => p.id)
  return {
    id: newId(),
    label: team,
    starters: { forwards, backs, scrumhalf: scrumhalves[0] ?? '' },
    bench: bench.map(p => p.id),
    unavailable: unavail.map(p => p.id),
  }
}

// ── sub-components ─────────────────────────────────────────────────────────────
function GroupBadge({ group, size = 'sm' }: { group: Group; size?: 'sm' | 'xs' }) {
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
  existing?: Fixture
  initialPlayersPerSide?: number
  onBack: () => void
  onSaved: () => void
}

export default function FixturePrepScreen({ existing, initialPlayersPerSide, onBack, onSaved }: Props) {
  const { squad, isHydrated: squadReady, hydrate: hydrateSquad } = useSquadStore()
  const { saveFixture } = useFixtureStore()

  useEffect(() => { if (!squadReady) hydrateSquad() }, [squadReady, hydrateSquad])

  const players = useMemo(() =>
    [...(squad?.players ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [squad]
  )

  // ── fixture fields
  const [date, setDate]               = useState(existing?.date ?? todayIso())
  const [opponent, setOpponent]       = useState(existing?.opponent ?? '')
  const [playersPerSide] = useState(existing?.playersPerSide ?? initialPlayersPerSide ?? 12)

  // ── mode
  const [mode, setMode] = useState<'checklist' | 'paste'>('checklist')

  // ── checklist
  const initAssignments = (): Map<ID, Assignment> => {
    const m = new Map<ID, Assignment>()
    if (existing) {
      for (const ts of existing.teamSheets) {
        const label = ts.label as 'A' | 'B'
        for (const id of ts.starters.forwards)  m.set(id, label)
        for (const id of ts.starters.backs)     m.set(id, label)
        if (ts.starters.scrumhalf) m.set(ts.starters.scrumhalf, label)
        for (const id of ts.bench)              m.set(id, `bench-${label}`)
        for (const id of ts.unavailable)        m.set(id, 'unavailable')
      }
    }
    return m
  }
  const initOverrides = (): Map<ID, Group> => {
    const m = new Map<ID, Group>()
    if (existing) {
      for (const ts of existing.teamSheets) {
        for (const id of ts.starters.forwards) m.set(id, 'forward')
        for (const id of ts.starters.backs)    m.set(id, 'back')
        if (ts.starters.scrumhalf) m.set(ts.starters.scrumhalf, 'scrumhalf')
      }
    }
    return m
  }
  const [assignments,   setAssignments]   = useState<Map<ID, Assignment>>(initAssignments)
  const [groupOverrides, setGroupOverrides] = useState<Map<ID, Group>>(initOverrides)

  const assign = (id: ID, val: Assignment) =>
    setAssignments(m => new Map(m).set(id, val))

  const cycleGroup = (p: Player) => {
    const cur = groupOverrides.get(p.id) ?? p.defaultGroup
    const eligible = p.eligibleGroups
    if (eligible.length <= 1) return
    const idx = eligible.indexOf(cur)
    const next = eligible[(idx + 1) % eligible.length]
    setGroupOverrides(m => new Map(m).set(p.id, next))
  }

  // ── paste
  const [pasteText,   setPasteText]   = useState('')
  const [parseResult, setParseResult] = useState<ReturnType<typeof parseTeamSheet> | null>(null)
  const [resolutions, setResolutions] = useState<Map<string, Player | 'skip'>>(new Map())

  const handleParse = () => {
    if (!pasteText.trim() || !players.length) return
    setParseResult(parseTeamSheet(pasteText, players))
    setResolutions(new Map())
  }

  const applyParseResult = () => {
    if (!parseResult) return
    const newAssign = new Map(assignments)
    const newOverrides = new Map(groupOverrides)
    for (const block of parseResult.blocks) {
      const team = (block.label.slice(-1).toUpperCase() === 'B' ? 'B' : 'A') as 'A' | 'B'
      for (const slot of block.starters) {
        const player = slot.status === 'resolved' ? slot.player
          : resolutions.get((slot as { token: string }).token) instanceof Object
            ? resolutions.get((slot as { token: string }).token) as Player
            : null
        if (!player) continue
        newAssign.set(player.id, team)
        if (slot.status === 'resolved') newOverrides.set(player.id, slot.assignedGroup)
      }
      for (const slot of block.bench) {
        const player = slot.status === 'resolved' ? slot.player
          : resolutions.get((slot as { token: string }).token) instanceof Object
            ? resolutions.get((slot as { token: string }).token) as Player
            : null
        if (!player) continue
        newAssign.set(player.id, `bench-${team}`)
      }
    }
    setAssignments(newAssign)
    setGroupOverrides(newOverrides)
    setParseResult(null)
    setPasteText('')
    setMode('checklist')
  }

  // ── review + save + publish
  const folderId = localStorage.getItem(FOLDER_ID_KEY)
  const canPublish = OAUTH_ENABLED && !!folderId

  const [showReview, setShowReview] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [publishResult, setPublishResult] = useState<{ ok: boolean; msg: string } | null>(null)

  const teamA = useMemo(() => countTeam('A', assignments, groupOverrides, players), [assignments, groupOverrides, players])
  const teamB = useMemo(() => countTeam('B', assignments, groupOverrides, players), [assignments, groupOverrides, players])
  const hasAnyA = players.some(p => assignments.get(p.id) === 'A' || assignments.get(p.id) === 'bench-A')
  const hasAnyB = players.some(p => assignments.get(p.id) === 'B' || assignments.get(p.id) === 'bench-B')
  const canSave = opponent.trim() && (hasAnyA || hasAnyB)

  function buildFixture(): Fixture {
    const teamSheets: TeamSheet[] = []
    if (hasAnyA) teamSheets.push(buildSheet('A', assignments, groupOverrides, players))
    if (hasAnyB) teamSheets.push(buildSheet('B', assignments, groupOverrides, players))
    return {
      id: existing?.id ?? newId(),
      date,
      opponent: opponent.trim(),
      teamSheets,
      playersPerSide,
      updatedAt: new Date().toISOString(),
      version: (existing?.version ?? 0) + 1,
    }
  }

  const handleSave = async () => {
    await saveFixture(buildFixture())
    setShowReview(false)
    onSaved()
  }

  const handleSaveAndPublish = async () => {
    if (!folderId) return
    const fixture = buildFixture()
    await saveFixture(fixture)
    setPublishing(true)
    setPublishResult(null)
    const result = await publishFixture(fixture, folderId)
    setPublishing(false)
    setPublishResult({ ok: result.ok, msg: result.ok ? 'Published to Drive.' : result.error })
    if (result.ok) setTimeout(() => { setShowReview(false); onSaved() }, 900)
  }

  // ── grouped players for checklist
  const forwards  = players.filter(p => p.defaultGroup === 'forward')
  const backs     = players.filter(p => p.defaultGroup === 'back' && !p.eligibleGroups.includes('scrumhalf'))
  const shEligible = players.filter(p => p.defaultGroup === 'back' && p.eligibleGroups.includes('scrumhalf'))
  const forwards2  = players.filter(p => p.defaultGroup === 'forward' && p.eligibleGroups.includes('scrumhalf'))
  // Merge forwards who can cover SH into the SH section
  const shSection = [...shEligible, ...forwards2]
  const pureForwards = forwards.filter(p => !p.eligibleGroups.includes('scrumhalf'))

  // ── render helpers
  const renderPlayerRow = (p: Player) => {
    const cur = assignments.get(p.id) ?? null
    const group = groupOverrides.get(p.id) ?? p.defaultGroup
    const isStarter = cur === 'A' || cur === 'B'

    const handleA = () => {
      if (cur === 'A') assign(p.id, 'bench-A')
      else if (cur === 'bench-A') assign(p.id, null)
      else assign(p.id, 'A')
    }
    const handleB = () => {
      if (cur === 'B') assign(p.id, 'bench-B')
      else if (cur === 'bench-B') assign(p.id, null)
      else assign(p.id, 'B')
    }
    const handleUnavail = () => assign(p.id, cur === 'unavailable' ? null : 'unavailable')

    const aStyle = cur === 'A' ? ASSIGN_STYLE['A'] : cur === 'bench-A' ? ASSIGN_STYLE['bench-A'] : null
    const bStyle = cur === 'B' ? ASSIGN_STYLE['B'] : cur === 'bench-B' ? ASSIGN_STYLE['bench-B'] : null

    return (
      <div key={p.id} className="flex items-center gap-2 py-1.5 border-b last:border-0" style={{ borderColor: '#F8F4FF' }}>
        <button onClick={() => isStarter && cycleGroup(p)} className={isStarter ? 'cursor-pointer' : 'cursor-default'}>
          <GroupBadge group={group} />
        </button>
        <span className="flex-1 text-sm font-medium truncate" style={{ color: cur === 'unavailable' ? '#A8A29E' : INK }}>{p.name}</span>
        <button
          onClick={handleA}
          className="w-10 h-8 rounded-lg text-xs font-bold flex items-center justify-center flex-shrink-0 active:scale-95 transition"
          style={aStyle ? { background: aStyle.bg, color: aStyle.color } : { background: '#F8F4FF', color: '#7B5FA8' }}
        >
          {aStyle ? aStyle.label : 'A'}
        </button>
        <button
          onClick={handleB}
          className="w-10 h-8 rounded-lg text-xs font-bold flex items-center justify-center flex-shrink-0 active:scale-95 transition"
          style={bStyle ? { background: bStyle.bg, color: bStyle.color } : { background: '#F8F4FF', color: '#7B5FA8' }}
        >
          {bStyle ? bStyle.label : 'B'}
        </button>
        <button
          onClick={handleUnavail}
          className="w-7 h-8 rounded-lg text-xs flex items-center justify-center flex-shrink-0 active:scale-95 transition"
          style={cur === 'unavailable'
            ? { background: ASSIGN_STYLE['unavailable'].bg, color: ASSIGN_STYLE['unavailable'].color }
            : { background: '#F8F4FF', color: '#C8A0E8' }}
        >
          ✗
        </button>
      </div>
    )
  }

  const renderSection = (title: string, list: Player[]) => list.length === 0 ? null : (
    <div className="mb-2">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 px-1 py-1.5">{title}</div>
      <div className="bg-white rounded-lg px-3" style={{ border: '1px solid #E4D0F5' }}>
        {list.map(renderPlayerRow)}
      </div>
    </div>
  )

  const renderParsedSlot = (slot: ParsedSlot, isBench: boolean) => {
    if (slot.status === 'resolved') {
      return (
        <div key={slot.player.id} className="flex items-center gap-2 py-1.5">
          <Check size={14} className="text-emerald-500 flex-shrink-0" strokeWidth={2.5} />
          <GroupBadge group={slot.assignedGroup} size="xs" />
          <span className="text-sm flex-1">{slot.player.name}</span>
          {isBench && <span className="text-xs text-stone-400">bench</span>}
        </div>
      )
    }
    if (slot.status === 'ambiguous') {
      const cur = resolutions.get(slot.token)
      return (
        <div key={slot.token} className="py-1.5">
          <div className="flex items-center gap-1.5 mb-1">
            <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" strokeWidth={2.5} />
            <span className="text-sm font-semibold">"{slot.token}" — {slot.candidates.length} matches</span>
          </div>
          <div className="pl-5 space-y-0.5">
            {slot.candidates.map(c => (
              <button
                key={c.id}
                onClick={() => setResolutions(m => new Map(m).set(slot.token, c))}
                className="flex items-center gap-2 w-full py-1 px-2 rounded text-sm active:scale-[0.99]"
                style={{ background: cur === c ? '#D1FAE5' : '#F8F4FF', color: INK }}
              >
                <GroupBadge group={c.defaultGroup} size="xs" />
                {c.name}
              </button>
            ))}
            <button
              onClick={() => setResolutions(m => new Map(m).set(slot.token, 'skip'))}
              className="text-xs text-stone-400 px-2 py-0.5"
            >Skip</button>
          </div>
        </div>
      )
    }
    // unknown
    return (
      <div key={slot.token} className="flex items-center gap-2 py-1.5">
        <AlertTriangle size={14} className="text-red-400 flex-shrink-0" strokeWidth={2.5} />
        <span className="text-sm">"{slot.token}" — not found</span>
        {slot.fuzzyMatch && (
          <button
            onClick={() => setResolutions(m => new Map(m).set(slot.token, slot.fuzzyMatch!))}
            className="ml-auto text-xs font-semibold px-2 py-0.5 rounded"
            style={{ background: PURPLE, color: 'white' }}
          >
            Use {slot.fuzzyMatch.name}
          </button>
        )}
      </div>
    )
  }

  const limits = teamLimits(playersPerSide)

  const CompositionBadge = ({ label, stats }: { label: string; stats: ReturnType<typeof countTeam> }) => {
    const fOver = stats.f > limits.f
    const bOver = stats.b > limits.b
    const shOver = stats.sh > 1
    const anyOver = fOver || bOver || shOver
    const allFull = stats.f === limits.f && stats.b === limits.b && stats.sh === 1
    const bg = anyOver ? '#FEE2E2' : allFull ? '#D1FAE5' : '#F8F4FF'
    const titleColor = anyOver ? '#991B1B' : allFull ? '#065F46' : INK
    const slotColor = (n: number, max: number) =>
      n > max ? '#DC2626' : n === max ? '#059669' : '#78716C'
    return (
      <div className="flex-1 px-2 py-1.5 rounded" style={{ background: bg }}>
        <div className="text-[11px] font-bold" style={{ color: titleColor }}>Team {label}</div>
        <div className="text-[11px] flex gap-1">
          <span style={{ color: slotColor(stats.f, limits.f) }}>{stats.f}/{limits.f}F</span>
          <span style={{ color: '#C8A0E8' }}>·</span>
          <span style={{ color: slotColor(stats.b, limits.b) }}>{stats.b}/{limits.b}B</span>
          <span style={{ color: '#C8A0E8' }}>·</span>
          <span style={{ color: slotColor(stats.sh, 1) }}>{stats.sh}/1SH</span>
          <span style={{ color: '#C8A0E8' }}>·</span>
          <span style={{ color: '#78716C' }}>{stats.bench} bench</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-28" style={{ background: '#F8F4FF', color: INK }}>

      {/* Header */}
      <div className="sticky top-0 z-20" style={{ background: PURPLE }}>
        <div className="px-3 py-2 flex items-center gap-2" style={{ borderBottom: `1px solid ${PURPLE_DARK}` }}>
          <button onClick={onBack} className="tap-target flex items-center justify-center -ml-1">
            <ChevronLeft size={24} color="white" strokeWidth={2.5} />
          </button>
          <div className="flex-1 leading-tight">
            <div className="text-[13px] font-bold tracking-wide uppercase text-white">
              {existing ? `vs ${existing.opponent}` : 'New fixture'}
            </div>
            <div className="text-[10px] text-white/70">Team sheet prep</div>
          </div>
        </div>

        {/* Composition bar */}
        <div className="px-3 py-2 flex gap-2" style={{ background: INK }}>
          <CompositionBadge label="A" stats={teamA} />
          <CompositionBadge label="B" stats={teamB} />
        </div>
      </div>

      <div className="px-3 pt-3 space-y-3">
        {/* Fixture details */}
        <div className="bg-white rounded-lg p-3 space-y-2" style={{ border: '1px solid #E4D0F5' }}>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 block mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-2 py-2 rounded border text-sm outline-none"
                style={{ borderColor: '#E4D0F5', color: INK }}
              />
            </div>
            <div className="flex-1">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 block mb-1">Opponent</label>
              <input
                type="text"
                value={opponent}
                onChange={e => setOpponent(e.target.value)}
                placeholder="e.g. Saints"
                className="w-full px-2 py-2 rounded border text-sm outline-none"
                style={{ borderColor: '#E4D0F5', color: INK }}
              />
            </div>
          </div>
          <div className="flex items-center justify-between pt-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">Players per side</span>
            <span className="text-sm font-bold" style={{ color: INK }}>{playersPerSide}</span>
          </div>
        </div>

        {/* Mode tabs */}
        <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #E4D0F5' }}>
          {(['checklist', 'paste'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className="flex-1 py-2.5 text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-1.5 transition"
              style={{
                background: mode === m ? PURPLE : 'white',
                color: mode === m ? 'white' : '#7B5FA8',
              }}
            >
              {m === 'checklist' ? <><List size={13} /> Checklist</> : <><ClipboardPaste size={13} /> Paste</>}
            </button>
          ))}
        </div>

        {/* ── Checklist mode */}
        {mode === 'checklist' && (
          <div>
            <div className="text-[10px] text-stone-400 mb-2 px-1">
              Tap A or B to assign starter, tap again for bench, again to clear. ✗ = unavailable. Tap group badge on starters to change position.
            </div>
            {players.length === 0 ? (
              <div className="py-8 text-center text-sm text-stone-400">
                No squad loaded — go to Squad screen to add players.
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 px-4 pb-1">
                  <div className="w-6 flex-shrink-0" />
                  <div className="flex-1" />
                  <div className="w-10 text-center text-[10px] font-bold uppercase tracking-widest text-stone-400">A</div>
                  <div className="w-10 text-center text-[10px] font-bold uppercase tracking-widest text-stone-400">B</div>
                  <div className="w-7" />
                </div>
                {renderSection('Forwards', pureForwards)}
                {renderSection('Backs', backs)}
                {renderSection('SH / cover', shSection)}
              </>
            )}
          </div>
        )}

        {/* ── Paste mode */}
        {mode === 'paste' && (
          <div className="space-y-3">
            <textarea
              value={pasteText}
              onChange={e => { setPasteText(e.target.value); setParseResult(null) }}
              placeholder={"Team A: Alexander, Dylan, Elliott...\nBench: Dominic, Ethan\n\nTeam B: Archie, Arlo..."}
              rows={8}
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none bg-white"
              style={{ border: '1px solid #E4D0F5', color: INK }}
            />
            <button
              onClick={handleParse}
              disabled={!pasteText.trim() || !players.length}
              className="tap-target w-full rounded-lg font-bold text-sm active:scale-95 transition disabled:opacity-40"
              style={{ background: PURPLE, color: 'white', minHeight: '48px' }}
            >
              Parse names
            </button>

            {parseResult && (
              <div className="space-y-3">
                {parseResult.blocks.map((block, bi) => (
                  <div key={bi} className="bg-white rounded-lg p-3" style={{ border: '1px solid #E4D0F5' }}>
                    <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: PURPLE }}>
                      {block.label}
                    </div>
                    {block.starters.map(s => renderParsedSlot(s, false))}
                    {block.bench.map(s => renderParsedSlot(s, true))}
                  </div>
                ))}
                <button
                  onClick={applyParseResult}
                  className="tap-target w-full rounded-lg font-bold text-sm active:scale-95 transition"
                  style={{ background: '#10B981', color: 'white', minHeight: '48px' }}
                >
                  Apply to checklist
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Save button */}
      <div
        className="fixed bottom-16 left-0 right-0 px-3 py-3 z-30"
        style={{ background: '#F8F4FF', borderTop: '1px solid #C8A0E8' }}
      >
        <button
          onClick={() => setShowReview(true)}
          disabled={!canSave}
          className="tap-target w-full rounded-lg font-bold text-base active:scale-95 transition disabled:opacity-40"
          style={{ background: PURPLE, color: 'white', minHeight: '52px' }}
        >
          Review & save
        </button>
      </div>

      {/* Review modal */}
      {showReview && (
        <div
          className="fixed inset-0 z-50 flex items-end"
          style={{ background: 'rgba(32,24,32,0.7)' }}
          onClick={() => setShowReview(false)}
        >
          <div
            className="bg-white w-full rounded-t-2xl p-4 max-h-[80vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="text-xl font-bold mb-1" style={{ color: INK }}>Review</div>
            <div className="text-sm text-stone-400 mb-4">{date} · vs {opponent}</div>

            {(['A', 'B'] as const).map(team => {
              const stats = team === 'A' ? teamA : teamB
              const hasPlayers = players.some(p => {
                const a = assignments.get(p.id)
                return a === team || a === `bench-${team}`
              })
              if (!hasPlayers) return null
              const starters = players.filter(p => assignments.get(p.id) === team)
              const bench    = players.filter(p => assignments.get(p.id) === `bench-${team}`)
              return (
                <div key={team} className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-bold text-base" style={{ color: INK }}>Team {team}</span>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-semibold"
                      style={{ background: stats.comp.valid ? '#D1FAE5' : '#FEF3C7', color: stats.comp.valid ? '#065F46' : '#92400E' }}
                    >
                      {stats.comp.valid ? '✓ Valid' : stats.comp.message}
                    </span>
                  </div>
                  <div className="space-y-0.5 mb-2">
                    {starters.map(p => {
                      const g = groupOverrides.get(p.id) ?? p.defaultGroup
                      return (
                        <div key={p.id} className="flex items-center gap-2 text-sm py-0.5">
                          <GroupBadge group={g} size="xs" />
                          <span>{p.name}</span>
                        </div>
                      )
                    })}
                  </div>
                  {bench.length > 0 && (
                    <div className="text-xs text-stone-400">
                      Bench: {bench.map(p => p.name).join(', ')}
                    </div>
                  )}
                </div>
              )
            })}

            <button
              onClick={handleSave}
              disabled={publishing}
              className="tap-target w-full rounded-lg font-bold text-base active:scale-95 transition mt-2 disabled:opacity-40"
              style={{ background: PURPLE, color: 'white', minHeight: '52px' }}
            >
              Save fixture
            </button>

            {canPublish && (
              <button
                onClick={handleSaveAndPublish}
                disabled={publishing}
                className="tap-target w-full rounded-lg font-bold text-base active:scale-95 transition mt-2 flex items-center justify-center gap-2 disabled:opacity-40"
                style={{ background: '#059669', color: 'white', minHeight: '52px' }}
              >
                {publishing
                  ? <RefreshCw size={16} className="animate-spin" />
                  : <CloudUpload size={16} strokeWidth={2} />
                }
                Save & Publish to Drive
              </button>
            )}

            {publishResult && (
              <div
                className="mt-2 text-sm text-center px-2 py-1.5 rounded-lg"
                style={{
                  background: publishResult.ok ? '#D1FAE5' : '#FEE2E2',
                  color: publishResult.ok ? '#065F46' : '#991B1B',
                }}
              >
                {publishResult.msg}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
