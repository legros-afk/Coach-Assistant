import { create } from 'zustand';
import { replayEvents } from '@/lib/events/replay';
import type { ID, MatchEvent, MatchState, Player, TeamSheet } from '@/lib/events/types';
import { DEMO_SQUAD, DEMO_TEAM_SHEET } from './mockData';

let _seq = 0;
const newId = () => `${Date.now()}-${++_seq}`;
const nowIso = () => new Date().toISOString();

interface MatchStore {
  squad: Player[];
  teamSheet: TeamSheet;
  events: MatchEvent[];
  matchState: MatchState;

  // wall-clock tracking for live elapsed (not in events)
  clockRunning: boolean;
  clockStartedAt: number | null;
  baseElapsedMs: number;

  currentElapsedMs: () => number;
  startClock: () => void;
  pauseClock: () => void;
  endHalf: () => void;
  recordTryUs: (scorerId?: ID) => void;
  recordTryThem: () => void;
  commitSubBatch: (offIds: ID[], onIds: ID[]) => void;
  bloodOff: (playerId: ID, replacementId?: ID) => void;
  bloodReturn: (playerId: ID) => void;
  injuredOff: (playerId: ID, replacementId?: ID) => void;
  injuredReturn: (playerId: ID) => void;
  undoLast: () => void;
}

function withEvent(
  state: MatchStore,
  event: MatchEvent,
): Partial<MatchStore> {
  const events = [...state.events, event];
  return { events, matchState: replayEvents(events, state.teamSheet, state.squad) };
}

export const useMatchStore = create<MatchStore>()((set, get) => ({
  squad: DEMO_SQUAD,
  teamSheet: DEMO_TEAM_SHEET,
  events: [],
  matchState: replayEvents([], DEMO_TEAM_SHEET, DEMO_SQUAD),

  clockRunning: false,
  clockStartedAt: null,
  baseElapsedMs: 0,

  currentElapsedMs: () => {
    const { clockRunning, clockStartedAt, baseElapsedMs } = get();
    return clockRunning && clockStartedAt !== null
      ? baseElapsedMs + (Date.now() - clockStartedAt)
      : baseElapsedMs;
  },

  startClock: () => {
    const state = get();
    const hasHalf1End = state.events.some(
      e => e.type === 'HALF_END' && (e as Extract<MatchEvent, { type: 'HALF_END' }>).payload.half === 1,
    );
    const half: 1 | 2 = hasHalf1End ? 2 : 1;
    const event: MatchEvent = { id: newId(), ts: nowIso(), type: 'CLOCK_START', payload: { half } };
    set({ clockRunning: true, clockStartedAt: Date.now(), ...withEvent(state, event) });
  },

  pauseClock: () => {
    const state = get();
    const elapsedMs = state.currentElapsedMs();
    const event: MatchEvent = { id: newId(), ts: nowIso(), type: 'CLOCK_PAUSE', payload: { elapsedMs } };
    set({ clockRunning: false, clockStartedAt: null, baseElapsedMs: elapsedMs, ...withEvent(state, event) });
  },

  endHalf: () => {
    const state = get();
    const elapsedMs = state.currentElapsedMs();
    const half = state.matchState.half;
    const event: MatchEvent = { id: newId(), ts: nowIso(), type: 'HALF_END', payload: { half, elapsedMs } };
    set({ clockRunning: false, clockStartedAt: null, baseElapsedMs: elapsedMs, ...withEvent(state, event) });
  },

  recordTryUs: (scorerId) => {
    const state = get();
    const event: MatchEvent = {
      id: newId(), ts: nowIso(), type: 'TRY_US',
      payload: { scorerId, elapsedMs: state.currentElapsedMs() },
    };
    set(withEvent(state, event));
  },

  recordTryThem: () => {
    const state = get();
    const event: MatchEvent = {
      id: newId(), ts: nowIso(), type: 'TRY_THEM',
      payload: { elapsedMs: state.currentElapsedMs() },
    };
    set(withEvent(state, event));
  },

  commitSubBatch: (offIds, onIds) => {
    const state = get();
    const event: MatchEvent = {
      id: newId(), ts: nowIso(), type: 'SUB_BATCH',
      payload: { offIds, onIds, elapsedMs: state.currentElapsedMs() },
    };
    set(withEvent(state, event));
  },

  bloodOff: (playerId, replacementId) => {
    const state = get();
    const event: MatchEvent = {
      id: newId(), ts: nowIso(), type: 'BLOOD_OFF',
      payload: { playerId, replacementId, elapsedMs: state.currentElapsedMs() },
    };
    set(withEvent(state, event));
  },

  bloodReturn: (playerId) => {
    const state = get();
    const event: MatchEvent = {
      id: newId(), ts: nowIso(), type: 'BLOOD_RETURN',
      payload: { playerId, elapsedMs: state.currentElapsedMs() },
    };
    set(withEvent(state, event));
  },

  injuredOff: (playerId, replacementId) => {
    const state = get();
    const event: MatchEvent = {
      id: newId(), ts: nowIso(), type: 'INJURED_OFF',
      payload: { playerId, replacementId, elapsedMs: state.currentElapsedMs() },
    };
    set(withEvent(state, event));
  },

  injuredReturn: (playerId) => {
    const state = get();
    const event: MatchEvent = {
      id: newId(), ts: nowIso(), type: 'INJURED_RETURN',
      payload: { playerId, elapsedMs: state.currentElapsedMs() },
    };
    set(withEvent(state, event));
  },

  undoLast: () => {
    const { events, squad, teamSheet, clockRunning } = get();
    if (events.length === 0) return;
    const last = events[events.length - 1];
    const newEvents = events.slice(0, -1);
    const newMatchState = replayEvents(newEvents, teamSheet, squad);
    const clockPatch: Partial<MatchStore> = {};
    // sync live clock state when undoing clock events
    if (last.type === 'CLOCK_START' && clockRunning) {
      clockPatch.clockRunning = false;
      clockPatch.clockStartedAt = null;
      clockPatch.baseElapsedMs = newMatchState.elapsedMs;
    } else if ((last.type === 'CLOCK_PAUSE' || last.type === 'HALF_END') && !clockRunning) {
      clockPatch.clockRunning = true;
      clockPatch.clockStartedAt = Date.now();
      clockPatch.baseElapsedMs = newMatchState.elapsedMs;
    }
    set({ events: newEvents, matchState: newMatchState, ...clockPatch });
  },
}));
