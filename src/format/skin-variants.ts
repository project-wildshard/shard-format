// Validator output rows deliberately retain the format's mutable public data types.
/* oxlint-disable typescript/prefer-readonly-parameter-types */
// The portable library targets ES2022; sort only new arrays.
/* oxlint-disable unicorn/no-array-sort */
import { parse } from 'valibot'

import { MaterialsSchema, materialTextureRefs } from './materials.ts'
import {
  checkPhonePairing,
  phoneSkin,
  phoneVariantSkins,
  skinContract,
} from './skin-contract.ts'
import { parseSkinFile, skinLookParameters } from './skin-file.ts'
import { SkinVariantsSchema, skinLookTierRoots } from './skins.ts'

import type { ShardRows } from './rows.ts'
import type { Shardfile } from './shardSchema.ts'
import type { ResolvedSkinFile } from './skin-contract.ts'
import type { SkinBinding, SkinRow } from './skinData.ts'
import type { SkinLookParameters } from './skins.ts'

interface SkinLookFiles {
  readonly skin: ResolvedSkinFile
  readonly variants?: ReadonlyMap<string, ResolvedSkinFile>
  /** The phone tier's lighter mesh (ONE-FORMAT CC51b): the same contract as `skin`, at most its triangles. */
  readonly phone?: ResolvedSkinFile
  /** OF23f: a variant look's phone variants, each the same contract as its desktop variant and at most its triangles. */
  readonly phoneVariants?: ReadonlyMap<string, ResolvedSkinFile>
}
type Source = Pick<Shardfile, 'rows' | 'files'>
type Look = ShardRows['looks'][number]
const REST = 1

/** A skin file's exact dependencies: its GLB, then its material's textures, sorted and once each (OF27b). */
function skinFileDependencies(row: SkinRow, binding: SkinBinding): string[] {
  const textures = materialTextureRefs(
    parse(MaterialsSchema, { skin: binding.material }),
  )
  return [row.file, ...[...new Set(textures)].sort()]
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
    ref.startsWith('commons:') ||
    files.get(ref)?.kind === 'ktx2' ||
    files.get(ref)?.kind === 'image'
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

interface TableContext {
  readonly source: Source
  readonly look: Look
  readonly assets: ReadonlyMap<string, Uint8Array>
  readonly read: (hash: string) => ResolvedSkinFile
}

/** A variant table's skins, each with its default's contract; none without a table. */
function tableVariants(
  context: TableContext,
  head: ResolvedSkinFile,
  table: string | undefined,
): ReadonlyMap<string, ResolvedSkinFile> | undefined {
  if (table === undefined) {
    return undefined
  }
  const { source, look, assets, read } = context
  const skins = variantTable(source, look, {
    assets,
    parameters: { variants: table, skin: head.hash },
  })
  return resolveVariants(skins, head, read)
}

/** The phone tier beside a look's skin and variants: its phone skin and, on a variant look, its phone variants (OF23f). */
function phoneTier(
  context: TableContext,
  desktop: Pick<SkinLookFiles, 'skin' | 'variants'>,
  parameters: Pick<SkinLookParameters, 'phone' | 'phoneVariants'>,
): SkinLookFiles {
  if (parameters.phone === undefined) {
    return desktop
  }
  const { look, read } = context
  const phone = phoneSkin(desktop.skin, read(parameters.phone), look)
  const phones = tableVariants(context, phone, parameters.phoneVariants)
  if (desktop.variants === undefined || phones === undefined) {
    return { ...desktop, phone }
  }
  const phoneVariants = phoneVariantSkins(phones, {
    desktop: desktop.variants,
    look,
  })
  return { ...desktop, phone, phoneVariants }
}

/** Resolve exact variant coverage and compatible rig/material declarations once at admission/load. */
function resolveSkinLookFiles(
  source: Source,
  look: Look,
  assets: ReadonlyMap<string, Uint8Array>,
): SkinLookFiles {
  const parameters = skinLookParameters(look)
  checkPhonePairing(look, parameters)
  const context = { source, look, assets, read: skinReader(source, assets) }
  const skin = context.read(parameters.skin)
  const variants = tableVariants(context, skin, parameters.variants)
  return phoneTier(
    context,
    variants === undefined ? { skin } : { skin, variants },
    parameters,
  )
}

/**
 * OF23f: the skin files one tier draws, read from that tier's bytes only. Tier selection leaves a look's desktop skins
 * out of the phone's files where the look has a phone skin, so the phone resolves its phone skin and phone variant table
 * alone; admission (`resolveSkinLookFiles`) has already held them to the desktop contract.
 */
function resolveSkinLookTier(
  source: Source,
  look: Look,
  {
    assets,
    tier,
  }: { assets: ReadonlyMap<string, Uint8Array>; tier: 'phone' | 'desktop' },
): Pick<SkinLookFiles, 'skin' | 'variants'> {
  const parameters = skinLookParameters(look)
  checkPhonePairing(look, parameters)
  const [head, table] = skinLookTierRoots(parameters, tier)
  const context = { source, look, assets, read: skinReader(source, assets) }
  const skin = context.read(head)
  const variants = tableVariants(context, skin, table)
  return variants === undefined ? { skin } : { skin, variants }
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
  resolveSkinLookTier,
  skinFileDependencies,
}
export type { SkinLookFiles }
export type { ResolvedSkinFile } from './skin-contract.ts'
