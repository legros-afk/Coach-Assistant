import { useEffect, useMemo, useState } from 'react'
import { Activity, ClipboardList, ClipboardPlus, Mail, Settings, Siren } from 'lucide-react'
import type { Player } from '@/lib/events/types'
import type { ConcussionProtocol, InjuryReport, StageNumber } from '@/lib/safeguarding/types'
import { INJURY_TYPES } from '@/lib/safeguarding/types'
import { completeStage, dropBackStage, isActive } from '@/lib/safeguarding/gras'
import { injuryMailto, ukDate } from '@/lib/safeguarding/injuryEmail'
import { useSquadStore } from '@/features/squad/useSquadStore'
import { TopAppBar, BarButton } from '@/ui/TopAppBar'
import { NavBar } from '@/ui/NavBar'
import { Card, SectionTitle } from '@/ui/Card'
import { Fab } from '@/ui/Fab'
import { Sheet } from '@/ui/Sheet'
import { CheckChip } from '@/ui/Toggle'
import { TextField } from '@/ui/TextField'
import InjuryReportSheet from './InjuryReportSheet'
import { ConcussionSummary, ConcussionTimeline } from './ConcussionStatus'
import { RedFlagButton, RedFlagList } from './RedFlags'
import { useInjuryStore } from './useInjuryStore'
import { shareSafeguardingRecord } from '@/lib/safeguarding/safeguardingSync'

type Tab = 'log' | 'concussions' | 'redflags'

interface Props {
  onOpenSettings: () => void
  /** Called after the officer changes a protocol, so it can be shared. */
  onProtocolChanged?: (p: ConcussionProtocol) => void
}

// The safeguarding officer's app: player welfare only. No squad editing,
// fixtures or match screens — just the injury log, the concussion tracker
// and the red flags.
export default function SafeguardingWorkspace({ onOpenSettings, onProtocolChanged }: Props) {
  const [tab, setTab] = useState<Tab>('concussions')
  const title = tab === 'log' ? 'Injury log' : tab === 'concussions' ? 'Concussions' : 'Red flags'

  return (
    <div className="min-h-screen bg-m-surface text-m-on-surface pb-28">
      <TopAppBar
        title={title}
        subtitle="Safeguarding · Woodford U12"
        actions={<>
          {tab !== 'redflags' && <RedFlagButton />}
          <BarButton icon={<Settings size={16} strokeWidth={2.5} />} label="Settings" onClick={onOpenSettings} />
        </>}
      />
      <div className="px-4 pt-3 max-w-md mx-auto">
        {tab === 'log' && <InjuryLog />}
        {tab === 'concussions' && <ConcussionTracker onProtocolChanged={onProtocolChanged} />}
        {tab === 'redflags' && <Card className="p-4"><RedFlagList /></Card>}
      </div>
      <NavBar<Tab>
        items={[
          { key: 'concussions', label: 'Concussions', icon: <Activity size={22} strokeWidth={2} /> },
          { key: 'log',         label: 'Injury log',  icon: <ClipboardList size={22} strokeWidth={2} /> },
          { key: 'redflags',    label: 'Red flags',   icon: <Siren size={22} strokeWidth={2} /> },
        ]}
        active={tab}
        onSelect={setTab}
      />
    </div>
  )
}

// ── Injury log ────────────────────────────────────────────────────────────────

const TYPE_FILTERS: Array<{ key: string; label: string }> = [
  { key: 'head', label: 'Head / concussion' },
  { key: 'hospital', label: 'Hospital' },
  ...INJURY_TYPES.map(t => ({ key: t, label: t[0].toUpperCase() + t.slice(1) })),
]

function matchesType(r: InjuryReport, key: string): boolean {
  if (key === 'head') return r.headInjuryOrConcussion
  if (key === 'hospital') return r.hospitalOrAmbulance
  return r.injuryType.includes(key)
}

export function filterReports(
  reports: InjuryReport[],
  f: { player: string; from: string; to: string; types: string[] },
): InjuryReport[] {
  return reports.filter(r =>
    (!f.player || r.playerName === f.player) &&
    (!f.from || r.date >= f.from) &&
    (!f.to || r.date <= f.to) &&
    (f.types.length === 0 || f.types.some(t => matchesType(r, t))),
  )
}

