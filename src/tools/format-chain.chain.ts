// SHARD-COMPAT CP1: `pnpm test:chain` runs every fixture under corpus/format-versions/<version>/ through the migration
// chain to the current format and validates the copy there. A format version with no fixture fails. Pinned fixtures
// come from ~/.cache/wildshard/pins or engine's public pins release, checked against their hash and size.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { before, test } from 'node:test'

import { migrateShardfile, validateMigrated } from '../format/format-migrate.ts'
import { prepareAssetDecoders } from '../format/shardfile-assets.ts'
import {
  SHARDFILE_VERSION,
  SHARDFILE_VERSIONS,
  compareShardfileVersions,
  parseShardfileVersion,
  shardfileFormatOf,
} from '../format/version.ts'
import { freshOutput } from './format-chain-digest.ts'
import { pinnedFiles } from './one-way-pins.ts'

type Files = ReadonlyMap<string, Uint8Array>
interface Fixture {
  readonly folder?: string
  readonly pin?: Readonly<{ slug: string; hash: string; bytes: number }>
  /** A folder's migrated copy, for a format no real upload is written at yet: the chain's own output at that format. */
  readonly chainOf?: string
}

const ROOT = path.resolve(import.meta.dirname, '../..')
const VERSIONS = path.join(ROOT, 'corpus/format-versions')
const NONE = 0
const DIGEST_FLAG = '--digest'
const ARGS = 2

function sha256(bytes: Readonly<Uint8Array>): string {
  return createHash('sha256').update(bytes).digest('hex')
}

async function folderFiles(folder: string): Promise<Files> {
  const root = path.join(ROOT, folder)
  const files = new Map<string, Uint8Array>()
  for (const entry of await readdir(root, {
    recursive: true,
    withFileTypes: true,
  })) {
    if (!entry.isDirectory()) {
      const absolute = path.join(entry.parentPath, entry.name)
      // eslint-disable-next-line no-await-in-loop -- a fixture folder is small
      const bytes = new Uint8Array(await readFile(absolute))
      files.set(path.relative(root, absolute).split(path.sep).join('/'), bytes)
    }
  }
  return files
}

async function fixtureFiles(fixture: Readonly<Fixture>): Promise<Files> {
  if (fixture.folder !== undefined) {
    return await folderFiles(fixture.folder)
  }
  if (fixture.chainOf !== undefined) {
    return migrateShardfile(await folderFiles(fixture.chainOf), {
      hash: sha256,
    }).files
  }
  if (fixture.pin === undefined) {
    throw new Error('A fixture names a folder or a pin')
  }
  return await pinnedFiles(fixture.pin)
}

async function fixtures(version: string): Promise<readonly Fixture[]> {
  const text = await readFile(
    path.join(VERSIONS, version, 'fixtures.json'),
    'utf8',
  )
  const parsed: unknown = JSON.parse(text)
  const list: unknown =
    typeof parsed === 'object' && parsed !== null
      ? Reflect.get(parsed, 'fixtures')
      : undefined
  assert.ok(
    Array.isArray(list) && list.length > NONE,
    `format ${version} has no fixture`,
  )
  return list.filter(
    (row: unknown): row is Fixture => typeof row === 'object' && row !== null,
  )
}

function declaredVersion(files: Files): string {
  const parsed: unknown = JSON.parse(
    new TextDecoder().decode(files.get('shard.json')),
  )
  return shardfileFormatOf(parsed)
}

/** The digest a fresh process computes for the same fixture. */
async function freshDigest(version: string, index: number): Promise<string> {
  return await freshOutput(import.meta.filename, [
    DIGEST_FLAG,
    version,
    String(index),
  ])
}

async function checkFixture(
  version: string,
  index: number,
  fixture: Readonly<Fixture>,
): Promise<void> {
  const files = await fixtureFiles(fixture)
  const declared = declaredVersion(files)
  assert.equal(
    compareShardfileVersions(declared, version),
    NONE,
    `${fixture.folder ?? fixture.chainOf ?? fixture.pin?.slug} is at ${declared}`,
  )
  const once = migrateShardfile(files, { hash: sha256 })
  const twice = migrateShardfile(once.files, { hash: sha256 })
  assert.deepEqual(twice.applied, [])
  assert.equal(twice.digest, once.digest)
  assert.equal(await freshDigest(version, index), once.digest)
  assert.ok(compareShardfileVersions(once.to, SHARDFILE_VERSION) <= NONE)
  // A data-only chain re-seals the author preparation, so the copy passes the full preparation check.
  validateMigrated(once.files, {
    hash: sha256,
    judged: 'stored',
    preparation: once.preparation === 'stale' ? 'migrated' : 'author',
  })
}

const versions = [
  ...new Set(
    SHARDFILE_VERSIONS.map((version: string): string =>
      parseShardfileVersion(version).join('.'),
    ),
  ),
]
const [flag, digestVersion = '', digestIndex = '0'] = process.argv.slice(ARGS)

if (flag === DIGEST_FLAG) {
  const list = await fixtures(digestVersion)
  const files = await fixtureFiles(list[Number(digestIndex)] ?? {})
  process.stdout.write(`${migrateShardfile(files, { hash: sha256 }).digest}\n`)
} else {
  before(async (): Promise<void> => {
    await prepareAssetDecoders()
  })

  test('every format version has a fixture directory', async (): Promise<void> => {
    const present = new Set(await readdir(VERSIONS))
    for (const version of versions) {
      assert.ok(
        present.has(version),
        `format ${version} has no corpus/format-versions fixture`,
      )
    }
  })

  for (const version of versions) {
    test(`format ${version} fixtures migrate to ${SHARDFILE_VERSION} and validate`, async (): Promise<void> => {
      const list = await fixtures(version)
      for (const [index, fixture] of list.entries()) {
        // eslint-disable-next-line no-await-in-loop -- one shard file in memory at a time
        await checkFixture(version, index, fixture)
      }
    })
  }
}
