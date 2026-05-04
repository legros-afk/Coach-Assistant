import { create } from 'zustand';
import { db } from '@/lib/db/db';
import type { Fixture, ID } from '@/lib/events/types';

interface FixtureStore {
  fixtures: Fixture[];
  isHydrated: boolean;
  hydrate: () => Promise<void>;
  saveFixture: (fixture: Fixture) => Promise<void>;
  deleteFixture: (id: ID) => Promise<void>;
}

export const useFixtureStore = create<FixtureStore>()((set, get) => ({
  fixtures: [],
  isHydrated: false,

  hydrate: async () => {
    const fixtures = await db.fixtures.orderBy('date').reverse().toArray();
    set({ fixtures, isHydrated: true });
  },

  saveFixture: async (fixture) => {
    await db.fixtures.put(fixture);
    const { fixtures } = get();
    const idx = fixtures.findIndex(f => f.id === fixture.id);
    const updated = idx >= 0
      ? fixtures.map(f => f.id === fixture.id ? fixture : f)
      : [fixture, ...fixtures];
    set({ fixtures: updated });
  },

  deleteFixture: async (id) => {
    await db.fixtures.delete(id);
    set({ fixtures: get().fixtures.filter(f => f.id !== id) });
  },
}));
