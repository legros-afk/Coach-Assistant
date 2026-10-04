import { create } from 'zustand';
import { db } from '@/lib/db/db';
import { replayEvents } from '@/lib/events/replay';
import type { ID, Match, MatchEvent, MatchState, Player, TeamSheet } from '@/lib/events/types';
import { publishMatch } from '@/lib/drive/drivePublish';
import { DEMO_SQUAD, DEMO_TEAM_SHEET } from './mockData';
import { DRIVE_FOLDER_ID } from '@/config/club';
import { gameId } from '@/lib/domain/games';

let _seq = 0;
const newId = () => `${Date.now()}-${++_seq}`;
const nowIso = () => new Date().toISOString();

export type PublishStatus = 'idle' | 'publishing' | 'ok' | 'failed';

export interface InitMatchArgs {
  fixtureId: string;
  teamSheet: TeamSheet;
  squad: Player[];
  opponent: string;
  /** Which game of the day for this team (default 1). */
  game?: number;
}

interface MatchStore {
  matchId: string | null;
  fixtureId: string | null;
  opponent: string;
  game: number;
  squad: Player[];
  teamSheet: TeamSheet;
  events: MatchEvent[];
  matchState: MatchState;
  isHydrated: boolean;
  publishStatus: PublishStatus;

  clockRunning: boolean;
  clockStartedAt: number | null;
  baseElapsedMs: number;

  currentElapsedMs: () => number;
  initMatch: (args: InitMatchArgs) => Promise<void>;
  initDemoMatch: () => Promise<void>;
  /** Reload the match this phone was running (after the app was closed or reloaded). */
  restoreActive: () => Promise<'none' | 'paused' | 'running'>;
  publishNow: () => Promise<void>;
  startClock: () => void;
  pauseClock: () => void;
  endHalf: () => void;
  endMatch: () => void;
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
): Pick<MatchStore, 'events' | 'matchState'> {
  const events = [...state.events, event];
  return { events, matchState: replayEvents(events, state.teamSheet, state.squad) };
}

// Which match this phone is running, so it can be picked up again after the
// phone unloads the app (iPhones do this to background apps) or it updates.
const ACTIVE_KEY = 'coach-active-match'
interface ActivePointer { matchId: string; fixtureId: string; opponent: string; game?: number; demo?: boolean }
function saveActive(p: ActivePointer) {
  try { localStorage.setItem(ACTIVE_KEY, JSON.stringify(p)) } catch { /* ignore */ }
}
function readActive(): ActivePointer | null {
  try { return JSON.parse(localStorage.getItem(ACTIVE_KEY) ?? 'null') as ActivePointer | null } catch { return null }
}

// A clock that was running when the app went away keeps running: its time is
// worked out from when it was last started, so no minutes are lost.
export function clockFromEvents(events: MatchEvent[]): { running: boolean; baseElapsedMs: number; startedAt: number | null } {
  let running = false
  let stoppedAt = 0
  let startedAt: number | null = null
  for (const e of events) {
    if (e.type === 'CLOCK_START') { running = true; startedAt = Date.parse(e.ts) }
    else if (e.type === 'CLOCK_PAUSE' || e.type === 'HALF_END' || e.type === 'MATCH_END') {
      running = false; startedAt = null; stoppedAt = e.payload.elapsedMs
    }
  }
  return { running, baseElapsedMs: stoppedAt, startedAt: running ? startedAt : null }
}

async function loadMatchState(
  matchId: string,
  fixtureId: string,
  opponent: string,
  teamSheet: TeamSheet,
  squad: Player[],
  game = 1,
): Promise<Partial<MatchStore>> {
  const stored = await db.matches.get(matchId);
  if (stored && stored.events.length > 0) {
    const matchState = replayEvents(stored.events, teamSheet, squad);
    const clock = clockFromEvents(stored.events);
    return {
      matchId, fixtureId, opponent, game, squad, teamSheet,
      events: stored.events, matchState,
      baseElapsedMs: clock.running ? clock.baseElapsedMs : matchState.elapsedMs,
      clockRunning: clock.running, clockStartedAt: clock.startedAt, isHydrated: true,
    };
  }
  return {
    matchId, fixtureId, opponent, game, squad, teamSheet,
    events: [], matchState: replayEvents([], teamSheet, squad),
    baseElapsedMs: 0,
    clockRunning: false, clockStartedAt: null, isHydrated: true,
  };
}

