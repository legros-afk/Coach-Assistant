import { describe, expect, it } from 'vitest';
import type { Group, ID, Player } from '../events/types';
import { draftTeams } from './draftTeams';

const fixedRng = () => 0.4999;

let seq = 0;
function player(name: string, defaultGroup: Group, eligible?: Group[], impact?: 1 | 2 | 3 | 4 | 5): Player {
  return {
    id: `p${++seq}-${name}`,
    name,
    defaultGroup,
    eligibleGroups: eligible ?? [defaultGroup],
    ...(impact ? { ratings: { impact, development: 3 as const } } : {}),
  };
}

function squadFor7s(): Player[] {
  // 7-a-side: 5F, 1B, 1SH per team → need 10F, 2B, 2SH starters.
  const players: Player[] = [];
  for (let i = 0; i < 11; i++) players.push(player(`F${i}`, 'forward'));
  for (let i = 0; i < 4; i++) players.push(player(`B${i}`, 'back'));
  players.push(player('SH0', 'back', ['back', 'scrumhalf']));
  players.push(player('SH1', 'back', ['back', 'scrumhalf']));
  return players;
}

const emptyExisting = () => new Map<ID, null>();
const emptyOverrides = () => new Map<ID, Group>();
const noStarts = () => new Map<ID, number>();

function run(players: Player[], opts: Partial<Parameters<typeof draftTeams>[0]> = {}) {
  return draftTeams({
    players,
    existing: emptyExisting(),
    groupOverrides: emptyOverrides(),
    playersPerSide: 7,
    starts: noStarts(),
    rng: fixedRng,
    ...opts,
  });
}

function countByTeam(players: Player[], result: ReturnType<typeof draftTeams>) {
  const count = { A: { forward: 0, back: 0, scrumhalf: 0 }, B: { forward: 0, back: 0, scrumhalf: 0 }, benchA: 0, benchB: 0 };
  for (const p of players) {
    const a = result.assignments.get(p.id);
    if (a === 'A' || a === 'B') count[a][result.groups.get(p.id)!]++;
    else if (a === 'bench-A') count.benchA++;
    else if (a === 'bench-B') count.benchB++;
  }
  return count;
}

describe('draftTeams', () => {
  it('fills a valid composition for both teams and benches the rest', () => {
    const players = squadFor7s();
    const result = run(players);
    const c = countByTeam(players, result);
    for (const t of ['A', 'B'] as const) {
      expect(c[t]).toEqual({ forward: 5, back: 1, scrumhalf: 1 });
    }
    // 17 players, 14 starters → 3 benched, spread across the teams.
    expect(c.benchA + c.benchB).toBe(3);
    expect(Math.abs(c.benchA - c.benchB)).toBeLessThanOrEqual(1);
    // Everyone available got placed somewhere.
    expect(result.assignments.size).toBe(players.length);
  });

  it('leaves a gap rather than filling an ineligible slot when SH is scarce', () => {
    const players = squadFor7s().filter(p => p.name !== 'SH1');
    const result = run(players);
    const c = countByTeam(players, result);
    expect(c.A.scrumhalf + c.B.scrumhalf).toBe(1);
    // The spare back is never drafted into the SH hole.
    for (const p of players) {
      if (result.groups.get(p.id) === 'scrumhalf') {
        expect(p.eligibleGroups).toContain('scrumhalf');
      }
    }
  });

  it('gives players with fewest starts priority to start', () => {
    const players = squadFor7s();
    const starts = new Map<ID, number>();
    // The eleventh forward can't start (only 10 F slots). Make F0 the most-started.
    const forwards = players.filter(p => p.defaultGroup === 'forward');
    forwards.forEach((p, i) => starts.set(p.id, i === 0 ? 5 : 1));
    const result = run(players, { starts });
    const f0 = forwards[0];
    expect(result.assignments.get(f0.id)).toMatch(/^bench-/);
  });

  it('prefers natural scrum-halves over cover players for SH slots', () => {
    const players = squadFor7s();
    players.push(player('CoverF', 'forward', ['forward', 'scrumhalf']));
    const result = run(players);
    const shNames = players
      .filter(p => result.groups.get(p.id) === 'scrumhalf')
      .map(p => p.name);
    expect(shNames).not.toContain('CoverF');
  });

  it('drafts around locked placements without moving them', () => {
    const players = squadFor7s();
    const locked = players.filter(p => p.defaultGroup === 'forward').slice(0, 3);
    const existing = new Map<ID, 'A' | null>();
    const overrides = new Map<ID, Group>();
    for (const p of locked) { existing.set(p.id, 'A'); overrides.set(p.id, 'forward'); }
    const result = run(players, { existing, groupOverrides: overrides });
    // Locked players get no new proposal…
    for (const p of locked) expect(result.assignments.has(p.id)).toBe(false);
    // …and Team A only receives the 2 forwards it still needs.
    const c = countByTeam(players, result);
    expect(c.A.forward).toBe(2);
    expect(c.B.forward).toBe(5);
  });

  it('never drafts unavailable players', () => {
    const players = squadFor7s();
    const out = players[0];
    const existing = new Map<ID, 'unavailable' | null>([[out.id, 'unavailable']]);
    const result = run(players, { existing });
    expect(result.assignments.has(out.id)).toBe(false);
  });

  it('spreads impact ratings evenly across the teams', () => {
    const players: Player[] = [];
    const impacts: (1 | 2 | 3 | 4 | 5)[] = [5, 5, 4, 4, 3, 3, 2, 2, 1, 1];
    impacts.forEach((imp, i) => players.push(player(`F${i}`, 'forward', undefined, imp)));
    players.push(player('B0', 'back'), player('B1', 'back'));
    players.push(player('SH0', 'back', ['back', 'scrumhalf']), player('SH1', 'back', ['back', 'scrumhalf']));
    const result = run(players);
    const sum = (t: 'A' | 'B') => players
      .filter(p => result.assignments.get(p.id) === t && result.groups.get(p.id) === 'forward')
      .reduce((s, p) => s + (p.ratings?.impact ?? 3), 0);
    expect(Math.abs(sum('A') - sum('B'))).toBeLessThanOrEqual(1);
  });
});
