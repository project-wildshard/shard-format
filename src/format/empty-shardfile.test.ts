import { expect, test } from 'vitest'

import { emptyShardfile } from './empty-shardfile.ts'
import { SHARDFILE_VERSION } from './version.ts'

import type { Shardfile } from './shardSchema.ts'

const IDENTITY = {
  slug: 'empty-start',
  name: 'Empty start',
  author: 'Test',
  saveRevision: 1,
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

test('FP26: the save lineage spelled revision (format 0.1.0.3 and older) comes back as saveRevision', (): void => {
  const { saveRevision, ...rest } = IDENTITY
  const file = emptyShardfile({ ...rest, revision: saveRevision })
  expect(file.identity).toEqual(IDENTITY)
  expect((): Shardfile => emptyShardfile({ ...IDENTITY, revision: 2 })).toThrow(
    /exactly one of saveRevision or revision/u,
  )
})
