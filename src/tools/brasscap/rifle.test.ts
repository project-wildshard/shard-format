/* oxlint-disable eslint/max-lines-per-function, typescript/no-non-null-assertion, eslint/curly, eslint/id-length, eslint/sort-vars, typescript/explicit-function-return-type, typescript/no-unsafe-type-assertion, typescript/prefer-readonly-parameter-types -- A byte-level check of a generated GLB: indexed reads into typed arrays, like the generator it tests. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

import { buildRifle, MUZZLE, rifleTriangles } from './rifle.ts'

const COMMITTED = new URL(
  '../../../corpus/sources/brasscap-mesa/rifle.glb',
  import.meta.url,
)
const HEADER = 12
const CHUNK_HEADER = 8
const UNIT_SLACK = 1e-5
/** A held item's share of a phone frame: well under one tile's prop budget. */
const MAX_TRIANGLES = 1500
const MAX_BYTES = 96 * 1024

interface Accessor {
  readonly bufferView: number
  readonly count: number
  readonly min?: readonly number[]
  readonly max?: readonly number[]
}
interface Gltf {
  readonly accessors: readonly Accessor[]
  readonly bufferViews: readonly { readonly byteOffset: number }[]
  readonly meshes: readonly {
    readonly primitives: readonly {
      readonly attributes: {
        readonly POSITION: number
        readonly NORMAL: number
      }
    }[]
  }[]
  readonly nodes: readonly {
    readonly name: string
    readonly translation?: readonly number[]
  }[]
}

function parse(file: Buffer): { json: Gltf; bin: Buffer } {
  const jsonLength = file.readUInt32LE(HEADER),
    jsonStart = HEADER + CHUNK_HEADER,
    binStart = jsonStart + jsonLength + CHUNK_HEADER
  return {
    json: JSON.parse(
      file.subarray(jsonStart, jsonStart + jsonLength).toString(),
    ) as Gltf,
    bin: file.subarray(binStart),
  }
}
function floats(json: Gltf, bin: Buffer, index: number): Float32Array {
  const accessor = json.accessors[index]!,
    view = json.bufferViews[accessor.bufferView]!
  return new Float32Array(
    bin.buffer.slice(
      bin.byteOffset + view.byteOffset,
      bin.byteOffset + view.byteOffset + accessor.count * 12,
    ),
  )
}

describe('the Brasscap lever-action generator (BM-3)', (): void => {
  it('writes the same bytes every run, and the committed GLB is its output', (): void => {
    const first = buildRifle()

    assert.ok(first.equals(buildRifle()), 'two runs differ')
    assert.ok(
      first.equals(readFileSync(COMMITTED)),
      'corpus/sources/brasscap-mesa/rifle.glb is stale: run node src/tools/brasscap/rifle.ts',
    )
  })

  it('stays a low-poly held item', (): void => {
    assert.ok(buildRifle().length < MAX_BYTES)
    assert.ok(rifleTriangles() < MAX_TRIANGLES, `${rifleTriangles()}`)
  })

  it('puts the muzzle empty at the forward tip of the rifle', (): void => {
    const { json } = parse(buildRifle()),
      muzzle = json.nodes.find(n => n.name === 'muzzle')

    assert.deepEqual(muzzle?.translation, [...MUZZLE])
    for (const name of ['grip', 'fore'])
      assert.ok(
        json.nodes.some(n => n.name === name),
        name,
      )
    const lowest = Math.min(
      ...json.meshes[0]!.primitives.map(
        p => json.accessors[p.attributes.POSITION]!.min![2]!,
      ),
    )
    assert.ok(Math.abs(lowest - MUZZLE[2]) < 1e-6, `front is ${lowest}`)
  })

  it('has unit normals that face out of each part', (): void => {
    const { json, bin } = parse(buildRifle())

    for (const p of json.meshes[0]!.primitives) {
      const pos = floats(json, bin, p.attributes.POSITION),
        nor = floats(json, bin, p.attributes.NORMAL)
      for (let i = 0; i < nor.length; i += 3)
        assert.ok(
          Math.abs(Math.hypot(nor[i]!, nor[i + 1]!, nor[i + 2]!) - 1) <
            UNIT_SLACK,
          `normal ${i / 3} is not unit`,
        )
      // Every triangle's normal agrees with its winding (the renderer culls by winding).
      for (let t = 0; t < pos.length; t += 9) {
        const u = [0, 1, 2].map(k => pos[t + 3 + k]! - pos[t + k]!),
          w = [0, 1, 2].map(k => pos[t + 6 + k]! - pos[t + k]!)
        const n = [
          u[1]! * w[2]! - u[2]! * w[1]!,
          u[2]! * w[0]! - u[0]! * w[2]!,
          u[0]! * w[1]! - u[1]! * w[0]!,
        ]
        assert.ok(
          n[0]! * nor[t]! + n[1]! * nor[t + 1]! + n[2]! * nor[t + 2]! > 0,
          `triangle ${t / 9}`,
        )
      }
    }
  })
})
