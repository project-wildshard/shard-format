// MEMORY-GATES MG6 epoch 5 (mini-em11b): the estimate counts only the files a phone fetches, by tier selection's own
// verdict, and leaves a runtime home's mounted engine images to its paired reading.
import { expect, test } from 'vitest'

import { mountedImageOnPhone, phoneTerms } from './boot-memory-cost.ts'
import { phoneInactiveFiles } from './phone-files.ts'

import type { Shardfile } from './shardSchema.ts'

const MB = 1_000_000
const HASH_LENGTH = 64
const hash = (digit: number): string =>
  String(digit).repeat(HASH_LENGTH).slice(0, HASH_LENGTH)
const row = (
  digit: number,
  kind: string,
  gpu: number,
): Readonly<Record<string, unknown>> => ({
  hash: hash(digit),
  kind,
  compressed: MB,
  decoded: 2 * MB,
  gpu,
  dependencies: [],
})

function product(
  cost?: Readonly<{ webContentMB: number; glMB: number }>,
): Shardfile {
  const shard = {
    identity: { slug: 'tiered' },
    files: [
      row(1, 'glb', 3 * MB),
      row(2, 'glb', 3 * MB),
      row(3, 'glb', 3 * MB),
    ],
    library: [hash(1), hash(2), hash(3)],
    critical: [],
    requires: { commonsWire: {}, commonsCosts: {} },
    runtime: cost === undefined ? undefined : { cost },
    budgets: { sim: { resident: 0 } },
    serverBudget: { memory: 0 },
  }
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the fields phoneTerms and tier selection read
  return shard as unknown as Shardfile
}
const index = {
  files: [
    { hash: hash(1), path: `blobs/glb/${hash(1)}.glb`, name: 'shared.glb' },
    {
      hash: hash(2),
      path: `blobs/glb/${hash(2)}.glb`,
      name: 'phone.glb',
      tier: 'phone' as const,
    },
    {
      hash: hash(3),
      path: `blobs/glb/${hash(3)}.glb`,
      name: 'desktop.glb',
      tier: 'desktop' as const,
    },
  ],
}

test('MG6 epoch 5: a desktop-tier file is no part of the phone estimate', (): void => {
  const shard = product()
  const inactive = phoneInactiveFiles(shard, index, new Map())
  expect([...inactive]).toEqual([hash(3)])
  expect(phoneInactiveFiles(shard, undefined, new Map()).size).toBe(0)
  const every = phoneTerms(shard),
    phone = phoneTerms(shard, 0, { inactive })
  expect(every.content).toBe(9 * MB)
  expect(phone.content).toBe(6 * MB)
  expect(phone.geometry).toBe(6 * MB)
})

test('MG6 epoch 5: a shard with no runtime counts its mounted images, a runtime home leaves them to its reading', (): void => {
  const mounted = 50 * MB
  expect(phoneTerms(product(), mounted).content).toBe(9 * MB + mounted)
  expect(phoneTerms(product(), mounted).textures).toBe(mounted)
  const home = phoneTerms(product({ webContentMB: 400, glMB: 100 }), mounted)
  expect(home.content).toBe(9 * MB)
  expect(home.runtimeReading).toBe(500 * MB)
})

const desktop = { url: '/assets/z/map.jpg', hash: hash(4) }
const phone = { url: '/assets/z/map.phone.webp', hash: hash(5) }
const fallback = { url: '/assets/z/other.png', hash: hash(6) }
const mountUrls = new Set([desktop.url, phone.url, fallback.url])
const phoneFence = new Set([phone.hash])

test('charges a mounted phone image and an unpaired fallback', (): void => {
  expect(mountedImageOnPhone(desktop, mountUrls, phoneFence)).toBe(false)
  expect(mountedImageOnPhone(phone, mountUrls, phoneFence)).toBe(true)
  expect(mountedImageOnPhone(fallback, mountUrls, phoneFence)).toBe(true)
})

test('keeps charging direct reads, unprepared mounts and images held as authored', (): void => {
  expect(mountedImageOnPhone(desktop, mountUrls, new Set([desktop.hash]))).toBe(
    true,
  )
  expect(mountedImageOnPhone(desktop, mountUrls)).toBe(true)
  expect(
    mountedImageOnPhone({ ...desktop, keepImage: true }, mountUrls, phoneFence),
  ).toBe(true)
})
