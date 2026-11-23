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
    assertFormatWindow(index, '0.1.0.3')
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
    assert.equal(above?.above, true)
    assert.match(
      above?.message ?? '',
      /format 0\.1\.0\.9, above this reader's 0\.1\.0\.3/u,
    )
  })

  it('refuses a file below the floor as below', (): void => {
    const below = refusal({ formatVersion: 2, version: '0.0.9.0' })
    assert.equal(below?.above, false)
    assert.match(below?.message ?? '', /below the floor 0\.1\.0\.0/u)
  })

  it('passes every format from the floor to the reader, and leaves a malformed one to the schema', (): void => {
    assert.equal(refusal({ formatVersion: 2, version: '0.1' }), undefined)
    assert.equal(refusal({ formatVersion: SHARDFILE_VERSION }), undefined)
    assert.equal(refusal({ formatVersion: 'nope' }), undefined)
  })
})
