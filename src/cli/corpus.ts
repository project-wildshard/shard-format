import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, open, readFile, rm, writeFile } from 'node:fs/promises'
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

import { nodeStreamPorts } from '../format/shardfile-stream-node.ts'
import { validateShardfileStream } from '../format/shardfile-stream.ts'

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
const CachedSchema = object({
  validator: string(),
  verdict: string(),
  reason: optional(string()),
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
}

type Judgement = Readonly<{
  verdict: 'valid' | 'fails'
  reason?: string
  transient: boolean
}>

interface CorpusOptions {
  readonly api: string
  readonly cache: string
  readonly validator: string
  readonly fetch?: typeof fetch
}

const NONE = 0
const TAR_MAGIC_AT = 257
const TAR_MAGIC = 'ustar'
const PEEK_BYTES = 512
const FETCH_TIMEOUT_MS = 900_000
/** One original is at most a few hundred MB; a download that takes longer has stalled. */
const DOWNLOAD_TIMEOUT_MS = 180_000
const DOWNLOAD_TRIES = 3
const FIRST_TRY = 1
const OK_LOW = 200
const OK_HIGH = 300
const SHORT_HASH = 12
const VERDICT_WIDTH = 5
const FIRST = 0

function shortReason(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error)
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? `${String(error.code)}: `
      : ''
  return `${code}${text}`.split('\n')[FIRST] ?? text
}

/** Whether the first bytes are a plain tarball (`ustar` at 257) rather than Brotli. */
function isPlainTar(head: Readonly<Uint8Array>): boolean {
  const magic = new TextDecoder().decode(
    head.subarray(TAR_MAGIC_AT, TAR_MAGIC_AT + TAR_MAGIC.length),
  )
  return magic === TAR_MAGIC
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

async function firstBytes(file: string): Promise<Uint8Array> {
  const handle = await open(file)
  try {
    const bytes = new Uint8Array(PEEK_BYTES)
    await handle.read(bytes, NONE, PEEK_BYTES, NONE)
    return bytes
  } finally {
    await handle.close()
  }
}

/** One original through the stream validator, as a stored file. */
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
    await validateShardfileStream(
      (): AsyncIterable<Uint8Array> => createReadStream(file),
      {
        ...nodeStreamPorts({ brotli: !plain }),
        judged: 'stored',
      },
    )
    return { verdict: 'valid', transient: false }
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
    return cached.validator === options.validator ? cached : undefined
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
  return { ...base, ...judged, reason: judged.reason, cached: false }
}

/** Every kept original's verdict, in the API's upload order. */
async function runCorpus(
  options: Readonly<CorpusOptions>,
): Promise<CorpusRow[]> {
  const listed = await (options.fetch ?? fetch)(
    new URL('/api/shardfiles', options.api),
    {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    },
  )
  if (listed.status < OK_LOW || listed.status >= OK_HIGH) {
    throw new Error(`list: HTTP ${String(listed.status)}`)
  }
  const { shardfiles } = parse(ListSchema, await listed.json())
  const rows: CorpusRow[] = []
  for (const stored of shardfiles) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- one original at a time keeps memory bounded
    rows.push(await row(options, stored))
  }
  return rows
}

function corpusReport(rows: readonly CorpusRow[]): string {
  const lines = rows.map(
    (found: Readonly<CorpusRow>): string =>
      `${found.verdict.padEnd(VERDICT_WIDTH)} ${found.slug} r${String(found.revision)} ${found.hash.slice(FIRST, SHORT_HASH)}${found.reason === undefined ? '' : ` ${found.reason}`}`,
  )
  const failed = rows.filter(
    (found: Readonly<CorpusRow>): boolean => found.verdict === 'fails',
  ).length
  const fetched = rows.filter(
    (found: Readonly<CorpusRow>): boolean => !found.cached,
  )
  const bytes = fetched.reduce(
    (sum: number, found: Readonly<CorpusRow>): number =>
      sum + found.storedBytes,
    NONE,
  )
  lines.push(
    `corpus: ${String(rows.length)} kept originals, ${String(rows.length - failed)} valid, ${String(failed)} fail; fetched ${String(fetched.length)} (${String(bytes)} stored bytes), ${String(rows.length - fetched.length)} from cache`,
  )
  return lines.join('\n')
}

export {
  type CorpusOptions,
  type CorpusRow,
  corpusReport,
  isPlainTar,
  runCorpus,
}
