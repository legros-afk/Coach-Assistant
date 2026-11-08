import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, ChevronDown, Mail, MessageSquare } from 'lucide-react'
import type { Fixture, Player } from '@/lib/events/types'
import { INJURY_TYPES, type InjuryReport } from '@/lib/safeguarding/types'
import { concussionSms, injuryMailto } from '@/lib/safeguarding/injuryEmail'
import { protocolFromReport } from '@/lib/safeguarding/protocol'
import { shareSafeguardingRecord } from '@/lib/safeguarding/safeguardingSync'
import { Sheet } from '@/ui/Sheet'
import { Button } from '@/ui/Button'
import { ButtonGroup } from '@/ui/ButtonGroup'
import { TextArea, TextField } from '@/ui/TextField'
import { CheckChip, CheckRow, SwitchRow } from '@/ui/Toggle'
import { useFixtureStore } from '@/features/fixture/useFixtureStore'
import {
  FIXTURE_OTHER, atFixture, chooseFixture, chooseLocation, emptyInjuryForm, fixtureLabel, fixtureOptions,
  formMissing, formToReport, type InjuryForm, type LocationChoice,
} from './injuryForm'
import { RedFlagButton } from './RedFlags'
import { getReporterName, newSafeguardingId, setReporterName, useInjuryStore } from './useInjuryStore'

const LOCATIONS: LocationChoice[] = ['Training', 'Match', 'Festival', 'Other']
const TYPE_LABEL: Record<string, string> = {
  sprain: 'Sprain', strain: 'Strain', cut: 'Cut', bruise: 'Bruise', bleeding: 'Bleeding', other: 'Other',
}

interface Props {
  player: Player
  onClose: () => void
}

