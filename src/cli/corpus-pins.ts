import { readFile } from 'node:fs/promises'

import { array, number, object, parse, pipe, regex, string } from 'valibot'

import type { StoredRecord } from './corpus.ts'

// SHARD-COMPAT FE13, the pins half: the delete gate counts users over every
// original GC keeps and every shard file engine pins. `corpus --pins <file or
// URL>` reads engine's `test/pins/shardfiles.json`; a pinned original the
// API's public list leaves out (an older revision past GC's window) joins
// the run, judged by hash like any other.

const HASH = pipe(string(), regex(/^[a-f0-9]{64}$/u))
const PinSchema = object({
  slug: string(),
  revision: number(),
  hash: HASH,
  bytes: number(),
})
const PinsSchema = object({ shards: array(PinSchema) })

/** One shard file engine pins. */
interface Pin {
  readonly slug: string
  readonly revision: number
  readonly hash: string
  readonly bytes: number
}

const FETCH_TIMEOUT_MS = 60_000

async function pinsText(source: string, get: typeof fetch): Promise<string> {
  if (!/^https?:\/\//u.test(source)) {
    return await readFile(source, 'utf8')
  }
  const answer = await get(source, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!answer.ok) {
    throw new Error(`pins ${source}: HTTP ${String(answer.status)}`)
  }
  return await answer.text()
}

/** Engine's shard-file pins, from a file or a URL. */
async function readPins(
  source: string,
  get: typeof fetch = fetch,
): Promise<readonly Pin[]> {
  const text = await pinsText(source, get)
  const parsed = parse(PinsSchema, JSON.parse(text))
  return parsed.shards
}

/** The listed originals, then each pinned one the list leaves out. */
function withPins(
  listed: readonly StoredRecord[],
  pins: readonly Pin[],
): readonly StoredRecord[] {
  const known = new Set(
    listed.map((stored: StoredRecord): string => stored.hash),
  )
  const extra = pins
    .filter((pin: Readonly<Pin>): boolean => !known.has(pin.hash))
    .map((pin: Readonly<Pin>): StoredRecord => ({
      hash: pin.hash,
      storedBytes: pin.bytes,
      revisions: [{ shard: pin.slug, revision: pin.revision }],
    }))
  return [...listed, ...extra]
}

export { type Pin, readPins, withPins }
