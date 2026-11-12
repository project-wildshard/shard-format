/**
 * Named skin materials (TE-ENG10, meta TEMPLATE-E2E-PLAN): a `platform.skin` look row may map a material name in its
 * skin's GLB to a `look.materials` ID, the way `props.materials` does for props:
 *
 *   parameters: { skin: '<json file hash>', materials: { Gullet: 'brasscap.gullet' } }
 *
 * The GLB's one skinned mesh may then carry up to eight primitives (one per GLB material, the same channels). A
 * primitive drawn in a mapped material draws with that look material (an emissive eye or gullet), each mapped name one
 * more draw per rig; every other primitive draws with the binding's family material, merged into one draw. Without
 * `materials` a skin draws as before, in its one family material.
 */
import {
  array,
  check,
  maxLength,
  minLength,
  number,
  object,
  optional,
  pipe,
  record,
  regex,
  safeParse,
  string,
} from 'valibot'

import type { GenericSchema } from 'valibot'

interface SkinPrimitive {
  readonly attributes: Readonly<Record<string, number>>
  readonly indices?: number | undefined
  readonly material?: number | undefined
}
interface SkinGlbMaterial {
  readonly name?: string | undefined
}
/** What the rules read of a look row. */
interface LookRow {
  readonly recipe: string
  readonly parameters: unknown
}
/** What the reference rule reads of a shard. */
interface LookSource {
  readonly rows: { readonly looks: readonly LookRow[] }
  readonly look: { readonly materials: Readonly<Record<string, unknown>> }
}
type Names = Readonly<Record<string, string>>

/** The most named parts a skin may map: with its family material, a rig draws in at most eight materials. */
const SKIN_MATERIAL_PARTS = 7
const ONE = 1
/** The most primitives of a skin's one skinned mesh. */
const SKIN_PRIMITIVES = SKIN_MATERIAL_PARTS + ONE
const NAME_LENGTH = 128
const NONE = 0
const ID = /^[a-z][a-z0-9.-]*$/u
const CONTROL = /\p{Cc}/u
const RESERVED: ReadonlySet<string> = new Set([
  '__proto__',
  'prototype',
  'constructor',
])
const SKIN_RECIPE = 'platform.skin'
const UNDECLARED = 'skin look materials name declared look.materials'

function isGlbName(name: string): boolean {
  return name.trim() === name && !RESERVED.has(name) && !CONTROL.test(name)
}
function partCount(rows: Names): boolean {
  const count = Object.keys(rows).length
  return count > NONE && count <= SKIN_MATERIAL_PARTS
}

const glbName = pipe(
  string(),
  minLength(ONE),
  maxLength(NAME_LENGTH),
  check(isGlbName, 'a GLB material name'),
)
const lookId = pipe(string(), regex(ID), maxLength(NAME_LENGTH))

/** `parameters.materials`: GLB material name → `look.materials` ID (1–7 names). */
const SkinMaterialsSchema: GenericSchema<
  Record<string, string>,
  Record<string, string>
> = pipe(record(glbName, lookId), check(partCount, '1–7 named skin materials'))

const attributes = record(string(), number())
/** A skinned primitive as the rig check reads it: its channels, index and material. */
const SkinPrimitiveSchema: GenericSchema<SkinPrimitive, SkinPrimitive> = object(
  { attributes, indices: optional(number()), material: optional(number()) },
)
const glbMaterial = object({ name: optional(string()) })
/** The GLB's materials, by index (only their names are read). */
const SkinGlbMaterialsSchema: GenericSchema<
  SkinGlbMaterial[] | undefined,
  SkinGlbMaterial[]
> = optional(array(glbMaterial), [])

/** A look row's mapped skin materials, or undefined (not a skin look, none mapped, or malformed). */
function skinLookMaterials(row: LookRow): Names | undefined {
  if (row.recipe !== SKIN_RECIPE) {
    return undefined
  }
  const parameters: unknown = row.parameters
  if (typeof parameters !== 'object' || parameters === null) {
    return undefined
  }
  const named: unknown = Reflect.get(parameters, 'materials')
  const parsed = safeParse(SkinMaterialsSchema, named)
  return parsed.success ? parsed.output : undefined
}

/** A skin's primitive count is one to eight. */
function skinPrimitiveCount(count: number | undefined): boolean {
  return count !== undefined && count > NONE && count <= SKIN_PRIMITIVES
}

/** Two primitives with the same channels and index presence (the client merges them into one geometry). */
function sameChannels(left: SkinPrimitive, right: SkinPrimitive): boolean {
  const names = Object.keys(left.attributes)
  const shared = names.filter((name: string): boolean =>
    Object.hasOwn(right.attributes, name),
  )
  const count = Object.keys(right.attributes).length
  const indexed = (left.indices === undefined) === (right.indices === undefined)
  return indexed && shared.length === names.length && count === names.length
}

/** Why a skin's primitives refuse their mapped names, or '': one set of channels, every mapped name drawn. */
function skinPartsFault(
  primitives: readonly SkinPrimitive[],
  materials: readonly SkinGlbMaterial[],
  parts: Names | undefined,
): string {
  const [first] = primitives
  const same = (primitive: SkinPrimitive): boolean =>
    first === undefined || sameChannels(first, primitive)
  if (
    !primitives.every((primitive: SkinPrimitive): boolean => same(primitive))
  ) {
    return 'skin primitives differ in their channels'
  }
  const nameOf = (primitive: SkinPrimitive): string | undefined =>
    primitive.material === undefined
      ? undefined
      : materials[primitive.material]?.name
  const used = new Set(
    primitives.map((primitive: SkinPrimitive): string | undefined =>
      nameOf(primitive),
    ),
  )
  const drawn = (name: string): boolean => used.has(name)
  const missing = Object.keys(parts ?? {}).find(
    (name: string): boolean => !drawn(name),
  )
  return missing === undefined ? '' : `no GLB material ${missing}`
}

/** Shardfile reference rule: every mapped skin material is a declared `look.materials` ID. */
function skinLookMaterialRules(source: LookSource): string[] {
  const declared = (id: string): boolean =>
    Object.hasOwn(source.look.materials, id)
  const undeclared = (row: LookRow): boolean => {
    const ids = Object.values(skinLookMaterials(row) ?? {})
    return !ids.every((id: string): boolean => declared(id))
  }
  return source.rows.looks.some((row: LookRow): boolean => undeclared(row))
    ? [UNDECLARED]
    : []
}

export {
  SKIN_MATERIAL_PARTS,
  SkinGlbMaterialsSchema,
  SkinMaterialsSchema,
  SkinPrimitiveSchema,
  skinLookMaterialRules,
  skinLookMaterials,
  skinPartsFault,
  skinPrimitiveCount,
  type SkinGlbMaterial,
  type SkinPrimitive,
}
