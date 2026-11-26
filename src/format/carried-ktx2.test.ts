// SF15 (J525): a shardfile carries images only and the cook makes every KTX2. A new upload carrying its own KTX2 is
// refused; a stored shard file (a pin, a stored original, a cook) still reads; a mount row may keep an image as it is.
// ZONE-SNAPSHOTS ZS5 (J507): the made-up cli fixture, never a stored zone.
import { readFileSync } from 'node:fs'

import { expect, test } from 'vitest'

import { carriedKtx2, refuseCarriedKtx2 } from './carried-ktx2.ts'
import { readCookData } from './cook-data.ts'
import { parseIncomingIndex } from './incoming.ts'

import type { OutputIndex } from './outputIndex.ts'

const FIXTURE = new URL('../test/fixtures/cli-fixture/shard.json', import.meta.url)
const index = (): OutputIndex => parseIncomingIndex(JSON.parse(readFileSync(FIXTURE, 'utf8')))
const paths = (shard: OutputIndex): string[] => ['shard.json', ...shard.files.map((row): string => row.path)]

/** The fixture with one more file row of `kind` (a made-up hash), commons or the shard's own. */
function withFile(kind: 'ktx2' | 'image', commons = false): OutputIndex {
  const shard = index(), first = shard.files[0]
  if (first === undefined) throw new Error('the fixture lists no file')
  const hash = 'c'.repeat(64)
  const row = { ...first, hash, kind, path: `blobs/${kind}/${hash}.${kind === 'ktx2' ? 'ktx2' : 'png'}`, ...(commons ? { commons: true as const } : {}) }
  return { ...shard, files: [...shard.files, row] }
}

test('the made-up fixture carries no KTX2 and passes as an upload', (): void => {
  const shard = index()
  expect(carriedKtx2(shard, paths(shard))).toBeUndefined()
  expect((): void => { refuseCarriedKtx2(shard, paths(shard), 'upload') }).not.toThrow()
})

test('a new upload carrying a KTX2 blob or a .ktx2 mount is refused, naming it', (): void => {
  const blob = withFile('ktx2')
  expect((): void => { refuseCarriedKtx2(blob, paths(blob), undefined) }).toThrow(/carries images only.*blobs\/ktx2\/c{64}\.ktx2/u)
  const shard = index(), mounted = [...paths(shard), 'mounts/assets/made-up/tex/leafy_grass/diffuse-0a1b2c3d.ktx2']
  expect(carriedKtx2(shard, mounted)).toBe('mounts/assets/made-up/tex/leafy_grass/diffuse-0a1b2c3d.ktx2')
  expect((): void => { refuseCarriedKtx2(shard, mounted, 'upload') }).toThrow(/J525/u)
})

test('a stored shard file still reads, and commons KTX2 or an image blob is no refusal', (): void => {
  const blob = withFile('ktx2')
  expect((): void => { refuseCarriedKtx2(blob, paths(blob), 'stored') }).not.toThrow()
  const commons = withFile('ktx2', true), image = withFile('image')
  expect(carriedKtx2(commons, paths(commons))).toBeUndefined()
  expect(carriedKtx2(image, paths(image))).toBeUndefined()
})

test('a mount row keeps a file an image with keepImage, and the field takes true alone', (): void => {
  const row = { url: '/assets/made-up/ui/badge.png', path: 'mounts/assets/made-up/ui/badge.png', hash: 'd'.repeat(64), bytes: 10 }
  expect(readCookData({ version: 1, mounts: [{ ...row, keepImage: true }] }).mounts[0]?.keepImage).toBe(true)
  expect(readCookData({ version: 1, mounts: [row] }).mounts[0]?.keepImage).toBeUndefined()
  expect((): unknown => readCookData({ version: 1, mounts: [{ ...row, keepImage: false }] })).toThrow()
})
