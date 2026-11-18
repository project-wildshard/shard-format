// The Pine revision 4 pin, live on every channel, from the local pin cache (absent on CI, a local proof like
// shardfile-stream-pins.test.ts). Its worst loading estimate is over the J408 1.5 GB phone line. J424 (Jake
// 2026-11-18): memory gates block only once an agent arms the zone under its line (J426, memory-armed.json), and Pine is
// not armed, so both validators admit the pin and the offline estimate reports the line instead of refusing.
import { createHash } from 'node:crypto'
import { createReadStream, existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'

import { expect, test } from 'vitest'

import { offlineMemoryIssues } from './memory-line.ts'
import { prepareAssetDecoders } from './shardfile-assets.ts'
import { nodeStreamPorts } from './shardfile-stream-node.ts'
import { validateShardfileStream } from './shardfile-stream.ts'
import { validateShardfileFolder } from './shardfileValidation.ts'
import { readTar } from './tar.ts'

const PINE_LIVE_PIN =
  '1b6dcfb16c2cfe595fe4feee9420809a4830a74662efdcf088de5cb1b8f8ac9f'
const FILE = `${homedir()}/.cache/wildshard/pins/${PINE_LIVE_PIN}.tar`
const CHUNK = 65_536

function sha256(bytes: Readonly<Uint8Array>): string {
  return createHash('sha256').update(bytes).digest('hex')
}

test.skipIf(!existsSync(FILE))(
  'the Pine revision 4 pin is admitted by both validators and reported over the J408 phone line',
  async (): Promise<void> => {
    await prepareAssetDecoders()
    const files = readTar(readFileSync(FILE))
    const folder = validateShardfileFolder(
      {
        read: (name: string): Uint8Array => files.get(name) ?? new Uint8Array(),
        paths: (): Iterable<string> => files.keys(),
      },
      { hash: sha256, readThrough: true },
    )
    const stream = await validateShardfileStream(
      (): AsyncIterable<Uint8Array> =>
        createReadStream(FILE, { highWaterMark: CHUNK }),
      nodeStreamPorts({ brotli: false }),
    )
    expect(stream.hash).toBe(PINE_LIVE_PIN)
    expect(stream.shard).toEqual(folder.shard)
    const loading = offlineMemoryIssues(folder.shard, folder.sections).find(
      (issue): boolean => issue.code === 'perf-loading-memory',
    )
    expect(loading?.severity).toBe('warning')
    expect(loading?.metric).toContain('over the 1.5 GB phone line')
  },
  300_000,
)
