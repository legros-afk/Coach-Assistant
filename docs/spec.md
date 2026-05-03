# Coach Assistant — Build Spec

You are picking up an empty repo (`legros-afk/Coach-Assistant`) and building a PWA for a U12 grassroots rugby club. The product owner is Flo, head coach at Woodford RFC. Up to six coaches across two or three teams will use this app on match days.

This document is the canonical spec. Read it end-to-end before writing any code.

## Reference files

These should already be in the repo. If any are missing, stop and ask Flo.

1. **This file** — the spec.
2. **`docs/prototype/live-match-prototype-v3.jsx`** — a working React reference for the live match screen. Treat this as the visual + interaction source of truth for that screen. Lift the colours, layout, sub-builder logic, and event model from it. Don't reinvent any of this — match it.
3. **`docs/woodford-logo.png`** — the official club logo. Brand purple is `#782880`. Ink black is `#201820`.

---

## Product overview

A coach's match-day assistant for U12 rugby (11 a-side, 5 forwards / 5 backs / 1 scrum-half, 2x20 minute halves, 1 try = 1 point, no conversions or drop goals).

**The problem it solves.** Coaches juggle live scoring, clock management, batched substitutions, equal-minutes balancing, and player welfare (blood/injury) across two simultaneous teams of ~15 players each. Doing this on paper or in your head is unreliable. The app makes it one-thumb easy on a phone in a wet field.

**Users.** ~6 coaches at one club for v1. May spread to other clubs if it's good. Each coach is also a parent of one of the players. Most coaches will use this on a phone; a few might use a tablet for pre-match prep.

**Data philosophy.** Player records use first names only — children's surnames are more personal data than the app needs. Where two players share a first name, append a short disambiguator (`Henry W`, `Henry T`, `Henry H`).

---

## Architecture

Three things to internalise. They shape everything else.

### 1. Offline-first PWA

- React 18 + TypeScript + Vite, installable to home screen on iOS and Android.
- All state lives in IndexedDB (via Dexie). The UI never blocks on network.
- Service worker for offline shell.

### 2. Asymmetric Drive sync

This is the critical insight that drives the whole sharing model.

The publishing coach maintains a Google Drive folder set to **"Anyone with the link can view."** Squad and fixture data live in this folder as JSON files. The other coaches read from the folder via the public read endpoint — using just an API key, **no Google sign-in**, no OAuth.

This means:
- **Publisher (head coach):** signs in with Google once, writes to Drive via OAuth. Maintains squad and team sheets.
- **Subscribers (other coaches):** paste the folder link or ID into the app on first run. Done. No accounts of any kind. Works on iPhone and Android equally.

The asymmetry matches reality — one person organises, everyone else consumes. It also dodges the "Apple users without Gmail" problem entirely.

```
                  ┌─────────────────────────┐
                  │   Public Drive folder   │
                  │  (anyone with link can  │
                  │       view)             │
                  └────────┬────────────────┘
                           │
        ┌──────────────────┼─────────────────┐
        │                  │                 │
   OAuth write        Public read       Public read
        │                  │                 │
        ▼                  ▼                 ▼
   ┌─────────┐        ┌─────────┐       ┌─────────┐
   │  Flo    │        │  Barry  │  ...  │   Rob   │
   │ Google  │        │ no acct │       │ no acct │
   └─────────┘        └─────────┘       └─────────┘
```

### 3. Event-sourced match state

All match changes are append-only events. Player minutes, current status, score, etc. are *derived* by replaying events. This makes undo trivial and gives a clean audit log.

The pure function `replayEvents(events, teamSheet) -> MatchState` is the heart of the app. Write it first, test it thoroughly, build the UI on top.

---

## Stack

- **React 18 + TypeScript + Vite**
- **Tailwind CSS** with CSS variables for the Woodford palette
- **Dexie** for IndexedDB
- **Zustand** for client state (one store per major domain: squad, fixtures, activeMatch)
- **lucide-react** for icons
- **`gapi-script`** + Google Identity Services for OAuth (publisher only)
- **`vite-plugin-pwa`** for service worker, manifest, install prompt
- **date-fns** for date handling
- **Vitest** for unit tests

