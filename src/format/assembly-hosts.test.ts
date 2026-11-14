import { expect, test } from 'vitest'

import { ASSEMBLY_HOSTS, assemblyRefIssues } from './assembly-hosts.ts'
import { HEADLESS_ASSEMBLY_JSON_SCHEMA } from './namedJsonContracts.ts'

const MOVER = '@wildshard/engine/game/plugin/mover'
const NOISE = '@wildshard/engine/core/noise'

test('SA20: a host $ref passes, and a plain data $ref is not a host', (): void => {
  const document = {
    entries: {
      $fn: {
        $call: [
          { $ref: ['host', 'proveTerrainEntries'] },
          { $ref: ['args', 0, 'physics'] },
          { $ref: ['heightAt'] },
        ],
      },
    },
  }
  expect(assemblyRefIssues(document)).toEqual([])
  expect(Object.keys(ASSEMBLY_HOSTS).toSorted()).toEqual([
    'clamp',
    'proveTerrainEntries',
  ])
})

test('SA20: refuses the module paths driftwood and nalati named', (): void => {
  const document = {
    entries: { $call: [{ $ref: [MOVER, 'proveTerrainEntries'] }] },
    level: [{ $ref: [NOISE, 'clamp'] }],
  }
  expect(assemblyRefIssues(document)).toEqual([
    `$.entries.$call[0].$ref: $ref names the module path ${MOVER}; name a host instead: ["host", <name>]`,
    `$.level[0].$ref: $ref names the module path ${NOISE}; name a host instead: ["host", <name>]`,
  ])
})

test('SA20: refuses an unknown host and a host with no name', (): void => {
  expect(
    assemblyRefIssues([{ $ref: ['host', 'eval'] }, { $ref: ['host'] }]),
  ).toEqual([
    '$[0].$ref: $ref names the unknown host eval; hosts: clamp, proveTerrainEntries',
    '$[1].$ref: $ref names the unknown host undefined; hosts: clamp, proveTerrainEntries',
  ])
})

test('SA20: the schema admits no engine module as an assembly module key', (): void => {
  const pattern = new RegExp(
    HEADLESS_ASSEMBLY_JSON_SCHEMA.properties.modules.propertyNames.pattern,
    'u',
  )
  expect(pattern.test(MOVER)).toBe(false)
  expect(pattern.test('src/shards/driftwood-isle/runtime/headless.ts')).toBe(
    true,
  )
})
