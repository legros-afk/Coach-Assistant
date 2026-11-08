import {
  INJURY_EMAIL_SUBJECT_PREFIX, MEDICAL_OFFICER_EMAIL, MEDICAL_OFFICER_MOBILE,
  SAFEGUARDING_CC_EMAIL, SAFEGUARDING_OFFICER_EMAIL,
} from '@/config/club';
import type { InjuryReport } from './types';

/** yyyy-mm-dd → dd/mm/yyyy, the way the club writes dates. */
export function ukDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

const yesNo = (b: boolean) => (b ? 'Yes' : 'No');

export function injuryEmailSubject(r: Pick<InjuryReport, 'playerName' | 'date'>): string {
  return `${INJURY_EMAIL_SUBJECT_PREFIX}: ${r.playerName}, ${ukDate(r.date)}`;
}

/**
 * The email body, laid out like the club's injury reporting form so Bekah
 * and Liz get reports in the shape they already know.
 */
export function injuryEmailBody(r: InjuryReport): string {
  const incident: string[] = [r.incidentDescription];
  if (r.injuryType.length) incident.push(`Type of injury: ${r.injuryType.join(', ')}`);
  if (r.bodyPart) incident.push(`Part of body: ${r.bodyPart}`);
  incident.push(`First aid / treatment given: ${r.treatmentGiven || 'None recorded'}`);
  if (r.followUp) incident.push(`Follow-up required: ${r.followUp}`);
  incident.push(`Parents/guardians informed: ${yesNo(r.parentsInformed)}`);

  const lines = [
    `Date: ${ukDate(r.date)}`,
    `Time: ${r.time}`,
    `Location: ${r.location}`,
    `Staff: ${r.staffPresent}`,
    `Player [Full Name]: ${r.playerName}`,
    `Age Group: ${r.playerAgeGroup}`,
    `Parent/Guardian: ${r.parentGuardian}`,
    `Contact No.: ${r.parentContact}`,
    '',
    'Incident Report:',
    ...incident,
    '',
    `Head Injury/Concussion?: ${yesNo(r.headInjuryOrConcussion)}`,
    `Hospital/Ambulance?: ${yesNo(r.hospitalOrAmbulance)}`,
  ];
  if (r.reportedBy) lines.push('', `Reported by: ${r.reportedBy}`);
  return lines.join('\r\n');
}

// encodeURIComponent, but spaces as %20 (some mail apps show '+' literally).
const enc = (s: string) => encodeURIComponent(s);

export function injuryMailto(r: InjuryReport): string {
  const cc = [SAFEGUARDING_OFFICER_EMAIL, SAFEGUARDING_CC_EMAIL].join(',');
  return `mailto:${MEDICAL_OFFICER_EMAIL}?cc=${enc(cc)}&subject=${enc(injuryEmailSubject(r))}&body=${enc(injuryEmailBody(r))}`;
}

/** One-tap text to Bekah when a concussion is suspected. */
export function concussionSms(r: Pick<InjuryReport, 'playerName' | 'date' | 'reportedBy'>): string {
  const body = `Suspected concussion: ${r.playerName} (U12), ${ukDate(r.date)}. Injury report sent by email.${r.reportedBy ? ` ${r.reportedBy}` : ''}`;
  // "?&body=" is understood by both iPhone and Android messaging apps
  return `sms:${MEDICAL_OFFICER_MOBILE}?&body=${enc(body)}`;
}
