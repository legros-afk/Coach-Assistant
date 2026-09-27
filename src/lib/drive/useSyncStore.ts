import { create } from 'zustand';
import { useSquadStore } from '@/features/squad/useSquadStore';
import { useFixtureStore } from '@/features/fixture/useFixtureStore';
import { DRIVE_FOLDER_ID } from '@/config/club';
import { syncFromDrive } from './driveSync';
import { flushUnshared } from './pendingShare';
import { friendlySyncError } from '@/lib/friendly';

const LAST_SYNCED_KEY = 'coach-last-synced';

interface SyncStore {
  isSyncing:    boolean;
  lastSyncedAt: number | null;   // epoch ms
  lastError:    string | null;
  syncAll:      () => Promise<void>;
}

export const useSyncStore = create<SyncStore>()((set) => ({
  isSyncing:    false,
  lastSyncedAt: (() => {
    const v = localStorage.getItem(LAST_SYNCED_KEY);
    return v ? parseInt(v, 10) : null;
  })(),
  lastError: null,

  syncAll: async () => {
    set({ isSyncing: true, lastError: null });
    // Anything saved here but not yet shared goes out first, so the pull
    // below can't mistake it for something older than the club's copy.
    await flushUnshared();
    const result = await syncFromDrive(DRIVE_FOLDER_ID);

    if (result.ok) {
      // Re-read Dexie into both stores so UI picks up fresh data
      await Promise.all([
        useSquadStore.getState().hydrate(),
        useFixtureStore.getState().hydrate(),
      ]);
      const now = Date.now();
      localStorage.setItem(LAST_SYNCED_KEY, String(now));
      set({ isSyncing: false, lastSyncedAt: now, lastError: null });
    } else {
      set({ isSyncing: false, lastError: friendlySyncError(result.error) });
    }
  },
}));

// ── helpers ───────────────────────────────────────────────────────────────────

/** One short line for a header: what state the club data on this phone is in. */
export function syncStatusText(s: Pick<SyncStore, 'isSyncing' | 'lastError' | 'lastSyncedAt'>): string {
  if (s.isSyncing) return 'Updating…'
  if (s.lastError) return s.lastError
  return s.lastSyncedAt ? 'Up to date' : 'U12 · Coach Assistant'
}

export function fmtSyncAge(epochMs: number): string {
  const diff = Date.now() - epochMs;
  if (diff < 60_000)     return 'just now';
  if (diff < 3_600_000)  return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}
