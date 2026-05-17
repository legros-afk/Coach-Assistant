import { useEffect, useRef, useState } from 'react'
import { useMatchStore } from '@/features/match/useMatchStore'
import { useSquadStore } from '@/features/squad/useSquadStore'
import type { Match, TeamSheet } from '@/lib/events/types'
import { Calendar, Home, Users } from 'lucide-react'
import LiveMatch from '@/features/match/LiveMatch'
import PostMatchScreen from '@/features/match/PostMatchScreen'
import SetupScreen from '@/features/setup/SetupScreen'
import SquadScreen from '@/features/squad/SquadScreen'
import FixtureListScreen from '@/features/fixture/FixtureListScreen'
import FixturePrepScreen from '@/features/fixture/FixturePrepScreen'
import HomeScreen from '@/features/home/HomeScreen'
import { WoodfordMark } from '@/components/WoodfordMark'
import InstallPrompt from '@/components/InstallPrompt'
import { FOLDER_ID_KEY } from '@/lib/drive/driveRead'
import { useSyncStore } from '@/lib/drive/useSyncStore'
import type { Fixture } from '@/lib/events/types'

const PURPLE = '#3D0066'

type Screen = 'loading' | 'setup' | 'home' | 'match' | 'post-match' | 'squad' | 'fixtures' | 'fixture-prep'

export default function App() {
  const [screen, setScreen]                     = useState<Screen>('loading')
  const [editingFixture, setEditingFixture]       = useState<Fixture | undefined>()
  const [newFixturePPS, setNewFixturePPS]         = useState<number>(12)
  const [newFixtureSpond, setNewFixtureSpond]     = useState<{ id: string; opponent: string; date: string } | undefined>()

  useEffect(() => {
    const folderId = localStorage.getItem(FOLDER_ID_KEY)
    if (folderId) {
      useSyncStore.getState().syncAll()   // background sync, tracked in store
      setScreen('home')
    } else {
      setScreen('setup')
    }
  }, [])

  const openFixturePrep = (fixture?: Fixture, pps?: number) => {
    setEditingFixture(fixture)
    if (pps !== undefined) setNewFixturePPS(pps)
    setNewFixtureSpond(undefined)
    setScreen('fixture-prep')
  }

  const importSpondFixture = (spondEventId: string, opponent: string, date: string, pps: number) => {
    setEditingFixture(undefined)
    setNewFixturePPS(pps)
    setNewFixtureSpond({ id: spondEventId, opponent, date })
    setScreen('fixture-prep')
  }

  const openStoredMatch = (match: Match, teamSheet: TeamSheet) => {
    const squad = useSquadStore.getState().squad
    if (!squad) return
    useMatchStore.getState().loadStoredMatch(match, teamSheet, squad.players)
    setScreen('post-match')
  }

  const showTabBar = screen === 'home' || screen === 'squad' || screen === 'fixtures'

  const TAB_ORDER = ['home', 'fixtures', 'squad'] as const
  const tabIndex = TAB_ORDER.indexOf(screen as typeof TAB_ORDER[number])
  const swipeStart = useRef<{ x: number; y: number } | null>(null)

  const onTouchStart = (e: React.TouchEvent) => {
    if (tabIndex === -1) return
    swipeStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!swipeStart.current || tabIndex === -1) return
    const dx = e.changedTouches[0].clientX - swipeStart.current.x
    const dy = e.changedTouches[0].clientY - swipeStart.current.y
    swipeStart.current = null
    if (Math.abs(dx) < 60 || Math.abs(dy) > 80) return
    if (dx < 0 && tabIndex < TAB_ORDER.length - 1) setScreen(TAB_ORDER[tabIndex + 1])
    if (dx > 0 && tabIndex > 0) setScreen(TAB_ORDER[tabIndex - 1])
  }

  if (screen === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: PURPLE }}>
        <WoodfordMark size={96} />
      </div>
    )
  }

  if (screen === 'setup') {
    return <SetupScreen onDone={() => setScreen('home')} />
  }

  return (
    <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} className="contents">
      {screen === 'home' && (
        <HomeScreen
          onMatch={() => setScreen('match')}
          onFixturePrep={f => openFixturePrep(f)}
        />
      )}
      {screen === 'match' && (
        <LiveMatch
          onBack={() => setScreen('home')}
          onOpenSquad={() => setScreen('squad')}
          onSummary={() => setScreen('post-match')}
        />
      )}
      {screen === 'post-match' && (
        <PostMatchScreen onBack={() => setScreen('home')} />
      )}
      {screen === 'squad' && (
        <SquadScreen onBack={() => setScreen('home')} />
      )}
      {screen === 'fixtures' && (
        <FixtureListScreen
          onNew={pps => openFixturePrep(undefined, pps)}
          onEdit={f => openFixturePrep(f)}
          onViewMatch={openStoredMatch}
          onImportSpond={importSpondFixture}
        />
      )}
      {screen === 'fixture-prep' && (
        <FixturePrepScreen
          existing={editingFixture}
          initialPlayersPerSide={newFixturePPS}
          initialOpponent={newFixtureSpond?.opponent}
          initialDate={newFixtureSpond?.date}
          initialSpondEventId={newFixtureSpond?.id}
          onBack={() => setScreen('fixtures')}
          onSaved={() => setScreen('fixtures')}
        />
      )}

      <InstallPrompt />

      {showTabBar && (
        <div
          className="fixed bottom-0 left-0 right-0 flex z-40"
          style={{ background: 'white', borderTop: '1px solid #E4D0F5' }}
        >
          {([
            { key: 'home',     icon: <Home     size={20} strokeWidth={2} />, label: 'Match' },
            { key: 'fixtures', icon: <Calendar size={20} strokeWidth={2} />, label: 'Fixtures' },
            { key: 'squad',    icon: <Users    size={20} strokeWidth={2} />, label: 'Squad' },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setScreen(tab.key)}
              className="flex-1 py-3 flex flex-col items-center gap-0.5 active:scale-95 transition"
              style={{ color: screen === tab.key ? PURPLE : '#7B5FA8' }}
            >
              {tab.icon}
              <span className="text-[10px] font-semibold">{tab.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
