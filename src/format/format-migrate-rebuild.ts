// oxlint-disable typescript/prefer-readonly-parameter-types -- the copy's index and files are rebuilt in place
/** The migration chain rebuilds a copy's inventory after its steps (SHARD-COMPAT CP1): the chain, never a step, writes
 * section hashes and sizes, packs, the declared source hash, JSON cook mounts with their rows and fence, and a
 * data-only copy's re-sealed author preparation. */
import { readCookData } from './cook-data.ts'
import { cookPreparationBytes } from './cook-preparation.ts'
import {
  listed,
  listedRows,
  readJson,
  record,
  rows,
} from './format-migrate-inventory.ts'
import { assembleOutputShardfile } from './outputIndex.ts'
import { asWrittenIdentity } from './save-revision.ts'
import { validationSourceBytes } from './validationReceipt.ts'

import type { Hash, JsonRecord, Listed } from './format-migrate-inventory.ts'
import type { MigratingShard } from './format-migrations.ts'
import type { OutputIndex } from './outputIndex.ts'

/** The copy being written: its index (edited in place) and its files (edited in place). */
interface Copy {
  readonly index: JsonRecord
  readonly out: Map<string, Uint8Array>
  readonly hash: Hash
}

/** How the copy's cook is rebuilt: each JSON mount's text as read (a changed one is written again), and whether the
 * original's preparation is re-sealed (prepared, and no step changes what renders). */
interface CookPlan {
  readonly mountText: ReadonlyMap<string, string>
  readonly reseal: boolean
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
    validationSourceBytes(
      asWrittenIdentity(source, copy.index['formatVersion']),
    ),
  )
}

/** The copy's cook file, read from the copy as rebuilt so far. */
function cookFile(copy: Readonly<Copy>): { path: string; raw: JsonRecord } {
  const { path } = listed(record(copy.index['cook'], 'cook'))
  return { path, raw: record(readJson(copy.out, path), 'cook.json') }
}

/** Write the cook file again and its index row. */
function writeCook(copy: Readonly<Copy>, path: string, raw: JsonRecord): void {
  const bytes = validationSourceBytes(raw)
  copy.out.set(path, bytes)
  Object.assign(record(copy.index['cook'], 'cook'), {
    hash: copy.hash(bytes),
    bytes: bytes.length,
  })
}

/** Write each JSON mount a step changed; the old hash to the new row, by path. */
function writeMounts(
  copy: Readonly<Copy>,
  shard: Readonly<MigratingShard>,
  mountText: ReadonlyMap<string, string>,
): Map<string, Readonly<{ hash: string; bytes: number }>> {
  const swapped = new Map<string, Readonly<{ hash: string; bytes: number }>>()
  for (const [path, value] of shard.mounts) {
    const text = JSON.stringify(value)
    if (text !== mountText.get(path)) {
      const bytes = new TextEncoder().encode(text)
      copy.out.set(path, bytes)
      swapped.set(path, { hash: copy.hash(bytes), bytes: bytes.length })
    }
  }
  return swapped
}

/** Point each cook row at its mount's new bytes and each fence entry at the new hash. */
function swapCookRows(
  raw: JsonRecord,
  swapped: ReadonlyMap<string, Readonly<{ hash: string; bytes: number }>>,
): void {
  const hashes = new Map<string, string>()
  for (const row of rows(raw['mounts'])) {
    const now = swapped.get(String(row['path']))
    if (now !== undefined) {
      hashes.set(String(row['hash']), now.hash)
      Object.assign(row, now)
    }
  }
  const { fence } = raw
  if (Array.isArray(fence)) {
    raw['fence'] = fence.map((row: unknown): unknown =>
      typeof row === 'string' ? (hashes.get(row) ?? row) : row,
    )
  }
}

/** Write each changed JSON mount, then its cook rows and its fence entry by the new hash. */
function rebuildMounts(
  copy: Readonly<Copy>,
  shard: Readonly<MigratingShard>,
  mountText: ReadonlyMap<string, string>,
): void {
  const swapped = writeMounts(copy, shard, mountText)
  if (swapped.size === NO_BYTES) {
    return
  }
  const { path, raw } = cookFile(copy)
  swapCookRows(raw, swapped)
  writeCook(copy, path, raw)
}

/** Re-seal a prepared file's input hash over the rebuilt index and mounts; its fence and programs stand. */
function resealPreparation(copy: Readonly<Copy>): void {
  const { path, raw } = cookFile(copy)
  const cook = readCookData(raw)
  const renderer = 'renderer' in cook ? cook.renderer : undefined
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the rebuilt index, read only for its preparation bytes
  const index = copy.index as unknown as OutputIndex
  raw['inputHash'] = copy.hash(
    cookPreparationBytes(index, cook.mounts, renderer),
  )
  writeCook(copy, path, raw)
}

/** Sections, packs and the source hash, then the cook's JSON mounts and a data-only copy's re-sealed preparation. */
function rebuildInventory(
  copy: Readonly<Copy>,
  shard: Readonly<MigratingShard>,
  cook: Readonly<CookPlan>,
): void {
  rebuildPacks(copy, rebuildSections(copy, shard))
  rebuildSourceHash(copy, shard)
  rebuildMounts(copy, shard, cook.mountText)
  if (cook.reseal) {
    resealPreparation(copy)
  }
}

export { type CookPlan, type Copy, rebuildInventory }
