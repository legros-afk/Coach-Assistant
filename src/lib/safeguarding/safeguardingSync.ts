import { SAFEGUARDING_FOLDER_ID } from '@/config/club';
import { db } from '@/lib/db/db';
import { fetchFileJson, getClubPin, getClubRole, listFolder } from '@/lib/drive/driveRead';
import { injuryExpired, protocolExpired } from './retention';
import type { ConcussionProtocol, InjuryReport } from './types';

// Injury reports and concussion protocols live in their own Drive folder,
// apart from the squad and fixtures. Everything is saved on the phone first;
// this shares it when there's signal and a PIN, and enforces the one-year
// retention on the phone (always) and on Drive (safeguarding PIN only — it is
// the only PIN the server lets delete).

type Kind = 'injuries' | 'concussions';
interface Pending { kind: Kind; id: string }

const UNSHARED_KEY = 'safeguarding-unshared';
const FOLDER_MIME = 'application/vnd.google-apps.folder';

function readPending(): Pending[] {
  try { return JSON.parse(localStorage.getItem(UNSHARED_KEY) ?? '[]') as Pending[]; } catch { return []; }
}
function writePending(list: Pending[]) {
  if (list.length) localStorage.setItem(UNSHARED_KEY, JSON.stringify(list));
  else localStorage.removeItem(UNSHARED_KEY);
}
function markPending(kind: Kind, id: string) {
  const list = readPending();
  if (!list.some(p => p.kind === kind && p.id === id)) writePending([...list, { kind, id }]);
}
function clearPending(kind: Kind, id: string) {
  writePending(readPending().filter(p => !(p.kind === kind && p.id === id)));
}
const isPending = (kind: Kind, id: string) => readPending().some(p => p.kind === kind && p.id === id);

async function post(body: Record<string, unknown>): Promise<boolean> {
  const code = getClubPin();
  if (!code || !SAFEGUARDING_FOLDER_ID) return false;
  try {
    const res = await fetch('/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, folder: 'safeguarding', folderId: SAFEGUARDING_FOLDER_ID, ...body }),
    });
    const data = await res.json().catch(() => ({})) as { ok?: boolean };
    return res.ok && data.ok === true;
  } catch {
    return false;
  }
}

async function pushOne(kind: Kind, id: string): Promise<boolean> {
  const record = kind === 'injuries' ? await db.injuryReports.get(id) : await db.concussionProtocols.get(id);
  if (!record) return true; // deleted meanwhile — nothing to share
  // A coach may only start a protocol; updates are the safeguarding officer's
  const createOnly = kind === 'concussions' && getClubRole() !== 'safeguarding';
  return post({ subfolder: kind, fileName: `${id}.json`, content: record, ...(createOnly ? { createOnly: true } : {}) });
}

/** Share a record now if possible; otherwise it goes on the next sync. */
export async function shareSafeguardingRecord(kind: Kind, id: string): Promise<void> {
  markPending(kind, id);
  if (await pushOne(kind, id)) clearPending(kind, id);
}

async function flushPending(): Promise<void> {
  for (const p of readPending()) {
    if (await pushOne(p.kind, p.id)) clearPending(p.kind, p.id);
  }
}

/** Hard-delete expired records on this phone. Returns how many went. */
export async function purgeExpiredLocal(today?: string): Promise<number> {
  const [reports, protocols] = await Promise.all([db.injuryReports.toArray(), db.concussionProtocols.toArray()]);
  const oldReports = reports.filter(r => injuryExpired(r, today)).map(r => r.id);
  const oldProtocols = protocols.filter(p => protocolExpired(p, today)).map(p => p.id);
  await Promise.all([db.injuryReports.bulkDelete(oldReports), db.concussionProtocols.bulkDelete(oldProtocols)]);
  for (const id of oldReports) clearPending('injuries', id);
  for (const id of oldProtocols) clearPending('concussions', id);
  return oldReports.length + oldProtocols.length;
}

export type SafeguardingSyncResult = { ok: true; shared: boolean } | { ok: false; error: string };

export async function syncSafeguarding(): Promise<SafeguardingSyncResult> {
  await purgeExpiredLocal();
  if (!SAFEGUARDING_FOLDER_ID) return { ok: true, shared: false };

  try {
    await flushPending();
    const isOfficer = getClubRole() === 'safeguarding';
    const root = await listFolder(SAFEGUARDING_FOLDER_ID);

    for (const kind of ['injuries', 'concussions'] as const) {
      const folder = root.find(f => f.name === kind && f.mimeType === FOLDER_MIME);
      if (!folder) continue;
      const files = (await listFolder(folder.id)).filter(f => f.name.endsWith('.json'));
      for (const f of files) {
        const id = f.name.slice(0, -5);
        if (kind === 'injuries') {
          const remote = await fetchFileJson<InjuryReport>(f.id);
          if (injuryExpired(remote)) {
            if (isOfficer) await post({ subfolder: kind, fileName: f.name, delete: true });
            continue;
          }
          const local = await db.injuryReports.get(id);
          if (!isPending(kind, id) && (!local || (remote.version ?? 0) >= (local.version ?? 0))) {
            await db.injuryReports.put(remote);
          }
        } else {
          const remote = await fetchFileJson<ConcussionProtocol>(f.id);
          if (protocolExpired(remote)) {
            if (isOfficer) await post({ subfolder: kind, fileName: f.name, delete: true });
            continue;
          }
          const local = await db.concussionProtocols.get(id);
          // The officer's copy on Drive wins for coaches; the officer keeps
          // an edit of their own until it has been shared.
          if (!isPending(kind, id) && (!local || (remote.version ?? 0) >= (local.version ?? 0) || !isOfficer)) {
            await db.concussionProtocols.put(remote);
          }
        }
      }
    }
    return { ok: true, shared: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Safeguarding sync failed' };
  }
}
