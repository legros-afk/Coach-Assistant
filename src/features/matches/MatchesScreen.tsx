import { useEffect, useState } from 'react'
import { Calendar, CalendarPlus, ChevronRight, Link2, Play, Plus, RotateCcw, Settings } from 'lucide-react'
import { WoodfordMark } from '@/components/WoodfordMark'
import type { Fixture, Match, TeamSheet } from '@/lib/events/types'
import { db } from '@/lib/db/db'
import { useFixtureStore } from '@/features/fixture/useFixtureStore'
import { DEMO_SQUAD_ID, useSquadStore } from '@/features/squad/useSquadStore'
import { useMatchStore } from '@/features/match/useMatchStore'
import { useSyncStore, syncStatusText } from '@/lib/drive/useSyncStore'
import { clubPinConfigured } from '@/lib/drive/driveRead'
import SpondSheet from '@/features/spond/SpondSheet'
import { spondConfigured, getSpondCreds, extractOpponent } from '@/lib/spond/spondStore'
import { spondGetEvents, type SpondEvent } from '@/lib/spond/spondApi'
import { ensureToken, createSpondEventForFixture } from '@/lib/spond/spondSync'
import { getDefaultFormat } from '@/lib/prefs'

const PURPLE      = '#3D0066'
const PURPLE_DARK = '#5B1A99'
const INK         = '#1A1A1A'
const MUTED       = '#6B5B7B'
const BORDER      = '#E4D0F5'

// "Sat 4 Oct" — how coaches talk about match days
const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}
const isoPlusDays = (iso: string, days: number) => {
  const [y, m, d] = iso.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + days))
  return t.toISOString().slice(0, 10)
}
// Same notion of "today" as the rest of the app
const todayIso = () => new Date().toISOString().slice(0, 10)

const hasEnded = (m?: Match) => !!m?.events.some(e => e.type === 'MATCH_END')
const score = (m: Match) => ({
  us: m.events.filter(e => e.type === 'TRY_US').length,
  them: m.events.filter(e => e.type === 'TRY_THEM').length,
})

interface Props {
  onStart: (fixture: Fixture, teamSheet: TeamSheet) => void
  onResume: () => void
  onOpenFixture: (fixture: Fixture) => void
  onNew: (playersPerSide: number) => void
  onViewMatch: (match: Match, teamSheet: TeamSheet) => void
  onImportSpond: (spondEventId: string, opponent: string, date: string, pps: number) => void
  onOpenSettings: () => void
  onDemo: () => void
}

