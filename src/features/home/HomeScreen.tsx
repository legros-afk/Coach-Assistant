import { useEffect } from 'react'
import { Calendar, ChevronRight, Play, RotateCcw } from 'lucide-react'
import { WoodfordMark } from '@/components/WoodfordMark'
import { useFixtureStore } from '@/features/fixture/useFixtureStore'
import { useSquadStore } from '@/features/squad/useSquadStore'
import { useMatchStore } from '@/features/match/useMatchStore'
import { DEMO_SQUAD } from '@/features/match/mockData'
import type { Fixture, TeamSheet } from '@/lib/events/types'

const PURPLE      = '#782880'
const PURPLE_DARK = '#5C1E63'
const INK         = '#201820'

interface Props {
  onMatch: () => void
  onFixturePrep: (fixture: Fixture) => void
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
  })
}

export default function HomeScreen({ onMatch, onFixturePrep }: Props) {
  const { fixtures, isHydrated: fixturesReady, hydrate: hydrateFixtures } = useFixtureStore()
  const { squad, isHydrated: squadReady, hydrate: hydrateSquad } = useSquadStore()
  const initMatch     = useMatchStore(s => s.initMatch)
  const initDemoMatch = useMatchStore(s => s.initDemoMatch)
  const activeMatchId = useMatchStore(s => s.matchId)
  const activeEvents  = useMatchStore(s => s.events)
  const activeOpponent = useMatchStore(s => s.opponent)
  const activeTeamSheet = useMatchStore(s => s.teamSheet)

  useEffect(() => {
    if (!fixturesReady) hydrateFixtures()
    if (!squadReady) hydrateSquad()
  }, [fixturesReady, squadReady, hydrateFixtures, hydrateSquad])

  const today   = todayStr()
  const players = squad?.players ?? DEMO_SQUAD

  const todayFixtures    = fixtures.filter(f => f.date === today)
  const upcomingFixtures = fixtures.filter(f => f.date > today).slice(0, 5)

  const hasActiveMatch = activeMatchId !== null && activeEvents.length > 0

  async function pickTeam(fixture: Fixture, teamSheet: TeamSheet) {
    await initMatch({ fixtureId: fixture.id, teamSheet, squad: players, opponent: fixture.opponent })
    onMatch()
  }

  async function pickDemo() {
    await initDemoMatch()
    onMatch()
  }

  return (
    <div className="min-h-screen pb-24" style={{ background: '#F5F3F0', color: INK }}>
      {/* Header */}
      <div className="sticky top-0 z-20" style={{ background: PURPLE }}>
        <div className="px-3 py-2 flex items-center gap-2" style={{ borderBottom: `1px solid ${PURPLE_DARK}` }}>
          <div className="flex-1 leading-tight">
            <div className="text-[13px] font-bold tracking-wide uppercase text-white">Woodford RFC</div>
            <div className="text-[10px] text-white/70">U12 · Coach Assistant</div>
          </div>
          <WoodfordMark size={22} color="white" />
        </div>
      </div>

      <div className="px-3 pt-4 space-y-5">
        {/* Resume active match */}
        {hasActiveMatch && (
          <section>
            <div className="text-[11px] font-bold uppercase tracking-widest text-stone-400 mb-2">In progress</div>
            <button
              onClick={onMatch}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-lg border active:scale-[0.99] transition text-left"
              style={{ background: '#FDF4FF', borderColor: PURPLE }}
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: PURPLE }}
              >
                <RotateCcw size={16} color="white" strokeWidth={2.5} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm" style={{ color: PURPLE }}>
                  Resume match
                </div>
                <div className="text-xs text-stone-400">
                  vs {activeOpponent} · Team {activeTeamSheet.label} · {activeEvents.length} event{activeEvents.length !== 1 ? 's' : ''}
                </div>
              </div>
              <ChevronRight size={16} strokeWidth={2} style={{ color: PURPLE, flexShrink: 0 }} />
            </button>
          </section>
        )}

        {!fixturesReady ? (
          <div className="py-8 text-center text-stone-400 text-sm">Loading…</div>
        ) : (
          <>
            {/* Today's fixtures */}
            {todayFixtures.length > 0 && (
              <section>
                <div className="text-[11px] font-bold uppercase tracking-widest text-stone-400 mb-2">Today</div>
                <div className="space-y-2">
                  {todayFixtures.map(f => (
                    <FixtureCard
                      key={f.id}
                      fixture={f}
                      onPickTeam={ts => pickTeam(f, ts)}
                      onPrep={() => onFixturePrep(f)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Upcoming fixtures */}
            {upcomingFixtures.length > 0 && (
              <section>
                <div className="text-[11px] font-bold uppercase tracking-widest text-stone-400 mb-2">
                  {todayFixtures.length === 0 ? 'Next up' : 'Upcoming'}
                </div>
                <div className="space-y-2">
                  {upcomingFixtures.map(f => (
                    <FixtureCard
                      key={f.id}
                      fixture={f}
                      onPickTeam={ts => pickTeam(f, ts)}
                      onPrep={() => onFixturePrep(f)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Empty state */}
            {todayFixtures.length === 0 && upcomingFixtures.length === 0 && !hasActiveMatch && (
              <div className="py-8 flex flex-col items-center gap-3 text-center">
                <Calendar size={36} className="text-stone-300" strokeWidth={1.5} />
                <div className="text-sm text-stone-500">
                  No upcoming fixtures.<br />Add them in the Fixtures tab.
                </div>
              </div>
            )}
          </>
        )}

        {/* Demo / practice */}
        <section>
          <div className="text-[11px] font-bold uppercase tracking-widest text-stone-400 mb-2">
            Practice / Demo
          </div>
          <button
            onClick={pickDemo}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-lg bg-white border active:scale-[0.99] transition text-left"
            style={{ borderColor: '#E7E5E4' }}
          >
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: '#F4E8F5' }}
            >
              <Play size={16} color={PURPLE} strokeWidth={2.5} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm" style={{ color: INK }}>Demo match</div>
              <div className="text-xs text-stone-400">Try the app with the demo squad</div>
            </div>
            <ChevronRight size={16} className="text-stone-300 flex-shrink-0" />
          </button>
        </section>
      </div>
    </div>
  )
}

function FixtureCard({
  fixture,
  onPickTeam,
  onPrep,
}: {
  fixture: Fixture
  onPickTeam: (ts: TeamSheet) => void
  onPrep: () => void
}) {
  const hasSheets = fixture.teamSheets.length > 0

  return (
    <div
      className="rounded-lg bg-white border overflow-hidden"
      style={{ borderColor: '#E7E5E4' }}
    >
      <div
        className="px-3 py-2 flex items-center gap-2"
        style={{ borderBottom: hasSheets ? '1px solid #F5F3F0' : undefined }}
      >
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm" style={{ color: INK }}>vs {fixture.opponent}</div>
          <div className="text-xs text-stone-400">{fmtDate(fixture.date)}</div>
        </div>
      </div>
      {hasSheets ? (
        <div className="px-3 py-2 flex gap-2 flex-wrap">
          {fixture.teamSheets.map(ts => (
            <button
              key={ts.id}
              onClick={() => onPickTeam(ts)}
              className="flex items-center gap-1.5 px-3 rounded-lg font-bold text-xs active:scale-95 transition"
              style={{ background: PURPLE, color: 'white', minHeight: '36px' }}
            >
              <Play size={11} strokeWidth={2.5} />
              Team {ts.label}
            </button>
          ))}
        </div>
      ) : (
        <button
          onClick={onPrep}
          className="w-full px-3 py-2 flex items-center gap-2 text-left active:bg-stone-50 transition"
        >
          <div className="text-xs text-stone-400 flex-1">No team sheets yet</div>
          <span className="text-xs font-semibold" style={{ color: PURPLE }}>Prep →</span>
        </button>
      )}
    </div>
  )
}
