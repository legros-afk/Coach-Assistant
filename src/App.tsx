import { useEffect, useLayoutEffect, useRef, useState } from 'react'
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
import { NavBar } from '@/ui/NavBar'
import { useSyncStore } from '@/lib/drive/useSyncStore'


// Two tabs: Matches (everything about a fixture, from picking to the result)
// and Team (the squad and the season). Everything else opens over them.
type Tab = 'matches' | 'team'
type Screen = 'loading' | Tab | 'settings' | 'match' | 'post-match' | 'fixture'
const isTab = (s: unknown): s is Tab => s === 'matches' || s === 'team'

export default function App() {
  const [screen, setScreen]                 = useState<Screen>('loading')
  const [editingFixture, setEditingFixture] = useState<Fixture | undefined>()
  const [newFixturePPS, setNewFixturePPS]   = useState<number>(12)
  const [newFixtureSpond, setNewFixtureSpond] = useState<{ id: string; opponent: string; date: string } | undefined>()

  // ── navigation with the browser's history, so the phone's Back button (and
  //    the back swipe) closes the screen on top instead of leaving the app.
  const lastTabRef = useRef<Tab>('matches')
  const scrollByTab = useRef<Record<Tab, number>>({ matches: 0, team: 0 })

  const rememberScroll = () => {
    if (isTab(screenRef.current)) scrollByTab.current[screenRef.current] = window.scrollY
  }
  const screenRef = useRef<Screen>('loading')
  useEffect(() => { screenRef.current = screen }, [screen])

  /** Open a screen over the tabs; Back returns to the tab. */
  const openOver = (s: Screen) => {
    rememberScroll()
    if (isTab(screenRef.current)) window.history.pushState({ s }, '')
    else window.history.replaceState({ s }, '')
    setScreen(s)
  }
  /** Close the screen on top (same as the phone's Back). */
  const closeOver = () => {
    if (window.history.state?.s && !isTab(window.history.state.s)) window.history.back()
    else setScreen(lastTabRef.current)
  }
  const goTab = (t: Tab) => {
    rememberScroll()
    lastTabRef.current = t
    window.history.replaceState({ s: t }, '')
    setScreen(t)
  }

  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const s = (e.state as { s?: Screen } | null)?.s
      setScreen(isTab(s) ? s : lastTabRef.current)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // Back on a tab lands where you were; a screen opened on top starts at the top.
  useLayoutEffect(() => {
    window.scrollTo(0, isTab(screen) ? scrollByTab.current[screen] : 0)
  }, [screen])

  useEffect(() => {
    useSyncStore.getState().syncAll()   // background sync, tracked in store
    window.history.replaceState({ s: 'matches' }, '')
    setScreen('matches')
    // If the phone closed the app during a running match, go straight back to it.
    void useMatchStore.getState().restoreActive().then(r => {
      if (r === 'running') {
        window.history.pushState({ s: 'match' }, '')
        setScreen('match')
      }
    })
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

  const openSettings = () => openOver('settings')

  const openFixture = (fixture?: Fixture, pps?: number) => {
    setEditingFixture(fixture)
    if (pps !== undefined) setNewFixturePPS(pps)
    setNewFixtureSpond(undefined)
    openOver('fixture')
  }

  const importSpondFixture = (spondEventId: string, opponent: string, date: string, pps: number) => {
    setEditingFixture(undefined)
    setNewFixturePPS(pps)
    setNewFixtureSpond({ id: spondEventId, opponent, date })
    openOver('fixture')
  }

  // Start — or pick back up — one of a team's games. initMatch resumes any
  // events already recorded for that game.
  const startMatch = async (fixture: Fixture, teamSheet: TeamSheet, game: number) => {
    const squad = useSquadStore.getState().squad
    if (!squad) return
    await useMatchStore.getState().initMatch({
      fixtureId: fixture.id, teamSheet, squad: squad.players, opponent: fixture.opponent, game,
    })
    openOver('match')
  }

  const startDemo = async () => {
    await useMatchStore.getState().initDemoMatch()
    openOver('match')
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
      game: match.game ?? 1,
      manual: match.manual,
      matchState: replayEvents(match.events, teamSheet, squad.players),
      events: match.events,
    })
    openOver('post-match')
  }

  const showTabBar = screen === 'matches' || screen === 'team'

  if (screen === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand">
        <WoodfordMark size={96} />
      </div>
    )
  }

  if (screen === 'settings') {
    return <SetupScreen onBack={closeOver} />
  }

  return (
    <div className="contents">
      {screen === 'matches' && (
        <MatchesScreen
          onStart={(f, ts, g) => void startMatch(f, ts, g)}
          onResume={() => openOver('match')}
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
          onBack={closeOver}
          onSummary={() => openOver('post-match')}
        />
      )}
      {screen === 'post-match' && (
        <PostMatchScreen
          data={viewingMatch ?? undefined}
          onBack={() => {
            setViewingMatch(null)
            closeOver()
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
          onBack={closeOver}
          onSaved={closeOver}
        />
      )}

      <InstallPrompt visible={showTabBar} />

      {showTabBar && (
        <NavBar
          items={[
            { key: 'matches', label: 'Matches', icon: <CalendarDays size={22} strokeWidth={2} /> },
            { key: 'team',    label: 'Team',    icon: <Users size={22} strokeWidth={2} /> },
          ]}
          active={isTab(screen) ? screen : null}
          onSelect={goTab}
        />
      )}
    </div>
  )
}
