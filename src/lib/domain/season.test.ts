import { describe, expect, it } from 'vitest';
import { seasonFor } from './season';

describe('seasonFor', () => {
  it('names the season for the two years it spans', () => {
    expect(seasonFor(new Date(2026, 8, 6))).toBe('2026-27');   // 06 Sep 2026
  });

  it('keeps the new year half of the season on the same label', () => {
    expect(seasonFor(new Date(2027, 3, 25))).toBe('2026-27');  // 25 Apr 2027
  });

  it('rolls over in the summer, not at new year', () => {
    expect(seasonFor(new Date(2026, 5, 30))).toBe('2025-26');  // 30 Jun
    expect(seasonFor(new Date(2026, 6, 1))).toBe('2026-27');   // 01 Jul
  });

  it('pads the end year to two digits across a century boundary', () => {
    expect(seasonFor(new Date(2099, 8, 1))).toBe('2099-00');
  });
});
