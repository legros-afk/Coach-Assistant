import type { Group, ID, Player, PlayerMatchState, TeamSheet } from '../events/types';

export interface PlannedSwap {
  off: Player;
  on: Player;
  group: Group;
  dueAtMs: number;     // match-clock time when this swap should happen
  dueNow: boolean;
  atHalfTime: boolean; // planned for the half-time break rather than during play
}

export interface PlanOptions {
  gameLengthMs: number;
  halfLengthMs: number;
  /** Every player should reach at least this much time. */
  minimumMs: number;
  /** The half-time whistle has gone (HALF_END recorded). */
  halfEnded: boolean;
  /** The second half is under way (clock restarted after HALF_END). */
  secondHalfStarted: boolean;
}

// A swap counts as "due" slightly before its ideal time so the pitch-side
// helper has time to get the player ready.
const DUE_LEAD_MS = 30_000;
// Anyone within a minute of the minimum is treated as having reached it.
const GRACE_MS = 60_000;

function liveMinutes(ps: PlayerMatchState, elapsedMs: number): number {
  return ps.status === 'on' && ps.currentStintStartedAtMs !== undefined
    ? ps.minutesPlayed + (elapsedMs - ps.currentStintStartedAtMs)
    : ps.minutesPlayed;
}

/**
 * Minimum-time planner with as few interruptions as possible.
 *
 * Starters are picked on merit, so the aim is not equal minutes: it is that
 * every player gets at least `minimumMs`, with subs batched at half time.
 * A mid-half swap is only planned when a bench player could not otherwise
 * reach the minimum, and all mid-half swaps in the same half are pulled
 * together to the earliest one so play is stopped once.
 *
 * Scrum-half is planned first because it has the fewest eligible players;
 * a versatile bench player is only consumed by one group's plan.
 */
export function planSubs(
  squad: Player[],
  _teamSheet: TeamSheet,
  playerStates: Map<ID, PlayerMatchState>,
  elapsedMs: number,
  { gameLengthMs, halfLengthMs, minimumMs, halfEnded, secondHalfStarted }: PlanOptions,
): PlannedSwap[] {
  const groupOrder: Group[] = ['scrumhalf', 'forward', 'back'];
  const getTime = (p: Player) => liveMinutes(playerStates.get(p.id)!, elapsedMs);
  const atBreak = halfEnded && !secondHalfStarted;

  const swaps: PlannedSwap[] = [];
  const usedBenchIds = new Set<ID>();

  for (const group of groupOrder) {
    const onInGroup = squad
      .filter(p => {
        const ps = playerStates.get(p.id);
        return ps?.status === 'on' && ps.activeGroup === group;
      })
      .sort((a, b) => getTime(b) - getTime(a)); // most played comes off first
    const benchInGroup = squad
      .filter(p => {
        const ps = playerStates.get(p.id);
        return ps?.status === 'bench' && p.eligibleGroups.includes(group) && !usedBenchIds.has(p.id);
      })
      .sort((a, b) => getTime(a) - getTime(b)); // least played goes on first

    let offIndex = 0;
    for (const onPlayer of benchInGroup) {
      if (offIndex >= onInGroup.length) break;
      const needMs = minimumMs - getTime(onPlayer);
      if (needMs <= GRACE_MS) continue;

      // Latest moment they can come on and still reach the minimum
      const latestStartMs = Math.max(0, gameLengthMs - needMs);

      let dueAtMs: number;
      let atHalfTime = false;
      if (!secondHalfStarted && latestStartMs >= halfLengthMs) {
        // Can wait for the break — the cheapest possible interruption
        dueAtMs = halfLengthMs;
        atHalfTime = true;
      } else {
        dueAtMs = Math.max(elapsedMs, latestStartMs);
      }

      swaps.push({
        off: onInGroup[offIndex++],
        on: onPlayer,
        group,
        dueAtMs,
        atHalfTime,
        dueNow: atHalfTime ? atBreak : latestStartMs <= elapsedMs + DUE_LEAD_MS,
      });
      usedBenchIds.add(onPlayer.id);
    }
  }

  // Batch in-play swaps: within each half, everything moves to the earliest
  // swap's time, so play stops once instead of once per player.
  for (const inSecond of [false, true]) {
    const batch = swaps.filter(s => !s.atHalfTime && (s.dueAtMs >= halfLengthMs) === inSecond);
    if (batch.length < 2) continue;
    const first = Math.min(...batch.map(s => s.dueAtMs));
    const due = batch.some(s => s.dueNow);
    for (const s of batch) {
      s.dueAtMs = first;
      s.dueNow = due;
    }
  }

  return swaps.sort((a, b) => Number(b.dueNow) - Number(a.dueNow) || a.dueAtMs - b.dueAtMs);
}
