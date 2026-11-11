import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

import { receiverBase } from '../bench/capture/prepared-frame.ts'
import { readSessionArchive } from '../bench/capture/session-archive.ts'
import { BitWriter as V0Writer } from '../frozen/v0/bits.ts'
import { decodeFrame, encodeFrame } from '../frozen/v0/frame.ts'
import { columnsOf, replay } from './helpers/snapshot.ts'

import type { CapturedFrame } from '../bench/capture/frame-data.ts'
import type { DecodedFrame } from '../frozen/v0/frame.ts'

// WR4: replayed through the v1 snapshot codec, real recorded frames decode to
// exactly the rows, owner block, ride, freshness and baseline v0 decodes.

async function recordedFrames(name: string): Promise<readonly CapturedFrame[]> {
  const dir = new URL(`../bench/recordings/${name}/`, import.meta.url)
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

/* oxlint-disable typescript/prefer-readonly-parameter-types -- frozen v0's frame API takes mutable inputs */
function v0Decode(
  record: CapturedFrame,
  input: ReturnType<typeof replay>['input'],
): DecodedFrame | null {
  const base = receiverBase(record)
  const bytes = new Uint8Array(encodeFrame(new V0Writer(), input))
  return decodeFrame(bytes, {
    ownerClass: input.ownerClass,
    classOf: input.classOf,
    baseline: (): DecodedFrame | null => base,
  })
}
/* oxlint-enable typescript/prefer-readonly-parameter-types */

for (const name of ['ride', 'fight', 'walking']) {
  test(`every ${name} frame decodes in v1 as it does in v0`, async (): Promise<void> => {
    const frames = await recordedFrames(name)
    assert.ok(frames.length > 100)
    for (const record of frames) {
      const { input, raw } = replay(record)
      const v0 = v0Decode(record, input)
      assert.ok(v0 && raw)
      // oxlint-disable-next-line unicorn/no-null -- v0 says null for no ride
      assert.deepEqual({ ...raw, ride: raw.ride?.words ?? null }, { ...v0 })
    }
  })
}

test('the v1 owner block keeps every f64 bit of mounted play', async (): Promise<void> => {
  const frames = await recordedFrames('ride')
  let mounted = 0
  for (const record of frames) {
    const { input, raw } = replay(record)
    assert.ok(raw)
    assert.deepEqual([...raw.owner], [...input.owner])
    mounted += raw.ride === undefined ? 0 : 1
  }
  assert.ok(mounted > 100)
})

test('the player owner block holds at least six doubles', async (): Promise<void> => {
  const [first] = await recordedFrames('ride')
  assert.ok(first)
  const { owner } = columnsOf(replay(first).input.ownerClass)
  const doubles = owner.filter(
    (column: { readonly bits: number }): boolean => column.bits === 64,
  )
  assert.ok(doubles.length >= 6)
})
