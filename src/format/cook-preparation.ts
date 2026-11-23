import {
  array,
  check,
  literal,
  maxLength,
  minLength,
  minValue,
  number,
  parse,
  picklist,
  pipe,
  regex,
  safeInteger,
  strictObject,
  string,
  tuple,
  union,
} from 'valibot'

import {
  failureOf,
  fenceValid,
  preparationMarked,
  programMountValid,
} from './preparation-checks.ts'
import {
  LEGACY_PREPARATION_SPEC,
  PREPARATION_SPEC,
} from './preparation-spec.ts'
import { validationSourceBytes } from './validationReceipt.ts'

import type { OutputIndex } from './outputIndex.ts'
import type { GenericSchema } from 'valibot'

const HASH = /^[a-f0-9]{64}$/u
const MAX_LINES = 32_768
const MAX_SHADERS = 2048
const MAX_PROGRAMS = 512
const MAX_TEXT = 2_097_152
const MAX_BUILD = 160
const MAX_FENCE = 8192
const ZERO = 0
const ONE = 1
const VERSION: typeof LEGACY_PREPARATION_SPEC = LEGACY_PREPARATION_SPEC
const PROGRAM_VERSION = 2
/** Programs at spec 4: the same GLSL rows with no engine `build`. */
const SPEC_PROGRAM_VERSION = 3
const MAX_COOK_BYTES = 8_388_608

/** Actual linked GLSL pairs, not decision programs. The recorder owns provenance. */
interface EntryPrograms {
  readonly version: typeof PROGRAM_VERSION
  readonly build: string
  readonly lines: readonly string[]
  readonly shaders: readonly (readonly number[])[]
  readonly programs: readonly (readonly [number, number])[]
}
/** Spec 4's programs: a warm-up hint any engine may use or ignore; no engine build is named. */
interface SpecPrograms {
  readonly version: typeof SPEC_PROGRAM_VERSION
  readonly lines: readonly string[]
  readonly shaders: readonly (readonly number[])[]
  readonly programs: readonly (readonly [number, number])[]
}
type AnyPrograms = EntryPrograms | SpecPrograms
interface CookPreparation {
  readonly version: typeof VERSION
  readonly inputHash: string
  readonly renderer: string
  readonly packs: 'fence' | 'whole'
  readonly fence: readonly string[]
  readonly programs: EntryPrograms
}
/** Preparation spec 4 (PR4): spec 3 without the renderer fingerprint; programs without the engine build. */
interface CookSpecPreparation {
  readonly version: typeof PREPARATION_SPEC
  readonly inputHash: string
  readonly packs: 'fence' | 'whole'
  readonly fence: readonly string[]
  readonly programs: SpecPrograms
}
const natural = pipe(number(), safeInteger(), minValue(ZERO))
const shader = pipe(array(natural), maxLength(MAX_LINES))
const program = tuple([natural, natural])
const programs = pipe(array(program), maxLength(MAX_PROGRAMS))
const line = pipe(string(), maxLength(MAX_TEXT))
const lines = pipe(array(line), maxLength(MAX_LINES))
const shaders = pipe(array(shader), maxLength(MAX_SHADERS))
const build = pipe(string(), minLength(ONE), maxLength(MAX_BUILD))

function programSourceValid(row: AnyPrograms): boolean {
  let size = ZERO
  for (const text of row.lines) {
    size += text.length
  }
  return size <= MAX_TEXT
}
function programLinesValid(row: AnyPrograms): boolean {
  for (const source of row.shaders) {
    for (const index of source) {
      if (index >= row.lines.length) {
        return false
      }
    }
  }
  return true
}
function programPairsValid(row: AnyPrograms): boolean {
  const seen = new Set<string>()
  for (const pair of row.programs) {
    if (
      pair[ZERO] >= row.shaders.length ||
      pair[ONE] >= row.shaders.length ||
      seen.has(pair.join(':'))
    ) {
      return false
    }
    seen.add(pair.join(':'))
  }
  return true
}
const programRows: GenericSchema<unknown, EntryPrograms> = strictObject({
  version: literal(PROGRAM_VERSION),
  build,
  lines,
  shaders,
  programs,
})
const specProgramRows: GenericSchema<unknown, SpecPrograms> = strictObject({
  version: literal(SPEC_PROGRAM_VERSION),
  lines,
  shaders,
  programs,
})
function programChecks<Row extends AnyPrograms>(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- a valibot schema, only piped
  rows: GenericSchema<unknown, Row>,
): GenericSchema<unknown, Row> {
  return pipe(
    rows,
    check(
      (row: Row): boolean => programSourceValid(row),
      'Program source exceeds cap',
    ),
    check(
      (row: Row): boolean => programLinesValid(row),
      'Program line index is out of range',
    ),
    check(
      (row: Row): boolean => programPairsValid(row),
      'Invalid or duplicate program pair',
    ),
  )
}
const EntryProgramsSchema: GenericSchema<unknown, EntryPrograms> =
  programChecks(programRows)
