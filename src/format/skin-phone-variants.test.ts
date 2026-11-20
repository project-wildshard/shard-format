// ONE-FORMAT OF23f: a variant look's phone tier, a phone skin and a phone variant table: each variant's lighter skin,
// with that variant's rig and material contract and at most its triangles. The phone fetches none of the desktop skins.
// These controls deliberately corrupt decoded rows before admission.
/* oxlint-disable typescript/prefer-readonly-parameter-types */
// The portable library targets ES2022; sort only new arrays.
/* oxlint-disable unicorn/no-array-sort */
import { createHash } from 'node:crypto'

import { expect, test } from 'vitest'

import { fixture } from '../ci/skin-variants-fixture.ts'
import { lookSkins } from './skin-variants.ts'
import {
  parseSkinFile,
  resolveSkinLookFiles,
  resolveSkinLookTier,
  skinFileDependencies,
  skinLookRules,
  validateSkinAssets,
} from './skinAssets.ts'
import { tierLibrarySteps } from './tierSelection.ts'

type Skin = ReturnType<typeof parseSkinFile>
type Variant = 'plain' | 'other'
type Base = ReturnType<typeof fixture>
type Sample = Base & { phones: Record<Variant, string>; phoneTable: string }
interface Options {
  phone?: (value: Skin, variant: Variant) => void
  table?: (skins: Record<string, string>) => void
}
const sha = (value: Uint8Array): string =>
  createHash('sha256').update(value).digest('hex')
const json = (value: unknown): Uint8Array =>
  new TextEncoder().encode(JSON.stringify(value))

function addJson(sample: Base, bytes: Uint8Array, refs: string[]): string {
  const hash = sha(bytes)
  sample.assets.set(hash, bytes)
  sample.source.files.push({
    hash,
    kind: 'json',
    dependencies: refs,
    compressed: bytes.length,
    decoded: bytes.length,
    gpu: 0,
    triangles: 0,
    draws: 0,
    critical: false,
  })
  return hash
}

/** A phone copy of a variant's skin: another row id, so other bytes, on the same GLB and material. */
function phoneCopy(
  sample: Base,
  {
    variant,
    desktop,
    options,
  }: { variant: Variant; desktop: string; options: Options },
): string {
  const bytes = sample.assets.get(desktop)
  if (bytes === undefined) {
    throw new Error('fixture skin missing')
  }
  const skin = parseSkinFile(bytes)
  skin.row.id = `phone.${variant}`
  skin.binding.skin = skin.row.id
  options.phone?.(skin, variant)
  return addJson(
    sample,
    json(skin),
    skinFileDependencies(skin.row, skin.binding),
  )
}

/** The fixture's two variant skins, each with its own phone copy in a phone variant table. */
function phoneVariants(options: Options = {}): Sample {
  const sample = fixture()
  const phones = {
    plain: phoneCopy(sample, {
      variant: 'plain',
      desktop: sample.firstHash,
      options,
    }),
    other: phoneCopy(sample, {
      variant: 'other',
      desktop: sample.secondHash,
      options,
    }),
  }
  const skins: Record<string, string> = { ...phones }
  options.table?.(skins)
  const refs = [...new Set(Object.values(skins))].sort()
  const phoneTable = addJson(sample, json({ version: 1, skins }), refs)
  sample.look.parameters['phone'] = phones.plain
  sample.look.parameters['phoneVariants'] = phoneTable
  sample.source.library = [...sample.source.library, phones.plain, phoneTable]
  return { ...sample, phones, phoneTable }
}

function refuses(sample: Base, message: string): void {
  expect((): unknown =>
    resolveSkinLookFiles(sample.source, sample.look, sample.assets),
  ).toThrow(message)
}

test('a variant look admits a phone variant table with each variant contract', (): void => {
  const sample = phoneVariants()
  expect(skinLookRules(sample.source)).toEqual([])
  validateSkinAssets(sample.source, sample.assets)
  const resolved = resolveSkinLookFiles(
    sample.source,
    sample.look,
    sample.assets,
  )
  expect(resolved.phone?.hash).toBe(sample.phones.plain)
  expect(resolved.phoneVariants?.get('other')?.hash).toBe(sample.phones.other)
  expect(resolved.variants?.get('other')?.hash).toBe(sample.secondHash)
  const hashes = lookSkins(resolved).map((skin): string => skin.hash)
  expect(hashes).toContain(sample.phones.other)
})

