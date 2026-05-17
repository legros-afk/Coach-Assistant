import { useEffect, useState } from 'react'
import { Calendar, ChevronRight, Link2, Plus, RefreshCw } from 'lucide-react'
import { WoodfordMark } from '@/components/WoodfordMark'
import type { Fixture, Match, TeamSheet } from '@/lib/events/types'
import { db } from '@/lib/db/db'
import { useFixtureStore } from './useFixtureStore'
import { useSyncStore, fmtSyncAge, driveConfigured } from '@/lib/drive/useSyncStore'
import SpondSheet from '@/features/spond/SpondSheet'
import { spondConfigured, getSpondCreds, extractOpponent } from '@/lib/spond/spondStore'
import { spondGetEvents, type SpondEvent } from '@/lib/spond/spondApi'
import { ensureToken } from '@/lib/spond/spondSync'

const PURPLE      = '#3D0066'
const PURPLE_DARK = '#5B1A99'
const INK         = '#1A1A1A'

const PPS_KEY = 'coach-players-per-side'

interface Props {
  onNew: (playersPerSide: number) => void
  onEdit: (fixture: Fixture) => void
  onViewMatch: (match: Match, teamSheet: TeamSheet) => void
  onImportSpond: (spondEventId: string, opponent: string, date: string, pps: number) => void
}

