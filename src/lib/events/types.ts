export type ID = string;
export type Group = 'forward' | 'back' | 'scrumhalf';

export interface Player {
  id: ID;
  name: string;
  defaultGroup: Group;
  eligibleGroups: Group[];
  notes?: string;
  ratings?: { impact: 1 | 2 | 3 | 4 | 5; development: 1 | 2 | 3 | 4 | 5 };
}

export interface Squad {
  id: ID;
  name: string;
  season: string;
  players: Player[];
  updatedAt: string;
  updatedBy?: string;
  version: number;
}

export interface TeamSheet {
  id: ID;
  label: string;
  starters: { forwards: ID[]; backs: ID[]; scrumhalf: ID };
  bench: ID[];
  unavailable: ID[];
}

export interface Fixture {
  id: ID;
  date: string;
  opponent: string;
  teamSheets: TeamSheet[];
  playersPerSide?: number;
  spondEventId?: string;
  publishedAt?: string;
  updatedAt: string;
  version: number;
}

export interface Match {
  id: ID;
  fixtureId: ID;
  teamSheetId: ID;
  opponent: string;
  events: MatchEvent[];
  startedAt?: string;
  endedAt?: string;
  version: number;
}

export type MatchEvent =
  | { id: ID; ts: string; type: 'CLOCK_START';      payload: { half: 1 | 2 } }
  | { id: ID; ts: string; type: 'CLOCK_PAUSE';      payload: { elapsedMs: number } }
  | { id: ID; ts: string; type: 'HALF_END';         payload: { half: 1 | 2; elapsedMs: number } }
  | { id: ID; ts: string; type: 'MATCH_END';        payload: { elapsedMs: number } }
  | { id: ID; ts: string; type: 'TRY_US';           payload: { scorerId?: ID; elapsedMs: number } }
  | { id: ID; ts: string; type: 'TRY_THEM';         payload: { elapsedMs: number } }
  | { id: ID; ts: string; type: 'CONVERSION_US';    payload: { kickerId?: ID; elapsedMs: number } }
  | { id: ID; ts: string; type: 'CONVERSION_THEM';  payload: { elapsedMs: number } }
  | { id: ID; ts: string; type: 'PENALTY_US';       payload: { kickerId?: ID; elapsedMs: number } }
  | { id: ID; ts: string; type: 'PENALTY_THEM';     payload: { elapsedMs: number } }
  | { id: ID; ts: string; type: 'DROP_GOAL_US';     payload: { scorerId?: ID; elapsedMs: number } }
  | { id: ID; ts: string; type: 'DROP_GOAL_THEM';   payload: { elapsedMs: number } }
  | { id: ID; ts: string; type: 'SUB_BATCH';        payload: { offIds: ID[]; onIds: ID[]; elapsedMs: number } }
  | { id: ID; ts: string; type: 'BLOOD_OFF';        payload: { playerId: ID; replacementId?: ID; elapsedMs: number } }
  | { id: ID; ts: string; type: 'BLOOD_RETURN';     payload: { playerId: ID; elapsedMs: number } }
  | { id: ID; ts: string; type: 'INJURED_OFF';      payload: { playerId: ID; replacementId?: ID; elapsedMs: number } }
  | { id: ID; ts: string; type: 'INJURED_RETURN';   payload: { playerId: ID; elapsedMs: number } };

export interface PlayerMatchState {
  status: 'on' | 'bench' | 'blood' | 'injured';
  activeGroup: Group;
  minutesPlayed: number;
  currentStintStartedAtMs?: number;
  triesScored: number;
}

export interface MatchState {
  half: 1 | 2;
  elapsedMs: number;
  running: boolean;
  scoreUs: number;
  scoreThem: number;
  playerStates: Map<ID, PlayerMatchState>;
}
