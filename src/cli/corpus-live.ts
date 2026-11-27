import { array, number, object, optional, parse, string } from 'valibot'

import type { Pin } from './corpus-pins.ts'
import type { StoredRecord } from './corpus.ts'

// ZONE-SNAPSHOTS ZS3 (J507): the corpus counts only what players load. Live is what the signed release files name and
// the signed placements place (public at packs.wildshard.io/releases/, the files api-server's prune reads), plus
// engine's pins (the next release's). The API keeps more: each live revision's 3 earlier revisions as rollback copies
// (api-server ZS2), which roll back with their engine release and never count as users, and whatever a channel's own
// pointer still names (`/api/catalogue.json`). A listed original that is none of these is store drift: the prune
// should have taken it, and the corpus fails.

/** Rollback copies kept before each live revision (api-server ZS2's `KEEP_BACK`). */
const KEEP_BACK = 3
const CHANNELS = ['production', 'staging', 'preview']
const RELEASE_CHANNELS = ['staging', 'production']
const FETCH_TIMEOUT_MS = 60_000
const NO_REVISION = 0
const FIRST = 0
const HeadSchema = object({ hash: optional(string()) })
const CatalogueSchema = object({ shards: array(HeadSchema) })
const SignedSchema = object({ body: string() })
const ReleaseShard = object({
  slug: string(),
  uploadNumber: optional(number()),
  revision: optional(number()),
  hash: optional(string()),
})
const ReleaseSchema = object({ shards: array(ReleaseShard) })
const PlacementSchema = object({ cells: array(HeadSchema) })

interface Kept {
  readonly live: readonly StoredRecord[]
  readonly rollback: readonly StoredRecord[]
  readonly pointed: readonly StoredRecord[]
  readonly drift: readonly StoredRecord[]
}

/** What decides a listed original's kind: the live hashes, engine's pins and a channel's own pointers. */
interface KeptBy {
  readonly live: ReadonlySet<string>
  readonly pins: readonly Readonly<Pin>[]
  readonly pointed: ReadonlySet<string>
}

interface Anchor {
  readonly slug: string
  readonly revision: number
}

function slugOf(stored: StoredRecord): string {
  return stored.revisions.at(FIRST)?.shard ?? ''
}

function revisionOf(stored: StoredRecord): number {
  return stored.revisions.at(FIRST)?.revision ?? NO_REVISION
}

function between(
  others: readonly number[],
  revision: number,
  anchor: Anchor,
): number {
  return others.filter(
    (other: number): boolean => other > revision && other < anchor.revision,
  ).length
}

/** Whether `stored` is one of the `KEEP_BACK` listed revisions before a live revision of its shard. */
function isRollback(
  stored: StoredRecord,
  listed: readonly StoredRecord[],
  anchors: readonly Anchor[],
): boolean {
  const slug = slugOf(stored)
  const revision = revisionOf(stored)
  const others = listed
    .filter((other: StoredRecord): boolean => slugOf(other) === slug)
    .map((other: StoredRecord): number => revisionOf(other))
  return anchors.some(
    (anchor: Anchor): boolean =>
      anchor.slug === slug &&
      anchor.revision > revision &&
      between(others, revision, anchor) < KEEP_BACK,
  )
}

function anchorsOf(
  listed: readonly StoredRecord[],
  by: Readonly<KeptBy>,
): readonly Anchor[] {
  const pinned = by.pins.map((pin: Readonly<Pin>): Anchor => ({
    slug: pin.slug,
    revision: pin.revision,
  }))
  const live = listed
    .filter((stored: StoredRecord): boolean => by.live.has(stored.hash))
    .map((stored: StoredRecord): Anchor => ({
      slug: slugOf(stored),
      revision: revisionOf(stored),
    }))
  return [...pinned, ...live]
}

/** Sort the API's listed originals: live, rollback copies, still pointed at by a channel, or drift. */
function classifyKept(
  listed: readonly StoredRecord[],
  by: Readonly<KeptBy>,
): Kept {
  const anchors = anchorsOf(listed, by)
  const kept: Record<keyof Kept, StoredRecord[]> = {
    live: [],
    rollback: [],
    pointed: [],
    drift: [],
  }
  for (const stored of listed) {
    if (by.live.has(stored.hash)) {
      kept.live.push(stored)
    } else if (isRollback(stored, listed, anchors)) {
      kept.rollback.push(stored)
    } else if (by.pointed.has(stored.hash)) {
      kept.pointed.push(stored)
    } else {
      kept.drift.push(stored)
    }
  }
  return kept
}

