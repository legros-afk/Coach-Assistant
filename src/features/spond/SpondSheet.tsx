import { useState } from 'react'
import { CheckCircle2, ChevronRight, Loader } from 'lucide-react'
import { Sheet } from '@/ui/Sheet'
import { Button } from '@/ui/Button'
import { TextField } from '@/ui/TextField'
import { spondLogin, spondGetGroups, type SpondGroup } from '@/lib/spond/spondApi'
import {
  getSpondCreds, saveSpondCreds, saveSpondGroup, saveSpondToken,
  clearSpondCreds, spondConfigured,
} from '@/lib/spond/spondStore'


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
      setError(navigator.onLine === false ? 'No signal — try again when you’re back online.' : 'Spond didn’t accept that email and password. Check them and try again.')
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
    <Sheet onClose={onClose} title="Spond">
      <p className="text-sm -mt-2 mb-4 text-m-on-surface-variant">Who’s coming, straight from Spond</p>

      {view === 'status' && (
        <div className="space-y-3 pb-2">
          <div className="flex items-center gap-3 p-4 rounded-m-lg bg-x-good-container text-x-on-good-container">
            <CheckCircle2 size={22} strokeWidth={2.25} />
            <div className="min-w-0">
              <div className="text-base font-semibold truncate">{creds.email}</div>
              <div className="text-sm opacity-80">Team: {creds.groupName || '—'}</div>
            </div>
          </div>
          <Button variant="tonal" full onClick={() => setView('creds')}>Change account</Button>
          <Button variant="danger" full onClick={disconnect}>Disconnect</Button>
        </div>
      )}

      {view === 'creds' && (
        <div className="space-y-4 pb-2">
          <TextField
            label="Spond email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && connect()}
            placeholder="your@email.com"
            autoCapitalize="off"
            autoCorrect="off"
          />
          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && connect()}
            placeholder="••••••••"
          />
          {error && <p className="text-sm text-m-error">{error}</p>}
          <Button
            size="lg"
            full
            onClick={connect}
            disabled={!email || !password || loading}
            icon={loading ? <Loader size={18} className="animate-spin" /> : undefined}
          >
            {loading ? 'Connecting…' : 'Connect to Spond'}
          </Button>
        </div>
      )}

      {view === 'groups' && (
        <div className="space-y-2 pb-2">
          <p className="text-base text-m-on-surface-variant">Choose your team:</p>
          {groups.map(g => (
            <button
              key={g.id}
              onClick={() => pickGroup(g)}
              className="m-press w-full flex items-center gap-3 p-4 rounded-m-lg bg-m-surface-container-high text-left"
            >
              <div className="flex-1">
                <div className="text-base font-semibold">{g.name}</div>
                <div className="text-sm text-m-on-surface-variant">{g.members.length} members</div>
              </div>
              <ChevronRight size={20} className="text-m-outline" />
            </button>
          ))}
        </div>
      )}
    </Sheet>
  )
}
