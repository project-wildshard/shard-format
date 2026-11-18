// The historical Pine revision 4 product, from the local pin cache (absent on hosted CI). Both validators
// refuse its over-line estimate after Pine's newer product qualified below the phone lines (J426).
import { createHash } from 'node:crypto'
import { createReadStream, existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'

import { expect, test } from 'vitest'

import { prepareAssetDecoders } from './shardfile-assets.ts'
import { nodeStreamPorts } from './shardfile-stream-node.ts'
import { validateShardfileStream } from './shardfile-stream.ts'
import { validateShardfileFolder } from './shardfileValidation.ts'
import { readTar } from './tar.ts'

const PINE_LIVE_PIN =
  '1b6dcfb16c2cfe595fe4feee9420809a4830a74662efdcf088de5cb1b8f8ac9f'
const FILE = `${homedir()}/.cache/wildshard/pins/${PINE_LIVE_PIN}.tar`
const CHUNK = 65_536
const REFUSAL =
  /declared worst-location total exceeds envelope.*over the 1\.5 GB phone line/u

function sha256(bytes: Readonly<Uint8Array>): string {
  return createHash('sha256').update(bytes).digest('hex')
}

test.skipIf(!existsSync(FILE))(
  'both validators refuse historical Pine revision 4 after arming Pine',
  async (): Promise<void> => {
    await prepareAssetDecoders()
    const files = readTar(readFileSync(FILE))
    expect((): ReturnType<typeof validateShardfileFolder> =>
      validateShardfileFolder(
        {
          read: (name: string): Uint8Array =>
            files.get(name) ?? new Uint8Array(),
          paths: (): Iterable<string> => files.keys(),
        },
        { hash: sha256, readThrough: true },
      ),
    ).toThrow(REFUSAL)
    await expect(
      validateShardfileStream(
        (): AsyncIterable<Uint8Array> =>
          createReadStream(FILE, { highWaterMark: CHUNK }),
        nodeStreamPorts({ brotli: false }),
      ),
    ).rejects.toThrow(REFUSAL)
  },
  300_000,
)
