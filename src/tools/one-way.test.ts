import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import baseline from './one-way-baseline.json' with { type: 'json' }
import { countRises } from './one-way-counts.ts'
import { collectInventory } from './one-way-inventory.ts'
import { mainRevision, siblingRoot } from './one-way-source.ts'

const root = fileURLToPath(new URL('../..', import.meta.url))

/** FORMAT-PRUNE FP42: the ceilings hold on today's engine and SDK mains and every engine-pinned product, never on a
 * frozen snapshot; a revision variable selects a branch proof. */
test("today's mains and pins stay at or below every one-way ceiling", async (): Promise<void> => {
  const engineRoot =
    process.env['WS_ONE_WAY_ENGINE_ROOT'] ?? (await siblingRoot(root, 'engine'))
  const sdkRoot =
    process.env['WS_ONE_WAY_SDK_ROOT'] ?? (await siblingRoot(root, 'sharddev'))
  const current = await collectInventory({
    formatRoot: root,
    engineRoot,
    sdkRoot,
    engineRevision:
      process.env['WS_ONE_WAY_ENGINE_REVISION'] ??
      (await mainRevision(engineRoot)),
    sdkRevision:
      process.env['WS_ONE_WAY_SDK_REVISION'] ?? (await mainRevision(sdkRoot)),
  })
  assert.deepEqual(countRises(baseline.counts, current.counts), [])
  assert.deepEqual(
    current.corpus,
    baseline.corpus,
    'record corpus JSON identities alongside their source changes',
  )
})
