// This offline test helper hashes and reads the committed corpus synchronously.
/* oxlint-disable import/no-nodejs-modules, node/no-sync */
import { createHash } from 'node:crypto'
// These fixtures deliberately mutate decoded rows to exercise hostile admission inputs.
/* oxlint-disable typescript/prefer-readonly-parameter-types */
import { readFileSync } from 'node:fs'

import {
  parse,
  object,
  array,
  string,
  number,
  optional,
  unknown,
} from 'valibot'
import { expect } from 'vitest'

import { parseGlbData } from '../format/glbCost.ts'
import { MaterialsSchema } from '../format/materials.ts'
import { parseRows } from '../format/rows.ts'
import { parseSkinFile, skinFileDependencies } from '../format/skinAssets.ts'

import type { ShardRows } from '../format/rows.ts'
import type { Shardfile } from '../format/shardSchema.ts'
import type { SkinVariants } from '../format/skins.ts'

const decode = (value: Uint8Array): unknown =>
  JSON.parse(new TextDecoder().decode(value))
const skinHashSchema = optional(string())
const lookParametersSchema = object({ skin: skinHashSchema })
const lookRowSchema = object({
  species: string(),
  parameters: lookParametersSchema,
})
const lookRowsSchema = object({ looks: array(lookRowSchema) })
const materialSectionSchema = object({ rows: lookRowsSchema })
const materialsSchema = object({ materials: unknown() })
const lookSectionSchema = object({ look: materialsSchema })
const speciesArraySchema = array(unknown())
const speciesRowsSchema = object({ species: speciesArraySchema })
const speciesSectionSchema = object({ rows: speciesRowsSchema })

// J506: the skin rows and GLBs here are the SS3 export's (corpus/legacy); corpus/exports/ is the current build.
const root = new URL('../../corpus/legacy/brasscap-mesa-ss3/', import.meta.url)
const bytes = (path: string): Uint8Array =>
  new Uint8Array(readFileSync(new URL(path, root)))
const json = (value: unknown): Uint8Array =>
  new TextEncoder().encode(JSON.stringify(value))
const hash = (value: Uint8Array): string =>
  createHash('sha256').update(value).digest('hex')

interface Fixture {
  source: Pick<Shardfile, 'rows' | 'files' | 'library'> & {
    look: Pick<Shardfile['look'], 'materials'>
  }
  assets: Map<string, Uint8Array>
  look: ShardRows['looks'][number]
  firstHash: string
  secondHash: string
  tableHash: string
}
const offsetSchema = object({ byteOffset: optional(number()) })
const accessorSchema = object({
  componentType: number(),
  bufferView: number(),
  byteOffset: optional(number()),
})
const primitiveSchema = object({ attributes: object({ POSITION: number() }) })
const meshSchema = object({ primitives: array(primitiveSchema) })
const glbFixtureSchema = object({
  meshes: array(meshSchema),
  accessors: array(accessorSchema),
  bufferViews: array(offsetSchema),
})

const GLB_JSON_LENGTH = 12
const GLB_JSON_START = 20
const GLB_BIN_START = 28
const FLOAT_COMPONENT = 5126
const ALTERED_POSITION = 0.9
const ZERO = 0
const ATTACK_SPAN = 1.5
const ONE = 1
const DECODED_MULTIPLIER = 2
const VECTOR_WIDTH = 3
const FLOAT_BYTES = 4

