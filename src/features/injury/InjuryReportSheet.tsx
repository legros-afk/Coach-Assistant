import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { Player } from '@/lib/events/types'
import { INJURY_TYPES } from '@/lib/safeguarding/types'
import { Sheet } from '@/ui/Sheet'
import { Button } from '@/ui/Button'
import { ButtonGroup } from '@/ui/ButtonGroup'
import { TextArea, TextField } from '@/ui/TextField'
import { CheckChip, CheckRow, SwitchRow } from '@/ui/Toggle'
import { emptyInjuryForm, formMissing, formToReport, type InjuryForm, type LocationChoice } from './injuryForm'
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
  const [form, setForm] = useState<InjuryForm>(() => emptyInjuryForm(player, getReporterName()))
  const [more, setMore] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      onClose()
    } catch {
      setError('Could not save the report on this phone. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet onClose={onClose} title={`Injury: ${player.name}`} maxHeight="92vh">
      <div className="space-y-5 pb-2">
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
            onChange={v => set('locationChoice', v)}
            options={LOCATIONS.map(l => ({ value: l, label: l }))}
          />
          {form.locationChoice === 'Other' && (
            <div className="mt-2">
              <TextField label="Where was it?" value={form.locationOther} onChange={e => set('locationOther', e.target.value)} placeholder="e.g. tour, school match" />
            </div>
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
            {saving ? 'Saving…' : 'Save report'}
          </Button>
        </div>
      </div>
    </Sheet>
  )
}
