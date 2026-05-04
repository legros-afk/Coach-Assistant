import { describe, it, expect } from 'vitest';
import { suggestSub, suggestSubBatch } from './suggestSub';
import type { MatchState, Player } from '../events/types';

function makeMatchState(playerEntries: Array<{
  id: string;
  status: 'on' | 'bench' | 'blood' | 'injured';
  minutesPlayed: number;
}>): MatchState {
  const playerStates = new Map(playerEntries.map(e => [
    e.id,
    {
      status: e.status,
      activeGroup: 'forward' as const,
      minutesPlayed: e.minutesPlayed,
      triesScored: 0,
    },
  ]));
  return { half: 1, elapsedMs: 0, running: false, scoreUs: 0, scoreThem: 0, playerStates };
}

const fwd1: Player = { id: 'f1', name: 'Smith',   defaultGroup: 'forward', eligibleGroups: ['forward'] };
const fwd2: Player = { id: 'f2', name: 'Jones',   defaultGroup: 'forward', eligibleGroups: ['forward'] };
const back1: Player = { id: 'b1', name: 'Khan',    defaultGroup: 'back',    eligibleGroups: ['back'] };
const dualFB: Player = { id: 'd1', name: 'Brown',  defaultGroup: 'forward', eligibleGroups: ['forward', 'back'] };
const benchFwd1: Player = { id: 'bf1', name: 'Patterson', defaultGroup: 'forward', eligibleGroups: ['forward'] };
const benchFwd2: Player = { id: 'bf2', name: 'Quinn',     defaultGroup: 'forward', eligibleGroups: ['forward'] };

describe('suggestSub', () => {
  it('returns the bench player with fewest minutes', () => {
    const state = makeMatchState([
      { id: 'f1',  status: 'on',    minutesPlayed: 900_000 },
      { id: 'bf1', status: 'bench', minutesPlayed: 300_000 },
      { id: 'bf2', status: 'bench', minutesPlayed: 100_000 },
    ]);
    const allPlayers = [fwd1, benchFwd1, benchFwd2];
    const result = suggestSub(fwd1, allPlayers, state);
    expect(result?.id).toBe('bf2'); // least played
  });

  it('filters by eligible group — does not suggest a back for a forward slot', () => {
    const state = makeMatchState([
      { id: 'f1',  status: 'on',    minutesPlayed: 900_000 },
      { id: 'b1',  status: 'bench', minutesPlayed: 0 },
    ]);
    const allPlayers = [fwd1, back1];
    const result = suggestSub(fwd1, allPlayers, state);
    expect(result).toBeNull();
  });

  it('suggests a dual-eligible player for either group', () => {
    const state = makeMatchState([
      { id: 'f1',  status: 'on',    minutesPlayed: 900_000 },
      { id: 'd1',  status: 'bench', minutesPlayed: 0 },
    ]);
    const allPlayers = [fwd1, dualFB];
    const result = suggestSub(fwd1, allPlayers, state);
    expect(result?.id).toBe('d1');
  });

  it('returns null when no eligible bench player', () => {
    const state = makeMatchState([
      { id: 'f1',  status: 'on', minutesPlayed: 900_000 },
      { id: 'bf1', status: 'on', minutesPlayed: 0 },
    ]);
    const result = suggestSub(fwd1, [fwd1, benchFwd1], state);
    expect(result).toBeNull();
  });

  it('excludes blood and injured players from suggestions', () => {
    const state = makeMatchState([
      { id: 'f1',  status: 'on',    minutesPlayed: 900_000 },
      { id: 'bf1', status: 'blood', minutesPlayed: 100_000 },
    ]);
    const result = suggestSub(fwd1, [fwd1, benchFwd1], state);
    expect(result).toBeNull();
  });
});

describe('suggestSubBatch', () => {
  it('pairs multiple off-players greedily and does not reuse a bench player', () => {
    const state = makeMatchState([
      { id: 'f1',  status: 'on',    minutesPlayed: 900_000 },
      { id: 'f2',  status: 'on',    minutesPlayed: 850_000 },
      { id: 'bf1', status: 'bench', minutesPlayed: 200_000 },
      { id: 'bf2', status: 'bench', minutesPlayed: 100_000 },
    ]);
    const allPlayers = [fwd1, fwd2, benchFwd1, benchFwd2];
    const result = suggestSubBatch([fwd1, fwd2], allPlayers, state);

    expect(result).toHaveLength(2);
    const onIds = result.map(r => r.on?.id);
    expect(onIds).toContain('bf2');
    expect(onIds).toContain('bf1');
    expect(new Set(onIds).size).toBe(2); // no reuse
  });

  it('returns null for on-player when no eligible bench exists', () => {
    const state = makeMatchState([
      { id: 'f1',  status: 'on',    minutesPlayed: 900_000 },
      { id: 'b1',  status: 'bench', minutesPlayed: 0 },
    ]);
    const result = suggestSubBatch([fwd1], [fwd1, back1], state);
    expect(result[0].on).toBeNull();
  });
});
