import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { baselineLockText } from '../cli/baseline.ts'
import { NET_EVENT_FORMS } from '../frozen/v0/messages.ts'
import { netSchemaHash } from '../frozen/v0/schema.ts'
import TABLES from '../frozen/v0/tables.json' with { type: 'json' }
import { V0_DESCRIPTIONS } from '../frozen/v0/tables.ts'

test('the lock regenerates byte for byte with the actual engine schema hash', (): void => {
  assert.equal(
    netSchemaHash([...V0_DESCRIPTIONS, NET_EVENT_FORMS]),
    3_951_578_209,
  )
  assert.deepEqual(V0_DESCRIPTIONS, TABLES.descriptions)
  assert.equal(
    baselineLockText(),
    readFileSync(new URL('../wire.v0.lock.json', import.meta.url), 'utf8'),
  )
})
