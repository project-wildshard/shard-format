// Validator output rows deliberately retain the format's mutable public data types.
/* oxlint-disable typescript/prefer-readonly-parameter-types */
// The portable library targets ES2022; sort only new arrays.
/* oxlint-disable unicorn/no-array-sort */
import { parse } from 'valibot'

import { MaterialsSchema, materialTextureRefs } from './materials.ts'
import { parseSkinFile, skinLookParameters } from './skin-file.ts'
import { SkinVariantsSchema } from './skins.ts'
import { validationSourceBytes } from './validationReceipt.ts'

import type { ShardRows } from './rows.ts'
import type { Shardfile } from './shardSchema.ts'
import type { SkinBinding, SkinRow } from './skinData.ts'

interface ResolvedSkinFile {
  readonly hash: string
  readonly row: SkinRow
  readonly binding: SkinBinding
}
interface SkinLookFiles {
  readonly skin: ResolvedSkinFile
  readonly variants?: ReadonlyMap<string, ResolvedSkinFile>
  /** The phone tier's lighter mesh (ONE-FORMAT CC51b): the same contract as `skin`, at most its triangles. */
  readonly phone?: ResolvedSkinFile
}
type Source = Pick<Shardfile, 'rows' | 'files'>
type Look = ShardRows['looks'][number]
const FIRST = 0
const REST = 1
/** A coat: what a variant or phone skin may wear of its own (OF27b), its maps (a painterly `map`), its fur's sheen and rim, and its glow. */
const COAT: ReadonlySet<string> = new Set([
  'map',
  'maps',
  'sheen',
  'rim',
  'emissive',
  'emissiveIntensity',
])

/** A skin file's exact dependencies: its GLB, then its material's textures, sorted and once each (OF27b). */
function skinFileDependencies(row: SkinRow, binding: SkinBinding): string[] {
  const textures = materialTextureRefs(
    parse(MaterialsSchema, { skin: binding.material }),
  )
  return [row.file, ...[...new Set(textures)].sort()]
}

function sharedMaterial(
  material: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(material).filter(([key]): boolean => !COAT.has(key)),
  )
}

function skinContract({ row, binding }: ResolvedSkinFile): string {
  return new TextDecoder().decode(
    validationSourceBytes({
      family: row.family,
      skeleton: row.rig.skeleton,
      joints: [...(row.rig.joints[FIRST] ?? [])].sort(),
      clips: [...row.rig.clips].sort(),
      sockets: [...row.rig.sockets].sort(),
      material: sharedMaterial(binding.material),
      materials: binding.materials ?? {},
    }),
  )
}

function readSkinFile(
  files: ReadonlyMap<string, Source['files'][number]>,
  assets: ReadonlyMap<string, Uint8Array>,
  hash: string,
): ResolvedSkinFile {
  const file = files.get(hash)
  const bytes = assets.get(hash)
  if (file?.kind !== 'json' || bytes === undefined) {
    throw new Error('skin file missing')
  }
  const skin = { hash, ...parseSkinFile(bytes) }
  const expected = skinFileDependencies(skin.row, skin.binding)
  const texture = (ref: string): boolean =>
    ref.startsWith('commons:') || files.get(ref)?.kind === 'ktx2'
  if (
    file.dependencies.length !== expected.length ||
    file.dependencies.some((ref, index): boolean => ref !== expected[index]) ||
    files.get(skin.row.file)?.kind !== 'glb' ||
    !expected.slice(REST).every((ref): boolean => texture(ref))
  ) {
    throw new Error('skin rig dependency mismatch')
  }
  return skin
}

function skinReader(
  source: Source,
  assets: ReadonlyMap<string, Uint8Array>,
): (hash: string) => ResolvedSkinFile {
  const files = new Map(
    source.files.map((file): [string, Source['files'][number]] => [
      file.hash,
      file,
    ]),
  )
  const parsed = new Map<string, ResolvedSkinFile>()
  return (hash: string): ResolvedSkinFile => {
    const known = parsed.get(hash)
    if (known !== undefined) {
      return known
    }
    const skin = readSkinFile(files, assets, hash)
    parsed.set(hash, skin)
    return skin
  }
}

