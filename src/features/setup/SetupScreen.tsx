import { useState } from 'react'
import { CheckCircle, ChevronLeft, KeyRound } from 'lucide-react'
import { WoodfordMark } from '@/components/WoodfordMark'
import { getClubPin, setClubPin } from '@/lib/drive/driveRead'

const PURPLE = '#3D0066'
const INK    = '#1A1A1A'

interface Props {
  onDone: () => void
  onBack?: () => void
}

export default function SetupScreen({ onDone, onBack }: Props) {
  const [pin, setPin]         = useState(() => getClubPin())
  const [saved, setSaved]     = useState(false)

  const handleSave = () => {
    setClubPin(pin)
    setSaved(true)
    setTimeout(onDone, 600)
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#F8F4FF' }}>
      {/* Header */}
      <div style={{ background: PURPLE }} className="px-4 py-5 flex items-center gap-3">
        {onBack ? (
          <button onClick={onBack} className="tap-target flex items-center justify-center -ml-1">
            <ChevronLeft size={24} color="white" strokeWidth={2.5} />
          </button>
        ) : (
          <WoodfordMark size={28} color="white" />
        )}
        <div className="leading-tight">
          <div className="text-sm font-bold tracking-wide uppercase text-white">Coach PIN</div>
          <div className="text-xs text-white/70">Needed to save & publish</div>
        </div>
      </div>

      <div className="flex-1 px-4 py-8 flex flex-col gap-6 max-w-md mx-auto w-full">
        <div>
          <h1 className="text-2xl font-bold mb-1" style={{ color: INK }}>
            Enter your coach PIN
          </h1>
          <p className="text-sm text-stone-500 leading-relaxed">
            Ask your head coach for this. It's the same PIN for every coach — it lets whoever's
            picking teams this week save and publish, without anyone signing in to Drive. You
            don't need it just to view the squad or fixtures.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-widest text-stone-400">
            4-digit PIN
          </label>
          <div className="flex items-center gap-2 px-4 rounded-lg border-2 bg-white"
            style={{ borderColor: saved ? '#10B981' : '#C8A0E8' }}
          >
            <KeyRound size={18} className="flex-shrink-0 text-stone-400" />
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              value={pin}
              onChange={e => { setPin(e.target.value.replace(/\D/g, '')); setSaved(false) }}
              onKeyDown={e => e.key === 'Enter' && pin.length > 0 && handleSave()}
              placeholder="0000"
              className="flex-1 py-4 text-2xl tracking-[0.5em] text-center outline-none bg-transparent"
              style={{ color: INK }}
              autoFocus
            />
          </div>
          {saved && (
            <p className="text-xs text-emerald-600 flex items-center gap-1">
              <CheckCircle size={12} strokeWidth={2.5} /> Saved.
            </p>
          )}
        </div>

        <button
          onClick={handleSave}
          disabled={pin.length === 0}
          className="tap-target w-full rounded-lg font-bold text-base flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 transition"
          style={{ background: PURPLE, color: 'white', minHeight: '56px' }}
        >
          Save PIN
        </button>
      </div>
    </div>
  )
}
