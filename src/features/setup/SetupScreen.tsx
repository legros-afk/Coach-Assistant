import { useState } from 'react'
import { CheckCircle, ChevronLeft, Link, Loader } from 'lucide-react'
import { WoodfordMark } from '@/components/WoodfordMark'
import { FOLDER_ID_KEY, listFolder, parseFolderId } from '@/lib/drive/driveRead'
import { syncFromDrive } from '@/lib/drive/driveSync'

const PURPLE      = '#172f77'
const PURPLE_DARK = '#0f1f50'
const INK         = '#1A1A1A'

interface Props {
  onDone: () => void
  onBack?: () => void
}

export default function SetupScreen({ onDone, onBack }: Props) {
  const [input, setInput]     = useState(() => localStorage.getItem(FOLDER_ID_KEY) ?? '')
  const [status, setStatus]   = useState<'idle' | 'checking' | 'ok' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [canForce, setCanForce] = useState(false)

  const saveAndProceed = (folderId: string) => {
    localStorage.setItem(FOLDER_ID_KEY, folderId)
    syncFromDrive(folderId)
    setStatus('ok')
    setTimeout(onDone, 800)
  }

  const handleConnect = async (force = false) => {
    const folderId = parseFolderId(input)
    if (!folderId) {
      setStatus('error')
      setErrorMsg('That doesn\'t look like a valid folder link or ID.')
      setCanForce(false)
      return
    }
    if (force) {
      saveAndProceed(folderId)
      return
    }
    setStatus('checking')
    setCanForce(false)
    try {
      await listFolder(folderId)
      saveAndProceed(folderId)
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e)
      setStatus('error')
      setErrorMsg(`Couldn't verify the folder (${detail}). If you're sure the folder is shared correctly, tap "Connect anyway".`)
      setCanForce(true)
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f0f2f9' }}>
      {/* Header */}
      <div style={{ background: PURPLE }} className="px-4 py-5 flex items-center gap-3">
        {onBack ? (
          <button onClick={onBack} className="tap-target flex items-center justify-center -ml-1">
            <ChevronLeft size={24} color="white" strokeWidth={2.5} />
          </button>
        ) : (
          <WoodfordMark size={28} color="white" />
        )}
        <div className="leading-tight">
          <div className="text-sm font-bold tracking-wide uppercase text-white">
            {onBack ? 'Drive folder' : 'Sheffield Oaks RUFC'}
          </div>
          <div className="text-xs text-white/70">{onBack ? 'Change connected folder' : 'Coach Assistant'}</div>
        </div>
      </div>

      <div className="flex-1 px-4 py-8 flex flex-col gap-6 max-w-md mx-auto w-full">
        <div>
          <h1 className="text-2xl font-bold mb-1" style={{ color: INK }}>
            Connect to club data
          </h1>
          <p className="text-sm text-stone-500 leading-relaxed">
            Paste the Google Drive folder link shared by your head coach. This lets you pull the
            squad and fixtures to your device — no Google account needed.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-widest text-stone-400">
            Drive folder link or ID
          </label>
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-2 px-3 rounded-lg border-2 bg-white"
              style={{ borderColor: status === 'error' ? '#EF4444' : status === 'ok' ? '#10B981' : '#c5ccdf' }}
            >
              <Link size={16} className="flex-shrink-0 text-stone-400" />
              <input
                type="text"
                value={input}
                onChange={e => { setInput(e.target.value); setStatus('idle') }}
                onKeyDown={e => e.key === 'Enter' && handleConnect(false)}
                placeholder="https://drive.google.com/drive/folders/…"
                className="flex-1 py-3 text-sm outline-none bg-transparent"
                style={{ color: INK }}
                autoCapitalize="none"
                autoCorrect="off"
              />
            </div>
          </div>

          {status === 'error' && (
            <p className="text-xs text-red-500">{errorMsg}</p>
          )}
          {status === 'ok' && (
            <p className="text-xs text-emerald-600 flex items-center gap-1">
              <CheckCircle size={12} strokeWidth={2.5} /> Connected — syncing data…
            </p>
          )}
        </div>

        <button
          onClick={() => handleConnect(false)}
          disabled={!input.trim() || status === 'checking' || status === 'ok'}
          className="tap-target w-full rounded-lg font-bold text-base flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 transition"
          style={{ background: PURPLE, color: 'white', minHeight: '56px' }}
        >
          {status === 'checking' && <Loader size={18} className="animate-spin" />}
          {status === 'checking' ? 'Checking…' : 'Connect'}
        </button>

        {canForce && (
          <button
            onClick={() => handleConnect(true)}
            className="tap-target w-full rounded-lg font-bold text-base flex items-center justify-center active:scale-95 transition"
            style={{ background: '#78716C', color: 'white', minHeight: '48px' }}
          >
            Connect anyway
          </button>
        )}

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-stone-200" />
          <span className="text-xs text-stone-400">or</span>
          <div className="flex-1 h-px bg-stone-200" />
        </div>

        <button
          onClick={onDone}
          className="text-sm font-semibold text-center active:opacity-70 transition"
          style={{ color: PURPLE_DARK }}
        >
          Skip — use demo data for now
        </button>
      </div>
    </div>
  )
}