const SpecProgramsSchema: GenericSchema<unknown, SpecPrograms> =
  programChecks(specProgramRows)
/** The programs mount at either spec, by its `version`. */
const AnyProgramsSchema: GenericSchema<unknown, AnyPrograms> = union([
  EntryProgramsSchema,
  SpecProgramsSchema,
])
const hash = pipe(string(), regex(HASH))
const fenceRows: GenericSchema<unknown, readonly string[]> = pipe(
  array(hash),
  maxLength(MAX_FENCE),
)
function uniqueFence(rows: readonly string[]): boolean {
  return new Set(rows).size === rows.length
}
const fence = pipe(fenceRows, check(uniqueFence, 'Duplicate fence hash'))
const CookPreparationSchema: GenericSchema<unknown, CookPreparation> & {
  readonly entries: {
    readonly [Key in keyof CookPreparation]: GenericSchema<
      unknown,
      CookPreparation[Key]
    >
  }
} = strictObject({
  version: literal(VERSION),
  inputHash: hash,
  renderer: hash,
  packs: picklist(['fence', 'whole']),
  fence,
  programs: EntryProgramsSchema,
})
const CookSpecPreparationSchema: GenericSchema<unknown, CookSpecPreparation> & {
  readonly entries: {
    readonly [Key in keyof CookSpecPreparation]: GenericSchema<
      unknown,
      CookSpecPreparation[Key]
    >
  }
} = strictObject({
  version: literal(PREPARATION_SPEC),
  inputHash: hash,
  packs: picklist(['fence', 'whole']),
  fence,
  programs: SpecProgramsSchema,
})
/** Omit only the pointer to preparation itself; all other transport/host inputs remain bound. */
type Frozen<Value> = Value extends object
  ? { readonly [Key in keyof Value]: Frozen<Value[Key]> }
  : Value
function cookPreparationBytes(
  index: Frozen<OutputIndex>,
  mounts: readonly Readonly<{
    url: string
    path: string
    hash: string
    bytes: number
  }>[],
  renderer?: string,
): Uint8Array {
  const { cook: _cook, ...inputs } = index
  return validationSourceBytes({
    index: inputs,
    mounts,
    ...(renderer === undefined ? {} : { renderer }),
  })
}
function requireCookPreparation(
  index: Frozen<OutputIndex>,
  cook:
    | Readonly<{
        version: number
        mounts: readonly Readonly<{
          url: string
          path: string
          hash: string
          bytes: number
        }>[]
        inputHash?: string
        renderer?: string
        fence?: readonly string[]
        programs?: AnyPrograms
        packs?: 'fence' | 'whole'
      }>
    | undefined,
  digest: (bytes: Readonly<Uint8Array>) => string,
): void {
  const fix = `wildshard prepare <folder> --base <exact-preview-url> (${index.identity.slug})`
  if (!preparationMarked(index, cook?.version, fix) || cook === undefined) {
    return
  }
  // SHARD-COMPAT PR5 (J487): every failing prepared part is named, not the first.
  const failures = [
    cook.inputHash ===
    digest(cookPreparationBytes(index, cook.mounts, cook.renderer))
      ? undefined
      : `stale cook preparation: run ${fix}`,
    failureOf((): void => {
      fenceValid(index, { fence: cook.fence ?? [], mounts: cook.mounts }, fix)
    }),
    failureOf((): void => {
      programMountValid(index, cook, digest)
    }),
  ].filter((row: string | undefined): row is string => row !== undefined)
  if (failures.length > ZERO) {
    throw new Error(failures.join('; '))
  }
}
/** Whether a `cook.json` is prepared, at any spec this package reads (PR4). */
function isPreparedCook(
  cook: Readonly<{ version: number }> | undefined,
): boolean {
  return preparationMarked({ sdk: '0.2' }, cook?.version, '')
}
function readEntryPrograms(input: unknown): AnyPrograms {
  return parse(AnyProgramsSchema, input)
}
export type {
  AnyPrograms,
  EntryPrograms,
  SpecPrograms,
  CookPreparation,
  CookSpecPreparation,
}
export {
  CookPreparationSchema,
  CookSpecPreparationSchema,
  EntryProgramsSchema,
  SpecProgramsSchema,
  AnyProgramsSchema,
  cookPreparationBytes,
  requireCookPreparation,
  readEntryPrograms,
  isPreparedCook,
  MAX_COOK_BYTES,
}
