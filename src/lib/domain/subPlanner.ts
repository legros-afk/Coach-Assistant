import type { Group, ID, Player, PlayerMatchState, TeamSheet } from '../events/types';

export interface PlannedSwap {
  off: Player;
  on: Player;
  group: Group;
  dueAtMs: number;   // match-clock time when this swap should happen
  dueNow: boolean;
}

// A swap counts as "due" slightly before its ideal time so the pitch-side
// helper has time to get the player ready.
const DUE_LEAD_MS = 30_000;

function liveMinutes(ps: PlayerMatchState, elapsedMs: number): number {
  return ps.status === 'on' && ps.currentStintStartedAtMs !== undefined
    ? ps.minutesPlayed + (elapsedMs - ps.currentStintStartedAtMs)
    : ps.minutesPlayed;
}

/**
 * Equal-time rotation planner. For each position group it pairs the
 * most-played on-pitch player with the least-played eligible bench player
 * and computes when that swap should happen so everyone converges on a
 * fair share of the full game.
 *
 * Scrum-half is planned first because it has the fewest eligible players;
 * a versatile bench player is only consumed by one group's plan.
 */
export function planSubs(
  squad: Player[],
  teamSheet: TeamSheet,
  playerStates: Map<ID, PlayerMatchState>,
  elapsedMs: number,
  gameLengthMs: number,
  toleranceMs: number,
): PlannedSwap[] {
  const groupOrder: { group: Group; starterCount: number }[] = [
    { group: 'scrumhalf', starterCount: 1                                  },
    { group: 'forward',   starterCount: teamSheet.starters.forwards.length },
    { group: 'back',      starterCount: teamSheet.starters.backs.length    },
  ];

  const swaps: PlannedSwap[] = [];
  const usedBenchIds = new Set<ID>();

  for (const { group, starterCount } of groupOrder) {
    const onInGroup = squad.filter(p => {
      const ps = playerStates.get(p.id);
      return ps?.status === 'on' && ps.activeGroup === group;
    });
    const benchInGroup = squad.filter(p => {
      const ps = playerStates.get(p.id);
      return ps?.status === 'bench' && p.eligibleGroups.includes(group) && !usedBenchIds.has(p.id);
    });
    if (onInGroup.length === 0 || benchInGroup.length === 0) continue;

    const slots = starterCount > 0 ? starterCount : onInGroup.length;
    const groupSize = onInGroup.length + benchInGroup.length;
    const fairShareMs = gameLengthMs * slots / groupSize;
    const getTime = (p: Player) => liveMinutes(playerStates.get(p.id)!, elapsedMs);

    const sortedOn    = [...onInGroup   ].sort((a, b) => getTime(b) - getTime(a)); // most played first
    const sortedBench = [...benchInGroup].sort((a, b) => getTime(a) - getTime(b)); // least played first

    const pairCount = Math.min(sortedOn.length, sortedBench.length);
    for (let i = 0; i < pairCount; i++) {
      const offPlayer = sortedOn[i];
      const onPlayer  = sortedBench[i];
      const onNeedsMs = fairShareMs - getTime(onPlayer);
      if (onNeedsMs <= toleranceMs) continue; // bench player already has ~fair share

      // Latest moment they can come on and still reach fair share by full time
      const latestStartMs = gameLengthMs - onNeedsMs;
      // Ideal moment: when the off player reaches their fair share
      const idealStartMs = elapsedMs + Math.max(0, fairShareMs - getTime(offPlayer));
      const dueAtMs = Math.max(elapsedMs, Math.min(idealStartMs, latestStartMs));

      swaps.push({
        off: offPlayer,
        on: onPlayer,
        group,
        dueAtMs,
        dueNow: Math.min(idealStartMs, latestStartMs) <= elapsedMs + DUE_LEAD_MS,
      });
      usedBenchIds.add(onPlayer.id);
    }
  }

  return swaps.sort((a, b) => Number(b.dueNow) - Number(a.dueNow) || a.dueAtMs - b.dueAtMs);
}
