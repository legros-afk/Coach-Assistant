import { useEffect, useMemo, useRef, useState } from 'react'
import { GROUP_COLOR } from '@/ui/positions'
import {
  Activity, AlertTriangle, ArrowRight, Check, ChevronLeft, Clock,
  HandHelping, MoreVertical, Pause, Play, Plus, Trophy, Undo2, X,
} from 'lucide-react'
import { WoodfordMark } from '@/components/WoodfordMark'
import type { Group, ID, Player, PlayerMatchState } from '@/lib/events/types'
import { planSubs } from '@/lib/domain/subPlanner'
import { useMatchStore } from './useMatchStore'

// ── brand constants ────────────────────────────────────────────────────────────

const PURPLE      = 'var(--m-primary)'
const PURPLE_DARK = 'var(--m-on-primary-container)'
const PURPLE_SOFT = 'var(--m-primary-container)'
const PURPLE_SOFTER = 'var(--m-primary-container)'
const INK         = 'var(--m-on-surface)'

// ── helpers ───────────────────────────────────────────────────────────────────

function fmt(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function balanceColor(playerMs: number, avgMs: number): string {
  const diff = Math.abs(playerMs - avgMs)
  if (diff < 2 * 60_000) return 'var(--x-go)'
  if (diff < 5 * 60_000) return 'var(--x-pause)'
  return 'var(--m-error)'
}

function liveMinMs(ps: PlayerMatchState, elapsedMs: number): number {
  return ps.status === 'on' && ps.currentStintStartedAtMs !== undefined
    ? ps.minutesPlayed + (elapsedMs - ps.currentStintStartedAtMs)
    : ps.minutesPlayed
}

const TOTAL_GAME_MS  = 40 * 60_000
const HALF_LENGTH_MS = TOTAL_GAME_MS / 2
// Starts reward performance; the guarantee is that everyone plays at least
// a half, with changes batched at the break wherever possible.
const MINIMUM_MS     = HALF_LENGTH_MS

// Parent-safe helper mode: subs and scores only. Persisted so a mid-game
// reload doesn't hand a parent the full coach UI.
const HELPER_KEY = 'coach-helper-mode'

// ── sub-components ─────────────────────────────────────────────────────────────

const GROUP_LABEL: Record<Group, string> = { forward: 'F', back: 'B', scrumhalf: 'SH' }

function GroupBadge({ group, size = 'md' }: { group: Group; size?: 'md' | 'sm' }) {
  const bg = GROUP_COLOR[group]
  const cls = size === 'sm'
    ? 'text-xs w-5 h-5'
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
          className="text-xs font-semibold"
          style={{ color: hint ? PURPLE : 'var(--m-on-surface-variant)' }}
        >
          {hint ?? subtitle}
        </span>
      </div>
      {children}
    </div>
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
  /** Opens the blood / injury menu for this player */
  onMenu?: () => void
  muted?: boolean
  suggested?: boolean   // fits the position of the player coming off
  dimmed?: boolean      // doesn't fit — still tappable, just de-emphasised
  onReturn?: () => void
}

function PlayerCard({
  player, ps, avgMs, liveElapsedMs,
  picked, pickedTone, onTap, onMenu, muted, suggested, dimmed, onReturn,
}: PlayerCardProps) {
  const mins = liveMinMs(ps, liveElapsedMs)
  const pickedBg     = pickedTone === 'rose' ? 'var(--m-error-container)' : 'var(--x-good-container)'
  const pickedBorder = pickedTone === 'rose' ? 'var(--m-error)' : 'var(--x-go)'

  return (
    <div
      onClick={onTap}
      className={`p-2.5 rounded-m-md transition relative ${onTap ? 'active:scale-[0.98] cursor-pointer' : ''}`}
      style={{
        background: picked ? pickedBg : muted ? 'var(--m-surface-container-low)' : suggested ? PURPLE_SOFTER : 'var(--m-surface-container)',
        border: picked
          ? `2px solid ${pickedBorder}`
          : suggested ? `2px solid ${PURPLE_DARK}` : '1px solid var(--m-outline-variant)',
        opacity: muted ? 0.7 : dimmed ? 0.5 : 1,
      }}
    >
      <div className="flex items-start gap-2 mb-1.5">
        <GroupBadge group={ps.activeGroup} />
        <div className="flex-1 min-w-0">
          <div className="font-bold text-base leading-tight line-clamp-2" style={{ color: INK }}>
            {player.name}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: balanceColor(mins, avgMs) }}
            />
            <span className="mono text-xs tabular-nums opacity-70">{fmt(mins)}</span>
            {ps.triesScored > 0 && (
              <span className="mono text-xs font-bold" style={{ color: PURPLE }}>
                {ps.triesScored}T
              </span>
            )}
          </div>
        </div>
        {onMenu && (
          // Blood and injury live behind this menu, well away from the tap-to-sub
          // area, so a stray tap can't take a player off by accident.
          <button
            onClick={e => { e.stopPropagation(); onMenu() }}
            aria-label={`Blood or injury — ${player.name}`}
            className="-mr-1.5 -mt-1.5 w-11 h-11 flex items-center justify-center rounded-m-md active:bg-m-outline-variant flex-shrink-0"
          >
            <MoreVertical size={18} strokeWidth={2.5} style={{ color: 'var(--m-on-surface-variant)' }} />
          </button>
        )}
      </div>
      {onReturn && (
        <button
          onClick={e => { e.stopPropagation(); onReturn() }}
          className="w-full mt-1.5 py-1.5 rounded-m-md text-xs font-bold flex items-center justify-center gap-1 active:scale-95"
          style={{ background: 'var(--x-go)', color: 'white' }}
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
      className="tap-target flex-1 rounded-m-md flex items-center justify-center gap-1.5 font-bold active:scale-95 transition"
      style={{
        background: primary ? 'white' : 'rgba(255,255,255,0.1)',
        color:      primary ? 'var(--x-on-bright)' : 'white',
        border:     primary ? 'none' : '1px solid rgba(255,255,255,0.2)',
      }}
    >
      <Plus size={14} strokeWidth={2.5} />
      <span className="text-sm">{label}</span>
      <span className="mono text-xl tabular-nums">{value}</span>
    </button>
  )
}

// ── main screen ────────────────────────────────────────────────────────────────

interface LiveMatchProps { onBack?: () => void; onSummary?: () => void }

export default function LiveMatch({ onBack, onSummary }: LiveMatchProps) {
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

  // ── match phase (needed by the sub plan below)
  const halfEnded = store.events.some(e => e.type === 'HALF_END')
  const matchEnded = store.events.some(e => e.type === 'MATCH_END')
  const gameStarted = store.events.some(e => e.type === 'CLOCK_START')
  const secondHalfStarted = store.events.some(
    e => e.type === 'CLOCK_START' && (e as Extract<typeof e, { type: 'CLOCK_START' }>).payload.half === 2,
  )
  const atBreak = halfEnded && !secondHalfStarted && !matchEnded

  // ── keep the screen awake while the match screen is open — unlocking a
  //    phone with wet hands mid-sub is the fiddliest thing pitch-side
  useEffect(() => {
    let lock: WakeLockSentinel | null = null
    let cancelled = false
    const acquire = async () => {
      try {
        if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') return
        const l = await navigator.wakeLock.request('screen')
        if (cancelled) { void l.release(); return }
        lock = l
      } catch { /* not supported or refused (e.g. low battery) — carry on */ }
    }
    void acquire()
    // The browser drops the lock when the app is hidden; take it back on return
    const onVisible = () => { if (document.visibilityState === 'visible') void acquire() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      void lock?.release()
    }
  }, [])

  // ── standing sub plan — recomputed every ~15s of clock time, also while paused
  //    (half-time is exactly when subs get made)
  const planElapsedMs = Math.floor(liveElapsedMs / 15_000) * 15_000
  const subPlan = useMemo(
    () => gameStarted && !matchEnded
      ? planSubs(squad, teamSheet, matchState.playerStates, planElapsedMs, {
          gameLengthMs: TOTAL_GAME_MS,
          halfLengthMs: HALF_LENGTH_MS,
          minimumMs: MINIMUM_MS,
          halfEnded,
          secondHalfStarted,
        })
      : [],
    [squad, teamSheet, matchState, planElapsedMs, gameStarted, matchEnded, halfEnded, secondHalfStarted],
  )
  const dueSwaps = subPlan.filter(s => s.dueNow)
  const dueKey = dueSwaps.map(s => `${s.off.id}>${s.on.id}`).join('|')
  // Dismiss hides the plan until the set of due swaps changes
  const [dismissedKey, setDismissedKey] = useState<string | null>(null)

  // ── helper mode (parent-safe: subs & scores only)
  const [helperMode, setHelperModeState] = useState(() => localStorage.getItem(HELPER_KEY) === '1')
  const setHelperMode = (v: boolean) => {
    setHelperModeState(v)
    localStorage.setItem(HELPER_KEY, v ? '1' : '0')
  }

  // ── sub selection
  const [comingOffIds, setComingOffIds] = useState<ID[]>([])
  const [comingOnIds,  setComingOnIds]  = useState<ID[]>([])
  const subMode = comingOffIds.length > 0 || comingOnIds.length > 0

  const clearSubs = () => { setComingOffIds([]); setComingOnIds([]) }

  // ── try picker
  const [tryPickerOpen, setTryPickerOpen] = useState(false)

  // ── blood replacement picker
  const [bloodPickerFor, setBloodPickerFor] = useState<Player | null>(null)

  // ── injury replacement picker
  const [injuryPickerFor, setInjuryPickerFor] = useState<Player | null>(null)

  // ── blood / injury menu for one on-pitch player
  const [menuFor, setMenuFor] = useState<Player | null>(null)

  // ── undo confirmation
  const [pendingUndo, setPendingUndo] = useState(false)

  // ── toast
  // Subs and tries offer an inline Undo, so a mis-tap is one tap to reverse.
  const [toast, setToast] = useState<{ msg: string; undo: boolean } | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showToast = (msg: string, undo = false) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ msg, undo })
    toastTimer.current = setTimeout(() => setToast(null), undo ? 5000 : 2400)
  }
  const undoFromToast = () => {
    store.undoLast()
    if (toastTimer.current) clearTimeout(toastTimer.current)
    showToast('Undone')
  }

  // ── helper-mode exit needs a deliberate press-and-hold
  const exitHold = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startExitHold = () => {
    exitHold.current = setTimeout(() => { setHelperMode(false); exitHold.current = null }, 1000)
  }
  const cancelExitHold = () => {
    if (exitHold.current) clearTimeout(exitHold.current)
    exitHold.current = null
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
        showToast(`${p.name} — on`, true)
      }
      return
    }
    if (comingOnIds.length >= comingOffIds.length) {
      showToast('Tap a player to come off first')
      return
    }
    const newOnIds = [...comingOnIds, p.id]
    if (newOnIds.length === comingOffIds.length) {
      const mismatch = comingOffIds.some(offId => {
        const offActive = matchState.playerStates.get(offId)?.activeGroup
        if (!offActive) return false
        return !newOnIds.some(onId => playerMap.get(onId)?.eligibleGroups.includes(offActive))
      })
      if (mismatch) {
        // Hold the selection — the tray asks for explicit confirmation
        setComingOnIds(newOnIds)
      } else {
        store.commitSubBatch(comingOffIds, newOnIds)
        clearSubs()
        showToast('Sub done', true)
      }
    } else {
      setComingOnIds(newOnIds)
    }
  }

  const confirmPendingSub = () => {
    store.commitSubBatch(comingOffIds, comingOnIds)
    clearSubs()
    showToast('Sub done — out of position', true)
  }
  const pendingConfirm = subMode && comingOffIds.length > 0 && comingOnIds.length === comingOffIds.length

  // Positions still waiting for a replacement — used to highlight bench players
  // who fit, drawing the eye to like-for-like subs without forcing them
  const awaitingReplacement = comingOffIds.length > comingOnIds.length
  const wantedGroups = useMemo<Group[]>(
    () => awaitingReplacement
      ? pairings.filter(pr => pr.off && !pr.on).map(pr => pr.onGroup)
      : [],
    [pairings, awaitingReplacement],
  )

  // Bench ordered for replacing a specific player: position fits first
  const replacementsFor = (forPlayer: Player) => {
    const g = matchState.playerStates.get(forPlayer.id)?.activeGroup
    if (!g) return bench.map(p => ({ p, fits: true }))
    return bench
      .map(p => ({ p, fits: p.eligibleGroups.includes(g) }))
      .sort((a, b) => Number(b.fits) - Number(a.fits))
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

  const applyDueSwaps = () => {
    if (dueSwaps.length === 0) return
    store.commitSubBatch(dueSwaps.map(s => s.off.id), dueSwaps.map(s => s.on.id))
    const label = dueSwaps.length === 1
      ? `${dueSwaps[0].off.name} → ${dueSwaps[0].on.name}`
      : `${dueSwaps.length} subs done`
    showToast(label, true)
  }

  // ── half/full-time prompts
  const half1EndMs = store.events
    .filter((e): e is Extract<typeof store.events[number], { type: 'HALF_END' }> => e.type === 'HALF_END')[0]
    ?.payload.elapsedMs
  const fullTimeDueAtMs = half1EndMs !== undefined ? half1EndMs + HALF_LENGTH_MS : TOTAL_GAME_MS
  const halfTimeDue = clockRunning && !halfEnded && liveElapsedMs >= HALF_LENGTH_MS
  const fullTimeDue = clockRunning && halfEnded && !matchEnded && liveElapsedMs >= fullTimeDueAtMs

  // ── render
  return (
    <div className="min-h-screen pb-44" style={{ background: 'var(--m-surface)', color: INK }}>

      {/* ── Brand strip */}
      <div className="sticky top-0 z-20 safe-top" style={{ background: 'var(--brand)' }}>
        <div
          className="px-3 h-16 flex items-center justify-between gap-2"
        >
          <div className="flex items-center gap-2 min-w-0">
            {onBack && !helperMode && (
              <button
                onClick={onBack}
                className="m-press w-12 h-12 flex items-center justify-center rounded-full -ml-2"
                aria-label="Back to matches — the clock keeps running"
              >
                <ChevronLeft size={24} color="white" strokeWidth={2.25} />
              </button>
            )}
            <WoodfordMark size={22} color="white" />
            <div className="leading-tight min-w-0">
              <div className="text-base font-bold text-white truncate">
                vs {opponent || '—'}
              </div>
              <div className="text-xs text-white/80 truncate">
                Woodford U12 · Team {teamSheet.label}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!helperMode && (
              <button
                onClick={() => setHelperMode(true)}
                className="m-press h-10 px-3.5 flex items-center gap-1.5 rounded-full text-sm font-semibold text-white whitespace-nowrap"
                style={{ background: 'var(--brand-bar-control)' }}
              >
                <HandHelping size={16} color="white" strokeWidth={2.25} />
                Helper
              </button>
            )}
          </div>
        </div>

        {/* Helper mode strip */}
        {helperMode && (
          <div className="px-3 py-1.5 flex items-center justify-between" style={{ background: 'var(--x-pause)' }}>
            <span className="text-xs font-bold flex items-center gap-1.5" style={{ color: 'var(--x-on-bright)' }}>
              <HandHelping size={13} strokeWidth={2.5} /> Helper mode — subs & scores
            </span>
            <button
              onPointerDown={startExitHold}
              onPointerUp={cancelExitHold}
              onPointerLeave={cancelExitHold}
              onPointerCancel={cancelExitHold}
              onContextMenu={e => e.preventDefault()}
              className="text-xs font-bold px-3 h-9 rounded-m-md select-none active:scale-95 transition"
              style={{ background: 'var(--x-on-bright)', color: 'white' }}
            >
              Hold to exit
            </button>
          </div>
        )}

        {/* Clock + score bar */}
        <div style={{ background: 'var(--x-live-bar)' }} className="px-3 py-2.5">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-white/70">
                H{matchState.half}
              </span>
              <span className="mono text-3xl font-bold tabular-nums tracking-tight text-white">
                {fmt(liveElapsedMs)}
              </span>
            </div>

            {matchEnded ? (
              <span className="text-xs font-bold text-white/50">
                Full time
              </span>
            ) : (
              <button
                onClick={() => clockRunning ? store.pauseClock() : store.startClock()}
                className="tap-target w-14 rounded-m-md flex items-center justify-center transition active:scale-95"
                style={{ background: clockRunning ? 'var(--x-pause)' : 'var(--x-go)', color: 'var(--x-on-bright)' }}
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
                onClick={() => { store.recordTryThem(); showToast(`Try — ${opponent}`, true) }}
              />
            </div>
          </div>

          {/* Half / full-time control — always there once the game is under way */}
          {gameStarted && !matchEnded && !helperMode && !atBreak && (
            <div className="flex gap-2 mt-2">
              {!halfEnded ? (
                <button
                  onClick={() => { store.endHalf(); showToast('Half time') }}
                  className="h-10 flex-1 text-xs font-bold rounded-m-md active:scale-95 transition"
                  style={{ background: 'rgba(255,255,255,0.14)', color: 'white', border: '1px solid rgba(255,255,255,0.25)' }}
                >
                  End first half
                </button>
              ) : (
                <button
                  onClick={() => { store.endMatch(); showToast('Full time') }}
                  className="h-10 flex-1 text-xs font-bold rounded-m-md active:scale-95 transition"
                  style={{ background: 'rgba(255,255,255,0.14)', color: 'white', border: '1px solid rgba(255,255,255,0.25)' }}
                >
                  Full time
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Half / full-time prompt */}
      {(halfTimeDue || fullTimeDue) && (
        <div
          className="mx-3 mt-3 rounded-m-md p-3 flex items-center gap-3"
          style={{ background: 'var(--x-warn-container)', border: '1px solid var(--x-pause)' }}
        >
          <Clock size={18} style={{ color: 'var(--x-on-warn-container)' }} className="flex-shrink-0" strokeWidth={2.5} />
          <div className="flex-1 text-sm font-bold" style={{ color: 'var(--x-on-warn-container)' }}>
            {halfTimeDue ? 'Half 1 has reached 20 min' : 'Game has reached full time'}
            {helperMode && <span className="block font-semibold text-xs mt-0.5">Tell the coach</span>}
          </div>
          {!helperMode && (
            <button
              onClick={() => {
                if (halfTimeDue) { store.endHalf(); showToast('Half time') }
                else             { store.endMatch(); showToast('Full time') }
              }}
              className="text-xs font-bold px-3 py-1.5 rounded-m-md whitespace-nowrap active:scale-95 transition"
              style={{ background: 'var(--x-on-warn-container)', color: 'white' }}
            >
              {halfTimeDue ? 'End half' : 'Full time'}
            </button>
          )}
        </div>
      )}

      {/* ── Standing sub plan */}
      {/* ── Half-time panel */}
      {atBreak && !subMode && (
        <div className="mx-3 mt-3 rounded-m-xl overflow-hidden pop-in bg-m-surface-container" style={{ border: `2px solid ${PURPLE}` }}>
          <div className="px-3 py-2.5 flex items-center justify-between" style={{ background: PURPLE_SOFTER }}>
            <div className="text-lg font-bold" style={{ color: PURPLE }}>Half time</div>
            <div className="mono text-lg font-bold tabular-nums" style={{ color: INK }}>
              {matchState.scoreUs}–{matchState.scoreThem}
            </div>
          </div>

          <div className="px-3 py-2.5">
            <div className="text-xs font-bold mb-1.5" style={{ color: 'var(--m-on-surface-variant)' }}>
              {dueSwaps.length > 0 ? 'Changes for the second half' : 'No changes needed'}
            </div>
            {dueSwaps.length > 0 ? (
              <div className="space-y-1.5">
                {dueSwaps.map((swap, i) => (
                  <div key={i} className="flex items-center gap-2 text-base">
                    <GroupBadge group={swap.group} size="sm" />
                    <span className="font-semibold truncate" style={{ color: 'var(--m-on-error-container)' }}>{swap.off.name}</span>
                    <ArrowRight size={14} className="flex-shrink-0 opacity-50" />
                    <span className="font-semibold truncate" style={{ color: 'var(--x-good)' }}>{swap.on.name}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-m-on-surface-variant">Everyone is on course for at least a half.</div>
            )}
          </div>

          <div className="px-3 pb-2.5">
            <div className="text-xs font-bold mb-1" style={{ color: 'var(--m-on-surface-variant)' }}>Least played so far</div>
            <div className="text-sm" style={{ color: INK }}>
              {squad
                .filter(p => { const st = matchState.playerStates.get(p.id)?.status; return st === 'on' || st === 'bench' })
                .sort((a, b) => (matchState.playerStates.get(a.id)!.minutesPlayed) - (matchState.playerStates.get(b.id)!.minutesPlayed))
                .slice(0, 4)
                .map(p => `${p.name} ${Math.round(matchState.playerStates.get(p.id)!.minutesPlayed / 60_000)}'`)
                .join(' · ')}
            </div>
          </div>

          {!helperMode && (
            <div className="px-3 pb-3 flex gap-2">
              {dueSwaps.length > 0 && (
                <button
                  onClick={applyDueSwaps}
                  className="flex-1 rounded-m-md font-bold text-sm active:scale-95 transition"
                  style={{ minHeight: 48, background: 'var(--m-secondary-container)', color: 'var(--m-on-secondary-container)' }}
                >
                  Make {dueSwaps.length} change{dueSwaps.length === 1 ? '' : 's'}
                </button>
              )}
              <button
                onClick={() => { store.startClock(); showToast('Second half') }}
                className="flex-1 rounded-m-md font-bold text-sm flex items-center justify-center gap-1.5 active:scale-95 transition"
                style={{ minHeight: 48, background: 'var(--x-go)', color: 'var(--x-on-bright)' }}
              >
                <Play size={16} strokeWidth={2.5} /> Start second half
              </button>
            </div>
          )}
        </div>
      )}

      {/* Before the break, half-time changes are one quiet line, not a list */}
      {subPlan.length > 0 && !subMode && !atBreak && dueSwaps.length === 0 && subPlan.every(sw => sw.atHalfTime) && (
        <div className="mx-3 mt-3 px-3 py-2.5 rounded-m-md bg-m-surface-container flex items-center gap-2 text-sm" style={{ border: '1px solid var(--m-outline-variant)', color: 'var(--m-on-surface-variant)' }}>
          <Clock size={16} strokeWidth={2} style={{ color: 'var(--m-on-surface-variant)' }} className="flex-shrink-0" />
          <span>{subPlan.length} change{subPlan.length === 1 ? '' : 's'} planned for half time</span>
        </div>
      )}

      {subPlan.length > 0 && dismissedKey !== dueKey && !subMode && !atBreak && !(dueSwaps.length === 0 && subPlan.every(sw => sw.atHalfTime)) && (
        <div
          className="mx-3 mt-3 rounded-m-md p-3 flex items-start gap-3"
          style={{
            background: dueSwaps.length ? PURPLE_SOFTER : 'var(--m-surface-container)',
            border: `1px solid ${dueSwaps.length ? PURPLE : PURPLE_SOFT}`,
          }}
        >
          {dueSwaps.length > 0
            ? <AlertTriangle size={18} style={{ color: PURPLE }} className="flex-shrink-0 mt-0.5" strokeWidth={2.5} />
            : <Clock size={18} style={{ color: 'var(--m-on-surface-variant)' }} className="flex-shrink-0 mt-0.5" strokeWidth={2} />}
          <div className="flex-1 text-sm min-w-0">
            <div className="font-bold mb-1" style={{ color: PURPLE_DARK }}>
              {dueSwaps.length > 0 ? 'Subs due now' : 'Next subs'}
            </div>
            <div className="space-y-1">
              {subPlan.map((swap, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5 text-sm"
                  style={{ color: PURPLE, opacity: swap.dueNow ? 1 : 0.6 }}
                >
                  <GroupBadge group={swap.group} size="sm" />
                  <span className="font-semibold truncate">{swap.off.name}</span>
                  <ArrowRight size={10} className="flex-shrink-0 opacity-50" />
                  <span className="font-semibold truncate">{swap.on.name}</span>
                  <span className="mono text-xs ml-auto flex-shrink-0 tabular-nums">
                    {swap.dueNow ? 'now' : swap.atHalfTime ? 'HT' : `~${Math.ceil(swap.dueAtMs / 60_000)}'`}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1 flex-shrink-0">
            {dueSwaps.length > 0 && (
              <button
                onClick={applyDueSwaps}
                className="text-xs font-bold px-2.5 py-1 rounded-m-md whitespace-nowrap"
                style={{ background: PURPLE, color: 'var(--m-on-primary)' }}
              >
                {dueSwaps.length > 1 ? 'Apply all' : 'Apply'}
              </button>
            )}
            <button
              onClick={() => setDismissedKey(dueKey)}
              className="text-xs px-2 py-1 text-center"
              style={{ color: PURPLE }}
            >
              Later
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
          <div className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-2">
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
                onMenu={!subMode && !helperMode ? () => setMenuFor(p) : undefined}
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
          <div className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-2">
            {bench.map(p => {
              const isPicked = comingOnIds.includes(p.id)
              const fits = wantedGroups.some(g => p.eligibleGroups.includes(g))
              return (
                <PlayerCard
                  key={p.id}
                  player={p}
                  ps={matchState.playerStates.get(p.id)!}
                  avgMs={avgMs}
                  liveElapsedMs={liveElapsedMs}
                  picked={isPicked}
                  pickedTone="emerald"
                  suggested={awaitingReplacement && !isPicked && fits}
                  dimmed={awaitingReplacement && !isPicked && !fits}
                  onTap={
                    isPicked || awaitingReplacement || isShortPitch
                      ? () => togglePickOn(p)
                      : undefined
                  }
                />
              )
            })}
          </div>
        </Section>

        {offPitch.length > 0 && (
          <Section title="Off" count={offPitch.length} subtitle="blood / injured">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-2">
              {offPitch.map(p => (
                <PlayerCard
                  key={p.id}
                  player={p}
                  ps={matchState.playerStates.get(p.id)!}
                  avgMs={avgMs}
                  liveElapsedMs={liveElapsedMs}
                  muted
                  onReturn={helperMode ? undefined : () => {
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
          className="fixed above-live-bar left-0 right-0 px-3 py-2.5 shadow-2xl z-30"
          style={{ background: 'var(--x-live-bar)', color: 'white', borderTop: '2px solid var(--brand)' }}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold opacity-60">
              {comingOffIds.length > comingOnIds.length
                ? 'Now tap a replacement'
                : pendingConfirm
                  ? 'Position mismatch — confirm below'
                  : 'Sub in progress'}
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
                    ? <><GroupBadge group={pr.off.ps.activeGroup} size="sm" /><span className="font-semibold truncate" style={{ color: 'var(--m-error)' }}>{pr.off.player.name}</span></>
                    : <span className="opacity-40 italic text-xs">—</span>}
                </div>
                <ArrowRight size={13} className="opacity-40 flex-shrink-0" />
                <div className="flex-1 flex items-center gap-1.5 min-w-0">
                  {pr.on
                    ? <><GroupBadge group={pr.onGroup} size="sm" /><span className="font-semibold truncate" style={{ color: 'var(--x-on-brand-good)' }}>{pr.on.player.name}</span></>
                    : <span className="opacity-40 italic text-xs">tap bench →</span>}
                </div>
                <div className="w-4 flex-shrink-0">
                  {pr.off && pr.on && (
                    pr.match
                      ? <Check size={14} style={{ color: 'var(--x-go)' }} strokeWidth={2.5} />
                      : <AlertTriangle size={14} style={{ color: 'var(--m-error)' }} strokeWidth={2.5} />
                  )}
                </div>
              </div>
            ))}
          </div>
          {pendingConfirm && (
            <button
              onClick={confirmPendingSub}
              className="w-full mt-2 py-2 rounded-m-md text-sm font-bold flex items-center justify-center gap-1.5 active:scale-95 transition"
              style={{ background: 'var(--x-pause)', color: 'var(--x-on-bright)' }}
            >
              <AlertTriangle size={14} strokeWidth={2.5} /> Confirm sub anyway
            </button>
          )}
        </div>
      )}

      {/* ── Undo confirmation bar */}
      {pendingUndo && (
        <div
          className="fixed above-live-bar left-0 right-0 px-3 py-3 flex items-center justify-between z-40"
          style={{ background: 'var(--m-error)', color: 'var(--m-on-error)' }}
        >
          <span className="text-sm font-semibold">Undo last action?</span>
          <div className="flex gap-2">
            <button
              onClick={confirmUndo}
              className="text-sm font-bold px-4 py-1.5 rounded-m-md bg-m-surface-container"
              style={{ color: 'var(--m-error)' }}
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
        className="fixed bottom-0 left-0 right-0 px-3 pt-3 flex items-center gap-2 z-30"
        style={{ background: 'var(--m-surface)', borderTop: '1px solid var(--m-outline)', paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
      >
        {matchEnded ? (
          helperMode ? (
            <div className="flex-1 text-center text-sm font-semibold py-3" style={{ color: PURPLE_DARK }}>
              Full time — hand the phone back to the coach
            </div>
          ) : (
            <button
              onClick={onSummary}
              className="tap-target flex-1 rounded-m-md font-bold text-base active:scale-95 transition flex items-center justify-center gap-2"
              style={{ background: PURPLE, color: 'var(--m-on-primary)' }}
            >
              <Trophy size={18} strokeWidth={2} />
              Match summary
            </button>
          )
        ) : (
          <>
            {!helperMode && (
              <button
                onClick={handleUndoPress}
                disabled={!store.events.length}
                className="tap-target px-4 rounded-m-md border-2 font-semibold flex items-center gap-2 disabled:opacity-40 active:scale-95 transition"
                style={{ borderColor: 'var(--m-outline)', color: INK }}
              >
                <Undo2 size={18} strokeWidth={2.5} />
                Undo
              </button>
            )}
            <div className="flex-1 text-center text-sm text-m-on-surface-variant py-2">
              {subMode ? 'Now tap who comes on' : 'Tap a player to sub them off'}
            </div>
          </>
        )}
      </div>

      {/* ── Try scorer picker */}
      {tryPickerOpen && (
        <div
          className="fixed inset-0 z-40 flex items-end backdrop-in"
          style={{ background: 'var(--m-scrim)' }}
          onClick={() => setTryPickerOpen(false)}
        >
          <div
            className="bg-m-surface-container-low w-full rounded-t-m-xl sheet-in px-4 pt-2 max-h-[70vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="mx-auto mb-2 h-1 w-8 rounded-full bg-m-outline-variant" aria-hidden="true" />
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Trophy size={22} style={{ color: PURPLE }} />
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
                    showToast(`Try — ${p.name}`, true)
                    setTryPickerOpen(false)
                  }}
                  className="tap-target w-full flex items-center gap-3 px-3 bg-m-surface-container rounded-m-md border active:scale-[0.98] transition"
                  style={{ borderColor: 'var(--m-outline-variant)' }}
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
                  showToast('Try (unattributed)', true)
                  setTryPickerOpen(false)
                }}
                className="tap-target w-full px-3 italic active:scale-[0.98] transition opacity-70"
              >
                Unattributed / decide later
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Blood / injury menu */}
      {menuFor && (
        <div
          className="fixed inset-0 z-40 flex items-end backdrop-in"
          style={{ background: 'var(--m-scrim)' }}
          onClick={() => setMenuFor(null)}
        >
          <div
            className="bg-m-surface-container-low w-full rounded-t-m-xl sheet-in px-4 pt-2 space-y-2"
            onClick={e => e.stopPropagation()}
          >
            <div className="mx-auto mb-2 h-1 w-8 rounded-full bg-m-outline-variant" aria-hidden="true" />
            <div className="flex items-center justify-between mb-1">
              <div className="text-2xl font-bold" style={{ color: INK }}>{menuFor.name}</div>
              <button onClick={() => setMenuFor(null)} className="w-12 h-12 flex items-center justify-center" aria-label="Close">
                <X />
              </button>
            </div>
            <button
              onClick={() => { setBloodPickerFor(menuFor); setMenuFor(null) }}
              className="tap-target w-full rounded-m-md px-4 text-left active:scale-[0.98] transition"
              style={{ background: 'var(--m-error-container)', color: 'var(--m-on-error-container)' }}
            >
              <div className="font-bold text-base">Blood — temporary</div>
              <div className="text-sm">Off now, can return once treated</div>
            </button>
            <button
              onClick={() => { setInjuryPickerFor(menuFor); setMenuFor(null) }}
              className="tap-target w-full rounded-m-md px-4 text-left active:scale-[0.98] transition"
              style={{ background: 'var(--m-surface-container-high)', color: INK }}
            >
              <div className="font-bold text-base">Injury</div>
              <div className="text-sm text-m-on-surface-variant">Off, left out of the minutes balance</div>
            </button>
          </div>
        </div>
      )}

      {/* ── Blood replacement picker */}
      {bloodPickerFor && (
        <div
          className="fixed inset-0 z-40 flex items-end backdrop-in"
          style={{ background: 'var(--m-scrim)' }}
          onClick={() => setBloodPickerFor(null)}
        >
          <div
            className="bg-m-surface-container-low w-full rounded-t-m-xl sheet-in px-4 pt-2 max-h-[70vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="mx-auto mb-2 h-1 w-8 rounded-full bg-m-outline-variant" aria-hidden="true" />
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <div className="text-2xl font-bold" style={{ color: INK }}>
                  Blood — {bloodPickerFor.name}
                </div>
              </div>
              <button
                onClick={() => setBloodPickerFor(null)}
                className="tap-target w-12 flex items-center justify-center"
              >
                <X />
              </button>
            </div>
            <p className="text-sm text-m-on-surface-variant mb-3">Who comes on as replacement?</p>
            <div className="space-y-1.5">
              {replacementsFor(bloodPickerFor).map(({ p, fits }) => (
                <button
                  key={p.id}
                  onClick={() => {
                    store.bloodOff(bloodPickerFor.id, p.id)
                    showToast(`${bloodPickerFor.name} — blood · ${p.name} on`)
                    setBloodPickerFor(null)
                  }}
                  className="tap-target w-full flex items-center gap-3 px-3 bg-m-surface-container rounded-m-md border active:scale-[0.98] transition"
                  style={{ borderColor: fits ? PURPLE_DARK : 'var(--m-outline-variant)', opacity: fits ? 1 : 0.5 }}
                >
                  <GroupBadge group={matchState.playerStates.get(p.id)!.activeGroup} />
                  <span className="font-semibold flex-1 text-left">{p.name}</span>
                  <span className="mono text-xs opacity-50">
                    {fmt(liveMinMs(matchState.playerStates.get(p.id)!, liveElapsedMs))}
                  </span>
                </button>
              ))}
              {bench.length === 0 && (
                <p className="text-sm italic text-m-outline px-3 py-2">No bench players available</p>
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
          className="fixed inset-0 z-40 flex items-end backdrop-in"
          style={{ background: 'var(--m-scrim)' }}
          onClick={() => setInjuryPickerFor(null)}
        >
          <div
            className="bg-m-surface-container-low w-full rounded-t-m-xl sheet-in px-4 pt-2 max-h-[70vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="mx-auto mb-2 h-1 w-8 rounded-full bg-m-outline-variant" aria-hidden="true" />
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
            <p className="text-sm text-m-on-surface-variant mb-3">Who comes on as replacement?</p>
            <div className="space-y-1.5">
              {replacementsFor(injuryPickerFor).map(({ p, fits }) => (
                <button
                  key={p.id}
                  onClick={() => {
                    store.injuredOff(injuryPickerFor.id, p.id)
                    showToast(`${injuryPickerFor.name} — injured · ${p.name} on`)
                    setInjuryPickerFor(null)
                  }}
                  className="tap-target w-full flex items-center gap-3 px-3 bg-m-surface-container rounded-m-md border active:scale-[0.98] transition"
                  style={{ borderColor: fits ? PURPLE_DARK : 'var(--m-outline-variant)', opacity: fits ? 1 : 0.5 }}
                >
                  <GroupBadge group={matchState.playerStates.get(p.id)!.activeGroup} />
                  <span className="font-semibold flex-1 text-left">{p.name}</span>
                  <span className="mono text-xs opacity-50">
                    {fmt(liveMinMs(matchState.playerStates.get(p.id)!, liveElapsedMs))}
                  </span>
                </button>
              ))}
              {bench.length === 0 && (
                <p className="text-sm italic text-m-outline px-3 py-2">No bench players available</p>
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

      {/* ── Toast */}
      {toast && (
        <div
          className="fixed bottom-32 left-1/2 -translate-x-1/2 pl-4 pr-1 py-1 rounded-full text-sm shadow-lg z-50 whitespace-nowrap flex items-center gap-2"
          style={{ background: 'var(--m-inverse-surface)', color: 'var(--m-inverse-on-surface)', minHeight: 48 }}
        >
          <span className={toast.undo ? '' : 'pr-3'}>{toast.msg}</span>
          {toast.undo && (
            <button
              onClick={undoFromToast}
              className="h-9 px-3 rounded-full text-sm font-bold active:scale-95 transition"
              style={{ color: 'var(--m-primary-container)' }}
            >
              Undo
            </button>
          )}
        </div>
      )}
    </div>
  )
}
