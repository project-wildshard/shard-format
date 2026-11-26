import { parse } from 'valibot'
import { expect, test } from 'vitest'

import { readCookData } from './cook-data.ts'
import { OutputIndexSchema } from './outputIndex.ts'

const RELEASE = '1.2.3-rc.1'

test('a shardVersion is separate from the format version', (): void => {
  expect(parse(OutputIndexSchema.entries.shardVersion, RELEASE)).toBe(RELEASE)
  expect(
    readCookData({ version: 1, mounts: [], shardVersion: RELEASE }),
  ).toMatchObject({
    shardVersion: RELEASE,
  })
})

test('the author cannot use migration build metadata', (): void => {
  expect((): unknown =>
    parse(OutputIndexSchema.entries.shardVersion, '1.2.3+migrated.1'),
  ).toThrow(/without build metadata/u)
})
