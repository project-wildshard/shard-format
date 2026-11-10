import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  unpackDoubles,
  packDoubles,
  bytesText,
  parseFrameCapture,
} from '../bench/capture/frame-data.ts'
import { replayCapturedFrame } from '../bench/capture/frame-replay.ts'
import {
  packFrameWords,
  unpackFrameWords,
} from '../bench/capture/frame-words.ts'
import SAMPLE from '../fixtures/walking-frame-samples.json' with { type: 'json' }

import type { CapturedFrame } from '../bench/capture/frame-data.ts'

function jsonReload(value: unknown): unknown {
  const text = JSON.stringify(value)
  return JSON.parse(text)
}
function withRide(source: CapturedFrame): CapturedFrame {
  const owner = unpackDoubles(source.owner)
  owner[0] = -0
  const ride = {
    ...source,
    owner: packDoubles(owner),
    ride: packDoubles(new Float64Array([-0, 0, 0.25])),
    rideWords: 3,
  }
  return {
    ...ride,
    bytes: bytesText(new Uint8Array(replayCapturedFrame(ride))),
  }
}
const frames = SAMPLE.frames.map((value: unknown): CapturedFrame =>
  parseFrameCapture(value),
)

test('real initial, delta and lost-ACK frames retain every bit and callback', (): void => {
  assert.equal(SAMPLE.engine, 'cfd668102efcb7c10a6fb57d3021c1f3d23c37a5')
  assert.ok(frames.some((frame): boolean => frame.baseline === undefined))
  assert.ok(
    frames.some(
      (frame): boolean =>
        frame.rowFromCalls.length > 0 && frame.dueCalls.length > 0,
    ),
  )
  const packed = packFrameWords(frames)
  const restored: unknown = jsonReload(packed)
  assert.deepEqual(unpackFrameWords(restored), frames)
  assert.ok(JSON.stringify(packed).length < JSON.stringify(frames).length)
})

test('ride and owner IEEE bit strings retain signed zero independently', (): void => {
  const [source] = frames
  assert.ok(source !== undefined)
  const frame = withRide(source)
  const packed = packFrameWords([frame, frame])
  const restored = unpackFrameWords(jsonReload(packed))
  assert.deepEqual(restored, [frame, frame])
  const [first] = restored
  assert.ok(first !== undefined)
  assert.ok(Object.is(unpackDoubles(first.owner)[0], -0))
})

test('missing, fractional and negative references refuse before timing', (): void => {
  for (const owner of [-1, 0.5, 999_999, '0']) {
    assert.throws(
      (): unknown =>
        unpackFrameWords({ version: 1, wordTable: [], frames: [{ owner }] }),
      /word reference/u,
    )
  }
  assert.throws((): unknown => packFrameWords([]), /actual captured frames/u)
  assert.throws(
    (): unknown => unpackFrameWords({ version: 1, wordTable: [], frames: [] }),
    /actual captured frames/u,
  )
})

test('a changed dictionary word fails frozen byte replay', (): void => {
  const packed = packFrameWords(frames)
  const words = packed.wordTable.map((word): string =>
    word === frames[0]?.owner ? packDoubles(new Float64Array([1])) : word,
  )
  assert.throws((): unknown =>
    unpackFrameWords({ ...packed, wordTable: words }),
  )
})

test('corrupt input cannot enter the dictionary without frozen replay', (): void => {
  const [source] = frames
  assert.ok(source !== undefined)
  assert.throws(
    (): unknown => packFrameWords([{ ...source, bytes: 'AAAA' }]),
    /differs from real bytes/u,
  )
})
