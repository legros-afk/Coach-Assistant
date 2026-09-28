import { useEffect, useState } from 'react'
import { GROUP_COLOR } from '@/ui/positions'
import {
  AlertTriangle, Plus, Settings, Trash2, UserPlus, Users,
} from 'lucide-react'
import { TopAppBar, BarButton } from '@/ui/TopAppBar'
import { Button } from '@/ui/Button'
import { ButtonGroup } from '@/ui/ButtonGroup'
import { Card } from '@/ui/Card'
import { Fab } from '@/ui/Fab'
import { Sheet } from '@/ui/Sheet'
import { TextField, TextArea } from '@/ui/TextField'
import { WoodfordMark } from '@/components/WoodfordMark'
import type { Group, Player } from '@/lib/events/types'
import { clubPinConfigured } from '@/lib/drive/driveRead'
import { publishSquad } from '@/lib/drive/drivePublish'
import { markSquadSynced, discardLocalSquadEdits } from '@/lib/drive/squadSyncState'
import { DRIVE_FOLDER_ID } from '@/config/club'
import { useSyncStore } from '@/lib/drive/useSyncStore'
import { friendlyShareError } from '@/lib/friendly'
import SeasonView from './SeasonView'
import { DEMO_SQUAD_ID, useSquadStore } from './useSquadStore'


const GROUP_LABEL: Record<Group, string> = { forward: 'Forward', back: 'Back', scrumhalf: 'Scrum-half' }
const GROUP_SHORT: Record<Group, string> = { forward: 'F', back: 'B', scrumhalf: 'SH' }
const ALL_GROUPS: Group[] = ['forward', 'back', 'scrumhalf']

interface PlayerForm {
  name: string
  defaultGroup: Group
  eligibleGroups: Group[]
  notes: string
}

const emptyForm = (): PlayerForm => ({
  name: '', defaultGroup: 'forward', eligibleGroups: ['forward'], notes: '',
})

function playerToForm(p: Player): PlayerForm {
  return { name: p.name, defaultGroup: p.defaultGroup, eligibleGroups: p.eligibleGroups, notes: p.notes ?? '' }
}

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

interface Props { onOpenSettings: () => void }

