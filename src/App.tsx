import { useEffect, useState } from 'react'
import { Calendar, Play, Users } from 'lucide-react'
import { useMatchStore } from '@/features/match/useMatchStore'
import LiveMatch from '@/features/match/LiveMatch'
import SetupScreen from '@/features/setup/SetupScreen'
import SquadScreen from '@/features/squad/SquadScreen'
import FixtureListScreen from '@/features/fixture/FixtureListScreen'
import FixturePrepScreen from '@/features/fixture/FixturePrepScreen'
import { WoodfordMark } from '@/components/WoodfordMark'
import { FOLDER_ID_KEY } from '@/lib/drive/driveRead'
import { syncFromDrive } from '@/lib/drive/driveSync'
import type { Fixture } from '@/lib/events/types'

const API_KEY = import.meta.env.VITE_GOOGLE_DRIVE_API_KEY as string | undefined
const PURPLE = '#782880'

type Screen = 'loading' | 'setup' | 'match' | 'squad' | 'fixtures' | 'fixture-prep'

export default function App() {
  const hydrate = useMatchStore(s => s.hydrate)
  const [screen, setScreen]         = useState<Screen>('loading')
  const [editingFixture, setEditingFixture] = useState<Fixture | undefined>()

  useEffect(() => {
    hydrate().then(() => {
      const folderId = localStorage.getItem(FOLDER_ID_KEY)
      if (folderId) {
        if (API_KEY) syncFromDrive(folderId, API_KEY)
        setScreen('match')
      } else {
        setScreen('setup')
      }
    })
  }, [hydrate])

  const openFixturePrep = (fixture?: Fixture) => {
    setEditingFixture(fixture)
    setScreen('fixture-prep')
  }

  const showTabBar = screen === 'squad' || screen === 'fixtures'

  if (screen === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: PURPLE }}>
        <WoodfordMark size={48} color="white" />
      </div>
    )
  }

  if (screen === 'setup') {
    return <SetupScreen onDone={() => setScreen('match')} />
  }

  return (
    <>
      {screen === 'match' && (
        <LiveMatch onOpenSquad={() => setScreen('squad')} />
      )}
      {screen === 'squad' && (
        <SquadScreen onBack={() => setScreen('match')} />
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

      {/* Bottom tab bar — visible on squad + fixtures screens */}
      {showTabBar && (
        <div
          className="fixed bottom-0 left-0 right-0 flex z-40"
          style={{ background: 'white', borderTop: '1px solid #E7E5E4' }}
        >
          {([
            { key: 'match',    icon: <Play    size={20} strokeWidth={2} />, label: 'Match' },
            { key: 'fixtures', icon: <Calendar size={20} strokeWidth={2} />, label: 'Fixtures' },
            { key: 'squad',    icon: <Users   size={20} strokeWidth={2} />, label: 'Squad' },
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
