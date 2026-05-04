import type { Player, TeamSheet } from '@/lib/events/types';

export const DEMO_SQUAD: Player[] = [
  { id: 'f1',  name: 'Smith',     defaultGroup: 'forward',   eligibleGroups: ['forward'] },
  { id: 'f2',  name: 'Jones',     defaultGroup: 'forward',   eligibleGroups: ['forward'] },
  { id: 'f3',  name: 'Brown',     defaultGroup: 'forward',   eligibleGroups: ['forward', 'back'] },
  { id: 'f4',  name: 'Davies',    defaultGroup: 'forward',   eligibleGroups: ['forward'] },
  { id: 'f5',  name: 'Evans',     defaultGroup: 'forward',   eligibleGroups: ['forward'] },
  { id: 'b1',  name: 'Khan',      defaultGroup: 'back',      eligibleGroups: ['back'] },
  { id: 'b2',  name: 'Patel',     defaultGroup: 'back',      eligibleGroups: ['back'] },
  { id: 'b3',  name: 'Lewis',     defaultGroup: 'back',      eligibleGroups: ['back', 'scrumhalf'] },
  { id: 'b4',  name: 'Murphy',    defaultGroup: 'back',      eligibleGroups: ['back'] },
  { id: 'b5',  name: 'Nolan',     defaultGroup: 'back',      eligibleGroups: ['back'] },
  { id: 's1',  name: "O'Neill",   defaultGroup: 'scrumhalf', eligibleGroups: ['scrumhalf', 'back'] },
  { id: 'bf1', name: 'Patterson', defaultGroup: 'forward',   eligibleGroups: ['forward'] },
  { id: 'bf2', name: 'Quinn',     defaultGroup: 'forward',   eligibleGroups: ['forward'] },
  { id: 'bb1', name: 'Roberts',   defaultGroup: 'back',      eligibleGroups: ['back'] },
  { id: 'bb2', name: 'Singh',     defaultGroup: 'back',      eligibleGroups: ['back', 'forward'] },
  { id: 'bs1', name: 'Taylor',    defaultGroup: 'scrumhalf', eligibleGroups: ['scrumhalf'] },
  { id: 'bf3', name: 'Wilson',    defaultGroup: 'forward',   eligibleGroups: ['forward'] },
];

export const DEMO_TEAM_SHEET: TeamSheet = {
  id: 'demo-ts',
  label: 'A',
  starters: {
    forwards:  ['f1', 'f2', 'f3', 'f4', 'f5'],
    backs:     ['b1', 'b2', 'b3', 'b4', 'b5'],
    scrumhalf: 's1',
  },
  bench: ['bf1', 'bf2', 'bb1', 'bb2', 'bs1', 'bf3'],
  unavailable: [],
};
