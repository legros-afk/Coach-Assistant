import { useMemo, useState } from 'react'
import { ArrowRight, Check, ChevronLeft, Copy } from 'lucide-react'
import { WoodfordMark } from '@/components/WoodfordMark'
import type { Group, MatchEvent } from '@/lib/events/types'
import { useMatchStore } from './useMatchStore'

const PURPLE      = '#782880'
const PURPLE_DARK = '#5C1E63'
const INK         = '#201820'

const GROUP_SHORT: Record<Group, string> = { forward: 'F', back: 'B', scrumhalf: 'SH' }

function GroupBadge({ group }: { group: Group }) {
  const bg = group === 'forward' ? INK : group === 'back' ? PURPLE : PURPLE_DARK
  return (
    <span
      className="text-[10px] font-bold w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
      style={{ background: bg, color: 'white' }}
    >
      {GROUP_SHORT[group]}
    </span>
  )
}

interface Props { onBack: () => void }

// ── share text builder ────────────────────────────────────────────────────────

function buildShareText(
  opponent: string,
  matchDate: string,
  scoreUs: number,
  scoreThem: number,
  teamLabel: string,
  starterForwards: string[],
  starterBacks: string[],
  starterSH: string,
  subsOn: string[],
  tryScorers: string[],
): string {
  const result = scoreUs > scoreThem ? 'Won' : scoreUs < scoreThem ? 'Lost' : 'Draw'
  const resultLine =
    result === 'Won'  ? `Won ${scoreUs}–${scoreThem} 🎉` :
    result === 'Lost' ? `Lost ${scoreUs}–${scoreThem}` :
                        `Drew ${scoreUs}–${scoreThem}`

  const lines: string[] = []
  lines.push(`🏉 Woodford RFC U12 vs ${opponent}`)
  if (matchDate) lines.push(matchDate)
  lines.push('')
  lines.push(resultLine)
  lines.push('')
  lines.push(`Team ${teamLabel}`)
  if (starterForwards.length) lines.push(`Forwards: ${starterForwards.join(', ')}`)
  if (starterBacks.length)    lines.push(`Backs: ${starterBacks.join(', ')}`)
  if (starterSH)              lines.push(`Scrum-half: ${starterSH}`)
  if (subsOn.length)          lines.push(`Subs on: ${subsOn.join(', ')}`)
  if (tryScorers.length) {
    lines.push('')
    lines.push(`🎯 Tries: ${tryScorers.join(', ')}`)
  }
  lines.push('')
  lines.push('Nunquam Respice 🟣')
  return lines.join('\n')
}

// ── main component ────────────────────────────────────────────────────────────

