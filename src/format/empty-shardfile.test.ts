import { expect, test } from 'vitest'

import { emptyShardfile } from './empty-shardfile.ts'
import { SHARDFILE_VERSION } from './version.ts'

const IDENTITY = {
  slug: 'empty-start',
  name: 'Empty start',
  author: 'Test',
  revision: 1,
  seed: 3,
}

test('the starting shard file parses at the current format', (): void => {
  const file = emptyShardfile(IDENTITY)
  expect(file.version).toBe(SHARDFILE_VERSION)
  expect(file.identity).toEqual(IDENTITY)
  expect(file.far).toBeNull()
  expect(file.edge.north.heights).toHaveLength(257)
  expect(
    file.entryways.map((row: Readonly<{ edge: string }>): string => row.edge),
  ).toEqual(['north', 'east', 'south', 'west'])
})