export default function FixtureListScreen({ onNew, onEdit, onViewMatch, onImportSpond }: Props) {
  const { fixtures, isHydrated, hydrate } = useFixtureStore()
  const { isSyncing, lastSyncedAt, syncAll } = useSyncStore()
  const hasDrive = driveConfigured()
  const [matchMap, setMatchMap] = useState<Map<string, Match>>(new Map())
  const [playersPerSide, setPlayersPerSideState] = useState<number>(() => {
    const stored = localStorage.getItem(PPS_KEY)
    return stored ? parseInt(stored, 10) : 12
  })

  const [showSpondSheet, setShowSpondSheet]   = useState(false)
  const [spondEvents,    setSpondEvents]       = useState<SpondEvent[]>([])
  const [spondLoading,   setSpondLoading]      = useState(false)

  const setPlayersPerSide = (n: number) => {
    const clamped = Math.min(12, Math.max(1, n))
    localStorage.setItem(PPS_KEY, String(clamped))
    setPlayersPerSideState(clamped)
  }

  useEffect(() => { if (!isHydrated) hydrate() }, [isHydrated, hydrate])

  useEffect(() => {
    db.matches.toArray().then(all => setMatchMap(new Map(all.map(m => [m.id, m]))))
  }, [isHydrated])

  const loadSpondEvents = async () => {
    if (!spondConfigured()) return
    setSpondLoading(true)
    try {
      const token = await ensureToken()
      const { groupId } = getSpondCreds()
      if (!groupId) return
      const events = await spondGetEvents(token, groupId)
      setSpondEvents(events)
    } catch {
      // token expired or network error — silently ignore; user can reconnect
    } finally {
      setSpondLoading(false)
    }
  }

  useEffect(() => { loadSpondEvents() }, [])

  const importedSpondIds = new Set(fixtures.filter(f => f.spondEventId).map(f => f.spondEventId!))
  const isSpondLinked = spondConfigured()

  const fmtEventDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })

  return (
    <div className="min-h-screen pb-24" style={{ background: '#F8F4FF', color: INK }}>
      <div className="sticky top-0 z-20" style={{ background: PURPLE }}>
        <div className="px-3 py-2 flex items-center gap-2" style={{ borderBottom: `1px solid ${PURPLE_DARK}` }}>
          <Calendar size={18} color="white" strokeWidth={2} />
          <div className="flex-1 leading-tight">
            <div className="text-[13px] font-bold tracking-wide uppercase text-white">Fixtures</div>
            <div className="text-[10px] text-white/70">
              {isSyncing
                ? 'Syncing…'
                : isHydrated
                  ? `${fixtures.length} fixture${fixtures.length !== 1 ? 's' : ''}${lastSyncedAt ? ` · ${fmtSyncAge(lastSyncedAt)}` : ''}`
                  : '…'}
            </div>
          </div>
          {hasDrive && (
            <button
              onClick={syncAll}
              disabled={isSyncing}
              className="tap-target w-8 h-8 flex items-center justify-center rounded-lg active:scale-95 transition disabled:opacity-50"
              style={{ background: 'rgba(255,255,255,0.15)' }}
              aria-label="Sync fixtures from Drive"
            >
              <RefreshCw size={15} color="white" strokeWidth={2} className={isSyncing ? 'animate-spin' : ''} />
            </button>
          )}
          {/* Spond button — green tint when connected */}
          <button
            onClick={() => setShowSpondSheet(true)}
            className="tap-target w-8 h-8 flex items-center justify-center rounded-lg active:scale-95 transition"
            style={{ background: isSpondLinked ? 'rgba(74,222,128,0.25)' : 'rgba(255,255,255,0.15)' }}
            aria-label="Spond settings"
          >
            <Link2 size={15} color={isSpondLinked ? '#4ade80' : 'rgba(255,255,255,0.6)'} strokeWidth={2} />
          </button>
          <WoodfordMark size={22} color="white" />
        </div>

        {/* Players per side */}
        <div className="px-3 py-2 flex items-center justify-between" style={{ background: INK }}>
          <span className="text-[11px] font-semibold uppercase tracking-widest text-white/60">Players per side</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPlayersPerSide(playersPerSide - 1)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-base font-bold active:scale-95 transition"
              style={{ background: 'rgba(255,255,255,0.12)', color: 'white' }}
            >−</button>
            <span className="w-5 text-center text-sm font-bold text-white">{playersPerSide}</span>
            <button
              onClick={() => setPlayersPerSide(playersPerSide + 1)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-base font-bold active:scale-95 transition"
              style={{ background: 'rgba(255,255,255,0.12)', color: 'white' }}
            >+</button>
          </div>
        </div>
      </div>

      <div className="px-3 pt-3">
        {!isHydrated ? (
          <div className="py-12 text-center text-stone-400 text-sm">Loading…</div>
        ) : fixtures.length === 0 ? (
          <div className="py-12 flex flex-col items-center gap-4">
            <Calendar size={40} className="text-stone-300" strokeWidth={1.5} />
            <div className="text-center">
              <div className="font-bold text-stone-500 mb-1">No fixtures yet</div>
              <div className="text-sm text-stone-400">Create a fixture to start building team sheets.</div>
            </div>
            <button
              onClick={() => onNew(playersPerSide)}
              className="tap-target px-5 rounded-lg font-bold text-sm flex items-center gap-2 active:scale-95 transition"
              style={{ background: PURPLE, color: 'white', minHeight: '48px' }}
            >
              <Plus size={16} strokeWidth={2.5} /> Create first fixture
            </button>
          </div>
        ) : (
          <div className="space-y-1.5">
            {fixtures.map(f => {
              const playedSheets = f.teamSheets.filter(ts => matchMap.has(ts.id))
              return (
                <button
                  key={f.id}
                  onClick={() => onEdit(f)}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-lg bg-white border active:scale-[0.99] transition text-left"
                  style={{ borderColor: '#E4D0F5' }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm" style={{ color: INK }}>vs {f.opponent}</div>
                    <div className="text-xs text-stone-400">{f.date} · {f.teamSheets.length} team sheet{f.teamSheets.length !== 1 ? 's' : ''}</div>
                  </div>
                  {playedSheets.length > 0 && (
                    <div className="flex gap-1 items-center flex-shrink-0" onClick={e => e.stopPropagation()}>
                      {playedSheets.map(ts => {
                        const match = matchMap.get(ts.id)!
                        const scoreUs = match.events.filter(e => e.type === 'TRY_US').length
                        const scoreThem = match.events.filter(e => e.type === 'TRY_THEM').length
                        const result = scoreUs > scoreThem ? 'W' : scoreUs < scoreThem ? 'L' : 'D'
                        const bg = result === 'W' ? '#059669' : result === 'L' ? '#DC2626' : '#D97706'
                        return (
                          <button
                            key={ts.id}
                            onClick={() => onViewMatch(match, ts)}
                            className="px-2 py-1 rounded text-[11px] font-bold text-white active:scale-95 transition"
                            style={{ background: bg }}
                          >
                            {ts.label} {scoreUs}–{scoreThem}
                          </button>
                        )
                      })}
                    </div>
                  )}
                  <ChevronRight size={16} className="text-stone-300 flex-shrink-0" />
                </button>
              )
            })}
          </div>
        )}

        {/* ── Spond upcoming events */}
        {isSpondLinked && (
          <div className="mt-4">
            <div className="flex items-center justify-between px-1 mb-2">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">
                From Spond
              </span>
              {spondLoading && <RefreshCw size={12} className="text-stone-300 animate-spin" />}
            </div>
            {spondEvents.length === 0 && !spondLoading ? (
              <div className="py-4 text-center text-sm text-stone-400">No upcoming events</div>
            ) : (
              <div className="space-y-1.5">
                {spondEvents.map(ev => {
                  const opponent = extractOpponent(ev.heading)
                  const date     = ev.startTimestamp.slice(0, 10)
                  const imported = importedSpondIds.has(ev.id)
                  return (
                    <div
                      key={ev.id}
                      className="w-full flex items-center gap-3 px-3 py-3 rounded-lg bg-white border"
                      style={{ borderColor: '#E4D0F5' }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm" style={{ color: INK }}>vs {opponent}</div>
                        <div className="text-xs text-stone-400">{fmtEventDate(ev.startTimestamp)}</div>
                      </div>
                      {imported ? (
                        <span className="text-[11px] font-semibold text-emerald-600 flex-shrink-0">✓ Imported</span>
                      ) : (
                        <button
                          onClick={() => onImportSpond(ev.id, opponent, date, playersPerSide)}
                          className="px-3 py-1.5 rounded-lg text-[11px] font-bold active:scale-95 transition flex-shrink-0"
                          style={{ background: PURPLE, color: 'white' }}
                        >
                          Import
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="fixed bottom-20 right-4 z-20">
        <button
          onClick={() => onNew(playersPerSide)}
          className="w-14 h-14 rounded-full shadow-lg flex items-center justify-center active:scale-95 transition"
          style={{ background: PURPLE, color: 'white' }}
        >
          <Plus size={26} strokeWidth={2.5} />
        </button>
      </div>

      {showSpondSheet && (
        <SpondSheet
          onClose={() => setShowSpondSheet(false)}
          onConnected={loadSpondEvents}
        />
      )}
    </div>
  )
}
