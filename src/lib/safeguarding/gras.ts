import type { ConcussionProtocol, ConcussionStage, StageNumber } from './types';

// RFU HEADCASE Graduated Return to Activity and Sport (GRAS), September 2023.
// Applies to all community rugby players regardless of age. Day 0 = date of
// injury. Minimum 21 days in total.
export const GRAS_SOURCE = 'RFU HEADCASE GRAS Programme, September 2023';
export const GRAS_MIN_DAYS = 21;

export const GRAS_STAGES: ReadonlyArray<Omit<ConcussionStage, 'completed' | 'completedAt' | 'notes'> & { startLabel: string }> = [
  { stage: 1, name: 'Initial relative rest',      earliestStartDay: 0,  startLabel: 'Day 0 (24–48 hours)',
    description: 'Physical and cognitive rest. No screens, no school, no sport. See a doctor within 24 hours.' },
  { stage: 2, name: 'Return to daily activities', earliestStartDay: 3,  startLabel: 'Day 3 onwards',
    description: 'Gradual return to normal activities. Return to school before starting sport. Symptom-free required to progress.' },
  // "When symptoms allow" — no fixed day; it can never come before stage 2.
  { stage: 3, name: 'Aerobic exercise',           earliestStartDay: 3,  startLabel: 'When symptoms allow',
    description: 'Light aerobic exercise and low-level resistance training. No contact or head-impact risk.' },
  { stage: 4, name: 'Non-contact drills',         earliestStartDay: 8,  startLabel: 'No earlier than Day 8',
    description: 'Sport-specific non-contact training. HCP review recommended before progressing.' },
  { stage: 5, name: 'Full contact practice',      earliestStartDay: 15, startLabel: 'No earlier than Day 15',
    description: 'Full contact training. Must be symptom-free for 14 days before starting.' },
  { stage: 6, name: 'Return to competition',      earliestStartDay: 21, startLabel: 'No earlier than Day 21',
    description: 'Full return to match play. Earliest return is day 21 and only if symptom-free.' },
];

export function startLabel(stage: StageNumber): string {
  return GRAS_STAGES[stage - 1].startLabel;
}

/** The six stages, none completed, ready to attach to a new protocol. */
export function freshStages(): ConcussionStage[] {
  return GRAS_STAGES.map(({ stage, name, description, earliestStartDay }) => ({
    stage, name, description, earliestStartDay, completed: false,
  }));
}

// ── date maths on plain yyyy-mm-dd dates (local calendar days) ───────────────

function parseDay(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function toIsoDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function addDays(iso: string, days: number): string {
  const d = parseDay(iso);
  d.setDate(d.getDate() + days);
  return toIsoDay(d);
}

/** Whole calendar days from `fromIso` to `toIso` (negative if before). */
export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((parseDay(toIso).getTime() - parseDay(fromIso).getTime()) / 86_400_000);
}

// ── protocol state ───────────────────────────────────────────────────────────

export function isActive(p: ConcussionProtocol): boolean {
  return !p.completedAt;
}

export function daysElapsed(p: ConcussionProtocol, today: string = toIsoDay(new Date())): number {
  return Math.max(0, daysBetween(p.concussionDate, today));
}

/** The first stage not yet completed, or null when all six are done. */
export function currentStage(p: ConcussionProtocol): ConcussionStage | null {
  return p.stages.find(s => !s.completed) ?? null;
}

export function stageEarliestDate(p: ConcussionProtocol, stage: ConcussionStage): string {
  return addDays(p.concussionDate, stage.earliestStartDay);
}

export function earliestReturnDate(p: ConcussionProtocol): string {
  return addDays(p.concussionDate, GRAS_MIN_DAYS);
}

/** Days until the earliest possible return to play (0 once reached). */
export function daysUntilEarliestReturn(p: ConcussionProtocol, today: string = toIsoDay(new Date())): number {
  return Math.max(0, daysBetween(today, earliestReturnDate(p)));
}

export type StageCheck = { ok: true } | { ok: false; reason: string };

/**
 * Whether `stage` may be ticked off today. Stages go strictly in order, and
 * none can be signed off before its earliest start day.
 */
export function canCompleteStage(p: ConcussionProtocol, stage: StageNumber, today: string = toIsoDay(new Date())): StageCheck {
  const cur = currentStage(p);
  if (!cur) return { ok: false, reason: 'All stages are already complete.' };
  if (stage !== cur.stage) {
    return stage < cur.stage
      ? { ok: false, reason: `Stage ${stage} is already done.` }
      : { ok: false, reason: `Finish stage ${cur.stage} first — stages go in order.` };
  }
  const s = p.stages[stage - 1];
  const earliest = stageEarliestDate(p, s);
  if (daysBetween(today, earliest) > 0) {
    return { ok: false, reason: `Stage ${stage} can't start before day ${s.earliestStartDay} (${earliest}).` };
  }
  return { ok: true };
}

/** Tick off the current stage. Signing off stage 6 completes the protocol. */
export function completeStage(p: ConcussionProtocol, stage: StageNumber, nowIso: string, notes?: string): ConcussionProtocol {
  const stages = p.stages.map(s => s.stage === stage
    ? { ...s, completed: true, completedAt: nowIso, ...(notes ? { notes } : {}) }
    : s);
  const done = stages.every(s => s.completed);
  return { ...p, stages, ...(done ? { completedAt: nowIso } : {}), version: p.version + 1 };
}

/**
 * Symptoms came back: the player drops back to the previous stage, i.e. the
 * last completed stage is reopened. A manual call by the safeguarding officer.
 */
export function dropBackStage(p: ConcussionProtocol): ConcussionProtocol {
  const lastDone = [...p.stages].reverse().find(s => s.completed);
  if (!lastDone) return p;
  const stages = p.stages.map(s => s.stage === lastDone.stage
    ? { stage: s.stage, name: s.name, description: s.description, earliestStartDay: s.earliestStartDay, completed: false }
    : s);
  const { completedAt: _drop, ...rest } = p;
  return { ...rest, stages, version: p.version + 1 };
}
