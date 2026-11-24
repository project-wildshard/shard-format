import { createHash } from 'node:crypto'
import { createReadStream, existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'

import { describe, expect, test } from 'vitest'

import { prepareAssetDecoders } from './shardfile-assets.ts'
import { nodeStreamPorts } from './shardfile-stream-node.ts'
import { validateShardfileStream } from './shardfile-stream.ts'
import { validateShardfileFolder } from './shardfileValidation.ts'
import { readTar } from './tar.ts'

// API-CLOUDFLARE AC6a on the live pins from the local cache. ZONE-SNAPSHOTS ZS6 (J507): the pins are read by slug from
// engine's pin file (a sibling checkout, or WILDSHARD_ENGINE_PINS), never named here, so a pin bump moves this test
// with it: the biggest live pin and the median one. Absent on CI, these are local proofs; the corpus tests run everywhere.

interface Pin {
  readonly slug: string
  readonly hash: string
  readonly bytes: number
}

const ROOT = new URL('../../', import.meta.url).pathname
const PIN_FILE =
  process.env['WILDSHARD_ENGINE_PINS'] ??
  path.join(ROOT, '../engine/test/pins/shardfiles.json')
const PINS = path.join(homedir(), '.cache/wildshard/pins')
const CHUNK = 65_536
const HALF = 2

function livePins(): readonly Pin[] {
  if (!existsSync(PIN_FILE)) {
    return []
  }
  const parsed: unknown = JSON.parse(readFileSync(PIN_FILE, 'utf8'))
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- engine's pin file, checked by engine
  const { shards } = parsed as { shards: Pin[] }
  return shards.toSorted(
    (left: Pin, right: Pin): number => left.bytes - right.bytes,
  )
}

/** The biggest live pin and the median one, by slug. */
function pinRuns(): readonly (readonly [name: string, hash: string])[] {
  const pins = livePins()
  const biggest = pins.at(-1)
  const median = pins[Math.floor(pins.length / HALF)]
  return [biggest, median].flatMap(
    (pin: Pin | undefined): [string, string][] =>
      pin === undefined
        ? []
        : [[`${pin.slug} (${Math.round(pin.bytes / 1e6)} MB)`, pin.hash]],
  )
}

function sha256(bytes: Readonly<Uint8Array>): string {
  return createHash('sha256').update(bytes).digest('hex')
}

describe.each(pinRuns())(
  'the live %s pin',
  (_name: string, hash: string): void => {
    const file = path.join(PINS, `${hash}.tar`)
    test.skipIf(!existsSync(file))(
      'streams to the old verdict, complete, holding under 64 MB of members',
      async (): Promise<void> => {
        await prepareAssetDecoders()
        const files = readTar(readFileSync(file))
        const old = validateShardfileFolder(
          {
            read: (name: string): Uint8Array =>
              files.get(name) ?? new Uint8Array(),
            paths: (): Iterable<string> => files.keys(),
          },
          { hash: sha256, readThrough: true },
        )
        const result = await validateShardfileStream(
          (): AsyncIterable<Uint8Array> =>
            createReadStream(file, { highWaterMark: CHUNK }),
          nodeStreamPorts({ brotli: false }),
        )
        expect(result.hash).toBe(hash)
        expect(result.shard).toEqual(old.shard)
        expect([result.complete, result.pending]).toEqual([true, []])
        expect(result.heldBytes).toBeLessThan(64_000_000)
      },
      300_000,
    )
  },
)
