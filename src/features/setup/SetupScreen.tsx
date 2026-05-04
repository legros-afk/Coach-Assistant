import { useState } from 'react'
import { CheckCircle, Link, Loader } from 'lucide-react'
import { WoodfordMark } from '@/components/WoodfordMark'
import { FOLDER_ID_KEY, listFolder, parseFolderId } from '@/lib/drive/driveRead'
import { syncFromDrive } from '@/lib/drive/driveSync'

const PURPLE      = '#3D0066'
const PURPLE_DARK = '#5B1A99'
const INK         = '#1A1A1A'
const API_KEY     = import.meta.env.VITE_GOOGLE_DRIVE_API_KEY as string | undefined

interface Props {
  onDone: () => void
}

export default function SetupScreen({ onDone }: Props) {
  const [input, setInput]     = useState('')
  const [status, setStatus]   = useState<'idle' | 'checking' | 'ok' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const handleConnect = async () => {
    const folderId = parseFolderId(input)
    if (!folderId) {
      setStatus('error')
      setErrorMsg('That doesn\'t look like a valid folder link or ID.')
      return
    }
    if (!API_KEY) {
      // No API key — save folder ID but skip verification
      localStorage.setItem(FOLDER_ID_KEY, folderId)
      setStatus('ok')
      setTimeout(onDone, 800)
      return
    }
    setStatus('checking')
    try {
      await listFolder(folderId, API_KEY)
      localStorage.setItem(FOLDER_ID_KEY, folderId)
      // Fire-and-forget full sync in background
      syncFromDrive(folderId, API_KEY)
      setStatus('ok')
      setTimeout(onDone, 800)
    } catch {
      setStatus('error')
      setErrorMsg("Couldn't read this folder. Make sure the link is correct and the folder is set to 'Anyone with the link can view'.")
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#F8F4FF' }}>
      {/* Header */}
      <div style={{ background: PURPLE }} className="px-4 py-5 flex items-center gap-3">
        <WoodfordMark size={28} color="white" />
        <div className="leading-tight">
          <div className="text-sm font-bold tracking-wide uppercase text-white">
            Woodford RFC
          </div>
          <div className="text-xs text-white/70">Coach Assistant</div>
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
              style={{ borderColor: status === 'error' ? '#EF4444' : status === 'ok' ? '#10B981' : '#C8A0E8' }}
            >
              <Link size={16} className="flex-shrink-0 text-stone-400" />
              <input
                type="text"
                value={input}
                onChange={e => { setInput(e.target.value); setStatus('idle') }}
                onKeyDown={e => e.key === 'Enter' && handleConnect()}
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
          {!API_KEY && (
            <p className="text-xs text-amber-600">
              API key not configured — folder will be saved but automatic sync is disabled.
            </p>
          )}
        </div>

        <button
          onClick={handleConnect}
          disabled={!input.trim() || status === 'checking' || status === 'ok'}
          className="tap-target w-full rounded-lg font-bold text-base flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 transition"
          style={{ background: PURPLE, color: 'white', minHeight: '56px' }}
        >
          {status === 'checking' && <Loader size={18} className="animate-spin" />}
          {status === 'checking' ? 'Checking…' : 'Connect'}
        </button>

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
