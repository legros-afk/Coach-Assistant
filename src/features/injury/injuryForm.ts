import type { Fixture, Player } from '@/lib/events/types';
import type { InjuryReport } from '@/lib/safeguarding/types';
import { toIsoDay } from '@/lib/safeguarding/gras';

export const AGE_GROUP = 'U12';

export type LocationChoice = 'Training' | 'Match' | 'Festival' | 'Other';

/** Picker value meaning "not in the list — typed in instead". */
export const FIXTURE_OTHER = 'other';

/** Locations that happen at a fixture, so the report says which one. */
export const atFixture = (l: LocationChoice) => l === 'Match' || l === 'Festival';

export interface InjuryForm {
  // ── lean quick form (default view)
  date: string;
  time: string;
  locationChoice: LocationChoice;
  locationOther: string;
  /** Match/Festival only: '' (not chosen yet), a fixture id, or FIXTURE_OTHER. */
  fixtureChoice: string;
  /** Label of the picked fixture, taken when it was picked. */
  fixtureLabel: string;
  /** Typed-in match or festival when it isn't in the list. */
  fixtureOther: string;
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
    fixtureChoice: '',
    fixtureLabel: '',
    fixtureOther: '',
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

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * "14 Sep vs Chingford (away)". Home/away comes from the opponent name, where
 * Spond puts it ("Chingford (Away)").
 */
export function fixtureLabel(f: Pick<Fixture, 'date' | 'opponent'>): string {
  const [, m, d] = f.date.slice(0, 10).split('-').map(Number);
  const day = m && d ? `${d} ${MONTHS[m - 1]}` : f.date;
  const side = f.opponent.match(/^(.*?)\s*\((home|away)\)\s*$/i);
  const opponent = (side ? side[1] : f.opponent).trim();
  return `${day} vs ${opponent}${side ? ` (${side[2].toLowerCase()})` : ''}`;
}

const dayNumber = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return Date.UTC(y, (m || 1) - 1, d || 1) / 86_400_000;
};

/** Fixtures to offer, nearest the day of the injury first. Cancelled ones are left out. */
export function fixtureOptions(fixtures: Fixture[], date: string, limit = 12): Fixture[] {
  const day = dayNumber(date);
  return fixtures
    .filter(f => !f.cancelled)
    .map(f => ({ f, gap: Math.abs(dayNumber(f.date) - day), future: f.date > date }))
    // nearest first; on a tie the one already played wins
    .sort((a, b) => a.gap - b.gap || Number(a.future) - Number(b.future))
    .slice(0, limit)
    .map(x => x.f);
}

/** Set the fixture picker from its value (a fixture id or FIXTURE_OTHER). */
export function chooseFixture(form: InjuryForm, choice: string, fixtures: Fixture[]): InjuryForm {
  const fx = fixtures.find(f => f.id === choice);
  return { ...form, fixtureChoice: fx ? fx.id : choice, fixtureLabel: fx ? fixtureLabel(fx) : '' };
}

/**
 * Change where it happened. Moving to Match/Festival pre-picks the day's only
 * fixture, or goes straight to typing one in when there are none to choose.
 */
export function chooseLocation(form: InjuryForm, loc: LocationChoice, fixtures: Fixture[]): InjuryForm {
  const next = { ...form, locationChoice: loc };
  if (!atFixture(loc) || next.fixtureChoice) return next;
  const options = fixtureOptions(fixtures, form.date);
  if (options.length === 0) return { ...next, fixtureChoice: FIXTURE_OTHER, fixtureLabel: '' };
  const sameDay = options.filter(f => f.date === form.date);
  return sameDay.length === 1 ? chooseFixture(next, sameDay[0].id, fixtures) : next;
}

/** Enough to file: what happened and what was done about it. */
export function formMissing(f: InjuryForm): string | null {
  if (!f.date) return 'Add the date';
  if (!f.time) return 'Add the time';
  if (f.locationChoice === 'Other' && !f.locationOther.trim()) return 'Say where it happened';
  if (atFixture(f.locationChoice)) {
    const what = f.locationChoice === 'Match' ? 'match' : 'festival';
    if (!f.fixtureChoice) return `Pick which ${what} it was`;
    if (f.fixtureChoice === FIXTURE_OTHER && !f.fixtureOther.trim()) return `Say which ${what} it was`;
  }
  if (!f.incidentDescription.trim()) return 'Say how it happened';
  if (!f.treatmentGiven.trim()) return 'Say what treatment was given';
  return null;
}

export function formLocation(f: InjuryForm): string {
  return f.locationChoice === 'Other' ? (f.locationOther.trim() || 'Other') : f.locationChoice;
}

/** The fixture fields to stamp on the report (none away from a fixture). */
export function formFixture(f: InjuryForm): Pick<InjuryReport, 'fixtureId' | 'fixtureLabel'> {
  if (!atFixture(f.locationChoice) || !f.fixtureChoice) return {};
  if (f.fixtureChoice === FIXTURE_OTHER) {
    const fixtureLabel = f.fixtureOther.trim();
    return fixtureLabel ? { fixtureLabel } : {};
  }
  return { fixtureId: f.fixtureChoice, ...(f.fixtureLabel ? { fixtureLabel: f.fixtureLabel } : {}) };
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
    ...formFixture(f),
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
