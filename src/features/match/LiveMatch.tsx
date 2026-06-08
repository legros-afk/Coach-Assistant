import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity, AlertTriangle, ArrowRight, Check, ChevronLeft,
  Pause, Play, Plus, Trophy, Undo2, Users, X,
} from 'lucide-react'
import { WoodfordMark } from '@/components/WoodfordMark'
import type { Group, ID, Player, PlayerMatchState, TeamSheet } from '@/lib/events/types'
import { useMatchStore } from './useMatchStore'

// ── brand constants ────────────────────────────────────────────────────────────

const BLUE        = '#1565C0'
const BLUE_DARK   = '#0D47A1'
const BLUE_SOFT   = '#E3EEFF'
const BLUE_SOFTER = '#F0F5FF'
const INK         = '#1A1A1A'

// ── helpers ───────────────────────────────────────────────────────────────────

function fmt(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function balanceColor(playerMs: number, avgMs: number): string {
  const diff = Math.abs(playerMs - avgMs)
  if (diff < 2 * 60_000) return '#10B981'
  if (diff < 5 * 60_000) return '#F59E0B'
  return '#EF4444'
}

function liveMinMs(ps: PlayerMatchState, elapsedMs: number): number {
  return ps.status === 'on' && ps.currentStintStartedAtMs !== undefined
    ? ps.minutesPlayed + (elapsedMs - ps.currentStintStartedAtMs)
    : ps.minutesPlayed
}

interface SwapSuggestion { off: Player; on: Player; group: Group }

// 10% of a 40-minute game = 4 minutes tolerance per player
const TOTAL_GAME_MS  = 80 * 60_000
const TOLERANCE_MS   = TOTAL_GAME_MS * 0.1

function computeNudgePlan(
  squad: Player[],
  teamSheet: TeamSheet,
  playerStates: ReturnType<typeof useMatchStore.getState>['matchState']['playerStates'],
  elapsedMs: number,
): SwapSuggestion[] {
  if (elapsedMs < 60_000) return []

  const groupConfigs: { group: Group; starterCount: number }[] = [
    { group: 'forward',   starterCount: teamSheet.starters.forwards.length },
    { group: 'back',      starterCount: teamSheet.starters.backs.length    },
    { group: 'scrumhalf', starterCount: 1                                  },
  ]

  const swaps: SwapSuggestion[] = []
  const usedBenchIds = new Set<ID>()

  for (const { group, starterCount } of groupConfigs) {
    const onInGroup = squad.filter(p => {
      const ps = playerStates.get(p.id)
      return ps?.status === 'on' && ps.activeGroup === group
    })
    const benchInGroup = squad.filter(p => {
      const ps = playerStates.get(p.id)
      return ps?.status === 'bench' && p.defaultGroup === group && !usedBenchIds.has(p.id)
    })
    if (onInGroup.length === 0 || benchInGroup.length === 0) continue

    const totalInGroup  = onInGroup.length + benchInGroup.length
    const fairShareMs   = elapsedMs * starterCount / totalInGroup
    const getTime = (p: Player) => liveMinMs(playerStates.get(p.id)!, elapsedMs)

    // Most time on pitch first (candidates to come off)
    const sortedOn    = [...onInGroup   ].sort((a, b) => getTime(b) - getTime(a))
    // Least time first (candidates to come on)
    const sortedBench = [...benchInGroup].sort((a, b) => getTime(a) - getTime(b))

    let benchIdx = 0
    for (const offPlayer of sortedOn) {
      if (benchIdx >= sortedBench.length) break
      if (getTime(offPlayer) <= fairShareMs + TOLERANCE_MS) break  // sorted desc, rest are fine too
      const onPlayer = sortedBench[benchIdx]
      if (getTime(onPlayer) >= fairShareMs - TOLERANCE_MS) break   // sorted asc, rest are fine too
      swaps.push({ off: offPlayer, on: onPlayer, group })
      usedBenchIds.add(onPlayer.id)
      benchIdx++
    }
  }

  return swaps
}

// ── sub-components ─────────────────────────────────────────────────────────────

const GROUP_LABEL: Record<Group, string> = { forward: 'F', back: 'B', scrumhalf: 'SH' }

function GroupBadge({ group, size = 'md' }: { group: Group; size?: 'md' | 'sm' }) {
  const bg = group === 'forward' ? INK : group === 'back' ? BLUE : BLUE_DARK
  const cls = size === 'sm'
    ? 'text-[10px] w-5 h-5'
    : 'text-xs w-7 h-7'
  return (
    <span
      className={`font-bold rounded-full flex items-center justify-center flex-shrink-0 ${cls}`}
      style={{ background: bg, color: 'white' }}
    >
      {GROUP_LABEL[group]}
    </span>
  )
}

function Section({
  title, count, subtitle, hint, children,
}: { title: string; count: number; subtitle: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2 px-1">
        <div className="flex items-baseline gap-2">
          <h2 className="text-xl font-bold" style={{ color: INK }}>{title}</h2>
          <span className="mono text-sm opacity-50">({count})</span>
        </div>
        <span
          className="text-[10px] uppercase tracking-widest font-semibold"
          style={{ color: hint ? BLUE : '#5580C0' }}
        >
          {hint ?? subtitle}
        </span>
      </div>
      {children}
    </div>
  )
}

function MiniAction({
  onClick, color, label,
}: { onClick: () => void; color: string; label: string }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick() }}
      className="flex-1 py-1 rounded text-[10px] font-bold uppercase tracking-wide flex items-center justify-center active:scale-95 transition"
      style={{ background: color, color: 'white' }}
    >
      {label}
    </button>
  )
}

