// Fixtures saved on this phone but not yet shared with the other coaches.
// A save always lands locally first; sharing is retried quietly every time the
// app updates, so a coach never has to remember to "publish".

import { db } from '@/lib/db/db'
import { DRIVE_FOLDER_ID } from '@/config/club'
import { clubPinConfigured } from './driveRead'
import { publishFixture, type PublishResult } from './drivePublish'

const KEY = 'coach-unshared-fixtures'

function read(): string[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[] } catch { return [] }
}
function write(ids: string[]) {
  localStorage.setItem(KEY, JSON.stringify([...new Set(ids)]))
}

export function markFixtureUnshared(id: string) { write([...read(), id]) }
export function markFixtureShared(id: string) { write(read().filter(x => x !== id)) }
export function unsharedFixtureIds(): string[] { return read() }

/** Share one fixture now, remembering it for a retry if that fails. */
export async function shareFixture(id: string): Promise<PublishResult> {
  const fixture = await db.fixtures.get(id)
  if (!fixture) { markFixtureShared(id); return { ok: true } }
  const result = await publishFixture(fixture, DRIVE_FOLDER_ID)
  if (result.ok) markFixtureShared(id)
  else markFixtureUnshared(id)
  return result
}

/** Retry everything waiting to be shared. Silent: failures stay queued. */
export async function flushUnshared(): Promise<void> {
  if (!clubPinConfigured()) return
  for (const id of read()) {
    try { await shareFixture(id) } catch { /* stays queued */ }
  }
}
