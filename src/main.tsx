import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/roboto-flex'
import './styles/globals.css'
import App from './App'
import { applyAppearance } from './ui/theme'
import { useMatchStore } from './features/match/useMatchStore'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
  })

  // A new SW activates (skipWaiting + clientsClaim, since registerType is
  // 'autoUpdate') as soon as it finishes installing, even in tabs that were
  // already open. Reload those tabs so they pick up the new build instead of
  // silently continuing to run stale JS until the next manual refresh.
  // Never mid-match, though: while the match clock is running the update waits
  // until it stops (half time, full time or a pause).
  let reloading = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return
    reloading = true
    const reloadWhenIdle = () => {
      if (useMatchStore.getState().clockRunning) { setTimeout(reloadWhenIdle, 15_000); return }
      window.location.reload()
    }
    reloadWhenIdle()
  })
}

// Ask the phone to keep the app's saved data even when storage runs low.
if (navigator.storage?.persist) {
  void navigator.storage.persisted().then(already => { if (!already) void navigator.storage.persist() })
}

applyAppearance()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
