import type { Group, ID, PlayerMatchState } from '../events/types';

export interface CompositionResult {
  valid: boolean;
  message: string;
  counts: { forward: number; back: number; scrumhalf: number };
}

export function validateComposition(groups: Group[]): CompositionResult {
  const counts = { forward: 0, back: 0, scrumhalf: 0 };
  for (const g of groups) counts[g]++;
  const valid = counts.forward === 5 && counts.back === 5 && counts.scrumhalf === 1;
  const message = valid
    ? ''
    : `Would result in ${counts.forward}F · ${counts.back}B · ${counts.scrumhalf}SH (need 5·5·1)`;
  return { valid, message, counts };
}

// Computes the resulting on-pitch groups after a proposed sub batch.
export function projectOnPitchGroups(
  playerStates: Map<ID, PlayerMatchState>,
  comingOffIds: ID[],
  comingOnGroups: Map<ID, Group>,
): Group[] {
  const offSet = new Set(comingOffIds);
  const result: Group[] = [];
  for (const [id, ps] of playerStates) {
    if (ps.status === 'on' && !offSet.has(id)) result.push(ps.activeGroup);
  }
  for (const g of comingOnGroups.values()) result.push(g);
  return result;
}
