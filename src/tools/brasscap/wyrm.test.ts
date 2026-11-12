/* oxlint-disable eslint/max-lines-per-function, typescript/no-non-null-assertion, eslint/curly, eslint/id-length, eslint/sort-vars, typescript/explicit-function-return-type, typescript/no-unsafe-type-assertion, typescript/prefer-readonly-parameter-types, eslint/max-statements, eslint/prefer-destructuring, eslint/no-plusplus -- A byte-level check of a generated GLB: indexed reads into typed arrays, like the generator it tests. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

import { parseGlbData } from '../../format/glbCost.ts'
import { parseSkinFile, validateSkinAssets } from '../../format/skinAssets.ts'
import {
  ATTACK_SPAN,
  WYRM_CLIPS,
  WYRM_ID,
  buildWyrm,
  buildWyrmSkin,
  sha256,
  wyrmTriangles,
} from './wyrm.ts'

const COMMITTED = new URL(
  '../../../corpus/sources/brasscap-mesa/wyrm.glb',
  import.meta.url,
)
const COMMITTED_SKIN = new URL(
  '../../../corpus/sources/brasscap-mesa/wyrm.skin.json',
  import.meta.url,
)
/** One boss on screen: well under a tile's prop budget (LF2-8's arched, plated body and open maw), and a small download. */
const MAX_TRIANGLES = 600
const MAX_BYTES = 96 * 1024
const JOINTS = ['body', 'neck', 'head', 'jaw']

interface Gltf {
  readonly accessors: readonly {
    readonly min?: readonly number[]
    readonly max?: readonly number[]
  }[]
  readonly meshes: readonly {
    readonly primitives: readonly {
      readonly attributes: { readonly POSITION: number }
    }[]
  }[]
  readonly nodes: readonly { readonly name: string; readonly skin?: number }[]
  readonly skins: readonly { readonly joints: readonly number[] }[]
  readonly animations: readonly {
    readonly name: string
    readonly channels: readonly {
      readonly sampler: number
      readonly target: { readonly node: number; readonly path: string }
    }[]
    readonly samplers: readonly { readonly input: number }[]
  }[]
}
function gltf(file: Buffer): Gltf {
  const length = file.readUInt32LE(12)
  return JSON.parse(file.subarray(20, 20 + length).toString()) as Gltf
}

describe('the Brasscap Dust Wyrm generator (BM-5)', (): void => {
  it('writes the same bytes every run, and the committed files are its output', (): void => {
    const first = buildWyrm()
    assert.ok(first.equals(buildWyrm()), 'two runs differ')
    assert.ok(
      first.equals(readFileSync(COMMITTED)),
      'corpus/sources/brasscap-mesa/wyrm.glb is stale: run node src/tools/brasscap/wyrm.ts',
    )
    assert.ok(
      buildWyrmSkin(first).equals(readFileSync(COMMITTED_SKIN)),
      'wyrm.skin.json is stale: run node src/tools/brasscap/wyrm.ts',
    )
  })

  it('stays under budget: low-poly, about 2 m tall at scale 1, its base on the ground', (): void => {
    const file = buildWyrm(),
      json = gltf(file),
      position =
        json.accessors[json.meshes[0]!.primitives[0]!.attributes.POSITION]!
    assert.ok(file.length < MAX_BYTES, `${file.length} bytes`)
    assert.ok(wyrmTriangles() < MAX_TRIANGLES, `${wyrmTriangles()}`)
    assert.equal(parseGlbData(file).triangles, wyrmTriangles())
    assert.equal(position.min![1], 0)
    assert.ok(position.max![1]! > 1.8 && position.max![1]! < 2.2)
  })

  it('has one skin over body, neck, head and jaw, and rise, burst and open clips on every joint', (): void => {
    const json = gltf(buildWyrm())
    assert.equal(json.nodes.filter(n => n.skin !== undefined).length, 1)
    assert.deepEqual(
      json.skins[0]!.joints.map(j => json.nodes[j]!.name),
      JOINTS,
    )
    assert.deepEqual(
      json.animations.map(a => a.name),
      [...WYRM_CLIPS],
    )
    for (const name of ['attack.rise', 'attack.burst', 'attack.open'])
      assert.ok(WYRM_CLIPS.includes(name as never), name)
    for (const clip of json.animations)
      assert.deepEqual(
        clip.channels.map(c => `${c.target.node}.${c.target.path}`).toSorted(),
        [1, 2, 3, 4].flatMap(n => [`${n}.rotation`, `${n}.translation`]),
      )
    // `attack` is rise then burst end to end, as long as the look's attackSpan
    const attack = json.animations.find(a => a.name === 'attack')!,
      parts = ['attack.rise', 'attack.burst'].map(name =>
        json.animations.find(a => a.name === name)!,
      ),
      end = (clip: (typeof json.animations)[number]): number =>
        json.accessors[clip.samplers[0]!.input]!.max![0]!
    assert.ok(Math.abs(end(attack) - ATTACK_SPAN) < 1e-5)
    assert.ok(
      Math.abs(parts.reduce((sum, clip) => sum + end(clip), 0) - ATTACK_SPAN) <
        1e-5,
    )
  })

  it('is a skin file the format admits as a platform.skin look', (): void => {
    const glb = buildWyrm(),
      skin = buildWyrmSkin(glb),
      { row, binding } = parseSkinFile(skin),
      cost = parseGlbData(glb)
    assert.equal(row.id, WYRM_ID)
    assert.equal(row.file, sha256(glb))
    assert.equal(binding.skin, WYRM_ID)
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
      id: 'brasscap.wyrm.look',
      species: WYRM_ID,
      recipe: 'platform.skin',
      material: JSON.parse('null') as null,
      parameters: { skin: sha256(skin) },
      animation: {
        recipe: 'platform.clips',
        parameters: { attackSpan: ATTACK_SPAN },
      },
    }
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
  it("binds every vertex wholly to one joint, and the jaw carries the maw's lower lip (LF2-8)", (): void => {
    const file = buildWyrm(),
      length = file.readUInt32LE(12),
      json = JSON.parse(file.subarray(20, 20 + length).toString()) as {
        accessors: {
          bufferView: number
          count: number
          componentType: number
          normalized?: boolean
        }[]
        bufferViews: { byteOffset: number }[]
        meshes: { primitives: { attributes: Record<string, number> }[] }[]
      },
      bin = file.subarray(28 + length),
      attributes = json.meshes[0]!.primitives[0]!.attributes,
      joints = json.accessors[attributes['JOINTS_0']!]!,
      weights = json.accessors[attributes['WEIGHTS_0']!]!
    assert.equal(joints.componentType, 5121)
    assert.equal(weights.componentType, 5121)
    assert.equal(weights.normalized, true)
    const jointAt = json.bufferViews[joints.bufferView]!.byteOffset,
      weightAt = json.bufferViews[weights.bufferView]!.byteOffset
    let jaw = 0
    for (let v = 0; v < joints.count; v++) {
      assert.ok(bin[jointAt + v * 4]! < 4)
      assert.deepEqual(
        [...bin.subarray(weightAt + v * 4, weightAt + v * 4 + 4)],
        [255, 0, 0, 0],
      )
      if (bin[jointAt + v * 4] === 3) jaw++
    }
    // The rim's three faces below the mouth's axis (6 triangles) and the four lower teeth (16).
    assert.equal(jaw / 3, 22)
  })
})
