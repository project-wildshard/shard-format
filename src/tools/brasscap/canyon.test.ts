/* oxlint-disable eslint/max-lines-per-function, unicorn/number-literal-case, typescript/no-non-null-assertion, eslint/curly, eslint/id-length, eslint/sort-vars, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/no-unsafe-type-assertion -- A byte-level check of a generated GLB: indexed reads into typed arrays, like the generator it tests. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

import { buildCanyon, Geo } from './canyon.ts'

const COMMITTED = new URL(
  '../../../corpus/sources/brasscap-mesa/canyon.glb',
  import.meta.url,
)
const MIB = 1_048_576
const GLB_MAGIC = 0x46_54_6c_67
const JSON_CHUNK = 0x4e_4f_53_4a
const FLOAT = 5126
const HEADER = 12
const CHUNK_HEADER = 8
const UNIT_SLACK = 1e-5

interface Accessor {
  readonly bufferView: number
  readonly componentType: number
  readonly count: number
}
interface Gltf {
  readonly accessors: readonly Accessor[]
  readonly bufferViews: readonly { readonly byteOffset: number }[]
  readonly meshes: readonly {
    readonly primitives: readonly {
      readonly attributes: { readonly NORMAL: number }
    }[]
  }[]
  readonly nodes: readonly { readonly name: string }[]
}

function parse(file: Buffer): { json: Gltf; bin: Buffer } {
  assert.equal(file.readUInt32LE(0), GLB_MAGIC)
  assert.equal(file.readUInt32LE(8), file.length)
  const jsonLength = file.readUInt32LE(HEADER)
  assert.equal(file.readUInt32LE(HEADER + 4), JSON_CHUNK)
  const jsonStart = HEADER + CHUNK_HEADER,
    binStart = jsonStart + jsonLength + CHUNK_HEADER
  return {
    json: JSON.parse(
      file.subarray(jsonStart, jsonStart + jsonLength).toString(),
    ) as Gltf,
    bin: file.subarray(binStart),
  }
}

describe('the Brasscap Mesa canyon generator (BM-1)', (): void => {
  it('writes the same bytes every run, and the committed GLB is its output', (): void => {
    const first = buildCanyon()

    assert.ok(first.equals(buildCanyon()), 'two runs differ')
    assert.ok(
      first.equals(readFileSync(COMMITTED)),
      'corpus/sources/brasscap-mesa/canyon.glb is stale: run node src/tools/brasscap/canyon.ts',
    )
  })

  it('stays under 1 MiB', (): void => {
    assert.ok(buildCanyon().length < MIB)
  })

  it('names the empties the product rows point at', (): void => {
    const names = new Set(parse(buildCanyon()).json.nodes.map(n => n.name))

    for (const mark of [
      'spawn',
      'rack',
      'target.1',
      'target.2',
      'camp.1',
      'camp.2',
      'camp.3',
      'gate',
      'wyrm',
    ])
      assert.ok(names.has(mark), mark)
  })

  it('has only unit normals, so no triangle is degenerate', (): void => {
    const { json, bin } = parse(buildCanyon())

    for (const mesh of json.meshes) {
      const accessor = json.accessors[mesh.primitives[0]!.attributes.NORMAL]!
      assert.equal(accessor.componentType, FLOAT)
      const view = json.bufferViews[accessor.bufferView]!,
        normals = new Float32Array(
          bin.buffer.slice(
            bin.byteOffset + view.byteOffset,
            bin.byteOffset + view.byteOffset + accessor.count * 12,
          ),
        )
      for (let i = 0; i < normals.length; i += 3)
        assert.ok(
          Math.abs(
            Math.hypot(normals[i]!, normals[i + 1]!, normals[i + 2]!) - 1,
          ) < UNIT_SLACK,
          `normal ${i / 3} is not unit`,
        )
    }
  })

  it('faces box tops up and sides out, so single-sided faces are not culled', (): void => {
    const g = new Geo()
    g.box([0, 0, 0], [2, 1, 2], 0)
    const ys: number[] = []
    for (let i = 1; i < g.nor.length; i += 3) ys.push(g.nor[i]!)

    // Four sides of two triangles (three vertices each), then the four-triangle cap.
    assert.ok(ys.slice(0, 24).every(y => y === 0))
    assert.ok(ys.slice(24).every(y => y === 1))
    const x = g.nor[0]!,
      z = g.nor[2]!
    assert.equal(
      Math.sign(z) * Math.sign(g.pos[2]!),
      1,
      `side normal ${x},${z}`,
    )
  })
})
