import { useEffect, useState } from 'react'
import { Download, PlusSquare, Share, X } from 'lucide-react'

const DISMISSED_KEY = 'coach-install-dismissed'
const IOS_DISMISSED_AT_KEY = 'coach-ios-install-dismissed-at'
// Safari can clear a website's saved data after about a week unused, so an
// iPhone that hasn't installed the app gets a gentle reminder weekly.
const IOS_REMIND_MS = 7 * 24 * 60 * 60 * 1000

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isIos(): boolean {
  const ua = navigator.userAgent
  // iPadOS reports itself as a Mac; touch support gives it away
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)
}

function isInstalled(): boolean {
  return (navigator as Navigator & { standalone?: boolean }).standalone === true
    || window.matchMedia('(display-mode: standalone)').matches
}

function iosDismissedRecently(): boolean {
  try {
    const at = Number(localStorage.getItem(IOS_DISMISSED_AT_KEY) ?? 0)
    return Date.now() - at < IOS_REMIND_MS
  } catch { return false }
}

export default function InstallPrompt({ visible = true }: { visible?: boolean }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISSED_KEY) === '1',
  )
  const [showIos, setShowIos] = useState(() => isIos() && !isInstalled() && !iosDismissedRecently())

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (!visible) return null

  // ── iPhone / iPad: Safari has no install button, so show the three taps
  if (showIos) {
    const later = () => {
      try { localStorage.setItem(IOS_DISMISSED_AT_KEY, String(Date.now())) } catch { /* ignore */ }
      setShowIos(false)
    }
    return (
      <div
        className="fixed fab-bottom left-3 right-3 z-50 rounded-m-xl elev-3 p-5 bg-m-surface-container-high text-m-on-surface pop-in"
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="text-lg emphasized leading-snug">
            Put Coach Assistant on your Home Screen
          </div>
          <button onClick={later} className="w-9 h-9 -mr-2 -mt-2 flex items-center justify-center" aria-label="Not now">
            <X size={18} strokeWidth={2.5} className="text-m-outline" />
          </button>
        </div>
        <p className="text-sm text-m-on-surface-variant mb-3">
          It then opens like any app, works without signal, and keeps your teams safe.
        </p>
        <ol className="space-y-2 text-base" >
          <li className="flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 bg-m-primary text-m-on-primary" >1</span>
            <span>Tap</span>
            <Share size={20} strokeWidth={2} style={{ color: 'var(--x-ios-blue)' }} aria-label="the Share button" />
            <span>at the bottom of Safari</span>
          </li>
          <li className="flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 bg-m-primary text-m-on-primary" >2</span>
            <span>Tap</span>
            <PlusSquare size={20} strokeWidth={2} aria-hidden="true" />
            <span className="font-semibold">Add to Home Screen</span>
          </li>
          <li className="flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 bg-m-primary text-m-on-primary" >3</span>
            <span>Tap <span className="font-semibold">Add</span></span>
          </li>
        </ol>
        <button
          onClick={later}
          className="m-press w-full mt-4 h-12 rounded-full text-base font-semibold bg-m-secondary-container text-m-on-secondary-container"
        >
          Not now
        </button>
      </div>
    )
  }

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
      className="fixed fab-bottom left-3 right-3 z-50 flex items-center gap-3 px-4 py-3 rounded-m-xl elev-3 bg-m-inverse-surface text-m-inverse-on-surface pop-in"
    >
      <Download size={20} strokeWidth={2} className="flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="font-bold text-sm leading-tight">Install Coach Assistant</div>
        <div className="text-xs opacity-75 leading-tight">Opens like an app and works without signal</div>
      </div>
      <button
        onClick={handleInstall}
        className="m-press flex-shrink-0 px-4 h-10 rounded-full font-semibold text-sm bg-m-primary-container text-m-on-primary-container"
      >
        Install
      </button>
      <button
        onClick={dismiss}
        className="m-press flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full opacity-70"
        aria-label="Not now"
      >
        <X size={15} strokeWidth={2.5} />
      </button>
    </div>
  )
}
