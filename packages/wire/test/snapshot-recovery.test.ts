import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

import { inputOf, receiverBase } from '../bench/capture/prepared-frame.ts'
import { readSessionArchive } from '../bench/capture/session-archive.ts'
import { rawBase, snapshotInput } from '../bench/capture/v1-frames.ts'
import { bitSink, bitSource } from '../src/bits.ts'
import { decodeSnapshot } from '../src/snapshot-decode.ts'
import { encodeSnapshot } from '../src/snapshot-encode.ts'

import type { RawFrame, RideLaw, SnapshotInput } from '../src/snapshot.ts'

// WR4's Opus review: a delta whose baseline is gone cannot apply and the next
// full frame recovers; after a travel, a held frame of the same tick from
// another cell is not a baseline.

const LAW: RideLaw = { id: 1, words: 38 }
const NO_BASELINE = 4_294_967_295

type Frames = Awaited<ReturnType<typeof readSessionArchive>>['frames']
type Frame = Frames[number]

async function frames(): Promise<Frames> {
  const dir = new URL('../bench/recordings/ride/', import.meta.url)
  const manifest: unknown = JSON.parse(
    await readFile(new URL('manifest.json', dir), 'utf8'),
  )
  const session = await readSessionArchive(
    manifest,
    async (file: string): Promise<Readonly<Uint8Array>> =>
      await readFile(new URL(file, dir)),
  )
  return session.frames
}

function body(input: SnapshotInput): Uint8Array {
  const writer = bitSink()
  encodeSnapshot(writer, input)
  return writer.take()
}

/** Decode a body against `base` as the only held frame, or none. */
function decodeAgainst(
  input: SnapshotInput,
  base?: RawFrame,
): RawFrame | undefined {
  const bytes = body(input)
  return decodeSnapshot(bitSource({ bytes, start: 0, end: bytes.length }), {
    ownerClass: input.ownerClass,
    classOf: input.classOf,
    rideLaw: (): RideLaw => LAW,
    baseline: (): RawFrame | undefined => base,
  })
}

const isDelta = (record: Frame): boolean => record.baseline !== undefined

test('a delta whose baseline is gone waits, and the next full frame recovers', async (): Promise<void> => {
  const all = await frames()
  const delta = all.find((record: Frame): boolean => isDelta(record))
  const full = all.findLast((record: Frame): boolean => !isDelta(record))
  assert.ok(delta && full)
  const waiting = snapshotInput(inputOf(delta))
  assert.equal(decodeAgainst(waiting), undefined)
  const recovered = decodeAgainst(snapshotInput(inputOf(full)))
  assert.ok(recovered)
  assert.equal(recovered.baselineTick, NO_BASELINE)
  assert.ok(recovered.rows.size > 0)
})

test('after a travel, a held frame of another cell is not a baseline', async (): Promise<void> => {
  const all = await frames()
  const delta = all.find((record: Frame): boolean => isDelta(record))
  assert.ok(delta)
  const input = snapshotInput(inputOf(delta))
  const held = rawBase(receiverBase(delta))
  assert.ok(held)
  assert.ok(decodeAgainst(input, held))
  assert.equal(
    decodeAgainst(input, { ...held, cell: held.cell + 1 }),
    undefined,
  )
})
