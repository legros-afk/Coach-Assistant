import { create } from 'zustand';
import { db } from '@/lib/db/db';
import { replayEvents } from '@/lib/events/replay';
import type { ID, Match, MatchEvent, MatchState, Player, TeamSheet } from '@/lib/events/types';
import { FOLDER_ID_KEY } from '@/lib/drive/driveRead';
import { publishMatch } from '@/lib/drive/drivePublish';
import { DEMO_SQUAD, DEMO_TEAM_SHEET } from './mockData';

let _seq = 0;
const newId = () => `${Date.now()}-${++_seq}`;
const nowIso = () => new Date().toISOString();

export interface InitMatchArgs {
  fixtureId: string;
  teamSheet: TeamSheet;
  squad: Player[];
  opponent: string;
}

interface MatchStore {
  matchId: string | null;
  fixtureId: string | null;
  opponent: string;
  squad: Player[];
  teamSheet: TeamSheet;
  events: MatchEvent[];
  matchState: MatchState;
  isHydrated: boolean;

  clockRunning: boolean;
  clockStartedAt: number | null;
  baseElapsedMs: number;

  currentElapsedMs: () => number;
  initMatch: (args: InitMatchArgs) => Promise<void>;
  initDemoMatch: () => Promise<void>;
  loadStoredMatch: (match: Match, teamSheet: TeamSheet, players: Player[]) => void;
  startClock: () => void;
  pauseClock: () => void;
  endHalf: () => void;
  endMatch: () => void;
  recordTryUs: (scorerId?: ID) => void;
  recordTryThem: () => void;
  recordConversionUs: (kickerId?: ID) => void;
  recordConversionThem: () => void;
  recordPenaltyUs: (kickerId?: ID) => void;
  recordPenaltyThem: () => void;
  recordDropGoalUs: (scorerId?: ID) => void;
  recordDropGoalThem: () => void;
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
): Pick<MatchStore, 'events' | 'matchState'> {
  const events = [...state.events, event];
  return { events, matchState: replayEvents(events, state.teamSheet, state.squad) };
}

async function loadMatchState(
  matchId: string,
  fixtureId: string,
  opponent: string,
  teamSheet: TeamSheet,
  squad: Player[],
): Promise<Partial<MatchStore>> {
  const stored = await db.matches.get(matchId);
  if (stored && stored.events.length > 0) {
    const matchState = replayEvents(stored.events, teamSheet, squad);
    return {
      matchId, fixtureId, opponent, squad, teamSheet,
      events: stored.events, matchState,
      baseElapsedMs: matchState.elapsedMs,
      clockRunning: false, clockStartedAt: null, isHydrated: true,
    };
  }
  return {
    matchId, fixtureId, opponent, squad, teamSheet,
    events: [], matchState: replayEvents([], teamSheet, squad),
    baseElapsedMs: 0,
    clockRunning: false, clockStartedAt: null, isHydrated: true,
  };
}

