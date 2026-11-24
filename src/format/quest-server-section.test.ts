import { expect, test } from 'vitest'

import { parseNativeAssembly } from './nativeAssembly.ts'
import { parsePlatformDataSection } from './platformDataSections.ts'
import { derivePrimitives, primitiveOfHost } from './primitives.ts'
import { ACCEPTED_SECTION_VERSIONS } from './section-versions.ts'

// FORMAT-PRUNE FP16 (meta; carries ONE-FORMAT OF17b3): `quests/server` is the quest family's home. It holds the native
// plan's own quest rows, so a row a plan admits the section admits, and the family switches on from the section.
const chapter = { host: 'quest.chapter', id: 'driftwood.finale', rows: { file: 'quests/chapter-director.json' }, wake: { file: 'quests/wake-boss.json' }, reward: 'driftwood.reward' }
const kills = { host: 'quest.kill-steps', rows: { file: 'server/kill-steps.json' }, counters: { file: 'quests/achievements.json' } }
const composition = { host: 'quest.composition', rows: { file: 'server/quest-policy.json' }, spots: { file: 'server/quest-spots.json' }, counters: { file: 'quests/achievements.json' }, readSpots: true }
const section = { version: 1, hosts: [chapter, kills, { host: 'quest.body-scripts' }, composition] }

test('quests/server holds the quest rows a native plan holds, at version 1', (): void => {
  expect(parsePlatformDataSection('quests/server', section)).toEqual(section)
  const plan = parseNativeAssembly({ kind: 'native-assembly', level: { speed: 5, ground: { size: 500, height: 0 } }, terrain: { kind: 'flat' }, navigation: 'shard', entries: {}, features: section.hosts })
  expect(plan.features).toEqual(section.hosts)
  expect(ACCEPTED_SECTION_VERSIONS['quests/server']).toEqual([1])
})

test('quests/server refuses another host, too many hosts, no hosts and a wrong version', (): void => {
  for (const bad of [
    { version: 1, hosts: [{ host: 'commands' }] },
    { version: 1, hosts: [kills, kills, kills, kills, kills] },
    { version: 1, hosts: [] },
    { version: 2, hosts: [kills] },
  ]) expect((): unknown => parsePlatformDataSection('quests/server', bad)).toThrow()
})

test('the quest family switches on from quests/server and owns the four quest hosts', (): void => {
  for (const host of ['quest.chapter', 'quest.kill-steps', 'quest.body-scripts', 'quest.composition']) expect(primitiveOfHost(host)).toBe('quest')
  expect(derivePrimitives(new Map([['quests/server', section]])).map(row => row.name)).toContain('quest')
  expect(derivePrimitives(new Map()).map(row => row.name)).not.toContain('quest')
})
