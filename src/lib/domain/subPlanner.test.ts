import { describe, it, expect } from 'vitest';
import { planSubs } from './subPlanner';
import type { Group, ID, Player, PlayerMatchState, TeamSheet } from '../events/types';

const MIN = 60_000;
const GAME = 40 * MIN;
const TOLERANCE = 4 * MIN;

function player(id: ID, defaultGroup: Group, eligible?: Group[]): Player {
  return { id, name: id, defaultGroup, eligibleGroups: eligible ?? [defaultGroup] };
}

function state(
  status: PlayerMatchState['status'],
  group: Group,
  minutesPlayed: number,
  stintStart?: number,
): PlayerMatchState {
  return { status, activeGroup: group, minutesPlayed, triesScored: 0, currentStintStartedAtMs: stintStart };
}

// 2 forward slots, 3 forwards total; SH slot with one starter.
const squad: Player[] = [
  player('f1', 'forward'),
  player('f2', 'forward'),
  player('f3', 'forward'),
  player('sh1', 'scrumhalf'),
  player('b1', 'back', ['back', 'scrumhalf']),
];

const teamSheet: TeamSheet = {
  id: 'ts', label: 'A',
  starters: { forwards: ['f1', 'f2'], backs: [], scrumhalf: 'sh1' },
  bench: ['f3', 'b1'],
  unavailable: [],
};

describe('planSubs', () => {
  it('proposes a future swap from kickoff (proactive, not reactive)', () => {
    const states = new Map<ID, PlayerMatchState>([
      ['f1', state('on', 'forward', 0, 0)],
      ['f2', state('on', 'forward', 0, 0)],
      ['sh1', state('on', 'scrumhalf', 0, 0)],
      ['f3', state('bench', 'forward', 0)],
      ['b1', state('bench', 'back', 0)],
    ]);
    const plan = planSubs(squad, teamSheet, states, 0, GAME, TOLERANCE);
    const fwd = plan.find(s => s.group === 'forward');
    expect(fwd).toBeDefined();
    expect(fwd!.on.id).toBe('f3');
    expect(fwd!.dueNow).toBe(false);
    // fair share = 40 * 2/3 ≈ 26.7min; f3 must be on by 40 − 26.7 ≈ 13.3min
    expect(fwd!.dueAtMs).toBeGreaterThan(12 * MIN);
    expect(fwd!.dueAtMs).toBeLessThan(15 * MIN);
  });

  it('marks the swap due when the bench player must come on to reach fair share', () => {
    const states = new Map<ID, PlayerMatchState>([
      ['f1', state('on', 'forward', 14 * MIN, 14 * MIN)],
      ['f2', state('on', 'forward', 14 * MIN, 14 * MIN)],
      ['sh1', state('on', 'scrumhalf', 14 * MIN, 14 * MIN)],
      ['f3', state('bench', 'forward', 0)],
      ['b1', state('bench', 'back', 0)],
    ]);
    const plan = planSubs(squad, teamSheet, states, 14 * MIN, GAME, TOLERANCE);
    const fwd = plan.find(s => s.group === 'forward');
    expect(fwd).toBeDefined();
    expect(fwd!.dueNow).toBe(true);
    expect(fwd!.off.id).toMatch(/f[12]/);
  });

  it('uses eligibleGroups for bench candidates — a back covering SH rotates the scrum-half', () => {
    const states = new Map<ID, PlayerMatchState>([
      ['f1', state('on', 'forward', 0, 0)],
      ['f2', state('on', 'forward', 0, 0)],
      ['sh1', state('on', 'scrumhalf', 0, 0)],
      ['f3', state('bench', 'forward', 0)],
      ['b1', state('bench', 'back', 0)],
    ]);
    const plan = planSubs(squad, teamSheet, states, 0, GAME, TOLERANCE);
    const sh = plan.find(s => s.group === 'scrumhalf');
    expect(sh).toBeDefined();
    expect(sh!.on.id).toBe('b1');
    expect(sh!.off.id).toBe('sh1');
  });

  it('does not plan the same bench player into two groups', () => {
    const states = new Map<ID, PlayerMatchState>([
      ['f1', state('on', 'forward', 0, 0)],
      ['f2', state('on', 'forward', 0, 0)],
      ['sh1', state('on', 'scrumhalf', 0, 0)],
      ['f3', state('bench', 'forward', 0)],
      ['b1', state('bench', 'back', 0)],
    ]);
    const plan = planSubs(squad, teamSheet, states, 0, GAME, TOLERANCE);
    const ids = plan.map(s => s.on.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('skips bench players who already have their fair share', () => {
    const states = new Map<ID, PlayerMatchState>([
      ['f1', state('on', 'forward', 20 * MIN, 30 * MIN)],
      ['f2', state('on', 'forward', 20 * MIN, 30 * MIN)],
      ['sh1', state('on', 'scrumhalf', 30 * MIN, 30 * MIN)],
      ['f3', state('bench', 'forward', 26 * MIN)], // ≈ fair share of 26.7min
      ['b1', state('bench', 'back', 26 * MIN)],
    ]);
    const plan = planSubs(squad, teamSheet, states, 30 * MIN, GAME, TOLERANCE);
    expect(plan.find(s => s.group === 'forward')).toBeUndefined();
  });

  it('orders due-now swaps before future ones', () => {
    const states = new Map<ID, PlayerMatchState>([
      ['f1', state('on', 'forward', 20 * MIN, 20 * MIN)],
      ['f2', state('on', 'forward', 20 * MIN, 20 * MIN)],
      ['sh1', state('on', 'scrumhalf', 5 * MIN, 20 * MIN)],
      ['f3', state('bench', 'forward', 0)],
      ['b1', state('bench', 'back', 18 * MIN)],
    ]);
    const plan = planSubs(squad, teamSheet, states, 20 * MIN, GAME, TOLERANCE);
    for (let i = 1; i < plan.length; i++) {
      expect(Number(plan[i - 1].dueNow)).toBeGreaterThanOrEqual(Number(plan[i].dueNow));
    }
  });
});
