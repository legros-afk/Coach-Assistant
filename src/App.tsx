import { useEffect, useState } from 'react'
import { useMatchStore } from '@/features/match/useMatchStore'
import LiveMatch from '@/features/match/LiveMatch'
import SetupScreen from '@/features/setup/SetupScreen'
import SquadScreen from '@/features/squad/SquadScreen'
import { WoodfordMark } from '@/components/WoodfordMark'
import { FOLDER_ID_KEY } from '@/lib/drive/driveRead'
import { syncFromDrive } from '@/lib/drive/driveSync'

const API_KEY = import.meta.env.VITE_GOOGLE_DRIVE_API_KEY as string | undefined

type Screen = 'loading' | 'setup' | 'match' | 'squad'

export default function App() {
  const hydrate = useMatchStore(s => s.hydrate)
  const [screen, setScreen] = useState<Screen>('loading')

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

  if (screen === 'loading') {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: '#782880' }}
      >
        <WoodfordMark size={48} color="white" />
      </div>
    )
  }

  if (screen === 'setup') {
    return <SetupScreen onDone={() => setScreen('match')} />
  }

  if (screen === 'squad') {
    return <SquadScreen onBack={() => setScreen('match')} />
  }

  return <LiveMatch onOpenSquad={() => setScreen('squad')} />
}
