import assert from 'node:assert/strict'
import { test } from 'node:test'

import { packWords } from '../bench/capture/frame-data.ts'
import { CapturedWorld, frozenClass } from '../bench/capture/frame-world.ts'

import type { Snapshot } from '../bench/capture/frame-data.ts'

function saved(tick: number, handle: number): Snapshot {
  return {
    tick,
    rows: [
      {
        handle,
        classId: 1,
        words: packWords(new Uint32Array(frozenClass(1).row.length).fill(7)),
      },
    ],
  }
}
test('a replay scratch world resets ticks and retires prior offsets', (): void => {
  const scratch = new CapturedWorld()
  const held = scratch.read(saved(1, 1))
  const storage = held.data
  assert.equal(scratch.read(saved(9, 2)), held)
  assert.equal(held.data, storage)
  assert.deepEqual(
    [held.tick, held.offset(1), held.offset(2)],
    [9, undefined, 0],
  )
  assert.deepEqual(
    held.data.slice(0, frozenClass(1).row.length),
    new Uint32Array(frozenClass(1).row.length).fill(7),
  )
})
test('reused replay storage still refuses a changed row width', (): void => {
  const scratch = new CapturedWorld()
  scratch.read(saved(9, 2))
  assert.throws((): void => {
    scratch.read({ tick: 10, rows: [{ handle: 2, classId: 1, words: '' }] })
  }, /row width differs/u)
})
