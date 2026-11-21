/** The migration chain's view of an original's inventory (SHARD-COMPAT CP1). It reads `shard.json` as plain JSON, never
 * through the current schema, so an older shape is read before it is migrated. */
import { readCanonicalJson } from './shardfileValidation.ts'

type Files = ReadonlyMap<string, Uint8Array>
type Hash = (bytes: Readonly<Uint8Array>) => string
type JsonRecord = Record<string, unknown>

interface Listed {
  readonly path: string
  readonly hash: string
  readonly bytes: number
}

const INDEX = 'shard.json'
const RECEIPT = 'validation.json'

/** A plain JSON object, kept by reference so a step's edit lands in the copy. */
function record(value: unknown, where: string): JsonRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`Migration input needs an object at ${where}`)
  }
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- checked a plain object just above; edits stay in place
  return value as JsonRecord
}
function rows(value: unknown): readonly JsonRecord[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.map((row: unknown): JsonRecord =>
    record(row, 'an inventory row'),
  )
}
function listed(row: Readonly<JsonRecord>, size = 'bytes'): Listed {
  const { path, hash } = row
  const bytes = row[size]
  if (
    typeof path !== 'string' ||
    typeof hash !== 'string' ||
    typeof bytes !== 'number'
  ) {
    throw new TypeError('Migration input has a malformed inventory row')
  }
  return { path, hash, bytes }
}
function listedRows(value: unknown, size = 'bytes'): readonly Listed[] {
  return rows(value).map((row: Readonly<JsonRecord>): Listed =>
    listed(row, size),
  )
}
function optionalRecord(value: unknown, where: string): JsonRecord {
  return value === undefined || value === null ? {} : record(value, where)
}

/** Every byte the index and its cook file's mounts list, packs aside. */
function inventory(
  index: Readonly<JsonRecord>,
  cook: Readonly<JsonRecord> | undefined,
): readonly Listed[] {
  const admission = optionalRecord(index['admission'], 'admission')
  const runtime = optionalRecord(index['runtime'], 'runtime')
  const cookRow =
    index['cook'] === undefined ? [] : [listed(record(index['cook'], 'cook'))]
  return [
    ...listedRows(index['sections']),
    ...listedRows(index['schemas']),
    ...listedRows(index['files'], 'compressed'),
    ...listedRows(admission['server']),
    ...listedRows(runtime['files']),
    ...cookRow,
    ...listedRows(cook?.['mounts']),
  ]
}

/** Refuse a missing, changed or unlisted byte before any step runs. A tarball may leave a pack out, since its members
 * ship anyway; a carried pack is checked like any listed file. */
function verifyInventory(
  files: Files,
  {
    index,
    cook,
  }: Readonly<{
    index: Readonly<JsonRecord>
    cook: Readonly<JsonRecord> | undefined
  }>,
  hash: Hash,
): void {
  const carried = listedRows(index['packs']).filter(
    (row: Readonly<Listed>): boolean => files.has(row.path),
  )
  const seen = new Set([INDEX, RECEIPT])
  for (const entry of [...inventory(index, cook), ...carried]) {
    const bytes = files.get(entry.path)
    if (bytes?.length !== entry.bytes || hash(bytes) !== entry.hash) {
      throw new Error(`Original hash or size mismatch: ${entry.path}`)
    }
    seen.add(entry.path)
  }
  for (const path of files.keys()) {
    if (!seen.has(path)) {
      throw new Error(`Unlisted original file: ${path}`)
    }
  }
}

function readJson(files: Files, path: string): unknown {
  const bytes = files.get(path)
  if (bytes === undefined) {
    throw new Error(`Original lacks ${path}`)
  }
  return readCanonicalJson(bytes)
}

/** Each section's payload by name. */
function readSections(
  files: Files,
  index: Readonly<JsonRecord>,
): Map<string, unknown> {
  const sections = new Map<string, unknown>()
  for (const row of rows(index['sections'])) {
    if (typeof row['name'] === 'string') {
      sections.set(row['name'], readJson(files, listed(row).path))
    }
  }
  return sections
}

export {
  INDEX,
  RECEIPT,
  type Files,
  type Hash,
  type JsonRecord,
  type Listed,
  listed,
  listedRows,
  readJson,
  readSections,
  record,
  rows,
  verifyInventory,
}
