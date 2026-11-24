import { expect, test } from 'vitest'

import { parseNativeAssembly } from './nativeAssembly.ts'
import { parsePlatformDataSection } from './platformDataSections.ts'
import { ACCEPTED_SECTION_VERSIONS } from './section-versions.ts'

// FORMAT-PRUNE FP16d (meta): `server/riding`, `server/boss` and `server/patrol` hold a family's native host rows, so a
// plan names none. Each row names its host; the engine admits it with the plan's own row schema, and a plan may now be
// empty of hosts.
const trample = {
  host: 'riding.trample',
  id: 'nalati.trample',
  radius: 0.55,
  strength: 1,
  speedLimit: 30,
}
const SECTIONS = ['server/riding', 'server/boss', 'server/patrol'] as const

test('each family section holds host rows at version 1', (): void => {
  for (const name of SECTIONS) {
    const value = { version: 1, hosts: [trample, { host: 'riding.roster' }] }
    expect(parsePlatformDataSection(name, value)).toEqual(value)
    expect(ACCEPTED_SECTION_VERSIONS[name]).toEqual([1])
  }
})

test('a family section refuses a row with no host, no rows and a wrong version', (): void => {
  for (const bad of [
    { version: 1, hosts: [{ id: 'no host' }] },
    { version: 1, hosts: [] },
    { version: 2, hosts: [trample] },
  ]) {
    expect((): unknown =>
      parsePlatformDataSection('server/riding', bad),
    ).toThrow()
  }
})

test('a native plan may name no host', (): void => {
  const plan = parseNativeAssembly({
    kind: 'native-assembly',
    level: { speed: 5, ground: { size: 500, height: 0 } },
    terrain: { kind: 'flat' },
    navigation: 'shard',
    entries: {},
    features: [],
  })
  expect(plan.features).toEqual([])
})

test('server/world holds a native plan without its kind and hosts, at version 1', (): void => {
  const world = {
    version: 1,
    level: { speed: 5, ground: { size: 500, height: 0 } },
    terrain: { kind: 'bake-ground' },
    navigation: 'shard',
    entries: { walk: { lanes: 23 } },
    collision: { resolution: 256 },
  }
  expect(parsePlatformDataSection('server/world', world)).toEqual(world)
  expect(ACCEPTED_SECTION_VERSIONS['server/world']).toEqual([1])
  expect((): unknown =>
    parsePlatformDataSection('server/world', { ...world, features: [] }),
  ).toThrow()
})
