// Validator output rows deliberately retain the format's mutable public data types.
/* oxlint-disable typescript/prefer-readonly-parameter-types */
// The portable library targets ES2022; sort only new arrays.
/* oxlint-disable unicorn/no-array-sort */
import { parse } from 'valibot'

import { MaterialsSchema, materialTextureRefs } from './materials.ts'
import { parseSkinFile, skinLookParameters } from './skin-file.ts'
import { speciesDefault, variantTable } from './skin-variant-table.ts'
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
  /** A phone mesh and coat per declared variant, in the same identities. */
  readonly phoneVariants?: ReadonlyMap<string, ResolvedSkinFile>
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

function checkPhoneSkin(
  look: Look,
  skin: ResolvedSkinFile,
  phone: ResolvedSkinFile,
): void {
  if (skinContract(phone) !== skinContract(skin)) {
    throw new Error(`skin look ${look.id}: phone skin rig or material differs`)
  }
  if (phone.row.cost.triangles > skin.row.cost.triangles) {
    throw new Error(`skin look ${look.id}: phone skin draws more triangles`)
  }
}

function requiredVariant(
  table: Readonly<Record<string, string>>,
  id: string,
): string {
  const hash = table[id]
  if (hash === undefined) {
    throw new Error(`missing phone variant: ${id}`)
  }
  return hash
}

type SkinTier = Pick<SkinLookFiles, 'skin' | 'variants'>
type SkinReader = (hash: string) => ResolvedSkinFile

function desktopTier(
  source: Source,
  look: Look,
  input: {
    readonly assets: ReadonlyMap<string, Uint8Array>
    readonly read: SkinReader
    readonly parameters: ReturnType<typeof skinLookParameters>
  },
): SkinTier {
  const { assets, read, parameters } = input
  const skin = read(parameters.skin)
  if (parameters.variants === undefined) {
    return { skin }
  }
  const table = variantTable(source, look, {
    assets,
    parameters: { variants: parameters.variants, skin: parameters.skin },
  })
  if (
    parameters.phone !== undefined &&
    table[speciesDefault(source, look)] !== skin.hash
  ) {
    throw new Error('desktop default must be the first species variant')
  }
  return { skin, variants: resolveVariants(table, skin, read) }
}

function phoneTier(
  source: Source,
  look: Look,
  input: {
    readonly assets: ReadonlyMap<string, Uint8Array>
    readonly read: SkinReader
    readonly phone: string
    readonly layered: boolean
  },
): SkinTier {
  const { assets, read, phone, layered } = input
  if (!layered) {
    return { skin: read(phone) }
  }
  const table = variantTable(source, look, {
    assets,
    parameters: { variants: phone },
  })
  const skin = read(requiredVariant(table, speciesDefault(source, look)))
  return { skin, variants: resolveVariants(table, skin, read) }
}

function checkPhoneTier(look: Look, desktop: SkinTier, phone: SkinTier): void {
  checkPhoneSkin(look, desktop.skin, phone.skin)
  for (const [id, desktopVariant] of desktop.variants ?? []) {
    const phoneVariant = phone.variants?.get(id)
    if (phoneVariant === undefined) {
      throw new Error(`missing phone variant: ${id}`)
    }
    checkPhoneSkin(look, desktopVariant, phoneVariant)
  }
}

/** Resolve exact variant coverage and compatible rig/material declarations at full admission. */
function resolveSkinLookFiles(
  source: Source,
  look: Look,
  assets: ReadonlyMap<string, Uint8Array>,
): SkinLookFiles {
  const parameters = skinLookParameters(look)
  const read = skinReader(source, assets)
  const desktop = desktopTier(source, look, { assets, read, parameters })
  if (parameters.phone === undefined) {
    return desktop
  }
  const phone = phoneTier(source, look, {
    assets,
    read,
    phone: parameters.phone,
    layered: parameters.variants !== undefined,
  })
  checkPhoneTier(look, desktop, phone)
  return {
    ...desktop,
    phone: phone.skin,
    ...(phone.variants === undefined ? {} : { phoneVariants: phone.variants }),
  }
}

/** Read only the selected tier for paired tables. Keep full runtime checks for older look shapes. */
function resolveTierSkinLookFiles(
  source: Source,
  look: Look,
  {
    assets,
    tier,
  }: {
    readonly assets: ReadonlyMap<string, Uint8Array>
    readonly tier: 'phone' | 'desktop'
  },
): SkinTier {
  const parameters = skinLookParameters(look)
  if (parameters.variants === undefined || parameters.phone === undefined) {
    const admitted = resolveSkinLookFiles(source, look, assets)
    return tier === 'phone' && admitted.phone !== undefined
      ? { skin: admitted.phone }
      : admitted
  }
  const read = skinReader(source, assets)
  return tier === 'desktop'
    ? desktopTier(source, look, { assets, read, parameters })
    : phoneTier(source, look, {
        assets,
        read,
        phone: parameters.phone,
        layered: true,
      })
}

/** Every skin file a look draws: its skin, each variant's and the phone tier's. */
function lookSkins(resolved: SkinLookFiles): ResolvedSkinFile[] {
  return [
    resolved.skin,
    ...(resolved.variants?.values() ?? []),
    ...(resolved.phone === undefined ? [] : [resolved.phone]),
    ...(resolved.phoneVariants?.values() ?? []),
  ]
}

export {
  lookSkins,
  resolveSkinLookFiles,
  resolveTierSkinLookFiles,
  skinFileDependencies,
}
export type { ResolvedSkinFile, SkinLookFiles }
