import Dexie, { type Table } from 'dexie';
import type { Fixture, Match, Squad } from '@/lib/events/types';

class CoachDb extends Dexie {
  matches!: Table<Match>;
  squads!: Table<Squad>;
  fixtures!: Table<Fixture>;

  constructor() {
    super('coach-assistant');
    this.version(1).stores({
      matches:  'id, fixtureId',
      squads:   'id',
      fixtures: 'id, date',
    });
  }
}

export const db = new CoachDb();
