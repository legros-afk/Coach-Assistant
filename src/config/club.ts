// Per-deployment club configuration — the only file that should need
// changing to reuse this app for a different team. Reusing it elsewhere:
// change DRIVE_FOLDER_ID below, then set a fresh CLUB_PUBLISH_CODE secret
// in that deployment's Cloudflare Pages project (never commit that value).
export const DRIVE_FOLDER_ID = '1DDoxJneiEhjJeJ2gualLEuraGN6gua8n';

// Starts and minutes count from this date (inclusive). Earlier matches stay in
// the history but don't count — reset for the start of the competitive
// season. Move it forward to reset the counters again.
export const COUNTING_FROM = '2026-09-28';
