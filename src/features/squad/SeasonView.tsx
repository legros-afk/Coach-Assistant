import { useEffect, useMemo, useState } from 'react'
import type { Match, Player } from '@/lib/events/types'
import { db } from '@/lib/db/db'
import { useFixtureStore } from '@/features/fixture/useFixtureStore'
import { seasonStats } from '@/lib/domain/seasonStats'
import { currentSeason } from '@/lib/domain/season'
import { COUNTING_FROM } from '@/config/club'
import { ButtonGroup } from '@/ui/ButtonGroup'
import { Card } from '@/ui/Card'


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
    () => seasonStats(fixtures, matches, players, season, COUNTING_FROM),
    [fixtures, matches, players, season],
  )

  const rows = players
    .map(p => ({ p, s: stats.get(p.id) ?? { games: 0, starts: 0, minutes: 0, tries: 0 } }))
    .sort((a, b) =>
      sort === 'name' ? a.p.name.localeCompare(b.p.name)
        : sort === 'starts' ? b.s.starts - a.s.starts || a.p.name.localeCompare(b.p.name)
          : a.s.minutes - b.s.minutes || a.p.name.localeCompare(b.p.name))

  // Only matches that count: finished, on a fixture dated from the reset on
  const fixtureDate = new Map(fixtures.map(f => [f.id, f.date]))
  const gamesPlayed = matches.filter(m =>
    m.events.some(e => e.type === 'MATCH_END') && (fixtureDate.get(m.fixtureId) ?? '') >= COUNTING_FROM,
  ).length
  const fromLabel = new Date(COUNTING_FROM + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })

  if (gamesPlayed === 0) {
    return (
      <div className="py-12 text-center px-6">
        <div className="text-xl emphasized mb-1">No matches since {fromLabel}</div>
        <div className="text-base text-m-on-surface-variant">Minutes, starts and tries appear here once you’ve run a match in the app.</div>
      </div>
    )
  }

  const COLS = 'grid grid-cols-[1fr_3.25rem_3.25rem_3.5rem_3rem] items-center'
  return (
    <div className="space-y-3">
      <ButtonGroup
        full
        size="sm"
        ariaLabel="Sort by"
        value={sort}
        onChange={setSort}
        options={[
          { value: 'minutes', label: 'Least time' },
          { value: 'starts', label: 'Most starts' },
          { value: 'name', label: 'Name' },
        ]}
      />

      <Card className="overflow-hidden">
        <div className={`${COLS} px-4 py-2.5 text-xs font-semibold text-m-on-surface-variant border-b border-m-outline-variant`}>
          <span>Player</span><span className="text-right">Games</span><span className="text-right">Starts</span><span className="text-right">Mins</span><span className="text-right">Tries</span>
        </div>
        <div className="divide-y divide-m-outline-variant">
          {rows.map(({ p, s }) => (
            <div key={p.id} className={`${COLS} px-4 min-h-[3rem] text-base`}>
              <span className="font-medium truncate">{p.name}</span>
              <span className="text-right mono text-m-on-surface-variant">{s.games}</span>
              <span className="text-right mono text-m-on-surface-variant">{s.starts}</span>
              <span className="text-right mono font-bold">{Math.round(s.minutes)}</span>
              <span className="text-right mono text-m-on-surface-variant">{s.tries || ''}</span>
            </div>
          ))}
        </div>
      </Card>
      <p className="text-xs px-1 text-m-on-surface-variant">
        {gamesPlayed} match{gamesPlayed === 1 ? '' : 'es'} since {fromLabel}. Coaches only — not shared with parents.
      </p>
    </div>
  )
}