export const useMatchStore = create<MatchStore>()((set, get) => {
  function persist(events: MatchEvent[]): void {
    const { matchId, fixtureId, teamSheet, opponent, game } = get();
    if (!matchId) return;
    db.matches.put({
      id: matchId,
      fixtureId: fixtureId ?? matchId,
      teamSheetId: teamSheet.id,
      opponent,
      ...(game > 1 ? { game } : {}),
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
    game: 1,
    squad: DEMO_SQUAD,
    teamSheet: DEMO_TEAM_SHEET,
    events: [],
    matchState: replayEvents([], DEMO_TEAM_SHEET, DEMO_SQUAD),
    isHydrated: false,
    publishStatus: 'idle',

    clockRunning: false,
    clockStartedAt: null,
    baseElapsedMs: 0,

    currentElapsedMs: () => {
      const { clockRunning, clockStartedAt, baseElapsedMs } = get();
      return clockRunning && clockStartedAt !== null
        ? baseElapsedMs + (Date.now() - clockStartedAt)
        : baseElapsedMs;
    },

    initMatch: async ({ fixtureId, teamSheet, squad, opponent, game = 1 }) => {
      const matchId = gameId(teamSheet.id, game);
      const patch = await loadMatchState(matchId, fixtureId, opponent, teamSheet, squad, game);
      set({ ...patch, publishStatus: 'idle' } as MatchStore);
      saveActive({ matchId, fixtureId, opponent, game });
    },

    initDemoMatch: async () => {
      const patch = await loadMatchState(
        DEMO_TEAM_SHEET.id, 'demo-fixture', 'Opponents', DEMO_TEAM_SHEET, DEMO_SQUAD, 1,
      );
      set(patch as MatchStore);
      saveActive({ matchId: DEMO_TEAM_SHEET.id, fixtureId: 'demo-fixture', opponent: 'Opponents', demo: true });
    },

    restoreActive: async () => {
      const p = readActive();
      if (!p) return 'none';
      const stored = await db.matches.get(p.matchId);
      if (!stored || stored.events.length === 0 || stored.events.some(e => e.type === 'MATCH_END')) return 'none';
      if (p.demo) {
        await get().initDemoMatch();
      } else {
        const fixture = await db.fixtures.get(p.fixtureId);
        const teamSheet = fixture?.teamSheets.find(t => t.id === stored.teamSheetId);
        const squads = await db.squads.toArray();
        const squad = squads.length ? squads[squads.length - 1] : null;
        if (!fixture || !teamSheet || !squad) return 'none';
        await get().initMatch({ fixtureId: fixture.id, teamSheet, squad: squad.players, opponent: fixture.opponent, game: stored.game ?? 1 });
      }
      return get().clockRunning ? 'running' : 'paused';
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
      void get().publishNow();
    },

    publishNow: async () => {
      const state = get();
      if (!state.matchId || state.events.length === 0) return;
      set({ publishStatus: 'publishing' });
      const matchRecord: Match = {
        id: state.matchId,
        fixtureId: state.fixtureId ?? state.matchId,
        teamSheetId: state.teamSheet.id,
        opponent: state.opponent,
        ...(state.game > 1 ? { game: state.game } : {}),
        events: state.events,
        startedAt: state.events[0].ts,
        endedAt: state.events[state.events.length - 1].ts,
        version: 1,
      };
      const date = state.events[0].ts.slice(0, 10);
      try {
        const result = await publishMatch(matchRecord, DRIVE_FOLDER_ID, date);
        set({ publishStatus: result.ok ? 'ok' : 'failed' });
      } catch {
        set({ publishStatus: 'failed' });
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

/**
 * Save a result typed in after the game (score and try scorers, no minutes)
 * as the team's next game, and share it with the other coaches.
 */
export async function recordManualResult(args: {
  fixtureId: ID;
  teamSheetId: ID;
  opponent: string;
  game: number;
  events: MatchEvent[];
}): Promise<PublishStatus> {
  const match: Match = {
    id: gameId(args.teamSheetId, args.game),
    fixtureId: args.fixtureId,
    teamSheetId: args.teamSheetId,
    opponent: args.opponent,
    ...(args.game > 1 ? { game: args.game } : {}),
    manual: true,
    events: args.events,
    version: 1,
  };
  await db.matches.put(match);
  try {
    const result = await publishMatch(match, DRIVE_FOLDER_ID);
    return result.ok ? 'ok' : 'failed';
  } catch {
    return 'failed';
  }
}
