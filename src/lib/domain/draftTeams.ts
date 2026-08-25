import type { Group, ID, Player } from '../events/types';
import { teamLimits } from './validateComposition';

export type DraftAssignment = 'A' | 'B' | 'bench-A' | 'bench-B';
type ExistingAssignment = DraftAssignment | 'unavailable' | null;

export interface DraftOptions {
  players: Player[];
  /** Current assignments — anything already placed (starter or bench) is locked and drafted around. */
  existing: Map<ID, ExistingAssignment>;
  groupOverrides: Map<ID, Group>;
  playersPerSide: number;
  /** Season starts per player, used to give low-starts players priority to start. */
  starts: Map<ID, number>;
  rng?: () => number;
}

export interface DraftResult {
  /** Proposed placements for previously-unassigned players only. */
  assignments: Map<ID, DraftAssignment>;
  /** Slot group for each newly proposed starter. */
  groups: Map<ID, Group>;
}

// Scarcest group first, so SH-eligible players are spent on SH before F/B.
const GROUP_ORDER: Group[] = ['scrumhalf', 'forward', 'back'];
const NEUTRAL_IMPACT = 3;

const impactOf = (p: Player) => p.ratings?.impact ?? NEUTRAL_IMPACT;

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function draftTeams({ players, existing, groupOverrides, playersPerSide, starts, rng = Math.random }: DraftOptions): DraftResult {
  const limits = teamLimits(playersPerSide);
  const startsOf = (p: Player) => starts.get(p.id) ?? 0;

  interface TeamState {
    remaining: Record<Group, number>;
    impact: number;
    starts: number;
    benchCount: number;
  }
  const teams: Record<'A' | 'B', TeamState> = {
    A: { remaining: { forward: limits.f, back: limits.b, scrumhalf: limits.sh }, impact: 0, starts: 0, benchCount: 0 },
    B: { remaining: { forward: limits.f, back: limits.b, scrumhalf: limits.sh }, impact: 0, starts: 0, benchCount: 0 },
  };

  // Account for locked placements.
  for (const p of players) {
    const cur = existing.get(p.id) ?? null;
    if (cur === 'A' || cur === 'B') {
      const t = teams[cur];
      const g = groupOverrides.get(p.id) ?? p.defaultGroup;
      t.remaining[g] = Math.max(0, t.remaining[g] - 1);
      t.impact += impactOf(p);
      t.starts += startsOf(p);
    } else if (cur === 'bench-A') {
      teams.A.benchCount++;
    } else if (cur === 'bench-B') {
      teams.B.benchCount++;
    }
  }

  // rng shuffle up front; later stable sorts preserve it as the tie-break,
  // which is what makes Re-draft produce a different (but still fair) split.
  const pool = shuffle(players.filter(p => (existing.get(p.id) ?? null) === null), rng);

  const assignments = new Map<ID, DraftAssignment>();
  const groups = new Map<ID, Group>();
  const taken = new Set<ID>();

  const pickTeam = (g: Group): 'A' | 'B' | null => {
    const canA = teams.A.remaining[g] > 0;
    const canB = teams.B.remaining[g] > 0;
    if (!canA && !canB) return null;
    if (canA !== canB) return canA ? 'A' : 'B';
    if (teams.A.impact !== teams.B.impact) return teams.A.impact < teams.B.impact ? 'A' : 'B';
    if (teams.A.starts !== teams.B.starts) return teams.A.starts < teams.B.starts ? 'A' : 'B';
    return rng() < 0.5 ? 'A' : 'B';
  };

  for (const g of GROUP_ORDER) {
    const need = teams.A.remaining[g] + teams.B.remaining[g];
    if (need === 0) continue;
    const candidates = pool
      .filter(p => !taken.has(p.id) && p.eligibleGroups.includes(g))
      // Natural players in this group before cover players; then fewest starts first.
      .sort((a, b) =>
        (a.defaultGroup === g ? 0 : 1) - (b.defaultGroup === g ? 0 : 1) ||
        startsOf(a) - startsOf(b));
    const chosen = candidates.slice(0, need)
      // Strongest first so the greedy balance below spreads them evenly.
      .sort((a, b) => impactOf(b) - impactOf(a));
    for (const p of chosen) {
      const team = pickTeam(g);
      if (!team) break;
      assignments.set(p.id, team);
      groups.set(p.id, g);
      taken.add(p.id);
      teams[team].remaining[g]--;
      teams[team].impact += impactOf(p);
      teams[team].starts += startsOf(p);
    }
  }

  // Everyone still unplaced goes on a bench — evens out the two benches.
  for (const p of pool) {
    if (taken.has(p.id)) continue;
    const team = teams.A.benchCount !== teams.B.benchCount
      ? (teams.A.benchCount < teams.B.benchCount ? 'A' : 'B')
      : (rng() < 0.5 ? 'A' : 'B');
    assignments.set(p.id, `bench-${team}`);
    teams[team].benchCount++;
  }

  return { assignments, groups };
}
