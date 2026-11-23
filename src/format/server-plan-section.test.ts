import { expect, test } from 'vitest'

import { parsePlatformDataSection } from './platformDataSections.ts'
import { ACCEPTED_SECTION_VERSIONS } from './section-versions.ts'

// SHARD-COMPAT HS6b (meta): `server/plan` is the server's own copy of the feature rows, so `client/plan` stays the page's.
// It takes the plan's rows and refuses what the plan refuses.
/** `count` rows of one kind. */
function rows(count: number): unknown[] {
  return Array.from({ length: count }, (): unknown => ({
    kind: 'debug.expose',
  }))
}

const plan = { version: 1, features: [{ kind: 'debug.expose', name: 'pine' }] }

test('server/plan holds the rows client/plan holds, at version 1', (): void => {
  expect(parsePlatformDataSection('server/plan', plan)).toEqual(
    parsePlatformDataSection('client/plan', plan),
  )
  expect(ACCEPTED_SECTION_VERSIONS['server/plan']).toEqual([1])
})

test('server/plan refuses a row with no kind, a wrong version and too many rows', (): void => {
  for (const bad of [
    { version: 1, features: [{ name: 'no kind' }] },
    { version: 2, features: [] },
    { version: 1, features: rows(65) },
  ]) {
    expect((): unknown =>
      parsePlatformDataSection('server/plan', bad),
    ).toThrow()
  }
})
