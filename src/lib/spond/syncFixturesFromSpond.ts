import { db } from '@/lib/db/db'
import { getDefaultFormat } from '@/lib/prefs'
import { spondConfigured } from './spondStore'
import { getUpcomingSpondEvents } from './spondSync'
import { reconcileWithSpond } from './spondFixtures'
import { markFixtureUnshared } from '@/lib/drive/pendingShare'

const todayIso = () => new Date().toISOString().slice(0, 10)

/**
 * On a phone connected to Spond (and holding the coach PIN, so it can share),
 * bring the fixture list into line with Spond and queue the changes to be
 * shared with the other coaches. Quiet: any failure leaves fixtures as they are.
 */
export async function syncFixturesFromSpond(canShare: boolean): Promise<number> {
  if (!spondConfigured()) return 0
  try {
    const events = await getUpcomingSpondEvents()
    if (!events.length) return 0
    const [fixtures, matches] = await Promise.all([db.fixtures.toArray(), db.matches.toArray()])
    const played = new Set(matches.filter(m => m.events.length > 0).map(m => m.teamSheetId))
    const { changed } = reconcileWithSpond(events, fixtures, todayIso(), played, getDefaultFormat())
    if (!changed.length) return 0
    await db.fixtures.bulkPut(changed)
    if (canShare) for (const f of changed) markFixtureUnshared(f.id)
    return changed.length
  } catch {
    return 0
  }
}
