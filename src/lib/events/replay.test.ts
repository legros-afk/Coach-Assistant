import { describe, it, expect } from 'vitest';
import { replayEvents } from './replay';
import type { MatchEvent, Player, TeamSheet } from './types';

// ─── fixtures ─────────────────────────────────────────────────────────────────

const mkEvent = (type: MatchEvent['type'], payload: Record<string, unknown>, id = '1'): MatchEvent =>
  ({ id, ts: '2026-09-14T10:00:00Z', type, payload } as MatchEvent);

const squad: Player[] = [
  { id: 'f1', name: 'Smith',    defaultGroup: 'forward',   eligibleGroups: ['forward'] },
  { id: 'f2', name: 'Jones',    defaultGroup: 'forward',   eligibleGroups: ['forward'] },
  { id: 'f3', name: 'Brown',    defaultGroup: 'forward',   eligibleGroups: ['forward', 'back'] },
  { id: 'f4', name: 'Davies',   defaultGroup: 'forward',   eligibleGroups: ['forward'] },
  { id: 'f5', name: 'Evans',    defaultGroup: 'forward',   eligibleGroups: ['forward'] },
  { id: 'b1', name: 'Khan',     defaultGroup: 'back',      eligibleGroups: ['back'] },
  { id: 'b2', name: 'Patel',    defaultGroup: 'back',      eligibleGroups: ['back'] },
  { id: 'b3', name: 'Lewis',    defaultGroup: 'back',      eligibleGroups: ['back', 'scrumhalf'] },
  { id: 'b4', name: 'Murphy',   defaultGroup: 'back',      eligibleGroups: ['back'] },
  { id: 'b5', name: 'Nolan',    defaultGroup: 'back',      eligibleGroups: ['back'] },
  { id: 's1', name: "O'Neill",  defaultGroup: 'scrumhalf', eligibleGroups: ['scrumhalf', 'back'] },
  { id: 'bf1', name: 'Patterson', defaultGroup: 'forward', eligibleGroups: ['forward'] },
  { id: 'bb1', name: 'Roberts',   defaultGroup: 'back',    eligibleGroups: ['back'] },
  { id: 'bs1', name: 'Taylor',    defaultGroup: 'scrumhalf', eligibleGroups: ['scrumhalf'] },
];

const teamSheet: TeamSheet = {
  id: 'ts1',
  label: 'A',
  starters: {
    forwards: ['f1', 'f2', 'f3', 'f4', 'f5'],
    backs:    ['b1', 'b2', 'b3', 'b4', 'b5'],
    scrumhalf: 's1',
  },
  bench: ['bf1', 'bb1', 'bs1'],
  unavailable: [],
};

// ─── tests ────────────────────────────────────────────────────────────────────

