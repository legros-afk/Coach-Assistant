import { useEffect } from 'react'
import { useMatchStore } from '@/features/match/useMatchStore'
import LiveMatch from '@/features/match/LiveMatch'
import { WoodfordMark } from '@/components/WoodfordMark'

export default function App() {
  const hydrate = useMatchStore(s => s.hydrate)
  const isHydrated = useMatchStore(s => s.isHydrated)

  useEffect(() => { hydrate() }, [hydrate])

  if (!isHydrated) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: '#782880' }}
      >
        <WoodfordMark size={48} color="white" />
      </div>
    )
  }

  return <LiveMatch />
}
