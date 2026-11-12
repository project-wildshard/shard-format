/* oxlint-disable eslint/max-lines-per-function, typescript/no-non-null-assertion, eslint/curly, eslint/id-length, eslint/sort-vars, typescript/explicit-function-return-type, typescript/no-unsafe-type-assertion, typescript/prefer-readonly-parameter-types -- A byte-level check of a generated GLB: indexed reads into typed arrays, like the generator it tests. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

import { parseGlbData } from '../../format/glbCost.ts'
import { parseSkinFile, validateSkinAssets } from '../../format/skinAssets.ts'
import {
  BANDIT_CLIPS,
  BANDIT_ID,
  banditTriangles,
  buildBandit,
  buildBanditSkin,
  sha256,
} from './bandit.ts'

const COMMITTED = new URL(
  '../../../corpus/sources/brasscap-mesa/bandit.glb',
  import.meta.url,
)
const COMMITTED_SKIN = new URL(
  '../../../corpus/sources/brasscap-mesa/bandit.skin.json',
  import.meta.url,
)
const HEADER = 12
const CHUNK_HEADER = 8
const UNIT_SLACK = 1e-5
/** Nine bandits on screen at once: each a fraction of one tile's prop budget. */
const MAX_TRIANGLES = 400
const MAX_BYTES = 96 * 1024

interface Accessor {
  readonly bufferView: number
  readonly count: number
  readonly byteOffset?: number
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
  readonly nodes: readonly { readonly name: string; readonly skin?: number }[]
  readonly skins: readonly { readonly joints: readonly number[] }[]
  readonly animations: readonly {
    readonly name: string
    readonly channels: readonly {
      readonly target: { readonly node: number; readonly path: string }
    }[]
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

describe('the Brasscap tin bandit generator (BM-4)', (): void => {
  it('writes the same bytes every run, and the committed files are its output', (): void => {
    const first = buildBandit()

    assert.ok(first.equals(buildBandit()), 'two runs differ')
    assert.ok(
      first.equals(readFileSync(COMMITTED)),
      'corpus/sources/brasscap-mesa/bandit.glb is stale: run node src/tools/brasscap/bandit.ts',
    )
    assert.ok(
      buildBanditSkin(first).equals(readFileSync(COMMITTED_SKIN)),
      'corpus/sources/brasscap-mesa/bandit.skin.json is stale: run node src/tools/brasscap/bandit.ts',
    )
  })

  it('stays a low-poly creature, about 1.4 m tall, feet on the ground', (): void => {
    const file = buildBandit(),
      { json } = parse(file),
      position =
        json.accessors[json.meshes[0]!.primitives[0]!.attributes.POSITION]!

    assert.ok(file.length < MAX_BYTES, `${file.length} bytes`)
    assert.ok(banditTriangles() < MAX_TRIANGLES, `${banditTriangles()}`)
    assert.equal(parseGlbData(file).triangles, banditTriangles())
    assert.equal(position.min![1], 0)
    assert.ok(position.max![1]! > 1.3 && position.max![1]! < 1.5)
  })

  it('has one skin over body then head, and the five clips on both joints', (): void => {
    const { json } = parse(buildBandit()),
      skinned = json.nodes.filter(n => n.skin !== undefined)

    assert.equal(skinned.length, 1)
    assert.deepEqual(
      json.skins[0]!.joints.map(j => json.nodes[j]!.name),
      ['body', 'head'],
    )
    assert.deepEqual(
      json.animations.map(a => a.name),
      [...BANDIT_CLIPS],
    )
    // Every clip sets both joints' translation and rotation, so no clip's pose leaks into the next
    for (const clip of json.animations)
      assert.deepEqual(
        clip.channels.map(c => `${c.target.node}.${c.target.path}`).toSorted(),
        ['1.rotation', '1.translation', '2.rotation', '2.translation'],
      )
  })

  it('has unit normals that agree with each triangle’s winding', (): void => {
    const { json, bin } = parse(buildBandit())

    for (const p of json.meshes[0]!.primitives) {
      const pos = floats(json, bin, p.attributes.POSITION),
        nor = floats(json, bin, p.attributes.NORMAL)
      for (let i = 0; i < nor.length; i += 3)
        assert.ok(
          Math.abs(Math.hypot(nor[i]!, nor[i + 1]!, nor[i + 2]!) - 1) <
            UNIT_SLACK,
          `normal ${i / 3} is not unit`,
        )
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

  it('is a skin file the format admits as a platform.skin look', (): void => {
    const glb = buildBandit(),
      skin = buildBanditSkin(glb),
      { row, binding } = parseSkinFile(skin),
      cost = parseGlbData(glb)

    assert.equal(row.id, BANDIT_ID)
    assert.equal(row.file, sha256(glb))
    assert.equal(binding.skin, BANDIT_ID)
    assert.deepEqual(row.rig.clips, [...BANDIT_CLIPS])
    const files = [
      {
        hash: sha256(skin),
        kind: 'json',
        dependencies: [row.file],
        decoded: skin.length,
        gpu: 0,
        triangles: 0,
        draws: 0,
      },
      {
        hash: row.file,
        kind: 'glb',
        dependencies: [],
        decoded: cost.decoded,
        gpu: cost.gpu,
        triangles: cost.triangles,
        draws: cost.draws,
      },
    ]
    const look = {
      id: 'brasscap.look.bandit',
      species: BANDIT_ID,
      recipe: 'platform.skin',
      material: JSON.parse('null') as null,
      parameters: { skin: sha256(skin) },
      animation: { recipe: 'platform.clips', parameters: { attackSpan: 0.6 } },
    }
    // The format's own admission: rig bytes (one skinned mesh, joint order, sockets, clips), body and head bones,
    // the binding's material and the declared cost
    validateSkinAssets(
      {
        rows: { looks: [look] },
        files,
        look: { materials: { glow: { family: 'emissive' } } },
      } as unknown as Parameters<typeof validateSkinAssets>[0],
      new Map([
        [sha256(skin), new Uint8Array(skin)],
        [row.file, new Uint8Array(glb)],
      ]),
    )
  })
})