// Keep one real binary fixture construction visible for the admission proof.
// oxlint-disable-next-line max-statements, complexity, max-lines-per-function
function fixture(
  options: {
    skin?: (value: ReturnType<typeof parseSkinFile>) => void
    table?: (value: SkinVariants) => void
    dependencies?: (value: string[]) => string[]
    /** OF27b: mutate the default skin too (its bytes are then re-encoded) */
    first?: (value: ReturnType<typeof parseSkinFile>) => void
    /** OF27b: extra KTX2 files a skin's material may name */
    textures?: readonly Uint8Array[]
    /** OF27b: replace a skin file's dependencies (default: its GLB, then its material's textures) */
    skinDependencies?: (value: string[], which: 'first' | 'second') => string[]
  } = {},
): Fixture {
  const materialSection = parse(
    materialSectionSchema,
    decode(bytes('sections/look/materials.json')),
  )
  const lookSection = parse(
    lookSectionSchema,
    decode(bytes('sections/look/look.json')),
  )
  const original = materialSection.rows.looks.find(
    (look): boolean => look.species === 'brasscap.bandit',
  )
  if (original?.parameters.skin === undefined) {
    throw new Error('Missing actual bandit look')
  }
  const corpusBytes = bytes(`blobs/json/${original.parameters.skin}.json`)
  const first = parseSkinFile(corpusBytes)
  options.first?.(first)
  const firstBytes = options.first === undefined ? corpusBytes : json(first)
  const glb = bytes(`blobs/glb/${first.row.file}.glb`)
  const alternate = new Uint8Array(glb)
  const length = new DataView(alternate.buffer).getUint32(GLB_JSON_LENGTH, true)
  const doc = parse(
    glbFixtureSchema,
    decode(alternate.subarray(GLB_JSON_START, GLB_JSON_START + length)),
  )
  const index = doc.meshes[ZERO]?.primitives[ZERO]?.attributes.POSITION
  const accessor = index === undefined ? undefined : doc.accessors[index]
  if (accessor?.componentType !== FLOAT_COMPONENT) {
    throw new Error('Expected original float position channel')
  }
  const at =
    GLB_BIN_START +
    length +
    (doc.bufferViews[accessor.bufferView]?.byteOffset ?? ZERO) +
    (accessor.byteOffset ?? ZERO)
  const view = new DataView(alternate.buffer)
  for (let component = ZERO; component < VECTOR_WIDTH; component += ONE) {
    const value = view.getFloat32(at + component * FLOAT_BYTES, true)
    if (value !== ZERO) {
      view.setFloat32(
        at + component * FLOAT_BYTES,
        value * ALTERED_POSITION,
        true,
      )
      break
    }
  }
  expect(hash(alternate)).not.toBe(hash(glb))
  const second = structuredClone(first)
  second.row.id = 'fixture.second'
  second.row.file = hash(alternate)
  second.binding.skin = second.row.id
  second.row.cost = parseGlbData(alternate)
  options.skin?.(second)
  const secondBytes = json(second)
  const firstHash = hash(firstBytes)
  const secondHash = hash(secondBytes)
  const table: SkinVariants = {
    version: ONE,
    skins: { plain: firstHash, other: secondHash },
  }
  options.table?.(table)
  const tableBytes = json(table)
  const tableHash = hash(tableBytes)
  const dependencies = options.dependencies?.([firstHash, secondHash]) ?? [
    firstHash,
    secondHash,
  ]
  const speciesSection = parse(
    speciesSectionSchema,
    decode(bytes('sections/actors/species.json')),
  )
  const originalRows = parseRows({
    strikes: [],
    weather: [],
    days: [],
    looks: [],
    compendiums: [],
    loot: [],
    species: speciesSection.rows.species,
  })
  const species = originalRows.species.find(
    (row): boolean => row.id === 'brasscap.bandit',
  )
  const variant = species?.variants[ZERO]
  if (species === undefined || variant === undefined) {
    throw new Error('Missing actual bandit species')
  }
  const rows = parseRows({
    strikes: [],
    weather: [],
    days: [],
    compendiums: [],
    loot: [],
    species: [
      {
        ...species,
        variants: [
          { ...variant, id: 'plain' },
          { ...variant, id: 'other' },
        ],
      },
    ],
    looks: [
      {
        id: 'fixture.look',
        species: species.id,
        recipe: 'platform.skin',
        // The wire schema requires null when the skin owns materials.
        // oxlint-disable-next-line unicorn/no-null
        material: null,
        parameters: { skin: firstHash, variants: tableHash },
        animation: {
          recipe: 'platform.clips',
          parameters: { attackSpan: ATTACK_SPAN },
        },
      },
    ],
  })
  const file = (
    value: Uint8Array,
    kind: 'json' | 'glb',
    refs: string[],
  ): Fixture['source']['files'][number] => ({
    hash: hash(value),
    kind,
    dependencies: refs,
    compressed: value.length,
    ...(kind === 'glb'
      ? parseGlbData(value)
      : {
          decoded: value.length * DECODED_MULTIPLIER,
          gpu: ZERO,
          triangles: ZERO,
          draws: ZERO,
        }),
    critical: false,
  })
  const skinDeps = (
    value: ReturnType<typeof parseSkinFile>,
    which: 'first' | 'second',
  ): string[] => {
    const own = skinFileDependencies(value.row, value.binding)
    return options.skinDependencies?.(own, which) ?? own
  }
  const textures = (options.textures ?? []).map(
    (value): [string, Uint8Array] => [hash(value), value],
  )
  const source = {
    rows,
    files: [
      file(firstBytes, 'json', skinDeps(first, 'first')),
      file(secondBytes, 'json', skinDeps(second, 'second')),
      ...textures.map(([id, value]): Fixture['source']['files'][number] => ({
        hash: id,
        kind: 'ktx2',
        dependencies: [],
        compressed: value.length,
        decoded: value.length,
        gpu: value.length,
        triangles: ZERO,
        draws: ZERO,
        critical: false,
      })),
      file(glb, 'glb', []),
      file(alternate, 'glb', []),
      file(tableBytes, 'json', dependencies),
    ],
    library: [firstHash, tableHash],
    look: { materials: parse(MaterialsSchema, lookSection.look.materials) },
  }
  const assets = new Map([
    [firstHash, firstBytes],
    [secondHash, secondBytes],
    [first.row.file, glb],
    [hash(alternate), alternate],
    [tableHash, tableBytes],
    ...textures,
  ])
  const [look] = rows.looks
  if (look === undefined) {
    throw new Error('Missing fixture look')
  }
  return { source, assets, look, firstHash, secondHash, tableHash }
}

export { fixture }
