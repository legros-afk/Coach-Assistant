import type { Group, ID, Player } from '../events/types';
import { teamLimits } from './validateComposition';

type Team = 'A' | 'B';
type Assignment = Team | 'bench-A' | 'bench-B' | 'unavailable' | null;

export interface RefitOptions {
  players: Player[];
  /** What each player is down as, with one-team mode's unpicked already counted as bench-A. */
  assignments: Map<ID, Assignment>;
  groupOverrides: Map<ID, Group>;
  playersPerSide: number;
  /** Play so far this season; least played step up first, most played step down first. */
  played: Map<ID, number>;
  teamCount: 1 | 2;
}

export interface RefitResult {
  /** Only the players who moved. */
  assignments: Map<ID, Assignment>;
  /** Group for each player who stepped up into the starting side. */
  groups: Map<ID, Group>;
  up: { id: ID; team: Team }[];
  down: { id: ID; team: Team }[];
  /** Places a team still couldn't fill from its own bench. */
  short: Record<Team, number>;
}

const GROUPS: Group[] = ['scrumhalf', 'forward', 'back'];

/**
 * A last-minute change of format (10-a-side to 12, or back): move players
 * between each team's starting side and its own bench until the shape fits.
 * Only a team that already has starters is touched.
 */
export function refitToFormat({ players, assignments, groupOverrides, playersPerSide, played, teamCount }: RefitOptions): RefitResult {
  const limits = teamLimits(playersPerSide);
  const limitOf: Record<Group, number> = { forward: limits.f, back: limits.b, scrumhalf: limits.sh };
  const playedOf = (p: Player) => played.get(p.id) ?? 0;
  const groupOf = (p: Player) => groupOverrides.get(p.id) ?? p.defaultGroup;
  const byName = (a: Player, b: Player) => a.name.localeCompare(b.name);

  const out: RefitResult = { assignments: new Map(), groups: new Map(), up: [], down: [], short: { A: 0, B: 0 } };
  const now = (p: Player) => out.assignments.has(p.id) ? out.assignments.get(p.id)! : assignments.get(p.id) ?? null;

  const teams: Team[] = teamCount === 2 ? ['A', 'B'] : ['A'];
  for (const team of teams) {
    const bench = `bench-${team}` as const;
    if (!players.some(p => now(p) === team)) continue;

    // Too many in a group: the most played sit down first
    for (const g of GROUPS) {
      const inGroup = players.filter(p => now(p) === team && groupOf(p) === g)
        .sort((a, b) => playedOf(b) - playedOf(a) || byName(a, b));
      for (const p of inGroup.slice(0, Math.max(0, inGroup.length - limitOf[g]))) {
        out.assignments.set(p.id, bench);
        out.down.push({ id: p.id, team });
      }
    }

    // Too few: the least played from this team's bench step up, natural
    // players in that group before those who can cover it
    for (const g of GROUPS) {
      let need = limitOf[g] - players.filter(p => now(p) === team && (out.groups.get(p.id) ?? groupOf(p)) === g).length;
      if (need <= 0) continue;
      const candidates = players
        .filter(p => now(p) === bench && p.eligibleGroups.includes(g) && !out.down.some(d => d.id === p.id))
        .sort((a, b) =>
          (a.defaultGroup === g ? 0 : 1) - (b.defaultGroup === g ? 0 : 1) ||
          playedOf(a) - playedOf(b) || byName(a, b));
      for (const p of candidates) {
        if (need === 0) break;
        out.assignments.set(p.id, team);
        out.groups.set(p.id, g);
        out.up.push({ id: p.id, team });
        need--;
      }
      out.short[team] += need;
    }
  }
  return out;
}
