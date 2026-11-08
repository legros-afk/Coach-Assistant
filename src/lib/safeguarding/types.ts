import type { ID } from '@/lib/events/types';

// Injury reports and concussion protocols. Kept apart from squad/fixtures:
// they hold children's medical details and parent contact numbers, so they
// live in their own Dexie tables and their own Drive folder.

export const INJURY_TYPES = ['sprain', 'strain', 'cut', 'bruise', 'bleeding', 'other'] as const;
export type InjuryType = typeof INJURY_TYPES[number];

export const INJURY_LOCATIONS = ['Training', 'Match', 'Festival', 'Other'] as const;

export interface InjuryReport {
  id: ID;
  playerId: ID;              // Squad player (auto-filled from squad)
  /** Player's name as written on the report (auto-filled, editable). */
  playerName: string;
  playerAgeGroup: string;    // "U12"
  date: string;              // ISO date of incident (yyyy-mm-dd)
  time: string;              // "HH:mm" local time
  location: string;          // "Training" | "Match" | "Festival" | free text
  /** The fixture it happened at (Match/Festival), when picked from the list. */
  fixtureId?: ID;
  /** "14 Sep vs Chingford (away)", or typed in. Copied onto the report so it
   *  still reads right after the fixture is edited or deleted. */
  fixtureLabel?: string;
  staffPresent: string;      // Names of coaches/staff present
  parentGuardian: string;    // Parent/guardian name
  parentContact: string;     // Phone number
  incidentDescription: string;  // What happened
  treatmentGiven: string;       // First aid / treatment given
  followUp?: string;            // Follow-up required (if any)
  parentsInformed: boolean;     // Parents/guardians informed?
  injuryType: string[];      // subset of INJURY_TYPES
  bodyPart?: string;
  headInjuryOrConcussion: boolean;
  hospitalOrAmbulance: boolean;
  reportedBy: string;        // Coach name
  reportedAt: string;        // ISO timestamp of report creation
  version: number;
}

export type StageNumber = 1 | 2 | 3 | 4 | 5 | 6;

export interface ConcussionStage {
  stage: StageNumber;
  name: string;
  description: string;
  /** Day number relative to concussionDate (0, 3, flexible, 8, 15, 21). */
  earliestStartDay: number;
  completed: boolean;
  completedAt?: string;
  notes?: string;
}

export interface ConcussionProtocol {
  id: ID;
  playerId: ID;
  /** Player's name, so the tracker reads without the squad loaded. */
  playerName: string;
  injuryReportId: ID;        // Links back to the injury report
  concussionDate: string;    // Day 0 = date of injury (ISO date)
  stages: ConcussionStage[];
  completedAt?: string;      // When stage 6 is signed off
  managedBy: string;         // Safeguarding officer
  version: number;
}
