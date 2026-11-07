import type { Group } from '@/lib/events/types'

// Three clearly different hues for the position groups, the same on every
// screen and in both themes. None of them is a status colour.
export const GROUP_COLOR: Record<Group, string> = {
  forward:   'var(--pos-forward)',
  back:      'var(--pos-back)',
  scrumhalf: 'var(--pos-scrumhalf)',
}

// The scrum-half is "9", as coaches call it on the touchline
export const GROUP_SHORT: Record<Group, string> = { forward: 'F', back: 'B', scrumhalf: '9' }
export const GROUP_NAME:  Record<Group, string> = { forward: 'Forward', back: 'Back', scrumhalf: 'Number 9' }
export const GROUP_TITLE: Record<Group, string> = { forward: 'Forwards', back: 'Backs', scrumhalf: 'Number 9' }
