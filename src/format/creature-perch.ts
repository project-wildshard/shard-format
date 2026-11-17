import {
  array,
  check,
  finite,
  maxLength,
  maxValue,
  minLength,
  minValue,
  number,
  pipe,
  regex,
  strictObject,
  string,
  tuple,
  picklist,
  intersect,
  object,
} from 'valibot'

import { BodySlotsSchema } from './bodySlots.ts'
import { MixedPopulationSchema } from './mixedPopulation.ts'
import { BodyLaunchSchema } from './nativeItems.ts'
import { ReturnProgramWireDocumentSchema } from './returnProgramDocument.ts'

import type { BodySlotsData } from './bodySlots.ts'
import type {
  MixedPopulationRows,
  MixedPopulationRowsInput,
} from './mixedPopulation.ts'
import type { ReturnProgramDocumentInput } from './returnProgramDocument.ts'
import type { GenericSchema, InferInput, InferOutput } from 'valibot'

type Frozen<Value> = Value extends readonly (infer Item)[]
  ? readonly Frozen<Item>[]
  : Value extends object
    ? { readonly [Key in keyof Value]: Frozen<Value[Key]> }
    : Value

type Stream = 'ai' | 'spawn' | 'gameplay' | 'cosmetic'
type PolicyInput = MixedPopulationRowsInput['perch'] & { attackStream: Stream }
type Policy = MixedPopulationRows['perch'] & { attackStream: Stream }

/** One shared physical pool and explicit native perch-body authority. */
interface CreaturePerchBodyInput {
  id: string
  sites: { at: [number, number, number]; base: [number, number, number] }[]
  program: unknown
  policy: PolicyInput
  projectile: {
    strike: string
    launch: InferInput<typeof BodyLaunchSchema>
    pool: BodySlotsData
  }
}
/** Defaults and serialization stay with each existing defining child schema. */
interface CreaturePerchBody {
  id: string
  sites: { at: [number, number, number]; base: [number, number, number] }[]
  program: ReturnProgramDocumentInput
  policy: Policy
  projectile: {
    strike: string
    launch: InferOutput<typeof BodyLaunchSchema>
    pool: BodySlotsData
  }
}

const ID_MAX = 128
const COORD_MAX = 250
const ZERO = 0
const ONE = 1
const TWO = 2
const SITE_MAX = 1024

const identifier = pipe(
  string(),
  regex(/^[a-z][a-z0-9.:-]*$/u),
  maxLength(ID_MAX),
)
const coordinate = pipe(
  number(),
  finite(),
  minValue(-COORD_MAX),
  maxValue(COORD_MAX),
)
const point = tuple([coordinate, coordinate, coordinate])
const native = MixedPopulationSchema.entries.perch
const rootNames = [
  ['drop', 'drop'],
  ['velocity', 'vy'],
  ['land', 'land'],
  ['climb', 'climb'],
  ['height', 'perchH'],
  ['baseX', 'bx'],
  ['baseZ', 'bz'],
  ['x', 'px'],
  ['z', 'pz'],
] as const

function validPolicy(row: Frozen<Policy>): boolean {
  const { root } = row
  const names = rootNames.every(
    ([key, name]: readonly [string, string]): boolean =>
      Reflect.get(root, key) === name,
  )
  const { actions } = row
  return (
    names &&
    root.gravity > ZERO &&
    root.speed > ZERO &&
    root.landing >= ZERO &&
    Math.abs(row.sourceHeight) <= COORD_MAX &&
    Math.abs(row.targetHeight) <= COORD_MAX &&
    actions.stateKey === 'st' &&
    actions.states.join('|') ===
      'perch|ground-idle|attack|drop|ground|return|climb' &&
    actions.actions.length === TWO &&
    new Set(
      actions.actions.map(
        (action: Frozen<Policy['actions']['actions'][number]>): string =>
          action.effect,
      ),
    ).size === TWO &&
    actions.actions.every(
      (action: Frozen<Policy['actions']['actions'][number]>): boolean =>
        (action.effect === 'bite' || action.effect === 'throw') &&
        action.state === TWO &&
        action.phase >= ZERO &&
        action.phase <= ONE &&
        action.once.key === 'hit' &&
        action.once.value === ONE &&
        action.once.test === 'falsy' &&
        action.when?.key === 'bite' &&
        action.when.test === (action.effect === 'bite' ? 'truthy' : 'falsy'),
    )
  )
}

