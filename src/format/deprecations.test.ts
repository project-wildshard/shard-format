// oxlint-disable typescript/prefer-readonly-parameter-types, max-lines-per-function -- a test over the corpus export, one describe
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

import { beforeAll, describe, expect, test } from 'vitest'

import {
  DEPRECATIONS,
  SAVE_BRIDGES,
  deprecationReport,
  deprecationsUsed,
} from './deprecations.ts'
import { migrateShardfile, validateMigrated } from './format-migrate.ts'
import { FORMAT_MIGRATIONS } from './format-migrations.ts'
import { prepareAssetDecoders } from './shardfile-assets.ts'
import { validateShardfileFolder } from './shardfileValidation.ts'

import type { FormatMigration } from './format-migrations.ts'

// SHARD-COMPAT FE7: deprecated paths carry {since, replacement}; both validators warn and list them.

type Files = ReadonlyMap<string, Uint8Array>

// ZONE-SNAPSHOTS ZS5 (J507): the made-up CLI product (format 0.1, one terrain
// tile) is the old original this chain carries forward; no stored zone.
const CORPUS = new URL('../test/fixtures/cli-fixture/', import.meta.url)
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

function readFrom(
  files: Files,
): (name: string, maxBytes: number) => Uint8Array {
  return (name: string, maxBytes: number): Uint8Array => {
    const bytes = files.get(name)
    if (bytes === undefined || bytes.length > maxBytes) {
      throw new Error(`missing ${name}`)
    }
    return bytes
  }
}

beforeAll(async (): Promise<void> => {
  await prepareAssetDecoders()
})

describe('the deprecation counter (FE7)', (): void => {
  test('each deprecation names a version, a replacement and a registered migration or none', (): void => {
    const steps = new Set(
      FORMAT_MIGRATIONS.map((step: FormatMigration): string => step.id),
    )
    expect(DEPRECATIONS.length).toBeGreaterThan(0)
    for (const row of DEPRECATIONS) {
      expect(row.since, row.id).toMatch(/^\d+\.\d+\.\d+\.\d+$/u)
      expect(row.replacement.length, row.id).toBeGreaterThan(0)
      expect(
        row.migration === undefined || steps.has(row.migration),
        row.id,
      ).toBe(true)
    }
  })

  test('finds each used path and words its warning', (): void => {
    const shard = {
      index: {
        version: '0.1',
        runtime: { kind: 'client-plan', trust: 'first-party' },
      },
      sections: new Map<string, unknown>([
        ['ui/level', { manifest: { spawn: [0, 0, 0] } }],
      ]),
    }
    expect(deprecationsUsed(shard).map((row): string => row.id)).toEqual([
      'version.two-part',
      'manifest.spawn',
      'runtime.trust',
    ])
    expect(
      deprecationsUsed({
        index: { formatVersion: 2, version: '0.1.0.1', schemas: [] },
        sections: new Map(),
      }).map((row): string => row.id),
    ).toEqual(['shard.version', 'shard.empty-fields'])
    const report = deprecationReport(shard, ['kept'])
    expect(report.warnings[0]).toBe('kept')
    expect(report.warnings[1]).toContain(
      'deprecated since 0.1.0.0 (version.two-part)',
    )
    expect(report.warnings[1]).toContain('fp6-four-part-version')
    expect(
      deprecationsUsed({
        index: { formatVersion: '0.1.0.2' },
        sections: new Map(),
      }),
    ).toEqual([])
  })

  test('FP17: save bridges name their reader', (): void => {
    for (const bridge of SAVE_BRIDGES) {
      expect(bridge.reader, bridge.path).toMatch(/^engine /u)
    }
  })

  test('the folder validator warns on an original; its migrated copy keeps only what no migration mends', (): void => {
    const original = corpusFiles()
    const validated = validateShardfileFolder(
      {
        read: readFrom(original),
        paths: (): Iterable<string> => original.keys(),
      },
      { hash: sha256, judged: 'stored' },
    )
    expect(validated.deprecations).toEqual([
      'version.two-part',
      'shard.version',
      'shard.empty-fields',
      'shard.sdk-marker',
      // FP19: the made-up CLI product is built and never prepared.
      'shard.unprepared',
      'requires.capabilities',
    ])
    expect(
      validated.warnings.some((line: string): boolean =>
        line.includes('version.two-part'),
      ),
    ).toBe(true)
    const copy = migrateShardfile(original, { hash: sha256 })
    expect(
      validateMigrated(copy.files, { hash: sha256, judged: 'stored' })
        .deprecations,
    ).toEqual([])
    // FP4: fp4-drop-requires-capabilities mends it, so the copy counts none. FP33 and FP44 deleted requires.sdk and
    // manifest.gridShardfile at zero users, so neither is counted any more.
  })
})
