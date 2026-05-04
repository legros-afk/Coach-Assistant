import { describe, it, expect } from 'vitest';
import { parseTeamSheet } from './parseTeamSheet';
import type { Player } from '../events/types';

const squad: Player[] = [
  { id: 'f1', name: 'Henry W',    defaultGroup: 'forward',   eligibleGroups: ['forward'] },
  { id: 'f2', name: 'Henry T',    defaultGroup: 'forward',   eligibleGroups: ['forward'] },
  { id: 'f3', name: 'Tom B',      defaultGroup: 'forward',   eligibleGroups: ['forward'] },
  { id: 'f4', name: 'Oliver',     defaultGroup: 'forward',   eligibleGroups: ['forward'] },
  { id: 'f5', name: 'Brown',      defaultGroup: 'forward',   eligibleGroups: ['forward', 'back'] },
  { id: 'b1', name: 'Khan',       defaultGroup: 'back',      eligibleGroups: ['back'] },
  { id: 'b2', name: 'Patel',      defaultGroup: 'back',      eligibleGroups: ['back'] },
  { id: 'b3', name: "Lewis",      defaultGroup: 'back',      eligibleGroups: ['back', 'scrumhalf'] },
  { id: 'b4', name: 'Murphy',     defaultGroup: 'back',      eligibleGroups: ['back'] },
  { id: 'b5', name: 'Nolan',      defaultGroup: 'back',      eligibleGroups: ['back'] },
  { id: 's1', name: "O'Neill",    defaultGroup: 'scrumhalf', eligibleGroups: ['scrumhalf', 'back'] },
  { id: 'bn1', name: 'Patterson', defaultGroup: 'forward',   eligibleGroups: ['forward'] },
  { id: 'bn2', name: 'Quinn',     defaultGroup: 'forward',   eligibleGroups: ['forward'] },
  { id: 'bn3', name: 'Roberts',   defaultGroup: 'back',      eligibleGroups: ['back'] },
  { id: 'bn4', name: 'Smith',     defaultGroup: 'forward',   eligibleGroups: ['forward'] },
];

describe('parseTeamSheet — Format A (flat comma list)', () => {
  it('resolves all starters and bench', () => {
    const text = `Team A: Henry W, Tom B, Oliver, Brown, Khan, Patel, Lewis, Murphy, Nolan, O'Neill
Bench: Patterson, Quinn, Roberts`;

    const { blocks } = parseTeamSheet(text, squad);
    expect(blocks).toHaveLength(1);
    const [block] = blocks;
    expect(block.label).toBe('Team A');
    expect(block.starters).toHaveLength(10);
    expect(block.bench).toHaveLength(3);

    const resolved = block.starters.filter(s => s.status === 'resolved');
    expect(resolved).toHaveLength(10);
  });

  it('assigns defaultGroup when no section hint', () => {
    const text = `Team A: Brown`;
    const { blocks } = parseTeamSheet(text, squad);
    const slot = blocks[0].starters[0];
    expect(slot.status).toBe('resolved');
    if (slot.status === 'resolved') {
      expect(slot.assignedGroup).toBe('forward'); // Brown's defaultGroup
    }
  });
});

describe('parseTeamSheet — Format C (explicit groups)', () => {
  it('assigns the hinted group from section header', () => {
    const text = `Team A
F: Henry W, Tom B, Oliver, Brown, Patterson
B: Khan, Patel, Lewis, Murphy, Nolan
SH: O'Neill
Bench: Quinn, Roberts`;

    const { blocks } = parseTeamSheet(text, squad);
    const [block] = blocks;

    const henryW = block.starters.find(s => s.status === 'resolved' && s.player.id === 'f1');
    expect(henryW?.status).toBe('resolved');
    if (henryW?.status === 'resolved') {
      expect(henryW.assignedGroup).toBe('forward');
    }

    const oneill = block.starters.find(s => s.status === 'resolved' && s.player.id === 's1');
    if (oneill?.status === 'resolved') {
      expect(oneill.assignedGroup).toBe('scrumhalf');
    }
  });

  it('respects explicit Backs section even for a dual-eligible player', () => {
    const text = `Team A
B: Brown`;
    const { blocks } = parseTeamSheet(text, squad);
    const slot = blocks[0].starters[0];
    if (slot.status === 'resolved') {
      expect(slot.assignedGroup).toBe('back');
    }
  });
});

