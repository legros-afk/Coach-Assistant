import type { Fixture, Squad } from '@/lib/events/types';
import { requestDriveToken } from './driveAuth';
import { upsertJsonFile, ensureSubfolder, DriveWriteError } from './driveWrite';

export type PublishResult = { ok: true } | { ok: false; error: string };

// ── file ID cache ─────────────────────────────────────────────────────────────

const FILE_IDS_KEY = 'coach-drive-file-ids';

function getFileIds(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(FILE_IDS_KEY) ?? '{}'); }
  catch { return {}; }
}

function cacheFileId(key: string, id: string): void {
  const ids = getFileIds();
  ids[key] = id;
  localStorage.setItem(FILE_IDS_KEY, JSON.stringify(ids));
}

// ── publish operations ────────────────────────────────────────────────────────

export async function publishSquad(squad: Squad, folderId: string): Promise<PublishResult> {
  try {
    const token = await requestDriveToken();
    const cached = getFileIds()['squad.json'];
    const newId = await upsertJsonFile('squad.json', squad, folderId, token, cached);
    cacheFileId('squad.json', newId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}

export async function publishFixture(fixture: Fixture, folderId: string): Promise<PublishResult> {
  try {
    const token = await requestDriveToken();

    const folderKey = 'fixtures-folder';
    let fixturesFolderId = getFileIds()[folderKey];
    if (!fixturesFolderId) {
      fixturesFolderId = await ensureSubfolder('fixtures', folderId, token);
      cacheFileId(folderKey, fixturesFolderId);
    }

    const fileKey = `fixture-${fixture.id}`;
    const safeName = fixture.opponent.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase();
    const fileName = `${fixture.date}-vs-${safeName}.json`;
    const cached = getFileIds()[fileKey];
    const newFileId = await upsertJsonFile(fileName, fixture, fixturesFolderId, token, cached);
    cacheFileId(fileKey, newFileId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}

function friendlyError(e: unknown): string {
  if (e instanceof DriveWriteError) {
    if (e.status === 403) return "Permission denied. Make sure you're signed in to the right Google account.";
    if (e.status === 401) return 'Session expired. Try publishing again.';
    return `Drive error (${e.status}). Check your internet connection.`;
  }
  if (e instanceof Error) {
    if (e.message.includes('popup_closed')) return 'Sign-in cancelled.';
    if (e.message.includes('not set')) return 'OAuth not configured. Add VITE_GOOGLE_OAUTH_CLIENT_ID.';
    return e.message;
  }
  return 'Unknown error. Try again.';
}
