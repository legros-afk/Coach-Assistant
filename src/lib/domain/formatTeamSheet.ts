import { format, parseISO } from 'date-fns';
import type { Group, ID, Player } from '../events/types';

type Assignment = 'A' | 'bench-A' | 'B' | 'bench-B' | 'unavailable' | null;

export interface FormatOptions {
  teamName: string;
  opponent: string;
  /** ISO date (yyyy-MM-dd) */
  date: string;
  players: Player[];
  assignments: Map<ID, Assignment>;
  groupOverrides: Map<ID, Group>;
}

// Produces a WhatsApp-ready message. The layout is deliberately parseable by
// parseTeamSheet, so a coach can paste this message back into the app.
export function formatTeamsForWhatsApp({ teamName, opponent, date, players, assignments, groupOverrides }: FormatOptions): string {
  const groupOf = (p: Player) => groupOverrides.get(p.id) ?? p.defaultGroup;
  const names = (list: Player[]) => list.map(p => p.name).join(', ');

  let title = `🏉 *${teamName} vs ${opponent}*`;
  try {
    title += ` — ${format(parseISO(date), 'EEEE d MMMM')}`;
  } catch {
    // unparseable date — leave the title without it
  }

  const lines: string[] = [title];

  for (const team of ['A', 'B'] as const) {
    const starters = players.filter(p => assignments.get(p.id) === team);
    const bench = players.filter(p => assignments.get(p.id) === `bench-${team}`);
    if (starters.length === 0 && bench.length === 0) continue;

    const forwards = starters.filter(p => groupOf(p) === 'forward');
    const backs = starters.filter(p => groupOf(p) === 'back');
    const sh = starters.filter(p => groupOf(p) === 'scrumhalf');

    lines.push('', `*Team ${team}*`);
    if (forwards.length) lines.push(`Forwards: ${names(forwards)}`);
    if (backs.length) lines.push(`Backs: ${names(backs)}`);
    if (sh.length) lines.push(`Scrum-half: ${names(sh)}`);
    if (bench.length) lines.push(`Bench: ${names(bench)}`);
  }

  const unavailable = players.filter(p => assignments.get(p.id) === 'unavailable');
  if (unavailable.length) lines.push('', `Not available: ${names(unavailable)}`);

  return lines.join('\n');
}
