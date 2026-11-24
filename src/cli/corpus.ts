import { createWriteStream } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

import {
  array,
  number,
  object,
  optional,
  parse,
  pipe,
  regex,
  safeInteger,
  string,
} from 'valibot'

import { candidateField, onlyNamed } from './corpus-candidate.ts'
import { storedDeprecations } from './corpus-deprecations.ts'
import { withPins } from './corpus-pins.ts'
import { firstBytes, isPlainTar } from './corpus-tar.ts'

import type { Candidate } from './corpus-candidate.ts'
import type { Pin } from './corpus-pins.ts'
import type { InferOutput } from 'valibot'

// `shard-format corpus` (meta SHARD-COMPAT FE3, J486 Q47 Q52): run this
// validator over every stored shard file the API keeps, as a stored
// original (`judged: 'stored'`: readability, not memory policy), and list
// every failure by shard, revision and reason. It reads the API's public
// list (`GET /api/shardfiles`: originals prune has not marked) and each
// original by hash (`GET /api/shardfiles/<hash>`), so it needs no token.
// The stream validator keeps only the index and JSON members and hashes
// blobs as they pass, so memory stays bounded; a verdict is cached by
// original hash and validator version, so a warm run fetches only new
// uploads. The migration chain (CP1) joins here when it exists.

const NamedSchema = object({ shard: string(), revision: number() })
const RecordSchema = object({
  hash: pipe(string(), regex(/^[a-f0-9]{64}$/u)),
  storedBytes: pipe(number(), safeInteger()),
  revisions: array(NamedSchema),
})
const ListSchema = object({ shardfiles: array(RecordSchema) })
const IDS = array(string())
const CachedSchema = object({
  validator: string(),
  verdict: string(),
  reason: optional(string()),
  deprecations: optional(IDS),
})

type StoredRecord = Readonly<{
  hash: string
  storedBytes: number
  revisions: readonly Readonly<InferOutput<typeof NamedSchema>>[]
}>

interface CorpusRow {
  readonly slug: string
  readonly revision: number
  readonly hash: string
  readonly storedBytes: number
  readonly verdict: 'valid' | 'fails'
  readonly reason: string | undefined
  readonly cached: boolean
  readonly deprecations: readonly string[]
  /** FE13: engine pins this original. */
  readonly pinned?: true
  /** FE3b: the candidate's verdict, when one runs. */
  readonly candidate?: string
}

type Judgement = Readonly<{
  verdict: 'valid' | 'fails'
  reason?: string
  deprecations?: readonly string[]
  candidate?: string
  transient: boolean
}>

interface CorpusOptions {
  readonly api: string
  readonly cache: string
  readonly validator: string
  readonly fetch?: typeof fetch
  /** FE13: engine's shard-file pins, judged with the kept originals. */
  readonly pins?: readonly Pin[]
  /** FE3b: a candidate chain and validator judged beside the current one; every original is fetched again. */
  readonly candidate?: Candidate
  /** Only these shards' originals (`slug`, or one revision as `slug@r5`): a candidate run over the shards it targets. */
  readonly only?: readonly string[]
  /** ZS3 (J507): judge only these hashes and the pins, what players load; the API's other originals are rollback
   * copies and never count as users. */
  readonly live?: ReadonlySet<string>
}

const NONE = 0
const FETCH_TIMEOUT_MS = 900_000
/** One original is at most a few hundred MB; a download that takes longer has stalled. */
const DOWNLOAD_TIMEOUT_MS = 180_000
const DOWNLOAD_TRIES = 3
const FIRST_TRY = 1
const OK_LOW = 200
const OK_HIGH = 300
const FIRST = 0

function shortReason(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error)
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? `${String(error.code)}: `
      : ''
  return `${code}${text}`.split('\n')[FIRST] ?? text
}

/** Downloads one original to `file`: the validator reads it twice, so it is fetched once and read from disk. */
async function download(
  options: Readonly<CorpusOptions>,
  hash: string,
  file: string,
): Promise<void> {
  const url = new URL(`/api/shardfiles/${hash}`, options.api)
  const response = await (options.fetch ?? fetch)(url, {
    headers: { 'accept-encoding': 'br' },
    signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
  })
  if (response.status < OK_LOW || response.status >= OK_HIGH) {
    throw new Error(`download ${hash}: HTTP ${String(response.status)}`)
  }
  if (response.body === null) {
    throw new Error(`download ${hash}: no body`)
  }
  await pipeline(Readable.fromWeb(response.body), createWriteStream(file))
}

