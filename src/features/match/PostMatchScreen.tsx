import { useMemo, useRef, useState } from 'react'
import { GROUP_COLOR } from '@/ui/positions'
import { ArrowRight, Check, Copy, RefreshCw, Share2, Sparkles } from 'lucide-react'
import { TopAppBar } from '@/ui/TopAppBar'
import { Button } from '@/ui/Button'
import { ButtonGroup } from '@/ui/ButtonGroup'
import { Card } from '@/ui/Card'
import { WoodfordMark } from '@/components/WoodfordMark'
import type { Group, MatchEvent, MatchState, Player, TeamSheet } from '@/lib/events/types'
import { useMatchStore } from './useMatchStore'


const GROUP_SHORT: Record<Group, string> = { forward: 'F', back: 'B', scrumhalf: 'SH' }

function GroupBadge({ group }: { group: Group }) {
  const bg = GROUP_COLOR[group]
  return (
    <span
      className="text-xs font-bold w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
      style={{ background: bg, color: 'white' }}
    >
      {GROUP_SHORT[group]}
    </span>
  )
}

// When set, the screen shows a stored match read-only instead of the live match store
export interface MatchViewData {
  squad: Player[]
  teamSheet: TeamSheet
  opponent: string
  matchState: MatchState
  events: MatchEvent[]
}

interface Props { onBack: () => void; data?: MatchViewData }

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

