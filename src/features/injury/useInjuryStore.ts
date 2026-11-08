import { create } from 'zustand';
import { db } from '@/lib/db/db';
import type { ConcussionProtocol, InjuryReport } from '@/lib/safeguarding/types';
import { isActive } from '@/lib/safeguarding/gras';

let _seq = 0;
/** Sortable, unique-enough id for a record created on this phone. */
export const newSafeguardingId = (prefix: 'inj' | 'con') =>
  `${prefix}-${Date.now().toString(36)}-${(++_seq).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

interface InjuryStore {
  reports: InjuryReport[];
  protocols: ConcussionProtocol[];
  isHydrated: boolean;
  hydrate: () => Promise<void>;
  saveReport: (r: InjuryReport) => Promise<void>;
  saveProtocol: (p: ConcussionProtocol) => Promise<void>;
}

// Everything is saved on this phone first — a report is never lost because
// there was no signal at the side of the pitch.
export const useInjuryStore = create<InjuryStore>()((set, get) => ({
  reports: [],
  protocols: [],
  isHydrated: false,

  hydrate: async () => {
    const [reports, protocols] = await Promise.all([
      db.injuryReports.toArray(),
      db.concussionProtocols.toArray(),
    ]);
    reports.sort((a, b) => b.reportedAt.localeCompare(a.reportedAt));
    protocols.sort((a, b) => b.concussionDate.localeCompare(a.concussionDate));
    set({ reports, protocols, isHydrated: true });
  },

  saveReport: async (r) => {
    await db.injuryReports.put(r);
    set({ reports: [r, ...get().reports.filter(x => x.id !== r.id)] });
  },

  saveProtocol: async (p) => {
    await db.concussionProtocols.put(p);
    const protocols = [p, ...get().protocols.filter(x => x.id !== p.id)]
      .sort((a, b) => b.concussionDate.localeCompare(a.concussionDate));
    set({ protocols });
  },
}));

/** The player's protocol still in progress, if any. */
export function activeProtocolFor(protocols: ConcussionProtocol[], playerId: string): ConcussionProtocol | undefined {
  return protocols.find(p => p.playerId === playerId && isActive(p));
}

const REPORTER_KEY = 'coach-reporter-name';
export const getReporterName = () => localStorage.getItem(REPORTER_KEY) ?? '';
export const setReporterName = (n: string) => {
  const t = n.trim();
  if (t) localStorage.setItem(REPORTER_KEY, t);
};