interface PlayerCardProps {
  player: Player
  ps: PlayerMatchState
  avgMs: number
  liveElapsedMs: number
  picked?: boolean
  pickedTone?: 'rose' | 'emerald'
  onTap?: () => void
  showActions?: boolean
  muted?: boolean
  onBlood?: () => void
  onInjury?: () => void
  onReturn?: () => void
}

function PlayerCard({
  player, ps, avgMs, liveElapsedMs,
  picked, pickedTone, onTap, showActions, muted, onBlood, onInjury, onReturn,
}: PlayerCardProps) {
  const mins = liveMinMs(ps, liveElapsedMs)
  const pickedBg     = pickedTone === 'rose' ? '#FEE2E2' : '#D1FAE5'
  const pickedBorder = pickedTone === 'rose' ? '#F87171' : '#34D399'

  return (
    <div
      onClick={onTap}
      className={`p-2.5 rounded-lg transition relative ${onTap ? 'active:scale-[0.98] cursor-pointer' : ''}`}
      style={{
        background: picked ? pickedBg : muted ? '#F5F5F4' : 'white',
        border: picked ? `2px solid ${pickedBorder}` : '1px solid #E4D0F5',
        opacity: muted ? 0.7 : 1,
        minHeight: '88px',
      }}
    >
      <div className="flex items-start gap-2 mb-1.5">
        <GroupBadge group={ps.activeGroup} />
        <div className="flex-1 min-w-0">
          <div className="font-bold truncate text-[15px] leading-tight" style={{ color: INK }}>
            {player.name}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: balanceColor(mins, avgMs) }}
            />
            <span className="mono text-xs tabular-nums opacity-70">{fmt(mins)}</span>
            {ps.triesScored > 0 && (
              <span className="mono text-xs font-bold" style={{ color: BLUE }}>
                {ps.triesScored}T
              </span>
            )}
          </div>
        </div>
      </div>

      {showActions && (
        <div className="flex gap-1 mt-1.5">
          <MiniAction onClick={onBlood!} color="#DC2626" label="Tmp" />
          <MiniAction onClick={onInjury!} color={INK} label="Inj" />
        </div>
      )}
      {onReturn && (
        <button
          onClick={e => { e.stopPropagation(); onReturn() }}
          className="w-full mt-1.5 py-1.5 rounded text-[11px] font-bold uppercase tracking-wide flex items-center justify-center gap-1 active:scale-95"
          style={{ background: '#10B981', color: 'white' }}
        >
          <Activity size={12} strokeWidth={2.5} /> Return
        </button>
      )}
    </div>
  )
}

function ScoreButton({
  label, value, primary, onClick,
}: { label: string; value: number; primary?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="tap-target flex-1 rounded-lg flex items-center justify-center gap-1.5 font-bold active:scale-95 transition"
      style={{
        background: primary ? 'white' : 'rgba(255,255,255,0.1)',
        color:      primary ? INK    : 'white',
        border:     primary ? 'none' : '1px solid rgba(255,255,255,0.2)',
      }}
    >
      <Plus size={14} strokeWidth={3} />
      <span className="text-sm uppercase tracking-wide">{label}</span>
      <span className="mono text-xl tabular-nums">{value}</span>
    </button>
  )
}

// ── main screen ────────────────────────────────────────────────────────────────

interface LiveMatchProps { onBack?: () => void; onOpenSquad?: () => void; onSummary?: () => void }

