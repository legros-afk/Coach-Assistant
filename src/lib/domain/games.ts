import type { ID, Match, MatchEvent } from '../events/types';

// A team can play more than one game on a match day (the opposition's A and
// B sides, back to back) with the same line-up. Game 1 keeps the team sheet's
// own ID, so matches recorded before games existed still load as game 1.
// Later games get a fixed ID too, so two phones starting "game 2" end up with
// the same match rather than two.

export const gameOf = (m: Match): number => m.game ?? 1;

export const gameId = (teamSheetId: ID, game: number): ID =>
  game <= 1 ? teamSheetId : `${teamSheetId}-g${game}`;

export const hasEnded = (m?: Match): boolean =>
  !!m?.events.some(e => e.type === 'MATCH_END');

export const scoreOf = (m: Match) => ({
  us: m.events.filter(e => e.type === 'TRY_US').length,
  them: m.events.filter(e => e.type === 'TRY_THEM').length,
});

/** Each team sheet's games, in the order they were played. */
export function gamesBySheet(matches: Match[]): Map<ID, Match[]> {
  const out = new Map<ID, Match[]>();
  for (const m of matches) {
    const list = out.get(m.teamSheetId) ?? [];
    list.push(m);
    out.set(m.teamSheetId, list);
  }
  for (const list of out.values()) list.sort((a, b) => gameOf(a) - gameOf(b));
  return out;
}

/** The number the next game for this team would get. */
export const nextGame = (games: Match[]): number =>
  games.reduce((n, m) => Math.max(n, gameOf(m)), 0) + 1;

/**
 * A result typed in afterwards: one try event per try (scorers where known)
 * and a final whistle. No clock events, so nobody gets minutes from it.
 */
export function manualResultEvents(
  scorerIds: (ID | undefined)[],
  triesThem: number,
  at: string,
): MatchEvent[] {
  let n = 0;
  const id = () => `manual-${Date.parse(at)}-${++n}`;
  const events: MatchEvent[] = [];
  for (const scorerId of scorerIds) {
    events.push({ id: id(), ts: at, type: 'TRY_US', payload: { scorerId, elapsedMs: 0 } });
  }
  for (let i = 0; i < triesThem; i++) {
    events.push({ id: id(), ts: at, type: 'TRY_THEM', payload: { elapsedMs: 0 } });
  }
  events.push({ id: id(), ts: at, type: 'MATCH_END', payload: { elapsedMs: 0 } });
  return events;
}
