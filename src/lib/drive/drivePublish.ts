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

export async function publishFixture(fixture: Fixture, folderId: string): Promise<PublishResult> {
  const safeName = fixture.opponent.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase();
  const fileName = `${fixture.date}-vs-${safeName}.json`;
  return publish(folderId, 'fixtures', fileName, fixture);
}

export async function publishMatch(match: Match, folderId: string, date: string): Promise<PublishResult> {
  const safeName = match.opponent.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase();
  const fileName = `${date}-vs-${safeName}-${match.teamSheetId}.json`;
  return publish(folderId, 'matches', fileName, match);
}
