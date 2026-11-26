import { expect, test } from 'vitest'

import { assertShardMountUrls } from './standalone-art.ts'

import type { CookMount } from './cook-data.ts'

const HASH = 'a'.repeat(64)

function mount(url: string): CookMount {
  return { url, path: `mounts${url}`, hash: HASH, bytes: 1 }
}

test('a shard cannot take over engine-wide paths or another shard’s URL', (): void => {
  for (const url of [
    '/assets/gpu/tex/grass.jpg',
    '/assets/other/models/tree.glb',
    '/programs/other.json',
    `/shardfiles/other/blobs/image/${HASH}.webp`,
  ]) {
    expect((): void => {
      assertShardMountUrls('isle', [mount(url)])
    }).toThrow(url)
  }
})

test('a shard can mount zone art, its program and its discovery document', (): void => {
  const urls = [
    '/assets/isle/tex/grass.jpg',
    '/programs/isle.json',
    '/shardfiles/isle/discovery.json',
    `/shardfiles/isle/blobs/image/${HASH}.webp`,
  ]
  expect((): void => {
    assertShardMountUrls(
      'isle',
      urls.map((url): CookMount => mount(url)),
    )
  }).not.toThrow()
})
