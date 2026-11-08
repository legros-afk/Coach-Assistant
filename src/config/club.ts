// Per-deployment club configuration — the only file that should need
// changing to reuse this app for a different team. Reusing it elsewhere:
// change DRIVE_FOLDER_ID below, then set a fresh CLUB_PUBLISH_CODE secret
// in that deployment's Cloudflare Pages project (never commit that value).
export const DRIVE_FOLDER_ID = '1DDoxJneiEhjJeJ2gualLEuraGN6gua8n';

// Starts and minutes count from this date (inclusive). Earlier matches stay in
// the history but don't count — reset for the start of the competitive
// season. Move it forward to reset the counters again.
export const COUNTING_FROM = '2026-09-28';

// Injury reports go to the same people as the club's paper process
// (Injury_reporting_process_202627.docx). Not user-configurable in v1.
export const MEDICAL_OFFICER_EMAIL      = 'body_elite_essex@hotmail.com';  // To — Bekah Owen, Head of Medical
export const SAFEGUARDING_OFFICER_EMAIL = 'lizngrant@yahoo.co.uk';         // Cc — Liz Alvarez, Safeguarding Officer
export const SAFEGUARDING_CC_EMAIL      = 'couppis@gmail.com';             // Cc — second safeguarding Cc (per Sarah, 08/11)
export const MEDICAL_OFFICER_MOBILE     = '07857301296';                   // Bekah — for concussion SMS alert
// Subject is built per-report: `Youth & Mini Injury Report: {player name}, {date}`
export const INJURY_EMAIL_SUBJECT_PREFIX = 'Youth & Mini Injury Report';
