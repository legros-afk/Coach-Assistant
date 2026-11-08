import type { ConcussionProtocol, InjuryReport } from './types';
import { freshStages } from './gras';

/**
 * A new return-to-play protocol for a suspected concussion. Day 0 is the day
 * of the injury; the stage start dates all follow from it.
 */
export function protocolFromReport(r: InjuryReport, id: string): ConcussionProtocol {
  return {
    id,
    playerId: r.playerId,
    playerName: r.playerName,
    injuryReportId: r.id,
    concussionDate: r.date,
    stages: freshStages(),
    managedBy: '',
    version: 1,
  };
}
