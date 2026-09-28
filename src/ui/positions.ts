import type { Group } from '@/lib/events/types'

// Three clearly different hues for the position groups, the same on every
// screen and in both themes. None of them is a status colour.
export const GROUP_COLOR: Record<Group, string> = {
  forward:   'var(--pos-forward)',
  back:      'var(--pos-back)',
  scrumhalf: 'var(--pos-scrumhalf)',
}
