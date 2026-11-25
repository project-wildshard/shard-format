// oxlint-disable typescript/prefer-readonly-parameter-types, typescript/no-unsafe-type-assertion -- a made-up step edits the index it is handed, read from JSON
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'

import { safeParse } from 'valibot'
import { beforeAll, expect, test } from 'vitest'

import { migrateShardfile, validateMigrated } from './format-migrate.ts'
import {
  FORMAT_MIGRATIONS,
  deletedFieldsIn,
  mendDeletedFields,
  versionBelow,
} from './format-migrations.ts'
import { ManifestMetadataSchema } from './minimap.ts'
import { prepareAssetDecoders } from './shardfile-assets.ts'
import { RequiresSchema } from './shardSections.ts'
import { SHARDFILE_VERSION } from './version.ts'

import type { FormatMigration } from './format-migrations.ts'

// FORMAT-PRUNE FP33 and FP44: the schema no longer knows requires.sdk or the old grid pointer, and the chain mends a copy
// that still carries either, whatever format it is written at.

const POINTER = '/shardfiles/x/shard.json'

test('the schema knows neither deleted field', (): void => {
  expect(safeParse(RequiresSchema, { commons: [] }).success).toBe(true)
  expect(safeParse(RequiresSchema, { commons: [], sdk: '0.1' }).success).toBe(
    false,
  )
  expect(Object.hasOwn(ManifestMetadataSchema.entries, 'gridShardfile')).toBe(
    false,
  )
  expect(Object.hasOwn(ManifestMetadataSchema.entries, 'shardfile')).toBe(true)
})

test('a copy that carries them is mended into the one way every format admits', (): void => {
  const shard = {
    index: { requires: { sdk: '0.1.0.4', commons: [] } },
    sections: new Map<string, unknown>([
      ['ui/level', { manifest: { slug: 'x', gridShardfile: POINTER } }],
    ]),
    mounts: new Map<string, unknown>([
      [
        'mounts/discovery.json',
        { version: 1, data: { gridShardfile: POINTER } },
      ],
    ]),
  }
  const both = ['fp33-delete-requires-sdk', 'fp44-delete-grid-pointer']
  expect(deletedFieldsIn(shard)).toEqual(both)
  expect(mendDeletedFields(shard)).toEqual(both)
  expect(shard.index.requires).toEqual({ commons: [] })
  expect(shard.sections.get('ui/level')).toEqual({
    manifest: { slug: 'x', shardfile: POINTER },
  })
  expect(shard.mounts.get('mounts/discovery.json')).toEqual({
    version: 1,
    data: { shardfile: POINTER },
  })
  expect(deletedFieldsIn(shard)).toEqual([])
  expect(mendDeletedFields(shard)).toEqual([])
})

// ZONE-SNAPSHOTS ZS5 (J507): the made-up CLI product (format 0.1), no stored zone.
const CORPUS = new URL('../test/fixtures/cli-fixture/', import.meta.url)
  .pathname

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function corpusFiles(): ReadonlyMap<string, Uint8Array> {
  const files = new Map<string, Uint8Array>()
  for (const entry of readdirSync(CORPUS, {
    recursive: true,
    withFileTypes: true,
  })) {
    if (!entry.isDirectory()) {
      const absolute = `${entry.parentPath}/${entry.name}`.replace('//', '/')
      files.set(
        absolute.slice(CORPUS.length),
        new Uint8Array(readFileSync(absolute)),
      )
    }
  }
  return files
}

/** A made-up step that writes the old field into a 0.1.0.4 copy, as a stored original of that format carries it. */
const carriesSdk: FormatMigration = {
  id: 'test-old-requires-sdk',
  to: '0.1.0.4',
  touches: 'data',
  affects: [],
  apply: (shard): void => {
    Reflect.set(shard.index['requires'] as object, 'sdk', '0.1.0.4')
  },
}
const at = FORMAT_MIGRATIONS.findIndex((step: FormatMigration): boolean =>
  versionBelow('0.1.0.4', step.to),
)
const migrations = [
  ...FORMAT_MIGRATIONS.slice(0, at),
  carriesSdk,
  ...FORMAT_MIGRATIONS.slice(at),
]

beforeAll(async (): Promise<void> => {
  await prepareAssetDecoders()
})

test('the chain drops requires.sdk from every copy, below its own step too', (): void => {
  for (const [to, drop] of [
    ['0.1.0.4', 'fp33-delete-requires-sdk'],
    [SHARDFILE_VERSION, 'fp33-drop-requires-sdk'],
  ] as const) {
    const copy = migrateShardfile(corpusFiles(), {
      hash: sha256,
      to,
      migrations,
    })
    expect(copy.to).toBe(to)
    expect(copy.applied).toContain('test-old-requires-sdk')
    expect(copy.applied).toContain(drop)
    expect(
      validateMigrated(copy.files, { hash: sha256, judged: 'stored' }).index
        .requires,
    ).not.toHaveProperty('sdk')
  }
})
