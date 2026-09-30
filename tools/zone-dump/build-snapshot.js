// Dev tool: turns the raw zone dumps into the bundled snapshot server/Data/quest-zones.json.
// Keeps every zone (mod quests may reuse vanilla ids), points only (bounds are unused in v1).
// Locked doors: only Door and KeycardDoor (same set DynamicMaps shows; containers, trunks and switches are dropped).
// Usage: node build-snapshot.js [dumpDir] [outFile] [collectedWith]
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '../..')
const dumpDir = process.argv[2] ?? path.join(__dirname, 'dumps')
const outFile = process.argv[3] ?? path.join(root, 'server/Data/quest-zones.json')
const collectedWith = process.argv[4] ?? 'EFT 0.16.9.40743'

const round = (n) => Math.round(n * 100) / 100
const DOOR_TYPES = new Set(['Door', 'KeycardDoor'])

const zones = {}
const doors = {}
for (const file of fs.readdirSync(dumpDir).filter((f) => f.endsWith('.json')).sort()) {
  const dump = JSON.parse(fs.readFileSync(path.join(dumpDir, file), 'utf8'))
  // The game reports some ids capitalized (Sandbox, RezervBase); the server's locations folder is lowercase.
  const map = dump.Location.toLowerCase()
  const byId = (zones[map] ??= {})
  for (const zone of dump.Zones) {
    const id = zone.Id?.trim()
    if (!id) continue
    const point = { x: round(zone.Position.X), y: round(zone.Position.Y), z: round(zone.Position.Z) }
    const points = (byId[id] ??= [])
    if (!points.some((p) => p.x === point.x && p.y === point.y && p.z === point.z)) points.push(point)
  }
  const list = (doors[map] ??= [])
  for (const door of dump.Doors ?? []) {
    if (!DOOR_TYPES.has(door.Type) || !door.KeyId) continue
    const d = { key: door.KeyId, type: door.Type, x: round(door.Position.X), y: round(door.Position.Y), z: round(door.Position.Z) }
    if (!list.some((o) => o.key === d.key && o.x === d.x && o.y === d.y && o.z === d.z)) list.push(d)
  }
  if (list.length === 0) delete doors[map]
}

// Stable key order so regenerating produces a readable diff.
const sorted = Object.fromEntries(
  Object.keys(zones).sort().map((map) => [
    map,
    Object.fromEntries(Object.keys(zones[map]).sort().map((id) => [id, zones[map][id]])),
  ]),
)

const lines = ['{', `  "collectedWith": ${JSON.stringify(collectedWith)},`, '  "zones": {']
const maps = Object.keys(sorted)
maps.forEach((map, i) => {
  lines.push(`    ${JSON.stringify(map)}: {`)
  const ids = Object.keys(sorted[map])
  ids.forEach((id, j) => {
    const comma = j < ids.length - 1 ? ',' : ''
    lines.push(`      ${JSON.stringify(id)}: ${JSON.stringify(sorted[map][id])}${comma}`)
  })
  lines.push(`    }${i < maps.length - 1 ? ',' : ''}`)
})
lines.push('  },', '  "doors": {')
const doorMaps = Object.keys(doors).sort()
doorMaps.forEach((map, i) => {
  // Sorted by key, then position, so regenerating produces a stable diff.
  const list = doors[map].sort((a, b) => a.key.localeCompare(b.key) || a.x - b.x || a.z - b.z)
  lines.push(`    ${JSON.stringify(map)}: [`)
  list.forEach((d, j) => lines.push(`      ${JSON.stringify(d)}${j < list.length - 1 ? ',' : ''}`))
  lines.push(`    ]${i < doorMaps.length - 1 ? ',' : ''}`)
})
lines.push('  }', '}', '')

fs.mkdirSync(path.dirname(outFile), { recursive: true })
fs.writeFileSync(outFile, lines.join('\n'))
const total = maps.reduce((n, m) => n + Object.keys(sorted[m]).length, 0)
const doorTotal = doorMaps.reduce((n, m) => n + doors[m].length, 0)
console.log(`wrote ${maps.length} maps, ${total} zone ids, ${doorTotal} locked doors to ${outFile}`)
