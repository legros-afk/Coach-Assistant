import { useState, useEffect } from 'react'
import { Play, Pause, Plus } from 'lucide-react'
import { WoodfordMark } from '@/components/WoodfordMark'

const INK    = '#201820'
const PURPLE = '#782880'

function fmt(s: number) {
  const m   = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function ScoreButton({
  label, value, primary, onClick,
}: { label: string; value: number; primary?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="tap-target flex-1 rounded-lg flex items-center justify-center gap-1.5 font-bold active:scale-95 transition"
      style={{
        background: primary ? 'white' : 'rgba(255,255,255,0.1)',
        color:      primary ? INK    : 'white',
        border:     primary ? 'none' : '1px solid rgba(255,255,255,0.2)',
      }}
    >
      <Plus size={14} strokeWidth={3} />
      <span className="text-sm uppercase tracking-wide">{label}</span>
      <span className="mono text-xl tabular-nums">{value}</span>
    </button>
  )
}

export default function LiveMatch() {
  const [half,      setHalf]      = useState(1)
  const [elapsed,   setElapsed]   = useState(0)
  const [running,   setRunning]   = useState(false)
  const [scoreUs,   setScoreUs]   = useState(0)
  const [scoreThem, setScoreThem] = useState(0)

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(id)
  }, [running])

  const handleHalfEnd = () => {
    setRunning(false)
    if (half === 1) {
      setHalf(2)
      setElapsed(0)
    }
  }

  return (
    <div className="min-h-screen pb-24" style={{ background: '#F5F3F0', color: INK }}>

      {/* ── Brand strip ─────────────────────────────────────── */}
      <div className="sticky top-0 z-20" style={{ background: PURPLE }}>
        <div
          className="px-3 py-2 flex items-center justify-between"
          style={{ borderBottom: '1px solid #5C1E63' }}
        >
          <div className="flex items-center gap-2">
            <WoodfordMark size={22} color="white" />
            <div className="leading-tight">
              <div className="text-[13px] font-bold tracking-wide uppercase text-white">
                Woodford U12
              </div>
              <div className="text-[10px] text-white/80 tracking-wider">
                vs Saints · Team A
              </div>
            </div>
          </div>
          <div className="text-[10px] uppercase tracking-widest text-white/70 italic">
            Nunquam Respice
          </div>
        </div>

        {/* Clock + score bar */}
        <div style={{ background: INK }} className="px-3 py-2.5">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-widest text-white/60">
                H{half}
              </span>
              <span className="mono text-3xl font-bold tabular-nums tracking-tight text-white">
                {fmt(elapsed)}
              </span>
            </div>

            <button
              onClick={() => setRunning(r => !r)}
              className="tap-target w-14 rounded-lg flex items-center justify-center transition active:scale-95"
              style={{ background: running ? '#F59E0B' : '#10B981', color: INK }}
              aria-label={running ? 'Pause' : 'Start'}
            >
              {running
                ? <Pause size={22} strokeWidth={2.5} />
                : <Play  size={22} strokeWidth={2.5} />
              }
            </button>

            <div className="flex-1 flex items-center gap-1.5 ml-1">
              <ScoreButton
                label="Us"
                value={scoreUs}
                primary
                onClick={() => setScoreUs(n => n + 1)}
              />
              <span className="text-white/50">—</span>
              <ScoreButton
                label="Them"
                value={scoreThem}
                onClick={() => setScoreThem(n => n + 1)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Placeholder body — replaced in Step 3 ───────────── */}
      <div className="px-4 py-8 space-y-6">
        <div
          className="rounded-xl p-5 text-center space-y-2"
          style={{ background: 'white', border: '1px solid #E7E5E4' }}
        >
          <div className="text-2xl font-bold" style={{ color: PURPLE }}>
            Step 1 complete
          </div>
          <p className="text-sm text-stone-500">
            Scaffold is live. Brand strip, clock, and score buttons are wired.
            Player sections arrive in Step 3.
          </p>
          <p className="text-xs text-stone-400 font-mono">
            Tailwind · Vite · React 18 · TypeScript · PWA
          </p>
        </div>

        <div
          className="rounded-xl p-4 space-y-1"
          style={{ background: '#FAF3FB', border: '1px solid #F4E8F5' }}
        >
          <div className="text-sm font-bold" style={{ color: '#5C1E63' }}>Try it now</div>
          <ul className="text-sm space-y-1" style={{ color: PURPLE }}>
            <li>▶ Tap Play — clock counts up</li>
            <li>+ Tap Us / Them — score increments</li>
            <li>✓ Brand strip is sticky on scroll</li>
          </ul>
        </div>

        <button
          onClick={handleHalfEnd}
          className="tap-target w-full rounded-lg font-bold text-sm active:scale-95 transition"
          style={{ background: INK, color: 'white' }}
        >
          End half {half} →
        </button>
      </div>
    </div>
  )
}
