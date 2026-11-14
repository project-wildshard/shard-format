/* oxlint-disable eslint/max-lines-per-function, typescript/no-non-null-assertion, eslint/id-length, typescript/no-unsafe-type-assertion, typescript/prefer-readonly-parameter-types, eslint/max-statements, typescript/explicit-function-return-type, eslint/sort-vars, unicorn/numeric-separators-style, unicorn/number-literal-case -- A byte-level rewrite of a generated GLB JSON chunk, like the generators it reuses. */
// TE-ENG10 (meta TEMPLATE-E2E-PLAN): a skin look may map a GLB material name to a look material, as props.materials does.
// SS4 (J342): the bandit and the Wyrm come from Brasscap's export (corpus/exports/brasscap-mesa/), not a generator here.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'

import { parseGlbData } from '../format/glbCost.ts'
import { skinLookRules, validateSkinAssets } from '../format/skinAssets.ts'
import { ROOT, sha256 } from '../test/helpers/corpus.ts'

const BRASSCAP = path.join(ROOT, 'corpus/exports/brasscap-mesa')
/** The Wyrm's `platform.clips` attack span, as the export's look holds it. */
const ATTACK_SPAN = 1.5

interface SkinFile {
  row: { cost: Record<string, number>; file: string }
  binding: Record<string, unknown>
}

/** The exported skin file of `species`, read through its `platform.skin` look. */
function exportedSkin(species: string): SkinFile {
  const { rows } = JSON.parse(
    readFileSync(path.join(BRASSCAP, 'sections/look/materials.json'), 'utf8'),
  ) as { rows: { looks: { species: string; parameters: { skin: string } }[] } }
  const look = rows.looks.find(row => row.species === species)!
  return JSON.parse(
    readFileSync(
      path.join(BRASSCAP, 'blobs/json', `${look.parameters.skin}.json`),
      'utf8',
    ),
  ) as SkinFile
}

/** The exported GLB that `species`'s skin file draws. */
function exportedGlb(species: string): Buffer {
  return readFileSync(
    path.join(BRASSCAP, 'blobs/glb', `${exportedSkin(species).row.file}.glb`),
  )
}

/** `species`'s exported skin file, its row pointed at (and costed for) `glb`, as the generators write it. */
function skinOf(species: string): (glb: Buffer) => Buffer {
  return (glb: Buffer): Buffer => {
    const file = exportedSkin(species),
      cost = parseGlbData(glb)
    file.row.file = sha256(glb)
    file.row.cost = {
      decoded: cost.decoded,
      draws: cost.draws,
      gpu: cost.gpu,
      triangles: cost.triangles,
    }
    return Buffer.from(JSON.stringify(file))
  }
}
const buildWyrm = (): Buffer => exportedGlb('brasscap.wyrm'),
  buildWyrmSkin = skinOf('brasscap.wyrm'),
  buildBandit = (): Buffer => exportedGlb('brasscap.bandit'),
  buildBanditSkin = skinOf('brasscap.bandit')

interface Json {
  meshes: {
    primitives: { attributes: Record<string, number>; material?: number }[]
  }[]
  materials: { name: string }[]
}

