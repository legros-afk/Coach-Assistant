import type { Group } from '@/lib/events/types'

// Three clearly different colours for the three position groups, used the
// same way everywhere. None of them is red, amber or green, which are kept
// for status (warnings, results).
export const GROUP_COLOR: Record<Group, string> = {
  forward:   '#334155', // slate
  back:      '#1D4ED8', // blue
  scrumhalf: '#BE185D', // magenta
}
