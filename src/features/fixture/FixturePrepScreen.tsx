import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Check, ClipboardPaste, CloudUpload, Copy, History, LayoutGrid, Lock, RefreshCw, Zap } from 'lucide-react'
import { getSpondAvailability, type SpondAvailability } from '@/lib/spond/spondSync'
import { spondConfigured } from '@/lib/spond/spondStore'
import { FORMATS, teamLimits, validateComposition } from '@/lib/domain/validateComposition'
import { draftTeams } from '@/lib/domain/draftTeams'
import { formatTeamsForWhatsApp } from '@/lib/domain/formatTeamSheet'
import { parseTeamSheet } from '@/lib/domain/parseTeamSheet'
import type { ParsedSlot } from '@/lib/domain/parseTeamSheet'
import type { Group, ID, Player, TeamSheet } from '@/lib/events/types'
import { useSquadStore } from '@/features/squad/useSquadStore'
import { useFixtureStore } from './useFixtureStore'
import type { Fixture } from '@/lib/events/types'
import { clubPinConfigured } from '@/lib/drive/driveRead'
import { markFixtureUnshared, shareFixture } from '@/lib/drive/pendingShare'
import { friendlyShareError } from '@/lib/friendly'
import { db } from '@/lib/db/db'
import { replayEvents } from '@/lib/events/replay'
import type { Match } from '@/lib/events/types'
import { TopAppBar, BarButton } from '@/ui/TopAppBar'
import { Button } from '@/ui/Button'
import { ButtonGroup } from '@/ui/ButtonGroup'
import { Card } from '@/ui/Card'
import { TextField } from '@/ui/TextField'
import SquadPicker, { GroupBadge, effectiveAssignment, type Assignment } from './SquadPicker'


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
  // Editable here: a fixture can be switched to 10-a-side on the day.
  const [playersPerSide, setPlayersPerSide] = useState(existing?.playersPerSide ?? initialPlayersPerSide ?? 12)
  // An existing fixture already says how many teams it was built for; a new one
  // falls back to whatever this coach chose last.
  const [teamCount, setTeamCountState] = useState<1 | 2>(() => {
    if (existing) return existing.teamSheets.length > 1 ? 2 : 1
    // Most match days field one team, so that's the default until a coach
    // chooses two.
    const stored = localStorage.getItem(TEAM_COUNT_KEY)
    return stored === '2' ? 2 : 1
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
      showSpondToast(navigator.onLine === false ? 'No signal — try again when you’re back online' : 'Couldn’t reach Spond — try again')
    } finally {
      setSpondSyncing(false)
    }
  }

  // ── played lock: once a team has match events its sheet is history —
  // editing it would rewrite the minutes and tries already recorded.
  const [played, setPlayed] = useState(false)
  const [unlocked, setUnlocked] = useState(false)
  useEffect(() => {
    if (!existing) return
    const ids = existing.teamSheets.map(ts => ts.id)
    db.matches.bulkGet(ids).then(ms => setPlayed(ms.some(m => (m?.events.length ?? 0) > 0)))
  }, [existing])
  const locked = played && !unlocked

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
    if (n === 2) {
      // Benched by Auto-pick rather than by hand: free them so they can be
      // split across the two teams.
      setAssignments(m => {
        const next = new Map(m)
        for (const id of draftedIds) if (next.get(id) === 'bench-A') next.set(id, null)
        return next
      })
    }
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

  // What the team sheet will actually contain: in one-team mode anyone not
  // picked counts as Bench, exactly as the picker shows them.
  const effective = useMemo(() => {
    const m = new Map<ID, Assignment>()
    for (const p of players) m.set(p.id, effectiveAssignment(assignments.get(p.id), teamCount))
    return m
  }, [players, assignments, teamCount])

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

  // Minutes per player across earlier matches this season. Starts now reward
  // performance, so minutes are what Auto-pick uses to make sure everyone plays.
  const [storedMatches, setStoredMatches] = useState<Match[]>([])
  useEffect(() => { db.matches.toArray().then(setStoredMatches) }, [])
  const minutesById = useMemo(() => {
    const m = new Map<ID, number>()
    if (!players.length) return m
    for (const match of storedMatches) {
      const f = fixtures.find(x => x.id === match.fixtureId)
      if (!f || f.id === existing?.id || f.date >= date) continue
      const ts = f.teamSheets.find(t => t.id === match.teamSheetId)
      if (!ts) continue
      const state = replayEvents(match.events, ts, players)
      for (const [id, ps] of state.playerStates) {
        if (ps.minutesPlayed > 0) m.set(id, (m.get(id) ?? 0) + ps.minutesPlayed / 60_000)
      }
    }
    return m
  }, [storedMatches, fixtures, players, existing?.id, date])

  // The most recent earlier fixture with team sheets — the "same again" source.
  const lastFixture = useMemo(
    () => [...fixtures]
      .filter(f => f.id !== existing?.id && f.date < date && f.teamSheets.length > 0)
      .sort((a, b) => b.date.localeCompare(a.date))[0],
    [fixtures, existing?.id, date],
  )

  const handleSameAsLast = () => {
    if (!lastFixture) return
    const next = new Map<ID, Assignment>()
    const overrides = new Map<ID, Group>()
    for (const p of players) {
      // Someone who is out today (e.g. said no in Spond) stays out
      next.set(p.id, assignments.get(p.id) === 'unavailable' ? 'unavailable' : null)
    }
    for (const ts of lastFixture.teamSheets) {
      const label = ts.label as 'A' | 'B'
      if (label === 'B' && teamCount === 1) continue
      const put = (id: ID, val: Assignment, g?: Group) => {
        if (!next.has(id) || next.get(id) === 'unavailable') return
        next.set(id, val)
        if (g) overrides.set(id, g)
      }
      ts.starters.forwards.forEach(id => put(id, label, 'forward'))
      ts.starters.backs.forEach(id => put(id, label, 'back'))
      if (ts.starters.scrumhalf) put(ts.starters.scrumhalf, label, 'scrumhalf')
      ts.bench.forEach(id => put(id, `bench-${label}`))
    }
    setAssignments(next)
    setGroupOverrides(overrides)
    setDraftedIds(new Set())
  }

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
      starts: minutesById.size > 0 ? minutesById : startsById,
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

  const teamA = useMemo(() => countTeam('A', effective, groupOverrides, players, playersPerSide), [effective, groupOverrides, players, playersPerSide])
  const teamB = useMemo(() => countTeam('B', effective, groupOverrides, players, playersPerSide), [effective, groupOverrides, players, playersPerSide])

  const hasRatings = players.some(p => p.ratings)
  const balance = useMemo(() => {
    const calc = (team: 'A' | 'B') => {
      const starters = players.filter(p => effective.get(p.id) === team)
      if (starters.length === 0) return null
      const avg = (f: (p: Player) => number) =>
        (starters.reduce((sum, p) => sum + f(p), 0) / starters.length).toFixed(1)
      return {
        starts: avg(p => startsById.get(p.id) ?? 0),
        impact: avg(p => p.ratings?.impact ?? 3),
      }
    }
    return { A: calc('A'), B: calc('B') }
  }, [players, effective, startsById])
  const hasAnyA = players.some(p => effective.get(p.id) === 'A' || effective.get(p.id) === 'bench-A')
  const hasAnyB = players.some(p => effective.get(p.id) === 'B' || effective.get(p.id) === 'bench-B')
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
    if (hasAnyA) teamSheets.push(buildSheet('A', effective, groupOverrides, players, sheetId('A')))
    if (hasAnyB) teamSheets.push(buildSheet('B', effective, groupOverrides, players, sheetId('B')))
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

  // One Save: it always lands on this phone, and with the coach PIN it is
  // shared with the other coaches straight away (or retried automatically).
  const handleSave = async () => {
    const fixture = buildFixture()
    await saveFixture(fixture)
    if (!canPublish) {
      setPublishResult({ ok: true, msg: 'Saved on this phone' })
      setTimeout(() => onSaved(), 900)
      return
    }
    markFixtureUnshared(fixture.id)
    setPublishing(true)
    setPublishResult(null)
    const result = await shareFixture(fixture.id)
    setPublishing(false)
    setPublishResult(result.ok
      ? { ok: true, msg: 'Saved and shared with the coaches' }
      : { ok: false, msg: friendlyShareError(result.error) })
    setTimeout(() => onSaved(), result.ok ? 900 : 2600)
  }

  const [copyToast, setCopyToast] = useState('')
  const handleCopy = async () => {
    const msg = formatTeamsForWhatsApp({
      teamName: squad?.name ?? 'Woodford',
      opponent: opponent.trim() || 'TBC',
      date,
      players,
      assignments: effective,
      groupOverrides,
    })
    try {
      await navigator.clipboard.writeText(msg)
      setCopyToast('Copied — now paste it into WhatsApp')
    } catch {
      setCopyToast('Couldn’t copy — try again')
    }
    setTimeout(() => setCopyToast(''), 3000)
  }


  const renderParsedSlot = (slot: ParsedSlot, isBench: boolean) => {
    if (slot.status === 'resolved') {
      return (
        <div key={slot.player.id} className="flex items-center gap-2 py-1.5">
          <Check size={14} className="text-x-good flex-shrink-0" strokeWidth={2.5} />
          <GroupBadge group={slot.assignedGroup} size="xs" />
          <span className="text-sm flex-1">{slot.player.name}</span>
          {isBench && <span className="text-xs text-m-outline">bench</span>}
        </div>
      )
    }
    if (slot.status === 'ambiguous') {
      const cur = resolutions.get(slot.token)
      return (
        <div key={slot.token} className="py-1.5">
          <div className="flex items-center gap-1.5 mb-1">
            <AlertTriangle size={14} className="text-x-warn flex-shrink-0" strokeWidth={2.5} />
            <span className="text-sm font-semibold">"{slot.token}" — {slot.candidates.length} matches</span>
          </div>
          <div className="pl-5 space-y-0.5">
            {slot.candidates.map(c => (
              <button
                key={c.id}
                onClick={() => setResolutions(m => new Map(m).set(slot.token, c))}
                className={`m-press flex items-center gap-2 w-full h-10 px-3 rounded-m-sm text-sm ${cur === c ? 'bg-x-good-container text-x-on-good-container' : 'bg-m-surface-container-high text-m-on-surface'}`}
              >
                <GroupBadge group={c.defaultGroup} size="xs" />
                {c.name}
              </button>
            ))}
            <button
              onClick={() => setResolutions(m => new Map(m).set(slot.token, 'skip'))}
              className="text-xs text-m-outline px-2 py-0.5"
            >Skip</button>
          </div>
        </div>
      )
    }
    // unknown
    return (
      <div key={slot.token} className="flex items-center gap-2 py-1.5">
        <AlertTriangle size={14} className="text-m-error flex-shrink-0" strokeWidth={2.5} />
        <span className="text-sm">"{slot.token}" — not found</span>
        {slot.fuzzyMatch && (
          <button
            onClick={() => setResolutions(m => new Map(m).set(slot.token, slot.fuzzyMatch!))}
            className="m-press ml-auto h-8 px-3 text-xs font-semibold rounded-full bg-m-secondary-container text-m-on-secondary-container"
          >
            Use {slot.fuzzyMatch.name}
          </button>
        )}
      </div>
    )
  }

  const limits = teamLimits(playersPerSide)

  // How full each team is, shown under the title while scrolling the list
  const fillChip = (label: string, stats: ReturnType<typeof countTeam>) => {
    const total = stats.f + stats.b + stats.sh
    const over = stats.f > limits.f || stats.b > limits.b || stats.sh > limits.sh
    const tone = over ? 'bg-m-error-container text-m-on-error-container'
      : stats.comp.valid ? 'bg-x-good-container text-x-on-good-container'
      : 'bg-brand-control text-brand-on'
    return (
      <span className={`h-8 px-3 rounded-full inline-flex items-center gap-1.5 text-sm font-semibold mono ${tone}`}>
        {teamCount === 2 ? `Team ${label} · ` : 'Starting '}{total}/{playersPerSide}{stats.comp.valid ? ' ✓' : ''}
        {stats.bench > 0 && <span className="font-normal opacity-80">+{stats.bench} bench</span>}
      </span>
    )
  }

  const availability = spondAvailability
    ? `${spondAvailability.accepted.length} coming · ${spondAvailability.declined.length} not · ${spondAvailability.unanswered.length} no reply`
    : undefined

  return (
    <div className="min-h-screen pb-48 bg-m-surface text-m-on-surface">
      <TopAppBar
        large={false}
        title={existing ? `vs ${existing.opponent}` : opponent.trim() ? `vs ${opponent.trim()}` : 'New fixture'}
        subtitle={availability ?? 'Pick the team'}
        onBack={onBack}
        actions={spondEventId && spondConfigured() ? (
          <BarButton
            icon={spondSyncing ? <RefreshCw size={16} className="animate-spin" /> : <Zap size={16} strokeWidth={2.5} />}
            label={spondAvailability ? 'Refresh' : 'Who’s coming'}
            onClick={syncSpondAvailability}
          />
        ) : undefined}
      >
        <div className="flex gap-2 flex-wrap">
          {fillChip('A', teamA)}
          {teamCount === 2 && fillChip('B', teamB)}
        </div>
        {spondToast && <div className="mt-2 text-sm font-medium text-brand-on-variant">{spondToast}</div>}
      </TopAppBar>

      <div className="px-4 pt-4 space-y-3">
        {spondAvailability && spondAvailability.unmatched.length > 0 && (
          <div className="flex items-start gap-2 p-4 rounded-m-lg text-sm bg-x-warn-container text-x-on-warn-container">
            <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" strokeWidth={2.25} />
            <span>
              <span className="font-semibold">{spondAvailability.unmatched.length} Spond {spondAvailability.unmatched.length === 1 ? 'member' : 'members'} not matched:</span>
              {' '}{spondAvailability.unmatched.join(', ')}
            </span>
          </div>
        )}

        {locked && (
          <div className="flex items-center gap-3 p-4 rounded-m-lg bg-m-secondary-container text-m-on-secondary-container">
            <Lock size={20} strokeWidth={2.25} className="flex-shrink-0" />
            <span className="flex-1 text-sm">This match has been played, so its team sheet is locked.</span>
            <Button variant="outlined" size="sm" onClick={() => setUnlocked(true)}>Edit anyway</Button>
          </div>
        )}

        <div className={locked ? 'pointer-events-none opacity-60 space-y-3' : 'space-y-3'} aria-disabled={locked}>
          <Card className="p-4 space-y-4">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))] gap-3">
              <TextField label="Date" type="date" value={date} onChange={e => setDate(e.target.value)} />
              <TextField ref={opponentRef} label="Opponent" value={opponent} onChange={e => setOpponent(e.target.value)} placeholder="e.g. Saints" />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-m-on-surface-variant">Format</span>
              <ButtonGroup
                size="sm"
                ariaLabel="Format"
                value={playersPerSide}
                onChange={setPlayersPerSide}
                options={[...FORMATS, ...(FORMATS.includes(playersPerSide as 12 | 10) ? [] : [playersPerSide])].map(n => ({ value: n, label: `${n}-a-side` }))}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-m-on-surface-variant">Teams today</span>
              <ButtonGroup
                size="sm"
                ariaLabel="Teams today"
                value={teamCount}
                onChange={setTeamCount}
                options={[{ value: 1, label: 'One' }, { value: 2, label: 'Two' }]}
              />
            </div>
          </Card>

          <ButtonGroup
            full
            ariaLabel="How to pick"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'board', label: <><LayoutGrid size={16} /> Pick</> },
              { value: 'paste', label: <><ClipboardPaste size={16} /> Paste a list</> },
            ]}
          />

          {mode === 'board' && (
            players.length === 0 ? (
              <div className="py-8 text-center text-base text-m-on-surface-variant">
                No squad yet — add players in the Team tab.
              </div>
            ) : (
              <>
                <div className="flex gap-2 flex-wrap">
                  <Button onClick={handleDraft} icon={<Zap size={18} strokeWidth={2.25} />} className="flex-1">
                    {draftedIds.size > 0 ? 'Auto-pick again' : 'Auto-pick'}
                  </Button>
                  {lastFixture && (
                    <Button variant="tonal" onClick={handleSameAsLast} icon={<History size={18} strokeWidth={2.25} />} aria-label={`Same line-up as vs ${lastFixture.opponent}`}>
                      Same as last
                    </Button>
                  )}
                  <Button variant={clearArmed ? 'danger' : 'outlined'} onClick={handleClear}>
                    {clearArmed ? 'Clear all?' : 'Clear'}
                  </Button>
                </div>
                {(balance.A || balance.B) && (
                  <div className="flex gap-2">
                    <div className="flex-1 rounded-m-md px-3 py-2 bg-m-surface-container-high">
                      <div className="text-xs font-medium text-m-on-surface-variant">Average starts</div>
                      <div className="text-base font-semibold mono">
                        {teamCount === 2 ? `A ${balance.A?.starts ?? '—'} · B ${balance.B?.starts ?? '—'}` : balance.A?.starts ?? '—'}
                      </div>
                    </div>
                    {hasRatings && (
                      <div className="flex-1 rounded-m-md px-3 py-2 bg-m-surface-container-high">
                        <div className="text-xs font-medium text-m-on-surface-variant">Average impact</div>
                        <div className="text-base font-semibold mono">
                          {teamCount === 2 ? `A ${balance.A?.impact ?? '—'} · B ${balance.B?.impact ?? '—'}` : balance.A?.impact ?? '—'}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <p className="text-sm text-m-on-surface-variant px-1">
                  {draftedIds.size > 0
                    ? 'Auto-pick fills open places with whoever has played least. Change anyone with one tap; Auto-pick again keeps the players you set by hand.'
                    : teamCount === 1
                      ? 'Everyone starts on Bench. Tap Start for your starters and Out for anyone missing.'
                      : 'Pick each team on its tab. Tap a selected option again to free the player for the other team.'}
                </p>
                <SquadPicker
                  players={players}
                  playersPerSide={playersPerSide}
                  assignments={assignments}
                  groupOverrides={groupOverrides}
                  spondAvailability={spondAvailability}
                  starts={startsById.size > 0 ? startsById : null}
                  minutes={minutesById.size > 0 ? minutesById : null}
                  teamCount={teamCount}
                  onAssign={assign}
                  onOverride={setOverride}
                />
              </>
            )
          )}

          {mode === 'paste' && (
            <div className="space-y-3">
              <textarea
                value={pasteText}
                onChange={e => { setPasteText(e.target.value); setParseResult(null) }}
                placeholder={"Team A: Alexander, Dylan, Elliott...\nBench: Dominic, Ethan\n\nTeam B: Archie, Arlo..."}
                rows={8}
                aria-label="Team list to paste"
                className="w-full px-4 py-3 rounded-m-xs border border-m-outline bg-transparent text-m-on-surface placeholder:text-m-outline outline-none focus:border-m-primary focus:ring-1 focus:ring-m-primary resize-none"
              />
              <Button full size="lg" onClick={handleParse} disabled={!pasteText.trim() || !players.length}>Read the list</Button>

              {parseResult && (
                <div className="space-y-3">
                  {parseResult.blocks.map((block, bi) => (
                    <Card key={bi} className="p-4">
                      <div className="text-base font-semibold mb-2 text-m-primary">{block.label}</div>
                      {block.starters.map(sl => renderParsedSlot(sl, false))}
                      {block.bench.map(sl => renderParsedSlot(sl, true))}
                    </Card>
                  ))}
                  <Button full size="lg" variant="go" onClick={applyParseResult}>Apply to team</Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Save bar — the list above is the review */}
      <div
        className="fixed bottom-0 app-x px-4 pt-3 z-30 bg-m-surface-container elev-1"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
      >
        {publishResult && (
          <div className={`pop-in mb-2 text-sm text-center px-3 py-2 rounded-m-md ${publishResult.ok ? 'bg-x-good-container text-x-on-good-container' : 'bg-m-error-container text-m-on-error-container'}`}>
            {publishResult.msg}
          </div>
        )}
        {copyToast && (
          <div className={`pop-in mb-2 text-sm text-center px-3 py-2 rounded-m-md ${copyToast.startsWith('Copied') ? 'bg-x-good-container text-x-on-good-container' : 'bg-m-error-container text-m-on-error-container'}`}>
            {copyToast}
          </div>
        )}
        {!canSave && !publishResult && !copyToast && cantSaveReason && (
          <button
            onClick={!opponent.trim() ? jumpToOpponent : undefined}
            className="w-full mb-2 text-sm text-center px-3 py-2 rounded-m-md bg-x-warn-container text-x-on-warn-container"
          >
            {cantSaveReason}
          </button>
        )}
        {!canPublish && canSave && !publishResult && !copyToast && (
          <div className="mb-2 text-xs text-center text-m-on-surface-variant">
            To share teams with the other coaches, add the coach PIN in Settings.
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant="tonal" size="lg" className="flex-grow" onClick={handleCopy} disabled={!canSave} icon={<Copy size={18} strokeWidth={2.25} />}>
            WhatsApp
          </Button>
          <Button
            size="lg"
            className="flex-[2_1_12rem]"
            onClick={handleSave}
            disabled={!canSave || publishing || locked}
            icon={publishing ? <RefreshCw size={18} className="animate-spin" /> : canPublish ? <CloudUpload size={18} strokeWidth={2.25} /> : undefined}
          >
            {publishing ? 'Sharing…' : canPublish ? 'Save & share' : 'Save on this phone'}
          </Button>
        </div>
      </div>
    </div>
  )
}
