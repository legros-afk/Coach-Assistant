import { describe, it, expect } from 'vitest';
import { validateComposition, projectOnPitchGroups } from './validateComposition';
import type { Group, ID, PlayerMatchState } from '../events/types';

describe('validateComposition', () => {
  const valid5x5x1: Group[] = [
    'forward', 'forward', 'forward', 'forward', 'forward',
    'back', 'back', 'back', 'back', 'back',
    'scrumhalf',
  ];

  it('accepts exactly 5F 5B 1SH', () => {
    const result = validateComposition(valid5x5x1);
    expect(result.valid).toBe(true);
    expect(result.message).toBe('');
  });

  it('rejects 6F 4B 1SH', () => {
    const groups: Group[] = [
      'forward', 'forward', 'forward', 'forward', 'forward', 'forward',
      'back', 'back', 'back', 'back',
      'scrumhalf',
    ];
    const result = validateComposition(groups);
    expect(result.valid).toBe(false);
    expect(result.message).toContain('6F');
    expect(result.counts.forward).toBe(6);
  });

  it('rejects missing scrumhalf', () => {
    const groups: Group[] = [
      'forward', 'forward', 'forward', 'forward', 'forward',
      'back', 'back', 'back', 'back', 'back', 'back',
    ];
    const result = validateComposition(groups);
    expect(result.valid).toBe(false);
    expect(result.counts.scrumhalf).toBe(0);
  });

  it('rejects empty pitch', () => {
    const result = validateComposition([]);
    expect(result.valid).toBe(false);
  });
});

describe('projectOnPitchGroups', () => {
  function makeState(entries: Array<[ID, Partial<PlayerMatchState>]>): Map<ID, PlayerMatchState> {
    const m = new Map<ID, PlayerMatchState>();
    for (const [id, partial] of entries) {
      m.set(id, {
        status: 'on',
        activeGroup: 'forward',
        minutesPlayed: 0,
        triesScored: 0,
        ...partial,
      });
    }
    return m;
  }

  it('removes off-players and adds on-player groups', () => {
    const states = makeState([
      ['f1', { activeGroup: 'forward' }],
      ['f2', { activeGroup: 'forward' }],
      ['b1', { activeGroup: 'back' }],
    ]);
    const onGroups = new Map<ID, Group>([['sub1', 'forward']]);
    const result = projectOnPitchGroups(states, ['f1'], onGroups);
    expect(result).toContain('forward');
    expect(result).toContain('back');
    expect(result.length).toBe(3); // f2 + b1 + sub1
    expect(result.filter(g => g === 'forward').length).toBe(2);
  });

  it('ignores bench/blood/injured players', () => {
    const states = makeState([
      ['f1', { status: 'on',    activeGroup: 'forward' }],
      ['f2', { status: 'bench', activeGroup: 'forward' }],
      ['b1', { status: 'blood', activeGroup: 'back' }],
    ]);
    const result = projectOnPitchGroups(states, [], new Map());
    expect(result).toEqual(['forward']);
  });
});
