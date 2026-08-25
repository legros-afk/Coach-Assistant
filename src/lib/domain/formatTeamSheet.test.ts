import { describe, expect, it } from 'vitest';
import type { Group, ID, Player } from '../events/types';
import { formatTeamsForWhatsApp } from './formatTeamSheet';
import { parseTeamSheet } from './parseTeamSheet';

let seq = 0;
function player(name: string, defaultGroup: Group, eligible?: Group[]): Player {
  return { id: `p${++seq}`, name, defaultGroup, eligibleGroups: eligible ?? [defaultGroup] };
}

function fixtureSetup() {
  const squad = [
    player('Alexander', 'forward'),
    player('Dylan', 'forward'),
    player('Elias', 'forward'),
    player('Angelo', 'back'),
    player('Archie', 'back'),
    player('Hayden', 'back', ['back', 'scrumhalf']),
    player('Seb', 'back', ['back', 'scrumhalf']),
    player('Oscar', 'back'),
    player('Rafferty', 'back'),
  ];
  const [alex, dylan, elias, angelo, archie, hayden, seb, oscar, rafferty] = squad;
  const assignments = new Map<ID, 'A' | 'B' | 'bench-A' | 'bench-B' | 'unavailable' | null>([
    [alex.id, 'A'], [angelo.id, 'A'], [hayden.id, 'A'], [dylan.id, 'bench-A'],
    [elias.id, 'B'], [archie.id, 'B'], [seb.id, 'B'], [oscar.id, 'bench-B'],
    [rafferty.id, 'unavailable'],
  ]);
  const overrides = new Map<ID, Group>([[hayden.id, 'scrumhalf'], [seb.id, 'scrumhalf']]);
  return { squad, assignments, overrides };
}

const OPTS = { teamName: 'Woodford U12', opponent: 'Saints', date: '2026-08-30' };

describe('formatTeamsForWhatsApp', () => {
  it('produces the full message with both teams, bench, and unavailable', () => {
    const { squad, assignments, overrides } = fixtureSetup();
    const msg = formatTeamsForWhatsApp({ ...OPTS, players: squad, assignments, groupOverrides: overrides });
    expect(msg).toBe([
      '🏉 *Woodford U12 vs Saints* — Sunday 30 August',
      '',
      '*Team A*',
      'Forwards: Alexander',
      'Backs: Angelo',
      'Scrum-half: Hayden',
      'Bench: Dylan',
      '',
      '*Team B*',
      'Forwards: Elias',
      'Backs: Archie',
      'Scrum-half: Seb',
      'Bench: Oscar',
      '',
      'Not available: Rafferty',
    ].join('\n'));
  });

  it('omits empty teams and sections', () => {
    const { squad, overrides } = fixtureSetup();
    const assignments = new Map<ID, 'A' | null>([[squad[0].id, 'A']]);
    const msg = formatTeamsForWhatsApp({ ...OPTS, players: squad, assignments, groupOverrides: overrides });
    expect(msg).not.toContain('Team B');
    expect(msg).not.toContain('Bench:');
    expect(msg).not.toContain('Not available');
    expect(msg).not.toContain('Backs:');
  });

  it('round-trips through parseTeamSheet', () => {
    const { squad, assignments, overrides } = fixtureSetup();
    const msg = formatTeamsForWhatsApp({ ...OPTS, players: squad, assignments, groupOverrides: overrides });
    const parsed = parseTeamSheet(msg, squad);

    expect(parsed.blocks.map(b => b.label)).toEqual(['Team A', 'Team B']);
    for (const block of parsed.blocks) {
      for (const slot of [...block.starters, ...block.bench]) {
        expect(slot.status).toBe('resolved');
      }
    }
    const a = parsed.blocks[0];
    expect(a.starters.map(s => s.status === 'resolved' && s.player.name)).toEqual(['Alexander', 'Angelo', 'Hayden']);
    expect(a.starters.map(s => s.status === 'resolved' && s.assignedGroup)).toEqual(['forward', 'back', 'scrumhalf']);
    expect(a.bench.map(s => s.status === 'resolved' && s.player.name)).toEqual(['Dylan']);
    // The title line and the unavailable list never leak in as fake players.
    const allTokens = parsed.blocks.flatMap(b => [...b.starters, ...b.bench]);
    expect(allTokens.some(s => s.status !== 'resolved')).toBe(false);
    expect(allTokens.some(s => s.status === 'resolved' && s.player.name === 'Rafferty')).toBe(false);
  });

  it('parseTeamSheet strips WhatsApp bold from headers pasted from other apps', () => {
    const squad = [player('Alexander', 'forward'), player('Angelo', 'back')];
    const parsed = parseTeamSheet('*Team A*\n*Forwards:* Alexander\n_Bench:_ Angelo', squad);
    expect(parsed.blocks).toHaveLength(1);
    expect(parsed.blocks[0].label).toBe('Team A');
    expect(parsed.blocks[0].starters).toHaveLength(1);
    expect(parsed.blocks[0].bench).toHaveLength(1);
  });

  it('parseTeamSheet still handles headerless name lists', () => {
    const squad = [player('Alexander', 'forward'), player('Angelo', 'back')];
    const parsed = parseTeamSheet('Alexander, Angelo', squad);
    expect(parsed.blocks).toHaveLength(1);
    expect(parsed.blocks[0].starters).toHaveLength(2);
  });
});
