// oxlint-disable typescript/prefer-readonly-parameter-types -- test fixtures edit their own copies
// QA 11-25 row 45: the declared worst location charged a KTX2 file its decoded bytes on top of its GPU bytes, though they
// never stay resident beside the upload (the measured stage already charges GPU alone). Nine Dragon's sign atlases were
// counted twice, and the API refused it at 1,500.79 MB load where its phone estimate is 1,410.59 MB.
// ZONE-SNAPSHOTS ZS5 (J507): the made-up cli fixture, never a stored zone.
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

import { beforeAll, expect, test } from 'vitest'

import { preflightDeclaredCosts } from './assetAdmission.ts'
import {
  offlineMemoryAdmission,
  prepareAssetDecoders,
} from './shardfile-assets.ts'
import { validateShardfileFolder } from './shardfileValidation.ts'

import type { Shardfile } from './shardSchema.ts'

beforeAll(async (): Promise<void> => {
  await prepareAssetDecoders()
})

const CORPUS = new URL('../test/fixtures/cli-fixture/', import.meta.url)
  .pathname

function corpus(): Shardfile {
  const files = new Map<string, Uint8Array>()
  for (const entry of readdirSync(CORPUS, {
    recursive: true,
    withFileTypes: true,
  }).filter((row): boolean => !row.isDirectory())) {
    const absolute = path.join(entry.parentPath, entry.name)
    files.set(
      path.relative(CORPUS, absolute).split(path.sep).join('/'),
      new Uint8Array(readFileSync(absolute)),
    )
  }
  const read = (file: string): Uint8Array => {
    const bytes = files.get(file)
    if (bytes === undefined) {
      throw new Error(`ENOENT: ${file}`)
    }
    return bytes
  }
  return validateShardfileFolder(
    { read, paths: (): string[] => [...files.keys()] },
    {
      hash: (bytes: Uint8Array): string =>
        createHash('sha256').update(bytes).digest('hex'),
    },
  ).shard
}

/** The fixture with one more library texture of `kind`, its budget raised to cover it. */
function withTexture(
  shard: Shardfile,
  texture: { kind: 'ktx2' | 'image'; decoded: number; gpu: number },
): Shardfile {
  const { kind, decoded, gpu } = texture
  const hash = (kind === 'ktx2' ? 'a' : 'b').repeat(64)
  const file = {
    ...shard.files[0],
    hash,
    kind,
    name: `made-up/${kind}`,
    path: `blobs/${kind}/${hash}`,
    decoded,
    gpu,
    compressed: 1,
    dependencies: [],
    triangles: 0,
    draws: 0,
    critical: false,
  } as Shardfile['files'][number]
  return {
    ...shard,
    files: [...shard.files, file],
    library: [...shard.library, hash],
    budgets: {
      ...shard.budgets,
      library: {
        ...shard.budgets.library,
        resident: shard.budgets.library.resident + decoded + gpu,
      },
    },
  }
}

const loading = (shard: Shardfile): number =>
  preflightDeclaredCosts(shard, offlineMemoryAdmission('warn')).worst.loading

test('a KTX2 texture is charged its GPU bytes alone in the declared worst location', (): void => {
  const shard = corpus()
  const gpuOnly = loading(
    withTexture(shard, { kind: 'ktx2', decoded: 0, gpu: 4_000_000 }),
  )
  expect(
    loading(
      withTexture(shard, {
        kind: 'ktx2',
        decoded: 300_000_000,
        gpu: 4_000_000,
      }),
    ),
  ).toBe(gpuOnly)
  expect(gpuOnly).toBeGreaterThan(loading(shard))
})

test('any other texture still charges its decoded bytes', (): void => {
  const shard = corpus()
  expect(
    loading(
      withTexture(shard, {
        kind: 'image',
        decoded: 300_000_000,
        gpu: 4_000_000,
      }),
    ),
  ).toBeGreaterThan(
    loading(withTexture(shard, { kind: 'image', decoded: 0, gpu: 4_000_000 })),
  )
})
