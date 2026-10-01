import { useEffect, useState } from 'react'
import { CalendarPlus, ChevronRight, Link2, Play, Plus, RotateCcw, Settings } from 'lucide-react'
import { TopAppBar, BarButton } from '@/ui/TopAppBar'
import { Button } from '@/ui/Button'
import { Card, SectionTitle } from '@/ui/Card'
import { Fab } from '@/ui/Fab'
import { WoodfordMark } from '@/components/WoodfordMark'
import type { Fixture, Match, TeamSheet } from '@/lib/events/types'
import { db } from '@/lib/db/db'
import { useFixtureStore } from '@/features/fixture/useFixtureStore'
import { DEMO_SQUAD_ID, useSquadStore } from '@/features/squad/useSquadStore'
import { useMatchStore } from '@/features/match/useMatchStore'
import { useSyncStore, syncStatusText } from '@/lib/drive/useSyncStore'
import { clubPinConfigured } from '@/lib/drive/driveRead'
import SpondSheet from '@/features/spond/SpondSheet'
import { spondConfigured } from '@/lib/spond/spondStore'
import { createSpondEventForFixture } from '@/lib/spond/spondSync'
import { getDefaultFormat } from '@/lib/prefs'


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
  onStart, onResume, onOpenFixture, onNew, onViewMatch, onOpenSettings, onDemo,
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
  const [pushingId, setPushingId] = useState<string | null>(null)

  // Spond matches arrive by themselves with each update; after connecting
  // Spond, update straight away so they appear
  const loadSpondEvents = () => { void useSyncStore.getState().syncAll() }

  const pushToSpond = async (fixture: Fixture) => {
    setPushingId(fixture.id)
    try {
      const eventId = await createSpondEventForFixture(fixture)
      await saveFixture({ ...fixture, spondEventId: eventId, version: fixture.version + 1, updatedAt: new Date().toISOString() })
    } catch {
      // Stays un-linked; the button remains for another try
    } finally {
      setPushingId(null)
    }
  }

  // ── grouping by time
  const today = todayIso()
  const weekEnd = isoPlusDays(today, 6)
  // Cancelled (or no longer in Spond) fixtures stay stored but aren't shown,
  // unless a match was actually played for them
  const visible  = fixtures.filter(f => !f.cancelled || f.teamSheets.some(ts => matchMap.get(ts.id)?.events.length))
  const thisWeek = visible.filter(f => f.date >= today && f.date <= weekEnd)
  const later    = visible.filter(f => f.date > weekEnd)
  const played   = visible.filter(f => f.date < today).reverse()
  // Remember whether Played was open, so coming back from a result keeps it open
  const [showPlayed, setShowPlayedState] = useState(() => sessionStorage.getItem('coach-show-played') === '1')
  const setShowPlayed = (f: (v: boolean) => boolean) => setShowPlayedState(v => {
    const next = f(v)
    try { sessionStorage.setItem('coach-show-played', next ? '1' : '0') } catch { /* ignore */ }
    return next
  })


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
      <Card key={f.id} className="overflow-hidden">
        <button
          onClick={() => onOpenFixture(f)}
          className="w-full px-4 pt-4 pb-2 flex items-center gap-2 text-left active:bg-m-surface-container-high transition-colors"
        >
          <div className="flex-1 min-w-0">
            <div className="text-lg font-semibold truncate text-m-on-surface">vs {f.opponent}</div>
            <div className="text-sm text-m-on-surface-variant">
              {fmtDate(f.date)} · {f.playersPerSide ?? 12}-a-side · {statusLine}
            </div>
          </div>
          <ChevronRight size={20} className="text-m-outline flex-shrink-0" />
        </button>

        <div className="px-4 pb-4 pt-1 flex flex-wrap gap-2">
          {sheets.length === 0 ? (
            canEdit ? (
              <Button onClick={() => onOpenFixture(f)}>Pick teams</Button>
            ) : (
              <span className="text-sm text-m-on-surface-variant">Your head coach will pick the teams.</span>
            )
          ) : sheets.map(ts => {
            const m = matchMap.get(ts.id)
            const label = sheets.length > 1 ? ` Team ${ts.label}` : ''
            if (hasEnded(m)) {
              const sc = score(m!)
              const tone = sc.us > sc.them ? 'bg-x-win' : sc.us < sc.them ? 'bg-x-loss' : 'bg-x-draw'
              return (
                <button
                  key={ts.id}
                  onClick={() => onViewMatch(m!, ts)}
                  className={`m-press h-12 px-5 rounded-full font-semibold text-base text-white mono ${tone}`}
                >
                  {sheets.length > 1 ? `${ts.label} ` : ''}{sc.us}–{sc.them} · Result
                </button>
              )
            }
            if (m && m.events.length > 0) {
              return (
                <Button key={ts.id} onClick={() => onStart(f, ts)} icon={<RotateCcw size={18} strokeWidth={2.25} />}>
                  Resume{label}
                </Button>
              )
            }
            return canStartToday ? (
              <Button key={ts.id} onClick={() => onStart(f, ts)} icon={<Play size={18} strokeWidth={2.25} />}>
                Start{label}
              </Button>
            ) : null
          })}

          {sheets.length > 0 && !canStartToday && (
            <span className="w-full text-sm text-m-on-surface-variant">
              The Start button appears here on match day.
            </span>
          )}

          {canEdit && isSpondLinked && f.date >= today && !f.spondEventId && (
            <Button
              variant="tonal"
              onClick={() => pushToSpond(f)}
              disabled={pushingId !== null}
              icon={<CalendarPlus size={18} strokeWidth={2.25} />}
            >
              {pushingId === f.id ? 'Adding…' : 'Add to Spond'}
            </Button>
          )}
        </div>
      </Card>
    )
  }

  return (
    <div className="min-h-screen pb-32 bg-m-surface text-m-on-surface">
      <TopAppBar
        title="Matches"
        subtitle={syncStatusText(sync)}
        leading={<WoodfordMark size={32} />}
        actions={<>
          {canEdit && (
            <BarButton
              icon={<Link2 size={16} strokeWidth={2.5} style={isSpondLinked ? { color: 'var(--x-on-brand-good)' } : undefined} />}
              label="Spond"
              onClick={() => setShowSpondSheet(true)}
            />
          )}
          <BarButton icon={<Settings size={16} strokeWidth={2.5} />} label="Settings" onClick={onOpenSettings} />
        </>}
      />

      <div className="px-4">
        {/* In progress */}
        {hasActive && (
          <>
            <SectionTitle>In progress</SectionTitle>
            <button
              onClick={onResume}
              className="m-press w-full flex items-center gap-3 p-4 rounded-m-xl text-left bg-m-primary-container text-m-on-primary-container pop-in"
            >
              <div className="w-12 h-12 rounded-m-lg flex items-center justify-center flex-shrink-0 bg-m-primary text-m-on-primary">
                <RotateCcw size={22} strokeWidth={2.25} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-lg emphasized">Back to the match</div>
                <div className="text-sm opacity-80">
                  vs {active.opponent} · Team {active.label} · {active.half === 2 ? 'second half' : 'first half'}
                </div>
              </div>
              <ChevronRight size={22} />
            </button>
          </>
        )}

        {!isHydrated ? (
          <div className="py-12 text-center text-m-on-surface-variant text-sm">Loading…</div>
        ) : fixtures.length === 0 ? (
          <div className="py-12 flex flex-col items-center gap-4 text-center">
            <WoodfordMark size={80} />
            <div>
              <div className="text-xl emphasized mb-1 text-m-on-surface">No matches yet</div>
              <div className="text-base text-m-on-surface-variant">
                {canEdit ? 'Add your first fixture to start picking teams.' : 'Your head coach adds the fixtures — they’ll appear here.'}
              </div>
            </div>
            {canEdit && (
              <Button size="lg" onClick={() => onNew(defaultFormat)} icon={<Plus size={20} strokeWidth={2.5} />}>
                Add a fixture
              </Button>
            )}
          </div>
        ) : (
          <>
            <SectionTitle>This week</SectionTitle>
            {thisWeek.length > 0
              ? <div className="space-y-3">{thisWeek.map(card)}</div>
              : <div className="text-base px-1 text-m-on-surface-variant">Nothing this week.</div>}

            {later.length > 0 && (
              <>
                <SectionTitle>Coming up</SectionTitle>
                <div className="space-y-3">{later.map(card)}</div>
              </>
            )}

            {played.length > 0 && (
              <>
                <button
                  onClick={() => setShowPlayed(v => !v)}
                  aria-expanded={showPlayed}
                  className="w-full flex items-center gap-2 mt-6 mb-2 px-1 h-10"
                >
                  <ChevronRight size={18} strokeWidth={2.5} className="transition-transform duration-300 ease-spring text-m-on-surface-variant"
                    style={{ transform: showPlayed ? 'rotate(90deg)' : 'none' }} />
                  <span className="text-sm font-semibold text-m-on-surface-variant">Played ({played.length})</span>
                </button>
                {showPlayed && <div className="space-y-3">{played.map(card)}</div>}
              </>
            )}
          </>
        )}

        {/* Demo — only while there's no real squad */}
        {showDemo && (
          <>
            <SectionTitle>Try it out</SectionTitle>
            <button
              onClick={onDemo}
              className="m-press w-full flex items-center gap-3 p-4 rounded-m-lg bg-m-surface-container text-left"
            >
              <div className="w-12 h-12 rounded-m-lg flex items-center justify-center flex-shrink-0 bg-m-tertiary-container text-m-on-tertiary-container">
                <Play size={22} strokeWidth={2.25} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-base font-semibold text-m-on-surface">Practice match</div>
                <div className="text-sm text-m-on-surface-variant">Have a go with a made-up squad</div>
              </div>
              <ChevronRight size={20} className="text-m-outline" />
            </button>
          </>
        )}
      </div>

      {canEdit && fixtures.length > 0 && (
        <Fab icon={<Plus size={22} strokeWidth={2.5} />} label="Fixture" onClick={() => onNew(defaultFormat)} />
      )}

      {showSpondSheet && (
        <SpondSheet
          onClose={() => { setShowSpondSheet(false); loadSpondEvents() }}
          onConnected={loadSpondEvents}
        />
      )}
    </div>
  )
}
