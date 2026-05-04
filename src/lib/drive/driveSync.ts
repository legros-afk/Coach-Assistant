import { db } from '@/lib/db/db';
import type { Fixture, Match, Squad } from '@/lib/events/types';
import { DriveError, fetchFileJson, listFolder } from './driveRead';

export type SyncResult =
  | { ok: true;  squadUpdated: boolean; fixturesUpdated: number; matchesUpdated: number }
  | { ok: false; error: string };

export async function syncFromDrive(folderId: string, apiKey: string): Promise<SyncResult> {
  try {
    const rootFiles = await listFolder(folderId, apiKey);

    // squad.json
    const squadFile = rootFiles.find(f => f.name === 'squad.json');
    if (squadFile) {
      const squad = await fetchFileJson<Squad>(squadFile.id, apiKey);
      await db.squads.put(squad);
    }

    // fixtures/ subfolder
    const FOLDER_MIME = 'application/vnd.google-apps.folder';
    const fixturesFolder = rootFiles.find(
      f => f.name === 'fixtures' && f.mimeType === FOLDER_MIME,
    );
    let fixturesUpdated = 0;
    if (fixturesFolder) {
      const fixtureFiles = await listFolder(fixturesFolder.id, apiKey);
      for (const ff of fixtureFiles) {
        if (!ff.name.endsWith('.json')) continue;
        const fixture = await fetchFileJson<Fixture>(ff.id, apiKey);
        await db.fixtures.put(fixture);
        fixturesUpdated++;
      }
    }

    const matchesFolder = rootFiles.find(
      f => f.name === 'matches' && f.mimeType === FOLDER_MIME,
    );
    let matchesUpdated = 0;
    if (matchesFolder) {
      const matchFiles = await listFolder(matchesFolder.id, apiKey);
      for (const mf of matchFiles) {
        if (!mf.name.endsWith('.json')) continue;
        const match = await fetchFileJson<Match>(mf.id, apiKey);
        await db.matches.put(match);
        matchesUpdated++;
      }
    }

    return { ok: true, squadUpdated: !!squadFile, fixturesUpdated, matchesUpdated };
  } catch (err) {
    if (err instanceof DriveError && (err.status === 403 || err.status === 404)) {
      return {
        ok: false,
        error: "Couldn't read this folder. Make sure the link is correct and the folder is set to 'Anyone with the link can view'.",
      };
    }
    return { ok: false, error: 'Sync failed. Check your internet connection and try again.' };
  }
}