export default function PostMatchScreen({ onBack, data }: Props) {
  const live = useMatchStore()
  const { squad, teamSheet, opponent, matchState, events } = data ?? live
  const publishStatus = data ? null : live.publishStatus
  const [tab, setTab]           = useState<'share' | 'coach'>('share')
  const [copied, setCopied]     = useState(false)
  const [aiSummary, setAiSummary]       = useState<string | null>(null)
  const [aiCopied, setAiCopied]         = useState(false)
  const [generating, setGenerating]     = useState(false)
  const [aiError, setAiError]           = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

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

  // The phone's share sheet goes straight to WhatsApp; clipboard is the
  // fallback where sharing isn't available (most desktop browsers).
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'
  const shareOrCopy = async (text: string, onCopied: () => void) => {
    if (canShare) {
      try { await navigator.share({ text }); return } catch (e) {
        if ((e as Error).name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(text)
      onCopied()
    } catch {
      // clipboard unavailable — text is visible on screen for manual copy
    }
  }

  const handleCopy = () => shareOrCopy(shareText, () => {
    setCopied(true)
    setTimeout(() => setCopied(false), 2200)
  })

  const handleGenerate = async () => {
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    setGenerating(true)
    setAiError(null)
    setAiSummary(null)
    const date = events[0]?.ts.slice(0, 10) ?? new Date().toISOString().slice(0, 10)
    try {
      const res = await fetch('/summarise', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          opponent,
          scoreUs,
          scoreThem,
          tryScorers,
          teamLabel: teamSheet.label,
          date,
          subsCount: subLog.length,
          playersUsed: coachRows.length,
        }),
        signal: abortRef.current.signal,
      })
      const data = await res.json() as { summary?: string; error?: string }
      if (!res.ok || data.error) throw new Error(data.error ?? 'Failed')
      setAiSummary(data.summary ?? '')
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setAiError('Couldn\'t generate — try again.')
    } finally {
      setGenerating(false)
    }
  }

  const handleAiCopy = () => {
    if (!aiSummary) return
    return shareOrCopy(aiSummary, () => {
      setAiCopied(true)
      setTimeout(() => setAiCopied(false), 2200)
    })
  }

  const resultTone = result === 'Won' ? 'bg-x-win' : result === 'Lost' ? 'bg-x-loss' : 'bg-x-draw'

  return (
    <div className="min-h-screen pb-12 bg-m-surface text-m-on-surface">
      <TopAppBar
        title={`vs ${opponent}`}
        subtitle={matchDate || undefined}
        onBack={onBack}
        leading={<WoodfordMark size={32} />}
        actions={
          <span className={`h-10 px-4 rounded-full inline-flex items-center text-lg emphasized text-white mono ${resultTone}`}>
            {scoreUs}–{scoreThem}
          </span>
        }
      >
        <ButtonGroup
          onBrand
          full
          ariaLabel="Summary view"
          value={tab}
          onChange={setTab}
          options={[{ value: 'share', label: 'Share' }, { value: 'coach', label: 'Coach only' }]}
        />
      </TopAppBar>

      {publishStatus === 'failed' && (
        <div className="mx-4 mt-4 p-4 rounded-m-lg text-sm flex items-center gap-3 bg-m-error-container text-m-on-error-container">
          <span className="flex-1">Not shared with the other coaches yet — saved on this phone.</span>
          <Button size="sm" variant="outlined" onClick={() => void live.publishNow()} icon={<RefreshCw size={16} strokeWidth={2.25} />}>Try again</Button>
        </div>
      )}
      {publishStatus === 'publishing' && (
        <div className="mx-4 mt-4 px-4 py-3 rounded-m-lg text-sm flex items-center gap-2 bg-m-surface-container text-m-on-surface-variant">
          <RefreshCw size={16} className="animate-spin" /> Sharing with the coaches…
        </div>
      )}

      {tab === 'share' && (
        <div className="px-4 pt-4 space-y-3">
          <Card className="p-4 text-base whitespace-pre-wrap leading-relaxed">{shareText}</Card>
          <Button
            size="lg"
            full
            onClick={handleCopy}
            variant={copied ? 'go' : 'filled'}
            icon={copied ? <Check size={20} strokeWidth={2.5} /> : canShare ? <Share2 size={20} strokeWidth={2.25} /> : <Copy size={20} strokeWidth={2.25} />}
          >
            {copied ? 'Copied!' : canShare ? 'Share with parents' : 'Copy to clipboard'}
          </Button>

          <Card className="overflow-hidden">
            <div className="p-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-lg font-semibold">Fun match report</div>
                <div className="text-sm text-m-on-surface-variant">Written for you, ready to share</div>
              </div>
              <Button
                variant="tonal"
                size="sm"
                onClick={handleGenerate}
                disabled={generating}
                icon={<Sparkles size={16} strokeWidth={2.25} />}
              >
                {generating ? 'Writing…' : aiSummary ? 'Again' : 'Write it'}
              </Button>
            </div>
            {aiError && <div className="px-4 pb-4 text-sm text-m-error">{aiError}</div>}
            {aiSummary && (
              <div className="px-4 pb-4 space-y-3 pop-in">
                <div className="text-base leading-relaxed">{aiSummary}</div>
                <Button
                  size="sm"
                  variant={aiCopied ? 'go' : 'outlined'}
                  onClick={handleAiCopy}
                  icon={aiCopied ? <Check size={16} strokeWidth={2.5} /> : canShare ? <Share2 size={16} strokeWidth={2.25} /> : <Copy size={16} strokeWidth={2.25} />}
                >
                  {aiCopied ? 'Copied!' : canShare ? 'Share' : 'Copy'}
                </Button>
              </div>
            )}
          </Card>
        </div>
      )}

      {tab === 'coach' && (
        <div className="px-4 pt-4 space-y-3">
          <Card className="p-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-m-on-surface-variant">Result</div>
              <div className="text-3xl emphasized mono">{scoreUs}–{scoreThem}</div>
            </div>
            <span className={`h-10 px-4 rounded-full inline-flex items-center text-base font-semibold text-white ${resultTone}`}>{result}</span>
          </Card>

          <Card className="overflow-hidden">
            <div className="px-4 pt-4 pb-2 flex items-center justify-between">
              <span className="text-lg font-semibold">Playing time</span>
              <span className="text-sm text-m-on-surface-variant">{coachRows.length} players</span>
            </div>
            <div className="divide-y divide-m-outline-variant">
              {coachRows.map(r => (
                <div key={r.player.id} className="flex items-center gap-3 px-4 min-h-[3.25rem]">
                  <GroupBadge group={r.group} />
                  <span className="flex-1 text-base font-medium">{r.player.name}</span>
                  {r.tries > 0 && (
                    <span className="h-7 px-2.5 rounded-full inline-flex items-center text-xs font-bold bg-m-tertiary-container text-m-on-tertiary-container">
                      {r.tries} {r.tries === 1 ? 'try' : 'tries'}
                    </span>
                  )}
                  <span className="mono text-base font-bold w-12 text-right">{r.mins}′</span>
                </div>
              ))}
              {coachRows.length === 0 && (
                <div className="px-4 py-4 text-sm text-m-on-surface-variant text-center">No playing time recorded</div>
              )}
            </div>
          </Card>

          {subLog.length > 0 && (
            <Card className="overflow-hidden">
              <div className="px-4 pt-4 pb-2 text-lg font-semibold">Substitutions</div>
              <div className="divide-y divide-m-outline-variant">
                {subLog.map((sl, i) => (
                  <div key={i} className="flex items-center gap-2 px-4 min-h-[3rem] text-base">
                    <span className="mono text-sm text-m-on-surface-variant w-9 flex-shrink-0 font-semibold">{sl.time}′</span>
                    <span className="text-m-error font-medium flex-1 min-w-0 truncate">{sl.off.join(', ')}</span>
                    <ArrowRight size={16} className="text-m-outline flex-shrink-0" />
                    <span className="text-x-good font-medium flex-1 min-w-0 truncate text-right">{sl.on.join(', ')}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {tryScorers.length > 0 && (
            <Card className="p-4">
              <div className="text-lg font-semibold mb-1">Tries ({tryScorers.length})</div>
              <div className="text-base">{tryScorers.join(', ')}</div>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
