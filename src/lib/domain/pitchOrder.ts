import type { ID, MatchEvent, TeamSheet } from '../events/types';

/**
 * Where each player stands on the live pitch, as an order: starters first,
 * and anyone coming on takes the place of the player they replaced, so the
 * tiles stay put through the game instead of reshuffling.
 */
export function pitchOrder(teamSheet: TeamSheet, events: MatchEvent[]): ID[] {
  const order: ID[] = [...teamSheet.starters.forwards];
  if (teamSheet.starters.scrumhalf) order.push(teamSheet.starters.scrumhalf);
  order.push(...teamSheet.starters.backs);

  const replace = (offId: ID, onId: ID) => {
    const was = order.indexOf(onId);
    if (was >= 0) order.splice(was, 1);
    const at = order.indexOf(offId);
    if (at >= 0) order[at] = onId;
    else order.push(onId);
  };

  for (const e of events) {
    if (e.type === 'SUB_BATCH') {
      const { offIds, onIds } = e.payload;
      onIds.forEach((on, i) => (i < offIds.length ? replace(offIds[i], on) : (order.includes(on) || order.push(on))));
    } else if ((e.type === 'BLOOD_OFF' || e.type === 'INJURED_OFF') && e.payload.replacementId) {
      replace(e.payload.playerId, e.payload.replacementId);
    }
  }
  return order;
}