// Every fixture moves Pick → Play → Share; its card always offers the next
// step as the one obvious button.
export default function MatchesScreen({
  onStart, onResume, onOpenFixture, onNew, onViewMatch, onImportSpond, onOpenSettings, onDemo,
}: Props) {
  const { fixtures, isHydrated, hydrate, saveFixture } = useFixtureStore()
  const { squad, isHydrated: squadReady, hydrate: hydrateSquad } = useSquadStore()
  const sync = useSyncStore()
  const canEdit = clubPinConfigured()
  const defaultFormat = getDefaultFormat()

  const active = {
    id: useMatchStore(s => s.matchId),
    events: useMatchStore(s => s.events),
    opponent: useMatchStore(s => s.opponent),
    label: useMatchStore(s => s.teamSheet.label),
    half: useMatchStore(s => s.matchState.half),
  }
  const hasActive = active.id !== null && active.events.length > 0 && !active.events.some(e => e.type === 'MATCH_END')

  const [matchMap, setMatchMap] = useState<Map<string, Match>>(new Map())
  useEffect(() => { if (!isHydrated) hydrate() }, [isHydrated, hydrate])
  useEffect(() => { if (!squadReady) hydrateSquad() }, [squadReady, hydrateSquad])
  useEffect(() => {
    db.matches.toArray().then(all => setMatchMap(new Map(all.map(m => [m.id, m]))))
  }, [isHydrated, fixtures])

  // ── Spond (organisers only)
  const isSpondLinked = spondConfigured()
  const [showSpondSheet, setShowSpondSheet] = useState(false)
  const [spondEvents, setSpondEvents] = useState<SpondEvent[]>([])
  const [spondError, setSpondError] = useState('')
  const [pushingId, setPushingId] = useState<string | null>(null)

  const loadSpondEvents = async () => {
    if (!spondConfigured()) return
    setSpondError('')
    try {
      const token = await ensureToken()
      const { groupId } = getSpondCreds()
      if (!groupId) return
      setSpondEvents(await spondGetEvents(token, groupId))
    } catch (e) {
      const msg = (e instanceof Error ? e.message : '').toLowerCase()
      setSpondError(msg.includes('401') || msg.includes('unauthorized') || msg.includes('credentials')
        ? 'Spond needs you to sign in again — tap here'
        : 'Couldn’t reach Spond — tap to try again')
    }
  }
  useEffect(() => { if (canEdit) void loadSpondEvents() }, [canEdit])

  const pushToSpond = async (fixture: Fixture) => {
    setPushingId(fixture.id)
    try {
      const eventId = await createSpondEventForFixture(fixture)
      await saveFixture({ ...fixture, spondEventId: eventId, version: fixture.version + 1, updatedAt: new Date().toISOString() })
    } catch {
      setSpondError('Couldn’t add it to Spond — tap to try again')
    } finally {
      setPushingId(null)
    }
  }

  // ── grouping by time
  const today = todayIso()
  const weekEnd = isoPlusDays(today, 6)
  const thisWeek = fixtures.filter(f => f.date >= today && f.date <= weekEnd)
  const later    = fixtures.filter(f => f.date > weekEnd)
  const played   = fixtures.filter(f => f.date < today).reverse()
  const [showPlayed, setShowPlayed] = useState(false)

  const importedSpondIds = new Set(fixtures.filter(f => f.spondEventId).map(f => f.spondEventId!))
  const spondToAdd = canEdit ? spondEvents.filter(ev => !importedSpondIds.has(ev.id)) : []

  const showDemo = squadReady && (!squad || squad.players.length === 0 || squad.id === DEMO_SQUAD_ID)

  // ── one fixture card
  const card = (f: Fixture) => {
    const sheets = f.teamSheets
    const canStartToday = f.date <= today
    const statusLine = sheets.length === 0
      ? 'Teams not picked yet'
      : sheets.every(ts => hasEnded(matchMap.get(ts.id)))
        ? 'Played'
        : sheets.length === 1 ? 'Team picked' : `${sheets.length} teams picked`

    return (
      <div key={f.id} className="rounded-xl bg-white overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
        <button
          onClick={() => onOpenFixture(f)}
          className="w-full px-3 pt-3 pb-2 flex items-center gap-2 text-left active:bg-stone-50 transition"
        >
          <div className="flex-1 min-w-0">
            <div className="font-bold text-[16px] truncate" style={{ color: INK }}>vs {f.opponent}</div>
            <div className="text-[13px]" style={{ color: MUTED }}>
              {fmtDate(f.date)} · {f.playersPerSide ?? 12}-a-side · {statusLine}
            </div>
          </div>
          <ChevronRight size={18} className="text-stone-300 flex-shrink-0" />
        </button>

        <div className="px-3 pb-3 flex flex-wrap gap-2">
          {sheets.length === 0 ? (
            canEdit ? (
              <button
                onClick={() => onOpenFixture(f)}
                className="h-11 px-4 rounded-lg font-bold text-sm active:scale-95 transition"
                style={{ background: PURPLE, color: 'white' }}
              >
                Pick teams
              </button>
            ) : (
              <span className="text-sm" style={{ color: MUTED }}>Your head coach will pick the teams.</span>
            )
          ) : sheets.map(ts => {
            const m = matchMap.get(ts.id)
            const label = sheets.length > 1 ? ` Team ${ts.label}` : ''
            if (hasEnded(m)) {
              const s = score(m!)
              const bg = s.us > s.them ? '#059669' : s.us < s.them ? '#DC2626' : '#D97706'
              return (
                <button
                  key={ts.id}
                  onClick={() => onViewMatch(m!, ts)}
                  className="h-11 px-3 rounded-lg font-bold text-sm text-white active:scale-95 transition"
                  style={{ background: bg }}
                >
                  {sheets.length > 1 ? `${ts.label} ` : ''}{s.us}–{s.them} · Result
                </button>
              )
            }
            if (m && m.events.length > 0) {
              return (
                <button
                  key={ts.id}
                  onClick={() => onStart(f, ts)}
                  className="h-11 px-4 rounded-lg font-bold text-sm flex items-center gap-1.5 active:scale-95 transition"
                  style={{ background: PURPLE, color: 'white' }}
                >
                  <RotateCcw size={14} strokeWidth={2.5} /> Resume{label}
                </button>
              )
            }
            return canStartToday ? (
              <button
                key={ts.id}
                onClick={() => onStart(f, ts)}
                className="h-11 px-4 rounded-lg font-bold text-sm flex items-center gap-1.5 active:scale-95 transition"
                style={{ background: PURPLE, color: 'white' }}
              >
                <Play size={14} strokeWidth={2.5} /> Start{label}
              </button>
            ) : null
          })}

          {canEdit && isSpondLinked && f.date >= today && !f.spondEventId && (
            <button
              onClick={() => pushToSpond(f)}
              disabled={pushingId !== null}
              className="h-11 px-3 rounded-lg text-sm font-semibold flex items-center gap-1.5 active:scale-95 transition disabled:opacity-40"
              style={{ background: '#F4E8F5', color: PURPLE }}
            >
              <CalendarPlus size={14} strokeWidth={2.5} />
              {pushingId === f.id ? 'Adding…' : 'Add to Spond'}
            </button>
          )}
        </div>
      </div>
    )
  }

  const heading = (text: string) => (
    <h2 className="text-sm font-bold uppercase tracking-wide mt-5 mb-2 px-1" style={{ color: PURPLE_DARK }}>{text}</h2>
  )

  return (
    <div className="min-h-screen pb-28" style={{ background: '#F8F4FF', color: INK }}>
      {/* Header */}
      <div className="sticky top-0 z-20" style={{ background: PURPLE }}>
        <div className="px-3 py-2.5 flex items-center gap-2" style={{ borderBottom: `1px solid ${PURPLE_DARK}` }}>
          <WoodfordMark size={24} color="white" />
          <div className="flex-1 leading-tight min-w-0">
            <div className="text-[17px] font-bold text-white">Matches</div>
            <div className="text-xs text-white/75 truncate">{syncStatusText(sync)}</div>
          </div>
          {canEdit && (
            <button
              onClick={() => setShowSpondSheet(true)}
              className="h-10 px-3 flex items-center gap-1.5 rounded-lg active:scale-95 transition text-sm font-bold text-white"
              style={{ background: isSpondLinked ? 'rgba(74,222,128,0.25)' : 'rgba(255,255,255,0.15)' }}
            >
              <Link2 size={15} color={isSpondLinked ? '#4ade80' : 'white'} strokeWidth={2.5} />
              Spond
            </button>
          )}
          <button
            onClick={onOpenSettings}
            className="h-10 px-3 flex items-center gap-1.5 rounded-lg active:scale-95 transition text-sm font-bold text-white"
            style={{ background: 'rgba(255,255,255,0.15)' }}
          >
            <Settings size={16} strokeWidth={2.5} />
            Settings
          </button>
        </div>
      </div>

      <div className="px-3 pt-1">
        {/* In progress */}
        {hasActive && (
          <>
            {heading('In progress')}
            <button
              onClick={onResume}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left active:scale-[0.99] transition"
              style={{ background: '#FDF4FF', border: `2px solid ${PURPLE}` }}
            >
              <div className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: PURPLE }}>
                <RotateCcw size={18} color="white" strokeWidth={2.5} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-[16px]" style={{ color: PURPLE }}>Back to the match</div>
                <div className="text-[13px]" style={{ color: MUTED }}>
                  vs {active.opponent} · Team {active.label} · {active.half === 2 ? 'second half' : 'first half'}
                </div>
              </div>
              <ChevronRight size={18} style={{ color: PURPLE }} />
            </button>
          </>
        )}

        {!isHydrated ? (
          <div className="py-12 text-center text-stone-400 text-sm">Loading…</div>
        ) : fixtures.length === 0 ? (
          <div className="py-12 flex flex-col items-center gap-4 text-center">
            <Calendar size={40} className="text-stone-300" strokeWidth={1.5} />
            <div>
              <div className="font-bold text-stone-600 mb-1">No matches yet</div>
              <div className="text-sm text-stone-500">
                {canEdit ? 'Add your first fixture to start picking teams.' : 'Your head coach adds the fixtures — they’ll appear here.'}
              </div>
            </div>
            {canEdit && (
              <button
                onClick={() => onNew(defaultFormat)}
                className="h-12 px-5 rounded-lg font-bold text-sm flex items-center gap-2 active:scale-95 transition"
                style={{ background: PURPLE, color: 'white' }}
              >
                <Plus size={16} strokeWidth={2.5} /> Add a fixture
              </button>
            )}
          </div>
        ) : (
          <>
            {heading('This week')}
            {thisWeek.length > 0
              ? <div className="space-y-2">{thisWeek.map(card)}</div>
              : <div className="text-sm px-1" style={{ color: MUTED }}>Nothing this week.</div>}

            {later.length > 0 && (
              <>
                {heading('Coming up')}
                <div className="space-y-2">{later.map(card)}</div>
              </>
            )}

            {played.length > 0 && (
              <>
                <button
                  onClick={() => setShowPlayed(v => !v)}
                  className="w-full flex items-center gap-2 mt-5 mb-2 px-1 h-10"
                >
                  <ChevronRight size={16} strokeWidth={2.5} className="transition-transform"
                    style={{ color: PURPLE_DARK, transform: showPlayed ? 'rotate(90deg)' : 'none' }} />
                  <span className="text-sm font-bold uppercase tracking-wide" style={{ color: PURPLE_DARK }}>
                    Played ({played.length})
                  </span>
                </button>
                {showPlayed && <div className="space-y-2">{played.map(card)}</div>}
              </>
            )}
          </>
        )}

        {/* Spond events not yet in the app — organisers only */}
        {canEdit && isSpondLinked && (spondToAdd.length > 0 || spondError) && (
          <>
            {heading('In Spond, not here yet')}
            {spondError ? (
              <button
                onClick={() => { setShowSpondSheet(true) }}
                className="w-full px-3 py-3 rounded-xl text-left text-sm font-semibold"
                style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B42318' }}
              >
                {spondError}
              </button>
            ) : (
              <div className="space-y-2">
                {spondToAdd.map(ev => {
                  const opponent = extractOpponent(ev.heading)
                  const date = ev.startTimestamp.slice(0, 10)
                  const yes = ev.responses.acceptedIds.length
                  return (
                    <div key={ev.id} className="flex items-center gap-3 px-3 py-3 rounded-xl"
                      style={{ border: `1px dashed ${BORDER}`, background: 'rgba(255,255,255,0.6)' }}>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-[15px]" style={{ color: INK }}>vs {opponent}</div>
                        <div className="text-[13px]" style={{ color: MUTED }}>
                          {fmtDate(date)}{yes > 0 ? ` · ${yes} coming` : ''}
                        </div>
                      </div>
                      <button
                        onClick={() => onImportSpond(ev.id, opponent, date, defaultFormat)}
                        className="h-11 px-4 rounded-lg text-sm font-bold active:scale-95 transition"
                        style={{ background: PURPLE, color: 'white' }}
                      >
                        Add
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* Demo — only while there's no real squad */}
        {showDemo && (
          <>
            {heading('Try it out')}
            <button
              onClick={onDemo}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl bg-white text-left active:scale-[0.99] transition"
              style={{ border: `1px solid ${BORDER}` }}
            >
              <div className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#F4E8F5' }}>
                <Play size={18} color={PURPLE} strokeWidth={2.5} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-[15px]" style={{ color: INK }}>Practice match</div>
                <div className="text-[13px]" style={{ color: MUTED }}>Have a go with a made-up squad</div>
              </div>
              <ChevronRight size={18} className="text-stone-300" />
            </button>
          </>
        )}
      </div>

      {canEdit && fixtures.length > 0 && (
        <div className="fixed bottom-20 right-4 z-20">
          <button
            onClick={() => onNew(defaultFormat)}
            className="h-14 pl-4 pr-5 rounded-full shadow-lg flex items-center gap-2 font-bold active:scale-95 transition"
            style={{ background: PURPLE, color: 'white' }}
          >
            <Plus size={22} strokeWidth={2.5} /> Fixture
          </button>
        </div>
      )}

      {showSpondSheet && (
        <SpondSheet
          onClose={() => { setShowSpondSheet(false); void loadSpondEvents() }}
          onConnected={loadSpondEvents}
        />
      )}
    </div>
  )
}
