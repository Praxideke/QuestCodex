// Dev tool: checks fresh dumps in the game folder before they replace the repo copies.
// For each map it prints the dump time, whether it has collider data (plugin 0.0.2+), zone/collider/door counts,
// ids that are new since the repo copy (split into WTT mod zones and others) and ids that went missing.
// Usage: node check-dump.js <map> [<map> ...]   e.g. node check-dump.js bigmap labyrinth
//   env QUESTCODEX_GAME_DUMPS  plugin dump folder (default F:/SPT4.1.2/BepInEx/plugins/QuestCodex.ZoneDump/dumps)
//   env QUESTCODEX_MODS        SPT user/mods folder (default F:/SPT4.1.2/SPT_Runtime/user/mods)
const fs = require('fs')
const path = require('path')

const GAME = process.env.QUESTCODEX_GAME_DUMPS ?? 'F:/SPT4.1.2/BepInEx/plugins/QuestCodex.ZoneDump/dumps'
const REPO = path.join(__dirname, 'dumps')
const MODS = process.env.QUESTCODEX_MODS ?? 'F:/SPT4.1.2/SPT_Runtime/user/mods'

const wtt = new Set()
for (const m of fs.existsSync(MODS) ? fs.readdirSync(MODS) : []) {
  const dir = path.join(MODS, m, 'db', 'CustomQuestZones')
  if (!fs.existsSync(dir)) continue
  for (const f of fs.readdirSync(dir)) {
    try { for (const z of JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))) wtt.add(String(z.ZoneId).trim()) } catch {}
  }
}

const isRotated = (yaw) => { const r = ((yaw % 90) + 90) % 90; return r > 0.5 && r < 89.5 }

const maps = process.argv.slice(2)
if (maps.length === 0) {
  console.error('usage: node check-dump.js <map> [<map> ...]')
  process.exit(1)
}
for (const map of maps) {
  const file = path.join(GAME, `${map}.json`)
  if (!fs.existsSync(file)) { console.log(`${map}: no dump file in ${GAME}`); continue }
  const d = JSON.parse(fs.readFileSync(file, 'utf8'))
  const repoFile = path.join(REPO, `${map}.json`)
  const old = fs.existsSync(repoFile) ? JSON.parse(fs.readFileSync(repoFile, 'utf8')) : { Zones: [] }
  const colliders = d.Zones.flatMap((z) => z.Colliders ?? [])
  const types = {}
  for (const c of colliders) types[c.Type] = (types[c.Type] ?? 0) + 1
  const oldIds = new Set(old.Zones.map((z) => z.Id.trim()))
  const ids = new Set(d.Zones.map((z) => z.Id.trim()))
  const added = [...ids].filter((i) => !oldIds.has(i))
  console.log(`${map}: dumped ${d.DumpedAtUtc} (${d.Location}) ${colliders.length ? 'with colliders' : 'NO collider data (old plugin or not re-dumped)'}`)
  console.log(`  zones ${d.Zones.length} (repo: ${old.Zones.length}), colliders ${JSON.stringify(types)}, rotated ${colliders.filter((c) => c.Yaw != null && isRotated(c.Yaw)).length}, locked objects ${d.Doors.length}`)
  console.log(`  new ids ${added.length}: WTT mod ${added.filter((i) => wtt.has(i)).length}, other [${added.filter((i) => !wtt.has(i)).map((i) => i || '(empty)').join(', ')}]`)
  console.log(`  missing vs repo: [${[...oldIds].filter((i) => !ids.has(i)).join(', ')}]`)
}
