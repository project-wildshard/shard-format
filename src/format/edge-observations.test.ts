/* oxlint-disable typescript/prefer-readonly-parameter-types -- PR6f1 fixture: plain rows */
import { safeParse } from 'valibot'
import { expect, test } from 'vitest'

import { EdgeObservationsSchema } from './edge-observations.ts'
import { emptyShardfile } from './empty-shardfile.ts'
import { OUTPUT_SECTIONS } from './outputFields.ts'
import { ShardfileSchema } from './shardSchema.ts'

const IDENTITY = {
  slug: 'edge-seen',
  name: 'Edge seen',
  author: 'Test',
  saveRevision: 1,
  seed: 3,
}
const sea = { geometry: 'ground', waterSurface: 0 } as const
const seen = {
  north: sea,
  east: {},
  south: { geometry: 'void' },
  west: { waterSurface: 1.5 },
}

test('PR6f1: a file may carry what its builder saw at each edge, beside the rows', (): void => {
  const file = emptyShardfile(IDENTITY)
  expect(safeParse(ShardfileSchema, file).success).toBe(true)
  const parsed = safeParse(ShardfileSchema, { ...file, edgeObservations: seen })
  expect(parsed.issues?.map((issue): string => issue.message)).toBeUndefined()
  expect(parsed.success && parsed.output.edgeObservations).toEqual(seen)
  expect(
    OUTPUT_SECTIONS.find((row): boolean => row.name === 'world/edge')?.fields,
  ).toContain('edgeObservations')
})

test('PR6f1: an observation names only ground or void and a bounded water height, on all four sides', (): void => {
  expect(safeParse(EdgeObservationsSchema, seen).success).toBe(true)
  expect(
    safeParse(EdgeObservationsSchema, { ...seen, west: { geometry: 'cliff' } })
      .success,
  ).toBe(false)
  expect(
    safeParse(EdgeObservationsSchema, { ...seen, west: { waterSurface: 300 } })
      .success,
  ).toBe(false)
  expect(
    safeParse(EdgeObservationsSchema, {
      ...seen,
      west: { waterSurface: Number.NaN },
    }).success,
  ).toBe(false)
  expect(
    safeParse(EdgeObservationsSchema, { ...seen, west: { entryWidth: 8 } })
      .success,
  ).toBe(false)
  const { west: _west, ...three } = seen
  expect(safeParse(EdgeObservationsSchema, three).success).toBe(false)
})