test('the phone tier resolves its skins with no desktop skin bytes', (): void => {
  const sample = phoneVariants()
  const assets = new Map(sample.assets)
  for (const hash of [sample.firstHash, sample.secondHash, sample.tableHash]) {
    assets.delete(hash)
  }
  const phone = resolveSkinLookTier(sample.source, sample.look, {
    assets,
    tier: 'phone',
  })
  expect(phone.skin.hash).toBe(sample.phones.plain)
  expect(phone.variants?.get('other')?.hash).toBe(sample.phones.other)
})

test('the desktop tier resolves its own skins', (): void => {
  const sample = phoneVariants()
  const desktop = resolveSkinLookTier(sample.source, sample.look, {
    assets: sample.assets,
    tier: 'desktop',
  })
  expect(desktop.skin.hash).toBe(sample.firstHash)
  expect(desktop.variants?.get('other')?.hash).toBe(sample.secondHash)
})

test('a phone variant heavier or off its variant contract refuses', (): void => {
  const heavier = phoneVariants({
    phone: (value, variant): void => {
      if (variant === 'other') {
        value.row.cost.triangles += 1
      }
    },
  })
  refuses(heavier, 'phone skin draws more triangles')
  const rig = phoneVariants({
    phone: (value, variant): void => {
      if (variant === 'other') {
        value.row.rig.sockets = ['body']
      }
    },
  })
  refuses(rig, 'incompatible variant rig or material: other')
})

test('a phone table missing a variant, or without its phone skin, refuses', (): void => {
  const partial = phoneVariants({
    table: (skins): void => {
      delete skins['other']
    },
  })
  refuses(partial, 'variant table must name every species variant exactly')
  const stray = phoneVariants()
  stray.look.parameters['phone'] = stray.firstHash
  refuses(stray, 'variant table must include its default skin')
})

test('a phone variant table pairs with a variant table and a phone skin', (): void => {
  const alone = phoneVariants()
  delete alone.look.parameters['phoneVariants']
  refuses(alone, 'phone skin needs a phone variant table')
  const headless = phoneVariants()
  delete headless.look.parameters['phone']
  refuses(headless, 'a phone variant table needs its phone skin')
  const plain = phoneVariants()
  delete plain.look.parameters['variants']
  refuses(plain, 'a phone variant table needs a variant table')
})

test('a phone variant table outside the library refuses', (): void => {
  const outside = phoneVariants()
  outside.source.library = outside.source.library.filter(
    (hash): boolean => hash !== outside.phoneTable,
  )
  expect(skinLookRules(outside.source)).toContain(
    'skin phone variant table references',
  )
})

const tag = (index: number): string =>
  index.toString(16).padStart(2, '0').repeat(32)
const tags = (indices: readonly number[]): string[] =>
  indices.map((index): string => tag(index))
function entry(
  index: number,
  kind: string,
  refs: readonly number[] = [],
): {
  hash: string
  kind: string
  decoded: number
  dependencies: string[]
} {
  return { hash: tag(index), kind, decoded: 1, dependencies: tags(refs) }
}
// Desktop skins 1 and 5 (table 2) wear maps 11 and 12; phone skins 3 and 6 (table 4) wear 13 and 14; GLB 10 is shared.
const FILES = [
  entry(1, 'json', [10, 11]),
  entry(5, 'json', [10, 12]),
  entry(2, 'json', [1, 5]),
  entry(3, 'json', [10, 13]),
  entry(6, 'json', [10, 14]),
  entry(4, 'json', [3, 6]),
  entry(10, 'glb'),
  ...[11, 12, 13, 14].map((index): ReturnType<typeof entry> =>
    entry(index, 'ktx2'),
  ),
]
const LOOK = {
  recipe: 'platform.skin',
  parameters: {
    skin: tag(1),
    variants: tag(2),
    phone: tag(3),
    phoneVariants: tag(4),
  },
}
const SOURCE = {
  identity: { slug: 'skins' },
  files: FILES,
  library: tags([1, 2, 3, 4]),
  critical: [],
  rows: { looks: [LOOK] },
}
const DESCRIPTOR = {
  index: {
    files: FILES.map((row): { hash: string; path: string } => ({
      hash: row.hash,
      path: `blobs/${row.kind}/${row.hash}`,
    })),
  },
  sections: new Map<string, unknown>(),
}

function select(tier: 'phone' | 'desktop'): string[] {
  const steps = tierLibrarySteps(SOURCE, tier, DESCRIPTOR)
  let step = steps.next()
  while (step.done !== true) {
    step = steps.next()
  }
  return [...step.value].sort()
}

test('the phone tier leaves the desktop skins, table and maps out, and the desktop the phone ones', (): void => {
  expect(select('phone')).toEqual(tags([1, 2, 5, 11, 12]).sort())
  expect(select('desktop')).toEqual(tags([3, 4, 6, 13, 14]).sort())
})