export default function SquadScreen({ onOpenSettings }: Props) {
  const [view, setView] = useState<'squad' | 'season'>('squad')
  const store = useSquadStore()
  const { squad, isHydrated, hydrate } = store

  const [editTarget, setEditTarget] = useState<Player | 'new' | null>(null)
  const [form, setForm] = useState<PlayerForm>(emptyForm())
  const [publishing, setPublishing] = useState(false)
  const [conflict, setConflict]     = useState(false)
  const [banner, setBanner] = useState<{ ok: boolean; msg: string } | null>(null)
  const { isSyncing, syncAll } = useSyncStore()

  // Only the PIN holders look after the squad; for everyone else it's a list.
  const canEdit = clubPinConfigured()

  useEffect(() => { if (!isHydrated) hydrate() }, [isHydrated, hydrate])

  const showBanner = (ok: boolean, msg: string) => {
    setBanner({ ok, msg })
    setTimeout(() => setBanner(null), 3000)
  }

  const openNew = () => { setForm(emptyForm()); setEditTarget('new') }
  const openEdit = (p: Player) => { setForm(playerToForm(p)); setEditTarget(p) }
  const closeEdit = () => setEditTarget(null)

  const handleDefaultGroupChange = (g: Group) => {
    setForm(f => ({
      ...f,
      defaultGroup: g,
      eligibleGroups: Array.from(new Set([g, ...f.eligibleGroups])),
    }))
  }

  const handleEligibleToggle = (g: Group) => {
    if (g === form.defaultGroup) return // can't uncheck default
    setForm(f => ({
      ...f,
      eligibleGroups: f.eligibleGroups.includes(g)
        ? f.eligibleGroups.filter(x => x !== g)
        : [...f.eligibleGroups, g],
    }))
  }

  const handleSave = async () => {
    if (!form.name.trim()) return
    const draft = {
      name: form.name.trim(),
      defaultGroup: form.defaultGroup,
      eligibleGroups: form.eligibleGroups,
      notes: form.notes.trim() || undefined,
    }
    if (editTarget === 'new') {
      await store.addPlayer(draft)
    } else if (editTarget) {
      await store.updatePlayer(editTarget.id, draft)
    }
    closeEdit()
    void handlePublish()
  }

  const handleDelete = async () => {
    if (editTarget && editTarget !== 'new') {
      await store.deletePlayer(editTarget.id)
      closeEdit()
      void handlePublish()
    }
  }

  const handlePull = async () => {
    await syncAll()
    const { lastError } = useSyncStore.getState()
    showBanner(!lastError, lastError ?? 'Up to date with the club')
  }

  const handlePublish = async (force = false) => {
    // Read the latest squad: this runs straight after a store update
    const squad = useSquadStore.getState().squad
    if (!squad || !clubPinConfigured()) return
    setPublishing(true)
    const result = await publishSquad(squad, DRIVE_FOLDER_ID, force)
    setPublishing(false)

    if (result.ok) {
      // What's on Drive is now this version, so these edits are no longer
      // unpublished — without this the device would keep refusing club updates.
      markSquadSynced(squad.version)
      setConflict(false)
      showBanner(true, 'Shared with the coaches')
      return
    }
    // A conflict isn't a failure to retry — it needs the coach to choose, so
    // it gets its own prompt rather than a banner that scrolls away.
    if (result.conflict) {
      setConflict(true)
      return
    }
    showBanner(false, friendlyShareError(result.error))
  }

  // Give up this device's edits and take the club copy instead.
  const handleTakeClubCopy = async () => {
    if (!squad) return
    discardLocalSquadEdits(squad.version)
    setConflict(false)
    await handlePull()
  }

  const handleLoadDemo = async () => {
    await store.loadDemoSquad()
    showBanner(true, 'Demo squad loaded.')
  }

  const handleClearDemo = async () => {
    await store.clearSquad()
    showBanner(true, 'Demo data cleared.')
  }

  const players = [...(squad?.players ?? [])].sort((a, b) => a.name.localeCompare(b.name))
  const isDemo = squad?.id === DEMO_SQUAD_ID

  return (
    <div className="min-h-screen pb-32 bg-m-surface text-m-on-surface">
      <TopAppBar
        title="Team"
        subtitle={squad ? `${players.length} player${players.length !== 1 ? 's' : ''}` : 'No squad yet'}
        leading={<WoodfordMark size={32} />}
        actions={<BarButton icon={<Settings size={16} strokeWidth={2.5} />} label="Settings" onClick={onOpenSettings} />}
      >
        <ButtonGroup
          onBrand
          full
          ariaLabel="Squad or season"
          value={view}
          onChange={setView}
          options={[{ value: 'squad', label: 'Squad' }, { value: 'season', label: 'Season' }]}
        />
      </TopAppBar>

      <div className="px-4 pt-4 space-y-3">
        {/* Publish conflict — needs a decision, so it stays put until one is made */}
        {conflict && (
          <Card className="p-4 !bg-x-warn-container text-x-on-warn-container">
            <div className="flex items-start gap-3">
              <AlertTriangle size={20} strokeWidth={2.25} className="flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="text-base font-semibold">Another coach changed the squad too</div>
                <div className="text-sm mt-0.5">Which version should everyone use?</div>
                <div className="flex gap-2 mt-3">
                  <Button size="sm" onClick={() => handlePublish(true)} disabled={publishing}>Use mine</Button>
                  <Button size="sm" variant="outlined" onClick={handleTakeClubCopy} disabled={publishing || isSyncing}>Use theirs</Button>
                </div>
              </div>
            </div>
          </Card>
        )}

        {banner && (
          <div
            className={`pop-in px-4 py-3 rounded-m-lg text-sm font-medium flex items-center gap-2 ${banner.ok ? 'bg-x-good-container text-x-on-good-container' : 'bg-m-error-container text-m-on-error-container'}`}
          >
            {!banner.ok && <AlertTriangle size={16} strokeWidth={2.25} />}
            {banner.msg}
          </div>
        )}

        {isDemo && (
          <div className="px-4 py-2 rounded-m-lg flex items-center justify-between gap-3 bg-m-tertiary-container text-m-on-tertiary-container">
            <span className="text-sm font-medium">Practice squad — not real players</span>
            <Button size="sm" variant="text" onClick={handleClearDemo} className="!text-m-on-tertiary-container">Remove</Button>
          </div>
        )}

        {view === 'season' ? (
          <SeasonView players={players} />
        ) : !isHydrated ? (
          <div className="py-12 text-center text-m-on-surface-variant text-sm">Loading…</div>
        ) : players.length === 0 ? (
          <div className="py-12 flex flex-col items-center gap-4 text-center">
            <Users size={48} className="text-m-outline" strokeWidth={1.75} />
            <div>
              <div className="text-xl emphasized mb-1">No players yet</div>
              <div className="text-base text-m-on-surface-variant">
                {canEdit ? 'Add your squad, or try the app with a practice squad.' : 'Your head coach adds the squad — it will appear here.'}
              </div>
            </div>
            {canEdit && <Button size="lg" onClick={openNew} icon={<UserPlus size={20} strokeWidth={2.25} />}>Add first player</Button>}
            <Button variant="text" onClick={handleLoadDemo}>Load practice squad</Button>
          </div>
        ) : (
          <>
            {!canEdit && (
              <div className="text-sm text-m-on-surface-variant px-1">
                Your head coach looks after the squad. Positions come from the club spreadsheet.
              </div>
            )}
            <Card className="overflow-hidden divide-y divide-m-outline-variant">
              {players.map(p => (
                <button
                  key={p.id}
                  onClick={canEdit ? () => openEdit(p) : undefined}
                  disabled={!canEdit}
                  className="w-full flex items-center gap-3 px-4 min-h-[3.5rem] py-2 text-left enabled:active:bg-m-surface-container-high transition-colors"
                >
                  <GroupBadge group={p.defaultGroup} />
                  <div className="flex-1 min-w-0">
                    <div className="text-base font-medium truncate">{p.name}</div>
                    {p.eligibleGroups.length > 1 && (
                      <div className="text-xs text-m-on-surface-variant">
                        also {p.eligibleGroups.filter(g => g !== p.defaultGroup).map(g => GROUP_SHORT[g]).join(', ')}
                      </div>
                    )}
                  </div>
                  {p.notes && <div className="w-2 h-2 rounded-full flex-shrink-0 bg-m-primary" aria-label="Has notes" />}
                </button>
              ))}
            </Card>
          </>
        )}
      </div>

      {players.length > 0 && canEdit && view === 'squad' && (
        <Fab icon={<Plus size={22} strokeWidth={2.5} />} label="Player" onClick={openNew} />
      )}

      {editTarget !== null && (
        <Sheet onClose={closeEdit} title={editTarget === 'new' ? 'Add player' : 'Edit player'}>
          <div className="space-y-5">
            <TextField
              label="Name"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Henry W"
              autoFocus={editTarget === 'new'}
            />

            <div>
              <div className="text-sm font-medium text-m-on-surface-variant mb-1.5">Main position</div>
              <ButtonGroup
                full
                ariaLabel="Main position"
                value={form.defaultGroup}
                onChange={handleDefaultGroupChange}
                options={ALL_GROUPS.map(g => ({ value: g, label: GROUP_LABEL[g] }))}
              />
            </div>

            <div>
              <div className="text-sm font-medium text-m-on-surface-variant mb-1.5">Can also play</div>
              <div className="flex gap-2 flex-wrap">
                {ALL_GROUPS.filter(g => g !== form.defaultGroup).map(g => {
                  const checked = form.eligibleGroups.includes(g)
                  return (
                    <button
                      key={g}
                      role="checkbox"
                      aria-checked={checked}
                      onClick={() => handleEligibleToggle(g)}
                      className={`m-press h-10 px-4 rounded-m-sm text-sm font-semibold border ${checked ? 'bg-m-secondary-container text-m-on-secondary-container border-transparent' : 'border-m-outline text-m-on-surface-variant'}`}
                    >
                      {checked ? '✓ ' : ''}{GROUP_LABEL[g]}
                    </button>
                  )
                })}
              </div>
              <div className="text-xs text-m-on-surface-variant mt-2 leading-snug">
                Positions come from the club spreadsheet. Change them there too, or the app will switch back when it next updates.
              </div>
            </div>

            <TextArea
              label="Notes (optional)"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="e.g. strong carrier, works on passing"
              rows={2}
            />
          </div>

          <div className="flex gap-2 mt-6 mb-2">
            {editTarget !== 'new' && (
              <Button variant="danger" size="lg" onClick={handleDelete} icon={<Trash2 size={18} strokeWidth={2.25} />}>Delete</Button>
            )}
            <Button size="lg" full className="flex-1" onClick={handleSave} disabled={!form.name.trim()}>Save</Button>
          </div>
        </Sheet>
      )}
    </div>
  )
}
