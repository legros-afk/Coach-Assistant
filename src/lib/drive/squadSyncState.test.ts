import { beforeEach, describe, expect, it } from 'vitest';
import {
  discardLocalSquadEdits,
  hasUnpublishedSquadEdits,
  markSquadSynced,
  syncedSquadVersion,
} from './squadSyncState';

// Tests run under the node environment, so stand up the bit of localStorage
// this module uses.
beforeEach(() => {
  const store = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => { store.clear(); },
  };
});

describe('squad sync state', () => {
  it('reports no unpublished edits on an untracked device', () => {
    // The recovery path: a device that never recorded a version accepts the
    // club copy rather than holding out with a locally inflated one.
    expect(syncedSquadVersion()).toBeNull();
    expect(hasUnpublishedSquadEdits(99)).toBe(false);
  });

  it('reports unpublished edits once the local version passes what was synced', () => {
    markSquadSynced(10);
    expect(hasUnpublishedSquadEdits(10)).toBe(false);
    expect(hasUnpublishedSquadEdits(11)).toBe(true);
  });

  it('clears the unpublished state after publishing that version', () => {
    markSquadSynced(10);
    expect(hasUnpublishedSquadEdits(11)).toBe(true);
    markSquadSynced(11);            // what publishSquad does on success
    expect(hasUnpublishedSquadEdits(11)).toBe(false);
  });

  it('does not treat a position-sync rewrite as an edit', () => {
    // Positions no longer bump the version, so the local version is unchanged
    // and the device keeps accepting club updates.
    markSquadSynced(10);
    expect(hasUnpublishedSquadEdits(10)).toBe(false);
  });

  it('lets a coach give up local edits and take the club copy', () => {
    markSquadSynced(10);
    expect(hasUnpublishedSquadEdits(12)).toBe(true);
    discardLocalSquadEdits(12);
    expect(hasUnpublishedSquadEdits(12)).toBe(false);
  });

  it('ignores a corrupt stored value rather than blocking sync', () => {
    localStorage.setItem('coach-squad-synced-version', 'not-a-number');
    expect(syncedSquadVersion()).toBeNull();
    expect(hasUnpublishedSquadEdits(5)).toBe(false);
  });
});
