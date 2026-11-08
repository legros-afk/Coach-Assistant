import { useEffect, useMemo, useRef, useState } from 'react'
import { Pitch, PitchTile } from '@/ui/Pitch'
import {
  ChevronLeft, Clock, HandHelping, Pause, Play, Trophy, Undo2,
} from 'lucide-react'
import { WoodfordMark } from '@/components/WoodfordMark'
import type { Group, ID, Player, PlayerMatchState } from '@/lib/events/types'
import { planSubs } from '@/lib/domain/subPlanner'
import { pitchOrder } from '@/lib/domain/pitchOrder'
import { useMatchStore } from './useMatchStore'
import {
  fmt, balanceColor, liveMinMs,
  PURPLE, PURPLE_DARK, INK,
  TOTAL_GAME_MS, HALF_LENGTH_MS, MINIMUM_MS, HELPER_KEY,
} from './liveMatchUtils'
import { Section } from './Section'
import { ScoreButton } from './ScoreButton'
import { MatchPlayerCard } from './MatchPlayerCard'
import { ScoreModal } from './ScoreModal'
import { PlayerMenuSheet } from './PlayerMenuSheet'
import { ReplacementPicker } from './ReplacementPicker'
import { SubStatusTray, type SubPairing } from './SubStatusTray'
import { UndoConfirmBar } from './UndoConfirmBar'
import { MatchToast } from './MatchToast'
import { HalfTimePanel } from './HalfTimePanel'
import { SubPlanPanel } from './SubPlanPanel'

// ── main screen ────────────────────────────────────────────────────────────────

interface LiveMatchProps { onBack?: () => void; onSummary?: () => void }