const requiredStream = object({
  attackStream: picklist(['ai', 'spawn', 'gameplay', 'cosmetic']),
})
const policy: GenericSchema<PolicyInput, Policy> = pipe(
  intersect([native, requiredStream]),
  check<Policy, string>(
    validPolicy,
    'Existing native perch memory and body protocol',
  ),
)

const site = strictObject({ at: point, base: point })
const sites = pipe(array(site), minLength(ONE), maxLength(SITE_MAX))

/** Complete data only: native admission still verifies module bytes and references. */
const CreaturePerchBodySchema: GenericSchema<
  CreaturePerchBodyInput,
  CreaturePerchBody
> = pipe(
  strictObject({
    id: identifier,
    sites,
    program: ReturnProgramWireDocumentSchema,
    policy,
    projectile: strictObject({
      strike: identifier,
      launch: BodyLaunchSchema,
      pool: BodySlotsSchema,
    }),
  }),
  check<CreaturePerchBody, string>(
    (row: Frozen<CreaturePerchBody>): boolean =>
      row.program.script.side === 'sim' &&
      new Set(
        row.sites.map(
          (position: Frozen<CreaturePerchBody['sites'][number]>): string =>
            position.at.join(','),
        ),
      ).size === row.sites.length,
    'Unique declared perch sites and a simulation-owned return program',
  ),
)

const BODY_MAX = 64
const POOL_MAX = 128
function boundedCatalogue(rows: readonly Frozen<CreaturePerchBody>[]): boolean {
  return (
    new Set(rows.map((row: Frozen<CreaturePerchBody>): string => row.id))
      .size === rows.length &&
    rows.reduce(
      (total: number, row: Frozen<CreaturePerchBody>): number =>
        total + row.projectile.pool.count,
      ZERO,
    ) <= POOL_MAX
  )
}
/** Catalogue identities own shared bounded pools, independently of actor count. */
const CreaturePerchBodiesSchema: GenericSchema<
  CreaturePerchBodyInput[],
  CreaturePerchBody[]
> = pipe(
  array(CreaturePerchBodySchema),
  maxLength(BODY_MAX),
  check<CreaturePerchBody[], string>(
    boundedCatalogue,
    'Unique perch bodies and at most 128 physical slots',
  ),
)

interface BrainIdentity {
  readonly id: string
  readonly kind?: string
  readonly pattern?: string
}
interface BodyReference {
  readonly id: string
  readonly policy: { readonly kind: string; readonly strike: string }
}
interface SpawnReference {
  readonly brain: string | null
  readonly species?: string
  readonly strike?: string | null
  readonly home?: unknown
  readonly perchBody?: string
}
/** Reference checks run with the existing creature section before a host exists. */
function creaturePerchRules(
  content: Readonly<{
    brains: readonly BrainIdentity[]
    perchBodies?: readonly BodyReference[]
    spawns: readonly SpawnReference[]
  }>,
): string[] {
  const catalogue = new Map(
    (content.perchBodies ?? []).map(
      (row: BodyReference): readonly [string, BodyReference] => [row.id, row],
    ),
  )
  const errors: string[] = []
  for (const spawn of content.spawns) {
    if (spawn.perchBody !== undefined) {
      const authority = catalogue.get(spawn.perchBody)
      const brain = content.brains.find(
        (row: BrainIdentity): boolean => row.id === spawn.brain,
      )
      if (
        authority === undefined ||
        spawn.home === undefined ||
        authority.policy.kind !== spawn.species ||
        authority.policy.strike !== spawn.strike ||
        !(
          brain?.kind === 'perch-hunter' ||
          (brain?.kind === 'guardian' && brain.pattern === 'perch')
        )
      ) {
        errors.push('declared perch body authority')
      }
    }
  }
  return errors
}

export {
  CreaturePerchBodySchema,
  CreaturePerchBodiesSchema,
  creaturePerchRules,
  type CreaturePerchBody,
  type CreaturePerchBodyInput,
}
