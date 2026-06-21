import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'

const DISMISSED_KEY = 'coach-install-dismissed'
const PURPLE = '#172f77'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISSED_KEY) === '1',
  )

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (!deferredPrompt || dismissed) return null

  const handleInstall = async () => {
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted' || outcome === 'dismissed') {
      setDeferredPrompt(null)
      if (outcome === 'dismissed') dismiss()
    }
  }

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, '1')
    setDismissed(true)
  }

  return (
    <div
      className="fixed bottom-20 left-3 right-3 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl"
      style={{ background: PURPLE, color: 'white' }}
    >
      <Download size={20} strokeWidth={2} className="flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="font-bold text-sm leading-tight">Install Coach Assistant</div>
        <div className="text-xs text-white/70 leading-tight">Add to home screen for quick match-day access</div>
      </div>
      <button
        onClick={handleInstall}
        className="flex-shrink-0 px-3 py-1.5 rounded-lg font-bold text-xs active:scale-95 transition"
        style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}
      >
        Install
      </button>
      <button
        onClick={dismiss}
        className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full active:scale-95 transition opacity-70"
      >
        <X size={15} strokeWidth={2.5} />
      </button>
    </div>
  )
}