async function signedBody(url: string, get: typeof fetch): Promise<unknown> {
  const answer = await get(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!answer.ok) {
    throw new Error(`${url}: HTTP ${String(answer.status)}`)
  }
  const signed = parse(SignedSchema, await answer.json())
  const body: unknown = JSON.parse(signed.body)
  return body
}

/** One channel's live hashes: its release file's shards (by hash, or by revision in the API's list) and its placement's
 * cells. */
async function channelHashes(
  url: string,
  byRevision: ReadonlyMap<string, string>,
  get: typeof fetch,
): Promise<readonly string[]> {
  const release = parse(ReleaseSchema, await signedBody(`${url}.json`, get))
  const placed = parse(
    PlacementSchema,
    await signedBody(`${url}-placements.json`, get),
  )
  const named = release.shards.map(
    (
      shard: Readonly<{
        slug: string
        uploadNumber?: number | undefined
        revision?: number | undefined
        hash?: string | undefined
      }>,
    ): string | undefined =>
      shard.hash ??
      byRevision.get(
        `${shard.slug}@${String(shard.uploadNumber ?? shard.revision)}`,
      ),
  )
  const cells = placed.cells.map(
    (cell: Readonly<{ hash?: string | undefined }>): string | undefined =>
      cell.hash,
  )
  return [...named, ...cells].filter(
    (hash: string | undefined): hash is string => hash !== undefined,
  )
}

/** The hashes players load: each signed release file's shards and placement's cells, and engine's pins. */
async function liveHashes(
  input: Readonly<{
    packs: string
    listed: readonly StoredRecord[]
    pins: readonly Readonly<Pin>[]
  }>,
  get: typeof fetch = fetch,
): Promise<ReadonlySet<string>> {
  const byRevision = new Map(
    input.listed.map((stored: StoredRecord): readonly [string, string] => [
      `${slugOf(stored)}@${String(revisionOf(stored))}`,
      stored.hash,
    ]),
  )
  const channels = await Promise.all(
    RELEASE_CHANNELS.map(
      async (channel: string): Promise<readonly string[]> =>
        await channelHashes(
          `${input.packs}/releases/${channel}`,
          byRevision,
          get,
        ),
    ),
  )
  const pinned = input.pins.map((pin: Readonly<Pin>): string => pin.hash)
  return new Set([...pinned, ...channels.flat()])
}

/** Every head a channel's own catalogue still names. */
async function pointedHashes(
  api: string,
  get: typeof fetch = fetch,
): Promise<ReadonlySet<string>> {
  const heads = await Promise.all(
    CHANNELS.map(async (channel: string): Promise<readonly string[]> => {
      const answer = await get(
        new URL(`/api/catalogue.json?channel=${channel}`, api),
        { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
      )
      if (!answer.ok) {
        throw new Error(`catalogue ${channel}: HTTP ${String(answer.status)}`)
      }
      return parse(CatalogueSchema, await answer.json()).shards.flatMap(
        (shard: Readonly<{ hash?: string | undefined }>): readonly string[] =>
          shard.hash === undefined ? [] : [shard.hash],
      )
    }),
  )
  return new Set(heads.flat())
}

/** The report lines: the counts, then each drifted original. */
function keptLines(kept: Readonly<Kept>): readonly string[] {
  return [
    `kept: ${String(kept.live.length)} live (release files, placements, engine pins), ${String(kept.rollback.length)} rollback copies, ${String(kept.pointed.length)} pointed by a channel's catalogue, ${String(kept.drift.length)} drift (J507: only live originals count)`,
    ...kept.drift.map(
      (stored: StoredRecord): string =>
        `store drift ${slugOf(stored)} r${String(revisionOf(stored))} ${stored.hash}: no release plays it, no channel points at it and it is no rollback copy; the API's prune should have taken it`,
    ),
  ]
}

export { KEEP_BACK, classifyKept, keptLines, liveHashes, pointedHashes }
export type { Kept, KeptBy }
