// A rugby season is named for the two calendar years it spans ("2026-27").
// Woodford's runs September to April, so any cutover between May and August
// is safe; July is used to keep late-season fixtures on the right side of it.
const SEASON_START_MONTH = 6; // July, zero-indexed

export function seasonFor(date: Date): string {
  const year = date.getFullYear();
  const startYear = date.getMonth() >= SEASON_START_MONTH ? year : year - 1;
  const endYear = String(startYear + 1).slice(2);
  return `${startYear}-${endYear}`;
}

export function currentSeason(): string {
  return seasonFor(new Date());
}