export default function LiveMatch({ onBack, onSummary }: LiveMatchProps) {
  const store = useMatchStore()
  const { matchState, squad, clockRunning, opponent, teamSheet, game } = store

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

  // ── the pitch: each player keeps their place through the game; a sub takes
  //    the place of the player they replace
  const placeOrder = useMemo(() => pitchOrder(teamSheet, store.events), [teamSheet, store.events])
  const expectedIn: Record<Group, number> = {
    forward: teamSheet.starters.forwards.length,
    scrumhalf: teamSheet.starters.scrumhalf ? 1 : 0,
    back: teamSheet.starters.backs.length,
  }
  const pitchSlots = (g: Group) => {
    const at = (id: ID) => { const i = placeOrder.indexOf(id); return i < 0 ? Infinity : i }
    const here = onPitch
      .filter(p => matchState.playerStates.get(p.id)?.activeGroup === g)
      .sort((a, b) => at(a.id) - at(b.id))
    const tiles = here.map(p => {
      const ps = matchState.playerStates.get(p.id)!
      const mins = liveMinMs(ps, liveElapsedMs)
      return (
        <PitchTile
          key={p.id}
          group={g}
          name={p.name}
          tone={comingOffIds.includes(p.id) ? 'off' : 'normal'}
          ariaLabel={`${p.name}, ${fmt(mins)} played — tap to sub off`}
          onClick={() => togglePickOff(p)}
          detail={<>
            <span className="inline-block w-1.5 h-1.5 rounded-full mr-1 align-middle" style={{ background: balanceColor(mins, avgMs) }} />
            {fmt(mins)}
            {ps.triesScored > 0 && <span className="font-bold ml-1" style={{ color: PURPLE }}>{ps.triesScored}T</span>}
          </>}
        />
      )
    })
    for (let i = here.length; i < expectedIn[g]; i++) {
      tiles.push(
        <PitchTile
          key={`gap-${g}-${i}`}
          group={g}
          emptyLabel="Send on"
          ariaLabel="Empty place — tap a bench player to send them on"
          onClick={() => showToast('Tap a bench player to send them on')}
        />,
      )
    }
    return tiles
  }

  // ── short-pitch detection (fewer on pitch than the original starter count)
  const starterCount = teamSheet.starters.forwards.length + teamSheet.starters.backs.length + 1
  const isShortPitch = !subMode && onPitch.length < starterCount

  // ── sub pairings + composition
  const pairings = useMemo<SubPairing[]>(() => {
    type Entry = { player: Player; ps: PlayerMatchState }
    const offQueue: Entry[] = comingOffIds.map(id => ({
      player: getPlayer(id)!, ps: matchState.playerStates.get(id)!,
    }))
    const onQueue: Entry[] = comingOnIds.map(id => ({
      player: getPlayer(id)!, ps: matchState.playerStates.get(id)!,
    }))

    const result: SubPairing[] = []
    const remainingOn = [...onQueue]

    for (const off of offQueue) {
      const idx = remainingOn.findIndex(
        on => on.player.eligibleGroups.includes(off.ps.activeGroup),
      )
      if (idx >= 0) {
        result.push({ off: remainingOn[idx], on: remainingOn[idx], match: true, onGroup: off.ps.activeGroup })
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
  const wantedGroups = useMemo(
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
                Woodford U12 · Team {teamSheet.label}{game > 1 ? ` · game ${game}` : ''}
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

      {/* ── Half-time panel */}
      {atBreak && !subMode && (
        <HalfTimePanel
          scoreUs={matchState.scoreUs}
          scoreThem={matchState.scoreThem}
          dueSwaps={dueSwaps}
          squad={squad}
          playerStates={matchState.playerStates}
          helperMode={helperMode}
          onApplySwaps={applyDueSwaps}
          onStartSecondHalf={() => { store.startClock(); showToast('Second half') }}
        />
      )}

      {/* ── Standing sub plan */}
      {subPlan.length > 0 && !subMode && !atBreak && (
        <SubPlanPanel
          subPlan={subPlan}
          dueSwaps={dueSwaps}
          dismissedKey={dismissedKey}
          dueKey={dueKey}
          onApply={applyDueSwaps}
          onDismiss={() => setDismissedKey(dueKey)}
        />
      )}

      {/* ── Player sections */}
      <div className="px-3 pt-3 space-y-4">
        <Section
          title="On pitch" count={onPitch.length} subtitle="dot: minutes vs the team"
          hint={subMode ? 'tap to take off' : undefined}
        >
          <Pitch forwards={pitchSlots('forward')} nine={pitchSlots('scrumhalf')} backs={pitchSlots('back')} />
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
                <MatchPlayerCard
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
                <MatchPlayerCard
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
        <SubStatusTray
          comingOffIds={comingOffIds}
          comingOnIds={comingOnIds}
          pendingConfirm={pendingConfirm}
          pairings={pairings}
          onClear={clearSubs}
          onConfirm={confirmPendingSub}
          onInjuryInstead={!helperMode && comingOffIds.length === 1 && comingOnIds.length === 0
            ? () => { const p = getPlayer(comingOffIds[0]); clearSubs(); if (p) setMenuFor(p) }
            : undefined}
        />
      )}

      {/* ── Undo confirmation bar */}
      <UndoConfirmBar
        open={pendingUndo}
        onConfirm={confirmUndo}
        onCancel={() => setPendingUndo(false)}
      />

      {/* ── Bottom bar */}
      <div
        className="fixed bottom-0 app-x px-3 pt-3 flex items-center gap-2 z-30"
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
      <ScoreModal
        open={tryPickerOpen}
        onPitch={onPitch}
        playerStates={matchState.playerStates}
        onPick={(playerId) => {
          if (playerId) {
            const scorer = playerMap.get(playerId)!
            store.recordTryUs(playerId)
            showToast(`Try — ${scorer.name}`, true)
          } else {
            store.recordTryUs()
            showToast('Try (unattributed)', true)
          }
          setTryPickerOpen(false)
        }}
        onClose={() => setTryPickerOpen(false)}
      />

      {/* ── Blood / injury menu */}
      <PlayerMenuSheet
        player={menuFor}
        onClose={() => setMenuFor(null)}
        onBlood={(p) => { setBloodPickerFor(p); setMenuFor(null) }}
        onInjury={(p) => { setInjuryPickerFor(p); setMenuFor(null) }}
      />

      {/* ── Blood replacement picker */}
      <ReplacementPicker
        kind="blood"
        player={bloodPickerFor}
        bench={bench}
        replacementsFor={replacementsFor}
        playerStates={matchState.playerStates}
        liveElapsedMs={liveElapsedMs}
        onSelect={(replacementId) => {
          if (replacementId) {
            const sub = playerMap.get(replacementId)!
            store.bloodOff(bloodPickerFor!.id, replacementId)
            showToast(`${bloodPickerFor!.name} — blood · ${sub.name} on`)
          } else {
            store.bloodOff(bloodPickerFor!.id)
            showToast(`${bloodPickerFor!.name} — blood (no replacement)`)
          }
          setBloodPickerFor(null)
        }}
        onClose={() => setBloodPickerFor(null)}
      />

      {/* ── Injury replacement picker */}
      <ReplacementPicker
        kind="injury"
        player={injuryPickerFor}
        bench={bench}
        replacementsFor={replacementsFor}
        playerStates={matchState.playerStates}
        liveElapsedMs={liveElapsedMs}
        onSelect={(replacementId) => {
          if (replacementId) {
            const sub = playerMap.get(replacementId)!
            store.injuredOff(injuryPickerFor!.id, replacementId)
            showToast(`${injuryPickerFor!.name} — injured · ${sub.name} on`)
          } else {
            store.injuredOff(injuryPickerFor!.id)
            showToast(`${injuryPickerFor!.name} — injured (no replacement)`)
          }
          setInjuryPickerFor(null)
        }}
        onClose={() => setInjuryPickerFor(null)}
      />

      {/* ── Toast */}
      <MatchToast
        msg={toast?.msg ?? null}
        undo={toast?.undo ?? false}
        onUndo={undoFromToast}
      />
    </div>
  )
}
