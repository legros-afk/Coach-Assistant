import { useEffect } from 'react'
import { Calendar, ChevronRight, Plus, RefreshCw } from 'lucide-react'
import { WoodfordMark } from '@/components/WoodfordMark'
import type { Fixture } from '@/lib/events/types'
import { useFixtureStore } from './useFixtureStore'
import { useSyncStore, fmtSyncAge, driveConfigured } from '@/lib/drive/useSyncStore'

const PURPLE      = '#782880'
const PURPLE_DARK = '#5C1E63'
const INK         = '#201820'

interface Props {
  onNew: () => void
  onEdit: (fixture: Fixture) => void
}

export default function FixtureListScreen({ onNew, onEdit }: Props) {
  const { fixtures, isHydrated, hydrate } = useFixtureStore()
  const { isSyncing, lastSyncedAt, syncAll } = useSyncStore()
  const hasDrive = driveConfigured()

  useEffect(() => { if (!isHydrated) hydrate() }, [isHydrated, hydrate])

  return (
    <div className="min-h-screen pb-24" style={{ background: '#F5F3F0', color: INK }}>
      <div className="sticky top-0 z-20" style={{ background: PURPLE }}>
        <div className="px-3 py-2 flex items-center gap-2" style={{ borderBottom: `1px solid ${PURPLE_DARK}` }}>
          <Calendar size={18} color="white" strokeWidth={2} />
          <div className="flex-1 leading-tight">
            <div className="text-[13px] font-bold tracking-wide uppercase text-white">Fixtures</div>
            <div className="text-[10px] text-white/70">
              {isSyncing
                ? 'Syncing…'
                : isHydrated
                  ? `${fixtures.length} fixture${fixtures.length !== 1 ? 's' : ''}${lastSyncedAt ? ` · ${fmtSyncAge(lastSyncedAt)}` : ''}`
                  : '…'}
            </div>
          </div>
          {hasDrive && (
            <button
              onClick={syncAll}
              disabled={isSyncing}
              className="tap-target w-8 h-8 flex items-center justify-center rounded-lg active:scale-95 transition disabled:opacity-50"
              style={{ background: 'rgba(255,255,255,0.15)' }}
              aria-label="Sync fixtures from Drive"
            >
              <RefreshCw size={15} color="white" strokeWidth={2} className={isSyncing ? 'animate-spin' : ''} />
            </button>
          )}
          <WoodfordMark size={22} color="white" />
        </div>
      </div>

      <div className="px-3 pt-3">
        {!isHydrated ? (
          <div className="py-12 text-center text-stone-400 text-sm">Loading…</div>
        ) : fixtures.length === 0 ? (
          <div className="py-12 flex flex-col items-center gap-4">
            <Calendar size={40} className="text-stone-300" strokeWidth={1.5} />
            <div className="text-center">
              <div className="font-bold text-stone-500 mb-1">No fixtures yet</div>
              <div className="text-sm text-stone-400">Create a fixture to start building team sheets.</div>
            </div>
            <button
              onClick={onNew}
              className="tap-target px-5 rounded-lg font-bold text-sm flex items-center gap-2 active:scale-95 transition"
              style={{ background: PURPLE, color: 'white', minHeight: '48px' }}
            >
              <Plus size={16} strokeWidth={2.5} /> Create first fixture
            </button>
          </div>
        ) : (
          <div className="space-y-1.5">
            {fixtures.map(f => (
              <button
                key={f.id}
                onClick={() => onEdit(f)}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-lg bg-white border active:scale-[0.99] transition text-left"
                style={{ borderColor: '#E7E5E4' }}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm" style={{ color: INK }}>vs {f.opponent}</div>
                  <div className="text-xs text-stone-400">{f.date} · {f.teamSheets.length} team sheet{f.teamSheets.length !== 1 ? 's' : ''}</div>
                </div>
                <ChevronRight size={16} className="text-stone-300 flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="fixed bottom-20 right-4 z-20">
        <button
          onClick={onNew}
          className="w-14 h-14 rounded-full shadow-lg flex items-center justify-center active:scale-95 transition"
          style={{ background: PURPLE, color: 'white' }}
        >
          <Plus size={26} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  )
}
