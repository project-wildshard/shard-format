// MEMORY-GATES MG5 (J408): a runtimeCost reading from an older memory epoch is refused until the shard re-measures.
import { parse, safeParse } from 'valibot'
import { expect, test } from 'vitest'

import {
  MEMORY_EPOCH,
  OLDEST_CURRENT_EPOCH,
  staleRuntimeCost,
  staleRuntimeIssues,
} from './memory-epoch.ts'
import { RuntimeCostSchema } from './runtimeCost.ts'

const nine = {
  webContentMB: 399.21624,
  glMB: 278.256291,
  engineBaseMB: 299,
  rev: '5357804745121cdda8f9492b62d3266244f4ac1b',
  device: 'iOS Simulator iPhone 17 Pro Safari + desktop labelled GL census',
  evidence: 'progress/memory/sf22a-runtime-homes-535780474/summary.json',
}

test('MG5: a reading names its epoch; a missing one is the legacy epoch 1', (): void => {
  expect(parse(RuntimeCostSchema, { ...nine, epoch: 2 })).toMatchObject({
    epoch: 2,
  })
  expect(parse(RuntimeCostSchema, nine)).not.toHaveProperty('epoch')
  expect(safeParse(RuntimeCostSchema, { ...nine, epoch: 0 }).success).toBe(
    false,
  )
  expect(safeParse(RuntimeCostSchema, { ...nine, epoch: 1.5 }).success).toBe(
    false,
  )
})

test('MG5: an older epoch is stale and names the re-measure; a current one is not', (): void => {
  expect(MEMORY_EPOCH).toBe(4)
  // MG6 epoch 4 converts readings differently but takes them as epoch 3 did: epoch-3 readings stay current.
  expect(OLDEST_CURRENT_EPOCH).toBe(3)
  expect(staleRuntimeCost({ epoch: 3 })).toBe('')
  expect(staleRuntimeCost({ epoch: 4 })).toBe('')
  expect(staleRuntimeCost({ epoch: 2 })).toContain('memory epoch 2, current 3')
  const legacy = parse(RuntimeCostSchema, nine)
  expect(staleRuntimeCost(legacy, 1)).toBe('')
  expect(staleRuntimeCost(legacy)).toBe(
    'native resident measurement is stale: memory epoch 1, current 3 (J408): re-measure the runtime home',
  )
  expect(staleRuntimeCost({ epoch: 2 }, 2)).toBe('')
  expect(staleRuntimeCost({ epoch: 3 }, 2)).toBe('')
})

test('MG5: the report refuses each stale reading, the images-first one included', (): void => {
  expect(staleRuntimeIssues({}, 2)).toEqual([])
  expect(
    staleRuntimeIssues({ cost: { epoch: 2, imagesFirst: { epoch: 2 } } }, 2),
  ).toEqual([])
  expect(staleRuntimeIssues({ cost: { imagesFirst: {} } }, 2)).toMatchObject([
    {
      code: 'perf-native-resident-unmeasured',
      actual: 1,
      limit: 2,
      severity: 'refusal',
    },
    {
      code: 'perf-native-resident-unmeasured',
      actual: 1,
      limit: 2,
      severity: 'refusal',
    },
  ])
})
