import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Check, ChevronLeft, ClipboardPaste, CloudUpload, Copy, LayoutGrid, RefreshCw, Zap } from 'lucide-react'
import { getSpondAvailability, type SpondAvailability } from '@/lib/spond/spondSync'
import { spondConfigured } from '@/lib/spond/spondStore'
import { teamLimits, validateComposition } from '@/lib/domain/validateComposition'
import { draftTeams } from '@/lib/domain/draftTeams'
import { formatTeamsForWhatsApp } from '@/lib/domain/formatTeamSheet'
import { parseTeamSheet } from '@/lib/domain/parseTeamSheet'
import type { ParsedSlot } from '@/lib/domain/parseTeamSheet'
import type { Group, ID, Player, TeamSheet } from '@/lib/events/types'
import { useSquadStore } from '@/features/squad/useSquadStore'
import { useFixtureStore } from './useFixtureStore'
import type { Fixture } from '@/lib/events/types'
import { clubPinConfigured } from '@/lib/drive/driveRead'
import { DRIVE_FOLDER_ID } from '@/config/club'
import { publishFixture } from '@/lib/drive/drivePublish'
import TeamBoard, { GroupBadge, type Assignment } from './TeamBoard'

const PURPLE      = '#3D0066'
const PURPLE_DARK = '#5B1A99'
const INK         = '#1A1A1A'

const TEAM_COUNT_KEY = 'coach-team-count'

const todayIso = () => new Date().toISOString().slice(0, 10)
let _seq = 0
const newId = () => `f-${Date.now()}-${++_seq}`

// ── helpers ───────────────────────────────────────────────────────────────────
function countTeam(team: 'A' | 'B', assignments: Map<ID, Assignment>, groupOverrides: Map<ID, Group>, squad: Player[], playersPerSide: number) {
  const starters = squad.filter(p => assignments.get(p.id) === team)
  const groups = starters.map(p => groupOverrides.get(p.id) ?? p.defaultGroup)
  const f = groups.filter(g => g === 'forward').length
  const b = groups.filter(g => g === 'back').length
  const sh = groups.filter(g => g === 'scrumhalf').length
  const bench = squad.filter(p => assignments.get(p.id) === `bench-${team}`).length
  const comp = validateComposition(groups, playersPerSide)
  return { f, b, sh, bench, comp }
}

function buildSheet(team: 'A' | 'B', assignments: Map<ID, Assignment>, groupOverrides: Map<ID, Group>, squad: Player[], existingId?: ID): TeamSheet {
  const starters = squad.filter(p => assignments.get(p.id) === team)
  const bench    = squad.filter(p => assignments.get(p.id) === `bench-${team}`)
  const unavail  = squad.filter(p => assignments.get(p.id) === 'unavailable')
  const forwards    = starters.filter(p => (groupOverrides.get(p.id) ?? p.defaultGroup) === 'forward').map(p => p.id)
  const backs       = starters.filter(p => (groupOverrides.get(p.id) ?? p.defaultGroup) === 'back').map(p => p.id)
  const scrumhalves = starters.filter(p => (groupOverrides.get(p.id) ?? p.defaultGroup) === 'scrumhalf').map(p => p.id)
  return {
    // Match records are keyed by team-sheet ID — regenerating on edit would orphan played matches
    id: existingId ?? newId(),
    label: team,
    starters: { forwards, backs, scrumhalf: scrumhalves[0] ?? '' },
    bench: bench.map(p => p.id),
    unavailable: unavail.map(p => p.id),
  }
}

interface Props {
  existing?: Fixture
  initialPlayersPerSide?: number
  initialOpponent?: string
  initialDate?: string
  initialSpondEventId?: string
  onBack: () => void
  onSaved: () => void
}

