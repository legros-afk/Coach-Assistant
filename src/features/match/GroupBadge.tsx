import { GROUP_COLOR, GROUP_SHORT } from '@/ui/positions'
import type { Group } from '@/lib/events/types'

export function GroupBadge({ group, size = 'md' }: { group: Group; size?: 'md' | 'sm' }) {
  const bg = GROUP_COLOR[group]
  const cls = size === 'sm'
    ? 'text-xs w-5 h-5'
    : 'text-xs w-7 h-7'
  return (
    <span
      className={`font-bold rounded-full flex items-center justify-center flex-shrink-0 ${cls}`}
      style={{ background: bg, color: 'white' }}
    >
      {GROUP_SHORT[group]}
    </span>
  )
}
