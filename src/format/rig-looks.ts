/**
 * ONE-FORMAT OF19d1: a creature look drawn from a scene model library's baked rig. A look row whose recipe is
 * `platform.rig` names the `world/scenes` models library (`parameters.library`) whose rigs carry the body, and optionally
 * the rig body (`parameters.body`, else the species' kind). The rig brings its own skeleton, surfaces and clips, so the row
 * names no material and its animation is the rig's own (`platform.rig`, no parameters). This replaces a page's
 * deleted species program for drawing declared bodies (Sunscar Dunes' ray, strider and Matriarch).
 */
import {
  exactOptional,
  maxLength,
  minLength,
  parse,
  pipe,
  safeParse,
  strictObject,
  string,
} from 'valibot'

import { nativeRuntimeActorIds } from './nativeRuntimePlan.ts'

import type { GenericSchema } from 'valibot'

/** The look recipe, and its animation recipe, for a body drawn from a scene library's rig. */
const RIG_LOOK_RECIPE = 'platform.rig'
const ID_MIN = 1
const ID_MAX = 128
const NONE = 0
const rowId = pipe(string(), minLength(ID_MIN), maxLength(ID_MAX))
/** The look row's parameters: the library, and the rig body when it is not the species' kind. */
interface RigLookParameters {
  readonly library: string
  readonly body?: string
}
const RigLookParametersSchema: GenericSchema<RigLookParameters> = strictObject({
  body: exactOptional(rowId),
  library: rowId,
})
/** The fields of a look row these rules read. */
interface RigLookRow {
  readonly id: string
  readonly species: string
  readonly recipe: string
  readonly material: string | null
  readonly parameters: Readonly<Record<string, unknown>>
  readonly animation: {
    readonly recipe: string
    readonly parameters: Readonly<Record<string, unknown>>
    readonly clipMap?: unknown
  }
}
/** The fields of a shard these rules read. */
interface RigLookShard {
  readonly rows: { readonly looks: readonly RigLookRow[] }
  readonly creatures: {
    readonly spawns: readonly { readonly species: string }[]
  }
}

/** Whether a look plays its rig's own clips: the rig recipe, no parameters and no clip map. */
function ownClips(row: Readonly<RigLookRow>): boolean {
  const { animation } = row
  return (
    animation.recipe === RIG_LOOK_RECIPE &&
    Object.keys(animation.parameters).length === NONE &&
    animation.clipMap === undefined
  )
}

/** The errors of one `platform.rig` look's own fields (none for another recipe whose animation is not the rig's). */
function rigLookRowRules(row: Readonly<RigLookRow>): readonly string[] {
  if (row.recipe !== RIG_LOOK_RECIPE) {
    return row.animation.recipe === RIG_LOOK_RECIPE
      ? [`Rig clips without a rig look: ${row.id}`]
      : []
  }
  const errors: string[] = []
  if (!safeParse(RigLookParametersSchema, row.parameters).success) {
    errors.push(
      `Rig look parameters are a library and an optional body: ${row.id}`,
    )
  }
  if (row.material !== null) {
    errors.push(`A rig look draws with its rig's surfaces: ${row.id}`)
  }
  if (!ownClips(row)) {
    errors.push(`A rig look plays its rig's own clips: ${row.id}`)
  }
  return errors
}

/** The parameters of a rig look that passed `rigLookRules`. */
function rigLookParameters(
  row: Readonly<Pick<RigLookRow, 'parameters'>>,
): RigLookParameters {
  return parse(RigLookParametersSchema, row.parameters)
}

/** Whether a value is a plain JSON object. */
function isObject(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** The ids of the `models` libraries a `world/scenes` section declares. */
function modelLibraries(scenes: unknown): ReadonlySet<string> {
  const libraries: unknown = isObject(scenes) ? scenes['libraries'] : undefined
  const rows: readonly unknown[] = Array.isArray(libraries) ? libraries : []
  return new Set(
    rows.flatMap((row: unknown): string[] =>
      isObject(row) && row['kind'] === 'models' && typeof row['id'] === 'string'
        ? [row['id']]
        : [],
    ),
  )
}

/** Every look's rig rules, and cross-section: every rig look names a `models` library of `world/scenes` (the rig body is
 *  the library file's, checked where the page loads it). */
function rigLookRules(
  looks: readonly RigLookRow[],
  sections: ReadonlyMap<string, unknown>,
): readonly string[] {
  const rows = looks.flatMap((row: Readonly<RigLookRow>): readonly string[] =>
    rigLookRowRules(row),
  )
  const rigged = looks.filter(
    (row: Readonly<RigLookRow>): boolean => row.recipe === RIG_LOOK_RECIPE,
  )
  if (rigged.length === NONE) {
    return rows
  }
  const models = modelLibraries(sections.get('world/scenes'))
  const libraries = rigged.flatMap((row: Readonly<RigLookRow>): string[] => {
    const { library } = row.parameters
    return typeof library === 'string' && models.has(library)
      ? []
      : [`Rig look ${row.id} names no world/scenes models library`]
  })
  return [...rows, ...libraries]
}

/** OF19d1: a page whose plan keeper stands no body (`keeper` is its actor ids), and whose every declared spawn's species
 *  has a look row, draws its creatures as an ordinary upload does. */
function declaredLooksDraw(
  shard: Readonly<RigLookShard>,
  keeper: readonly string[],
): boolean {
  if (keeper.length > NONE) {
    return false
  }
  const looked = new Set(
    shard.rows.looks.map((row: Readonly<RigLookRow>): string => row.species),
  )
  return shard.creatures.spawns.every(
    (spawn: Readonly<{ species: string }>): boolean =>
      looked.has(spawn.species),
  )
}

/** Whether a data page draws its declared bodies from their looks: its runtime plan's keeper (`plan`, the
 *  `sim/runtime-plan` section) stands no body, and every declared spawn's species has a look. */
function pageDrawsDeclaredLooks(
  shard: Readonly<RigLookShard>,
  plan: unknown,
): boolean {
  return declaredLooksDraw(shard, nativeRuntimeActorIds(plan))
}

export {
  RIG_LOOK_RECIPE,
  RigLookParametersSchema,
  declaredLooksDraw,
  pageDrawsDeclaredLooks,
  rigLookParameters,
  rigLookRules,
}
export type { RigLookParameters, RigLookRow, RigLookShard }
