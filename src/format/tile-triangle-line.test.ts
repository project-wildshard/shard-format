// oxlint-disable typescript/prefer-readonly-parameter-types, eslint/id-length -- the corpus reader takes fs rows and bytes as memory-hard-line.test.ts does, and a tile row names its cell x and z
// J537 (Jake, 2026-11-28, QA 11-25 row 30): a fine tile's phone triangle line is 120k, report-only (J338). The
// performance card's `perf-tile-triangles` warning reads it, so `wildshard check` and the API name the same line.
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

import { beforeAll, expect, test } from 'vitest'

import {
  performanceTargetIssues,
  prepareAssetDecoders,
} from './shardfile-assets.ts'
import { validateShardfileFolder } from './shardfileValidation.ts'
import { TILE_TRIANGLES } from './view-draws.ts'

import type { PerformanceIssue } from './shardfile-assets.ts'
import type { Shardfile } from './shardSchema.ts'

beforeAll(async (): Promise<void> => {
  await prepareAssetDecoders()
})

// ZONE-SNAPSHOTS ZS5 (J507): a whole made-up folder, never a stored zone.
const CORPUS = new URL('../test/fixtures/cli-fixture/', import.meta.url)
  .pathname
const TEMPLATE_BUSIEST = 109_506
const OVER = 120_001

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

const PITCH = 62.5
const ORIGIN = 250
const HEIGHT = 10
const AT = 3

/** One fine tile at 0/3/3 holding `triangles`, as a build writes it. */
const fine = (triangles: number): Shardfile['tiles'][number] => ({
  bounds: {
    max: [(AT + 1) * PITCH - ORIGIN, HEIGHT, (AT + 1) * PITCH - ORIGIN],
    min: [AT * PITCH - ORIGIN, 0, AT * PITCH - ORIGIN],
  },
  compressed: 0,
  decoded: 0,
  draws: 1,
  files: [],
  geometricError: 0,
  gpu: 0,
  lod: 0,
  triangles,
  x: AT,
  z: AT,
})

/** The corpus shard with one fine tile at `triangles`, and the warnings the card names for tile triangles. */
function triangleLines(triangles: number): PerformanceIssue[] {
  return performanceTargetIssues({
    ...corpus(),
    tiles: [fine(triangles)],
  }).filter((issue): boolean => issue.code === 'perf-tile-triangles')
}

test('a fine tile at or under the 120k phone line has no triangle warning; over it warns, never refuses', (): void => {
  expect(TILE_TRIANGLES.phone).toBe(120_000)
  expect(triangleLines(TEMPLATE_BUSIEST)).toEqual([])
  expect(triangleLines(TILE_TRIANGLES.phone)).toEqual([])
  expect(triangleLines(OVER)).toEqual([
    {
      actual: OVER,
      code: 'perf-tile-triangles',
      limit: TILE_TRIANGLES.phone,
      metric: 'tile 0/3/3 triangles',
      severity: 'warning',
    },
  ])
})
