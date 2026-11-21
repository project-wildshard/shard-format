// ONE-FORMAT OF31h2: a shard declares its own awake cost and the shard whose worker it shares, so the server's worker table
// needs no engine table of slugs.

import { safeParse } from 'valibot'
import { expect, test } from 'vitest'

import { ServerBudgetSchema } from './shardSections.ts'

const BASE =
  '"tickMicros":1000,"memory":1000000,"entities":100,"commandsPerTick":32'

/** A server budget, as its JSON; `extra` adds fields. */
function budget(extra = ''): unknown {
  const row: unknown = JSON.parse(`{${BASE}${extra}}`)
  return row
}

test('an older server budget with neither field still reads', (): void => {
  expect(safeParse(ServerBudgetSchema, budget()).success).toBe(true)
})

test('a declared awake cost and shared worker read back as written', (): void => {
  const read = safeParse(
    ServerBudgetSchema,
    budget(',"awakeMicros":682,"shareWorker":"far-reach"'),
  )
  expect(read.success).toBe(true)
  expect(read.output).toMatchObject({
    awakeMicros: 682,
    shareWorker: 'far-reach',
  })
})

test('an awake cost past one frame, a zero cost or a bad slug is refused', (): void => {
  expect(
    safeParse(ServerBudgetSchema, budget(',"awakeMicros":16667')).success,
  ).toBe(false)
  expect(
    safeParse(ServerBudgetSchema, budget(',"awakeMicros":0')).success,
  ).toBe(false)
  expect(
    safeParse(ServerBudgetSchema, budget(',"shareWorker":"Far Reach"')).success,
  ).toBe(false)
})
