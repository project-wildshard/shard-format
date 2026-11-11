import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

import { inputOf } from '../bench/capture/prepared-frame.ts'
import { readSessionArchive } from '../bench/capture/session-archive.ts'
import { snapshotInput } from '../bench/capture/v1-frames.ts'
import { BitWriter as V0Writer } from '../frozen/v0/bits.ts'
import { encodeFrame as v0Frame } from '../frozen/v0/frame.ts'
import { bitSink } from '../src/bits.ts'
import { encodeSnapshot } from '../src/snapshot-encode.ts'

// WR4's Opus review: every v1 frame body is v0's bits exactly, after v0's
// message byte, once the 8-bit ride field holds what v0 put there (the word
// count, 38) instead of the law id. This pins row order, not just contents.

const WORDS = 38

type Frames = Awaited<ReturnType<typeof readSessionArchive>>['frames']

async function recorded(name: string): Promise<Frames> {
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

function body(input: ReturnType<typeof snapshotInput>): number[] {
  const writer = bitSink()
  const counted =
    input.ride === undefined
      ? input
      : { ...input, ride: { ...input.ride, law: WORDS } }
  encodeSnapshot(writer, counted)
  return [...writer.take()]
}

for (const name of ['ride', 'fight', 'walking']) {
  test(`every ${name} v1 body is v0's bits after its message byte`, async (): Promise<void> => {
    for (const record of await recorded(name)) {
      const input = inputOf(record)
      const v0 = new Uint8Array(v0Frame(new V0Writer(4096), input))
      assert.deepEqual(body(snapshotInput(input)), [...v0.subarray(1)])
    }
  })
}
