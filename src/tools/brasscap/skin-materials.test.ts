/* oxlint-disable eslint/max-lines-per-function, typescript/no-non-null-assertion, eslint/id-length, typescript/no-unsafe-type-assertion, typescript/prefer-readonly-parameter-types, eslint/max-statements, typescript/explicit-function-return-type, eslint/sort-vars, unicorn/numeric-separators-style, unicorn/number-literal-case -- A byte-level rewrite of a generated GLB JSON chunk, like the generators it reuses. */
// TE-ENG10 (meta TEMPLATE-E2E-PLAN): a skin look may map a GLB material name to a look material, as props.materials does.
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { parseGlbData } from '../../format/glbCost.ts'
import { skinLookMaterialRules } from '../../format/skin-materials.ts'
import { skinLookRules, validateSkinAssets } from '../../format/skinAssets.ts'
import { ATTACK_SPAN, buildWyrm, buildWyrmSkin, sha256 } from './wyrm.ts'

/** The Wyrm with a second primitive over the same accessors, drawn in a second GLB material named `name`. */
function withPart(
  glb: Buffer,
  name: string,
  channels?: (attributes: Record<string, number>) => Record<string, number>,
): Buffer {
  const length = glb.readUInt32LE(12),
    json = JSON.parse(glb.subarray(20, 20 + length).toString('utf8')) as {
      meshes: {
        primitives: { attributes: Record<string, number>; material?: number }[]
      }[]
      materials: { name: string }[]
    },
    bin = glb.subarray(20 + length + 8),
    first = json.meshes[0]!.primitives[0]!
  json.materials.push({ name })
  json.meshes[0]!.primitives.push({
    ...first,
    attributes: channels?.(first.attributes) ?? first.attributes,
    material: json.materials.length - 1,
  })
  let text = Buffer.from(JSON.stringify(json))
  text = Buffer.concat([text, Buffer.alloc((4 - (text.length % 4)) % 4, 0x20)])
  const header = Buffer.alloc(12),
    jh = Buffer.alloc(8),
    bh = Buffer.alloc(8)
  header.writeUInt32LE(0x46546c67, 0)
  header.writeUInt32LE(2, 4)
  header.writeUInt32LE(12 + 8 + text.length + 8 + bin.length, 8)
  jh.writeUInt32LE(text.length, 0)
  jh.writeUInt32LE(0x4e4f534a, 4)
  bh.writeUInt32LE(bin.length, 0)
  bh.writeUInt32LE(0x004e4942, 4)
  return Buffer.concat([header, jh, text, bh, bin])
}

function source(glb: Buffer, parameters: Record<string, unknown>) {
  const skin = buildWyrmSkin(glb),
    cost = parseGlbData(glb),
    file = sha256(glb),
    look = {
      id: 'brasscap.wyrm.look',
      species: 'brasscap.wyrm',
      recipe: 'platform.skin',
      material: JSON.parse('null') as null,
      parameters: { skin: sha256(skin), ...parameters },
      animation: {
        recipe: 'platform.clips',
        parameters: { attackSpan: ATTACK_SPAN },
      },
    },
    files = [
      {
        hash: sha256(skin),
        kind: 'json',
        dependencies: [file],
        decoded: skin.length,
        gpu: 0,
        triangles: 0,
        draws: 0,
      },
      {
        hash: file,
        kind: 'glb',
        dependencies: [],
        decoded: cost.decoded,
        gpu: cost.gpu,
        triangles: cost.triangles,
        draws: cost.draws,
      },
    ],
    shard = {
      rows: { looks: [look] },
      files,
      library: files.map(row => row.hash),
      look: { materials: { 'brasscap.gullet': { family: 'emissive' } } },
    }
  return {
    shard: shard as unknown as Parameters<typeof validateSkinAssets>[0] &
      Parameters<typeof skinLookRules>[0] &
      Parameters<typeof skinLookMaterialRules>[0],
    assets: new Map([
      [sha256(skin), new Uint8Array(skin)],
      [file, new Uint8Array(glb)],
    ]),
  }
}

describe('skin look materials (TE-ENG10)', (): void => {
  it('admits a two-material skin whose look maps the second GLB material to a declared look material', (): void => {
    const { shard, assets } = source(withPart(buildWyrm(), 'Gullet'), {
      materials: { Gullet: 'brasscap.gullet' },
    })
    assert.deepEqual(skinLookRules(shard), [])
    validateSkinAssets(shard, assets)
  })
  it('still admits a one-material skin with no map, and a two-material skin with none (one draw, the family)', (): void => {
    for (const glb of [buildWyrm(), withPart(buildWyrm(), 'Gullet')]) {
      const { shard, assets } = source(glb, {})
      assert.deepEqual(skinLookRules(shard), [])
      validateSkinAssets(shard, assets)
    }
  })
  it('refuses a mapped name the GLB lacks, an undeclared look material, and primitives whose channels differ', (): void => {
    const missing = source(buildWyrm(), {
      materials: { Gullet: 'brasscap.gullet' },
    })
    assert.throws(() => {
      validateSkinAssets(missing.shard, missing.assets)
    }, /no GLB material Gullet/u)
    const undeclared = source(withPart(buildWyrm(), 'Gullet'), {
      materials: { Gullet: 'brasscap.nowhere' },
    })
    assert.deepEqual(skinLookMaterialRules(undeclared.shard), [
      'skin look materials name declared look.materials',
    ])
    const channels = source(
      withPart(buildWyrm(), 'Gullet', ({ COLOR_0: _colour, ...rest }) => rest),
      {},
    )
    assert.throws(() => {
      validateSkinAssets(channels.shard, channels.assets)
    }, /differ in their channels/u)
    for (const materials of [
      {},
      { Gullet: 'Bad Id' },
      Object.fromEntries(
        Array.from({ length: 8 }, (_, i) => [
          `Part ${String(i)}`,
          'brasscap.gullet',
        ]),
      ),
    ]) {
      const bad = source(withPart(buildWyrm(), 'Gullet'), { materials })
      assert.deepEqual(skinLookRules(bad.shard), ['skin look parameters'])
    }
  })
})
