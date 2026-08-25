import { create } from 'zustand';
import { useSquadStore } from '@/features/squad/useSquadStore';
import { useFixtureStore } from '@/features/fixture/useFixtureStore';
import { DRIVE_FOLDER_ID } from '@/config/club';
import { syncFromDrive } from './driveSync';

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
      set({ isSyncing: false, lastError: result.error });
    }
  },
}));

// ── helper ────────────────────────────────────────────────────────────────────

export function fmtSyncAge(epochMs: number): string {
  const diff = Date.now() - epochMs;
  if (diff < 60_000)     return 'just now';
  if (diff < 3_600_000)  return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}
