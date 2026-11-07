import type { ReactNode } from 'react'
import { Plus } from 'lucide-react'
import type { Group } from '@/lib/events/types'
import { GROUP_COLOR, GROUP_NAME, GROUP_SHORT } from './positions'

// Five forwards pack down 3 + 2; lines of backs are split into two rows.
// Anything else (a short or over-full group) keeps rows of at most three.
function rowsOf<T>(items: T[]): T[][] {
  const n = items.length
  if (n === 0) return []
  if (n <= 3) return [items]
  const first = Math.ceil(n / 2)
  return [items.slice(0, first), items.slice(first)]
}

interface PitchProps {
  forwards: ReactNode[]
  nine: ReactNode[]
  backs: ReactNode[]
}

/**
 * A team laid out on a rugby pitch: forwards at the front, the 9 behind
 * them, the backs behind the 9. The caller draws each slot.
 */
export function Pitch({ forwards, nine, backs }: PitchProps) {
  const row = (items: ReactNode[], key: string) => (
    <div key={key} className="flex justify-center gap-2">{items}</div>
  )
  return (
    <div
      className="relative rounded-m-xl overflow-hidden px-2 pt-6 pb-4"
      style={{
        background: 'repeating-linear-gradient(180deg, var(--pitch-grass) 0 48px, var(--pitch-grass-alt) 48px 96px)',
      }}
    >
      {/* Try line with posts, halfway line, and a dashed 10m line */}
      <div aria-hidden="true" className="absolute inset-x-0 top-0 pointer-events-none">
        <div className="mx-auto w-14 h-5 relative">
          <div className="absolute left-0 top-0 bottom-0 w-0.5" style={{ background: 'var(--pitch-line)' }} />
          <div className="absolute right-0 top-0 bottom-0 w-0.5" style={{ background: 'var(--pitch-line)' }} />
          <div className="absolute left-0 right-0 top-2.5 h-0.5" style={{ background: 'var(--pitch-line)' }} />
        </div>
        <div className="h-0.5" style={{ background: 'var(--pitch-line)' }} />
      </div>
      <div aria-hidden="true" className="absolute inset-x-0 top-1/2 h-0.5 pointer-events-none" style={{ background: 'var(--pitch-line)' }} />
      <div aria-hidden="true" className="absolute inset-x-0 top-[30%] border-t-2 border-dashed pointer-events-none" style={{ borderColor: 'var(--pitch-line)' }} />

      <div className="relative space-y-2">
        {rowsOf(forwards).map((r, i) => row(r, `f${i}`))}
        {nine.length > 0 && <div className="pt-1">{row(nine, 'nine')}</div>}
        <div className="pt-1 space-y-2">
          {rowsOf(backs).map((r, i) => row(r, `b${i}`))}
        </div>
      </div>
    </div>
  )
}

export type TileTone = 'normal' | 'off' | 'over'

interface TileProps {
  group: Group
  /** Missing: an empty slot to fill */
  name?: string
  /** One short line under the name: minutes, starts, tries */
  detail?: ReactNode
  /** Top-right mark, e.g. a Spond answer */
  mark?: ReactNode
  tone?: TileTone
  /** Label for an empty slot; defaults to the position */
  emptyLabel?: string
  onClick?: () => void
  ariaLabel?: string
}

/** One player (or an empty place) on the pitch. Three fit across a phone. */
export function PitchTile({ group, name, detail, mark, tone = 'normal', emptyLabel, onClick, ariaLabel }: TileProps) {
  const width = 'w-[calc((100%-1rem)/3)] max-w-[8rem] min-h-[4.75rem]'
  if (!name) {
    return (
      <button
        onClick={onClick}
        aria-label={ariaLabel ?? `Add a ${GROUP_NAME[group]}`}
        className={`m-press ${width} rounded-m-md border-2 border-dashed flex flex-col items-center justify-center gap-1 text-white`}
        style={{ borderColor: 'var(--pitch-line)', background: 'rgba(255,255,255,0.1)' }}
      >
        <Plus size={20} strokeWidth={2.5} />
        <span className="text-xs font-semibold">{emptyLabel ?? GROUP_NAME[group]}</span>
      </button>
    )
  }
  const ring = tone === 'off'
    ? '0 0 0 3px var(--m-error)'
    : tone === 'over'
      ? '0 0 0 3px var(--x-pause)'
      : '0 1px 3px rgba(0,0,0,0.3)'
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel ?? name}
      className={`m-press ${width} relative rounded-m-md px-1.5 pt-1.5 pb-1 flex flex-col items-center text-center`}
      style={{
        background: tone === 'off' ? 'var(--m-error-container)' : 'var(--pitch-tile)',
        color: 'var(--m-on-surface)',
        boxShadow: ring,
      }}
    >
      <span
        className="w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center"
        style={{ background: GROUP_COLOR[group], color: 'white' }}
      >
        {GROUP_SHORT[group]}
      </span>
      {mark && <span className="absolute top-1 right-1.5 text-xs font-bold">{mark}</span>}
      <span className="mt-0.5 w-full text-sm font-bold leading-tight truncate">{name}</span>
      {detail && <span className="w-full text-xs mono tabular-nums text-m-on-surface-variant truncate">{detail}</span>}
    </button>
  )
}