/** A download, tried again when it stalls or drops; the last error is thrown. */
async function downloadWithRetries(
  options: Readonly<CorpusOptions>,
  hash: string,
  file: string,
): Promise<void> {
  let last: unknown = undefined
  for (
    let attempt = FIRST_TRY;
    attempt <= DOWNLOAD_TRIES;
    attempt += FIRST_TRY
  ) {
    try {
      // oxlint-disable-next-line eslint/no-await-in-loop -- a retry waits for the try before it
      await download(options, hash, file)
      return
    } catch (error: unknown) {
      last = error
    }
  }
  throw last
}

/** One original through the stream validator, as a stored file. A download that never completes is not a verdict. */
async function judge(
  options: Readonly<CorpusOptions>,
  hash: string,
): Promise<Judgement> {
  const file = path.join(options.cache, `${hash}.download`)
  try {
    try {
      await downloadWithRetries(options, hash, file)
    } catch (error: unknown) {
      return {
        verdict: 'fails',
        reason: `download: ${shortReason(error)}`,
        transient: true,
      }
    }
    const plain = isPlainTar(await firstBytes(file))
    return {
      verdict: 'valid',
      ...(await storedDeprecations(file, plain)),
      ...(await candidateField(options.candidate, file, plain)),
      transient: false,
    }
  } catch (error: unknown) {
    return { verdict: 'fails', reason: shortReason(error), transient: false }
  } finally {
    await rm(file, { force: true })
  }
}

async function cachedVerdict(
  options: Readonly<CorpusOptions>,
  hash: string,
): Promise<InferOutput<typeof CachedSchema> | undefined> {
  try {
    const raw: unknown = JSON.parse(
      await readFile(path.join(options.cache, `${hash}.json`), 'utf8'),
    )
    const cached = parse(CachedSchema, raw)
    // FE3b: a candidate run judges every original again.
    // A valid verdict cached before FE7 has no deprecation list: judge it again.
    const stale =
      cached.verdict === 'valid' && cached.deprecations === undefined
    const fresh = cached.validator === options.validator && !stale
    return fresh && options.candidate === undefined ? cached : undefined
  } catch {
    return undefined
  }
}

async function row(
  options: Readonly<CorpusOptions>,
  stored: StoredRecord,
): Promise<CorpusRow> {
  const named = stored.revisions[FIRST]
  const base = {
    slug: named?.shard ?? '?',
    revision: named?.revision ?? NONE,
    hash: stored.hash,
    storedBytes: stored.storedBytes,
  }
  const cached = await cachedVerdict(options, stored.hash)
  if (cached !== undefined) {
    return {
      ...base,
      verdict: cached.verdict === 'valid' ? 'valid' : 'fails',
      reason: cached.reason,
      cached: true,
      deprecations: cached.deprecations ?? [],
    }
  }
  await mkdir(options.cache, { recursive: true })
  const { transient, ...judged } = await judge(options, stored.hash)
  if (!transient) {
    await writeFile(
      path.join(options.cache, `${stored.hash}.json`),
      `${JSON.stringify({ validator: options.validator, ...judged })}\n`,
    )
  }
  return {
    ...base,
    ...judged,
    reason: judged.reason,
    cached: false,
    deprecations: judged.deprecations ?? [],
  }
}

/** The API's public list of kept originals. */
async function listKept(
  options: Readonly<CorpusOptions>,
): Promise<readonly StoredRecord[]> {
  const listed = await (options.fetch ?? fetch)(
    new URL('/api/shardfiles', options.api),
    { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
  )
  if (listed.status < OK_LOW || listed.status >= OK_HIGH) {
    throw new Error(`list: HTTP ${String(listed.status)}`)
  }
  return parse(ListSchema, await listed.json()).shardfiles
}

/** Every kept original's verdict, in the API's upload order, then engine's pins the list leaves out (FE13). */
async function runCorpus(
  options: Readonly<CorpusOptions>,
): Promise<CorpusRow[]> {
  const kept = await listKept(options)
  const pins = options.pins ?? []
  const pinned = new Set(pins.map((pin: Readonly<Pin>): string => pin.hash))
  const shardfiles = kept.filter(
    (stored: StoredRecord): boolean =>
      onlyNamed(options.only, stored.revisions) &&
      (options.live === undefined ||
        options.live.has(stored.hash) ||
        pinned.has(stored.hash)),
  )
  const rows: CorpusRow[] = []
  for (const stored of withPins(shardfiles, pins)) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- one original at a time keeps memory bounded
    const found = await row(options, stored)
    rows.push(pinned.has(stored.hash) ? { ...found, pinned: true } : found)
  }
  return rows
}

export {
  type CorpusOptions,
  type CorpusRow,
  type StoredRecord,
  listKept,
  runCorpus,
}

export { corpusReport } from './corpus-report.ts'
export { isPlainTar } from './corpus-tar.ts'
