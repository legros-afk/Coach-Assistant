import type { Fixture, Match, Squad } from '@/lib/events/types';
import { getClubPin } from './driveRead';
import { syncedSquadVersion } from './squadSyncState';

export type PublishResult =
  | { ok: true }
  | { ok: false; error: string; conflict?: true; driveVersion?: number | null };

// All coaches share one PIN, so publishing never requires signing in
// to Drive as a specific person — the server-side proxy writes as a shared
// service account.
async function publish(
  folderId: string,
  subfolder: string | undefined,
  fileName: string,
  content: unknown,
  guard?: { baseVersion?: number; force?: boolean },
): Promise<PublishResult> {
  const code = getClubPin();
  if (!code) return { ok: false, error: 'No coach PIN set. Add it in settings.' };

  try {
    const res = await fetch('/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, folderId, subfolder, fileName, content, ...guard }),
    });
    const data = await res.json() as { ok?: boolean; error?: string; conflict?: true; driveVersion?: number | null };
    if (!res.ok || data.ok !== true) {
      if (data.conflict) {
        return { ok: false, conflict: true, driveVersion: data.driveVersion ?? null, error: data.error ?? 'Another coach has published since you last synced.' };
      }
      return { ok: false, error: data.error ?? `Publish failed (${res.status})` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Network error' };
  }
}

// The squad is the one document several coaches edit from the same starting
// point, so it publishes as a compare-and-swap against the version this device
// last pulled or published. A device that has never tracked one sends no guard
// — it has nothing to claim it was editing from.
export async function publishSquad(squad: Squad, folderId: string, force = false): Promise<PublishResult> {
  const baseVersion = syncedSquadVersion();
  return publish(folderId, undefined, 'squad.json', squad, {
    ...(baseVersion !== null ? { baseVersion } : {}),
    ...(force ? { force: true } : {}),
  });
}

// Fixtures and matches go into fixtures.json / matches.json rather than a
// file each: the server's service account can edit files but can't create
// them in a personal Drive (it has no storage of its own).
async function publishToCollection(folderId: string, collection: 'fixtures' | 'matches', item: Fixture | Match): Promise<PublishResult> {
  const code = getClubPin();
  if (!code) return { ok: false, error: 'No coach PIN set. Add it in settings.' };
  try {
    const res = await fetch('/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, folderId, collection, item }),
    });
    const text = await res.text();
    let data: { ok?: boolean; error?: string } = {};
    try { data = JSON.parse(text); } catch { /* not JSON: server crashed or wasn't reached */ }
    if (!res.ok || data.ok !== true) {
      return { ok: false, error: data.error ?? `Server replied ${res.status}: ${text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Network error' };
  }
}

export async function publishFixture(fixture: Fixture, folderId: string): Promise<PublishResult> {
  return publishToCollection(folderId, 'fixtures', fixture);
}

export async function publishMatch(match: Match, folderId: string, _date?: string): Promise<PublishResult> {
  return publishToCollection(folderId, 'matches', match);
}
