// oxlint-disable typescript/prefer-readonly-parameter-types, typescript/no-unsafe-type-assertion, import/max-dependencies, max-lines-per-function, unicorn/max-nested-calls -- a test over the corpus export: its rows read from JSON, copies edited
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

import { beforeAll, describe, expect, test } from 'vitest'

import { migrateShardfile, validateMigrated } from './format-migrate.ts'
import { FORMAT_MIGRATIONS, versionBelow } from './format-migrations.ts'
import { assembleOutputShardfile } from './outputIndex.ts'
import { prepareAssetDecoders } from './shardfile-assets.ts'
import { readCanonicalJson } from './shardfileValidation.ts'
import { parseOutputLineageIndex } from './stateLineage.ts'
import { validationSourceBytes } from './validationReceipt.ts'

import type { FormatMigration } from './format-migrations.ts'

// SHARD-COMPAT CP1: the chain on Brasscap's export (format `0.1`, unprepared), with FORMAT-PRUNE FP6 as its first step.

type Files = ReadonlyMap<string, Uint8Array>
type Json = Record<string, unknown>

const CORPUS = new URL('../../corpus/exports/brasscap-mesa/', import.meta.url)
  .pathname

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function corpusFiles(): Files {
  const files = new Map<string, Uint8Array>()
  for (const entry of readdirSync(CORPUS, {
    recursive: true,
    withFileTypes: true,
  })) {
    if (!entry.isDirectory()) {
      const absolute = path.join(entry.parentPath, entry.name)
      files.set(
        path.relative(CORPUS, absolute).split(path.sep).join('/'),
        new Uint8Array(readFileSync(absolute)),
      )
    }
  }
  return files
}

function json(files: Files, name: string): Json {
  return readCanonicalJson(files.get(name) ?? new Uint8Array()) as Json
}

beforeAll(async (): Promise<void> => {
  await prepareAssetDecoders()
})

describe('the migration chain', (): void => {
  test('the declared source hash is what the runner recomputes', (): void => {
    const files = corpusFiles(),
      index = json(files, 'shard.json'),
      sections = new Map<string, unknown>()
    for (const row of index['sections'] as Json[]) {
      sections.set(String(row['name']), json(files, String(row['path'])))
    }
    expect(
      sha256(validationSourceBytes(assembleOutputShardfile(index, sections))),
    ).toBe((index['build'] as Json)['sourceHash'])
  })

  test('FP6 writes the four-part spelling and the copy validates', (): void => {
    const original = corpusFiles()
    const migrated = migrateShardfile(original, { hash: sha256 })
    expect(migrated).toMatchObject({
      from: '0.1',
      to: '0.1.0.0',
      applied: ['fp6-four-part-version'],
    })
    const index = json(migrated.files, 'shard.json')
    expect(index['version']).toBe('0.1.0.0')
    expect((index['requires'] as Json)['sdk']).toBe('0.1.0.0')
    expect(migrated.files.has('validation.json')).toBe(false)
    expect(migrated.digest).toBe(
      sha256(migrated.files.get('shard.json') ?? new Uint8Array()),
    )
    expect(
      validateMigrated(migrated.files, { hash: sha256, judged: 'stored' }).index
        .version,
    ).toBe('0.1.0.0')
    expect(original.get('shard.json')).toEqual(corpusFiles().get('shard.json'))
  })

  test('twice equals once, and the chain is deterministic', (): void => {
    const once = migrateShardfile(corpusFiles(), { hash: sha256 })
    const again = migrateShardfile(corpusFiles(), { hash: sha256 })
    const twice = migrateShardfile(once.files, { hash: sha256 })
    expect(twice.applied).toEqual([])
    expect(twice.files).toBe(once.files)
    expect(twice.digest).toBe(once.digest)
    expect(again.digest).toBe(once.digest)
    expect(again.chainId).toBe(once.chainId)
  })

  test('a corrupt section is refused before any step runs', (): void => {
    const files = new Map(corpusFiles())
    const [section] = json(files, 'shard.json')['sections'] as Json[]
    const file = String(section?.['path'])
    files.set(file, new TextEncoder().encode('{}\n'))
    let ran = false
    const spy: FormatMigration = {
      id: 'spy',
      to: '0.1.0.0',
      touches: 'data',
      affects: [],
      apply: (): void => {
        ran = true
      },
    }
    expect((): unknown =>
      migrateShardfile(files, { hash: sha256, migrations: [spy] }),
    ).toThrow(`Original hash or size mismatch: ${file}`)
    expect(ran).toBe(false)
  })

  test('an unlisted file, a newer format and a below-floor format are refused', (): void => {
    const extra = new Map(corpusFiles()).set('stray.json', new Uint8Array())
    expect((): unknown => migrateShardfile(extra, { hash: sha256 })).toThrow(
      'Unlisted original file: stray.json',
    )
    expect((): unknown =>
      migrateShardfile(corpusFiles(), { hash: sha256, to: '0.0' }),
    ).toThrow('newer than the reader')
  })

  test('a section edit rebuilds the inventory and the source hash', (): void => {
    const edit: FormatMigration = {
      id: 'test-edit',
      to: '0.1.0.1',
      touches: 'data',
      affects: [],
      apply: (shard): void => {
        const [name] = shard.sections.keys()
        shard.sections.set(name ?? '', shard.sections.get(name ?? ''))
      },
    }
    const migrated = migrateShardfile(corpusFiles(), {
      hash: sha256,
      migrations: [...FORMAT_MIGRATIONS, edit],
    })
    expect(migrated.applied).toEqual(['fp6-four-part-version', 'test-edit'])
    expect(migrated.to).toBe('0.1.0.1')
    expect(
      validateMigrated(migrated.files, { hash: sha256, judged: 'stored' }).index
        .version,
    ).toBe('0.1.0.1')
  })

  test('the spelling step sits just below its four-part twin', (): void => {
    expect(versionBelow('0.1', '0.1.0.0')).toBe(true)
    expect(versionBelow('0.1.0.0', '0.1.0.0')).toBe(false)
    expect(versionBelow('0.1.0.0', '0.1')).toBe(false)
    expect(versionBelow('0.1.0.1', '0.1.0.2')).toBe(true)
  })

  test('a prepared lineage index parses (stateLineage takes 0.3)', (): void => {
    const index = json(corpusFiles(), 'shard.json')
    expect(
      parseOutputLineageIndex({ ...index, sdk: '0.3' }).identity.slug,
    ).toBe('brasscap-mesa')
  })
})
