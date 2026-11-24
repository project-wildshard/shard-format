import assert from 'node:assert/strict'
import { test } from 'node:test'

import { classifyKept, keptLines } from './corpus-live.ts'

import type { Pin } from './corpus-pins.ts'
import type { StoredRecord } from './corpus.ts'

// ZONE-SNAPSHOTS ZS3 (J507): only live originals count; the rest of the API's list is rollback copies, a channel's
// stale pointer, or drift, and drift reds the corpus.

function stored(shard: string, revision: number): StoredRecord {
  return {
    hash: `${shard}-${String(revision)}`.padEnd(64, '0'),
    storedBytes: 1,
    revisions: [{ shard, revision }],
  }
}

function pin(record: StoredRecord): Pin {
  const [named = { shard: '', revision: 0 }] = record.revisions
  return {
    slug: named.shard,
    revision: named.revision,
    hash: record.hash,
    bytes: 1,
  }
}

const p1 = stored('pine', 1)
const p4 = stored('pine', 4)
const p5 = stored('pine', 5)
const p6 = stored('pine', 6)
const p7 = stored('pine', 7)
const p8 = stored('pine', 8)
const pine = [p1, p4, p5, p6, p7, p8]
const retired = stored('ink', 1)

test('the live pins, their 3 listed revisions back, a pointed one, and drift', (): void => {
  const kept = classifyKept([...pine, retired], {
    live: new Set([p8.hash]),
    pins: [pin(p8)],
    pointed: new Set([retired.hash]),
  })

  assert.deepEqual(kept.live, [p8])
  assert.deepEqual(kept.rollback, [p5, p6, p7])
  assert.deepEqual(kept.pointed, [retired])
  assert.deepEqual(kept.drift, [p1, p4])
  assert.match(keptLines(kept).join('\n'), /store drift pine r1 /u)
})

test('a revision between staging and production is a rollback copy', (): void => {
  const kept = classifyKept(pine, {
    live: new Set([p4.hash, p8.hash]),
    pins: [pin(p8)],
    pointed: new Set(),
  })

  assert.deepEqual(kept.live, [p4, p8])
  assert.deepEqual(kept.rollback, [p1, p5, p6, p7])
  assert.deepEqual(kept.drift, [])
})
