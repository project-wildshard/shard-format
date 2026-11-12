/**
 * Named skin materials (TE-ENG10, meta TEMPLATE-E2E-PLAN): a skin's binding (the `{ row, binding }` skin file a
 * `platform.skin` look names) may map a material name in its GLB to a `look.materials` ID, the way `props.materials`
 * does for props:
 *
 *   binding: { skin, material: { family: 'pbr', ... }, materials: { Gullet: 'brasscap.gullet' }, loops }
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

/** Why a binding's mapped IDs refuse, or '': each is a declared `look.materials` ID of a family (not a graph) material. */
function skinMaterialsFault(
  parts: Names | undefined,
  declared: Readonly<Record<string, unknown>>,
): string {
  const missing = Object.values(parts ?? {}).find(
    (id: string): boolean => !Object.hasOwn(declared, id),
  )
  if (missing !== undefined) {
    return `skin material ${missing} is not a declared look material`
  }
  // A part flashes with the body through its family's emissive or colour; a graph has neither port for certain
  const isGraph = (id: string): boolean => {
    const entry: unknown = declared[id]
    return (
      typeof entry === 'object' &&
      entry !== null &&
      Reflect.get(entry, 'family') === 'graph'
    )
  }
  const graph = Object.values(parts ?? {}).find((id: string): boolean =>
    isGraph(id),
  )
  return graph === undefined
    ? ''
    : `skin material ${graph} is a graph material: a skin part takes a family material`
}

export {
  SKIN_MATERIAL_PARTS,
  SkinGlbMaterialsSchema,
  SkinMaterialsSchema,
  SkinPrimitiveSchema,
  skinMaterialsFault,
  skinPartsFault,
  skinPrimitiveCount,
  type SkinGlbMaterial,
  type SkinPrimitive,
}