describe('replayEvents', () => {
  it('initial state with no events', () => {
    const state = replayEvents([], teamSheet, squad);
    expect(state.half).toBe(1);
    expect(state.elapsedMs).toBe(0);
    expect(state.running).toBe(false);
    expect(state.scoreUs).toBe(0);
    expect(state.scoreThem).toBe(0);

    expect(state.playerStates.get('f1')?.status).toBe('on');
    expect(state.playerStates.get('f1')?.activeGroup).toBe('forward');
    expect(state.playerStates.get('s1')?.activeGroup).toBe('scrumhalf');
    expect(state.playerStates.get('bf1')?.status).toBe('bench');
    expect(state.playerStates.get('bf1')?.minutesPlayed).toBe(0);
  });

  it('CLOCK_START sets running and marks stints', () => {
    const state = replayEvents([
      mkEvent('CLOCK_START', { half: 1 }),
    ], teamSheet, squad);

    expect(state.running).toBe(true);
    expect(state.playerStates.get('f1')?.currentStintStartedAtMs).toBe(0);
    expect(state.playerStates.get('bf1')?.currentStintStartedAtMs).toBeUndefined();
  });

  it('CLOCK_PAUSE finalises player stints', () => {
    const state = replayEvents([
      mkEvent('CLOCK_START', { half: 1 }, '1'),
      mkEvent('CLOCK_PAUSE', { elapsedMs: 600_000 }, '2'),
    ], teamSheet, squad);

    expect(state.running).toBe(false);
    expect(state.elapsedMs).toBe(600_000);
    expect(state.playerStates.get('f1')?.minutesPlayed).toBe(600_000);
    expect(state.playerStates.get('bf1')?.minutesPlayed).toBe(0);
    expect(state.playerStates.get('f1')?.currentStintStartedAtMs).toBeUndefined();
  });

  it('clock resume after pause accumulates correctly', () => {
    const state = replayEvents([
      mkEvent('CLOCK_START', { half: 1 }, '1'),
      mkEvent('CLOCK_PAUSE', { elapsedMs: 300_000 }, '2'),
      mkEvent('CLOCK_START', { half: 1 }, '3'),
      mkEvent('CLOCK_PAUSE', { elapsedMs: 600_000 }, '4'),
    ], teamSheet, squad);

    expect(state.playerStates.get('f1')?.minutesPlayed).toBe(600_000);
  });

  it('TRY_US increments score and attributes to scorer', () => {
    const state = replayEvents([
      mkEvent('TRY_US', { scorerId: 'f1', elapsedMs: 240_000 }),
    ], teamSheet, squad);

    expect(state.scoreUs).toBe(1);
    expect(state.scoreThem).toBe(0);
    expect(state.playerStates.get('f1')?.triesScored).toBe(1);
    expect(state.playerStates.get('f2')?.triesScored).toBe(0);
  });

  it('TRY_US without scorer still increments score', () => {
    const state = replayEvents([
      mkEvent('TRY_US', { elapsedMs: 240_000 }),
    ], teamSheet, squad);

    expect(state.scoreUs).toBe(1);
  });

  it('TRY_THEM increments opponent score', () => {
    const state = replayEvents([
      mkEvent('TRY_THEM', { elapsedMs: 300_000 }),
    ], teamSheet, squad);

    expect(state.scoreThem).toBe(1);
    expect(state.scoreUs).toBe(0);
  });

  it('SUB_BATCH swaps players and inherits active group', () => {
    const state = replayEvents([
      mkEvent('CLOCK_START', { half: 1 }, '1'),
      mkEvent('SUB_BATCH', { offIds: ['f1'], onIds: ['bf1'], elapsedMs: 600_000 }, '2'),
    ], teamSheet, squad);

    expect(state.playerStates.get('f1')?.status).toBe('bench');
    expect(state.playerStates.get('f1')?.minutesPlayed).toBe(600_000);
    expect(state.playerStates.get('bf1')?.status).toBe('on');
    expect(state.playerStates.get('bf1')?.activeGroup).toBe('forward');
    expect(state.playerStates.get('bf1')?.currentStintStartedAtMs).toBe(600_000);
  });

  it('SUB_BATCH mid-game accumulates partial stint for off-player', () => {
    const state = replayEvents([
      mkEvent('CLOCK_START', { half: 1 }, '1'),
      mkEvent('SUB_BATCH', { offIds: ['f1'], onIds: ['bf1'], elapsedMs: 720_000 }, '2'),
      mkEvent('CLOCK_PAUSE', { elapsedMs: 1_200_000 }, '3'),
    ], teamSheet, squad);

    // f1 played 0–720s, bf1 played 720s–1200s
    expect(state.playerStates.get('f1')?.minutesPlayed).toBe(720_000);
    expect(state.playerStates.get('bf1')?.minutesPlayed).toBe(480_000);
  });

  it('BLOOD_OFF removes player from pitch and stops their minutes', () => {
    const state = replayEvents([
      mkEvent('CLOCK_START', { half: 1 }, '1'),
      mkEvent('BLOOD_OFF', { playerId: 'b1', elapsedMs: 300_000 }, '2'),
    ], teamSheet, squad);

    expect(state.playerStates.get('b1')?.status).toBe('blood');
    expect(state.playerStates.get('b1')?.minutesPlayed).toBe(300_000);
    expect(state.playerStates.get('b1')?.currentStintStartedAtMs).toBeUndefined();
  });

  it('BLOOD_RETURN moves player back to bench', () => {
    const state = replayEvents([
      mkEvent('CLOCK_START', { half: 1 }, '1'),
      mkEvent('BLOOD_OFF',    { playerId: 'b1', elapsedMs: 300_000 }, '2'),
      mkEvent('BLOOD_RETURN', { playerId: 'b1', elapsedMs: 480_000 }, '3'),
    ], teamSheet, squad);

    expect(state.playerStates.get('b1')?.status).toBe('bench');
  });

  it('INJURED_OFF and INJURED_RETURN work like blood equivalents', () => {
    const state = replayEvents([
      mkEvent('CLOCK_START',   { half: 1 }, '1'),
      mkEvent('INJURED_OFF',   { playerId: 'f2', elapsedMs: 400_000 }, '2'),
      mkEvent('INJURED_RETURN',{ playerId: 'f2', elapsedMs: 600_000 }, '3'),
    ], teamSheet, squad);

    expect(state.playerStates.get('f2')?.minutesPlayed).toBe(400_000);
    expect(state.playerStates.get('f2')?.status).toBe('bench');
  });

  it('HALF_END finalises stints and stops clock', () => {
    const state = replayEvents([
      mkEvent('CLOCK_START', { half: 1 }, '1'),
      mkEvent('HALF_END',    { half: 1, elapsedMs: 1_200_000 }, '2'),
    ], teamSheet, squad);

    expect(state.running).toBe(false);
    expect(state.elapsedMs).toBe(1_200_000);
    expect(state.playerStates.get('f1')?.minutesPlayed).toBe(1_200_000);
    expect(state.playerStates.get('f1')?.currentStintStartedAtMs).toBeUndefined();
  });

  it('full match: both halves, sub, try', () => {
    const events: MatchEvent[] = [
      mkEvent('CLOCK_START', { half: 1 }, '1'),
      mkEvent('TRY_US',      { scorerId: 'b1', elapsedMs: 300_000 }, '2'),
      mkEvent('SUB_BATCH',   { offIds: ['f5'], onIds: ['bf1'], elapsedMs: 900_000 }, '3'),
      mkEvent('HALF_END',    { half: 1, elapsedMs: 1_200_000 }, '4'),
      mkEvent('CLOCK_START', { half: 2 }, '5'),
      mkEvent('TRY_THEM',    { elapsedMs: 1_500_000 }, '6'),
      mkEvent('MATCH_END',   { elapsedMs: 2_400_000 }, '7'),
    ];

    const state = replayEvents(events, teamSheet, squad);

    expect(state.half).toBe(2);
    expect(state.scoreUs).toBe(1);
    expect(state.scoreThem).toBe(1);
    expect(state.running).toBe(false);

    // f5 played 0–900s = 900_000 ms
    expect(state.playerStates.get('f5')?.minutesPlayed).toBe(900_000);
    // bf1 played 900s–1200s (h1) + 1200s–2400s (h2) = 300k + 1200k = 1_500_000 ms
    expect(state.playerStates.get('bf1')?.minutesPlayed).toBe(1_500_000);
    // f1 played all: 0–1200s + 1200s–2400s = 2_400_000 ms
    expect(state.playerStates.get('f1')?.minutesPlayed).toBe(2_400_000);

    expect(state.playerStates.get('b1')?.triesScored).toBe(1);
  });
});
