import type { Fixture, ID, Match, Player } from '../events/types';
import { replayEvents } from '../events/replay';
import { seasonFor } from './season';

export interface PlayerSeason {
  games: number;
  starts: number;
  minutes: number;
  tries: number;
}

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Per-player totals from matches actually played this season: games, starts
 * (from each match's own team sheet), minutes and tries (from its events).
 */
export function seasonStats(
  fixtures: Fixture[],
  matches: Match[],
  players: Player[],
  season: string,
): Map<ID, PlayerSeason> {
  const out = new Map<ID, PlayerSeason>();
  const get = (id: ID) => {
    let s = out.get(id);
    if (!s) { s = { games: 0, starts: 0, minutes: 0, tries: 0 }; out.set(id, s); }
    return s;
  };
  const byId = new Map(fixtures.map(f => [f.id, f]));

  for (const m of matches) {
    if (m.events.length === 0) continue;
    const f = byId.get(m.fixtureId);
    if (!f || seasonFor(parseIso(f.date)) !== season) continue;
    const ts = f.teamSheets.find(t => t.id === m.teamSheetId);
    if (!ts) continue;

    const starters = new Set<ID>([...ts.starters.forwards, ...ts.starters.backs]);
    if (ts.starters.scrumhalf) starters.add(ts.starters.scrumhalf);

    const state = replayEvents(m.events, ts, players);
    for (const [id, ps] of state.playerStates) {
      const started = starters.has(id);
      if (!started && ps.minutesPlayed <= 0) continue;
      const s = get(id);
      s.games += 1;
      if (started) s.starts += 1;
      s.minutes += ps.minutesPlayed / 60_000;
      s.tries += ps.triesScored;
    }
  }
  return out;
}
