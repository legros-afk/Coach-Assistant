import { describe, it, expect } from 'vitest';
import { planSubs } from './subPlanner';
import type { Group, ID, Player, PlayerMatchState, TeamSheet } from '../events/types';

const MIN = 60_000;
const GAME = 40 * MIN;
const HALF = 20 * MIN;

const opts = (halfEnded = false, secondHalfStarted = false) =>
  ({ gameLengthMs: GAME, halfLengthMs: HALF, minimumMs: HALF, halfEnded, secondHalfStarted });

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
  const kickoff = () => new Map<ID, PlayerMatchState>([
    ['f1', state('on', 'forward', 0, 0)],
    ['f2', state('on', 'forward', 0, 0)],
    ['sh1', state('on', 'scrumhalf', 0, 0)],
    ['f3', state('bench', 'forward', 0)],
    ['b1', state('bench', 'back', 0)],
  ]);

  it('plans bench players on at half time, not during the first half', () => {
    const plan = planSubs(squad, teamSheet, kickoff(), 0, opts());
    const fwd = plan.find(s => s.group === 'forward');
    expect(fwd).toBeDefined();
    expect(fwd!.on.id).toBe('f3');
    expect(fwd!.atHalfTime).toBe(true);
    expect(fwd!.dueAtMs).toBe(HALF);
    expect(fwd!.dueNow).toBe(false);
  });

  it('marks half-time swaps due once the half-time whistle has gone', () => {
    const states = new Map<ID, PlayerMatchState>([
      ['f1', state('on', 'forward', 20 * MIN, 0)],
      ['f2', state('on', 'forward', 20 * MIN, 0)],
      ['sh1', state('on', 'scrumhalf', 20 * MIN, 0)],
      ['f3', state('bench', 'forward', 0)],
      ['b1', state('bench', 'back', 0)],
    ]);
    // stints closed at the break: minutesPlayed already includes the half
    for (const id of ['f1', 'f2', 'sh1']) states.get(id)!.currentStintStartedAtMs = undefined;
    const plan = planSubs(squad, teamSheet, states, 20 * MIN, opts(true, false));
    expect(plan.length).toBeGreaterThan(0);
    expect(plan.every(s => s.atHalfTime && s.dueNow)).toBe(true);
  });

  it('uses eligibleGroups for bench candidates — a back covering SH rotates the scrum-half', () => {
    const plan = planSubs(squad, teamSheet, kickoff(), 0, opts());
    const sh = plan.find(s => s.group === 'scrumhalf');
    expect(sh).toBeDefined();
    expect(sh!.on.id).toBe('b1');
    expect(sh!.off.id).toBe('sh1');
  });

  it('does not plan the same bench player into two groups', () => {
    const plan = planSubs(squad, teamSheet, kickoff(), 0, opts());
    const ids = plan.map(s => s.on.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('skips bench players who already have the minimum', () => {
    const states = new Map<ID, PlayerMatchState>([
      ['f1', state('on', 'forward', 20 * MIN, 30 * MIN)],
      ['f2', state('on', 'forward', 20 * MIN, 30 * MIN)],
      ['sh1', state('on', 'scrumhalf', 30 * MIN, 30 * MIN)],
      ['f3', state('bench', 'forward', 20 * MIN)],
      ['b1', state('bench', 'back', 20 * MIN)],
    ]);
    const plan = planSubs(squad, teamSheet, states, 30 * MIN, opts(true, true));
    expect(plan).toHaveLength(0);
  });

  it('plans a second-half swap only as late as the minimum allows', () => {
    // f3 has 5 minutes, needs 15 more: must be on by 25'
    const states = new Map<ID, PlayerMatchState>([
      ['f1', state('on', 'forward', 20 * MIN, 20 * MIN)],
      ['f2', state('on', 'forward', 20 * MIN, 20 * MIN)],
      ['sh1', state('on', 'scrumhalf', 20 * MIN, 20 * MIN)],
      ['f3', state('bench', 'forward', 5 * MIN)],
      ['b1', state('bench', 'back', 20 * MIN)],
    ]);
    const early = planSubs(squad, teamSheet, states, 21 * MIN, opts(true, true));
    expect(early[0].dueAtMs).toBe(25 * MIN);
    expect(early[0].dueNow).toBe(false);
    const late = planSubs(squad, teamSheet, states, 25 * MIN, opts(true, true));
    expect(late[0].dueNow).toBe(true);
  });

  it('batches in-play swaps in the same half into one stoppage', () => {
    const big: Player[] = [
      player('f1', 'forward'), player('f2', 'forward'),
      player('sh1', 'scrumhalf'), player('f3', 'forward'), player('sh2', 'scrumhalf'),
    ];
    const states = new Map<ID, PlayerMatchState>([
      ['f1', state('on', 'forward', 20 * MIN, 20 * MIN)],
      ['f2', state('on', 'forward', 20 * MIN, 20 * MIN)],
      ['sh1', state('on', 'scrumhalf', 20 * MIN, 20 * MIN)],
      ['f3', state('bench', 'forward', 5 * MIN)],    // must be on by 25'
      ['sh2', state('bench', 'scrumhalf', 10 * MIN)], // must be on by 30'
    ]);
    const plan = planSubs(big, teamSheet, states, 21 * MIN, opts(true, true));
    expect(plan).toHaveLength(2);
    expect(new Set(plan.map(s => s.dueAtMs))).toEqual(new Set([25 * MIN]));
  });
});
