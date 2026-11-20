// Validator output rows deliberately retain the format's mutable public data types.
/* oxlint-disable typescript/prefer-readonly-parameter-types */
// The portable library targets ES2022; sort only new arrays.
/* oxlint-disable unicorn/no-array-sort */
import { validationSourceBytes } from './validationReceipt.ts'

import type { ShardRows } from './rows.ts'
import type { SkinBinding, SkinRow } from './skinData.ts'
import type { SkinLookParameters } from './skins.ts'

/** A skin file read from its bytes: its rig row and its binding. */
interface ResolvedSkinFile {
  readonly hash: string
  readonly row: SkinRow
  readonly binding: SkinBinding
}
type Look = ShardRows['looks'][number]
const FIRST = 0
/** A coat: what a variant or phone skin may wear of its own (OF27b), its maps (a painterly `map`), its fur's sheen and rim, and its glow. */
const COAT: ReadonlySet<string> = new Set([
  'map',
  'maps',
  'sheen',
  'rim',
  'emissive',
  'emissiveIntensity',
])

function sharedMaterial(
  material: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(material).filter(([key]): boolean => !COAT.has(key)),
  )
}

/** The rig and material a look's skins all share: a variant or phone skin differs only in its mesh and coat. */
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

/** A phone skin keeps its desktop skin's rig and material contract and draws at most its triangles (CC51b). */
function phoneSkin(
  desktop: ResolvedSkinFile,
  phone: ResolvedSkinFile,
  look: Look,
): ResolvedSkinFile {
  if (skinContract(phone) !== skinContract(desktop)) {
    throw new Error(`skin look ${look.id}: phone skin rig or material differs`)
  }
  if (phone.row.cost.triangles > desktop.row.cost.triangles) {
    throw new Error(`skin look ${look.id}: phone skin draws more triangles`)
  }
  return phone
}

/** OF23f: a variant look has a phone tier only as a phone skin and a phone variant table together. */
function checkPhonePairing(look: Look, parameters: SkinLookParameters): void {
  const { variants, phone, phoneVariants } = parameters
  if (phoneVariants !== undefined && variants === undefined) {
    throw new Error(
      `skin look ${look.id}: a phone variant table needs a variant table`,
    )
  }
  if (phoneVariants !== undefined && phone === undefined) {
    throw new Error(
      `skin look ${look.id}: a phone variant table needs its phone skin`,
    )
  }
  if (
    variants !== undefined &&
    phone !== undefined &&
    phoneVariants === undefined
  ) {
    throw new Error(
      `skin look ${look.id}: a variant look's phone skin needs a phone variant table`,
    )
  }
}

/** OF23f: each variant's phone skin against that variant's desktop skin. */
function phoneVariantSkins(
  phones: ReadonlyMap<string, ResolvedSkinFile>,
  {
    desktop,
    look,
  }: { desktop: ReadonlyMap<string, ResolvedSkinFile>; look: Look },
): ReadonlyMap<string, ResolvedSkinFile> {
  const checked = new Map<string, ResolvedSkinFile>()
  for (const [variant, phone] of phones) {
    const own = desktop.get(variant)
    if (own === undefined) {
      throw new Error(`skin look ${look.id}: no desktop variant ${variant}`)
    }
    checked.set(variant, phoneSkin(own, phone, look))
  }
  return checked
}

export { checkPhonePairing, phoneSkin, phoneVariantSkins, skinContract }
export type { ResolvedSkinFile }
