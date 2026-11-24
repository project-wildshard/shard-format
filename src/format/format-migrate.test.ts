// oxlint-disable typescript/prefer-readonly-parameter-types, typescript/no-unsafe-type-assertion, import/max-dependencies, max-lines-per-function, unicorn/max-nested-calls -- a test over the corpus export: its rows read from JSON, copies edited
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

import { beforeAll, describe, expect, test } from 'vitest'

import { migrateShardfile, validateMigrated } from './format-migrate.ts'
import { FORMAT_MIGRATIONS, versionBelow } from './format-migrations.ts'
import { readOutputDownloadIndex } from './outputDownload.ts'
import { assembleOutputShardfile, parseOutputIndex } from './outputIndex.ts'
import { preparationSpecOf } from './preparation-spec.ts'
import { asWrittenIdentity } from './save-revision.ts'
import { prepareAssetDecoders } from './shardfile-assets.ts'
import { readCanonicalJson } from './shardfileValidation.ts'
import { parseOutputLineageIndex } from './stateLineage.ts'
import { validationSourceBytes } from './validationReceipt.ts'
import { SHARDFILE_VERSION } from './version.ts'

import type { FormatMigration } from './format-migrations.ts'

// SHARD-COMPAT CP1: the chain on Brasscap's export (format `0.1`, unprepared), with FORMAT-PRUNE FP6 as its first step.

type Files = ReadonlyMap<string, Uint8Array>
type Json = Record<string, unknown>