Avoid: Next.js (overkill), Firebase (we explicitly don't want a backend), heavy DnD libraries (use HTML5 DnD if needed; if it gets ugly, fall back to checklist mode).

## Project layout

```
/src
  /app              # Routing, providers, app shell
  /features
    /squad          # Squad management screens + logic
    /fixture        # Fixture and team-sheet prep screens
    /match          # Live match screen (the big one)
    /post-match     # Summary screens
  /lib
    /db             # Dexie schemas, migrations
    /drive          # Drive sync — read (public) and write (OAuth)
    /events         # Event types, reducers, replay logic
    /domain         # Pure logic: parseTeamSheet, suggestSub, validateComposition, etc.
  /components       # Shared UI primitives
  /styles           # Tailwind config + CSS vars
/public
  /icons            # PWA icons
  woodford-mark.svg
/docs
  /prototype        # live-match-prototype-v3.jsx and any future references
  spec.md           # This file
  setup.md          # Coach onboarding instructions (write during step 9)
```

---

## Data model

```ts
type ID = string; // ULID

type Group = 'forward' | 'back' | 'scrumhalf';

interface Player {
  id: ID;
  name: string;            // First name, with optional disambiguator: "Henry W"
  defaultGroup: Group;
  eligibleGroups: Group[]; // Always includes defaultGroup
  notes?: string;
  // v2 hook — DO NOT use in v1 UI, but the field exists
  ratings?: { impact: 1|2|3|4|5; development: 1|2|3|4|5 };
}

interface Squad {
  id: ID;
  name: string;            // "Woodford U12"
  season: string;          // "2025-26"
  players: Player[];
  updatedAt: string;       // ISO
  updatedBy?: string;      // Email of the publisher, optional
  version: number;         // Incremented on every save, for conflict detection
}

interface Fixture {
  id: ID;
  date: string;            // ISO date
  opponent: string;
  teamSheets: TeamSheet[];
  publishedAt?: string;
  updatedAt: string;
  version: number;
}

interface TeamSheet {
  id: ID;
  label: string;           // "A" | "B" | "C"
  starters: { forwards: ID[]; backs: ID[]; scrumhalf: ID };
  bench: ID[];
  unavailable: ID[];       // Squad members not playing today
}

interface Match {
  id: ID;
  fixtureId: ID;
  teamSheetId: ID;
  opponent: string;
  events: MatchEvent[];
  startedAt?: string;
  endedAt?: string;
  version: number;
}

type MatchEvent =
  | { id: ID; ts: string; type: 'CLOCK_START';     payload: { half: 1 | 2 } }
  | { id: ID; ts: string; type: 'CLOCK_PAUSE';     payload: { elapsedMs: number } }
  | { id: ID; ts: string; type: 'HALF_END';        payload: { half: 1 | 2; elapsedMs: number } }
  | { id: ID; ts: string; type: 'MATCH_END';       payload: { elapsedMs: number } }
  | { id: ID; ts: string; type: 'TRY_US';          payload: { scorerId?: ID; elapsedMs: number } }
  | { id: ID; ts: string; type: 'TRY_THEM';        payload: { elapsedMs: number } }
  | { id: ID; ts: string; type: 'SUB_BATCH';       payload: { offIds: ID[]; onIds: ID[]; elapsedMs: number } }
  | { id: ID; ts: string; type: 'BLOOD_OFF';       payload: { playerId: ID; elapsedMs: number } }
  | { id: ID; ts: string; type: 'BLOOD_RETURN';    payload: { playerId: ID; elapsedMs: number } }
  | { id: ID; ts: string; type: 'INJURED_OFF';     payload: { playerId: ID; elapsedMs: number } }
  | { id: ID; ts: string; type: 'INJURED_RETURN';  payload: { playerId: ID; elapsedMs: number } };

// Derived from events — never stored
interface MatchState {
  half: 1 | 2;
  elapsedMs: number;
  running: boolean;
  scoreUs: number;
  scoreThem: number;
  playerStates: Map<ID, {
    status: 'on' | 'bench' | 'blood' | 'injured';
    minutesPlayed: number;
    currentStintStartedAtMs?: number;
    triesScored: number;
  }>;
}
```

---

## Drive folder layout

The publisher's Drive folder, set to "Anyone with the link can view":

```
/Coach Assistant — Woodford U12/
  squad.json                              # Full ~30 player roster
  fixtures/
    2026-09-14-saints.json                # One file per fixture
    2026-09-21-harlequins.json
  matches/
    2026-09-14-saints-A.json              # Live match data, optional
    2026-09-14-saints-B.json
```

### Sync paths

**Read (subscribers, no auth):**
```
GET https://www.googleapis.com/drive/v3/files?q='{folderId}'+in+parents&key={apiKey}
GET https://www.googleapis.com/drive/v3/files/{fileId}?alt=media&key={apiKey}
```

The API key is embedded in the app and restricted in Google Cloud Console to:
- Drive API only
- HTTP referrers: the production domain (and `localhost` for dev)

This makes the embedded key inert outside the app.

**Write (publisher only, OAuth):**
- Scope: `drive.file` (only files the app creates).
- One-time setup: sign in with Google, paste folder URL, app verifies access.
- Conflict handling: read remote `version` before writing; if mismatch, show diff and ask user how to merge.

### Subscriber first-run

1. Coach opens the app for the first time.
2. App asks: paste Drive folder link or ID.
3. App parses (regex accepts both URL and bare ID), stores canonical ID in `localStorage`.
4. App calls Drive list API with API key. If 200, fetches `squad.json` and any pending fixtures.
5. If 403/404, shows: "Couldn't read this folder. Make sure the link is correct and the folder is set to 'Anyone with the link can view'."

No sign-in screen. No Google account prompt.

### Match data writes

If Team A's coach is the publisher, their match writes go to Drive (`matches/{date}-{label}.json`).
If Team B's coach has no Google account, their match writes stay in IndexedDB only. After the match they can:
- Send the public WhatsApp summary (text)
- Export the private coach summary as a JSON file (manual share)

This is fine for v1 — peek mode is dropped (each coach runs their team independently).

If a non-publishing coach *does* have Google, they can opt in to publishing their match data later. Build the architecture so this is a config toggle, not a fork.

---

## Live match — the screen that matters most

Build this first. It's the highest-risk UX, and the v3 prototype already proves it works.

### Visual reference

Match `docs/prototype/live-match-prototype-v3.jsx`. Specifically:

- Brand strip (purple `#782880`) with Woodford mark, team name, opponent, motto "Nunquam Respice".
- Black clock bar (ink `#201820`) with elapsed time, half indicator, play/pause, score buttons.
- Coach nudge banner (suggested batch sub) — appears when an on-pitch player exceeds avg+3min while a same-group bench player is below avg-3min. Re-evaluates every 60s.
- Three sections: On pitch, Bench, Off (blood/injured). Two-column card grid in each.
- Each card shows name, group badge, minutes, balance dot, tries, inline actions.
- Sub builder: tap "Build subs" → tap pitch cards (highlight rose) and bench cards (highlight emerald) → black tray rises with pairing preview → confirm button validates 5F/5B/1SH composition.
- Try scorer modal slides up from bottom.
- Bottom bar with Undo and Build Subs.
- Toast for transient feedback.

### Sub algorithm (locked)

- Pool = bench players whose `eligibleGroups` overlap with the going-off player's `eligibleGroups`, excluding blood/injured.
- Sort by `minutesPlayed` ascending. Suggest pool[0].
- For batch: pair greedy, same-group first.
- **Composition validation is loose** — only block if the resulting on-pitch composition isn't 5/5/1.

### Coach nudge

Every 60s of clock time, re-evaluate. If any on-pitch player's minutes exceed `avg + 3min` AND a same-group bench player exists with minutes below `avg - 3min`, surface a non-blocking banner with the suggested swap. Dismissible.

### Undo

Pop last event, recompute MatchState. Batched subs undo as one unit. Confirmation modal for destructive events (try, sub) — no confirmation for clock toggles.

### Score

Try = 1 point. No conversions, no drop goals. Try scorer attribution opens a picker; "Unattributed / decide later" is always available.

---

## Squad management

### Display name convention

Free-text `name` field. Most players are first-name only; collisions get a short disambiguator (`Henry W`, `Henry T`, `Henry H`).

### Editing

- List view, sorted alphabetically by display name (so all the Henrys group together).
- Tap a player → edit panel: name, default group radio, eligible groups checkboxes (default group always checked, can't be unchecked), notes, delete.
- "Add player" button.
- "Publish to club" — writes squad.json to Drive with incremented version. Publisher only (greyed out for subscribers).
- "Pull from club" — fetches latest squad.json. Warn before overwriting unpublished local changes.

### Conflict handling on publish

Squad edits are rare but two coaches editing simultaneously is plausible (both adding a new joiner on the same evening).

- Before writing, app reads current Drive `squad.json` version.
- If local `version` matches Drive `version`: write with `version + 1`.
- If mismatch: don't write. Show 3-way diff: common ancestor (last pulled), theirs (current Drive), yours (local edits). Per-field merge UI for the conflicts only. Non-conflicting fields take the union.

### Empty state

The app must work fully without a real squad. Squad screen empty-state: "No players yet — add your first" with a button. Also a "Load demo squad" button that populates with the fictional squad in the prototype, so the live match screen and parser can be tested before the real squad exists. Demo data must be clearly labeled as demo, and there must be a one-tap "Clear demo data" affordance.

---

## Fixture and team-sheet preparation

Three input modes accessible via tabs at the top of the fixture prep screen:

### Mode 1 — Bulk paste (likely the most-used)

Big textarea. Coach pastes any of these formats:

**Format A — flat lists per team (most common):**
```
Team A: Henry W, Tom B, Oliver, ...
Bench: Patterson, Quinn, Roberts
```

**Format B — one name per line:**
```
Team A
Henry W
Tom B
...
```

**Format C — explicit groups (some coaches will use this):**
```
Team A
F: Henry W, Tom B, Oliver, ...
B: Khan, Patel, Lewis, ...
SH: O'Neill
Bench: Patterson, Quinn
```

**Format D — multi-team dump:**
Concatenated A and B blocks.

Tolerate: extra whitespace, `Forwards`/`Backs`/`Scrum half` as full words, case-insensitive headers, `&` and `and` as separators alongside commas, trailing commas, `Bench`/`Subs`/`Finishers` treated as synonyms.

### Mode 2 — Checklist

All available players shown. Tap to assign Team A / Team B / Bench / Unavailable. Auto-places into the player's `defaultGroup` slot. Long-press or pill-tap on assigned card to override group.

### Mode 3 — Drag from squad list

Two-pane: squad left, team slots right. Drag and drop. **Phone (< 768px) falls back to checklist mode.** Don't even render the drag mode on narrow screens — saves a confusing UX path.

### Resolution flow (used by all modes, but most relevant to bulk paste)

For each parsed name token:

1. **Exact match** on `name` (case-insensitive, trim) → resolved.
2. **Punctuation-normalised match** (`Henry W.` matches `Henry W`; `O Neill` matches `O'Neill`) → resolved.
3. **First-token match** when uniquely identifying. If only one player's name starts with `Tom`, then `Tom` resolves. If there are three Henrys, `Henry` does NOT resolve here.
4. **Multi-match** at any layer → mark as `ambiguous` with candidate list.
5. **Fuzzy match** (Levenshtein ≤ 2 on a single token) only on layers 1 and 2. Never fuzzy-match a bare first-name into an ambiguous set — too easy to silently pick the wrong Henry.
6. No match → `unknown`.

Then for resolved players:

7. **Auto-assign group from `defaultGroup`.**
8. **Run composition check.** If 5F/5B/1SH cleanly, show ✓.
9. **If composition is broken,** look at multi-eligible players who could move:
   - "You have 6 forwards. Brown could play back (eligible). Move?"
   - Multiple candidates → list, coach picks one.
   - No eligible mover → team sheet invalid, coach swaps a player.

### Review screen (always shown — no auto-publish from paste)

```
Team A — review

Forwards (5/5)
  Henry W       F
  Tom B         F
  Brown         F  (could also play B)
  ...

Backs (5/5)
  Khan          B
  Lewis         B  (could also play SH)
  ...

Scrum-half (1/1)
  O'Neill       SH (could also play B)

Bench (4)
  ...

Unknown / unresolved
  ⚠ "Henry"  →  3 possible matches
     ( ) Henry W
     ( ) Henry T
     ( ) Henry H
     [ Skip ]

  ⚠ "Smyth"  →  no match — did you mean Smith? [Use Smith] [Add new] [Skip]

[Edit] [Confirm and publish]
```

Group tags are always shown in the review even if auto-assigned — coach's last chance to spot a wrong assumption.

### Composition counter

Always visible during prep: `5F / 5B / 1SH per team`. Can't publish a team that's short.

### Parser test cases

Add to `parseTeamSheet.test.ts`:

- `"Henry W, Henry T, Henry H"` → all three resolve cleanly.
- `"Henry"` (alone) → ambiguous, returns 3-match list.
- `"henry w"` → resolves to `Henry W` (case-insensitive).
- `"Henry W."` → resolves to `Henry W` (trailing punctuation stripped).
- `"Henry Q"` → unknown (Henry exists as first-token but disambiguator doesn't match any).
- `"Hennry W"` → fuzzy-matches `Henry W` (typo on disambiguated name is OK).
- `"Hennry"` → unknown (don't fuzzy-match a bare first-name into an ambiguous set).
- All four formats (A, B, C, D) parse correctly.
- Composition broken with single eligible mover → suggests the move.
- Composition broken with multiple movers → returns candidate list.
- Composition broken with no movers → returns invalid with reason.

---

## Match-day home

App opens to home. If today has a fixture, show:

```
┌──────────────────────────────────┐
│  Today · vs Saints               │
│                                  │
│  Which team are you coaching?    │
│                                  │
│  [  Team A  ]  [  Team B  ]      │
│                                  │
│  [Just viewing]                  │
└──────────────────────────────────┘
```

Tap Team A or Team B → enters live match screen. "Just viewing" enters read-only mode.

Coaches pick fresh each match day — no persistent assignment in v1.

---

## Post-match

Two outputs, two distinct buttons:

### Public summary (Share to team)

```
Woodford U12 A vs Saints — 4-2
Tries: Henry W (2), Tom B, Lewis
Great effort all round 💪
```

No minutes. Copy-to-clipboard + native share intent (opens WhatsApp share sheet on mobile).

### Private coach summary (Coach summary)

- Full minutes-played table
- Substitution log
- Try attribution
- Blood/injury events with timestamps
- Saves to Drive `matches/` folder if publisher; otherwise downloadable JSON.

### Layout note for v2

The action row at the top of the post-match screen should be designed to accommodate a third button (between the two existing ones) without rework. v1 ships with two buttons; v2 adds **Fun summary**. See "v2 scope" section. Don't build the third button now — just don't paint yourself into a layout corner.

---

## Build sequence

Each step is a clean stopping point. Don't try to do this in one session.

1. **Scaffold.** Vite + React + TS + Tailwind + PWA plugin. Hello-world rendering with the Woodford brand strip. CSS vars for the palette.
2. **Domain layer.** Pure TS modules in `/lib/domain` and `/lib/events`. Event types, replay function, sub algorithm, composition checker, `parseTeamSheet`. Unit-tested with Vitest. NO UI yet.
3. **Live match screen with mock data.** Hardcode a squad and team sheet. Wire up state via Zustand backed by the replay function. Match the v3 prototype visually.
4. **Dexie persistence layer.** Pull state from IndexedDB, write events back. Survive a refresh.
5. **Drive sync (read-only path).** API-key based. Subscriber first-run flow. Pull squad and fixtures. No write yet.
6. **Squad management screen.** Includes "Load demo squad" empty-state. Read from IndexedDB; no write to Drive yet.
7. **Fixture prep screen.** Start with checklist mode + parser. Bulk paste second. Drag third or skip.
8. **Match-day home + team picker.**
9. **Drive sync (OAuth write path).** Publisher signs in with Google, publishes squad and fixtures. Conflict handling.
10. **Post-match screens.**
11. **PWA polish.** Manifest, icons, install prompt, service worker for offline shell.

After each step: commit, push, demo to Flo. Don't merge ahead.

---

## Behaviour rules for Claude Code

- **Match the v3 prototype visually.** It's been iterated with the user. Don't redesign the live match screen unless explicitly asked.
- **Ask before changing the data model.** It's been thought through. Additions are usually fine; renaming or restructuring needs a conversation.
- **Don't add features outside this spec.** Specifically: no Spond, no real-time multi-coach editing, no peek mode, no player ratings UI, no cross-match minutes, no conversions/drop goals.
- **Test the domain layer.** UI can be tested by hand for v1, but `replayEvents`, `suggestSub`, `validateComposition`, and `parseTeamSheet` need unit tests. They're the brain.
- **Keep PRs small.** One screen per PR ideally. Each PR runnable end-to-end.
- **Brand discipline.** Purple `#782880` is the primary brand colour. Keep functional colours (red/amber/green for status, rose/emerald for sub picks) separate from brand. Don't tint everything purple.
- **Mobile-first.** Design for a thumb on a 6" screen in cold weather. Test resize down to 360px wide. Tap targets ≥56px tall.
- **Offline-first.** Every action must work offline. Drive sync is opportunistic, never blocking.
- **Don't over-engineer.** This is a tool for one club. Ship simple, make it good.

When you reach a decision point that isn't covered here, ask Flo before guessing.

---

## Data-handling notes (write down, not code)

- The Drive folder is set to "Anyone with the link can view." Do not post the link publicly (e.g. on a club website). Share via WhatsApp to coaches only.
- The `notes` field on a Player is free text and visible to all coaches with Drive access. Coaches should be cautious about what they put there.
- The post-match private summary stays inside the coaching group — never published to parents or in the public team WhatsApp.
- Review and prune coach access to the folder at the end of each season. Rotating the folder (creating a new one with a new link) is the way to revoke access if needed.
- The OAuth client (used only by the publisher) lives under Flo's personal Google account in v1. Other clubs adopting the app would create their own OAuth client.

---

## v2 scope (clearly marked — DO NOT BUILD IN v1)

These are known directions for after v1 ships. Listed here so the v1 architecture doesn't accidentally close them off. **Claude Code: do not implement any of these in v1.** They exist purely as design constraints — meaning the v1 code should leave room for them, not include them.

### LLM-generated fun summaries

After a match, coaches want a short, cheeky natural-language summary of the result they can copy into the team WhatsApp ("Cracking afternoon at Woodford as the lads put 4 past Saints, with Henry W in absolutely ruthless form..."). This is generated by an LLM via Flo's self-hosted proxy server.

**Architecture (for reference, not for v1 build):**
- The post-match screen will gain a third action button: **Fun summary** (between Share to team and Coach summary).
- Tapping it POSTs the existing match summary data to a configurable proxy URL with a shared secret in the `Authorization` header.
- The proxy (Flo's OpenClaw server, or any club's equivalent) calls the Anthropic API with a tuned system prompt and returns plain text.
- App displays the returned text in a card with a Copy button. Coach pastes into WhatsApp.
- If the proxy is unreachable, button shows a non-blocking toast — the rest of the app is unaffected.

**v1 implications (these matter now):**
- Post-match action row must be designed for three buttons, not two. (Already noted in the post-match section above.)
- The data structure passed to the public summary already contains everything the proxy would need (opponent, our score, their score, scorers with try counts) — no schema changes needed when v2 lands.
- App settings will eventually need two new fields: `summaryProxyUrl` and `summaryProxySecret`. These are not in v1, but the settings screen layout should accommodate adding them without redesign.
- The feature is opt-in per install. Off by default. Other clubs adopting the app can point at their own proxy or leave it disabled.

**Out of scope even for v2:** any LLM call from the app directly to the Anthropic API. Always via a proxy. Never embed the Anthropic API key in client code.

### Other known v2 directions (lighter touch — listed for awareness only)

- **Player ratings** — `Player.ratings` field already exists in the v1 schema, hidden from UI. v2 will surface a 1–5 rating UI and use it to inform the sub algorithm (preserve on-pitch impact when subbing).
- **Multi-coach live editing** of the same team's match (CRDT or similar). Out of scope in v1; each coach runs their own team independently.
- **Cross-match minutes tracking** for the rare case where a player plays for two teams in one day.
- **Telegram or other channel integrations** for distributing summaries. Considered and explicitly declined for Woodford (parents don't use Telegram). May be relevant for other clubs.

---

## Open questions remaining

- **Squad list.** Flo will provide the ~30 names with default groups in late summer when the U13 squad is settled. Until then, the app must work end-to-end with the demo squad.
- **PWA icons.** A 512x512 PNG of the Woodford mark on a solid purple background, needed for step 11.
- **Hosting.** Cloudflare Pages, Vercel, or Netlify — recommend Cloudflare Pages, free and simple, GitHub auto-deploy. Decide before step 9 (OAuth needs the production URL registered).

---

## Now: start with step 1.

Scaffold the repo, set up Tailwind with Woodford colours as CSS vars, render a placeholder live match screen with the brand strip. Push, then we review.