function checkCoverage(
  skins: Readonly<Record<string, string>>,
  ids: readonly string[],
): void {
  const expected = new Set(ids)
  const keys = Object.keys(skins)
  if (
    keys.length !== expected.size ||
    keys.some((key): boolean => !expected.has(key))
  ) {
    throw new Error('variant table must name every species variant exactly')
  }
}

function checkDependencies(
  skins: Readonly<Record<string, string>>,
  actual: readonly string[],
  defaultHash: string,
): void {
  const dependencies = [...new Set(Object.values(skins))].sort()
  if (
    dependencies.length !== actual.length ||
    [...actual]
      .sort()
      .some((hash, index): boolean => hash !== dependencies[index])
  ) {
    throw new Error('variant table dependencies differ')
  }
  if (!dependencies.includes(defaultHash)) {
    throw new Error('variant table must include its default skin')
  }
}

function variantTable(
  source: Source,
  look: Look,
  {
    assets,
    parameters,
  }: {
    assets: ReadonlyMap<string, Uint8Array>
    parameters: { variants: string; skin: string }
  },
): Readonly<Record<string, string>> {
  const table = source.files.find(
    (file): boolean => file.hash === parameters.variants,
  )
  const bytes = assets.get(parameters.variants)
  if (table?.kind !== 'json' || bytes === undefined) {
    throw new Error(`skin look ${look.id}: variant table missing`)
  }
  const variants = parse(
    SkinVariantsSchema,
    JSON.parse(new TextDecoder().decode(bytes)),
  )
  const species = source.rows.species.find(
    (row): boolean => row.id === look.species,
  )
  checkCoverage(
    variants.skins,
    (species?.variants ?? []).map((row): string => row.id),
  )
  checkDependencies(variants.skins, table.dependencies, parameters.skin)
  return variants.skins
}

function resolveVariants(
  table: Readonly<Record<string, string>>,
  skin: ResolvedSkinFile,
  read: (hash: string) => ResolvedSkinFile,
): ReadonlyMap<string, ResolvedSkinFile> {
  const contract = skinContract(skin)
  const variants = new Map<string, ResolvedSkinFile>()
  for (const [variant, hash] of Object.entries(table)) {
    const value = read(hash)
    if (skinContract(value) !== contract) {
      throw new Error(`incompatible variant rig or material: ${variant}`)
    }
    variants.set(variant, value)
  }
  return variants
}

function phoneLook(
  skin: ResolvedSkinFile,
  {
    phone: hash,
    look,
    read,
    variants,
  }: {
    phone: string
    look: Look
    read: (hash: string) => ResolvedSkinFile
    variants: string | undefined
  },
): SkinLookFiles {
  if (variants !== undefined) {
    throw new Error(`skin look ${look.id}: a variant look has no phone skin`)
  }
  const phone = read(hash)
  if (skinContract(phone) !== skinContract(skin)) {
    throw new Error(`skin look ${look.id}: phone skin rig or material differs`)
  }
  if (phone.row.cost.triangles > skin.row.cost.triangles) {
    throw new Error(`skin look ${look.id}: phone skin draws more triangles`)
  }
  return { skin, phone }
}

/** Resolve exact variant coverage and compatible rig/material declarations once at admission/load. */
function resolveSkinLookFiles(
  source: Source,
  look: Look,
  assets: ReadonlyMap<string, Uint8Array>,
): SkinLookFiles {
  const parameters = skinLookParameters(look)
  const read = skinReader(source, assets)
  const skin = read(parameters.skin)
  if (parameters.phone !== undefined) {
    return phoneLook(skin, {
      phone: parameters.phone,
      look,
      read,
      variants: parameters.variants,
    })
  }
  if (parameters.variants === undefined) {
    return { skin }
  }
  const table = variantTable(source, look, {
    assets,
    parameters: { variants: parameters.variants, skin: parameters.skin },
  })
  const variants = resolveVariants(table, skin, read)
  return { skin, variants }
}

/** Every skin file a look draws: its skin, each variant's and the phone tier's. */
function lookSkins(resolved: SkinLookFiles): ResolvedSkinFile[] {
  return [
    resolved.skin,
    ...(resolved.variants?.values() ?? []),
    ...(resolved.phone === undefined ? [] : [resolved.phone]),
  ]
}

export { lookSkins, resolveSkinLookFiles, skinFileDependencies }
export type { ResolvedSkinFile, SkinLookFiles }