function InjuryLog() {
  const reports = useInjuryStore(s => s.reports)
  const [player, setPlayer] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [types, setTypes] = useState<string[]>([])
  const [open, setOpen] = useState<InjuryReport | null>(null)
  const [picking, setPicking] = useState(false)
  const [reporting, setReporting] = useState<Player | null>(null)

  const players = useMemo(() => [...new Set(reports.map(r => r.playerName))].sort(), [reports])
  const shown = useMemo(() => filterReports(reports, { player, from, to, types }), [reports, player, from, to, types])
  const filtering = !!(player || from || to || types.length)

  return (
    <div>
      <Card className="p-4 space-y-3">
        <label className="block">
          <span className="text-sm font-medium text-m-on-surface-variant">Player</span>
          <select
            value={player}
            onChange={e => setPlayer(e.target.value)}
            className="mt-1 w-full h-14 px-3 rounded-m-xs border border-m-outline bg-transparent text-base"
          >
            <option value="">Everyone</option>
            {players.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <div className="flex gap-2">
          <div className="flex-1"><TextField label="From" type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div className="flex-1"><TextField label="To" type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {TYPE_FILTERS.map(t => (
            <CheckChip
              key={t.key}
              label={t.label}
              checked={types.includes(t.key)}
              onChange={() => setTypes(ts => ts.includes(t.key) ? ts.filter(x => x !== t.key) : [...ts, t.key])}
            />
          ))}
        </div>
        {filtering && (
          <button className="text-sm font-semibold text-m-primary" onClick={() => { setPlayer(''); setFrom(''); setTo(''); setTypes([]) }}>
            Clear filters
          </button>
        )}
      </Card>

      <SectionTitle>{shown.length === reports.length ? `${reports.length} reports` : `${shown.length} of ${reports.length} reports`}</SectionTitle>
      {reports.length === 0 && (
        <p className="text-base text-m-on-surface-variant px-1">No injury reports yet. Reports from any coach appear here.</p>
      )}
      <div className="space-y-2">
        {shown.map(r => (
          <button key={r.id} onClick={() => setOpen(r)} className="m-press w-full text-left">
            <Card className="p-4">
              <div className="flex items-center gap-2">
                <div className="flex-1 text-base font-semibold truncate">{r.playerName}</div>
                {r.headInjuryOrConcussion && <span className="text-xs font-bold px-2 py-1 rounded-full bg-m-error text-m-on-error">Head</span>}
                {r.hospitalOrAmbulance && <span className="text-xs font-bold px-2 py-1 rounded-full bg-m-tertiary-container text-m-on-tertiary-container">Hospital</span>}
              </div>
              <div className="text-sm text-m-on-surface-variant">{ukDate(r.date)} · {r.time} · {r.location}</div>
              <div className="text-sm mt-1 line-clamp-2">{r.incidentDescription}</div>
            </Card>
          </button>
        ))}
      </div>

      <Fab icon={<ClipboardPlus size={22} strokeWidth={2.5} />} label="Report" onClick={() => setPicking(true)} />

      {open && <ReportDetail report={open} onClose={() => setOpen(null)} />}
      {picking && <PlayerPicker onPick={p => { setPicking(false); setReporting(p) }} onClose={() => setPicking(false)} />}
      {reporting && <InjuryReportSheet player={reporting} onClose={() => setReporting(null)} />}
    </div>
  )
}

/** Choose who the new report is for — read-only use of the squad. */
function PlayerPicker({ onPick, onClose }: { onPick: (p: Player) => void; onClose: () => void }) {
  const { squad, isHydrated, hydrate } = useSquadStore()
  useEffect(() => { if (!isHydrated) void hydrate() }, [isHydrated, hydrate])
  const [other, setOther] = useState('')
  const players = [...(squad?.players ?? [])].sort((a, b) => a.name.localeCompare(b.name))
  return (
    <Sheet onClose={onClose} title="Who was hurt?" maxHeight="85vh">
      <div className="space-y-1 pb-3">
        {players.map(p => (
          <button key={p.id} onClick={() => onPick(p)} className="m-press w-full h-14 px-3 rounded-m-md text-left text-base font-medium active:bg-m-surface-container-high">
            {p.name}
          </button>
        ))}
        <div className="flex gap-2 pt-2">
          <div className="flex-1"><TextField label="Someone else" value={other} onChange={e => setOther(e.target.value)} placeholder="Player’s name" /></div>
        </div>
        {other.trim() && (
          <button
            className="m-press w-full h-12 rounded-full bg-m-primary text-m-on-primary font-semibold"
            onClick={() => onPick({ id: `other-${other.trim().toLowerCase().replace(/\s+/g, '-')}`, name: other.trim() } as Player)}
          >
            Report for {other.trim()}
          </button>
        )}
      </div>
    </Sheet>
  )
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className="py-2 border-b border-m-outline-variant last:border-0">
      <div className="text-xs font-medium text-m-on-surface-variant">{label}</div>
      <div className="text-base whitespace-pre-wrap">{value || '—'}</div>
    </div>
  )
}

