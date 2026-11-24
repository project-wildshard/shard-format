import { expect, test } from 'vitest'

import { readCookData } from './cook-data.ts'
import { deprecationsUsed } from './deprecations.ts'

// FORMAT-PRUNE FP19: unprepared originals and old cook data warn; a fresh 0.1.0.3+ file awaiting prepare does not.

const ids = (
  index: Readonly<Record<string, unknown>>,
  cook?: object,
): readonly string[] =>
  deprecationsUsed({ index, sections: new Map(), cook }).map(
    (row): string => row.id,
  )

test('FP19: the old sdk 0.2 marker is an unprepared original', (): void => {
  expect(ids({ sdk: '0.2' })).toContain('shard.unprepared')
  expect(ids({ sdk: '0.3' })).not.toContain('shard.unprepared')
  expect(ids({ formatVersion: '0.1.0.4' })).not.toContain('shard.unprepared')
})

test('FP19: cook.json versions 1 and 2 are old cook data', (): void => {
  expect(ids({}, { version: 1, mounts: [] })).toContain('cook.legacy-data')
  expect(ids({}, { version: 2, mounts: [] })).toContain('cook.legacy-data')
  expect(ids({}, { version: 3, mounts: [] })).not.toContain('cook.legacy-data')
  expect(ids({})).not.toContain('cook.legacy-data')
})

test('FP23: cook.json version 2 is gone; version 1 stays for an unprepared draft until the SDK writes no draft cook', (): void => {
  expect((): unknown =>
    readCookData({
      version: 2,
      inputHash: '0'.repeat(64),
      packs: 'whole',
      fence: [],
      programs: {},
      mounts: [],
    }),
  ).toThrow()
  expect(readCookData({ version: 1, mounts: [] }).version).toBe(1)
})
