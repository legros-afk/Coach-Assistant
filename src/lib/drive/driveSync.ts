import { db } from '@/lib/db/db';
import type { Fixture, Match, Squad } from '@/lib/events/types';
import { DriveError, fetchFileJson, listFolder } from './driveRead';
import { fetchSquadPositions, applyPositions } from './sheetsSync';

export type SyncResult =
  | { ok: true;  squadUpdated: boolean; fixturesUpdated: number; matchesUpdated: number }
  | { ok: false; error: string };

export async function syncFromDrive(folderId: string, _apiKey?: string): Promise<SyncResult> {
  try {
    const rootFiles = await listFolder(folderId);

    // squad.json — keep local copy when it has unpublished edits (higher version)
    const squadFile = rootFiles.find(f => f.name === 'squad.json');
    let squadUpdated = false;
    if (squadFile) {
      const squad = await fetchFileJson<Squad>(squadFile.id);
      const local = await db.squads.get(squad.id);
      if (!local || (squad.version ?? 0) >= (local.version ?? 0)) {
        await db.squads.put(squad);
        squadUpdated = true;
      }
    }

    // Always refresh positions from the squad spreadsheet
    try {
      const positions = await fetchSquadPositions();
      const all = await db.squads.toArray();
      const squad = all.length ? all[all.length - 1] : null;
      if (squad && positions.length > 0) {
        const { players, changed } = applyPositions(squad.players, positions);
        if (changed > 0) {
          await db.squads.put({ ...squad, players, updatedAt: new Date().toISOString(), version: squad.version + 1 });
        }
      }
    } catch {
      // Sheets API unavailable — positions stay as-is, don't fail the whole sync
    }

    // fixtures/ subfolder
    const FOLDER_MIME = 'application/vnd.google-apps.folder';
    const fixturesFolder = rootFiles.find(
      f => f.name === 'fixtures' && f.mimeType === FOLDER_MIME,
    );
    let fixturesUpdated = 0;
    if (fixturesFolder) {
      const fixtureFiles = await listFolder(fixturesFolder.id);
      for (const ff of fixtureFiles) {
        if (!ff.name.endsWith('.json')) continue;
        const fixture = await fetchFileJson<Fixture>(ff.id);
        const local = await db.fixtures.get(fixture.id);
        // Local unpublished edits (higher version) win over the Drive copy
        if (local && (local.version ?? 0) > (fixture.version ?? 0)) continue;
        await db.fixtures.put(fixture);
        fixturesUpdated++;
      }
    }

    const matchesFolder = rootFiles.find(
      f => f.name === 'matches' && f.mimeType === FOLDER_MIME,
    );
    let matchesUpdated = 0;
    if (matchesFolder) {
      const matchFiles = await listFolder(matchesFolder.id);
      for (const mf of matchFiles) {
        if (!mf.name.endsWith('.json')) continue;
        const match = await fetchFileJson<Match>(mf.id);
        const local = await db.matches.get(match.id);
        // Never lose locally recorded events (e.g. a match in progress on this device)
        if (local && local.events.length > match.events.length) continue;
        await db.matches.put(match);
        matchesUpdated++;
      }
    }

    return { ok: true, squadUpdated, fixturesUpdated, matchesUpdated };
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