// Filed pitch-side, often in a hurry: the short form comes first and the
// rest of the club's paper form is one tap away under "More details".
// Anyone can file one — no PIN needed — and it is saved on this phone first.
export default function InjuryReportSheet({ player, onClose }: Props) {
  const saveReport = useInjuryStore(s => s.saveReport)
  const saveProtocol = useInjuryStore(s => s.saveProtocol)
  const [saved, setSaved] = useState<InjuryReport | null>(null)
  const [form, setForm] = useState<InjuryForm>(() => emptyInjuryForm(player, getReporterName()))
  const [more, setMore] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Read-only use of the fixtures, for "which match was it?"
  const fixtures = useFixtureStore(s => s.fixtures)
  const fixturesReady = useFixtureStore(s => s.isHydrated)
  const hydrateFixtures = useFixtureStore(s => s.hydrate)
  useEffect(() => { if (!fixturesReady) void hydrateFixtures() }, [fixturesReady, hydrateFixtures])

  const set = <K extends keyof InjuryForm>(k: K, v: InjuryForm[K]) => setForm(f => ({ ...f, [k]: v }))
  const toggleType = (t: string) =>
    set('injuryType', form.injuryType.includes(t) ? form.injuryType.filter(x => x !== t) : [...form.injuryType, t])

  const missing = formMissing(form)

  const handleSave = async () => {
    if (missing) { setError(missing); return }
    setSaving(true)
    setError(null)
    try {
      const report = formToReport(form, newSafeguardingId('inj'), player.id, new Date().toISOString())
      setReporterName(form.reportedBy)
      await saveReport(report)
      // A suspected concussion starts the return-to-play steps straight away
      const protocol = report.headInjuryOrConcussion ? protocolFromReport(report, newSafeguardingId('con')) : null
      if (protocol) await saveProtocol(protocol)
      // Shared with the safeguarding officer in the background (or next sync)
      void shareSafeguardingRecord('injuries', report.id)
        .then(() => protocol && shareSafeguardingRecord('concussions', protocol.id))
      setSaved(report)
      // Opens the coach's email app with everything filled in; they press send
      window.location.href = injuryMailto(report)
    } catch {
      setError('Could not save the report on this phone. Try again.')
    } finally {
      setSaving(false)
    }
  }

  if (saved) return <SavedView report={saved} onClose={onClose} />

  return (
    <Sheet onClose={onClose} title={`Injury: ${player.name}`} maxHeight="92vh">
      <div className="space-y-5 pb-2">
        <div className="flex items-center gap-3 -mt-1">
          <div className="flex-1 text-sm text-m-on-surface-variant leading-snug">Serious? Check the red flags.</div>
          <RedFlagButton />
        </div>
        <div className="flex gap-2">
          <div className="flex-1"><TextField label="Date" type="date" value={form.date} onChange={e => set('date', e.target.value)} /></div>
          <div className="w-32"><TextField label="Time" type="time" value={form.time} onChange={e => set('time', e.target.value)} /></div>
        </div>

        <div>
          <div className="text-sm font-medium text-m-on-surface-variant mb-1.5">Where</div>
          <ButtonGroup
            full
            size="sm"
            ariaLabel="Where it happened"
            value={form.locationChoice}
            onChange={v => setForm(f => chooseLocation(f, v, fixtures))}
            options={LOCATIONS.map(l => ({ value: l, label: l }))}
          />
          {form.locationChoice === 'Other' && (
            <div className="mt-2">
              <TextField label="Where was it?" value={form.locationOther} onChange={e => set('locationOther', e.target.value)} placeholder="e.g. tour, school match" />
            </div>
          )}
          {atFixture(form.locationChoice) && (
            <FixturePicker form={form} fixtures={fixtures} onChange={setForm} />
          )}
        </div>

        <TextArea label="How did it happen?" rows={3} value={form.incidentDescription}
          onChange={e => set('incidentDescription', e.target.value)} placeholder="e.g. tackled awkwardly, landed on his wrist" />
        <TextArea label="Treatment given" rows={2} value={form.treatmentGiven}
          onChange={e => set('treatmentGiven', e.target.value)} placeholder="e.g. ice pack, plaster from the first-aid kit" />
        <TextArea label="Follow-up needed (if any)" rows={2} value={form.followUp}
          onChange={e => set('followUp', e.target.value)} placeholder="Optional" />
        <CheckRow label="Parents or guardians told" checked={form.parentsInformed} onChange={v => set('parentsInformed', v)} />

        {/* The rest of the club's injury form */}
        <button
          type="button"
          onClick={() => setMore(m => !m)}
          aria-expanded={more}
          className="m-press w-full h-12 px-4 rounded-m-md bg-m-surface-container-high flex items-center justify-between text-base font-semibold"
        >
          More details
          <ChevronDown size={20} strokeWidth={2.25} className={`transition-transform duration-300 ${more ? 'rotate-180' : ''}`} />
        </button>

        {more && (
          <div className="space-y-5 pop-in">
            <SwitchRow
              label="Head injury or possible concussion"
              hint="Starts the return-to-play steps. They can’t play again today."
              checked={form.headInjuryOrConcussion}
              onChange={v => set('headInjuryOrConcussion', v)}
            />
            <SwitchRow
              label="Hospital or ambulance"
              hint="They went to hospital or an ambulance was called."
              checked={form.hospitalOrAmbulance}
              onChange={v => set('hospitalOrAmbulance', v)}
            />
            <div>
              <div className="text-sm font-medium text-m-on-surface-variant mb-1.5">Type of injury</div>
              <div className="flex gap-2 flex-wrap">
                {INJURY_TYPES.map(t => (
                  <CheckChip key={t} label={TYPE_LABEL[t]} checked={form.injuryType.includes(t)} onChange={() => toggleType(t)} />
                ))}
              </div>
            </div>
            <TextField label="Part of the body (optional)" value={form.bodyPart} onChange={e => set('bodyPart', e.target.value)} placeholder="e.g. left knee" />
            <div className="flex gap-2">
              <div className="flex-1"><TextField label="Player" value={form.playerName} onChange={e => set('playerName', e.target.value)} /></div>
              <div className="w-24"><TextField label="Age group" value={form.playerAgeGroup} onChange={e => set('playerAgeGroup', e.target.value)} /></div>
            </div>
            <TextField label="Parent or guardian" value={form.parentGuardian} onChange={e => set('parentGuardian', e.target.value)} placeholder="Name" />
            <TextField label="Their phone number" type="tel" inputMode="tel" value={form.parentContact} onChange={e => set('parentContact', e.target.value)} />
            <TextField label="Staff there" value={form.staffPresent} onChange={e => set('staffPresent', e.target.value)} placeholder="Coaches and helpers present" />
            <TextField label="Your name" value={form.reportedBy} onChange={e => set('reportedBy', e.target.value)} placeholder="Who is filing this" />
          </div>
        )}

        {error && <div className="text-sm font-medium text-m-error" role="alert">{error}</div>}

        <div className="sticky bottom-0 -mx-4 px-4 pt-3 pb-4 bg-m-surface-container-low">
          <Button size="lg" full onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save and email'}
          </Button>
        </div>
      </div>
    </Sheet>
  )
}

