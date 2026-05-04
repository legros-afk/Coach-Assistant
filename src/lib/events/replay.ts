import type { Group, ID, MatchEvent, MatchState, Player, PlayerMatchState, TeamSheet } from './types';

export function replayEvents(
  events: MatchEvent[],
  teamSheet: TeamSheet,
  players: Player[],
): MatchState {
  const playerMap = new Map(players.map(p => [p.id, p]));
  const playerStates = new Map<ID, PlayerMatchState>();

  for (const id of teamSheet.starters.forwards) {
    playerStates.set(id, { status: 'on', activeGroup: 'forward', minutesPlayed: 0, triesScored: 0 });
  }
  for (const id of teamSheet.starters.backs) {
    playerStates.set(id, { status: 'on', activeGroup: 'back', minutesPlayed: 0, triesScored: 0 });
  }
  const shId = teamSheet.starters.scrumhalf;
  playerStates.set(shId, { status: 'on', activeGroup: 'scrumhalf', minutesPlayed: 0, triesScored: 0 });
  for (const id of teamSheet.bench) {
    const p = playerMap.get(id);
    playerStates.set(id, {
      status: 'bench',
      activeGroup: p?.defaultGroup ?? 'forward',
      minutesPlayed: 0,
      triesScored: 0,
    });
  }

  let half: 1 | 2 = 1;
  let elapsedMs = 0;
  let running = false;
  let scoreUs = 0;
  let scoreThem = 0;

  const finaliseStints = (atMs: number) => {
    for (const ps of playerStates.values()) {
      if (ps.status === 'on' && ps.currentStintStartedAtMs !== undefined) {
        ps.minutesPlayed += atMs - ps.currentStintStartedAtMs;
        ps.currentStintStartedAtMs = undefined;
      }
    }
  };

  for (const event of events) {
    switch (event.type) {
      case 'CLOCK_START': {
        running = true;
        half = event.payload.half;
        for (const ps of playerStates.values()) {
          if (ps.status === 'on') ps.currentStintStartedAtMs = elapsedMs;
        }
        break;
      }

      case 'CLOCK_PAUSE': {
        finaliseStints(event.payload.elapsedMs);
        elapsedMs = event.payload.elapsedMs;
        running = false;
        break;
      }

      case 'HALF_END': {
        finaliseStints(event.payload.elapsedMs);
        elapsedMs = event.payload.elapsedMs;
        running = false;
        break;
      }

      case 'MATCH_END': {
        finaliseStints(event.payload.elapsedMs);
        elapsedMs = event.payload.elapsedMs;
        running = false;
        break;
      }

      case 'TRY_US': {
        scoreUs += 1;
        if (event.payload.scorerId) {
          const ps = playerStates.get(event.payload.scorerId);
          if (ps) ps.triesScored += 1;
        }
        elapsedMs = event.payload.elapsedMs;
        break;
      }

      case 'TRY_THEM': {
        scoreThem += 1;
        elapsedMs = event.payload.elapsedMs;
        break;
      }

      case 'SUB_BATCH': {
        const { offIds, onIds, elapsedMs: evMs } = event.payload;

        // Capture active groups from off-players before changing their status
        const offGroups: Group[] = offIds.map(id => playerStates.get(id)?.activeGroup ?? 'forward');

        for (const id of offIds) {
          const ps = playerStates.get(id);
          if (!ps) continue;
          if (running && ps.currentStintStartedAtMs !== undefined) {
            ps.minutesPlayed += evMs - ps.currentStintStartedAtMs;
            ps.currentStintStartedAtMs = undefined;
          }
          ps.status = 'bench';
        }

        const remainingOffGroups = [...offGroups];
        for (const id of onIds) {
          const p = playerMap.get(id);
          const ps = playerStates.get(id);
          if (!ps || !p) continue;

          // Greedy: assign this player to the first off-slot they're eligible for
          const pairIdx = remainingOffGroups.findIndex(g => p.eligibleGroups.includes(g));
          if (pairIdx >= 0) {
            ps.activeGroup = remainingOffGroups[pairIdx];
            remainingOffGroups.splice(pairIdx, 1);
          }
          // else: keep their defaultGroup

          ps.status = 'on';
          if (running) ps.currentStintStartedAtMs = evMs;
        }

        elapsedMs = evMs;
        break;
      }

      case 'BLOOD_OFF': {
        const { playerId, replacementId, elapsedMs: evMs } = event.payload;
        const ps = playerStates.get(playerId);
        if (ps) {
          if (running && ps.currentStintStartedAtMs !== undefined) {
            ps.minutesPlayed += evMs - ps.currentStintStartedAtMs;
            ps.currentStintStartedAtMs = undefined;
          }
          ps.status = 'blood';
        }
        if (replacementId) {
          const rps = playerStates.get(replacementId);
          if (rps) {
            rps.activeGroup = ps?.activeGroup ?? playerMap.get(replacementId)?.defaultGroup ?? 'forward';
            rps.status = 'on';
            if (running) rps.currentStintStartedAtMs = evMs;
          }
        }
        elapsedMs = evMs;
        break;
      }

      case 'BLOOD_RETURN': {
        const ps = playerStates.get(event.payload.playerId);
        if (ps) ps.status = 'bench';
        elapsedMs = event.payload.elapsedMs;
        break;
      }

      case 'INJURED_OFF': {
        const { playerId, elapsedMs: evMs } = event.payload;
        const ps = playerStates.get(playerId);
        if (ps) {
          if (running && ps.currentStintStartedAtMs !== undefined) {
            ps.minutesPlayed += evMs - ps.currentStintStartedAtMs;
            ps.currentStintStartedAtMs = undefined;
          }
          ps.status = 'injured';
        }
        elapsedMs = evMs;
        break;
      }

      case 'INJURED_RETURN': {
        const ps = playerStates.get(event.payload.playerId);
        if (ps) ps.status = 'bench';
        elapsedMs = event.payload.elapsedMs;
        break;
      }
    }
  }

  return { half, elapsedMs, running, scoreUs, scoreThem, playerStates };
}
