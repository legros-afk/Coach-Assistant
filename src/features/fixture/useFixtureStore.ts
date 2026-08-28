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
    // Soonest first — the next match is what a coach opens the app for.
    const fixtures = await db.fixtures.orderBy('date').toArray();
    set({ fixtures, isHydrated: true });
  },

  saveFixture: async (fixture) => {
    await db.fixtures.put(fixture);
    const { fixtures } = get();
    const idx = fixtures.findIndex(f => f.id === fixture.id);
    const updated = idx >= 0
      ? fixtures.map(f => f.id === fixture.id ? fixture : f)
      : [...fixtures, fixture];
    // A new or re-dated fixture has to slot into place, not sit where it landed.
    updated.sort((a, b) => a.date.localeCompare(b.date));
    set({ fixtures: updated });
  },

  deleteFixture: async (id) => {
    await db.fixtures.delete(id);
    set({ fixtures: get().fixtures.filter(f => f.id !== id) });
  },
}));