export default function PostMatchScreen({ onBack }: Props) {
  const { squad, teamSheet, opponent, matchState, events } = useMatchStore()
  const [tab, setTab]       = useState<'share' | 'coach'>('share')
  const [copied, setCopied] = useState(false)

  const playerMap = useMemo(() => new Map(squad.map(p => [p.id, p])), [squad])

  // Match date from first event timestamp
  const matchDate = events.length > 0
    ? new Date(events[0].ts).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
    : ''

  const { scoreUs, scoreThem } = matchState
  const result = scoreUs > scoreThem ? 'Won' : scoreUs < scoreThem ? 'Lost' : 'Draw'

  const starterForwards = teamSheet.starters.forwards.map(id => playerMap.get(id)?.name ?? '?')
  const starterBacks    = teamSheet.starters.backs.map(id => playerMap.get(id)?.name ?? '?')
  const starterSH       = playerMap.get(teamSheet.starters.scrumhalf)?.name ?? ''

  const subsOn = teamSheet.bench
    .filter(id => (matchState.playerStates.get(id)?.minutesPlayed ?? 0) > 0)
    .map(id => playerMap.get(id)?.name ?? '?')

  const tryScorers = events
    .filter((e): e is Extract<MatchEvent, { type: 'TRY_US' }> => e.type === 'TRY_US')
    .flatMap(e => e.payload.scorerId ? [playerMap.get(e.payload.scorerId)?.name ?? '?'] : [])

  const shareText = buildShareText(
    opponent, matchDate, scoreUs, scoreThem,
    teamSheet.label, starterForwards, starterBacks, starterSH, subsOn, tryScorers,
  )

  // Coach rows — players who played or started
  const coachRows = useMemo(() =>
    [...squad]
      .map(p => {
        const ps = matchState.playerStates.get(p.id)
        const mins = Math.round((ps?.minutesPlayed ?? 0) / 60_000)
        return { player: p, mins, tries: ps?.triesScored ?? 0, group: ps?.activeGroup ?? p.defaultGroup, mins_raw: ps?.minutesPlayed ?? 0 }
      })
      .filter(r => r.mins_raw > 0 || matchState.playerStates.get(r.player.id)?.status === 'on')
      .sort((a, b) => b.mins_raw - a.mins_raw || a.player.name.localeCompare(b.player.name)),
    [squad, matchState],
  )

  // Sub log
  const subLog = useMemo(() =>
    events
      .filter((e): e is Extract<MatchEvent, { type: 'SUB_BATCH' }> => e.type === 'SUB_BATCH')
      .map(e => ({
        time: Math.round(e.payload.elapsedMs / 60_000),
        off:  e.payload.offIds.map(id => playerMap.get(id)?.name ?? '?'),
        on:   e.payload.onIds.map(id => playerMap.get(id)?.name ?? '?'),
      })),
    [events, playerMap],
  )

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2200)
    } catch {
      // clipboard unavailable — text is visible in the box for manual copy
    }
  }

  const resultColor = result === 'Won' ? '#059669' : result === 'Lost' ? '#DC2626' : '#D97706'

  return (
    <div className="min-h-screen pb-8" style={{ background: '#F5F3F0', color: INK }}>

      {/* Header */}
      <div className="sticky top-0 z-20" style={{ background: PURPLE }}>
        <div
          className="px-3 py-2 flex items-center gap-2"
          style={{ borderBottom: `1px solid ${PURPLE_DARK}` }}
        >
          <button
            onClick={onBack}
            className="tap-target flex items-center justify-center -ml-1"
          >
            <ChevronLeft size={24} color="white" strokeWidth={2.5} />
          </button>
          <div className="flex-1 leading-tight">
            <div className="text-[13px] font-bold tracking-wide uppercase text-white">Match Summary</div>
            <div className="text-[10px] text-white/70">
              vs {opponent}{matchDate ? ` · ${matchDate}` : ''}
            </div>
          </div>
          <div
            className="px-2.5 py-1 rounded-lg font-bold text-sm flex-shrink-0"
            style={{ background: resultColor, color: 'white' }}
          >
            {scoreUs}–{scoreThem}
          </div>
          <WoodfordMark size={22} color="white" />
        </div>

        {/* Tabs */}
        <div className="flex" style={{ background: INK }}>
          {(['share', 'coach'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 py-2 text-xs font-bold uppercase tracking-widest transition"
              style={{
                color: tab === t ? 'white' : 'rgba(255,255,255,0.35)',
                borderBottom: tab === t ? `2px solid ${PURPLE}` : '2px solid transparent',
              }}
            >
              {t === 'share' ? 'Share' : 'Coach'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Share tab */}
      {tab === 'share' && (
        <div className="px-3 pt-4 space-y-3">
          <div
            className="bg-white rounded-lg p-4 border text-sm whitespace-pre-wrap leading-relaxed"
            style={{ borderColor: '#E7E5E4', color: INK, fontFamily: 'inherit' }}
          >
            {shareText}
          </div>
          <button
            onClick={handleCopy}
            className="tap-target w-full rounded-lg font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition"
            style={{ background: copied ? '#059669' : PURPLE, color: 'white', minHeight: '48px' }}
          >
            {copied ? <Check size={16} strokeWidth={2.5} /> : <Copy size={16} strokeWidth={2} />}
            {copied ? 'Copied!' : 'Copy to clipboard'}
          </button>
        </div>
      )}

      {/* ── Coach tab */}
      {tab === 'coach' && (
        <div className="px-3 pt-4 space-y-4">

          {/* Score summary row */}
          <div className="bg-white rounded-lg px-4 py-3 flex items-center justify-between border" style={{ borderColor: '#E7E5E4' }}>
            <div>
              <div className="text-xs text-stone-400 uppercase tracking-widest font-semibold mb-0.5">Result</div>
              <div className="font-bold text-2xl tabular-nums" style={{ color: resultColor }}>
                {scoreUs}–{scoreThem}
              </div>
            </div>
            <div className="font-bold text-lg" style={{ color: resultColor }}>{result}</div>
          </div>

          {/* Playing time table */}
          <div className="bg-white rounded-lg overflow-hidden border" style={{ borderColor: '#E7E5E4' }}>
            <div className="px-3 py-2 flex items-center justify-between"
              style={{ borderBottom: '1px solid #F5F3F0' }}>
              <span className="text-[11px] font-bold uppercase tracking-widest text-stone-400">Playing time</span>
              <span className="text-[11px] text-stone-400">{coachRows.length} players</span>
            </div>
            {coachRows.map(r => (
              <div
                key={r.player.id}
                className="flex items-center gap-3 px-3 py-2 border-b last:border-0"
                style={{ borderColor: '#F5F3F0' }}
              >
                <GroupBadge group={r.group} />
                <span className="flex-1 text-sm font-semibold" style={{ color: INK }}>{r.player.name}</span>
                {r.tries > 0 && (
                  <span
                    className="text-[11px] px-1.5 py-0.5 rounded font-bold"
                    style={{ background: '#FEF3C7', color: '#92400E' }}
                  >
                    {r.tries}T
                  </span>
                )}
                <span className="mono text-sm font-bold tabular-nums w-10 text-right" style={{ color: INK }}>
                  {r.mins}m
                </span>
              </div>
            ))}
            {coachRows.length === 0 && (
              <div className="px-3 py-4 text-sm text-stone-400 text-center">No playing time recorded</div>
            )}
          </div>

          {/* Substitutions log */}
          {subLog.length > 0 && (
            <div className="bg-white rounded-lg overflow-hidden border" style={{ borderColor: '#E7E5E4' }}>
              <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-stone-400"
                style={{ borderBottom: '1px solid #F5F3F0' }}>
                Substitutions
              </div>
              {subLog.map((s, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 px-3 py-2.5 border-b last:border-0 text-sm"
                  style={{ borderColor: '#F5F3F0' }}
                >
                  <span className="mono text-xs text-stone-400 w-7 flex-shrink-0 font-semibold">
                    {s.time}'
                  </span>
                  <span className="text-rose-500 font-semibold flex-1 min-w-0 truncate">
                    {s.off.join(', ')}
                  </span>
                  <ArrowRight size={12} className="text-stone-300 flex-shrink-0" />
                  <span className="text-emerald-600 font-semibold flex-1 min-w-0 truncate text-right">
                    {s.on.join(', ')}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Tries detail */}
          {tryScorers.length > 0 && (
            <div className="bg-white rounded-lg overflow-hidden border" style={{ borderColor: '#E7E5E4' }}>
              <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-stone-400"
                style={{ borderBottom: '1px solid #F5F3F0' }}>
                Tries scored ({tryScorers.length})
              </div>
              <div className="px-3 py-2.5 text-sm" style={{ color: INK }}>
                {tryScorers.join(', ')}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
