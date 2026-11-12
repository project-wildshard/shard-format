import { createHash } from 'node:crypto'
import { createReadStream, existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'

import { describe, expect, test } from 'vitest'

import { nodeStreamPorts } from './product-stream-node.ts'
import { validateShardfileStream } from './product-stream.ts'
import { prepareAssetDecoders } from './product.ts'
import { validateShardfileProduct } from './productValidation.ts'
import { readTar } from './tar.ts'

// API-CLOUDFLARE AC6a on the real pins (engine test/pins/shardfiles.json) from the local cache: the 12 MB median, the
// 68 MB pin and the 327 MB pin. Absent on CI, these are local proofs; the corpus tests run everywhere.

const PINS = path.join(homedir(), '.cache/wildshard/pins')
const CHUNK = 65_536
const PIN_RUNS: readonly (readonly [name: string, hash: string])[] = [
  [
    'median 12 MB',
    '3b322eccd99e209f98bbe59e16f79de77375b6075bc91f379d67cefff7bcf740',
  ],
  ['68 MB', 'ab7b1d4e1d2ddd29771d6964e470244f3b0ffe6af108bb6196b5071ba18a4e9d'],
]
// SERVER-PARITY SS7: the 327 MB pin is Pine, refused for pine.life until SS5 gives it a server half. Both validators
// must still give the same refusal; move it back to PIN_RUNS once Pine's new pin admits.
const PINE_PIN =
  '0e246ab03210d777619bf1fb09bbaa9da1bbcaea5093a8adfce913508762f084'
const PINE_REFUSAL =
  'Script side refused: sim script pine.life runs in page-only feature page.life (actors/page-life.json), which no server host runs'

function sha256(bytes: Readonly<Uint8Array>): string {
  return createHash('sha256').update(bytes).digest('hex')
}

describe.each(PIN_RUNS)('the %s pin', (_name: string, hash: string): void => {
  const file = path.join(PINS, `${hash}.tar`)
  test.skipIf(!existsSync(file))(
    'streams to the old verdict, complete, holding under 64 MB of members',
    async (): Promise<void> => {
      await prepareAssetDecoders()
      const files = readTar(readFileSync(file))
      const old = validateShardfileProduct(
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
})

describe('the 327 MB pin (Pine)', (): void => {
  const file = path.join(PINS, `${PINE_PIN}.tar`)
  test.skipIf(!existsSync(file))(
    'is refused by both validators with the same SS7 line',
    async (): Promise<void> => {
      await prepareAssetDecoders()
      const files = readTar(readFileSync(file))
      expect((): unknown =>
        validateShardfileProduct(
          {
            read: (name: string): Uint8Array =>
              files.get(name) ?? new Uint8Array(),
            paths: (): Iterable<string> => files.keys(),
          },
          { hash: sha256, readThrough: true },
        ),
      ).toThrow(PINE_REFUSAL)
      await expect(
        validateShardfileStream(
          (): AsyncIterable<Uint8Array> =>
            createReadStream(file, { highWaterMark: CHUNK }),
          nodeStreamPorts({ brotli: false }),
        ),
      ).rejects.toThrow(PINE_REFUSAL)
    },
    300_000,
  )
})
