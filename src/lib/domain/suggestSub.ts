import type { ID, MatchState, Player } from '../events/types';

export function suggestSub(
  goingOff: Player,
  allPlayers: Player[],
  matchState: MatchState,
): Player | null {
  const candidates = allPlayers
    .filter(p => {
      const ps = matchState.playerStates.get(p.id);
      return (
        ps?.status === 'bench' &&
        p.eligibleGroups.some(g => goingOff.eligibleGroups.includes(g))
      );
    })
    .sort((a, b) => {
      const msA = matchState.playerStates.get(a.id)!.minutesPlayed;
      const msB = matchState.playerStates.get(b.id)!.minutesPlayed;
      return msA - msB;
    });

  return candidates[0] ?? null;
}

export function suggestSubBatch(
  goingOff: Player[],
  allPlayers: Player[],
  matchState: MatchState,
): Array<{ off: Player; on: Player | null }> {
  const usedIds = new Set<ID>();

  return goingOff.map(offPlayer => {
    const candidates = allPlayers
      .filter(p => {
        if (usedIds.has(p.id)) return false;
        const ps = matchState.playerStates.get(p.id);
        return (
          ps?.status === 'bench' &&
          p.eligibleGroups.some(g => offPlayer.eligibleGroups.includes(g))
        );
      })
      .sort((a, b) => {
        const msA = matchState.playerStates.get(a.id)!.minutesPlayed;
        const msB = matchState.playerStates.get(b.id)!.minutesPlayed;
        return msA - msB;
      });

    if (candidates.length === 0) return { off: offPlayer, on: null };
    usedIds.add(candidates[0].id);
    return { off: offPlayer, on: candidates[0] };
  });
}
