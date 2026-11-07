import { useMemo, useState } from 'react'
import { Loader, Minus, Plus } from 'lucide-react'
import { Sheet } from '@/ui/Sheet'
import { Button } from '@/ui/Button'
import { ButtonGroup } from '@/ui/ButtonGroup'
import type { Fixture, ID, Match, Player, TeamSheet } from '@/lib/events/types'
import { manualResultEvents, nextGame } from '@/lib/domain/games'
import { recordManualResult } from '@/features/match/useMatchStore'

interface Props {
  fixture: Fixture
  players: Player[]
  gamesOf: (ts: TeamSheet) => Match[]
  onClose: () => void
  onSaved: () => void
}

function Stepper({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-3 h-12">
      <span className={`flex-1 min-w-0 truncate text-base ${value > 0 ? 'font-semibold' : ''}`}>{label}</span>
      <button
        onClick={() => onChange(Math.max(0, value - 1))}
        disabled={value === 0}
        aria-label={`One fewer for ${label}`}
        className="m-press w-10 h-10 rounded-full flex items-center justify-center bg-m-surface-container-high disabled:opacity-30"
      >
        <Minus size={18} strokeWidth={2.5} />
      </button>
      <span className="w-6 text-center text-lg font-semibold mono">{value}</span>
      <button
        onClick={() => onChange(value + 1)}
        aria-label={`One more for ${label}`}
        className="m-press w-10 h-10 rounded-full flex items-center justify-center bg-m-secondary-container text-m-on-secondary-container"
      >
        <Plus size={18} strokeWidth={2.5} />
      </button>
    </div>
  )
}

// For a game that wasn't run in the app: the score and who scored, saved as
// the team's next game. It counts for results and tries, not for minutes.
export default function AddResultSheet({ fixture, players, gamesOf, onClose, onSaved }: Props) {
  const sheets = fixture.teamSheets
  const [sheetId, setSheetId] = useState<ID>(sheets[0].id)
  const sheet = sheets.find(ts => ts.id === sheetId) ?? sheets[0]
  const [tries, setTries] = useState<Map<ID, number>>(new Map())
  const [unknownTries, setUnknownTries] = useState(0)
  const [theirTries, setTheirTries] = useState(0)
  const [saving, setSaving] = useState(false)
  // Once saved, a retry must share the same game rather than add another
  const [savedGame, setSavedGame] = useState<number | null>(null)
  const [shareFailed, setShareFailed] = useState(false)

  const game = savedGame ?? nextGame(gamesOf(sheet))
  const byId = useMemo(() => new Map(players.map(p => [p.id, p])), [players])
  // Starters first, then the bench: whoever was in the team that day
  const squadIds = [
    ...sheet.starters.forwards, ...sheet.starters.backs,
    ...(sheet.starters.scrumhalf ? [sheet.starters.scrumhalf] : []),
    ...sheet.bench,
  ].filter(id => byId.has(id))
  const ours = [...tries.values()].reduce((a, b) => a + b, 0) + unknownTries

  const pickTeam = (id: ID) => {
    if (savedGame !== null) return
    setSheetId(id)
    setTries(new Map())
    setUnknownTries(0)
  }

  const save = async () => {
    setSaving(true)
    const scorers: (ID | undefined)[] = []
    for (const id of squadIds) for (let i = 0; i < (tries.get(id) ?? 0); i++) scorers.push(id)
    for (let i = 0; i < unknownTries; i++) scorers.push(undefined)
    // Played today: now. Filled in later: the match day itself.
    const today = new Date().toISOString().slice(0, 10)
    const at = fixture.date === today ? new Date().toISOString() : `${fixture.date}T12:00:00.000Z`
    const status = await recordManualResult({
      fixtureId: fixture.id,
      teamSheetId: sheet.id,
      opponent: fixture.opponent,
      game,
      events: manualResultEvents(scorers, theirTries, at),
    })
    setSaving(false)
    setSavedGame(game)
    onSaved()
    if (status === 'ok') onClose()
    else setShareFailed(true)
  }

  const team = sheets.length > 1 ? `Team ${sheet.label} · ` : ''

  return (
    <Sheet onClose={onClose} title="Add a result">
      <p className="text-sm -mt-2 mb-4 text-m-on-surface-variant">
        For a game you didn’t run in the app. It counts for results and tries, not minutes.
      </p>

      <div className="space-y-4 pb-4">
        {sheets.length > 1 && (
          <ButtonGroup
            full
            ariaLabel="Which team"
            value={sheet.id}
            onChange={pickTeam}
            options={sheets.map(ts => ({ value: ts.id, label: `Team ${ts.label}` }))}
          />
        )}

        <div className="text-base font-semibold">
          {team}Game {game} vs {fixture.opponent}
        </div>

        <div>
          <div className="text-sm font-medium text-m-on-surface-variant mb-1">Our tries</div>
          {squadIds.map(id => (
            <Stepper
              key={id}
              label={byId.get(id)!.name}
              value={tries.get(id) ?? 0}
              onChange={n => setTries(m => new Map(m).set(id, n))}
            />
          ))}
          <Stepper label="Not sure who" value={unknownTries} onChange={setUnknownTries} />
        </div>

        <div>
          <div className="text-sm font-medium text-m-on-surface-variant mb-1">Their tries</div>
          <Stepper label={fixture.opponent} value={theirTries} onChange={setTheirTries} />
        </div>

        {shareFailed && (
          <p className="text-sm text-m-error">
            Saved on this phone, but it couldn’t be shared with the other coaches. Try again when you have signal.
          </p>
        )}

        <Button
          size="lg"
          full
          onClick={save}
          disabled={saving}
          icon={saving ? <Loader size={18} className="animate-spin" /> : undefined}
        >
          {saving ? 'Saving…' : shareFailed ? 'Try sharing again' : `Save ${ours}–${theirTries}`}
        </Button>
      </div>
    </Sheet>
  )
}