function ReportDetail({ report: r, onClose }: { report: InjuryReport; onClose: () => void }) {
  const yn = (b: boolean) => (b ? 'Yes' : 'No')
  return (
    <Sheet onClose={onClose} title={r.playerName} maxHeight="92vh">
      <div className="pb-4">
        <div className="flex justify-end -mt-1 mb-2"><RedFlagButton /></div>
        <Row label="Date and time" value={`${ukDate(r.date)} at ${r.time}`} />
        <Row label="Where" value={r.location} />
        <Row label="How it happened" value={r.incidentDescription} />
        <Row label="Treatment given" value={r.treatmentGiven} />
        <Row label="Follow-up" value={r.followUp} />
        <Row label="Parents told" value={yn(r.parentsInformed)} />
        <Row label="Head injury / concussion" value={yn(r.headInjuryOrConcussion)} />
        <Row label="Hospital / ambulance" value={yn(r.hospitalOrAmbulance)} />
        <Row label="Type of injury" value={r.injuryType.join(', ')} />
        <Row label="Part of the body" value={r.bodyPart} />
        <Row label="Age group" value={r.playerAgeGroup} />
        <Row label="Parent or guardian" value={r.parentGuardian} />
        <Row label="Their phone number" value={r.parentContact} />
        <Row label="Staff there" value={r.staffPresent} />
        <Row label="Reported by" value={r.reportedBy} />
        <a
          href={injuryMailto(r)}
          className="m-press mt-4 h-14 w-full rounded-full bg-m-secondary-container text-m-on-secondary-container font-semibold text-base inline-flex items-center justify-center gap-2"
        >
          <Mail size={20} strokeWidth={2.25} />
          Email this report
        </a>
      </div>
    </Sheet>
  )
}

// ── Concussion tracker ───────────────────────────────────────────────────────

function ConcussionTracker({ onProtocolChanged }: { onProtocolChanged?: (p: ConcussionProtocol) => void }) {
  const protocols = useInjuryStore(s => s.protocols)
  const saveProtocol = useInjuryStore(s => s.saveProtocol)
  const active = protocols.filter(isActive)
  const done = protocols.filter(p => !isActive(p))
  const [showDone, setShowDone] = useState(false)

  const save = async (p: ConcussionProtocol) => {
    await saveProtocol(p)
    void shareSafeguardingRecord('concussions', p.id)
    onProtocolChanged?.(p)
  }
  const complete = (p: ConcussionProtocol, stage: StageNumber) =>
    void save(completeStage(p, stage, new Date().toISOString()))
  const dropBack = (p: ConcussionProtocol) => {
    if (window.confirm(`Symptoms back for ${p.playerName}? This reopens the last stage they finished.`)) {
      void save(dropBackStage(p))
    }
  }

  return (
    <div>
      {active.length === 0 && (
        <Card className="p-4 text-base text-m-on-surface-variant">
          No one is on the return-to-play steps. A head injury report starts them automatically.
        </Card>
      )}
      <div className="space-y-3">
        {active.map(p => (
          <Card key={p.id} className="p-4 space-y-3">
            <div>
              <div className="text-xl font-semibold">{p.playerName}</div>
              <div className="text-sm text-m-on-surface-variant">Injured {ukDate(p.concussionDate)}</div>
            </div>
            <ConcussionSummary protocol={p} />
            <ConcussionTimeline protocol={p} onComplete={s => complete(p, s)} onDropBack={() => dropBack(p)} />
          </Card>
        ))}
      </div>

      {done.length > 0 && (
        <>
          <SectionTitle>
            <button onClick={() => setShowDone(v => !v)} aria-expanded={showDone}>
              Finished ({done.length}) {showDone ? '▴' : '▾'}
            </button>
          </SectionTitle>
          {showDone && (
            <div className="space-y-2">
              {done.map(p => (
                <Card key={p.id} className="p-4">
                  <div className="text-base font-semibold">{p.playerName}</div>
                  <div className="text-sm text-m-on-surface-variant">
                    Injured {ukDate(p.concussionDate)} · cleared {p.completedAt ? ukDate(p.completedAt) : ''}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
      <p className="text-xs text-m-on-surface-variant mt-6 px-1">
        RFU HEADCASE GRAS programme (Sept 2023). Records are deleted automatically after a year.
      </p>
    </div>
  )
}
