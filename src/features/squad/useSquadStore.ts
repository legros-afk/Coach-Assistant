import { create } from 'zustand';
import { db } from '@/lib/db/db';
import { syncFromDrive } from '@/lib/drive/driveSync';
import type { ID, Player, Squad } from '@/lib/events/types';
import { DEMO_SQUAD } from '@/features/match/mockData';
import { DRIVE_FOLDER_ID } from '@/config/club';

export const DEMO_SQUAD_ID = 'demo-squad';
const API_KEY = import.meta.env.VITE_GOOGLE_DRIVE_API_KEY as string | undefined;

let _seq = 0;
const newPlayerId = () => `p-${Date.now()}-${++_seq}`;
const nowIso = () => new Date().toISOString();

interface SquadStore {
  squad: Squad | null;
  isHydrated: boolean;

  hydrate: () => Promise<void>;
  addPlayer: (draft: Omit<Player, 'id'>) => Promise<void>;
  updatePlayer: (id: ID, changes: Partial<Omit<Player, 'id'>>) => Promise<void>;
  deletePlayer: (id: ID) => Promise<void>;
  loadDemoSquad: () => Promise<void>;
  clearSquad: () => Promise<void>;
  pullFromDrive: () => Promise<{ ok: boolean; error?: string }>;
}

async function saveSquad(squad: Squad): Promise<void> {
  await db.squads.put(squad);
}

export const useSquadStore = create<SquadStore>()((set, get) => ({
  squad: null,
  isHydrated: false,

  hydrate: async () => {
    const all = await db.squads.toArray();
    const squad = all.length ? all[all.length - 1] : null;
    set({ squad, isHydrated: true });
  },

  addPlayer: async (draft) => {
    const { squad } = get();
    const player: Player = { ...draft, id: newPlayerId() };
    const updated: Squad = squad
      ? { ...squad, players: [...squad.players, player], updatedAt: nowIso(), version: squad.version + 1 }
      : { id: newPlayerId(), name: 'Woodford U12', season: '2025-26', players: [player], updatedAt: nowIso(), version: 1 };
    await saveSquad(updated);
    set({ squad: updated });
  },

  updatePlayer: async (id, changes) => {
    const { squad } = get();
    if (!squad) return;
    const updated: Squad = {
      ...squad,
      players: squad.players.map(p => p.id === id ? { ...p, ...changes } : p),
      updatedAt: nowIso(),
      version: squad.version + 1,
    };
    await saveSquad(updated);
    set({ squad: updated });
  },

  deletePlayer: async (id) => {
    const { squad } = get();
    if (!squad) return;
    const updated: Squad = {
      ...squad,
      players: squad.players.filter(p => p.id !== id),
      updatedAt: nowIso(),
      version: squad.version + 1,
    };
    await saveSquad(updated);
    set({ squad: updated });
  },

  loadDemoSquad: async () => {
    const demo: Squad = {
      id: DEMO_SQUAD_ID,
      name: 'Woodford U12 (Demo)',
      season: '2025-26',
      players: DEMO_SQUAD,
      updatedAt: nowIso(),
      version: 1,
    };
    await saveSquad(demo);
    set({ squad: demo });
  },

  clearSquad: async () => {
    const { squad } = get();
    if (!squad) return;
    await db.squads.delete(squad.id);
    set({ squad: null });
  },

  pullFromDrive: async () => {
    if (!API_KEY) return { ok: false, error: 'API key not configured.' };
    const result = await syncFromDrive(DRIVE_FOLDER_ID, API_KEY);
    if (result.ok && result.squadUpdated) {
      const all = await db.squads.toArray();
      const squad = all.length ? all[all.length - 1] : null;
      set({ squad });
    }
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  },
}));
