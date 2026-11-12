import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

import { MeshoptDecoder } from 'meshoptimizer/decoder'
import { MeshoptEncoder } from 'meshoptimizer/encoder'
import { describe, expect, test } from 'vitest'

import { meshoptDecoderFrom } from './meshopt-module.ts'
import { meshoptWasm } from './meshopt-wasm.ts'

import type { MeshoptInstance } from './meshopt-module.ts'

// AC6a: a Worker decodes meshopt GLB buffers through the committed .wasm and gets the decoder's own bytes.

const require = createRequire(import.meta.url)
const committed = new Uint8Array(
  readFileSync(new URL('meshopt-decoder.wasm', import.meta.url)),
)
const decoderPath = require
  .resolve('meshoptimizer/decoder')
  .replace(/\.cjs$/u, '.mjs')

interface WasmHost {
  readonly Instance: new (module: unknown, imports: object) => MeshoptInstance
  readonly Module: new (bytes: Readonly<Uint8Array>) => unknown
}
type Mode = 'ATTRIBUTES' | 'INDICES' | 'TRIANGLES'
type FilterName = 'EXPONENTIAL' | 'NONE' | 'OCTAHEDRAL' | 'QUATERNION'
interface Run {
  readonly mode: Mode
  readonly filter: FilterName
  readonly count: number
  readonly size: number
}

const RUNS: readonly Run[] = [
  { mode: 'ATTRIBUTES', filter: 'NONE', count: 300, size: 16 },
  { mode: 'ATTRIBUTES', filter: 'OCTAHEDRAL', count: 300, size: 8 },
  { mode: 'ATTRIBUTES', filter: 'QUATERNION', count: 128, size: 8 },
  { mode: 'ATTRIBUTES', filter: 'EXPONENTIAL', count: 64, size: 12 },
  { mode: 'TRIANGLES', filter: 'NONE', count: 300, size: 4 },
  { mode: 'INDICES', filter: 'NONE', count: 301, size: 2 },
]

function wasmHost(): WasmHost {
  // Node's types name no WebAssembly.Instance (standards/node.d.ts); the global has it.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the runtime global, typed for this test
  return (globalThis as unknown as Readonly<{ WebAssembly: WasmHost }>)
    .WebAssembly
}

/** Raw element bytes for one run: valid indices for index modes, noise for attributes. */
function rawBytes(run: Run): Uint8Array {
  const raw = new Uint8Array(run.count * run.size)
  for (let at = 0; at < run.count; at += 1) {
    if (run.mode === 'TRIANGLES') {
      new DataView(raw.buffer).setUint32(at * 4, Math.floor(at / 3) % 97, true)
    } else if (run.mode === 'INDICES') {
      new DataView(raw.buffer).setUint16(at * 2, (at * 7919) % 500, true)
    } else {
      raw.fill((at * 31) % 251, at * run.size, (at + 1) * run.size - 1)
    }
  }
  return raw
}

function staticDecoder(): ReturnType<typeof meshoptDecoderFrom> {
  const host = wasmHost()
  return meshoptDecoderFrom(new host.Instance(new host.Module(committed), {}))
}

/** One run through both decoders: whether they wrote the same bytes. */
function sameBytes(
  ours: ReturnType<typeof meshoptDecoderFrom>,
  run: Run,
): boolean {
  const encoded = MeshoptEncoder.encodeGltfBuffer(
    rawBytes(run),
    run.count,
    run.size,
    run.mode,
  )
  const theirs = new Uint8Array(run.count * run.size)
  const mine = new Uint8Array(run.count * run.size)
  MeshoptDecoder.decodeGltfBuffer(
    theirs,
    run.count,
    run.size,
    encoded,
    run.mode,
    run.filter,
  )
  ours.decodeGltfBuffer(
    mine,
    run.count,
    run.size,
    encoded,
    run.mode,
    run.filter,
  )
  return Buffer.from(mine).equals(theirs)
}

describe('the static meshopt decoder', (): void => {
  test("is the installed decoder's own module (rewrite it after a meshoptimizer bump)", (): void => {
    const installed = meshoptWasm(readFileSync(decoderPath, 'utf8'))
    expect(Buffer.from(committed).equals(installed)).toBe(true)
  })

  test('decodes every mode and filter to the bytes meshoptimizer/decoder gives', async (): Promise<void> => {
    await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready])
    const ours = staticDecoder()
    expect(RUNS.map((run: Run): boolean => sameBytes(ours, run))).toEqual(
      RUNS.map((): boolean => true),
    )
  })

  test('refuses a malformed buffer as the decoder does', (): void => {
    const ours = staticDecoder()
    const malformed = new Uint8Array([160, 1, 2])
    expect((): void => {
      ours.decodeGltfBuffer(
        new Uint8Array(64),
        16,
        4,
        malformed,
        'ATTRIBUTES',
        'NONE',
      )
    }).toThrow(/Malformed buffer data/u)
  })
})
