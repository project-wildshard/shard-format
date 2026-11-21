// oxlint-disable typescript/prefer-readonly-parameter-types -- the copy's index and files are rebuilt in place
/** The migration chain rebuilds a copy's inventory after its steps (SHARD-COMPAT CP1): the chain, never a step, writes
 * section hashes and sizes, packs, the declared source hash and a data-only copy's re-sealed author preparation. */
import { cookPreparationBytes } from './cook-preparation.ts'
import {
  listed,
  listedRows,
  readJson,
  record,
  rows,
} from './format-migrate-inventory.ts'
import { assembleOutputShardfile } from './outputIndex.ts'
import { validationSourceBytes } from './validationReceipt.ts'

import type { CookData } from './cook-data.ts'
import type { Hash, JsonRecord, Listed } from './format-migrate-inventory.ts'
import type { MigratingShard } from './format-migrations.ts'
import type { OutputIndex } from './outputIndex.ts'

/** The copy being written: its index (edited in place) and its files (edited in place). */
interface Copy {
  readonly index: JsonRecord
  readonly out: Map<string, Uint8Array>
  readonly hash: Hash
}

const NO_BYTES = 0

/** A step may rewrite or delete a section; adding one waits for FE8's moveSection. */
function refuseNewSections(
  copy: Readonly<Copy>,
  shard: Readonly<MigratingShard>,
): void {
  const names = new Set(
    rows(copy.index['sections']).map((row: Readonly<JsonRecord>): string =>
      String(row['name']),
    ),
  )
  for (const name of shard.sections.keys()) {
    if (!names.has(name)) {
      throw new Error(`A new section needs FE8's moveSection: ${name}`)
    }
  }
}

/** Write one section again, or drop it; the old and new hash when it stays. */
function rewriteSection(
  copy: Readonly<Copy>,
  shard: Readonly<MigratingShard>,
  row: JsonRecord,
): readonly [string, string] | undefined {
  const old = listed(row)
  const name = String(row['name'])
  if (!shard.sections.has(name)) {
    copy.out.delete(old.path)
    return undefined
  }
  const bytes = validationSourceBytes(shard.sections.get(name))
  const now = copy.hash(bytes)
  copy.out.set(old.path, bytes)
  Object.assign(row, { hash: now, bytes: bytes.length })
  return [old.hash, now]
}

/** Write each section again and return each old section hash's new one; a section a step deleted leaves. */
function rebuildSections(
  copy: Readonly<Copy>,
  shard: Readonly<MigratingShard>,
): Map<string, string> {
  refuseNewSections(copy, shard)
  const swapped = new Map<string, string>()
  const kept: JsonRecord[] = []
  for (const row of rows(copy.index['sections'])) {
    const moved = rewriteSection(copy, shard, row)
    if (moved !== undefined) {
      swapped.set(...moved)
      kept.push(row)
    }
  }
  copy.index['sections'] = kept
  return swapped
}

/** Every pack member's bytes by hash: sections as rebuilt, schemas and files as they are. */
function members(copy: Readonly<Copy>): Map<string, Uint8Array> {
  const found = new Map<string, Uint8Array>()
  const all: readonly Listed[] = [
    ...listedRows(copy.index['sections']),
    ...listedRows(copy.index['schemas']),
    ...listedRows(copy.index['files'], 'compressed'),
  ]
  for (const row of all) {
    const bytes = copy.out.get(row.path)
    if (bytes !== undefined) {
      found.set(row.hash, bytes)
    }
  }
  return found
}

function joinParts(
  parts: readonly Readonly<Uint8Array>[],
  hash: Hash,
): { joined: Uint8Array; entries: JsonRecord[] } {
  const joined = new Uint8Array(
    parts.reduce(
      (total: number, part: Readonly<Uint8Array>): number =>
        total + part.length,
      NO_BYTES,
    ),
  )
  let offset = NO_BYTES
  const entries = parts.map((part: Readonly<Uint8Array>): JsonRecord => {
    const entry = { hash: hash(part), offset, bytes: part.length }
    joined.set(part, offset)
    offset += part.length
    return entry
  })
  return { joined, entries }
}

/** Concatenate each pack again from its members, a rewritten section by its new bytes. A pack the original carried is
 * written again; one it left out stays out, listed with its new identity. */
function rebuildPacks(
  copy: Readonly<Copy>,
  swapped: ReadonlyMap<string, string>,
): void {
  const found = members(copy)
  for (const pack of rows(copy.index['packs'])) {
    const old = listed(pack)
    const parts = rows(pack['entries']).map(
      (entry: Readonly<JsonRecord>): Uint8Array => {
        const was = String(entry['hash'])
        const bytes = found.get(swapped.get(was) ?? was)
        if (bytes === undefined) {
          throw new Error(
            `Pack member outside its listed inventory: ${old.path}`,
          )
        }
        return bytes
      },
    )
    const { joined, entries } = joinParts(parts, copy.hash)
    const packHash = copy.hash(joined)
    const path = `blobs/pack/${packHash}.pack`
    if (copy.out.delete(old.path)) {
      copy.out.set(path, joined)
    }
    Object.assign(pack, { path, hash: packHash, bytes: joined.length, entries })
  }
}

/** The declared source hash over the copy's assembled shard, as the validator computes it. */
function rebuildSourceHash(
  copy: Readonly<Copy>,
  shard: Readonly<MigratingShard>,
): void {
  const source = assembleOutputShardfile(copy.index, shard.sections)
  record(copy.index['build'], 'build')['sourceHash'] = copy.hash(
    validationSourceBytes(source),
  )
}

/** Re-seal a prepared file's input hash over the rebuilt index; its fence and programs are unchanged. */
function resealPreparation(
  copy: Readonly<Copy>,
  cook: Readonly<CookData>,
): void {
  const row = record(copy.index['cook'], 'cook')
  const { path } = listed(row)
  const raw = record(readJson(copy.out, path), 'cook.json')
  const renderer = 'renderer' in cook ? cook.renderer : undefined
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the rebuilt index, read only for its preparation bytes
  const index = copy.index as unknown as OutputIndex
  raw['inputHash'] = copy.hash(
    cookPreparationBytes(index, cook.mounts, renderer),
  )
  const bytes = validationSourceBytes(raw)
  copy.out.set(path, bytes)
  Object.assign(row, { hash: copy.hash(bytes), bytes: bytes.length })
}

/** Sections, packs and the source hash, then a data-only copy's re-sealed preparation (`reseal`, the cook to re-seal). */
function rebuildInventory(
  copy: Readonly<Copy>,
  shard: Readonly<MigratingShard>,
  reseal: Readonly<CookData> | undefined,
): void {
  rebuildPacks(copy, rebuildSections(copy, shard))
  rebuildSourceHash(copy, shard)
  if (reseal !== undefined) {
    resealPreparation(copy, reseal)
  }
}

export { type Copy, rebuildInventory }
