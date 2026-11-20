// The Pine r7 product on both live channels, from the local pin cache (absent on hosted CI). Both validators
// refuse its over-line estimate while Pine is armed (J426), and admit it with a report while held (J424).
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
const REFUSAL =
  /declared worst-location total exceeds envelope.*over the 1\.5 GB phone line/u

function sha256(bytes: Readonly<Uint8Array>): string {
  return createHash('sha256').update(bytes).digest('hex')
}

test.skipIf(!existsSync(FILE))(
  'both validators refuse live Pine r7 while it is armed, and admit it while held',
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
        { hash: sha256, readThrough: true },
      )
    const stream = validateShardfileStream(
      (): AsyncIterable<Uint8Array> =>
        createReadStream(FILE, { highWaterMark: CHUNK }),
      nodeStreamPorts({ brotli: false }),
    )
    if (zoneArmed('pine-hollow')) {
      expect(folder).toThrow(REFUSAL)
      await expect(stream).rejects.toThrow(REFUSAL)
    } else {
      expect(folder).not.toThrow()
      await expect(stream).resolves.toMatchObject({ hash: PINE_LIVE_PIN })
    }
  },
  300_000,
)
