import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity, AlertTriangle, ArrowRight, Check,
  Heart, Pause, Play, Plus, Trophy, Undo2, X,
} from 'lucide-react'
import { WoodfordMark } from '@/components/WoodfordMark'
import { validateComposition, projectOnPitchGroups } from '@/lib/domain/validateComposition'
import type { Group, ID, Player, PlayerMatchState } from '@/lib/events/types'
import { useMatchStore } from './useMatchStore'

// ── brand constants ────────────────────────────────────────────────────────────

const PURPLE      = '#782880'
const PURPLE_DARK = '#5C1E63'
const PURPLE_SOFT = '#F4E8F5'
const PURPLE_SOFTER = '#FAF3FB'
const INK         = '#201820'

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

interface NudgeSuggestion { off: Player; on: Player }

function computeNudge(
  squad: Player[],
  playerStates: ReturnType<typeof useMatchStore.getState>['matchState']['playerStates'],
  elapsedMs: number,
): NudgeSuggestion | null {
  const active = squad.filter(p => playerStates.get(p.id)?.status !== 'injured')
  if (!active.length) return null
  const avg = active.reduce((s, p) => {
    const ps = playerStates.get(p.id)
    return s + (ps ? liveMinMs(ps, elapsedMs) : 0)
  }, 0) / active.length
  const T = 3 * 60_000

  for (const p of squad) {
    const ps = playerStates.get(p.id)
    if (!ps || ps.status !== 'on') continue
    if (liveMinMs(ps, elapsedMs) <= avg + T) continue
    const candidate = squad.find(bp => {
      const bps = playerStates.get(bp.id)
      return bps?.status === 'bench'
        && bp.eligibleGroups.some(g => p.eligibleGroups.includes(g))
        && liveMinMs(bps, elapsedMs) < avg - T
    })
    if (candidate) return { off: p, on: candidate }
  }
  return null
}

// ── sub-components ─────────────────────────────────────────────────────────────

const GROUP_LABEL: Record<Group, string> = { forward: 'F', back: 'B', scrumhalf: 'SH' }

function GroupBadge({ group, size = 'md' }: { group: Group; size?: 'md' | 'sm' }) {
  const bg = group === 'forward' ? INK : group === 'back' ? PURPLE : PURPLE_DARK
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
          style={{ color: hint ? PURPLE : '#A8A29E' }}
        >
          {hint ?? subtitle}
        </span>
      </div>
      {children}
    </div>
  )
}

