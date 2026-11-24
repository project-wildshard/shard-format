import {
  array,
  exactOptional,
  literal,
  maxLength,
  number,
  parse,
  pipe,
  regex,
  safeInteger,
  strictObject,
  variant,
  string,
} from 'valibot'

import {
  CookPreparationSchema,
  CookSpecPreparationSchema,
} from './cook-preparation.ts'

import type {
  CookPreparation,
  CookSpecPreparation,
} from './cook-preparation.ts'
import type { GenericSchema } from 'valibot'

// C0 (J137, D5): what makes a shardfile stand alone, in one file beside
// its index, so `shard.json`, which every boot reads, grows by one row.
// `mounts` are the shard's own files that its sections and boot tables
// name by a public URL: the bytes travel in the product under `mounts/`
// and the cook publishes each one at its URL. `packs` and `fence` are
// optional only on legacy version 1, which only an unprepared draft writes
// (`wildshard build` before `wildshard prepare`). Version 2 is gone
// (FORMAT-PRUNE FP23: no kept original or engine pin used it); version 3
// on requires J198 preparation.

interface CookMount {
  readonly url: string
  readonly path: string
  readonly hash: string
  readonly bytes: number
}

interface LegacyCookData {
  readonly version: typeof COOK_DATA_VERSION
  readonly mounts: readonly CookMount[]
  /** 'fence' packs what the boot reads before control; unset, the whole level. */
  readonly packs?: 'fence'
  /** The stable identities a recorded cold boot read before control. */
  readonly fence?: readonly string[]
}

const COOK_DATA_PATH = 'cook.json'
const COOK_DATA_VERSION = 1
const PATH_LIMIT = 240
const IDENTITY_LIMIT = 512
const ROW_LIMIT = 8192

const boundedPath: GenericSchema<unknown, string> = pipe(
  string(),
  maxLength(PATH_LIMIT),
)

const publicUrl: GenericSchema<unknown, string> = pipe(
  boundedPath,
  regex(/^(?:\/[a-zA-Z0-9_-][a-zA-Z0-9_.-]*)+$/u),
)

// A mount's bytes sit under `mounts/`, or in the listed blob they equal, so a
// shardfile holds a file once however many URLs serve it.
const mountPath: GenericSchema<unknown, string> = pipe(
  boundedPath,
  regex(/^(?:mounts|blobs)\//u),
)

const sha256Hex: GenericSchema<unknown, string> = pipe(
  string(),
  regex(/^[a-f0-9]{64}$/u),
)

const byteCount: GenericSchema<unknown, number> = pipe(number(), safeInteger())

const mountRow: GenericSchema<unknown, CookMount> = strictObject({
  url: publicUrl,
  path: mountPath,
  hash: sha256Hex,
  bytes: byteCount,
})

const mountRows: GenericSchema<unknown, CookMount[]> = pipe(
  array(mountRow),
  maxLength(ROW_LIMIT),
)

const identity: GenericSchema<unknown, string> = pipe(
  string(),
  maxLength(IDENTITY_LIMIT),
)

const identities: GenericSchema<unknown, string[]> = pipe(
  array(identity),
  maxLength(ROW_LIMIT),
)

const LegacyCookDataSchema = strictObject({
  version: literal(COOK_DATA_VERSION),
  mounts: mountRows,
  packs: exactOptional(literal('fence')),
  fence: exactOptional(identities),
})

const PreparedCookDataSchema = strictObject({
  ...CookPreparationSchema.entries,
  mounts: mountRows,
})
/** SHARD-COMPAT PR4: preparation spec 4, which names no engine. */
const SpecCookDataSchema = strictObject({
  ...CookSpecPreparationSchema.entries,
  mounts: mountRows,
})
interface PreparedCookData extends CookPreparation {
  readonly mounts: readonly CookMount[]
}
interface SpecCookData extends CookSpecPreparation {
  readonly mounts: readonly CookMount[]
}
type CookData = LegacyCookData | PreparedCookData | SpecCookData
const CookDataSchema: GenericSchema<unknown, CookData> = variant('version', [
  LegacyCookDataSchema,
  PreparedCookDataSchema,
  SpecCookDataSchema,
])

/** Where a mount's bytes sit in a product. */
function cookMountPath(url: string): string {
  return `mounts${url}`
}

function readCookData(input: unknown): CookData {
  const data = parse(CookDataSchema, input)
  const urls = data.mounts.map((row: Readonly<CookMount>): string => row.url)
  if (new Set(urls).size !== urls.length) {
    throw new Error('A mount URL is listed twice')
  }
  return data
}

/** SHARD-COMPAT SP1b1a: `cook.json`'s version alone, read without its rows, so a reader can name a newer spec
 * (`unreadPreparationSpec`) before `readCookData` refuses it. `undefined` when it names no integer version. */
function cookDataSpec(input: unknown): number | undefined {
  if (typeof input !== 'object' || input === null) {
    return undefined
  }
  const version: unknown = (input as { version?: unknown }).version
  return typeof version === 'number' && Number.isInteger(version)
    ? version
    : undefined
}

export type { CookData, CookMount }
export {
  COOK_DATA_PATH,
  CookDataSchema,
  cookDataSpec,
  cookMountPath,
  readCookData,
}