/** `glb` with its JSON chunk edited in place by `edit`; the binary chunk is kept. */
function rewrite(glb: Buffer, edit: (json: Json) => void): Buffer {
  const length = glb.readUInt32LE(12),
    json = JSON.parse(glb.subarray(20, 20 + length).toString('utf8')) as Json,
    bin = glb.subarray(20 + length + 8)
  edit(json)
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

/** The Wyrm with a second primitive over the same accessors, drawn in a second GLB material named `name`. */
function withPart(
  glb: Buffer,
  name: string,
  channels?: (attributes: Record<string, number>) => Record<string, number>,
): Buffer {
  return rewrite(glb, (json): void => {
    const first = json.meshes[0]!.primitives[0]!
    json.materials.push({ name })
    json.meshes[0]!.primitives.push({
      ...first,
      attributes: channels?.(first.attributes) ?? first.attributes,
      material: json.materials.length - 1,
    })
  })
}

/** The Wyrm's body alone: its `Gullet` part and material dropped, so one primitive in one material. */
function bodyOnly(glb: Buffer): Buffer {
  return rewrite(glb, (json): void => {
    json.meshes[0]!.primitives.length = 1
    json.materials.length = 1
  })
}

const wyrmBody = (): Buffer => bodyOnly(buildWyrm())

/** The Wyrm's skin file for `glb`, its binding carrying `materials` when given. */
function skinFile(glb: Buffer, materials?: unknown): Buffer {
  const file = JSON.parse(buildWyrmSkin(glb).toString('utf8')) as {
    binding: Record<string, unknown>
  }
  if (materials === undefined) {
    delete file.binding['materials']
  } else {
    file.binding['materials'] = materials
  }
  return Buffer.from(JSON.stringify(file))
}

function source(glb: Buffer, materials?: unknown) {
  const skin = skinFile(glb, materials),
    cost = parseGlbData(glb),
    file = sha256(glb),
    look = {
      id: 'brasscap.wyrm.look',
      species: 'brasscap.wyrm',
      recipe: 'platform.skin',
      material: JSON.parse('null') as null,
      parameters: { skin: sha256(skin) },
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
      look: {
        materials: {
          'brasscap.gullet': { family: 'emissive' },
          'brasscap.graph': { family: 'graph' },
        },
      },
    }
  return {
    shard: shard as unknown as Parameters<typeof validateSkinAssets>[0] &
      Parameters<typeof skinLookRules>[0],
    assets: new Map([
      [sha256(skin), new Uint8Array(skin)],
      [file, new Uint8Array(glb)],
    ]),
  }
}

describe('skin binding materials (TE-ENG10)', (): void => {
  it("draws the bandit's eye and the Wyrm's gullet as a second GLB part, mapped to the look's glow", (): void => {
    for (const [glb, skinFor, part, corners] of [
      [buildBandit(), buildBanditSkin, 'Eye', 48],
      [buildWyrm(), buildWyrmSkin, 'Gullet', 24],
    ] as const) {
      const length = glb.readUInt32LE(12),
        json = JSON.parse(glb.subarray(20, 20 + length).toString('utf8')) as {
          accessors: { count: number }[]
          meshes: { primitives: { indices: number; material: number }[] }[]
          materials: { name: string }[]
        },
        [, glow] = json.meshes[0]!.primitives,
        skin = JSON.parse(skinFor(glb).toString('utf8')) as {
          binding: { materials: Record<string, string> }
        }
      assert.equal(json.meshes[0]!.primitives.length, 2)
      assert.equal(json.materials[glow!.material]!.name, part)
      assert.equal(json.accessors[glow!.indices]!.count, corners)
      assert.deepEqual(skin.binding.materials, { [part]: 'glow' })
    }
  })
  it('admits a two-material skin whose binding maps the second GLB material to a declared look material', (): void => {
    const { shard, assets } = source(withPart(wyrmBody(), 'Gullet'), {
      Gullet: 'brasscap.gullet',
    })
    assert.deepEqual(skinLookRules(shard), [])
    validateSkinAssets(shard, assets)
  })
  it('still admits a one-material skin with no map, and a two-material skin with none (one draw, the family)', (): void => {
    for (const glb of [wyrmBody(), withPart(wyrmBody(), 'Gullet')]) {
      const { shard, assets } = source(glb)
      assert.deepEqual(skinLookRules(shard), [])
      validateSkinAssets(shard, assets)
    }
  })
  it('refuses a mapped name the GLB lacks, an undeclared look material, and primitives whose channels differ', (): void => {
    const missing = source(wyrmBody(), {
      Gullet: 'brasscap.gullet',
    })
    assert.throws(() => {
      validateSkinAssets(missing.shard, missing.assets)
    }, /no GLB material Gullet/u)
    const undeclared = source(withPart(wyrmBody(), 'Gullet'), {
      Gullet: 'brasscap.nowhere',
    })
    assert.throws(() => {
      validateSkinAssets(undeclared.shard, undeclared.assets)
    }, /brasscap.nowhere is not a declared look material/u)
    const graph = source(withPart(wyrmBody(), 'Gullet'), {
      Gullet: 'brasscap.graph',
    })
    assert.throws(() => {
      validateSkinAssets(graph.shard, graph.assets)
    }, /brasscap.graph is a graph material/u)
    const channels = source(
      withPart(wyrmBody(), 'Gullet', ({ COLOR_0: _colour, ...rest }) => rest),
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
      const bad = source(withPart(wyrmBody(), 'Gullet'), materials)
      assert.throws(() => {
        validateSkinAssets(bad.shard, bad.assets)
      }, /skin bindings/u)
    }
  })
})
