import type { Player, TeamSheet } from '@/lib/events/types';

export const DEMO_SQUAD: Player[] = [
  // Forwards (17)
  { id: 'p01', name: 'Alexander', defaultGroup: 'forward',   eligibleGroups: ['forward'] },
  { id: 'p02', name: 'Dominic',   defaultGroup: 'forward',   eligibleGroups: ['forward'] },
  { id: 'p03', name: 'Dylan',     defaultGroup: 'forward',   eligibleGroups: ['forward'] },
  { id: 'p04', name: 'Elias',     defaultGroup: 'forward',   eligibleGroups: ['forward'] },
  { id: 'p05', name: 'Elliott',   defaultGroup: 'forward',   eligibleGroups: ['forward'] },
  { id: 'p06', name: 'Ethan',     defaultGroup: 'forward',   eligibleGroups: ['forward'] },
  { id: 'p07', name: 'Fyfe',      defaultGroup: 'forward',   eligibleGroups: ['forward'] },
  { id: 'p08', name: 'Henry H',   defaultGroup: 'forward',   eligibleGroups: ['forward'] },
  { id: 'p09', name: 'Henry T',   defaultGroup: 'forward',   eligibleGroups: ['forward'] },
  { id: 'p10', name: 'Jack',      defaultGroup: 'forward',   eligibleGroups: ['forward'] },
  { id: 'p11', name: 'Jacob',     defaultGroup: 'forward',   eligibleGroups: ['forward'] },
  { id: 'p12', name: 'Matthew',   defaultGroup: 'forward',   eligibleGroups: ['forward'] },
  { id: 'p13', name: 'Reis',      defaultGroup: 'forward',   eligibleGroups: ['forward'] },
  { id: 'p14', name: 'Rene',      defaultGroup: 'forward',   eligibleGroups: ['forward'] },
  { id: 'p15', name: 'Robin',     defaultGroup: 'forward',   eligibleGroups: ['forward'] },
  { id: 'p16', name: 'Teddy C',   defaultGroup: 'forward',   eligibleGroups: ['forward'] },
  { id: 'p17', name: 'William',   defaultGroup: 'forward',   eligibleGroups: ['forward'] },

  // Backs (15)
  { id: 'p18', name: 'Angelo',    defaultGroup: 'back',      eligibleGroups: ['back'] },
  { id: 'p19', name: 'Archie',    defaultGroup: 'back',      eligibleGroups: ['back'] },
  { id: 'p20', name: 'Arlo',      defaultGroup: 'back',      eligibleGroups: ['back'] },
  { id: 'p21', name: 'Connor B',  defaultGroup: 'back',      eligibleGroups: ['back'] },
  { id: 'p22', name: 'Hayden',    defaultGroup: 'back',      eligibleGroups: ['back'] },
  { id: 'p23', name: 'Henry W',   defaultGroup: 'back',      eligibleGroups: ['back'] },
  { id: 'p24', name: 'James N',   defaultGroup: 'back',      eligibleGroups: ['back'] },
  { id: 'p25', name: 'James V',   defaultGroup: 'back',      eligibleGroups: ['back'] },
  { id: 'p26', name: 'Joshua',    defaultGroup: 'back',      eligibleGroups: ['back'] },
  { id: 'p27', name: 'Juan',      defaultGroup: 'back',      eligibleGroups: ['back'] },
  { id: 'p28', name: 'Lewis',     defaultGroup: 'back',      eligibleGroups: ['back'] },
  { id: 'p29', name: 'Oscar',     defaultGroup: 'back',      eligibleGroups: ['back'] },
  { id: 'p30', name: 'Seb',       defaultGroup: 'back',      eligibleGroups: ['back'] },
  { id: 'p31', name: 'Seth',      defaultGroup: 'back',      eligibleGroups: ['back'] },
  { id: 'p32', name: 'Teddy P',   defaultGroup: 'back',      eligibleGroups: ['back'] },

  // Backs who can cover scrum-half (4)
  { id: 'p33', name: 'Conor S',   defaultGroup: 'back',      eligibleGroups: ['back', 'scrumhalf'] },
  { id: 'p34', name: 'Harry',     defaultGroup: 'back',      eligibleGroups: ['back', 'scrumhalf'] },
  { id: 'p35', name: 'Hector',    defaultGroup: 'back',      eligibleGroups: ['back', 'scrumhalf'] },
  { id: 'p36', name: 'Soli',      defaultGroup: 'back',      eligibleGroups: ['back', 'scrumhalf'] },
];

// Demo Team A — illustrative selection, not a real fixture
export const DEMO_TEAM_SHEET: TeamSheet = {
  id: 'demo-ts',
  label: 'A',
  starters: {
    forwards:  ['p01', 'p03', 'p05', 'p09', 'p10'],  // Alexander, Dylan, Elliott, Henry T, Jack
    backs:     ['p18', 'p20', 'p23', 'p28', 'p29'],  // Angelo, Arlo, Henry W, Lewis, Oscar
    scrumhalf: 'p33',                                  // Conor S
  },
  bench: ['p02', 'p06', 'p19', 'p24', 'p34', 'p12'], // Dominic, Ethan, Archie, James N, Harry, Matthew
  unavailable: [],
};
