// Dev tool: compares dumped zone ids against every zone id vanilla quests reference.
// Usage: node check-coverage.js [dumpDir] [sptDatabaseDir]
const fs = require('fs')
const path = require('path')

const dumpDir = process.argv[2] ?? 'F:/SPT4.1.2/BepInEx/plugins/QuestCodex.ZoneDump/dumps'
const dbDir = process.argv[3] ?? 'F:/SPT4.1.2/SPT_Runtime/SPT_Data/database'

const quests = JSON.parse(fs.readFileSync(path.join(dbDir, 'templates/quests.json')))
const locale = JSON.parse(fs.readFileSync(path.join(dbDir, 'locales/global/kr.json')))

// zoneId -> quest names that reference it
const wanted = new Map()
const want = (zoneId, quest) => {
  if (!zoneId) return
  if (!wanted.has(zoneId)) wanted.set(zoneId, new Set())
  wanted.get(zoneId).add(locale[`${quest._id} name`] ?? quest._id)
}
for (const quest of Object.values(quests)) {
  for (const c of quest.conditions?.AvailableForFinish ?? []) {
    if (c.conditionType === 'PlaceBeacon' || c.conditionType === 'LeaveItemAtLocation') want(c.zoneId, quest)
    if (c.conditionType !== 'CounterCreator') continue
    for (const s of c.counter?.conditions ?? []) {
      if (s.conditionType === 'VisitPlace' || s.conditionType === 'LaunchFlare') want(s.target, quest)
      if (s.conditionType === 'InZone') for (const z of s.zoneIds ?? []) want(z, quest)
    }
  }
}

const found = new Map() // zoneId -> [location]
for (const file of fs.existsSync(dumpDir) ? fs.readdirSync(dumpDir) : []) {
  if (!file.endsWith('.json')) continue
  const dump = JSON.parse(fs.readFileSync(path.join(dumpDir, file)))
  const inactive = dump.Zones.filter((z) => !z.Active).length
  console.log(`${dump.Location}: ${dump.Zones.length} zones (${inactive} inactive), ${dump.Doors.length} locked doors`)
  for (const z of dump.Zones) {
    if (!found.has(z.Id)) found.set(z.Id, new Set())
    found.get(z.Id).add(dump.Location)
  }
}

const hit = [...wanted.keys()].filter((id) => found.has(id))
const miss = [...wanted.keys()].filter((id) => !found.has(id))
console.log(`\nquest zone ids: ${wanted.size}, found: ${hit.length}, missing: ${miss.length}`)
for (const id of miss) console.log(`  missing ${id}  <- ${[...wanted.get(id)].join(' / ')}`)