export default function FixturePrepScreen({ existing, initialPlayersPerSide, initialOpponent, initialDate, initialSpondEventId, onBack, onSaved }: Props) {
  const { squad, isHydrated: squadReady, hydrate: hydrateSquad } = useSquadStore()
  const { fixtures, isHydrated: fixturesReady, hydrate: hydrateFixtures, saveFixture } = useFixtureStore()

  useEffect(() => { if (!squadReady) hydrateSquad() }, [squadReady, hydrateSquad])
  useEffect(() => { if (!fixturesReady) hydrateFixtures() }, [fixturesReady, hydrateFixtures])

  const players = useMemo(() =>
    [...(squad?.players ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [squad]
  )

  // ── fixture fields
  const [date, setDate]           = useState(existing?.date ?? initialDate ?? todayIso())
  const [opponent, setOpponent]   = useState(existing?.opponent ?? initialOpponent ?? '')
  const opponentRef = useRef<HTMLInputElement>(null)
  const [playersPerSide]          = useState(existing?.playersPerSide ?? initialPlayersPerSide ?? 12)
  // An existing fixture already says how many teams it was built for; a new one
  // falls back to whatever this coach chose last.
  const [teamCount, setTeamCountState] = useState<1 | 2>(() => {
    if (existing) return existing.teamSheets.length > 1 ? 2 : 1
    const stored = localStorage.getItem(TEAM_COUNT_KEY)
    return stored === '1' ? 1 : 2
  })
  const [spondEventId]            = useState(existing?.spondEventId ?? initialSpondEventId)

  // ── spond availability sync
  const [spondSyncing,      setSpondSyncing]      = useState(false)
  const [spondToast,        setSpondToast]        = useState('')
  const [spondAvailability, setSpondAvailability] = useState<SpondAvailability | null>(null)

  const showSpondToast = (msg: string) => {
    setSpondToast(msg)
    setTimeout(() => setSpondToast(''), 3500)
  }

  const syncSpondAvailability = async () => {
    if (!spondEventId) return
    setSpondSyncing(true)
    try {
      const avail = await getSpondAvailability(spondEventId, players)
      setSpondAvailability(avail)
      // Mark declined players as unavailable; leave accepted/unanswered alone
      if (avail.declined.length > 0) {
        setAssignments(m => {
          const next = new Map(m)
          for (const id of avail.declined) next.set(id, 'unavailable')
          return next
        })
      }
      const parts = [
        avail.accepted.length   > 0 && `${avail.accepted.length} ✓`,
        avail.declined.length   > 0 && `${avail.declined.length} ✗`,
        avail.unanswered.length > 0 && `${avail.unanswered.length} ?`,
      ].filter(Boolean).join('  ')
      showSpondToast(parts || 'No responses yet')
    } catch (e) {
      showSpondToast(e instanceof Error ? e.message : 'Spond sync failed')
    } finally {
      setSpondSyncing(false)
    }
  }

  // ── mode
  const [mode, setMode] = useState<'board' | 'paste'>('board')

  // ── board
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

  // Players placed by the last draft — a manual move takes a player out of
  // this set, which is what lets Re-draft keep hand placements pinned.
  const [draftedIds, setDraftedIds] = useState<Set<ID>>(new Set())

  const setTeamCount = (n: 1 | 2) => {
    localStorage.setItem(TEAM_COUNT_KEY, String(n))
    setTeamCountState(n)
    if (n === 1) {
      // Team B is hidden from here on — anyone parked there would otherwise be
      // saved into a team sheet the coach can no longer see or edit.
      setAssignments(m => {
        const next = new Map(m)
        for (const [id, val] of next) {
          if (val === 'B' || val === 'bench-B') next.set(id, null)
        }
        return next
      })
    }
  }

  const assign = (id: ID, val: Assignment) => {
    setAssignments(m => new Map(m).set(id, val))
    setDraftedIds(s => {
      if (!s.has(id)) return s
      const next = new Set(s)
      next.delete(id)
      return next
    })
  }

  const setOverride = (id: ID, group: Group | null) =>
    setGroupOverrides(m => {
      const next = new Map(m)
      if (group) next.set(id, group)
      else next.delete(id)
      return next
    })

  // ── draft
  // Starts per player across earlier saved fixtures — the fairness evidence.
  const startsById = useMemo(() => {
    const m = new Map<ID, number>()
    for (const f of fixtures) {
      if (f.id === existing?.id || f.date >= date) continue
      for (const ts of f.teamSheets) {
        const ids = [...ts.starters.forwards, ...ts.starters.backs]
        if (ts.starters.scrumhalf) ids.push(ts.starters.scrumhalf)
        for (const id of ids) m.set(id, (m.get(id) ?? 0) + 1)
      }
    }
    return m
  }, [fixtures, existing?.id, date])

  const handleDraft = () => {
    // Release what the previous draft placed; hand placements stay locked.
    const base = new Map(assignments)
    const baseOverrides = new Map(groupOverrides)
    for (const id of draftedIds) {
      if (base.get(id) !== 'unavailable') {
        base.set(id, null)
        baseOverrides.delete(id)
      }
    }
    const result = draftTeams({
      players,
      existing: base,
      groupOverrides: baseOverrides,
      playersPerSide,
      starts: startsById,
      teamCount,
    })
    result.assignments.forEach((v, k) => base.set(k, v))
    result.groups.forEach((v, k) => baseOverrides.set(k, v))
    setAssignments(base)
    setGroupOverrides(baseOverrides)
    setDraftedIds(new Set(result.assignments.keys()))
  }

  const [clearArmed, setClearArmed] = useState(false)
  const handleClear = () => {
    if (!clearArmed) {
      setClearArmed(true)
      setTimeout(() => setClearArmed(false), 2500)
      return
    }
    setClearArmed(false)
    setAssignments(m => {
      const next = new Map(m)
      for (const [id, val] of next) if (val !== 'unavailable') next.set(id, null)
      return next
    })
    setGroupOverrides(new Map())
    setDraftedIds(new Set())
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
    setMode('board')
  }

  // ── save + publish (the board is the review)
  const canPublish = clubPinConfigured()

  const [publishing, setPublishing] = useState(false)
  const [publishResult, setPublishResult] = useState<{ ok: boolean; msg: string } | null>(null)

  const teamA = useMemo(() => countTeam('A', assignments, groupOverrides, players, playersPerSide), [assignments, groupOverrides, players, playersPerSide])
  const teamB = useMemo(() => countTeam('B', assignments, groupOverrides, players, playersPerSide), [assignments, groupOverrides, players, playersPerSide])

  const hasRatings = players.some(p => p.ratings)
  const balance = useMemo(() => {
    const calc = (team: 'A' | 'B') => {
      const starters = players.filter(p => assignments.get(p.id) === team)
      if (starters.length === 0) return null
      const avg = (f: (p: Player) => number) =>
        (starters.reduce((sum, p) => sum + f(p), 0) / starters.length).toFixed(1)
      return {
        starts: avg(p => startsById.get(p.id) ?? 0),
        impact: avg(p => p.ratings?.impact ?? 3),
      }
    }
    return { A: calc('A'), B: calc('B') }
  }, [players, assignments, startsById])
  const hasAnyA = players.some(p => assignments.get(p.id) === 'A' || assignments.get(p.id) === 'bench-A')
  const hasAnyB = players.some(p => assignments.get(p.id) === 'B' || assignments.get(p.id) === 'bench-B')
  const canSave = opponent.trim() && (hasAnyA || hasAnyB)
  const cantSaveReason = !opponent.trim()
    ? 'Add an opponent name to save'
    : !hasAnyA && !hasAnyB
      ? 'Place at least one player to save'
      : null

  const jumpToOpponent = () => {
    opponentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    opponentRef.current?.focus()
  }

  function buildFixture(): Fixture {
    const teamSheets: TeamSheet[] = []
    const sheetId = (team: 'A' | 'B') => existing?.teamSheets.find(ts => ts.label === team)?.id
    if (hasAnyA) teamSheets.push(buildSheet('A', assignments, groupOverrides, players, sheetId('A')))
    if (hasAnyB) teamSheets.push(buildSheet('B', assignments, groupOverrides, players, sheetId('B')))
    return {
      id: existing?.id ?? newId(),
      date,
      opponent: opponent.trim(),
      teamSheets,
      playersPerSide,
      spondEventId,
      updatedAt: new Date().toISOString(),
      version: (existing?.version ?? 0) + 1,
    }
  }

  const handleSave = async () => {
    await saveFixture(buildFixture())
    onSaved()
  }

  const [copyToast, setCopyToast] = useState('')
  const handleCopy = async () => {
    const msg = formatTeamsForWhatsApp({
      teamName: squad?.name ?? 'Woodford',
      opponent: opponent.trim() || 'TBC',
      date,
      players,
      assignments,
      groupOverrides,
    })
    try {
      await navigator.clipboard.writeText(msg)
      setCopyToast('Copied — paste into WhatsApp')
    } catch {
      setCopyToast('Copy failed — check browser permissions')
    }
    setTimeout(() => setCopyToast(''), 3000)
  }

  const handleSaveAndPublish = async () => {
    const fixture = buildFixture()
    await saveFixture(fixture)
    setPublishing(true)
    setPublishResult(null)
    const result = await publishFixture(fixture, DRIVE_FOLDER_ID)
    setPublishing(false)
    setPublishResult({ ok: result.ok, msg: result.ok ? 'Published to Drive.' : result.error })
    if (result.ok) setTimeout(() => onSaved(), 900)
  }

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

  // Slim fill indicator — the board itself shows composition, this just keeps
  // orientation while the pool is scrolled into view.
  const FillBadge = ({ label, stats }: { label: string; stats: ReturnType<typeof countTeam> }) => {
    const total = stats.f + stats.b + stats.sh
    const over = stats.f > limits.f || stats.b > limits.b || stats.sh > limits.sh
    const color = over ? '#F87171' : stats.comp.valid ? '#4ade80' : 'rgba(255,255,255,0.85)'
    return (
      <div className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-bold" style={{ color }}>
        <span>Team {label} · {total}/{playersPerSide}{stats.comp.valid ? ' ✓' : ''}</span>
        {stats.bench > 0 && (
          <span className="font-medium" style={{ opacity: 0.7 }}>+{stats.bench} bench</span>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-44" style={{ background: '#F8F4FF', color: INK }}>

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
            {spondAvailability ? (
              <div className="text-[10px] font-semibold flex items-center gap-1.5" style={{ color: '#4ade80' }}>
                <Zap size={9} strokeWidth={2.5} />
                <span>
                  {spondAvailability.accepted.length} ✓
                  {' · '}{spondAvailability.declined.length} ✗
                  {' · '}{spondAvailability.unanswered.length} ?
                </span>
              </div>
            ) : (
              <div className="text-[10px] text-white/70">
                {spondEventId && spondConfigured() ? 'Tap ⚡ to sync availability' : 'Team sheet prep'}
              </div>
            )}
          </div>
          {spondEventId && spondConfigured() && (
            <button
              onClick={syncSpondAvailability}
              disabled={spondSyncing}
              className="tap-target w-8 h-8 flex items-center justify-center rounded-lg active:scale-95 transition disabled:opacity-50"
              style={{ background: spondAvailability ? 'rgba(74,222,128,0.35)' : 'rgba(255,255,255,0.15)' }}
              aria-label="Sync availability from Spond"
            >
              {spondSyncing
                ? <RefreshCw size={15} color="#4ade80" strokeWidth={2} className="animate-spin" />
                : <Zap size={15} color={spondAvailability ? '#4ade80' : 'rgba(255,255,255,0.6)'} strokeWidth={2} />}
            </button>
          )}
        </div>

        {/* Spond toast — only shown on error now */}
        {spondToast && (
          <div className="px-3 py-1.5 text-center text-xs font-semibold" style={{ background: '#1A3A2A', color: '#4ade80' }}>
            {spondToast}
          </div>
        )}

        {/* Fill bar */}
        <div className="px-3 py-1.5 flex gap-2" style={{ background: INK }}>
          <FillBadge label="A" stats={teamA} />
          {teamCount === 2 && <FillBadge label="B" stats={teamB} />}
        </div>
      </div>

      <div className="px-3 pt-3 space-y-3">
        {/* Unmatched Spond members warning */}
        {spondAvailability && spondAvailability.unmatched.length > 0 && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg text-xs" style={{ background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A' }}>
            <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" strokeWidth={2} />
            <span>
              <span className="font-semibold">{spondAvailability.unmatched.length} Spond {spondAvailability.unmatched.length === 1 ? 'member' : 'members'} not matched:</span>
              {' '}{spondAvailability.unmatched.join(', ')}
            </span>
          </div>
        )}

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
                ref={opponentRef}
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
          <div className="flex items-center justify-between pt-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">Teams today</span>
            <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #E4D0F5' }}>
              {([1, 2] as const).map(n => (
                <button
                  key={n}
                  onClick={() => setTeamCount(n)}
                  className="px-3 py-1 text-xs font-bold transition"
                  style={{
                    background: teamCount === n ? PURPLE : 'white',
                    color: teamCount === n ? 'white' : '#7B5FA8',
                  }}
                >
                  {n === 1 ? 'One' : 'Two'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Mode tabs */}
        <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #E4D0F5' }}>
          {(['board', 'paste'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className="flex-1 py-2.5 text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-1.5 transition"
              style={{
                background: mode === m ? PURPLE : 'white',
                color: mode === m ? 'white' : '#7B5FA8',
              }}
            >
              {m === 'board' ? <><LayoutGrid size={13} /> Board</> : <><ClipboardPaste size={13} /> Paste</>}
            </button>
          ))}
        </div>

        {/* ── Board mode */}
        {mode === 'board' && (
          <div>
            {players.length === 0 ? (
              <div className="py-8 text-center text-sm text-stone-400">
                No squad loaded — go to Squad screen to add players.
              </div>
            ) : (
              <>
                <div className="flex gap-2 mb-2">
                  <button
                    onClick={handleDraft}
                    className="tap-target flex-1 rounded-lg font-bold text-sm flex items-center justify-center gap-1.5 active:scale-95 transition"
                    style={{ background: PURPLE, color: 'white', minHeight: '44px' }}
                  >
                    <Zap size={14} strokeWidth={2.5} />
                    {draftedIds.size > 0 ? 'Re-draft' : 'Draft teams'}
                  </button>
                  <button
                    onClick={handleClear}
                    className="tap-target rounded-lg font-bold text-xs px-4 active:scale-95 transition"
                    style={clearArmed
                      ? { background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#B42318' }
                      : { background: 'white', border: '1px solid #E4D0F5', color: '#7B5FA8' }}
                  >
                    {clearArmed ? 'Clear board?' : 'Clear'}
                  </button>
                </div>
                {(balance.A || balance.B) && (
                  <div className="flex gap-2 mb-2">
                    <div className="flex-1 bg-white rounded-lg px-2.5 py-1.5" style={{ border: '1px solid #E4D0F5' }}>
                      <div className="text-[9px] font-extrabold tracking-widest text-stone-400">AVG STARTS</div>
                      <div className="text-xs font-bold mono">
                        A {balance.A?.starts ?? '—'} · B {balance.B?.starts ?? '—'}
                      </div>
                    </div>
                    {hasRatings && (
                      <div className="flex-1 bg-white rounded-lg px-2.5 py-1.5" style={{ border: '1px solid #E4D0F5' }}>
                        <div className="text-[9px] font-extrabold tracking-widest text-stone-400">AVG IMPACT</div>
                        <div className="text-xs font-bold mono">
                          A {balance.A?.impact ?? '—'} · B {balance.B?.impact ?? '—'}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <div className="text-[10px] text-stone-400 mb-2 px-1">
                  {draftedIds.size > 0
                    ? 'Draft is a proposal — every magnet still moves, and Re-draft keeps players you placed by hand.'
                    : 'Tap a player, then tap a slot to place them. Tap a placed player to pick them back up.'}
                </div>
                <TeamBoard
                  players={players}
                  playersPerSide={playersPerSide}
                  assignments={assignments}
                  groupOverrides={groupOverrides}
                  spondAvailability={spondAvailability}
                  starts={startsById.size > 0 ? startsById : null}
                  teamCount={teamCount}
                  onAssign={assign}
                  onOverride={setOverride}
                />
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

      {/* Save bar — the board above is the review */}
      <div
        className="fixed bottom-0 left-0 right-0 px-3 pt-3 z-30"
        style={{
          background: '#F8F4FF',
          borderTop: '1px solid #C8A0E8',
          paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))',
        }}
      >
        {publishResult && (
          <div
            className="mb-2 text-sm text-center px-2 py-1.5 rounded-lg"
            style={{
              background: publishResult.ok ? '#D1FAE5' : '#FEE2E2',
              color: publishResult.ok ? '#065F46' : '#991B1B',
            }}
          >
            {publishResult.msg}
          </div>
        )}
        {copyToast && (
          <div
            className="mb-2 text-sm text-center px-2 py-1.5 rounded-lg"
            style={{
              background: copyToast.startsWith('Copied') ? '#D1FAE5' : '#FEE2E2',
              color: copyToast.startsWith('Copied') ? '#065F46' : '#991B1B',
            }}
          >
            {copyToast}
          </div>
        )}
        {!canSave && !publishResult && !copyToast && cantSaveReason && (
          <button
            onClick={!opponent.trim() ? jumpToOpponent : undefined}
            className="w-full mb-2 text-sm text-center px-2 py-1.5 rounded-lg active:opacity-70 transition"
            style={{ background: '#FEF3C7', color: '#92400E', cursor: !opponent.trim() ? 'pointer' : 'default' }}
          >
            {cantSaveReason}
          </button>
        )}
        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            disabled={!canSave}
            aria-label="Copy team sheet for WhatsApp"
            className="tap-target rounded-lg px-4 flex items-center justify-center active:scale-95 transition disabled:opacity-40"
            style={{ background: 'white', border: '1px solid #C8A0E8', color: PURPLE, minHeight: '52px' }}
          >
            <Copy size={18} strokeWidth={2.5} />
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave || publishing}
            className="tap-target flex-1 rounded-lg font-bold text-base active:scale-95 transition disabled:opacity-40"
            style={{ background: PURPLE, color: 'white', minHeight: '52px' }}
          >
            Save
          </button>
          {canPublish && (
            <button
              onClick={handleSaveAndPublish}
              disabled={!canSave || publishing}
              className="tap-target flex-1 rounded-lg font-bold text-base active:scale-95 transition flex items-center justify-center gap-2 disabled:opacity-40"
              style={{ background: '#059669', color: 'white', minHeight: '52px' }}
            >
              {publishing
                ? <RefreshCw size={16} className="animate-spin" />
                : <CloudUpload size={16} strokeWidth={2} />
              }
              Save &amp; publish
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
