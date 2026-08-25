import { useEffect, useState } from 'react'
import {
  AlertTriangle, ChevronLeft, CloudDownload, CloudUpload,
  Plus, RefreshCw, Trash2, UserPlus, Users,
} from 'lucide-react'
import { WoodfordMark } from '@/components/WoodfordMark'
import type { Group, Player } from '@/lib/events/types'
import { clubPinConfigured } from '@/lib/drive/driveRead'
import { publishSquad } from '@/lib/drive/drivePublish'
import { DRIVE_FOLDER_ID } from '@/config/club'
import { useSyncStore } from '@/lib/drive/useSyncStore'
import { DEMO_SQUAD_ID, useSquadStore } from './useSquadStore'

const PURPLE      = '#3D0066'
const PURPLE_DARK = '#5B1A99'
const PURPLE_SOFT = '#F4E8F5'
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

export default function SquadScreen({ onBack }: Props) {
  const store = useSquadStore()
  const { squad, isHydrated, hydrate } = store

  const [editTarget, setEditTarget] = useState<Player | 'new' | null>(null)
  const [form, setForm] = useState<PlayerForm>(emptyForm())
  const [publishing, setPublishing] = useState(false)
  const [banner, setBanner] = useState<{ ok: boolean; msg: string } | null>(null)
  const { isSyncing, syncAll } = useSyncStore()

  const canPublish = clubPinConfigured() && !!squad

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
  }

  const handleDelete = async () => {
    if (editTarget && editTarget !== 'new') {
      await store.deletePlayer(editTarget.id)
      closeEdit()
    }
  }

  const handlePull = async () => {
    await syncAll()
    const { lastError } = useSyncStore.getState()
    showBanner(!lastError, lastError ?? 'Squad & fixtures synced from Drive.')
  }

  const handlePublish = async () => {
    if (!squad) return
    setPublishing(true)
    const result = await publishSquad(squad, DRIVE_FOLDER_ID)
    setPublishing(false)
    showBanner(result.ok, result.ok ? 'Squad published to Drive.' : result.error)
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
    <div className="min-h-screen pb-24" style={{ background: '#F8F4FF', color: INK }}>

      {/* Header */}
      <div className="sticky top-0 z-20" style={{ background: PURPLE }}>
        <div className="px-3 py-2 flex items-center gap-3" style={{ borderBottom: `1px solid ${PURPLE_DARK}` }}>
          <button onClick={onBack} className="tap-target flex items-center justify-center -ml-1">
            <ChevronLeft size={24} color="white" strokeWidth={2.5} />
          </button>
          <div className="flex items-center gap-2 flex-1">
            <Users size={18} color="white" strokeWidth={2} />
            <div className="leading-tight">
              <div className="text-[13px] font-bold tracking-wide uppercase text-white">Squad</div>
              <div className="text-[10px] text-white/70">
                {squad ? `${players.length} player${players.length !== 1 ? 's' : ''}` : 'No squad loaded'}
              </div>
            </div>
          </div>
          <WoodfordMark size={22} color="white" />
        </div>

        {/* Action row */}
        <div className="px-3 py-2 flex gap-2" style={{ background: INK }}>
          <button
            onClick={handlePull}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wide transition active:scale-95 disabled:opacity-50"
            style={{ background: 'rgba(255,255,255,0.1)', color: 'white' }}
          >
            {isSyncing
              ? <RefreshCw size={13} className="animate-spin" />
              : <CloudDownload size={13} strokeWidth={2.5} />
            }
            Pull from club
          </button>
          <button
            onClick={handlePublish}
            disabled={!canPublish || publishing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wide transition active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ background: 'rgba(255,255,255,0.1)', color: 'white' }}
            title={!clubPinConfigured() ? 'Add your coach PIN in settings to enable' : 'Publish squad to Drive'}
          >
            {publishing
              ? <RefreshCw size={13} className="animate-spin" />
              : <CloudUpload size={13} strokeWidth={2.5} />
            }
            Publish to club
          </button>
        </div>
      </div>

      {/* Banner */}
      {banner && (
        <div
          className="mx-3 mt-3 px-3 py-2 rounded-lg text-sm flex items-center gap-2"
          style={{
            background: banner.ok ? '#D1FAE5' : '#FEE2E2',
            color: banner.ok ? '#065F46' : '#991B1B',
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
            className="text-xs font-bold px-2 py-1 rounded active:scale-95 transition"
            style={{ background: PURPLE, color: 'white' }}
          >
            Clear demo
          </button>
        </div>
      )}

      {/* Content */}
      <div className="px-3 pt-3">
        {!isHydrated ? (
          <div className="py-12 text-center text-stone-400 text-sm">Loading…</div>
        ) : players.length === 0 ? (
          /* Empty state */
          <div className="py-12 flex flex-col items-center gap-4">
            <Users size={40} className="text-stone-300" strokeWidth={1.5} />
            <div className="text-center">
              <div className="font-bold text-stone-500 mb-1">No players yet</div>
              <div className="text-sm text-stone-400">Add your squad or load demo data to get started.</div>
            </div>
            <button
              onClick={openNew}
              className="tap-target px-5 rounded-lg font-bold text-sm flex items-center gap-2 active:scale-95 transition"
              style={{ background: PURPLE, color: 'white', minHeight: '48px' }}
            >
              <UserPlus size={16} strokeWidth={2.5} /> Add first player
            </button>
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
            {players.map(p => (
              <button
                key={p.id}
                onClick={() => openEdit(p)}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-lg bg-white border active:scale-[0.99] transition text-left"
                style={{ borderColor: '#E4D0F5' }}
              >
                <GroupBadge group={p.defaultGroup} />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate" style={{ color: INK }}>{p.name}</div>
                  {p.eligibleGroups.length > 1 && (
                    <div className="text-[11px] text-stone-400">
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
      {players.length > 0 && (
        <div className="fixed bottom-20 right-4 z-20">
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
          className="fixed inset-0 z-40 flex items-end"
          style={{ background: 'rgba(32,24,32,0.7)' }}
          onClick={closeEdit}
        >
          <div
            className="bg-white w-full rounded-t-2xl p-4 max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="text-xl font-bold" style={{ color: INK }}>
                {editTarget === 'new' ? 'Add player' : 'Edit player'}
              </div>
              <button onClick={closeEdit} className="tap-target w-10 flex items-center justify-center">
                <span className="text-stone-400 text-xl">×</span>
              </button>
            </div>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-stone-400 block mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Henry W"
                  className="w-full px-3 py-3 rounded-lg border-2 text-sm outline-none"
                  style={{ borderColor: '#E4D0F5', color: INK }}
                  autoFocus={editTarget === 'new'}
                />
              </div>

              {/* Default group */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-stone-400 block mb-2">
                  Default position
                </label>
                <div className="flex gap-2">
                  {ALL_GROUPS.map(g => (
                    <button
                      key={g}
                      onClick={() => handleDefaultGroupChange(g)}
                      className="flex-1 py-2.5 rounded-lg text-sm font-bold transition active:scale-95"
                      style={{
                        background: form.defaultGroup === g ? PURPLE : '#F8F4FF',
                        color: form.defaultGroup === g ? 'white' : INK,
                        border: `2px solid ${form.defaultGroup === g ? PURPLE : '#E4D0F5'}`,
                      }}
                    >
                      {GROUP_SHORT[g]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Eligible groups */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-stone-400 block mb-2">
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
                          background: checked ? '#D1FAE5' : '#F8F4FF',
                          color: checked ? '#065F46' : '#7B5FA8',
                          border: `2px solid ${checked ? '#34D399' : '#E4D0F5'}`,
                        }}
                      >
                        {GROUP_LABEL[g]}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-stone-400 block mb-1">
                  Notes <span className="normal-case tracking-normal font-normal">(optional)</span>
                </label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="e.g. strong carrier, works on passing"
                  rows={2}
                  className="w-full px-3 py-2.5 rounded-lg border-2 text-sm outline-none resize-none"
                  style={{ borderColor: '#E4D0F5', color: INK }}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-5">
              {editTarget !== 'new' && (
                <button
                  onClick={handleDelete}
                  className="tap-target px-4 rounded-lg border-2 font-semibold flex items-center gap-1.5 active:scale-95 transition"
                  style={{ borderColor: '#FCA5A5', color: '#DC2626' }}
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
