import { describe, expect, it } from 'vitest';
import { eventWindow } from './spondStore';

describe('eventWindow', () => {
  it('spans exactly the requested duration', () => {
    const { startTimestamp, endTimestamp } = eventWindow('2026-10-11', '10:00', 120);
    const mins = (Date.parse(endTimestamp) - Date.parse(startTimestamp)) / 60_000;
    expect(mins).toBe(120);
  });

  it('keeps the kick-off at the coach-entered local clock time', () => {
    const { startTimestamp } = eventWindow('2026-10-11', '10:30', 90);
    const local = new Date(startTimestamp);
    expect(local.getHours()).toBe(10);
    expect(local.getMinutes()).toBe(30);
  });

  it('handles an evening kick-off that runs past midnight UTC', () => {
    const { startTimestamp, endTimestamp } = eventWindow('2027-03-12', '19:00', 180);
    expect(Date.parse(endTimestamp)).toBeGreaterThan(Date.parse(startTimestamp));
    expect(new Date(startTimestamp).getHours()).toBe(19);
  });

  it('emits UTC ISO timestamps', () => {
    const { startTimestamp } = eventWindow('2027-01-10', '10:00', 120);
    expect(startTimestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });
});
