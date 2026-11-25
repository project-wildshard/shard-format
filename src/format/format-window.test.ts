import assert from 'node:assert/strict'

import { describe, it } from 'vitest'

import {
  ShardfileFormatWindowError,
  assertFormatWindow,
} from './format-window.ts'
import { SHARDFILE_VERSION } from './version.ts'

// SHARD-COMPAT CP2: above the reader and below the floor are told apart, before the schema runs.

function refusal(index: unknown): ShardfileFormatWindowError | undefined {
  try {
    assertFormatWindow(index, SHARDFILE_VERSION)
  } catch (error: unknown) {
    if (error instanceof ShardfileFormatWindowError) {
      return error
    }
    throw error
  }
  return undefined
}

describe('the format window (CP2)', (): void => {
  it('refuses a newer file as above, naming both formats', (): void => {
    const above = refusal({ formatVersion: '0.1.0.9' })
    assert.ok(above !== undefined)
    assert.equal(above.above, true)
    assert.ok(
      above.message.includes(
        `format 0.1.0.9, above this reader's ${SHARDFILE_VERSION}`,
      ),
    )
  })

  it('refuses a file below the floor as below, the deleted 0.1 and 0.1.0.0 too (FP24)', (): void => {
    for (const version of ['0.0.9.0', '0.1.0.0', '0.1']) {
      const below = refusal({ formatVersion: 2, version })
      assert.ok(below !== undefined, version)
      assert.equal(below.above, false)
      assert.match(below.message, /below the floor 0\.1\.0\.1/u)
    }
  })

  it('passes every format from the floor to the reader, and leaves a malformed one to the schema', (): void => {
    assert.equal(refusal({ formatVersion: 2, version: '0.1.0.1' }), undefined)
    assert.equal(refusal({ formatVersion: SHARDFILE_VERSION }), undefined)
    assert.equal(refusal({ formatVersion: 'nope' }), undefined)
  })
})
