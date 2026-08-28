// Tracks which squad version this device has actually exchanged with Drive.
//
// Whether a device is holding unpublished edits is a *device-local* question,
// so it can't be answered by comparing version numbers alone: a local version
// higher than Drive's can mean either "this coach edited and hasn't published"
// or "something on this device bumped the version by itself". Recording the
// last version we knowingly published or pulled tells those two apart.

const SYNCED_VERSION_KEY = 'coach-squad-synced-version';

export function markSquadSynced(version: number): void {
  localStorage.setItem(SYNCED_VERSION_KEY, String(version));
}

export function syncedSquadVersion(): number | null {
  const raw = localStorage.getItem(SYNCED_VERSION_KEY);
  if (raw === null) return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

// True only when this device holds squad edits it has never published.
// Untracked devices report false so they accept the club copy — which is also
// what recovers a device whose local version drifted above Drive's.
export function hasUnpublishedSquadEdits(localVersion: number): boolean {
  const synced = syncedSquadVersion();
  if (synced === null) return false;
  return localVersion > synced;
}
