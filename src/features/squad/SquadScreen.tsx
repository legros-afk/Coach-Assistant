import { useEffect, useState } from 'react'
import { GROUP_COLOR } from '@/ui/positions'
import {
  AlertTriangle, Plus, Settings, Trash2, UserPlus, Users,
} from 'lucide-react'
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

const PURPLE      = '#3D0066'
const PURPLE_DARK = '#5B1A99'
const PURPLE_SOFT = '#F1EAF6'
const INK         = '#1A1A1A'

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
      className="text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
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
    <div className="min-h-screen pb-24" style={{ background: '#F2F2F7', color: INK }}>

      {/* Header */}
      <div className="sticky top-0 z-20 safe-top" style={{ background: PURPLE }}>
        <div className="px-3 py-2.5 flex items-center gap-2" style={{ borderBottom: `1px solid ${PURPLE_DARK}` }}>
          <WoodfordMark size={24} color="white" />
          <div className="flex-1 leading-tight min-w-0">
            <div className="text-[17px] font-bold text-white">Team</div>
            <div className="text-xs text-white/75">
              {squad ? `${players.length} player${players.length !== 1 ? 's' : ''}` : 'No squad yet'}
            </div>
          </div>
          <button
            onClick={onOpenSettings}
            className="h-10 px-3 flex items-center gap-1.5 rounded-lg active:scale-95 transition text-sm font-bold text-white"
            style={{ background: 'rgba(255,255,255,0.15)' }}
          >
            <Settings size={16} strokeWidth={2.5} />
            Settings
          </button>
        </div>
        <div className="px-3 py-2 flex" style={{ background: PURPLE }}>
          <div className="flex-1 flex rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.3)' }}>
            {([['squad', 'Squad'], ['season', 'Season']] as const).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setView(k)}
                className="flex-1 h-10 text-sm font-bold transition"
                style={{ background: view === k ? 'white' : 'transparent', color: view === k ? PURPLE : 'white' }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Publish conflict — needs a decision, so it stays put until one is made */}
      {conflict && (
        <div className="mx-3 mt-3 px-3 py-3 rounded-lg" style={{ background: '#FEF3C7', border: '1px solid #F59E0B' }}>
          <div className="flex items-start gap-2">
            <AlertTriangle size={15} strokeWidth={2.5} className="flex-shrink-0 mt-0.5" style={{ color: '#92400E' }} />
            <div className="flex-1">
              <div className="text-sm font-bold" style={{ color: '#92400E' }}>
                Another coach changed the squad too
              </div>
              <div className="text-xs mt-1" style={{ color: '#92400E' }}>
                Which version should everyone use?
              </div>
              <div className="flex gap-2 mt-2.5">
                <button
                  onClick={() => handlePublish(true)}
                  disabled={publishing}
                  className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold active:scale-95 transition disabled:opacity-40"
                  style={{ background: '#92400E', color: 'white' }}
                >
                  Use mine
                </button>
                <button
                  onClick={handleTakeClubCopy}
                  disabled={publishing || isSyncing}
                  className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold active:scale-95 transition disabled:opacity-40"
                  style={{ background: 'white', color: '#92400E', border: '1px solid #F59E0B' }}
                >
                  Use theirs
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Banner */}
      {banner && (
        <div
          className="mx-3 mt-3 px-3 py-2 rounded-lg text-sm flex items-center gap-2"
          style={{
            background: banner.ok ? '#E3F5EC' : '#FDECEC',
            color: banner.ok ? '#065F46' : '#B42318',
          }}
        >
          {!banner.ok && <AlertTriangle size={14} strokeWidth={2.5} />}
          {banner.msg}
        </div>
      )}

      {/* Demo banner */}
      {isDemo && (
        <div
          className="mx-3 mt-3 px-3 py-2 rounded-lg flex items-center justify-between"
          style={{ background: PURPLE_SOFT, border: `1px solid ${PURPLE}` }}
        >
          <span className="text-xs font-semibold" style={{ color: PURPLE_DARK }}>
            Demo squad — not real player data
          </span>
          <button
            onClick={handleClearDemo}
            className="text-xs font-bold px-2 py-1 rounded-lg active:scale-95 transition"
            style={{ background: PURPLE, color: 'white' }}
          >
            Clear demo
          </button>
        </div>
      )}

      {/* Content */}
      <div className="px-3 pt-3">
        {view === 'season' ? (
          <SeasonView players={players} />
        ) : !isHydrated ? (
          <div className="py-12 text-center text-[#8E8E93] text-sm">Loading…</div>
        ) : players.length === 0 ? (
          /* Empty state */
          <div className="py-12 flex flex-col items-center gap-4">
            <Users size={40} className="text-[#C7C7CC]" strokeWidth={2} />
            <div className="text-center">
              <div className="font-bold text-[#6E6E73] mb-1">No players yet</div>
              <div className="text-sm text-[#8E8E93]">Add your squad or load demo data to get started.</div>
            </div>
            {canEdit && (
            <button
              onClick={openNew}
              className="tap-target px-5 rounded-lg font-bold text-sm flex items-center gap-2 active:scale-95 transition"
              style={{ background: PURPLE, color: 'white', minHeight: '48px' }}
            >
              <UserPlus size={16} strokeWidth={2.5} /> Add first player
            </button>
            )}
            <button
              onClick={handleLoadDemo}
              className="text-sm font-semibold active:opacity-70"
              style={{ color: PURPLE_DARK }}
            >
              Load demo squad
            </button>
          </div>
        ) : (
          /* Player list */
          <div className="space-y-1.5">
            {!canEdit && (
              <div className="text-sm text-[#6E6E73] px-1 pb-1">
                Your head coach looks after the squad. Positions come from the club spreadsheet.
              </div>
            )}
            {players.map(p => (
              <button
                key={p.id}
                onClick={canEdit ? () => openEdit(p) : undefined}
                disabled={!canEdit}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-lg bg-white border enabled:active:scale-[0.99] transition text-left"
                style={{ borderColor: '#E5E5EA' }}
              >
                <GroupBadge group={p.defaultGroup} />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate" style={{ color: INK }}>{p.name}</div>
                  {p.eligibleGroups.length > 1 && (
                    <div className="text-[11px] text-[#8E8E93]">
                      also {p.eligibleGroups.filter(g => g !== p.defaultGroup).map(g => GROUP_SHORT[g]).join(', ')}
                    </div>
                  )}
                </div>
                {p.notes && (
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: PURPLE }} />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Add player FAB — only when squad exists */}
      {players.length > 0 && canEdit && view === 'squad' && (
        <div className="fixed fab-bottom right-4 z-20">
          <button
            onClick={openNew}
            className="w-14 h-14 rounded-full shadow-lg flex items-center justify-center active:scale-95 transition"
            style={{ background: PURPLE, color: 'white' }}
          >
            <Plus size={26} strokeWidth={2.5} />
          </button>
        </div>
      )}

      {/* Player edit bottom sheet */}
      {editTarget !== null && (
        <div
          className="fixed inset-0 z-50 flex items-end backdrop-in"
          style={{ background: 'rgba(32,24,32,0.7)' }}
          onClick={closeEdit}
        >
          <div
            className="bg-white w-full rounded-t-2xl sheet-in p-4 max-h-[85vh] overflow-y-auto"
            style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="text-xl font-bold" style={{ color: INK }}>
                {editTarget === 'new' ? 'Add player' : 'Edit player'}
              </div>
              <button onClick={closeEdit} className="tap-target w-10 flex items-center justify-center">
                <span className="text-[#8E8E93] text-xl">×</span>
              </button>
            </div>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="text-xs font-semibold text-[#8E8E93] block mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Henry W"
                  className="w-full px-3 py-3 rounded-lg border-2 text-sm outline-none"
                  style={{ borderColor: '#E5E5EA', color: INK }}
                  autoFocus={editTarget === 'new'}
                />
              </div>

              {/* Default group */}
              <div>
                <label className="text-xs font-semibold text-[#8E8E93] block mb-2">
                  Default position
                </label>
                <div className="flex gap-2">
                  {ALL_GROUPS.map(g => (
                    <button
                      key={g}
                      onClick={() => handleDefaultGroupChange(g)}
                      className="flex-1 py-2.5 rounded-lg text-sm font-bold transition active:scale-95"
                      style={{
                        background: form.defaultGroup === g ? PURPLE : '#F2F2F7',
                        color: form.defaultGroup === g ? 'white' : INK,
                        border: `2px solid ${form.defaultGroup === g ? PURPLE : '#E5E5EA'}`,
                      }}
                    >
                      {GROUP_SHORT[g]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Eligible groups */}
              <div>
                <label className="text-xs font-semibold text-[#8E8E93] block mb-2">
                  Can also play
                </label>
                <div className="flex gap-2">
                  {ALL_GROUPS.map(g => {
                    const checked = form.eligibleGroups.includes(g)
                    const isDefault = g === form.defaultGroup
                    return (
                      <button
                        key={g}
                        onClick={() => handleEligibleToggle(g)}
                        disabled={isDefault}
                        className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition active:scale-95 disabled:opacity-50"
                        style={{
                          background: checked ? '#E3F5EC' : '#F2F2F7',
                          color: checked ? '#065F46' : '#6E6E73',
                          border: `2px solid ${checked ? '#10B981' : '#E5E5EA'}`,
                        }}
                      >
                        {GROUP_LABEL[g]}
                      </button>
                    )
                  })}
                </div>
                <div className="text-[11px] text-[#8E8E93] mt-2 leading-snug">
                  Positions come from the club spreadsheet. Change them there too, or the app will switch back when it next updates.
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs font-semibold text-[#8E8E93] block mb-1">
                  Notes <span className="normal-case tracking-normal font-normal">(optional)</span>
                </label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="e.g. strong carrier, works on passing"
                  rows={2}
                  className="w-full px-3 py-2.5 rounded-lg border-2 text-sm outline-none resize-none"
                  style={{ borderColor: '#E5E5EA', color: INK }}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-5">
              {editTarget !== 'new' && (
                <button
                  onClick={handleDelete}
                  className="tap-target px-4 rounded-lg border-2 font-semibold flex items-center gap-1.5 active:scale-95 transition"
                  style={{ borderColor: '#F87171', color: '#DC2626' }}
                >
                  <Trash2 size={16} strokeWidth={2.5} /> Delete
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={!form.name.trim()}
                className="tap-target flex-1 rounded-lg font-bold text-base active:scale-95 transition disabled:opacity-40"
                style={{ background: PURPLE, color: 'white', minHeight: '52px' }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
