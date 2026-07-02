import type { Group, ID, PlayerMatchState } from '../events/types';

export interface CompositionResult {
  valid: boolean;
  message: string;
  counts: { forward: number; back: number; scrumhalf: number };
}

// Forwards are always 5 (scrum requirement), SH always 1, backs fill the rest.
export const teamLimits = (playersPerSide: number) => ({
  f: 5,
  b: Math.max(0, playersPerSide - 6),
  sh: 1,
});

export function validateComposition(groups: Group[], playersPerSide = 11): CompositionResult {
  const limits = teamLimits(playersPerSide);
  const counts = { forward: 0, back: 0, scrumhalf: 0 };
  for (const g of groups) counts[g]++;
  const valid = counts.forward === limits.f && counts.back === limits.b && counts.scrumhalf === limits.sh;
  const message = valid
    ? ''
    : `Would result in ${counts.forward}F · ${counts.back}B · ${counts.scrumhalf}SH (need ${limits.f}·${limits.b}·${limits.sh})`;
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
