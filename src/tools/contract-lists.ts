import { SHARDFILE_ADMISSION_LIMITS } from '../format/admissionLimits.ts'
import {
  CLIENT_FEATURE_SIDES,
  WORLD_ASSEMBLY_STAGE_SIDES,
} from '../format/feature-sides.ts'
import { NativeAssemblySchema } from '../format/nativeAssembly.ts'
import { NativeRuntimePlanSchema } from '../format/nativeRuntimePlan.ts'
import { OUTPUT_SECTIONS } from '../format/outputFields.ts'
import { PLATFORM_DATA_SECTIONS } from '../format/platformDataSections.ts'
import { PLATFORM_FILE_FAMILIES } from '../format/platformFileFamilies.ts'
import { SCRIPT_ABI } from '../format/scriptAbi.ts'
import { SCRIPT_V1_LAYOUT } from '../format/scriptAbiV1.ts'

import type { SideEntry } from '../format/feature-sides.ts'

// SHARD-AUTHORING SA19: every list docs/RUNTIME-CONTRACT.md publishes, read from shard-format's own code.

/** The step of a `pipe(unknown, check, object)` schema that holds the object. */
const OBJECT_STEP = 2

/** One `client/plan` kind or `world.assembly` stage and its declared side. */
interface Sided {
  readonly kind: string
  readonly side: SideEntry
}

/** One limit a shard-format constant holds. */
interface Limit {
  readonly constant: string
  readonly key: string
  readonly value: string
}

/** One registered named-file family. */
interface Family {
  readonly pattern: string
  readonly schema: string
}

/** An own property of a plain object, or `undefined`. */
function propOf(value: unknown, key: string): unknown {
  if (
    typeof value !== 'object' ||
    value === null ||
    !Object.hasOwn(value, key)
  ) {
    return undefined
  }
  const found: unknown = Reflect.get(value, key)
  return found
}

/** An own array property of a plain object, or an empty list. */
function listOf(value: unknown, key: string): readonly unknown[] {
  const list = propOf(value, key)
  return Array.isArray(list) ? list : []
}

/** The string values a valibot literal or picklist schema admits. */
function literals(schema: unknown): string[] {
  const literal = propOf(schema, 'literal')
  if (typeof literal === 'string') {
    return [literal]
  }
  return listOf(schema, 'options').filter(
    (option: unknown): option is string => typeof option === 'string',
  )
}

/** The object entries of a `pipe(unknown, check, object)` schema. */
function pipedEntries(schema: unknown): unknown {
  const steps = listOf(schema, 'pipe')
  return propOf(steps[OBJECT_STEP], 'entries')
}

/** Every platform section name, sorted. */
function sectionNames(): string[] {
  const roots = OUTPUT_SECTIONS.map((row): string => row.name)
  return [...roots, ...Object.keys(PLATFORM_DATA_SECTIONS)].toSorted()
}

/** What one section file holds: its root fields, a row table, spawns or a plain value. */
function sectionHolds(name: string): readonly string[] | 'plain' {
  const mapping = OUTPUT_SECTIONS.find((row): boolean => row.name === name)
  if (mapping === undefined) {
    return 'plain'
  }
  if (mapping.row !== undefined) {
    return [`rows.${mapping.row}`]
  }
  if (mapping.spawns === true) {
    return ['runtime.spawns']
  }
  return mapping.fields
}

/** Sort sided rows by kind. */
function byKind(rows: readonly Sided[]): Sided[] {
  return rows.toSorted((left, right): number =>
    left.kind.localeCompare(right.kind),
  )
}

/** Every `client/plan` feature kind with its side, sorted. */
function clientPlanKinds(): Sided[] {
  const rows = Object.entries(CLIENT_FEATURE_SIDES).map(
    ([kind, side]: readonly [string, SideEntry]): Sided => ({ kind, side }),
  )
  return byKind(rows)
}

/** Every `world.assembly` stage kind with its side, sorted. */
function assemblyStages(): Sided[] {
  const rows = Object.entries(WORLD_ASSEMBLY_STAGE_SIDES).map(
    ([kind, side]: readonly [string, SideEntry]): Sided => ({ kind, side }),
  )
  return byKind(rows)
}

/** Every `server/native-assembly.json` feature host name, sorted. */
function nativeAssemblyHosts(): string[] {
  const features = propOf(pipedEntries(NativeAssemblySchema), 'features')
  const options = listOf(propOf(features, 'item'), 'options')
  const hosts = options.flatMap((option: unknown): string[] => {
    const host = propOf(propOf(option, 'entries'), 'host')
    return literals(host)
  })
  return [...new Set(hosts)].toSorted()
}

/** The `kind` values `sim/runtime-plan` admits. */
function runtimePlanKinds(): string[] {
  return literals(propOf(pipedEntries(NativeRuntimePlanSchema), 'kind'))
}

/** Every registered named-file family, in registry order. */
function fileFamilies(): Family[] {
  const rows: Family[] = []
  for (const family of PLATFORM_FILE_FAMILIES) {
    rows.push({ pattern: family.pattern.source, schema: family.source })
  }
  return rows
}

/** One limit per key of one constant. */
function limitsOf(
  constant: string,
  values: Readonly<Record<string, number | string>>,
): Limit[] {
  const entries = Object.entries(values)
  return entries.map(
    ([key, value]: readonly [string, number | string]): Limit => ({
      constant,
      key,
      value: String(value),
    }),
  )
}

/** The limits shard-format holds as constants. */
function constantLimits(): Limit[] {
  return [
    ...limitsOf('SHARDFILE_ADMISSION_LIMITS', SHARDFILE_ADMISSION_LIMITS),
    ...limitsOf('SCRIPT_V1_LAYOUT', SCRIPT_V1_LAYOUT),
    ...limitsOf('SCRIPT_ABI', SCRIPT_ABI),
  ]
}

export {
  assemblyStages,
  clientPlanKinds,
  constantLimits,
  fileFamilies,
  nativeAssemblyHosts,
  runtimePlanKinds,
  sectionHolds,
  sectionNames,
}
export type { Family, Limit, Sided }
