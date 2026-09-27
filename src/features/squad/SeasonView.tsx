import { useEffect, useMemo, useState } from 'react'
import type { Match, Player } from '@/lib/events/types'
import { db } from '@/lib/db/db'
import { useFixtureStore } from '@/features/fixture/useFixtureStore'
import { seasonStats } from '@/lib/domain/seasonStats'
import { currentSeason } from '@/lib/domain/season'

const INK   = '#1A1A1A'
const MUTED = '#6E6E73'
const BORDER = '#E5E5EA'

type SortKey = 'minutes' | 'starts' | 'name'

// Who has played how much this season. Minutes keep everyone's time fair;
// starts are the coaches' reward for performance.
export default function SeasonView({ players }: { players: Player[] }) {
  const { fixtures, isHydrated, hydrate } = useFixtureStore()
  const [matches, setMatches] = useState<Match[]>([])
  const [sort, setSort] = useState<SortKey>('minutes')

  useEffect(() => { if (!isHydrated) hydrate() }, [isHydrated, hydrate])
  useEffect(() => { db.matches.toArray().then(setMatches) }, [])

  const season = currentSeason()
  const stats = useMemo(
    () => seasonStats(fixtures, matches, players, season),
    [fixtures, matches, players, season],
  )

  const rows = players
    .map(p => ({ p, s: stats.get(p.id) ?? { games: 0, starts: 0, minutes: 0, tries: 0 } }))
    .sort((a, b) =>
      sort === 'name' ? a.p.name.localeCompare(b.p.name)
        : sort === 'starts' ? b.s.starts - a.s.starts || a.p.name.localeCompare(b.p.name)
          : a.s.minutes - b.s.minutes || a.p.name.localeCompare(b.p.name))

  const gamesPlayed = new Set(matches.filter(m => m.events.some(e => e.type === 'MATCH_END')).map(m => m.id)).size

  if (gamesPlayed === 0) {
    return (
      <div className="py-12 text-center px-6">
        <div className="font-bold text-[#3C3C43] mb-1">No matches played yet this season</div>
        <div className="text-sm text-[#6E6E73]">Minutes, starts and tries appear here once you’ve run a match in the app.</div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-2 px-1">
        <span className="text-sm" style={{ color: MUTED }}>Sort by</span>
        <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
          {([['minutes', 'Least time'], ['starts', 'Most starts'], ['name', 'Name']] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setSort(k)}
              className="h-9 px-3 text-sm font-semibold"
              style={{ background: sort === k ? '#3D0066' : 'white', color: sort === k ? 'white' : '#5B1A99' }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
        <div className="grid grid-cols-[1fr_3.5rem_3.5rem_3.5rem_3.25rem] px-3 py-2 text-[12px] font-bold" style={{ color: MUTED, borderBottom: `1px solid ${BORDER}` }}>
          <span>Player</span><span className="text-right">Games</span><span className="text-right">Starts</span><span className="text-right">Mins</span><span className="text-right">Tries</span>
        </div>
        {rows.map(({ p, s }) => (
          <div key={p.id} className="grid grid-cols-[1fr_3.5rem_3.5rem_3.5rem_3.25rem] px-3 py-2.5 text-[15px] items-center" style={{ borderBottom: '1px solid #EFEFF4' }}>
            <span className="font-semibold truncate" style={{ color: INK }}>{p.name}</span>
            <span className="text-right mono">{s.games}</span>
            <span className="text-right mono">{s.starts}</span>
            <span className="text-right mono font-bold">{Math.round(s.minutes)}</span>
            <span className="text-right mono">{s.tries || ''}</span>
          </div>
        ))}
      </div>
      <p className="text-xs mt-2 px-1" style={{ color: MUTED }}>
        {gamesPlayed} match{gamesPlayed === 1 ? '' : 'es'} this season. Coaches only — not shared with parents.
      </p>
    </div>
  )
}