export default function LiveMatch({ onBack, onOpenSquad, onSummary }: LiveMatchProps) {
  const store = useMatchStore()
  const { matchState, squad, clockRunning, opponent, teamSheet } = store

  // ── live clock ticker
  const [liveElapsedMs, setLiveElapsedMs] = useState(() => store.currentElapsedMs())
  useEffect(() => {
    setLiveElapsedMs(store.currentElapsedMs())
    if (!clockRunning) return
    const id = setInterval(() => setLiveElapsedMs(store.currentElapsedMs()), 250)
    return () => clearInterval(id)
  }, [clockRunning, store.clockStartedAt])

  // ── coach nudge (re-evaluate every 60s of clock time)
  const [nudgeSwaps, setNudgeSwaps] = useState<SwapSuggestion[]>([])
  const [nudgeDismissed, setNudgeDismissed] = useState(false)
  const lastNudgeEvalMs = useRef(-60_001)
  useEffect(() => {
    if (!clockRunning) return
    const id = setInterval(() => {
      const elapsed = store.currentElapsedMs()
      if (elapsed - lastNudgeEvalMs.current >= 60_000) {
        lastNudgeEvalMs.current = elapsed
        const swaps = computeNudgePlan(squad, teamSheet, matchState.playerStates, elapsed)
        setNudgeSwaps(swaps)
        if (swaps.length > 0) setNudgeDismissed(false)
      }
    }, 1000)
    return () => clearInterval(id)
  }, [clockRunning, matchState])

  // ── sub selection
  const [comingOffIds, setComingOffIds] = useState<ID[]>([])
  const [comingOnIds,  setComingOnIds]  = useState<ID[]>([])
  const subMode = comingOffIds.length > 0 || comingOnIds.length > 0

  const clearSubs = () => { setComingOffIds([]); setComingOnIds([]) }

  // ── try picker + post-try conversion prompt
  const [tryPickerOpen, setTryPickerOpen] = useState(false)
  const [conversionPromptOpen, setConversionPromptOpen] = useState(false)

  // ── penalty / drop goal pickers
  const [penPickerOpen, setPenPickerOpen] = useState(false)
  const [dgPickerOpen, setDgPickerOpen] = useState(false)

  // ── blood replacement picker
  const [bloodPickerFor, setBloodPickerFor] = useState<Player | null>(null)

  // ── injury replacement picker
  const [injuryPickerFor, setInjuryPickerFor] = useState<Player | null>(null)

  // ── undo confirmation
  const [pendingUndo, setPendingUndo] = useState(false)

  // ── toast
  const [toast, setToast] = useState<string | null>(null)
  const showToast = (msg: string) => {
    setToast(msg); setTimeout(() => setToast(null), 2400)
  }

  // ── derived player data
  const playerMap = useMemo(() => new Map(squad.map(p => [p.id, p])), [squad])
  const getPlayer = (id: ID) => playerMap.get(id)

  const onPitch = useMemo(() =>
    squad
      .filter(p => matchState.playerStates.get(p.id)?.status === 'on')
      .sort((a, b) =>
        liveMinMs(matchState.playerStates.get(b.id)!, liveElapsedMs) -
        liveMinMs(matchState.playerStates.get(a.id)!, liveElapsedMs),
      ),
    [squad, matchState, liveElapsedMs],
  )

  const bench = useMemo(() =>
    squad
      .filter(p => matchState.playerStates.get(p.id)?.status === 'bench')
      .sort((a, b) =>
        liveMinMs(matchState.playerStates.get(a.id)!, liveElapsedMs) -
        liveMinMs(matchState.playerStates.get(b.id)!, liveElapsedMs),
      ),
    [squad, matchState, liveElapsedMs],
  )

  const offPitch = useMemo(() =>
    squad.filter(p => {
      const s = matchState.playerStates.get(p.id)?.status
      return s === 'blood' || s === 'injured'
    }),
    [squad, matchState],
  )

  const avgMs = useMemo(() => {
    const active = squad.filter(p => matchState.playerStates.get(p.id)?.status !== 'injured')
    if (!active.length) return 0
    return active.reduce((s, p) => {
      const ps = matchState.playerStates.get(p.id)
      return s + (ps ? liveMinMs(ps, liveElapsedMs) : 0)
    }, 0) / active.length
  }, [squad, matchState, liveElapsedMs])

  // ── short-pitch detection (fewer on pitch than the original starter count)
  const starterCount = teamSheet.starters.forwards.length + teamSheet.starters.backs.length + 1
  const isShortPitch = !subMode && onPitch.length < starterCount

  // ── sub pairings + composition
  const pairings = useMemo(() => {
    type Entry = { player: Player; ps: PlayerMatchState }
    const offQueue: Entry[] = comingOffIds.map(id => ({
      player: getPlayer(id)!, ps: matchState.playerStates.get(id)!,
    }))
    const onQueue: Entry[] = comingOnIds.map(id => ({
      player: getPlayer(id)!, ps: matchState.playerStates.get(id)!,
    }))

    const result: Array<{
      off: Entry | null; on: Entry | null; match: boolean; onGroup: Group
    }> = []
    const remainingOn = [...onQueue]

    for (const off of offQueue) {
      const idx = remainingOn.findIndex(
        on => on.player.eligibleGroups.includes(off.ps.activeGroup),
      )
      if (idx >= 0) {
        result.push({ off, on: remainingOn[idx], match: true, onGroup: off.ps.activeGroup })
        remainingOn.splice(idx, 1)
      } else {
        result.push({ off, on: null, match: false, onGroup: off.ps.activeGroup })
      }
    }
    for (const on of remainingOn) {
      result.push({ off: null, on, match: false, onGroup: on.player.defaultGroup })
    }
    return result
  }, [comingOffIds, comingOnIds, matchState, playerMap])


  // ── handlers
  const togglePickOff = (p: Player) => {
    if (comingOffIds.includes(p.id)) {
      setComingOffIds(comingOffIds.filter(id => id !== p.id))
    } else if (comingOffIds.length < 3) {
      setComingOffIds([...comingOffIds, p.id])
    } else {
      showToast('Max 3 subs at once')
    }
  }

  const togglePickOn = (p: Player) => {
    if (comingOnIds.includes(p.id)) {
      setComingOnIds(comingOnIds.filter(id => id !== p.id))
      return
    }
    if (comingOffIds.length === 0) {
      // Pitch is short — send directly on with no one coming off
      if (onPitch.length < starterCount) {
        store.commitSubBatch([], [p.id])
        showToast(`${p.name} — on`)
      }
      return
    }
    if (comingOnIds.length >= comingOffIds.length) {
      showToast('Tap a player to come off first')
      return
    }
    const newOnIds = [...comingOnIds, p.id]
    if (newOnIds.length === comingOffIds.length) {
      // Auto-confirm — check for position mismatch first
      const mismatch = comingOffIds.some(offId => {
        const offActive = matchState.playerStates.get(offId)?.activeGroup
        if (!offActive) return false
        return !newOnIds.some(onId => playerMap.get(onId)?.eligibleGroups.includes(offActive))
      })
      store.commitSubBatch(comingOffIds, newOnIds)
      clearSubs()
      showToast(mismatch ? '⚠ Position mismatch — sub done' : 'Sub confirmed')
    } else {
      setComingOnIds(newOnIds)
    }
  }

  const handleUndoPress = () => {
    const last = store.events[store.events.length - 1]
    if (!last) return
    const needsConfirm = last.type === 'TRY_US' || last.type === 'TRY_THEM' || last.type === 'SUB_BATCH'
    if (needsConfirm) {
      setPendingUndo(true)
    } else {
      store.undoLast()
      showToast('Undone')
    }
  }

  const confirmUndo = () => {
    store.undoLast()
    setPendingUndo(false)
    showToast('Undone')
  }

  const applyNudge = () => {
    if (nudgeSwaps.length === 0) return
    store.commitSubBatch(nudgeSwaps.map(s => s.off.id), nudgeSwaps.map(s => s.on.id))
    const label = nudgeSwaps.length === 1
      ? `${nudgeSwaps[0].off.name} → ${nudgeSwaps[0].on.name}`
      : `${nudgeSwaps.length} subs confirmed`
    showToast(label)
    setNudgeDismissed(true)
  }

  // half-end state
  const halfEnded = store.events.some(e => e.type === 'HALF_END')
  const matchEnded = store.events.some(e => e.type === 'MATCH_END')
  const gameStarted = store.events.some(e => e.type === 'CLOCK_START')

  // ── render
  return (
    <div className="min-h-screen pb-44" style={{ background: '#F0F5FF', color: INK }}>

      {/* ── Brand strip */}
      <div className="sticky top-0 z-20" style={{ background: BLUE }}>
        <div
          className="px-3 py-2 flex items-center justify-between"
          style={{ borderBottom: `1px solid ${BLUE_DARK}` }}
        >
          <div className="flex items-center gap-2">
            {onBack && (
              <button
                onClick={onBack}
                className="tap-target w-8 h-8 flex items-center justify-center rounded-lg active:scale-95 transition -ml-1"
                style={{ background: 'rgba(255,255,255,0.15)' }}
                aria-label="Home"
              >
                <ChevronLeft size={18} color="white" strokeWidth={2.5} />
              </button>
            )}
            <WoodfordMark size={22} color="white" />
            <div className="leading-tight">
              <div className="text-[13px] font-bold tracking-wide uppercase text-white">
                Sheffield Oaks
              </div>
              <div className="text-[10px] text-white/80 tracking-wider">
                vs {opponent || '—'} · Team {teamSheet.label}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-widest text-white/70 italic">
              Sheffield Oaks RUFC
            </span>
            {onOpenSquad && (
              <button
                onClick={onOpenSquad}
                className="tap-target w-8 h-8 flex items-center justify-center rounded-lg active:scale-95 transition"
                style={{ background: 'rgba(255,255,255,0.15)' }}
                aria-label="Squad"
              >
                <Users size={15} color="white" strokeWidth={2} />
              </button>
            )}
          </div>
        </div>

        {/* Clock + score bar */}
        <div style={{ background: INK }} className="px-3 py-2.5">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-widest text-white/60">
                H{matchState.half}
              </span>
              <span className="mono text-3xl font-bold tabular-nums tracking-tight text-white">
                {fmt(liveElapsedMs)}
              </span>
            </div>

            {matchEnded ? (
              <span className="text-xs font-bold uppercase tracking-widest text-white/50">
                Full time
              </span>
            ) : (
              <button
                onClick={() => clockRunning ? store.pauseClock() : store.startClock()}
                className="tap-target w-14 rounded-lg flex items-center justify-center transition active:scale-95"
                style={{ background: clockRunning ? '#F59E0B' : '#10B981', color: INK }}
                aria-label={clockRunning ? 'Pause' : 'Start'}
              >
                {clockRunning
                  ? <Pause size={22} strokeWidth={2.5} />
                  : <Play  size={22} strokeWidth={2.5} />
                }
              </button>
            )}

            <div className="flex-1 flex items-center gap-1.5 ml-1">
              <ScoreButton
                label="Us" value={matchState.scoreUs} primary
                onClick={() => setTryPickerOpen(true)}
              />
              <span className="text-white/50">—</span>
              <ScoreButton
                label="Them" value={matchState.scoreThem}
                onClick={() => { store.recordTryThem(); showToast(`Try — ${opponent}`); setConversionPromptOpen(true) }}
              />
            </div>
          </div>

          {/* Penalty / Drop Goal row */}
          <div className="flex gap-1.5 mt-2">
            <button
              onClick={() => setPenPickerOpen(true)}
              className="flex-1 py-1 rounded text-[10px] font-bold uppercase tracking-wide active:scale-95 transition"
              style={{ background: 'rgba(255,255,255,0.12)', color: 'white' }}
            >
              +3 Pen Us
            </button>
            <button
              onClick={() => { store.recordPenaltyThem(); showToast(`Penalty — ${opponent}`) }}
              className="flex-1 py-1 rounded text-[10px] font-bold uppercase tracking-wide active:scale-95 transition"
              style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.7)' }}
            >
              +3 Pen Them
            </button>
            <button
              onClick={() => setDgPickerOpen(true)}
              className="flex-1 py-1 rounded text-[10px] font-bold uppercase tracking-wide active:scale-95 transition"
              style={{ background: 'rgba(255,255,255,0.12)', color: 'white' }}
            >
              +3 DG Us
            </button>
            <button
              onClick={() => { store.recordDropGoalThem(); showToast(`Drop goal — ${opponent}`) }}
              className="flex-1 py-1 rounded text-[10px] font-bold uppercase tracking-wide active:scale-95 transition"
              style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.7)' }}
            >
              +3 DG Them
            </button>
          </div>

          {/* Half-end row — visible only when clock is paused and game has started */}
          {!clockRunning && gameStarted && !matchEnded && (
            <div className="flex gap-2 mt-2">
              {!halfEnded ? (
                <button
                  onClick={() => { store.endHalf(); showToast('Half time') }}
                  className="text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded opacity-60 hover:opacity-90 transition"
                  style={{ background: 'rgba(255,255,255,0.1)', color: 'white' }}
                >
                  End H1
                </button>
              ) : (
                <button
                  onClick={() => { store.endMatch(); showToast('Full time') }}
                  className="text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded opacity-60 hover:opacity-90 transition"
                  style={{ background: 'rgba(255,255,255,0.1)', color: 'white' }}
                >
                  End match
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Coach nudge */}
      {nudgeSwaps.length > 0 && !nudgeDismissed && !subMode && (
        <div
          className="mx-3 mt-3 rounded-lg p-3 flex items-start gap-3"
          style={{ background: BLUE_SOFTER, border: `1px solid ${BLUE_SOFT}` }}
        >
          <AlertTriangle size={18} style={{ color: BLUE }} className="flex-shrink-0 mt-0.5" strokeWidth={2.5} />
          <div className="flex-1 text-sm min-w-0">
            <div className="font-bold mb-1" style={{ color: BLUE_DARK }}>Subs to equalise time</div>
            <div className="space-y-1">
              {nudgeSwaps.map((swap, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[13px]" style={{ color: BLUE }}>
                  <GroupBadge group={swap.group} size="sm" />
                  <span className="font-semibold truncate">{swap.off.name}</span>
                  <ArrowRight size={10} className="flex-shrink-0 opacity-50" />
                  <span className="font-semibold truncate">{swap.on.name}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1 flex-shrink-0">
            <button
              onClick={applyNudge}
              className="text-xs font-bold px-2.5 py-1 rounded whitespace-nowrap"
              style={{ background: BLUE, color: 'white' }}
            >
              {nudgeSwaps.length > 1 ? 'Apply all' : 'Apply'}
            </button>
            <button
              onClick={() => setNudgeDismissed(true)}
              className="text-xs px-2 py-1 text-center"
              style={{ color: BLUE }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* ── Player sections */}
      <div className="px-3 pt-3 space-y-4">
        <Section
          title="On pitch" count={onPitch.length} subtitle="most played first"
          hint={subMode ? 'tap to take off' : undefined}
        >
          <div className="grid grid-cols-2 gap-2">
            {onPitch.map(p => (
              <PlayerCard
                key={p.id}
                player={p}
                ps={matchState.playerStates.get(p.id)!}
                avgMs={avgMs}
                liveElapsedMs={liveElapsedMs}
                picked={comingOffIds.includes(p.id)}
                pickedTone="rose"
                onTap={() => togglePickOff(p)}
                showActions={!subMode}
                onBlood={() => setBloodPickerFor(p)}
                onInjury={() => setInjuryPickerFor(p)}
              />
            ))}
          </div>
        </Section>

        <Section
          title="Bench" count={bench.length} subtitle="least played first"
          hint={
            comingOffIds.length > comingOnIds.length
              ? 'tap replacement'
              : isShortPitch
                ? 'tap to send on'
                : undefined
          }
        >
          <div className="grid grid-cols-2 gap-2">
            {bench.map(p => (
              <PlayerCard
                key={p.id}
                player={p}
                ps={matchState.playerStates.get(p.id)!}
                avgMs={avgMs}
                liveElapsedMs={liveElapsedMs}
                picked={comingOnIds.includes(p.id)}
                pickedTone="emerald"
                onTap={
                  comingOffIds.length > comingOnIds.length || isShortPitch
                    ? () => togglePickOn(p)
                    : undefined
                }
                showActions={false}
              />
            ))}
          </div>
        </Section>

        {offPitch.length > 0 && (
          <Section title="Off" count={offPitch.length} subtitle="blood / injured">
            <div className="grid grid-cols-2 gap-2">
              {offPitch.map(p => (
                <PlayerCard
                  key={p.id}
                  player={p}
                  ps={matchState.playerStates.get(p.id)!}
                  avgMs={avgMs}
                  liveElapsedMs={liveElapsedMs}
                  muted
                  showActions={false}
                  onReturn={() => {
                    const status = matchState.playerStates.get(p.id)?.status
                    status === 'blood'
                      ? store.bloodReturn(p.id)
                      : store.injuredReturn(p.id)
                    showToast(`${p.name} — returned to bench`)
                  }}
                />
              ))}
            </div>
          </Section>
        )}
      </div>

      {/* ── Sub status tray */}
      {subMode && (
        <div
          className="fixed bottom-[76px] left-0 right-0 px-3 py-2.5 shadow-2xl z-30"
          style={{ background: INK, color: 'white', borderTop: `2px solid ${BLUE}` }}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] uppercase tracking-widest font-semibold opacity-60">
              {comingOffIds.length > comingOnIds.length ? 'Now tap a replacement' : 'Sub in progress'}
            </span>
            <button onClick={clearSubs} className="opacity-60 active:opacity-100">
              <X size={16} />
            </button>
          </div>
          <div className="space-y-1">
            {pairings.map((pr, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <div className="flex-1 flex items-center gap-1.5 min-w-0">
                  {pr.off
                    ? <><GroupBadge group={pr.off.ps.activeGroup} size="sm" /><span className="font-semibold truncate" style={{ color: '#FCA5A5' }}>{pr.off.player.name}</span></>
                    : <span className="opacity-40 italic text-xs">—</span>}
                </div>
                <ArrowRight size={13} className="opacity-40 flex-shrink-0" />
                <div className="flex-1 flex items-center gap-1.5 min-w-0">
                  {pr.on
                    ? <><GroupBadge group={pr.onGroup} size="sm" /><span className="font-semibold truncate" style={{ color: '#86EFAC' }}>{pr.on.player.name}</span></>
                    : <span className="opacity-40 italic text-xs">tap bench →</span>}
                </div>
                <div className="w-4 flex-shrink-0">
                  {pr.off && pr.on && (
                    pr.match
                      ? <Check size={14} style={{ color: '#10B981' }} strokeWidth={3} />
                      : <AlertTriangle size={14} style={{ color: '#EF4444' }} strokeWidth={2.5} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Undo confirmation bar */}
      {pendingUndo && (
        <div
          className="fixed bottom-[76px] left-0 right-0 px-3 py-3 flex items-center justify-between z-40"
          style={{ background: '#DC2626', color: 'white' }}
        >
          <span className="text-sm font-semibold">Undo last action?</span>
          <div className="flex gap-2">
            <button
              onClick={confirmUndo}
              className="text-sm font-bold px-4 py-1.5 rounded bg-white"
              style={{ color: '#DC2626' }}
            >
              Undo
            </button>
            <button
              onClick={() => setPendingUndo(false)}
              className="text-sm px-3 py-1.5 opacity-80"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Bottom bar */}
      <div
        className="fixed bottom-0 left-0 right-0 px-3 py-3 flex items-center gap-2 z-30"
        style={{ background: '#F0F5FF', borderTop: '1px solid #C8A0E8' }}
      >
        {matchEnded ? (
          <button
            onClick={onSummary}
            className="tap-target flex-1 rounded-lg font-bold text-base active:scale-95 transition flex items-center justify-center gap-2"
            style={{ background: BLUE, color: 'white' }}
          >
            <Trophy size={18} strokeWidth={2} />
            Match summary
          </button>
        ) : (
          <>
            <button
              onClick={handleUndoPress}
              disabled={!store.events.length}
              className="tap-target px-4 rounded-lg border-2 font-semibold flex items-center gap-2 disabled:opacity-40 active:scale-95 transition"
              style={{ borderColor: '#C8A0E8', color: INK }}
            >
              <Undo2 size={18} strokeWidth={2.5} />
              Undo
            </button>
            <div className="flex-1 text-center text-xs text-stone-400 italic">
              {subMode ? 'tap bench to sub' : 'tap a player to sub'}
            </div>
          </>
        )}
      </div>

      {/* ── Try scorer picker */}
      {tryPickerOpen && (
        <div
          className="fixed inset-0 z-40 flex items-end"
          style={{ background: 'rgba(32,24,32,0.7)' }}
          onClick={() => setTryPickerOpen(false)}
        >
          <div
            className="bg-white w-full rounded-t-2xl p-4 max-h-[70vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Trophy size={22} style={{ color: BLUE }} />
                <div className="text-2xl font-bold" style={{ color: INK }}>Who scored?</div>
              </div>
              <button
                onClick={() => setTryPickerOpen(false)}
                className="tap-target w-12 flex items-center justify-center"
              >
                <X />
              </button>
            </div>
            <div className="space-y-1.5">
              {onPitch.map(p => (
                <button
                  key={p.id}
                  onClick={() => {
                    store.recordTryUs(p.id)
                    showToast(`Try — ${p.name}`)
                    setTryPickerOpen(false)
                    setConversionPromptOpen(true)
                  }}
                  className="tap-target w-full flex items-center gap-3 px-3 bg-white rounded-lg border active:scale-[0.98] transition"
                  style={{ borderColor: '#C5D8F5' }}
                >
                  <GroupBadge group={matchState.playerStates.get(p.id)!.activeGroup} />
                  <span className="font-semibold flex-1 text-left">{p.name}</span>
                  {(matchState.playerStates.get(p.id)?.triesScored ?? 0) > 0 && (
                    <span className="mono text-xs opacity-60">
                      {matchState.playerStates.get(p.id)!.triesScored}T
                    </span>
                  )}
                </button>
              ))}
              <button
                onClick={() => {
                  store.recordTryUs()
                  showToast('Try (unattributed)')
                  setTryPickerOpen(false)
                  setConversionPromptOpen(true)
                }}
                className="tap-target w-full px-3 italic active:scale-[0.98] transition opacity-70"
              >
                Unattributed / decide later
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Blood replacement picker */}
      {bloodPickerFor && (
        <div
          className="fixed inset-0 z-40 flex items-end"
          style={{ background: 'rgba(32,24,32,0.7)' }}
          onClick={() => setBloodPickerFor(null)}
        >
          <div
            className="bg-white w-full rounded-t-2xl p-4 max-h-[70vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <div className="text-2xl font-bold" style={{ color: INK }}>
                  Tmp — {bloodPickerFor.name}
                </div>
              </div>
              <button
                onClick={() => setBloodPickerFor(null)}
                className="tap-target w-12 flex items-center justify-center"
              >
                <X />
              </button>
            </div>
            <p className="text-sm text-stone-400 mb-3">Who comes on as replacement?</p>
            <div className="space-y-1.5">
              {bench.map(p => (
                <button
                  key={p.id}
                  onClick={() => {
                    store.bloodOff(bloodPickerFor.id, p.id)
                    showToast(`${bloodPickerFor.name} — blood · ${p.name} on`)
                    setBloodPickerFor(null)
                  }}
                  className="tap-target w-full flex items-center gap-3 px-3 bg-white rounded-lg border active:scale-[0.98] transition"
                  style={{ borderColor: '#C5D8F5' }}
                >
                  <GroupBadge group={matchState.playerStates.get(p.id)!.activeGroup} />
                  <span className="font-semibold flex-1 text-left">{p.name}</span>
                  <span className="mono text-xs opacity-50">
                    {fmt(liveMinMs(matchState.playerStates.get(p.id)!, liveElapsedMs))}
                  </span>
                </button>
              ))}
              {bench.length === 0 && (
                <p className="text-sm italic text-stone-400 px-3 py-2">No bench players available</p>
              )}
              <button
                onClick={() => {
                  store.bloodOff(bloodPickerFor.id)
                  showToast(`${bloodPickerFor.name} — blood (no replacement)`)
                  setBloodPickerFor(null)
                }}
                className="tap-target w-full px-3 italic active:scale-[0.98] transition opacity-60 text-sm"
              >
                Continue without replacement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Injury replacement picker */}
      {injuryPickerFor && (
        <div
          className="fixed inset-0 z-40 flex items-end"
          style={{ background: 'rgba(32,24,32,0.7)' }}
          onClick={() => setInjuryPickerFor(null)}
        >
          <div
            className="bg-white w-full rounded-t-2xl p-4 max-h-[70vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <AlertTriangle size={22} style={{ color: INK }} />
                <div className="text-2xl font-bold" style={{ color: INK }}>
                  Injured — {injuryPickerFor.name}
                </div>
              </div>
              <button
                onClick={() => setInjuryPickerFor(null)}
                className="tap-target w-12 flex items-center justify-center"
              >
                <X />
              </button>
            </div>
            <p className="text-sm text-stone-400 mb-3">Who comes on as replacement?</p>
            <div className="space-y-1.5">
              {bench.map(p => (
                <button
                  key={p.id}
                  onClick={() => {
                    store.injuredOff(injuryPickerFor.id, p.id)
                    showToast(`${injuryPickerFor.name} — injured · ${p.name} on`)
                    setInjuryPickerFor(null)
                  }}
                  className="tap-target w-full flex items-center gap-3 px-3 bg-white rounded-lg border active:scale-[0.98] transition"
                  style={{ borderColor: '#C5D8F5' }}
                >
                  <GroupBadge group={matchState.playerStates.get(p.id)!.activeGroup} />
                  <span className="font-semibold flex-1 text-left">{p.name}</span>
                  <span className="mono text-xs opacity-50">
                    {fmt(liveMinMs(matchState.playerStates.get(p.id)!, liveElapsedMs))}
                  </span>
                </button>
              ))}
              {bench.length === 0 && (
                <p className="text-sm italic text-stone-400 px-3 py-2">No bench players available</p>
              )}
              <button
                onClick={() => {
                  store.injuredOff(injuryPickerFor.id)
                  showToast(`${injuryPickerFor.name} — injured (no replacement)`)
                  setInjuryPickerFor(null)
                }}
                className="tap-target w-full px-3 italic active:scale-[0.98] transition opacity-60 text-sm"
              >
                Continue without replacement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Conversion prompt (after any try) */}
      {conversionPromptOpen && (
        <div
          className="fixed inset-0 z-40 flex items-end"
          style={{ background: 'rgba(32,24,32,0.7)' }}
          onClick={() => setConversionPromptOpen(false)}
        >
          <div className="bg-white w-full rounded-t-2xl p-4" onClick={e => e.stopPropagation()}>
            <div className="text-xl font-bold mb-1" style={{ color: INK }}>Conversion kicked?</div>
            <p className="text-sm text-stone-400 mb-4">+2 pts</p>
            <div className="flex gap-3">
              <button
                onClick={() => { store.recordConversionUs(); showToast('Conversion — +2'); setConversionPromptOpen(false) }}
                className="flex-1 tap-target rounded-lg font-bold text-base active:scale-95 transition"
                style={{ background: BLUE, color: 'white' }}
              >
                Yes — converted
              </button>
              <button
                onClick={() => { store.recordConversionThem(); showToast(`Conversion — ${opponent}`); setConversionPromptOpen(false) }}
                className="flex-1 tap-target rounded-lg font-bold text-base active:scale-95 transition"
                style={{ background: '#E5E7EB', color: INK }}
              >
                Them converted
              </button>
            </div>
            <button
              onClick={() => setConversionPromptOpen(false)}
              className="w-full mt-2 py-2 text-sm text-stone-400"
            >
              Missed / no kick
            </button>
          </div>
        </div>
      )}

      {/* ── Penalty picker (us) */}
      {penPickerOpen && (
        <div
          className="fixed inset-0 z-40 flex items-end"
          style={{ background: 'rgba(32,24,32,0.7)' }}
          onClick={() => setPenPickerOpen(false)}
        >
          <div className="bg-white w-full rounded-t-2xl p-4 max-h-[70vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-2xl font-bold" style={{ color: INK }}>Penalty — who kicked?</div>
              <button onClick={() => setPenPickerOpen(false)} className="tap-target w-12 flex items-center justify-center"><X /></button>
            </div>
            <div className="space-y-1.5">
              {onPitch.map(p => (
                <button
                  key={p.id}
                  onClick={() => { store.recordPenaltyUs(p.id); showToast(`Penalty — ${p.name} +3`); setPenPickerOpen(false) }}
                  className="tap-target w-full flex items-center gap-3 px-3 bg-white rounded-lg border active:scale-[0.98] transition"
                  style={{ borderColor: '#C5D8F5' }}
                >
                  <GroupBadge group={matchState.playerStates.get(p.id)!.activeGroup} />
                  <span className="font-semibold flex-1 text-left">{p.name}</span>
                </button>
              ))}
              <button
                onClick={() => { store.recordPenaltyUs(); showToast('Penalty +3'); setPenPickerOpen(false) }}
                className="tap-target w-full px-3 italic active:scale-[0.98] transition opacity-70"
              >
                Unattributed
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Drop goal picker (us) */}
      {dgPickerOpen && (
        <div
          className="fixed inset-0 z-40 flex items-end"
          style={{ background: 'rgba(32,24,32,0.7)' }}
          onClick={() => setDgPickerOpen(false)}
        >
          <div className="bg-white w-full rounded-t-2xl p-4 max-h-[70vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-2xl font-bold" style={{ color: INK }}>Drop goal — who scored?</div>
              <button onClick={() => setDgPickerOpen(false)} className="tap-target w-12 flex items-center justify-center"><X /></button>
            </div>
            <div className="space-y-1.5">
              {onPitch.map(p => (
                <button
                  key={p.id}
                  onClick={() => { store.recordDropGoalUs(p.id); showToast(`Drop goal — ${p.name} +3`); setDgPickerOpen(false) }}
                  className="tap-target w-full flex items-center gap-3 px-3 bg-white rounded-lg border active:scale-[0.98] transition"
                  style={{ borderColor: '#C5D8F5' }}
                >
                  <GroupBadge group={matchState.playerStates.get(p.id)!.activeGroup} />
                  <span className="font-semibold flex-1 text-left">{p.name}</span>
                </button>
              ))}
              <button
                onClick={() => { store.recordDropGoalUs(); showToast('Drop goal +3'); setDgPickerOpen(false) }}
                className="tap-target w-full px-3 italic active:scale-[0.98] transition opacity-70"
              >
                Unattributed
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast */}
      {toast && (
        <div
          className="fixed bottom-32 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-sm shadow-lg z-50 whitespace-nowrap"
          style={{ background: INK, color: 'white' }}
        >
          {toast}
        </div>
      )}
    </div>
  )
}
