// The Pine r7 product once live on both channels, from the local pin cache (absent on hosted CI). Pine is armed
// again (CP10), and J445 refuses an armed zone only past the loading ceiling: r7 is over only the playing target,
// so both validators admit it with the zone armed.
import { createHash } from 'node:crypto'
import { createReadStream, existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'

import { expect, test } from 'vitest'

import { zoneArmed } from './memory-armed.ts'
import { prepareAssetDecoders } from './shardfile-assets.ts'
import { nodeStreamPorts } from './shardfile-stream-node.ts'
import { validateShardfileStream } from './shardfile-stream.ts'
import { validateShardfileFolder } from './shardfileValidation.ts'
import { readTar } from './tar.ts'

const PINE_LIVE_PIN =
  '2f9c5dc6f240188e5e6c6c7c3bcbc5b25fcb2d5864a5710987fe3c78cfb8e5d5'
const FILE = `${homedir()}/.cache/wildshard/pins/${PINE_LIVE_PIN}.tar`
const CHUNK = 65_536

function sha256(bytes: Readonly<Uint8Array>): string {
  return createHash('sha256').update(bytes).digest('hex')
}

test.skipIf(!existsSync(FILE))(
  'both validators admit Pine r7 armed: J445 refuses only past the loading ceiling',
  async (): Promise<void> => {
    await prepareAssetDecoders()
    const files = readTar(readFileSync(FILE))
    const folder = (): ReturnType<typeof validateShardfileFolder> =>
      validateShardfileFolder(
        {
          read: (name: string): Uint8Array =>
            files.get(name) ?? new Uint8Array(),
          paths: (): Iterable<string> => files.keys(),
        },
        { hash: sha256, readThrough: true, armed: true },
      )
    const stream = validateShardfileStream(
      (): AsyncIterable<Uint8Array> =>
        createReadStream(FILE, { highWaterMark: CHUNK }),
      { ...nodeStreamPorts({ brotli: false }), armed: true },
    )
    // FP27c: the catalogue arms Pine; the format's word alone (a bare slug) does not.
    expect(zoneArmed('pine-hollow')).toBe(false)
    expect(folder).not.toThrow()
    await expect(stream).resolves.toMatchObject({ hash: PINE_LIVE_PIN })
  },
  300_000,
)
