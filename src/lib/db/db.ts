import Dexie, { type Table } from 'dexie';
import type { Fixture, Match, Squad } from '@/lib/events/types';
import type { ConcussionProtocol, InjuryReport } from '@/lib/safeguarding/types';

class CoachDb extends Dexie {
  matches!: Table<Match>;
  squads!: Table<Squad>;
  fixtures!: Table<Fixture>;
  injuryReports!: Table<InjuryReport>;
  concussionProtocols!: Table<ConcussionProtocol>;

  constructor() {
    super('coach-assistant');
    this.version(1).stores({
      matches:  'id, fixtureId',
      squads:   'id',
      fixtures: 'id, date',
    });
    // Injury reports and concussion protocols: sensitive, kept for a year only.
    this.version(2).stores({
      injuryReports:       'id, playerId, date, reportedAt',
      concussionProtocols: 'id, playerId, injuryReportId, concussionDate',
    });
  }
}

export const db = new CoachDb();
