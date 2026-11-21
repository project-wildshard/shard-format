// oxlint-disable typescript/prefer-readonly-parameter-types, max-lines-per-function -- a test over the corpus export: copies edited, one describe per op family
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

import { beforeAll, describe, expect, test } from 'vitest'

import { migrateShardfile, validateMigrated } from './format-migrate.ts'
import {
  drop,
  fill,
  holds,
  map,
  moveSection,
  ops,
  rename,
  renameKind,
} from './format-migration-ops.ts'
import { FORMAT_MIGRATIONS, checkMigrations } from './format-migrations.ts'
import { prepareAssetDecoders } from './shardfile-assets.ts'

import type { FormatMigration, MigratingShard } from './format-migrations.ts'

// SHARD-COMPAT FE8: the chain's ops and its registry check, on Brasscap's export (format `0.1`, unprepared).

type Files = ReadonlyMap<string, Uint8Array>
type Json = Record<string, unknown>

const CORPUS = new URL('../../corpus/exports/brasscap-mesa/', import.meta.url)
  .pathname
const CURRENT = '0.1.0.1'

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

function step(
  id: string,
  apply: (shard: MigratingShard) => void,
  extra: Partial<FormatMigration> = {},
): FormatMigration {
  return { id, to: CURRENT, touches: 'data', affects: [], apply, ...extra }
}

function shardOf(index: Json): MigratingShard {
  return { index, sections: new Map(), mounts: new Map() }
}

function noop(): void {
  // A step that changes nothing.
}

beforeAll(async (): Promise<void> => {
  await prepareAssetDecoders()
})

describe('the chain ops (FE8)', (): void => {
  test('renameKind round-trips to the same bytes, and the copy validates', (): void => {
    const plain = migrateShardfile(corpusFiles(), { hash: sha256 })
    const there = step(
      'test-bear-grizzly',
      renameKind({ from: 'bear', to: 'grizzly', keys: ['kind'] }),
    )
    const back = step(
      'test-grizzly-bear',
      renameKind({ from: 'grizzly', to: 'bear', keys: ['kind'] }),
    )
    const half = migrateShardfile(corpusFiles(), {
      hash: sha256,
      migrations: [...FORMAT_MIGRATIONS, there],
    })
    expect(
      new TextDecoder().decode(half.files.get('sections/actors/species.json')),
    ).toContain('"grizzly"')
    const round = migrateShardfile(corpusFiles(), {
      hash: sha256,
      migrations: [...FORMAT_MIGRATIONS, there, back],
    })
    expect(round.digest).toBe(plain.digest)
    expect(
      validateMigrated(round.files, { hash: sha256, judged: 'stored' }).index
        .version,
    ).toBe(CURRENT)
  })

  test('moveSection moves payload, row and path together and back again', (): void => {
    const plain = migrateShardfile(corpusFiles(), { hash: sha256 })
    const away = moveSection({
      from: 'actors/crowds',
      to: 'actors/crowd',
      schema: 'wildshard:actors/crowd@1',
    })
    const home = moveSection({
      from: 'actors/crowd',
      to: 'actors/crowds',
      schema: 'wildshard:actors/crowds@1',
    })
    const shard: MigratingShard = {
      index: {
        sections: [
          {
            name: 'actors/crowds',
            path: 'sections/actors/crowds.json',
            schema: 'wildshard:actors/crowds@1',
          },
        ],
      },
      sections: new Map<string, unknown>([['actors/crowds', { rows: [] }]]),
      mounts: new Map(),
    }
    away(shard)
    expect([...shard.sections.keys()]).toEqual(['actors/crowd'])
    expect(shard.index['sections']).toEqual([
      {
        name: 'actors/crowd',
        path: 'sections/actors/crowd.json',
        schema: 'wildshard:actors/crowd@1',
      },
    ])
    const round = migrateShardfile(corpusFiles(), {
      hash: sha256,
      migrations: [...FORMAT_MIGRATIONS, step('test-move', ops(away, home))],
    })
    expect(round.digest).toBe(plain.digest)
  })

  test('rename keeps key order, drop, fill and map edit the addressed objects', (): void => {
    const shard = shardOf({ rows: [{ one: 1, old: 2, gone: 3 }, { two: 4 }] })
    ops(
      rename({ index: true }, ['rows', '*'], { from: 'old', to: 'now' }),
      fill({ index: true }, ['rows', '*'], { key: 'tags', value: [] }),
      drop({ index: true }, ['rows', '*'], 'gone'),
      map({ index: true }, ['rows', '*'], {
        key: 'two',
        change: (value: unknown): unknown => Number(value) * 2,
      }),
    )(shard)
    expect(JSON.stringify(shard.index)).toBe(
      JSON.stringify({
        rows: [
          { one: 1, now: 2, tags: [] },
          { two: 8, tags: [] },
        ],
      }),
    )
    expect(holds({ index: true }, ['rows', '*'], 'old')(shard)).toBe(false)
    expect((): void => {
      rename({ index: true }, [], { from: 'one', to: 'two' })(
        shardOf({ one: 1, two: 2 }),
      )
    }).toThrow('both are set')
  })

  test('a step that touches files leaves the author preparation stale', (): void => {
    const files = migrateShardfile(corpusFiles(), {
      hash: sha256,
      migrations: [
        ...FORMAT_MIGRATIONS,
        step('test-files', noop, { touches: 'files' }),
      ],
    })
    expect(files.preparation).not.toBe('author')
  })
})

describe('the registry check (FE8)', (): void => {
  test('the shipped registry passes', (): void => {
    expect((): void => {
      checkMigrations(FORMAT_MIGRATIONS)
    }).not.toThrow()
  })

  test('refuses a repeat, an unknown version, a step out of order and a save step with no save migration', (): void => {
    const cases: readonly (readonly [readonly FormatMigration[], string])[] = [
      [[step('a', noop), step('a', noop)], 'registered twice'],
      [[step('a', noop, { to: '0.9.0.0' })], 'no format version'],
      [
        [step('a', noop), step('b', noop, { to: '0.1.0.0' })],
        'out of version order',
      ],
      [[step('a', noop, { affects: ['save'] })], 'without a save migration'],
    ]
    for (const [migrations, message] of cases) {
      expect((): void => {
        checkMigrations(migrations)
      }).toThrow(message)
    }
    expect((): unknown =>
      migrateShardfile(corpusFiles(), {
        hash: sha256,
        migrations: [step('a', noop), step('a', noop)],
      }),
    ).toThrow('registered twice')
  })
})
