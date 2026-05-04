import type { Group, Player } from '../events/types';

export type ParsedSlot =
  | { status: 'resolved'; player: Player; assignedGroup: Group }
  | { status: 'ambiguous'; token: string; candidates: Player[] }
  | { status: 'unknown'; token: string; fuzzyMatch?: Player };

export interface ParsedBlock {
  label: string;
  starters: ParsedSlot[];
  bench: ParsedSlot[];
}

export interface ParseResult {
  blocks: ParsedBlock[];
}

// ─── text parsing ─────────────────────────────────────────────────────────────

interface RawToken {
  token: string;
  hintedGroup: Group | null;
}

interface RawBlock {
  label: string;
  tokens: RawToken[];
  bench: string[];
}

const isTeamHeader     = (s: string) => /^team\s+[a-c]$/.test(s);
const isForwardsHeader = (s: string) => /^(forwards?|f)$/.test(s);
const isBacksHeader    = (s: string) => /^(backs?|b)$/.test(s);
const isScrumHeader    = (s: string) => /^(scrum[\s-]?half|scrumhalf|sh)$/.test(s);
const isBenchHeader    = (s: string) => /^(bench|subs?|finishers?)$/.test(s);

function splitTokens(s: string): string[] {
  return s.split(/,|\s+and\s+|&/)
    .map(t => t.trim())
    .filter(Boolean);
}

function extractRawBlocks(text: string): RawBlock[] {
  const blocks: RawBlock[] = [];
  let current: RawBlock | null = null;
  let mode: 'starters' | 'bench' = 'starters';
  let hintedGroup: Group | null = null;

  function newBlock(label: string) {
    if (current) blocks.push(current);
    current = { label, tokens: [], bench: [] };
    mode = 'starters';
    hintedGroup = null;
  }

  function addTokens(raw: string[]) {
    if (!current) newBlock('Team');
    for (const t of raw) {
      if (!t) continue;
      if (mode === 'bench') {
        current!.bench.push(t);
      } else {
        current!.tokens.push({ token: t, hintedGroup });
      }
    }
  }

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const head = line.slice(0, colonIdx).trim().toLowerCase();
      const rest = line.slice(colonIdx + 1).trim();
      const inline = rest ? splitTokens(rest) : [];

      if (isTeamHeader(head)) {
        newBlock(line.slice(0, colonIdx).trim());
        addTokens(inline);
      } else if (isForwardsHeader(head)) {
        mode = 'starters'; hintedGroup = 'forward';
        addTokens(inline);
      } else if (isBacksHeader(head)) {
        mode = 'starters'; hintedGroup = 'back';
        addTokens(inline);
      } else if (isScrumHeader(head)) {
        mode = 'starters'; hintedGroup = 'scrumhalf';
        addTokens(inline);
      } else if (isBenchHeader(head)) {
        mode = 'bench'; hintedGroup = null;
        addTokens(inline);
      } else {
        // unrecognised header — treat entire line as name tokens
        addTokens(splitTokens(line));
      }
    } else {
      const low = line.toLowerCase();
      if (isTeamHeader(low)) {
        newBlock(line);
      } else if (isForwardsHeader(low)) {
        mode = 'starters'; hintedGroup = 'forward';
      } else if (isBacksHeader(low)) {
        mode = 'starters'; hintedGroup = 'back';
      } else if (isScrumHeader(low)) {
        mode = 'starters'; hintedGroup = 'scrumhalf';
      } else if (isBenchHeader(low)) {
        mode = 'bench'; hintedGroup = null;
      } else {
        addTokens(splitTokens(line));
      }
    }
  }

  if (current) blocks.push(current);
  return blocks;
}

// ─── name resolution ──────────────────────────────────────────────────────────

function normPunct(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[] = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1]
        ? prev
        : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[n];
}

type InternalResolution =
  | { status: 'resolved'; player: Player }
  | { status: 'ambiguous'; token: string; candidates: Player[] }
  | { status: 'unknown'; token: string; fuzzyMatch?: Player };

function resolveToken(token: string, squad: Player[]): InternalResolution {
  const t = token.trim();
  if (!t) return { status: 'unknown', token: t };

  const tLow = t.toLowerCase();
  const tNorm = normPunct(t);

  // Layer 1: exact case-insensitive match on full name
  const exact = squad.filter(p => p.name.toLowerCase() === tLow);
  if (exact.length === 1) return { status: 'resolved', player: exact[0] };
  if (exact.length > 1)   return { status: 'ambiguous', token: t, candidates: exact };

  // Layer 2: punctuation-normalised match
  const normMatches = squad.filter(p => normPunct(p.name) === tNorm);
  if (normMatches.length === 1) return { status: 'resolved', player: normMatches[0] };
  if (normMatches.length > 1)   return { status: 'ambiguous', token: t, candidates: normMatches };

  // Layer 3: first-token unique match (single-word token only)
  if (!tLow.includes(' ')) {
    const firstTok = squad.filter(p => p.name.split(/\s+/)[0].toLowerCase() === tLow);
    if (firstTok.length === 1) return { status: 'resolved', player: firstTok[0] };
    if (firstTok.length > 1)   return { status: 'ambiguous', token: t, candidates: firstTok };
  }

  // Layer 4: fuzzy match on layers 1 and 2 only (Levenshtein ≤ 2)
  // Never fuzzy-match a bare first-name — only match full or punct-normalised names
  const fuzzy = squad.filter(p => {
    const d1 = levenshtein(p.name.toLowerCase(), tLow);
    const d2 = levenshtein(normPunct(p.name), tNorm);
    return Math.min(d1, d2) <= 2;
  });
  if (fuzzy.length === 1) return { status: 'unknown', token: t, fuzzyMatch: fuzzy[0] };

  return { status: 'unknown', token: t };
}

// ─── public API ───────────────────────────────────────────────────────────────

export function parseTeamSheet(text: string, squad: Player[]): ParseResult {
  const rawBlocks = extractRawBlocks(text);

  return {
    blocks: rawBlocks.map(block => {
      const starters: ParsedSlot[] = block.tokens.map(({ token, hintedGroup }) => {
        const res = resolveToken(token, squad);
        if (res.status === 'resolved') {
          return {
            status: 'resolved',
            player: res.player,
            assignedGroup: hintedGroup ?? res.player.defaultGroup,
          };
        }
        return res;
      });

      const bench: ParsedSlot[] = block.bench.map(token => {
        const res = resolveToken(token, squad);
        if (res.status === 'resolved') {
          return {
            status: 'resolved',
            player: res.player,
            assignedGroup: res.player.defaultGroup,
          };
        }
        return res;
      });

      return { label: block.label, starters, bench };
    }),
  };
}
