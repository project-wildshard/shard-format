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
} from 'valibot'

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
const VERSION = 3
const PROGRAM_VERSION = 2
const MAX_COOK_BYTES = 8_388_608

/** Actual linked GLSL pairs, not decision programs. The recorder owns provenance. */
interface EntryPrograms {
  readonly version: typeof PROGRAM_VERSION
  readonly build: string
  readonly lines: readonly string[]
  readonly shaders: readonly (readonly number[])[]
  readonly programs: readonly (readonly [number, number])[]
}
interface CookPreparation {
  readonly version: typeof VERSION
  readonly inputHash: string
  readonly renderer: string
  readonly packs: 'fence' | 'whole'
  readonly fence: readonly string[]
  readonly programs: EntryPrograms
}
const natural = pipe(number(), safeInteger(), minValue(ZERO))
const shader = pipe(array(natural), maxLength(MAX_LINES))
const program = tuple([natural, natural])
const programs = pipe(array(program), maxLength(MAX_PROGRAMS))
const line = pipe(string(), maxLength(MAX_TEXT))
const lines = pipe(array(line), maxLength(MAX_LINES))
const shaders = pipe(array(shader), maxLength(MAX_SHADERS))
const build = pipe(string(), minLength(ONE), maxLength(MAX_BUILD))

function programSourceValid(row: EntryPrograms): boolean {
  let size = ZERO
  for (const text of row.lines) {
    size += text.length
  }
  return size <= MAX_TEXT
}
function programLinesValid(row: EntryPrograms): boolean {
  for (const source of row.shaders) {
    for (const index of source) {
      if (index >= row.lines.length) {
        return false
      }
    }
  }
  return true
}
function programPairsValid(row: EntryPrograms): boolean {
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
const EntryProgramsSchema: GenericSchema<unknown, EntryPrograms> = pipe(
  programRows,
  check(programSourceValid, 'Program source exceeds cap'),
  check(programLinesValid, 'Program line index is out of range'),
  check(programPairsValid, 'Invalid or duplicate program pair'),
)
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
/** Shared by admission and the cook. Legacy sdk 0.2 is an explicit migration boundary. */
function fenceValid(
  index: Frozen<OutputIndex>,
  lists: Readonly<{
    fence: readonly string[]
    mounts: readonly Readonly<{ hash: string }>[]
  }>,
  fix: string,
): void {
  const known = new Set<string>()
  for (const file of index.files) {
    known.add(file.hash)
  }
  for (const mount of lists.mounts) {
    known.add(mount.hash)
  }
  for (const row of lists.fence) {
    if (!known.has(row) && !index.requires.commons.includes(row)) {
      throw new Error(`stale fence preparation: run ${fix}`)
    }
  }
}
function programMountValid(
  index: Frozen<OutputIndex>,
  cook: {
    readonly programs?: EntryPrograms
    readonly mounts: readonly Readonly<{ url: string; hash: string }>[]
  },
  digest: (bytes: Readonly<Uint8Array>) => string,
): void {
  const url = `/programs/${index.identity.slug}.json`
  const mount = cook.mounts.find(
    (row: Readonly<{ url: string; hash: string }>): boolean => row.url === url,
  )
  if (
    cook.programs === undefined ||
    mount?.hash !== digest(validationSourceBytes(cook.programs))
  ) {
    throw new Error(
      `stale GLSL program mount: run wildshard prepare <product-dir> --base <exact-preview-url> (${index.identity.slug})`,
    )
  }
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
        programs?: EntryPrograms
        packs?: 'fence' | 'whole'
      }>
    | undefined,
  digest: (bytes: Readonly<Uint8Array>) => string,
): void {
  const fix = `wildshard prepare <product-dir> --base <exact-preview-url> (${index.identity.slug})`
  if (index.sdk === '0.2' && cook?.version !== VERSION) {
    return
  }
  if (cook?.version !== VERSION) {
    throw new Error(`Missing cook preparation: run ${fix}`)
  }
  if (
    cook.inputHash !==
    digest(cookPreparationBytes(index, cook.mounts, cook.renderer))
  ) {
    throw new Error(`stale cook preparation: run ${fix}`)
  }
  fenceValid(index, { fence: cook.fence ?? [], mounts: cook.mounts }, fix)
  programMountValid(index, cook, digest)
}
function readEntryPrograms(input: unknown): EntryPrograms {
  return parse(EntryProgramsSchema, input)
}
export type { EntryPrograms, CookPreparation }
export {
  CookPreparationSchema,
  EntryProgramsSchema,
  cookPreparationBytes,
  requireCookPreparation,
  readEntryPrograms,
  MAX_COOK_BYTES,
}
