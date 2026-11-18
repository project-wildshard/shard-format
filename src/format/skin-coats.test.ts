// ONE-FORMAT OF27b: a skin wears the hull book's look. Its PBR material's maps are the skin file's dependencies after
// its GLB (so the library closure loads them), a variant (or the phone skin) may wear its own maps, sheen and rim (a
// baked coat), and the PBR family takes a fur's sheen and backlit rim.
// These controls deliberately corrupt decoded rows before admission.
/* oxlint-disable typescript/prefer-readonly-parameter-types */
import { createHash } from 'node:crypto'

import { expect, test } from 'vitest'

import { fixture } from '../ci/skin-variants-fixture.ts'
import { parseFamilyMaterial } from './materialFamilies.ts'
import {
  resolveSkinLookFiles,
  skinFileDependencies,
  skinLookRules,
  validateSkinAssets,
} from './skinAssets.ts'

import type { parseSkinFile } from './skinAssets.ts'

type Skin = ReturnType<typeof parseSkinFile>
type Which = 'first' | 'second'
type Sample = ReturnType<typeof fixture>
interface Change {
  readonly second?: (value: Skin) => void
  readonly skinDependencies?: (value: string[], which: Which) => string[]
}
const KTX2 = [171, 75, 84, 88, 32, 50, 48, 187, 13, 10, 26, 10]
const TAG_NORMAL = 1
const TAG_A = 2
const TAG_B = 3
const TAG_WIDTH = 4
const BAD_AMOUNT = 2
const texture = (tag: number): Uint8Array =>
  new Uint8Array([
    ...KTX2,
    ...Array.from({ length: TAG_WIDTH }, (): number => tag),
  ])
const sha = (value: Uint8Array): string =>
  createHash('sha256').update(value).digest('hex')
const NORMAL = texture(TAG_NORMAL)
const COAT_A = texture(TAG_A)
const COAT_B = texture(TAG_B)
const RIM_A = [0.85, 0.66, 0.42]
const RIM_B = [0.95, 0.8, 0.55]
const SHEEN = { amount: 0.3, colour: [0.3, 0.24, 0.18], roughness: 0.7 }
const FUR = { sheen: SHEEN, rim: RIM_A }

function wear(coat: Uint8Array, rim: readonly number[]): (value: Skin) => void {
  return (value: Skin): void => {
    // oxlint-disable-next-line unicorn/no-null -- A PBR entry names an absent ORM map as null.
    const maps = { colour: sha(coat), normal: sha(NORMAL), orm: null }
    value.binding.material = {
      ...value.binding.material,
      maps,
      sheen: SHEEN,
      rim,
      emissive: rim,
    }
  }
}

function coated(change: Change = {}): Sample {
  return fixture({
    first: wear(COAT_A, RIM_A),
    skin: (value: Skin): void => {
      wear(COAT_B, RIM_B)(value)
      change.second?.(value)
    },
    textures: [NORMAL, COAT_A, COAT_B],
    ...(change.skinDependencies === undefined
      ? {}
      : { skinDependencies: change.skinDependencies }),
  })
}

function coatOf(sample: Sample, id: string): unknown {
  const variant = resolveSkinLookFiles(
    sample.source,
    sample.look,
    sample.assets,
  ).variants?.get(id)
  const maps: unknown = variant?.binding.material['maps']
  return typeof maps === 'object' && maps !== null
    ? Reflect.get(maps, 'colour')
    : undefined
}

test('a skin file depends on its GLB, then its material textures, sorted and once each', (): void => {
  const sample = coated()
  const { skin } = resolveSkinLookFiles(
    sample.source,
    sample.look,
    sample.assets,
  )
  const textures = [sha(COAT_A), sha(NORMAL)].toSorted()
  expect(skinFileDependencies(skin.row, skin.binding)).toEqual([
    skin.row.file,
    ...textures,
  ])
  expect(skinLookRules(sample.source)).toEqual([])
  validateSkinAssets(sample.source, sample.assets)
})

test('variants wear their own coat: colour map, sheen, rim and glow', (): void => {
  const sample = coated()
  validateSkinAssets(sample.source, sample.assets)
  expect(coatOf(sample, 'plain')).toBe(sha(COAT_A))
  expect(coatOf(sample, 'other')).toBe(sha(COAT_B))
})

test('variants still share everything else of the material', (): void => {
  for (const second of [
    (value: Skin): void => {
      value.binding.material['vertexColours'] = false
    },
    (value: Skin): void => {
      value.binding.material['normalScale'] = 0.5
    },
  ]) {
    const sample = coated({ second })
    expect((): void => {
      validateSkinAssets(sample.source, sample.assets)
    }).toThrow('incompatible variant rig or material')
  }
})

test('a texture missing from, or extra in, the dependencies refuses', (): void => {
  for (const change of [
    (value: string[]): string[] => value.slice(0, -1),
    (value: string[]): string[] => [...value, 'e'.repeat(64)],
    (value: string[]): string[] => [
      value[0] ?? '',
      ...value.slice(1).toReversed(),
    ],
  ]) {
    const sample = coated({
      skinDependencies: (value: string[], which: Which): string[] =>
        which === 'second' ? change(value) : value,
    })
    expect((): void => {
      validateSkinAssets(sample.source, sample.assets)
    }).toThrow('skin rig dependency mismatch')
  }
})

test('a skin texture must be a KTX2 file', (): void => {
  const sample = coated()
  const row = sample.source.files.find(
    (file): boolean => file.hash === sha(NORMAL),
  )
  if (row === undefined) {
    throw new Error('missing fixture texture')
  }
  row.kind = 'binary'
  expect((): void => {
    validateSkinAssets(sample.source, sample.assets)
  }).toThrow('skin rig dependency mismatch')
  expect(skinLookRules(sample.source)).toContain('skin look file references')
})

test('the PBR family takes a fur sheen and rim, bounded', (): void => {
  expect(parseFamilyMaterial({ family: 'pbr', ...FUR })).toMatchObject(FUR)
  expect(parseFamilyMaterial({ family: 'pbr' })).not.toHaveProperty('sheen')
  for (const bad of [
    { sheen: { ...SHEEN, amount: BAD_AMOUNT } },
    { sheen: { amount: SHEEN.amount, colour: SHEEN.colour } },
    { rim: [-1, 0, 0] },
  ]) {
    expect((): unknown =>
      parseFamilyMaterial({ family: 'pbr', ...bad }),
    ).toThrow()
  }
})