function MiniAction({
  onClick, color, icon, label,
}: { onClick: () => void; color: string; icon?: React.ReactNode; label: string }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick() }}
      className="flex-1 py-1.5 rounded text-[11px] font-bold uppercase tracking-wide flex items-center justify-center gap-1 active:scale-95 transition"
      style={{ background: color, color: 'white' }}
    >
      {icon}{label}
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
        border: picked ? `2px solid ${pickedBorder}` : '1px solid #E7E5E4',
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
              <span className="mono text-xs font-bold" style={{ color: PURPLE }}>
                {ps.triesScored}T
              </span>
            )}
          </div>
        </div>
      </div>

      {showActions && (
        <div className="flex gap-1 mt-1.5">
          <MiniAction onClick={onBlood!} color="#DC2626" icon={<Heart size={12} strokeWidth={2.5} />} label="Blood" />
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

export default function LiveMatch() {
  const store = useMatchStore()
  const { matchState, squad, clockRunning } = store

  // ── live clock ticker
  const [liveElapsedMs, setLiveElapsedMs] = useState(() => store.currentElapsedMs())
  useEffect(() => {
    setLiveElapsedMs(store.currentElapsedMs())
    if (!clockRunning) return
    const id = setInterval(() => setLiveElapsedMs(store.currentElapsedMs()), 250)
    return () => clearInterval(id)
  }, [clockRunning, store.clockStartedAt])

  // ── coach nudge (re-evaluate every 60s of clock time)
  const [nudge, setNudge] = useState<NudgeSuggestion | null>(null)
  const [nudgeDismissed, setNudgeDismissed] = useState(false)
  const lastNudgeEvalMs = useRef(-60_001)
  useEffect(() => {
    if (!clockRunning) return
    const id = setInterval(() => {
      const elapsed = store.currentElapsedMs()
      if (elapsed - lastNudgeEvalMs.current >= 60_000) {
        lastNudgeEvalMs.current = elapsed
        const suggestion = computeNudge(squad, matchState.playerStates, elapsed)
        setNudge(suggestion)
        if (suggestion) setNudgeDismissed(false)
      }
    }, 1000)
    return () => clearInterval(id)
  }, [clockRunning, matchState])

  // ── sub builder
  const [subBuilderOpen, setSubBuilderOpen] = useState(false)
  const [comingOffIds, setComingOffIds] = useState<ID[]>([])
  const [comingOnIds,  setComingOnIds]  = useState<ID[]>([])

  const closeSubBuilder = () => {
    setSubBuilderOpen(false); setComingOffIds([]); setComingOnIds([])
  }

  // ── try picker
  const [tryPickerOpen, setTryPickerOpen] = useState(false)

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

  // ── sub builder pairings + composition
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

  const compositionCheck = useMemo(() => {
    if (!comingOffIds.length && !comingOnIds.length) return { valid: true, message: '' }
    if (comingOffIds.length !== comingOnIds.length) {
      return {
        valid: false,
        message: comingOffIds.length > comingOnIds.length
          ? 'Pick someone to come on'
          : 'Pick someone to come off',
      }
    }
    const onGroups = new Map<ID, Group>()
    for (const p of pairings) {
      if (p.on) onGroups.set(p.on.player.id, p.onGroup)
    }
    const groups = projectOnPitchGroups(matchState.playerStates, comingOffIds, onGroups)
    return validateComposition(groups)
  }, [comingOffIds, comingOnIds, pairings, matchState])

  const canConfirm = comingOffIds.length > 0 && compositionCheck.valid

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
    } else if (comingOnIds.length < 3) {
      setComingOnIds([...comingOnIds, p.id])
    } else {
      showToast('Max 3 subs at once')
    }
  }

  const confirmSubs = () => {
    if (!canConfirm) return
    store.commitSubBatch(comingOffIds, comingOnIds)
    showToast(`${comingOffIds.length} sub${comingOffIds.length > 1 ? 's' : ''} confirmed`)
    closeSubBuilder()
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

  const openSubBuilder = () => {
    setSubBuilderOpen(true); setNudgeDismissed(true)
  }

  const applyNudge = () => {
    if (!nudge) return
    setComingOffIds([nudge.off.id])
    setComingOnIds([nudge.on.id])
    openSubBuilder()
  }

  // half-end state
  const halfEnded = store.events.some(e => e.type === 'HALF_END')
  const matchEnded = store.events.some(e => e.type === 'MATCH_END')
  const gameStarted = store.events.some(e => e.type === 'CLOCK_START')

  // ── render
  return (
    <div className="min-h-screen pb-44" style={{ background: '#F5F3F0', color: INK }}>

      {/* ── Brand strip */}
      <div className="sticky top-0 z-20" style={{ background: PURPLE }}>
        <div
          className="px-3 py-2 flex items-center justify-between"
          style={{ borderBottom: `1px solid ${PURPLE_DARK}` }}
        >
          <div className="flex items-center gap-2">
            <WoodfordMark size={22} color="white" />
            <div className="leading-tight">
              <div className="text-[13px] font-bold tracking-wide uppercase text-white">
                Woodford U12
              </div>
              <div className="text-[10px] text-white/80 tracking-wider">
                vs Saints · Team A
              </div>
            </div>
          </div>
          <div className="text-[10px] uppercase tracking-widest text-white/70 italic">
            Nunquam Respice
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
                onClick={() => { store.recordTryThem(); showToast('Try — Saints') }}
              />
            </div>
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
                  onClick={() => { store.endHalf(); showToast('Full time') }}
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

      {/* ── Sub builder helper bar */}
      {subBuilderOpen && (
        <div
          className="sticky z-10 px-3 py-2 shadow-md flex items-center justify-between"
          style={{ top: '92px', background: PURPLE, color: 'white' }}
        >
          <div className="text-xs font-bold uppercase tracking-wide">
            Sub builder · tap to pick
          </div>
          <button onClick={closeSubBuilder} className="opacity-80">
            <X size={16} />
          </button>
        </div>
      )}

      {/* ── Coach nudge */}
      {nudge && !nudgeDismissed && !subBuilderOpen && (
        <div
          className="mx-3 mt-3 rounded-lg p-3 flex items-start gap-3"
          style={{ background: PURPLE_SOFTER, border: `1px solid ${PURPLE_SOFT}` }}
        >
          <AlertTriangle size={18} style={{ color: PURPLE }} className="flex-shrink-0 mt-0.5" strokeWidth={2.5} />
          <div className="flex-1 text-sm">
            <div className="font-bold" style={{ color: PURPLE_DARK }}>Suggested sub</div>
            <div className="text-[13px]" style={{ color: PURPLE }}>
              {nudge.off.name} ↔ {nudge.on.name}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <button
              onClick={applyNudge}
              className="text-xs font-bold px-2.5 py-1 rounded"
              style={{ background: PURPLE, color: 'white' }}
            >
              Open
            </button>
            <button
              onClick={() => setNudgeDismissed(true)}
              className="text-xs px-2 py-1"
              style={{ color: PURPLE }}
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
          hint={subBuilderOpen ? 'tap to take off' : undefined}
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
                onTap={subBuilderOpen ? () => togglePickOff(p) : undefined}
                showActions={!subBuilderOpen}
                onBlood={() => { store.bloodOff(p.id); showToast(`${p.name} — blood`) }}
                onInjury={() => { store.injuredOff(p.id); showToast(`${p.name} — injured`) }}
              />
            ))}
          </div>
        </Section>

        <Section
          title="Bench" count={bench.length} subtitle="least played first"
          hint={subBuilderOpen ? 'tap to bring on' : undefined}
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
                onTap={subBuilderOpen ? () => togglePickOn(p) : undefined}
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

      {/* ── Sub builder tray */}
      {subBuilderOpen && (
        <div
          className="fixed bottom-[76px] left-0 right-0 px-3 py-3 shadow-2xl z-30"
          style={{ background: INK, color: 'white', borderTop: `2px solid ${PURPLE}` }}
        >
          {!comingOffIds.length && !comingOnIds.length ? (
            <div className="text-sm py-3 text-center italic opacity-60">
              Tap players above to build your subs
            </div>
          ) : (
            <div className="space-y-1.5 mb-3">
              {pairings.map((pr, i) => (
                <div key={i} className="flex items-center gap-2 text-sm py-1">
                  <div className="flex-1 flex items-center gap-1.5 min-w-0">
                    {pr.off ? (
                      <>
                        <GroupBadge group={pr.off.ps.activeGroup} size="sm" />
                        <span className="font-semibold truncate" style={{ color: '#FCA5A5' }}>
                          {pr.off.player.name}
                        </span>
                      </>
                    ) : (
                      <span className="opacity-50 italic text-xs">— pick someone off —</span>
                    )}
                  </div>
                  <ArrowRight size={14} className="opacity-40 flex-shrink-0" />
                  <div className="flex-1 flex items-center gap-1.5 min-w-0">
                    {pr.on ? (
                      <>
                        <GroupBadge group={pr.onGroup} size="sm" />
                        <span className="font-semibold truncate" style={{ color: '#86EFAC' }}>
                          {pr.on.player.name}
                        </span>
                      </>
                    ) : (
                      <span className="opacity-50 italic text-xs">— pick someone on —</span>
                    )}
                  </div>
                  <div className="w-4 flex-shrink-0">
                    {pr.off && pr.on && (
                      pr.match
                        ? <Check size={16} style={{ color: '#10B981' }} strokeWidth={3} />
                        : <AlertTriangle size={16} style={{ color: '#F59E0B' }} strokeWidth={2.5} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!compositionCheck.valid && (comingOffIds.length + comingOnIds.length) > 0 && (
            <div
              className="text-xs rounded p-2 mb-2 flex items-start gap-2"
              style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)', color: '#FCD34D' }}
            >
              <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
              <span>{compositionCheck.message}</span>
            </div>
          )}

          <button
            onClick={confirmSubs}
            disabled={!canConfirm}
            className={`tap-target w-full rounded-lg font-bold text-lg active:scale-95 transition ${canConfirm ? 'pulse-ready' : 'cursor-not-allowed'}`}
            style={{
              background: canConfirm ? PURPLE : '#3F3F46',
              color:      canConfirm ? 'white' : '#71717A',
            }}
          >
            {!comingOffIds.length
              ? 'Pick players to sub'
              : `Confirm ${comingOffIds.length} sub${comingOffIds.length > 1 ? 's' : ''}`}
          </button>
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
        style={{ background: '#F5F3F0', borderTop: '1px solid #D6D3D1' }}
      >
        <button
          onClick={handleUndoPress}
          disabled={!store.events.length}
          className="tap-target px-4 rounded-lg border-2 font-semibold flex items-center gap-2 disabled:opacity-40 active:scale-95 transition"
          style={{ borderColor: '#D6D3D1', color: INK }}
        >
          <Undo2 size={18} strokeWidth={2.5} />
          Undo
        </button>
        {!subBuilderOpen && (
          <button
            onClick={openSubBuilder}
            className="tap-target flex-1 rounded-lg font-bold text-lg active:scale-95 transition"
            style={{ background: PURPLE, color: 'white' }}
          >
            Build subs
          </button>
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
                    showToast(`Try — ${p.name}`)
                    setTryPickerOpen(false)
                  }}
                  className="tap-target w-full flex items-center gap-3 px-3 bg-white rounded-lg border active:scale-[0.98] transition"
                  style={{ borderColor: '#E7E5E4' }}
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
                }}
                className="tap-target w-full px-3 italic active:scale-[0.98] transition opacity-70"
              >
                Unattributed / decide later
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
