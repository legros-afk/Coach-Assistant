import type { Player } from '@/lib/events/types';
import type { InjuryReport } from '@/lib/safeguarding/types';
import { toIsoDay } from '@/lib/safeguarding/gras';

export const AGE_GROUP = 'U12';

export type LocationChoice = 'Training' | 'Match' | 'Festival' | 'Other';

export interface InjuryForm {
  // ── lean quick form (default view)
  date: string;
  time: string;
  locationChoice: LocationChoice;
  locationOther: string;
  incidentDescription: string;
  treatmentGiven: string;
  followUp: string;
  parentsInformed: boolean;
  // ── "More details" (full DOCX template)
  staffPresent: string;
  playerName: string;
  playerAgeGroup: string;
  parentGuardian: string;
  parentContact: string;
  injuryType: string[];
  bodyPart: string;
  headInjuryOrConcussion: boolean;
  hospitalOrAmbulance: boolean;
  reportedBy: string;
}

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

export function emptyInjuryForm(player: Pick<Player, 'name'>, reportedBy = '', now = new Date()): InjuryForm {
  return {
    date: toIsoDay(now),
    time: hhmm(now),
    locationChoice: 'Training',
    locationOther: '',
    incidentDescription: '',
    treatmentGiven: '',
    followUp: '',
    parentsInformed: false,
    staffPresent: '',
    playerName: player.name,
    playerAgeGroup: AGE_GROUP,
    parentGuardian: '',
    parentContact: '',
    injuryType: [],
    bodyPart: '',
    headInjuryOrConcussion: false,
    hospitalOrAmbulance: false,
    reportedBy,
  };
}

/** Enough to file: what happened and what was done about it. */
export function formMissing(f: InjuryForm): string | null {
  if (!f.date) return 'Add the date';
  if (!f.time) return 'Add the time';
  if (f.locationChoice === 'Other' && !f.locationOther.trim()) return 'Say where it happened';
  if (!f.incidentDescription.trim()) return 'Say how it happened';
  if (!f.treatmentGiven.trim()) return 'Say what treatment was given';
  return null;
}

export function formLocation(f: InjuryForm): string {
  return f.locationChoice === 'Other' ? (f.locationOther.trim() || 'Other') : f.locationChoice;
}

export function formToReport(f: InjuryForm, id: string, playerId: string, nowIso: string): InjuryReport {
  const followUp = f.followUp.trim();
  const bodyPart = f.bodyPart.trim();
  return {
    id,
    playerId,
    playerName: f.playerName.trim(),
    playerAgeGroup: f.playerAgeGroup.trim() || AGE_GROUP,
    date: f.date,
    time: f.time,
    location: formLocation(f),
    staffPresent: f.staffPresent.trim(),
    parentGuardian: f.parentGuardian.trim(),
    parentContact: f.parentContact.trim(),
    incidentDescription: f.incidentDescription.trim(),
    treatmentGiven: f.treatmentGiven.trim(),
    ...(followUp ? { followUp } : {}),
    parentsInformed: f.parentsInformed,
    injuryType: f.injuryType,
    ...(bodyPart ? { bodyPart } : {}),
    headInjuryOrConcussion: f.headInjuryOrConcussion,
    hospitalOrAmbulance: f.hospitalOrAmbulance,
    reportedBy: f.reportedBy.trim(),
    reportedAt: nowIso,
    version: 1,
  };
}
