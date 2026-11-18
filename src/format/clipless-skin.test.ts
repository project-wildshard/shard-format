import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

import {
  array,
  number,
  object,
  optional,
  parse,
  string,
  unknown,
} from 'valibot'
import { expect, test } from 'vitest'

import { fixture } from '../ci/skin-variants-fixture.ts'
import { parseRows } from './rows.ts'
import { parseGlb, prepareAssetDecoders } from './shardfile-assets.ts'
import {
  parseSkinFile,
  skinLookParameters,
  validateSkinAssets,
} from './skinAssets.ts'
import {
  parseSkinRows,
  parseSkinBindings,
  SkinClipNameSchema,
} from './skinData.ts'

const hash = (bytes: Readonly<Uint8Array>): string =>
  createHash('sha256').update(bytes).digest('hex')
const glb = new Uint8Array(
  readFileSync(new URL('../test/fixtures/clipless-biped.glb', import.meta.url)),
)
const length = new DataView(glb.buffer).getUint32(12, true)
const nodeSchema = object({ name: optional(string()) })
const skinSchema = object({ joints: array(number()) })
const animationsSchema = optional(array(unknown()), [])
const documentSchema = object({
  nodes: array(nodeSchema),
  skins: array(skinSchema),
  animations: animationsSchema,
})
const json = new TextDecoder().decode(glb.subarray(20, 20 + length))
const rig = parse(documentSchema, JSON.parse(json))
const names = rig.skins[0]?.joints.map(
  (index): string | undefined => rig.nodes[index]?.name,
)
await prepareAssetDecoders()
const cost = parseGlb(glb)
const row = {
  id: 'kit.biped',
  file: hash(glb),
  family: 'pbr',
  cost,
  rig: { skeleton: 'kit.biped', joints: [names], sockets: names, clips: [] },
}
const binding = {
  skin: 'kit.biped',
  material: { family: 'pbr', vertexColours: true },
  loops: [],
}

test('a real clipless Kit skin admits through metadata and actual asset validation', (): void => {
  expect(rig.animations).toEqual([])
  const metadata = new TextEncoder().encode(JSON.stringify({ row, binding }))
  const skin = hash(metadata)
  const file = hash(glb)
  expect(parseSkinFile(metadata).row.rig.clips).toEqual([])
  const rows = parseRows({
    ...fixture().source.rows,
    looks: [
      {
        ...fixture().look,
        id: 'kit.look',
        parameters: { skin },
        animation: { recipe: 'platform.clips', parameters: { attackSpan: 1 } },
      },
    ],
  })
  validateSkinAssets(
    {
      rows,
      files: [
        {
          hash: file,
          kind: 'glb',
          compressed: glb.length,
          ...cost,
          dependencies: [],
          critical: false,
        },
        {
          hash: skin,
          kind: 'json',
          compressed: metadata.length,
          decoded: metadata.length * 2,
          gpu: 0,
          triangles: 0,
          draws: 0,
          dependencies: [file],
          critical: false,
        },
      ],
    },
    new Map([
      [file, glb],
      [skin, metadata],
    ]),
  )
})

test('clipless bindings still refuse unknown loops and retain clip and joint caps', (): void => {
  const rows = parseSkinRows([row])
  expect(parseSkinBindings([binding], rows)[0]?.loops).toEqual([])
  expect((): unknown =>
    parseSkinBindings([{ ...binding, loops: ['walk'] }], rows),
  ).toThrow('unknown clip')
  expect((): unknown =>
    parseSkinRows([
      {
        ...row,
        rig: {
          ...row.rig,
          clips: Array.from({ length: 33 }, (): string => 'idle'),
        },
      },
    ]),
  ).toThrow('clips')
  expect((): unknown =>
    parseSkinRows([{ ...row, rig: { ...row.rig, joints: [[]] } }]),
  ).toThrow('joints')
  expect((): unknown =>
    parseSkinRows([{ ...row, rig: { ...row.rig, clips: ['../foreign'] } }]),
  ).toThrow('clips')
})

test('skin rows admit a named clip without widening the legacy animation families', (): void => {
  const named = parseSkinRows([
    { ...row, rig: { ...row.rig, clips: ['attack', 'swing'] } },
  ])
  expect(named[0]?.rig.clips).toEqual(['attack', 'swing'])
  expect(
    parseSkinBindings([{ ...binding, loops: ['swing'] }], named)[0]?.loops,
  ).toEqual(['swing'])
  expect((): unknown => parse(SkinClipNameSchema, 'swing')).toThrow()
  const oversized = 'x'.repeat(65)
  for (const wrong of ['Swing', 'hit..swing', oversized]) {
    expect((): unknown =>
      parseSkinRows([{ ...row, rig: { ...row.rig, clips: [wrong] } }]),
    ).toThrow('clips')
  }
})

function checkedAnimation(
  animation: unknown,
): ReturnType<typeof parseRows>['looks'] {
  const { look, source } = fixture()
  return parseRows({ ...source.rows, looks: [{ ...look, animation }] }).looks
}

test('a skin look maps states and an ability to named clips without changing an older look', (): void => {
  const { look } = fixture()
  const clipMap = {
    states: { walk: 'sneak', attack: 'attack' },
    abilities: { swing: 'swing' },
  }
  const [admitted] = checkedAnimation({ ...look.animation, clipMap })
  expect(admitted && skinLookParameters(admitted).clipMap).toEqual(clipMap)
  expect(skinLookParameters(look)).not.toHaveProperty('clipMap')
})

test('clip maps refuse malformed actions, excess entries and other recipes', (): void => {
  const { look } = fixture()
  for (const wrong of [
    { states: { unchecked: 'walk' } },
    { abilities: { swing: '../swing' } },
    {
      abilities: Object.fromEntries(
        Array.from({ length: 33 }, (_entry, index): [string, string] => [
          `swing${index}`,
          'swing',
        ]),
      ),
    },
  ]) {
    expect((): unknown =>
      checkedAnimation({ ...look.animation, clipMap: wrong }),
    ).toThrow('Invalid')
  }
  expect((): unknown =>
    checkedAnimation({ ...look.animation, recipe: 'other.clip', clipMap: {} }),
  ).toThrow('Clip maps require platform.clips')
})

test('the existing animated corpus still admits unchanged', (): void => {
  const sample = fixture()
  const before = structuredClone(sample.assets)
  validateSkinAssets(sample.source, sample.assets)
  expect(sample.assets).toEqual(before)
})