// J506: the SS3 export (format 0.1.0.0) is the old original this chain
// carries forward; corpus/exports/ is the current one.
const CORPUS = new URL(
  '../../corpus/legacy/brasscap-mesa-ss3/',
  import.meta.url,
).pathname

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
      sha256(
        validationSourceBytes(
          asWrittenIdentity(
            assembleOutputShardfile(index, sections),
            index['formatVersion'],
          ),
        ),
      ),
    ).toBe((index['build'] as Json)['sourceHash'])
  })

  test('FP6 writes the four-part spelling and the copy validates', (): void => {
    const original = corpusFiles()
    const migrated = migrateShardfile(original, { hash: sha256, to: '0.1.0.0' })
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
      to: SHARDFILE_VERSION,
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
    expect(migrated.applied).toEqual([
      ...FORMAT_MIGRATIONS.map((step: FormatMigration): string => step.id),
      'test-edit',
    ])
    expect(migrated.to).toBe(SHARDFILE_VERSION)
    const { index } = validateMigrated(migrated.files, {
      hash: sha256,
      judged: 'stored',
    })
    // CP14 (FP25): the copy names its format in formatVersion, with no version and no layout marker.
    expect(index.formatVersion).toBe(SHARDFILE_VERSION)
    expect(index.version).toBeUndefined()
    expect(index.schemas).toBeUndefined()
    // FP4: the last always-empty index field goes too.
    expect(index.requires.capabilities).toBeUndefined()
  })

  test('CP14: the 0.1.0.2 copy reads in the full, lineage and download readers', (): void => {
    const copy = migrateShardfile(corpusFiles(), {
      hash: sha256,
      to: '0.1.0.2',
    })
    expect(copy.applied).toContain('cp14-format-version')
    expect(copy.applied).toContain('fp4-drop-empty-index-fields')
    const index = json(copy.files, 'shard.json')
    expect(index['formatVersion']).toBe('0.1.0.2')
    expect(Object.hasOwn(index, 'version')).toBe(false)
    expect(parseOutputLineageIndex(index).schemas).toEqual([])
    expect(readOutputDownloadIndex(index).schemas).toEqual([])
    expect(parseOutputIndex(index).formatVersion).toBe('0.1.0.2')
  })

  test('CP14: a 0.1.0.2 index carrying a legacy field is refused naming it, and a legacy one missing one', (): void => {
    const index = json(
      migrateShardfile(corpusFiles(), { hash: sha256, to: '0.1.0.2' }).files,
      'shard.json',
    )
    expect((): unknown =>
      parseOutputIndex({ ...index, version: '0.1.0.1' }),
    ).toThrow(/version/u)
    expect((): unknown => parseOutputIndex({ ...index, schemas: [] })).toThrow(
      'Format 0.1.0.2 drops schemas',
    )
    const legacy = json(corpusFiles(), 'shard.json')
    const { schemas: _schemas, ...noSchemas } = legacy
    expect((): unknown => parseOutputIndex(noSchemas)).toThrow(
      'Legacy shard.json (formatVersion 2) needs schemas',
    )
    expect((): unknown =>
      parseOutputIndex({ ...legacy, formatVersion: '0.1.0.2' }),
    ).toThrow('Format 0.1.0.2 drops version, schemas')
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

describe('requires.sdk (FP33)', (): void => {
  test('the chain drops it, 0.1.0.5 refuses it, and an older file keeps it as written', (): void => {
    const original = json(corpusFiles(), 'shard.json')
    const requires = original['requires'] as Json
    expect(requires['sdk']).toBe('0.1')
    expect(parseOutputIndex(original).requires.sdk).toBe('0.1')
    const copy = migrateShardfile(corpusFiles(), { hash: sha256 })
    expect(copy.applied).toContain('fp33-drop-requires-sdk')
    const index = json(copy.files, 'shard.json')
    expect(Object.hasOwn(index['requires'] as Json, 'sdk')).toBe(false)
    expect(
      validateMigrated(copy.files, { hash: sha256, judged: 'stored' }).index
        .requires.sdk,
    ).toBeUndefined()
    expect((): unknown =>
      parseOutputIndex({
        ...index,
        requires: { ...(index['requires'] as Json), sdk: SHARDFILE_VERSION },
      }),
    ).toThrow(`Format ${SHARDFILE_VERSION} carries no requires.sdk`)
  })
})

describe('the preparation marker (PR4)', (): void => {
  test('the sdk marker becomes the preparation spec at 0.1.0.3', (): void => {
    const original = json(corpusFiles(), 'shard.json')
    const copy = migrateShardfile(corpusFiles(), { hash: sha256 })
    expect(copy.applied).toContain('pr4-preparation-marker')
    const index = json(copy.files, 'shard.json')
    expect(index['formatVersion']).toBe(SHARDFILE_VERSION)
    expect(Object.hasOwn(index, 'sdk')).toBe(false)
    expect(preparationSpecOf(parseOutputIndex(index))).toBe(
      original['sdk'] === '0.3' ? 3 : undefined,
    )
    expect((): unknown => parseOutputIndex({ ...index, sdk: '0.2' })).toThrow(
      `Format ${SHARDFILE_VERSION} drops sdk`,
    )
  })

  test('older formats keep sdk, and the spec reads back through the format', (): void => {
    const original = json(corpusFiles(), 'shard.json')
    expect((): unknown =>
      parseOutputIndex({ ...original, preparation: 3 }),
    ).toThrow('has no preparation field')
    expect(preparationSpecOf({ sdk: '0.3' })).toBe(3)
    expect(preparationSpecOf({ sdk: '0.2' })).toBeUndefined()
    expect(preparationSpecOf({ preparation: 4 })).toBe(4)
  })
})

describe('requires.engine (FP47b)', (): void => {
  test('0.1.0.6 admits an engine floor and an older format refuses it', (): void => {
    const copy = migrateShardfile(corpusFiles(), { hash: sha256 })
    const index = json(copy.files, 'shard.json')
    const requires = { ...(index['requires'] as Json), engine: '0.1.83' }
    expect(index['formatVersion']).toBe(SHARDFILE_VERSION)
    expect(parseOutputIndex({ ...index, requires }).requires.engine).toBe(
      '0.1.83',
    )
    expect((): unknown =>
      parseOutputIndex({ ...index, formatVersion: '0.1.0.5', requires }),
    ).toThrow('Format 0.1.0.5 carries no requires.engine')
  })
})
