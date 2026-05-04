import { useEffect, useState } from 'react'
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

const PURPLE = '#782880'

type Screen = 'loading' | 'setup' | 'home' | 'match' | 'post-match' | 'squad' | 'fixtures' | 'fixture-prep'

export default function App() {
  const [screen, setScreen]               = useState<Screen>('loading')
  const [editingFixture, setEditingFixture] = useState<Fixture | undefined>()

  useEffect(() => {
    const folderId = localStorage.getItem(FOLDER_ID_KEY)
    if (folderId) {
      useSyncStore.getState().syncAll()   // background sync, tracked in store
      setScreen('home')
    } else {
      setScreen('setup')
    }
  }, [])

  const openFixturePrep = (fixture?: Fixture) => {
    setEditingFixture(fixture)
    setScreen('fixture-prep')
  }

  const showTabBar = screen === 'home' || screen === 'squad' || screen === 'fixtures'

  if (screen === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: PURPLE }}>
        <WoodfordMark size={48} color="white" />
      </div>
    )
  }

  if (screen === 'setup') {
    return <SetupScreen onDone={() => setScreen('home')} />
  }

  return (
    <>
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
          onNew={() => openFixturePrep()}
          onEdit={f => openFixturePrep(f)}
        />
      )}
      {screen === 'fixture-prep' && (
        <FixturePrepScreen
          existing={editingFixture}
          onBack={() => setScreen('fixtures')}
          onSaved={() => setScreen('fixtures')}
        />
      )}

      <InstallPrompt />

      {showTabBar && (
        <div
          className="fixed bottom-0 left-0 right-0 flex z-40"
          style={{ background: 'white', borderTop: '1px solid #E7E5E4' }}
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
              style={{ color: screen === tab.key ? PURPLE : '#A8A29E' }}
            >
              {tab.icon}
              <span className="text-[10px] font-semibold">{tab.label}</span>
            </button>
          ))}
        </div>
      )}
    </>
  )
}
