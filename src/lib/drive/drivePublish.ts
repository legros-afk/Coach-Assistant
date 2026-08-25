import type { Fixture, Match, Squad } from '@/lib/events/types';
import { getClubPin } from './driveRead';

export type PublishResult = { ok: true } | { ok: false; error: string };

// All coaches share one PIN, so publishing never requires signing in
// to Drive as a specific person — the server-side proxy writes as a shared
// service account.
async function publish(folderId: string, subfolder: string | undefined, fileName: string, content: unknown): Promise<PublishResult> {
  const code = getClubPin();
  if (!code) return { ok: false, error: 'No coach PIN set. Add it in settings.' };

  try {
    const res = await fetch('/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, folderId, subfolder, fileName, content }),
    });
    const data = await res.json() as { ok?: boolean; error?: string };
    if (!res.ok || data.ok !== true) return { ok: false, error: data.error ?? `Publish failed (${res.status})` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Network error' };
  }
}

export async function publishSquad(squad: Squad, folderId: string): Promise<PublishResult> {
  return publish(folderId, undefined, 'squad.json', squad);
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
