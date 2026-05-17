import type { Group, Player } from '@/lib/events/types'

const SHEET_ID = '15BoH0eWQ5-1vxTMq7iL0f2bbG_MCTGLl2GbYD0jvBAg'
const BASE = 'https://sheets.googleapis.com/v4/spreadsheets'

interface SheetPosition {
  name: string
  defaultGroup: Group
  eligibleGroups: Group[]
}

export async function fetchSquadPositions(apiKey: string): Promise<SheetPosition[]> {
  const url = `${BASE}/${SHEET_ID}/values/A:D?key=${apiKey}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Sheets API ${res.status}`)
  const data = await res.json() as { values?: string[][] }
  const rows = data.values ?? []

  const result: SheetPosition[] = []
  // Row 0 is the header ("Name", "Forward", "Back", "Scrum-Half") — skip it
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    const name = row[0]?.trim()
    if (!name) continue
    const eligible: Group[] = []
    if (row[1]?.trim()) eligible.push('forward')
    if (row[2]?.trim()) eligible.push('back')
    if (row[3]?.trim()) eligible.push('scrumhalf')
    if (eligible.length === 0) continue
    result.push({ name, defaultGroup: eligible[0], eligibleGroups: eligible })
  }
  return result
}

export function applyPositions(players: Player[], positions: SheetPosition[]): { players: Player[]; changed: number } {
  const byName = new Map(positions.map(p => [p.name.toLowerCase(), p]))
  let changed = 0
  const updated = players.map(p => {
    const pos = byName.get(p.name.toLowerCase())
    if (!pos) return p
    if (
      pos.defaultGroup === p.defaultGroup &&
      pos.eligibleGroups.join(',') === p.eligibleGroups.join(',')
    ) return p
    changed++
    return { ...p, defaultGroup: pos.defaultGroup, eligibleGroups: pos.eligibleGroups }
  })
  return { players: updated, changed }
}
