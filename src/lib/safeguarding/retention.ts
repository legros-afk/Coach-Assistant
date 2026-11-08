import { SAFEGUARDING_RETENTION_DAYS } from '@/config/club';
import { daysBetween, toIsoDay } from './gras';
import type { ConcussionProtocol, InjuryReport } from './types';

// Injury reports age from when they were filed (reportedAt); concussion
// protocols from the day of the injury (concussionDate). Past the retention
// period they are deleted outright — no archive copy is kept.

export function isExpired(isoDateOrTimestamp: string | undefined, today: string = toIsoDay(new Date()), days = SAFEGUARDING_RETENTION_DAYS): boolean {
  if (!isoDateOrTimestamp) return false;
  // reportedAt is a UTC timestamp; compare by its local calendar day
  const day = isoDateOrTimestamp.length > 10 ? toIsoDay(new Date(isoDateOrTimestamp)) : isoDateOrTimestamp;
  return daysBetween(day, today) > days;
}

export const injuryExpired = (r: Pick<InjuryReport, 'reportedAt'>, today?: string) => isExpired(r.reportedAt, today);
export const protocolExpired = (p: Pick<ConcussionProtocol, 'concussionDate'>, today?: string) => isExpired(p.concussionDate, today);
