// SHARD-COMPAT CP1: `pnpm test:chain` runs every fixture under corpus/format-versions/<version>/ through the migration
// chain to the current format and validates the copy there. A format version with no fixture fails. Pinned fixtures
// come from ~/.cache/wildshard/pins or engine's public pins release, checked against their hash and size.
import assert from 'node:assert/strict'
import { readdir } from 'node:fs/promises'
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
import { VERSIONS, fixtureFiles, fixtures, sha256 } from './format-fixtures.ts'

import type { Files, Fixture } from './format-fixtures.ts'

const NONE = 0
const DIGEST_FLAG = '--digest'
const ARGS = 2

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
  const files = await fixtureFiles(fixture, version)
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
  const files = await fixtureFiles(
    list[Number(digestIndex)] ?? {},
    digestVersion,
  )
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