describe('parseTeamSheet — Format B (one name per line)', () => {
  it('parses one-per-line starters under a team header', () => {
    const text = `Team A
Henry W
Tom B
Oliver`;
    const { blocks } = parseTeamSheet(text, squad);
    expect(blocks[0].starters).toHaveLength(3);
    expect(blocks[0].starters.every(s => s.status === 'resolved')).toBe(true);
  });
});

describe('parseTeamSheet — Format D (multi-team)', () => {
  it('produces two blocks', () => {
    const text = `Team A
F: Henry W, Tom B, Oliver, Brown, Patterson
B: Khan, Patel, Lewis, Murphy, Nolan
SH: O'Neill
Bench: Quinn

Team B
Henry T`;

    const { blocks } = parseTeamSheet(text, squad);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].label).toBe('Team A');
    expect(blocks[1].label).toBe('Team B');
  });
});

describe('parseTeamSheet — name resolution', () => {
  it('layer 2: resolves punctuation variants (O Neill → O\'Neill)', () => {
    const text = `Team A: O Neill`;
    const { blocks } = parseTeamSheet(text, squad);
    const slot = blocks[0].starters[0];
    expect(slot.status).toBe('resolved');
    if (slot.status === 'resolved') expect(slot.player.id).toBe('s1');
  });

  it('layer 3: resolves unique first name (Oliver → Oliver)', () => {
    const text = `Team A: Oliver`;
    const { blocks } = parseTeamSheet(text, squad);
    const slot = blocks[0].starters[0];
    expect(slot.status).toBe('resolved');
  });

  it('layer 3: ambiguous first name (Henry → Henry W + Henry T)', () => {
    const text = `Team A: Henry`;
    const { blocks } = parseTeamSheet(text, squad);
    const slot = blocks[0].starters[0];
    expect(slot.status).toBe('ambiguous');
    if (slot.status === 'ambiguous') {
      expect(slot.candidates).toHaveLength(2);
      expect(slot.candidates.map(p => p.id)).toContain('f1');
      expect(slot.candidates.map(p => p.id)).toContain('f2');
    }
  });

  it('layer 4: fuzzy suggests close match (Smyth → Smith)', () => {
    const text = `Team A: Smyth`;
    const { blocks } = parseTeamSheet(text, squad);
    const slot = blocks[0].starters[0];
    expect(slot.status).toBe('unknown');
    if (slot.status === 'unknown') {
      expect(slot.fuzzyMatch?.id).toBe('bn4'); // Smith
    }
  });

  it('marks completely unrecognised name as unknown with no fuzzy', () => {
    const text = `Team A: Zzzzz`;
    const { blocks } = parseTeamSheet(text, squad);
    const slot = blocks[0].starters[0];
    expect(slot.status).toBe('unknown');
    if (slot.status === 'unknown') expect(slot.fuzzyMatch).toBeUndefined();
  });

  it('handles & and "and" as separators', () => {
    const text = `Team A: Khan & Patel and Murphy`;
    const { blocks } = parseTeamSheet(text, squad);
    expect(blocks[0].starters).toHaveLength(3);
    expect(blocks[0].starters.every(s => s.status === 'resolved')).toBe(true);
  });

  it('tolerates trailing commas', () => {
    const text = `Team A: Khan, Patel,`;
    const { blocks } = parseTeamSheet(text, squad);
    expect(blocks[0].starters.filter(s => s.status === 'resolved')).toHaveLength(2);
  });

  it('accepts Forwards / Backs / Scrum half as full-word headers', () => {
    const text = `Team A
Forwards: Henry W
Backs: Khan
Scrum half: O'Neill`;
    const { blocks } = parseTeamSheet(text, squad);
    const henryW = blocks[0].starters[0];
    if (henryW.status === 'resolved') expect(henryW.assignedGroup).toBe('forward');
    const oneill = blocks[0].starters[2];
    if (oneill.status === 'resolved') expect(oneill.assignedGroup).toBe('scrumhalf');
  });

  it('accepts Subs and Finishers as synonyms for Bench', () => {
    const text = `Team A
Subs: Patterson, Quinn
Finishers: Roberts`;
    const { blocks } = parseTeamSheet(text, squad);
    expect(blocks[0].bench).toHaveLength(3);
  });
});
