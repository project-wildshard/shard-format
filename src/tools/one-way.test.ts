import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import baseline from './one-way-baseline.json' with { type: 'json' }
import { countRises } from './one-way-counts.ts'
import { collectInventory } from './one-way-inventory.ts'
import { siblingRoot } from './one-way-source.ts'

const root = fileURLToPath(new URL('../..', import.meta.url))

test('pinned inventories stay at or below every one-way ceiling', async (): Promise<void> => {
  const current = await collectInventory({
    formatRoot: root,
    engineRoot:
      process.env['WS_ONE_WAY_ENGINE_ROOT'] ??
      (await siblingRoot(root, 'engine')),
    sdkRoot:
      process.env['WS_ONE_WAY_SDK_ROOT'] ??
      (await siblingRoot(root, 'sharddev')),
    engineRevision:
      process.env['WS_ONE_WAY_ENGINE_REVISION'] ?? baseline.engineRevision,
    sdkRevision: process.env['WS_ONE_WAY_SDK_REVISION'] ?? baseline.sdkRevision,
  })
  assert.deepEqual(countRises(baseline.counts, current.counts), [])
  assert.deepEqual(
    current.pins,
    baseline.pins,
    'product pins must be recorded with the source-pin change',
  )
  assert.deepEqual(
    current.corpus,
    baseline.corpus,
    'record corpus JSON identities alongside their source changes',
  )
})