export const useMatchStore = create<MatchStore>()((set, get) => {
  function persist(events: MatchEvent[]): void {
    const { matchId, fixtureId, teamSheet, opponent } = get();
    if (!matchId) return;
    db.matches.put({
      id: matchId,
      fixtureId: fixtureId ?? matchId,
      teamSheetId: teamSheet.id,
      opponent,
      events,
      startedAt: undefined,
      endedAt: undefined,
      version: 1,
    });
  }

  return {
    matchId: null,
    fixtureId: null,
    opponent: '',
    squad: DEMO_SQUAD,
    teamSheet: DEMO_TEAM_SHEET,
    events: [],
    matchState: replayEvents([], DEMO_TEAM_SHEET, DEMO_SQUAD),
    isHydrated: false,

    clockRunning: false,
    clockStartedAt: null,
    baseElapsedMs: 0,

    currentElapsedMs: () => {
      const { clockRunning, clockStartedAt, baseElapsedMs } = get();
      return clockRunning && clockStartedAt !== null
        ? baseElapsedMs + (Date.now() - clockStartedAt)
        : baseElapsedMs;
    },

    initMatch: async ({ fixtureId, teamSheet, squad, opponent }) => {
      const patch = await loadMatchState(teamSheet.id, fixtureId, opponent, teamSheet, squad);
      set(patch as MatchStore);
    },

    loadStoredMatch: (match, teamSheet, players) => {
      const matchState = replayEvents(match.events, teamSheet, players);
      set({
        matchId: match.id,
        fixtureId: match.fixtureId,
        opponent: match.opponent,
        squad: players,
        teamSheet,
        events: match.events,
        matchState,
        baseElapsedMs: matchState.elapsedMs,
        clockRunning: false,
        clockStartedAt: null,
        isHydrated: true,
      });
    },

    initDemoMatch: async () => {
      const patch = await loadMatchState(
        DEMO_TEAM_SHEET.id, 'demo-fixture', 'Opponents', DEMO_TEAM_SHEET, DEMO_SQUAD,
      );
      set(patch as MatchStore);
    },

    startClock: () => {
      const state = get();
      const hasHalf1End = state.events.some(
        e => e.type === 'HALF_END' && (e as Extract<MatchEvent, { type: 'HALF_END' }>).payload.half === 1,
      );
      const half: 1 | 2 = hasHalf1End ? 2 : 1;
      const event: MatchEvent = { id: newId(), ts: nowIso(), type: 'CLOCK_START', payload: { half } };
      const patch = withEvent(state, event);
      set({ clockRunning: true, clockStartedAt: Date.now(), ...patch });
      persist(patch.events);
    },

    pauseClock: () => {
      const state = get();
      const elapsedMs = state.currentElapsedMs();
      const event: MatchEvent = { id: newId(), ts: nowIso(), type: 'CLOCK_PAUSE', payload: { elapsedMs } };
      const patch = withEvent(state, event);
      set({ clockRunning: false, clockStartedAt: null, baseElapsedMs: elapsedMs, ...patch });
      persist(patch.events);
    },

    endHalf: () => {
      const state = get();
      const elapsedMs = state.currentElapsedMs();
      const half = state.matchState.half;
      const event: MatchEvent = { id: newId(), ts: nowIso(), type: 'HALF_END', payload: { half, elapsedMs } };
      const patch = withEvent(state, event);
      set({ clockRunning: false, clockStartedAt: null, baseElapsedMs: elapsedMs, ...patch });
      persist(patch.events);
    },

    endMatch: () => {
      const state = get();
      const elapsedMs = state.currentElapsedMs();
      const endEvent: MatchEvent = { id: newId(), ts: nowIso(), type: 'MATCH_END', payload: { elapsedMs } };
      const patch = withEvent(state, endEvent);
      set({ clockRunning: false, clockStartedAt: null, baseElapsedMs: elapsedMs, ...patch });
      persist(patch.events);

      const folderId = localStorage.getItem(FOLDER_ID_KEY);
      if (folderId && state.matchId) {
        const date = (patch.events[0]?.ts ?? endEvent.ts).slice(0, 10);
        const matchRecord: Match = {
          id: state.matchId,
          fixtureId: state.fixtureId ?? state.matchId,
          teamSheetId: state.teamSheet.id,
          opponent: state.opponent,
          events: patch.events,
          startedAt: patch.events[0]?.ts,
          endedAt: endEvent.ts,
          version: 1,
        };
        publishMatch(matchRecord, folderId, date).catch(() => {/* best-effort */});
      }
    },

    recordTryUs: (scorerId) => {
      const state = get();
      const event: MatchEvent = {
        id: newId(), ts: nowIso(), type: 'TRY_US',
        payload: { scorerId, elapsedMs: state.currentElapsedMs() },
      };
      const patch = withEvent(state, event);
      set(patch);
      persist(patch.events);
    },

    recordTryThem: () => {
      const state = get();
      const event: MatchEvent = {
        id: newId(), ts: nowIso(), type: 'TRY_THEM',
        payload: { elapsedMs: state.currentElapsedMs() },
      };
      const patch = withEvent(state, event);
      set(patch);
      persist(patch.events);
    },

    recordConversionUs: (kickerId) => {
      const state = get();
      const event: MatchEvent = { id: newId(), ts: nowIso(), type: 'CONVERSION_US', payload: { kickerId, elapsedMs: state.currentElapsedMs() } };
      const patch = withEvent(state, event);
      set(patch);
      persist(patch.events);
    },

    recordConversionThem: () => {
      const state = get();
      const event: MatchEvent = { id: newId(), ts: nowIso(), type: 'CONVERSION_THEM', payload: { elapsedMs: state.currentElapsedMs() } };
      const patch = withEvent(state, event);
      set(patch);
      persist(patch.events);
    },

    recordPenaltyUs: (kickerId) => {
      const state = get();
      const event: MatchEvent = { id: newId(), ts: nowIso(), type: 'PENALTY_US', payload: { kickerId, elapsedMs: state.currentElapsedMs() } };
      const patch = withEvent(state, event);
      set(patch);
      persist(patch.events);
    },

    recordPenaltyThem: () => {
      const state = get();
      const event: MatchEvent = { id: newId(), ts: nowIso(), type: 'PENALTY_THEM', payload: { elapsedMs: state.currentElapsedMs() } };
      const patch = withEvent(state, event);
      set(patch);
      persist(patch.events);
    },

    recordDropGoalUs: (scorerId) => {
      const state = get();
      const event: MatchEvent = { id: newId(), ts: nowIso(), type: 'DROP_GOAL_US', payload: { scorerId, elapsedMs: state.currentElapsedMs() } };
      const patch = withEvent(state, event);
      set(patch);
      persist(patch.events);
    },

    recordDropGoalThem: () => {
      const state = get();
      const event: MatchEvent = { id: newId(), ts: nowIso(), type: 'DROP_GOAL_THEM', payload: { elapsedMs: state.currentElapsedMs() } };
      const patch = withEvent(state, event);
      set(patch);
      persist(patch.events);
    },

    commitSubBatch: (offIds, onIds) => {
      const state = get();
      const event: MatchEvent = {
        id: newId(), ts: nowIso(), type: 'SUB_BATCH',
        payload: { offIds, onIds, elapsedMs: state.currentElapsedMs() },
      };
      const patch = withEvent(state, event);
      set(patch);
      persist(patch.events);
    },

    bloodOff: (playerId, replacementId) => {
      const state = get();
      const event: MatchEvent = {
        id: newId(), ts: nowIso(), type: 'BLOOD_OFF',
        payload: { playerId, replacementId, elapsedMs: state.currentElapsedMs() },
      };
      const patch = withEvent(state, event);
      set(patch);
      persist(patch.events);
    },

    bloodReturn: (playerId) => {
      const state = get();
      const event: MatchEvent = {
        id: newId(), ts: nowIso(), type: 'BLOOD_RETURN',
        payload: { playerId, elapsedMs: state.currentElapsedMs() },
      };
      const patch = withEvent(state, event);
      set(patch);
      persist(patch.events);
    },

    injuredOff: (playerId, replacementId) => {
      const state = get();
      const event: MatchEvent = {
        id: newId(), ts: nowIso(), type: 'INJURED_OFF',
        payload: { playerId, replacementId, elapsedMs: state.currentElapsedMs() },
      };
      const patch = withEvent(state, event);
      set(patch);
      persist(patch.events);
    },

    injuredReturn: (playerId) => {
      const state = get();
      const event: MatchEvent = {
        id: newId(), ts: nowIso(), type: 'INJURED_RETURN',
        payload: { playerId, elapsedMs: state.currentElapsedMs() },
      };
      const patch = withEvent(state, event);
      set(patch);
      persist(patch.events);
    },

    undoLast: () => {
      const { events, squad, teamSheet, clockRunning } = get();
      if (events.length === 0) return;
      const last = events[events.length - 1];
      const newEvents = events.slice(0, -1);
      const newMatchState = replayEvents(newEvents, teamSheet, squad);
      const clockPatch: Partial<MatchStore> = {};
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
      persist(newEvents);
    },
  };
});
