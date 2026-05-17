import { useState } from 'react'
import { X, CheckCircle, ChevronRight, Loader } from 'lucide-react'
import { spondLogin, spondGetGroups, type SpondGroup } from '@/lib/spond/spondApi'
import {
  getSpondCreds, saveSpondCreds, saveSpondGroup, saveSpondToken,
  clearSpondCreds, spondConfigured,
} from '@/lib/spond/spondStore'

const PURPLE = '#3D0066'
const INK    = '#1A1A1A'

type View = 'status' | 'creds' | 'groups'

interface Props {
  onClose: () => void
  onConnected?: () => void
}

export default function SpondSheet({ onClose, onConnected }: Props) {
  const storedCreds = getSpondCreds()
  const [view,     setView]     = useState<View>(spondConfigured() ? 'status' : 'creds')
  const [email,    setEmail]    = useState(storedCreds.email)
  const [password, setPassword] = useState('')
  const [groups,   setGroups]   = useState<SpondGroup[]>([])
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  const connect = async () => {
    if (!email || !password) return
    setError('')
    setLoading(true)
    try {
      const token = await spondLogin(email, password)
      saveSpondCreds(email, password)
      saveSpondToken(token)
      const gs = await spondGetGroups(token)
      setGroups(gs)
      setView('groups')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const pickGroup = (g: SpondGroup) => {
    saveSpondGroup(g.id, g.name)
    onConnected?.()
    onClose()
  }

  const disconnect = () => {
    clearSpondCreds()
    onClose()
  }

  const creds = getSpondCreds()

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl overflow-hidden" style={{ maxHeight: '85vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3" style={{ borderBottom: '1px solid #F3F0F8' }}>
          <div>
            <div className="font-bold text-[15px]" style={{ color: INK }}>Spond</div>
            <div className="text-xs text-stone-400">Availability &amp; fixture sync</div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full active:scale-95 transition"
            style={{ background: '#F5F0FF' }}
          >
            <X size={16} color={PURPLE} />
          </button>
        </div>

        <div className="px-4 py-4 overflow-y-auto space-y-3">

          {/* ── Connected status */}
          {view === 'status' && (
            <>
              <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: '#F0FDF4' }}>
                <CheckCircle size={18} color="#16a34a" strokeWidth={2} />
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate" style={{ color: INK }}>{creds.email}</div>
                  <div className="text-xs text-stone-400">Team: {creds.groupName || '—'}</div>
                </div>
              </div>
              <button
                onClick={() => setView('creds')}
                className="w-full py-2.5 rounded-xl text-sm font-semibold active:scale-95 transition"
                style={{ background: '#F5F0FF', color: PURPLE }}
              >
                Change credentials
              </button>
              <button
                onClick={disconnect}
                className="w-full py-2.5 rounded-xl text-sm font-semibold active:scale-95 transition"
                style={{ background: '#FEF2F2', color: '#dc2626' }}
              >
                Disconnect
              </button>
            </>
          )}

          {/* ── Credentials form */}
          {view === 'creds' && (
            <>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-1">
                  Spond email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && connect()}
                  className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none"
                  style={{ borderColor: '#E4D0F5', color: INK }}
                  placeholder="your@email.com"
                  autoCapitalize="off"
                  autoCorrect="off"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && connect()}
                  className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none"
                  style={{ borderColor: '#E4D0F5', color: INK }}
                  placeholder="••••••••"
                />
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
              <button
                onClick={connect}
                disabled={!email || !password || loading}
                className="w-full py-3 rounded-xl text-sm font-bold active:scale-95 transition disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: PURPLE, color: 'white' }}
              >
                {loading && <Loader size={14} className="animate-spin" />}
                {loading ? 'Connecting…' : 'Connect to Spond'}
              </button>
            </>
          )}

          {/* ── Group picker */}
          {view === 'groups' && (
            <>
              <p className="text-sm text-stone-500">Choose your team from Spond:</p>
              {groups.map(g => (
                <button
                  key={g.id}
                  onClick={() => pickGroup(g)}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl border active:scale-[0.99] transition text-left"
                  style={{ borderColor: '#E4D0F5' }}
                >
                  <div className="flex-1">
                    <div className="text-sm font-semibold" style={{ color: INK }}>{g.name}</div>
                    <div className="text-xs text-stone-400">{g.members.length} members</div>
                  </div>
                  <ChevronRight size={16} className="text-stone-300" />
                </button>
              ))}
            </>
          )}

        </div>
      </div>
    </div>
  )
}