/** Which match or festival: from the fixtures list, or typed in when it isn't there. */
function FixturePicker({ form, fixtures, onChange }: {
  form: InjuryForm
  fixtures: Fixture[]
  onChange: (f: InjuryForm) => void
}) {
  const what = form.locationChoice === 'Match' ? 'match' : 'festival'
  const options = fixtureOptions(fixtures, form.date)
  // The picked fixture stays listed even if it is now further away than the rest
  const picked = fixtures.find(f => f.id === form.fixtureChoice)
  if (picked && !options.includes(picked)) options.unshift(picked)
  return (
    <div className="mt-2 space-y-2">
      {options.length > 0 && (
        <label className="block">
          <span className="text-sm font-medium text-m-on-surface-variant">Which {what}?</span>
          <select
            value={form.fixtureChoice}
            onChange={e => onChange(chooseFixture(form, e.target.value, fixtures))}
            className="mt-1 w-full h-14 px-3 rounded-m-xs border border-m-outline bg-transparent text-base"
          >
            <option value="" disabled>Choose…</option>
            {options.map(f => <option key={f.id} value={f.id}>{fixtureLabel(f)}</option>)}
            <option value={FIXTURE_OTHER}>Not in the list</option>
          </select>
        </label>
      )}
      {form.fixtureChoice === FIXTURE_OTHER && (
        <TextField
          label={`Which ${what} was it?`}
          value={form.fixtureOther}
          onChange={e => onChange({ ...form, fixtureOther: e.target.value })}
          placeholder={what === 'match' ? 'e.g. 14 Sep vs Chingford (away)' : 'e.g. Harlow festival'}
        />
      )}
    </div>
  )
}

/** After saving: the email to send, and — for a head injury — the concussion alert. */
function SavedView({ report, onClose }: { report: InjuryReport; onClose: () => void }) {
  return (
    <Sheet onClose={onClose} title="Report saved" maxHeight="92vh">
      <div className="space-y-4 pb-4">
        <div className="flex justify-end -mt-1"><RedFlagButton /></div>
        {report.headInjuryOrConcussion && (
          <div role="alertdialog" aria-labelledby="concussion-alert" className="p-4 rounded-m-lg bg-m-error-container text-m-on-error-container">
            <div className="flex items-start gap-3">
              <AlertTriangle size={24} strokeWidth={2.25} className="flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div id="concussion-alert" className="text-lg font-bold leading-snug">
                  Suspected concussion. Player cannot return to play today.
                </div>
                <div className="text-sm mt-1">Text Bekah Owen now? The return-to-play steps have been started.</div>
              </div>
            </div>
            <a
              href={concussionSms(report)}
              className="m-press mt-3 h-14 w-full rounded-full bg-m-error text-m-on-error font-semibold text-base inline-flex items-center justify-center gap-2"
            >
              <MessageSquare size={20} strokeWidth={2.25} />
              Text Bekah now
            </a>
          </div>
        )}

        <div className="flex items-start gap-3">
          <CheckCircle2 size={24} className="text-x-good flex-shrink-0" strokeWidth={2.25} />
          <div className="text-base">
            Saved on this phone. Your email app should open with the report filled in — check it and press send.
          </div>
        </div>
        <a
          href={injuryMailto(report)}
          className="m-press h-14 w-full rounded-full bg-m-primary text-m-on-primary font-semibold text-base inline-flex items-center justify-center gap-2"
        >
          <Mail size={20} strokeWidth={2.25} />
          Open the email again
        </a>
        <Button size="lg" variant="text" full onClick={onClose}>Done</Button>
      </div>
    </Sheet>
  )
}
