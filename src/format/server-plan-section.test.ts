import { expect, test } from 'vitest'

import { parsePlatformDataSection } from './platformDataSections.ts'
import { ACCEPTED_SECTION_VERSIONS } from './section-versions.ts'

// SHARD-COMPAT HS6b (meta): `server/plan` is the server's own copy of the feature rows, so `client/plan` stays the page's.
// It takes the plan's rows and refuses what the plan refuses.
const plan = { version: 1, features: [{ kind: 'debug.expose', name: 'pine' }] }

test('server/plan reads the rows client/plan reads, at version 1', (): void => {
  expect(parsePlatformDataSection('server/plan', plan)).toEqual(
    parsePlatformDataSection('client/plan', plan),
  )
  expect(ACCEPTED_SECTION_VERSIONS['server/plan']).toEqual([1])
})

test('server/plan refuses what client/plan refuses', (): void => {
  const bad = { version: 1, features: [{ kind: 'no.such-kind' }] }
  expect((): unknown => parsePlatformDataSection('client/plan', bad)).toThrow()
  expect((): unknown => parsePlatformDataSection('server/plan', bad)).toThrow()
})
