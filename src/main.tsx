import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/globals.css'
import App from './App'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
  })

  // A new SW activates (skipWaiting + clientsClaim, since registerType is
  // 'autoUpdate') as soon as it finishes installing, even in tabs that were
  // already open. Reload those tabs so they pick up the new build instead of
  // silently continuing to run stale JS until the next manual refresh.
  let reloading = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return
    reloading = true
    window.location.reload()
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
