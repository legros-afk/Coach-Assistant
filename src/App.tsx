import { useEffect, useState } from 'react'
import { useSquadStore } from '@/features/squad/useSquadStore'
import { useMatchStore } from '@/features/match/useMatchStore'
import type { Fixture, Match, TeamSheet } from '@/lib/events/types'
import { replayEvents } from '@/lib/events/replay'
import { CalendarDays, Users } from 'lucide-react'
import LiveMatch from '@/features/match/LiveMatch'
import PostMatchScreen, { type MatchViewData } from '@/features/match/PostMatchScreen'
import SetupScreen from '@/features/setup/SetupScreen'
import SquadScreen from '@/features/squad/SquadScreen'
import MatchesScreen from '@/features/matches/MatchesScreen'
import FixturePrepScreen from '@/features/fixture/FixturePrepScreen'
import { WoodfordMark } from '@/components/WoodfordMark'
import InstallPrompt from '@/components/InstallPrompt'
import { useSyncStore } from '@/lib/drive/useSyncStore'

const PURPLE = '#3D0066'

// Two tabs: Matches (everything about a fixture, from picking to the result)
// and Team (the squad and the season). Everything else opens over them.
type Tab = 'matches' | 'team'
type Screen = 'loading' | Tab | 'settings' | 'match' | 'post-match' | 'fixture'

export default function App() {
  const [screen, setScreen]                 = useState<Screen>('loading')
  const [lastTab, setLastTab]               = useState<Tab>('matches')
  const [editingFixture, setEditingFixture] = useState<Fixture | undefined>()
  const [newFixturePPS, setNewFixturePPS]   = useState<number>(12)
  const [newFixtureSpond, setNewFixtureSpond] = useState<{ id: string; opponent: string; date: string } | undefined>()

  useEffect(() => {
    useSyncStore.getState().syncAll()   // background sync, tracked in store
    setScreen('matches')
    // Coming back to the app is when coaches expect it to be current:
    // update then, so nobody ever needs a refresh button.
    const onVisible = () => {
      const { isSyncing, lastSyncedAt, syncAll } = useSyncStore.getState()
      if (document.visibilityState !== 'visible' || isSyncing) return
      if (!lastSyncedAt || Date.now() - lastSyncedAt > 60_000) void syncAll()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onVisible)
    }
  }, [])

  const goTab = (t: Tab) => { setLastTab(t); setScreen(t) }
  const openSettings = () => setScreen('settings')

  const openFixture = (fixture?: Fixture, pps?: number) => {
    setEditingFixture(fixture)
    if (pps !== undefined) setNewFixturePPS(pps)
    setNewFixtureSpond(undefined)
    setScreen('fixture')
  }

  const importSpondFixture = (spondEventId: string, opponent: string, date: string, pps: number) => {
    setEditingFixture(undefined)
    setNewFixturePPS(pps)
    setNewFixtureSpond({ id: spondEventId, opponent, date })
    setScreen('fixture')
  }

  // Start — or pick back up — a team's match. initMatch resumes any events
  // already recorded for that team sheet.
  const startMatch = async (fixture: Fixture, teamSheet: TeamSheet) => {
    const squad = useSquadStore.getState().squad
    if (!squad) return
    await useMatchStore.getState().initMatch({
      fixtureId: fixture.id, teamSheet, squad: squad.players, opponent: fixture.opponent,
    })
    setScreen('match')
  }

  const startDemo = async () => {
    await useMatchStore.getState().initDemoMatch()
    setScreen('match')
  }

  // Stored matches are viewed via props, not the live match store — browsing
  // history mid-game must not clobber the match in progress.
  const [viewingMatch, setViewingMatch] = useState<MatchViewData | null>(null)

  const openStoredMatch = (match: Match, teamSheet: TeamSheet) => {
    const squad = useSquadStore.getState().squad
    if (!squad) return
    setViewingMatch({
      squad: squad.players,
      teamSheet,
      opponent: match.opponent,
      matchState: replayEvents(match.events, teamSheet, squad.players),
      events: match.events,
    })
    setScreen('post-match')
  }

  const showTabBar = screen === 'matches' || screen === 'team'

  if (screen === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: PURPLE }}>
        <WoodfordMark size={96} />
      </div>
    )
  }

  if (screen === 'settings') {
    return <SetupScreen onBack={() => setScreen(lastTab)} />
  }

  return (
    <div className="contents">
      {screen === 'matches' && (
        <MatchesScreen
          onStart={(f, ts) => void startMatch(f, ts)}
          onResume={() => setScreen('match')}
          onOpenFixture={f => openFixture(f)}
          onNew={pps => openFixture(undefined, pps)}
          onViewMatch={openStoredMatch}
          onImportSpond={importSpondFixture}
          onOpenSettings={openSettings}
          onDemo={() => void startDemo()}
        />
      )}
      {screen === 'team' && <SquadScreen onOpenSettings={openSettings} />}
      {screen === 'match' && (
        <LiveMatch
          onBack={() => goTab('matches')}
          onSummary={() => setScreen('post-match')}
        />
      )}
      {screen === 'post-match' && (
        <PostMatchScreen
          data={viewingMatch ?? undefined}
          onBack={() => {
            setViewingMatch(null)
            goTab('matches')
          }}
        />
      )}
      {screen === 'fixture' && (
        <FixturePrepScreen
          existing={editingFixture}
          initialPlayersPerSide={newFixturePPS}
          initialOpponent={newFixtureSpond?.opponent}
          initialDate={newFixtureSpond?.date}
          initialSpondEventId={newFixtureSpond?.id}
          onBack={() => goTab('matches')}
          onSaved={() => goTab('matches')}
        />
      )}

      <InstallPrompt visible={showTabBar} />

      {showTabBar && (
        <nav
          className="fixed bottom-0 left-0 right-0 flex z-40"
          style={{ background: 'white', borderTop: '1px solid #E4D0F5', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          {([
            { key: 'matches', icon: <CalendarDays size={24} strokeWidth={2} />, label: 'Matches' },
            { key: 'team',    icon: <Users        size={24} strokeWidth={2} />, label: 'Team' },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => goTab(tab.key)}
              aria-current={screen === tab.key ? 'page' : undefined}
              className="flex-1 pt-2.5 pb-2 flex flex-col items-center gap-0.5 active:scale-95 transition"
              style={{ color: screen === tab.key ? PURPLE : '#8A7A99' }}
            >
              {tab.icon}
              <span className="text-[13px] font-semibold">{tab.label}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  )
}
